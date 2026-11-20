import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzePrompt, applyChatInstruction } from '../src/ai/engine.js';
import { generateProject } from '../src/game/generator.js';
import { serializeRbxlx } from '../src/game/rbxlx.js';
import { buildPlan } from '../src/game/plan.js';
import { parseRobloxUrl, analyzeRobloxLink } from '../src/ai/link.js';

/** Minimaler Wohlgeformtheits-Check für XML (Stack-basiert). */
function assertWellFormedXml(xml) {
  const stack = [];
  const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
  let match;
  let count = 0;
  while ((match = tagPattern.exec(xml)) !== null) {
    const [, closing, name, attrs, selfClosing] = match;
    count += 1;
    if (closing) {
      const open = stack.pop();
      assert.equal(open, name, `Schließendes Tag </${name}> passt nicht zu <${open}>`);
    } else if (!selfClosing && !attrs.trim().endsWith('/')) {
      stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `Nicht geschlossene Tags: ${stack.join(', ')}`);
  assert.ok(count > 100, `Zu wenige Tags (${count}) – Ausgabe wirkt leer.`);
}

function collect(node, className, found = []) {
  if (node.className === className) found.push(node);
  for (const child of node.children || []) collect(child, className, found);
  return found;
}

test('Textbeschreibung erzeugt ein vollständiges Spiel', () => {
  const { spec, understanding } = analyzePrompt(
    'Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.',
  );
  assert.equal(spec.genre, 'simulator');
  assert.equal(understanding.genreLabel.length > 0, true);
  assert.ok(spec.petCount >= 4, 'Pets sollten erkannt werden');
  assert.ok(spec.shopCount >= 3, 'Shops sollten erkannt werden');
  assert.ok(spec.zoneCount >= 4, 'Große Map sollte mehrere Zonen haben');

  const project = generateProject(spec);
  assert.ok(project.stats.parts > 250, `Zu wenige Bauteile: ${project.stats.parts}`);
  assert.ok(project.stats.scripts >= 5, `Zu wenige Skripte: ${project.stats.scripts}`);
  assert.ok(project.stats.scriptLines > 400, 'Luau-Code wirkt zu klein');

  const services = project.services.map((s) => s.name);
  for (const required of ['Workspace', 'ServerScriptService', 'ReplicatedStorage', 'StarterGui', 'StarterPlayer', 'Lighting', 'SoundService']) {
    assert.ok(services.includes(required), `Service fehlt: ${required}`);
  }

  const workspace = project.services.find((s) => s.name === 'Workspace');
  assert.ok(collect(workspace, 'SpawnLocation').length >= 1, 'SpawnLocation fehlt');
  assert.ok(collect(workspace, 'Model').length >= 5, 'Modelle (Shops/NPCs) fehlen');

  const replicated = project.services.find((s) => s.name === 'ReplicatedStorage');
  const configModule = collect(replicated, 'ModuleScript').find((n) => n.name === 'GameConfig');
  assert.ok(configModule, 'GameConfig-Modul fehlt');
  assert.match(configModule.props.Source.v, /Pets\s*=/);
  assert.match(configModule.props.Source.v, /Shops\s*=/);
  assert.match(configModule.props.Source.v, /Quests\s*=/);

  const serverScript = collect(project.services.find((s) => s.name === 'ServerScriptService'), 'Script')[0];
  assert.ok(serverScript, 'Server-Skript fehlt');
  assert.match(serverScript.props.Source.v, /DataStoreService/);
  assert.match(serverScript.props.Source.v, /PlayerAdded/);

  const starterGui = project.services.find((s) => s.name === 'StarterGui');
  assert.ok(collect(starterGui, 'LocalScript').length >= 1, 'Client-UI-Skript fehlt');
});

test('Alle Genres erzeugen exportierbares XML', () => {
  for (const genre of ['simulator', 'tycoon', 'horror', 'openworld', 'rpg', 'obby', 'battleroyale']) {
    const { spec } = analyzePrompt(`Erstelle ein ${genre} Spiel mit Map und Shops`);
    const project = generateProject(spec);
    const xml = serializeRbxlx(project.services);
    assert.ok(xml.startsWith('<roblox'), `${genre}: XML-Kopf fehlt`);
    assert.ok(xml.includes('<Item class="Workspace"'), `${genre}: Workspace fehlt`);
    assertWellFormedXml(xml);
  }
});

test('Export ist deterministisch und enthält Skriptquellen', () => {
  const { spec } = analyzePrompt('Erstelle ein Tycoon-Spiel mit Fabrik und Upgrades.');
  const a = serializeRbxlx(generateProject(spec).services);
  const b = serializeRbxlx(generateProject(spec).services);
  assert.equal(a.length, b.length);
  assert.equal(a, b);
  assert.match(a, /<ProtectedString name="Source">/);
  assert.ok(a.includes('PlayerAdded'));
});

test('Chat bearbeitet das bestehende Projekt inkrementell', () => {
  const { spec } = analyzePrompt('Erstelle ein Simulator-Spiel.');
  const before = generateProject(spec);
  const project = { spec, title: spec.title, version: '1.0.0' };

  const more = applyChatInstruction('Mehr Pets und eine größere Map', project);
  assert.ok(more.changes.length >= 1, 'Es sollten Änderungen gemeldet werden');
  assert.ok(more.spec.petCount > spec.petCount, 'Pet-Anzahl sollte steigen');
  assert.ok(more.spec.mapSize !== 'klein');
  assert.ok(more.reply.length > 10);

  const after = generateProject(more.spec);
  assert.notEqual(before.stats.parts, after.stats.parts);

  const color = applyChatInstruction('Bitte in Pink und Lila', { spec: more.spec, title: more.spec.title });
  assert.match(JSON.stringify(color.spec.palette), /#|rgb/i);
  assert.ok(color.changes.length >= 1);

  const genre = applyChatInstruction('Mach ein Horror-Spiel daraus', { spec: color.spec, title: color.spec.title });
  assert.equal(genre.spec.genre, 'horror');
});

test('Plugin-Plan enthält Instanzen und Skriptcode', () => {
  const { spec } = analyzePrompt('Erstelle ein Open-World-Spiel mit vier Regionen, NPCs und Shops.');
  const project = generateProject(spec);
  const plan = buildPlan(project.services);
  assert.ok(Array.isArray(plan.roots) && plan.roots.length >= 4);
  const flat = JSON.stringify(plan);
  assert.ok(flat.includes('"c":"Script"'));
  assert.ok(flat.includes('PlayerAdded'));
  assert.ok(plan.roots.some((root) => root.n === 'Workspace'));
});

test('Roblox-Links werden korrekt geparst', () => {
  const cases = [
    ['https://www.roblox.com/games/920587237/Adopt-Me', '920587237'],
    ['https://web.roblox.com/games/920587237/Adopt-Me?ref=search', '920587237'],
    ['https://www.roblox.com/de/games/4483381587/Der-Simulator', '4483381587'],
    ['roblox.com/games/123456789', '123456789'],
    ['https://www.roblox.com/discover#/experiences/920587237', '920587237'],
  ];
  for (const [url, placeId] of cases) {
    const parsed = parseRobloxUrl(url);
    assert.ok(parsed, `Link nicht erkannt: ${url}`);
    assert.equal(parsed.placeId, placeId, `Falsche Place-ID für ${url}`);
  }
  assert.equal(parseRobloxUrl('https://example.com/spiel'), null);
  assert.equal(parseRobloxUrl(''), null);
});

test('Link-Analyse nutzt echte API-Daten und erfindet nichts', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const respond = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    if (String(url).includes('/v1/games?')) {
      return respond({
        data: [{
          id: 920587237,
          name: 'Adopt Me!',
          description: 'Adopt and raise pets, trade, build your dream house.',
          creator: { id: 1, name: 'Uplift Games', type: 'Group' },
          playing: 250000,
          visits: 30000000000,
          favoritedCount: 12000000,
          maxPlayers: 50,
          genre: 'Simulation',
          genre_l1: 'Simulation',
          genre_l2: 'Town and City',
          created: '2017-07-14T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        }],
      });
    }
    if (String(url).includes('/votes')) {
      return respond({ data: { upVotes: 100, downVotes: 5 } });
    }
    return respond({});
  };

  try {
    const analysis = await analyzeRobloxLink('https://www.roblox.com/games/920587237/Adopt-Me');
    assert.equal(analysis.ok, true, analysis.error);
    assert.equal(analysis.facts.name, 'Adopt Me!');
    assert.equal(analysis.facts.creator, 'Uplift Games');
    assert.equal(analysis.facts.visits, 30000000000);
    assert.equal(analysis.facts.maxPlayers, 50);
    assert.ok(analysis.evidence.known.length >= 3);
    assert.ok(analysis.evidence.unknowns.length >= 3, 'Nicht belegbare Punkte müssen benannt werden');
    assert.ok(analysis.evidence.questions.length >= 3, 'Es müssen Rückfragen entstehen');
    assert.equal(analysis.spec.genre, 'simulator');
    assert.ok(calls.some((url) => url.includes('games?universeIds')), 'Roblox-API wurde nicht aufgerufen');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Ungültige Links ergeben eine verständliche Fehlermeldung', async () => {
  const analysis = await analyzeRobloxLink('https://example.com/nichts');
  assert.equal(analysis.ok, false);
  assert.match(analysis.error, /Roblox/);
});
