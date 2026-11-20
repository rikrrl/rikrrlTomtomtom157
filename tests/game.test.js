import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzePrompt, applyChatInstruction } from '../src/ai/engine.js';
import { generateProject, validateBuild } from '../src/game/generator.js';
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
  assert.match(configModule.props.Source.v, /pets\s*=/);
  assert.match(configModule.props.Source.v, /shops\s*=/);
  assert.match(configModule.props.Source.v, /quests\s*=/);

  const serverScript = collect(project.services.find((s) => s.name === 'ServerScriptService'), 'Script')[0];
  assert.ok(serverScript, 'Server-Skript fehlt');
  assert.match(serverScript.props.Source.v, /DataStoreService/);
  assert.match(serverScript.props.Source.v, /PlayerAdded/);

  // Die GUI wird programmatisch über das UILibrary-Modul aufgebaut; die Client-Logik liegt
  // in StarterPlayer/StarterPlayerScripts (Roblox-Standard für LocalScripts).
  const starterPlayer = project.services.find((s) => s.name === 'StarterPlayer');
  assert.ok(collect(starterPlayer, 'LocalScript').length >= 1, 'Client-UI-Skript fehlt');
  const uiLibrary = collect(replicated, 'ModuleScript').find((n) => n.name === 'UILibrary');
  assert.ok(uiLibrary, 'UILibrary-Modul fehlt');
  assert.ok(uiLibrary.props.Source.v.length > 1000, 'UILibrary-Code wirkt zu klein');
});

test('Alle Genres erzeugen exportierbares XML', () => {
  for (const genre of ['simulator', 'tycoon', 'horror', 'openworld', 'rpg', 'obby', 'battleroyale']) {
    const { spec } = analyzePrompt(`Erstelle ein ${genre} Spiel mit Map und Shops`);
    const project = generateProject(spec);
    const xml = serializeRbxlx(project.services);
    assert.ok(xml.startsWith('<?xml') && xml.includes('<roblox'), `${genre}: XML-Kopf fehlt`);
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
  // Pets sind datengetrieben (Config + Skripte), nicht als Bauteile im Workspace.
  assert.ok(
    after.config.pets.length > before.config.pets.length,
    `Mehr Pets sollten mehr Pet-Arten ergeben: ${before.config.pets.length} → ${after.config.pets.length}`,
  );

  const color = applyChatInstruction('Bitte in Pink und Lila', { spec: more.spec, title: more.spec.title });
  assert.notDeepEqual(color.spec.palette.accent2, more.spec.palette.accent2, 'Farbe sollte sich geändert haben');
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
    assert.equal(parsed.ok, true, `Link nicht erkannt: ${url}`);
    assert.equal(parsed.placeId, placeId, `Falsche Place-ID für ${url}`);
  }
  assert.equal(parseRobloxUrl('https://example.com/spiel').ok, false);
  assert.equal(parseRobloxUrl('').ok, false);
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
    if (String(url).includes('/universes/v1/places/')) {
      return respond({ universeId: 920587237 });
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
  assert.match(analysis.error, /roblox/i);
});

test('Wortspiel-Genre erzeugt ein spielbares Wortspiel', () => {
  const { spec } = analyzePrompt('Erstelle ein Wortspiel mit Buchstabenrätseln, Punkten und Rangliste.');
  assert.equal(spec.genre, 'wortspiel', 'Wortspiel wurde nicht als Genre erkannt');

  const project = generateProject(spec);
  const xml = serializeRbxlx(project.services);
  assertWellFormedXml(xml);

  assert.ok(project.stats.parts > 120, `Wortspiel-Map wirkt zu leer: ${project.stats.parts} Bauteile`);
  assert.ok(project.stats.scripts >= 5, `Zu wenige Skripte: ${project.stats.scripts}`);
  assert.ok(xml.includes('WordGameService'), 'Wortspiel-Service fehlt im Export');
  assert.ok(xml.includes('WordSubmit'), 'Client-Server-Ereignis für Wörter fehlt');

  const starterPlayer = project.services.find((s) => s.name === 'StarterPlayer');
  assert.ok(collect(starterPlayer, 'LocalScript').length >= 1, 'Wortspiel-Oberfläche fehlt');

  const validation = validateBuild(project, spec);
  assert.ok(validation.score >= 80, `Qualitätsprüfung zu schwach: ${validation.score}/100`);
});

test('Spieltiefe erhöht Detaildichte und Systemzahl', () => {
  const prompt = 'Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.';
  const results = ['basis', 'hoch', 'profi', 'meister'].map((quality) => {
    const { spec } = analyzePrompt(prompt, { quality });
    assert.equal(spec.quality, quality);
    const project = generateProject(spec);
    const validation = validateBuild(project, spec);
    assert.ok(validation.score >= 80, `${quality}: Qualitätsprüfung zu schwach (${validation.score}/100)`);
    assertWellFormedXml(serializeRbxlx(project.services));
    return {
      quality,
      parts: project.stats.parts,
      systems: (project.systems || []).length,
      scripts: project.stats.scripts,
    };
  });

  assert.ok(results[0].parts < results[1].parts, 'Hoch muss mehr Bauteile haben als Basis');
  assert.ok(results[1].parts < results[2].parts, 'Profi muss mehr Bauteile haben als Hoch');
  assert.ok(results[0].systems < results[2].systems, 'Profi muss mehr Systeme aktivieren');
  assert.ok(results[2].scripts >= results[0].scripts, 'Profi darf nicht weniger Skripte haben');
});

test('Tempo-Regler erzeugt echte Zusatzarbeit und mehr Inhalt', () => {
  const prompt = 'Erstelle ein Tycoon-Spiel mit Fabrik, Upgrades und Einnahmen.';
  const base = analyzePrompt(prompt, { quality: 'hoch', speed: 'turbo' });
  const slow = analyzePrompt(prompt, { quality: 'hoch', speed: 'ausgiebig' });

  assert.equal(base.spec.quality, slow.spec.quality, 'Tempo darf die Spieltiefe nicht verändern');
  assert.equal(base.spec.speed, 'turbo');
  assert.equal(slow.spec.speed, 'ausgiebig');
  assert.ok(slow.spec.speedSeconds > base.spec.speedSeconds, 'Ausgiebig muss länger arbeiten als Turbo');
  assert.ok(slow.spec.polishPasses > base.spec.polishPasses, 'Ausgiebig braucht mehr Zusatzpässe');

  const fastProject = generateProject(base.spec);
  const slowProject = generateProject(slow.spec);
  assert.ok(
    slowProject.stats.parts > fastProject.stats.parts,
    `Zusatzpässe müssen echte Bauteile erzeugen (${fastProject.stats.parts} vs ${slowProject.stats.parts})`,
  );
  assertWellFormedXml(serializeRbxlx(slowProject.services));
  assert.ok(validateBuild(slowProject, slow.spec).score >= 80, 'Ausgiebiges Spiel muss die Prüfung bestehen');
});
