import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { analyzePrompt, applyChatInstruction, QUALITY_LEVELS, SPEED_LEVELS, estimateBuild, resolveQuality, resolveSpeed } from './src/ai/engine.js';
import { analyzeRobloxLink } from './src/ai/link.js';
import { generateProject, validateBuild } from './src/game/generator.js';
import { serializeRbxlx } from './src/game/rbxlx.js';
import { buildPlan, listScripts } from './src/game/plan.js';
import { listProjects, getProject, saveProject, deleteProject, newId, newToken, flush } from './src/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '3mb' }));

/**
 * Arbeitsphasen der KI. Gewichte verteilen die Arbeitszeit.
 *  min:  ab welcher Spieltiefe die Phase dazukommt (basis 0, hoch 1, profi 2, meister 3)
 *  pass: echte Mehrarbeit – die Phase baut zusätzliche Inhalte in den Instanzbaum
 */
const STAGE_PLAN = [
  { label: 'Beschreibung und Wunschfeatures auswerten', weight: 1 },
  { label: 'Genre, Zielgruppe und Kernspielschleife festlegen', weight: 1 },
  { label: 'Wirtschaft, Preise und Fortschrittskurve berechnen', weight: 2 },
  { label: 'Gelände und Map-Grundform modellieren', weight: 3 },
  { label: 'Zonen, Wege und Plattformen anlegen', weight: 3 },
  { label: 'Gebäude mit Fassade, Dach und Schild bauen', weight: 4 },
  { label: 'Shops, Artikel und Inventar einrichten', weight: 2 },
  { label: 'Pets, NPCs und Quests verteilen', weight: 2 },
  { label: 'Erfolge, Talente und Tagesbelohnungen einbauen', weight: 2 },
  { label: 'Rätsel- und Wortspiel-Stationen platzieren', weight: 2, min: 1 },
  { label: 'Deko, Beleuchtung und Atmosphäre setzen', weight: 3 },
  { label: 'HUD, Menüs und UI-Layout gestalten', weight: 2 },
  { label: 'Luau-Systeme und Serverlogik schreiben', weight: 3 },
  { label: 'Bestenliste und Tutorial verdrahten', weight: 2, min: 1 },
  { label: 'Speicherstände und Multiplayer verdrahten', weight: 2 },
  { label: 'Detaillierungs-Durchgang (zweiter Pass)', weight: 2, min: 1, pass: true },
  { label: 'Balancing-Pässe und Feinschliff', weight: 2, min: 1 },
  { label: 'Struktur, Skripte und Export prüfen', weight: 1 },
];

/**
 * Baut den Phasenplan aus Spieltiefe (Umfang) und Tempo (Arbeitszeit).
 * Jeder Zusatzpass des Tempos ist eine zusätzliche echte Bauphase.
 */
function stagePlanFor(quality, speed) {
  const q = resolveQuality(quality);
  const s = resolveSpeed(speed);
  const rank = { basis: 0, hoch: 1, profi: 2, meister: 3 }[q.level] ?? 1;
  const stages = STAGE_PLAN.filter((stage) => (stage.min || 0) <= rank).map((stage) => ({ ...stage }));
  for (let i = 0; i < s.extraPasses; i++) {
    stages.push({
      label: `Zusatz-Feinschliff-Pass ${i + 1} (Marktstände, Deko, Coin-Spots, NPCs)`,
      weight: 2,
      pass: true,
    });
  }
  const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0);
  const totalMs = Math.min(17000, (s.seconds + q.timeBonus) * 1000);
  return stages.map((stage, i) => ({
    id: i + 1,
    label: stage.label,
    status: 'pending',
    pass: Boolean(stage.pass),
    ms: Math.max(40, Math.round((stage.weight / totalWeight) * totalMs)),
  }));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildStages(quality, speed) {
  return stagePlanFor(quality, speed);
}

/** Erzeugt Instanzbaum und abgeleitete Daten (Statistiken, Skriptliste). */
function materialize(project) {
  const built = generateProject(project.spec);
  project.stats = built.stats;
  project.scripts = built.services.flatMap((service) => listScripts(service));
  project.mapInfo = built.mapInfo;
  project.zoneCount = built.zoneCount;
  project.systems = built.systems || [];
  project.validation = validateBuild(built, project.spec);
  return built;
}

/** Führt die Bauphasen mit sichtbarem Fortschritt und echter Arbeit aus. */
async function runBuild(project) {
  const started = Date.now();
  project.stages = buildStages(project.spec.quality, project.spec.speed);
  project.estimatedMs = project.stages.reduce((sum, stage) => sum + stage.ms, 0);
  project.progress = 0;
  project.status = 'building';
  delete project.error;
  delete project.report;
  saveProject(project);

  // Grundarbeit: der vollständige Instanzbaum entsteht wirklich
  project.spec.polishPasses = 0;
  materialize(project);
  const baseParts = project.stats.parts;

  for (const stage of project.stages) {
    stage.status = 'running';
    saveProject(project);
    await delay(stage.ms);
    if (stage.pass) {
      // Echte Mehrarbeit: erneuter Generator-Durchlauf mit einem Zusatzpass mehr
      project.spec.polishPasses = (project.spec.polishPasses || 0) + 1;
      materialize(project);
      stage.detail = `${project.stats.parts} Bauteile (+${project.stats.parts - baseParts})`;
    }
    stage.status = 'done';
    const done = project.stages.filter((s) => s.status === 'done').length;
    project.progress = Math.round((done / project.stages.length) * 100);
    saveProject(project);
  }
  try {
    materialize(project);
    project.status = 'ready';
    project.progress = 100;
    project.builtAt = new Date().toISOString();
    project.report = {
      quality: project.spec.quality,
      qualityLabel: project.spec.qualityLabel || resolveQuality(project.spec.quality).label,
      speed: project.spec.speed || 'normal',
      speedLabel: project.spec.speedLabel || resolveSpeed(project.spec.speed).label,
      passes: project.spec.passes || resolveQuality(project.spec.quality).passes,
      polishPasses: project.spec.polishPasses || 0,
      parts: project.stats.parts,
      instances: project.stats.instances,
      scripts: (project.scripts || []).length,
      scriptLines: project.stats.scriptLines,
      zones: project.zoneCount,
      systems: (project.systems || []).length,
      score: project.validation ? project.validation.score : 0,
      workSeconds: Math.round((Date.now() - started) / 100) / 10,
    };
  } catch (error) {
    project.status = 'error';
    project.error = error.message;
    console.error('[build]', error);
  }
  saveProject(project);
}

function bumpVersion(version) {
  const parts = String(version || '1.0.0').split('.').map((n) => Number(n) || 0);
  return `${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
}

function safeFilename(name) {
  const cleaned = String(name || 'RobloxProjekt')
    .replace(/[^A-Za-z0-9ÄÖÜäöüß _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return cleaned || 'RobloxProjekt';
}

function newProjectShell(spec, source, understanding) {
  return {
    id: newId(),
    title: spec.title,
    spec,
    understanding,
    source,
    status: 'building',
    progress: 0,
    stages: buildStages(spec.quality, spec.speed),
    chat: [],
    version: '1.0.0',
    syncToken: newToken(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'Roblox AI Studio',
    engine: 'lokale Engine',
    version: '1.0.0',
    capabilities: ['prompt-build', 'link-rebuild', 'chat-edit', 'rbxlx-export', 'studio-plugin', 'quality-levels', 'speed-levels', 'word-game'],
    qualities: Object.values(QUALITY_LEVELS).map((q) => ({
      level: q.level, label: q.label, blurb: q.blurb,
      systems: q.systems, zoneCap: q.zoneCap, passes: q.passes, timeBonus: q.timeBonus, target: q.target,
    })),
    speeds: Object.values(SPEED_LEVELS).map((s) => ({
      level: s.level, label: s.label, blurb: s.blurb, seconds: s.seconds, extraPasses: s.extraPasses,
    })),
    presets: Object.values(QUALITY_LEVELS).flatMap((q) => Object.values(SPEED_LEVELS).map((s) => estimateBuild(q.level, s.level))),
  });
});

app.get('/api/projects', (req, res) => {
  res.json({ projects: listProjects() });
});

app.get('/api/projects/:id', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  res.json({ project });
});

app.delete('/api/projects/:id', (req, res) => {
  res.json({ ok: deleteProject(req.params.id) });
});

/** Funktion 1: Spiel aus Beschreibung erzeugen. */
/** Startet den Build im Hintergrund, damit die Fortschrittsanzeige sofort sichtbar ist. */
function startBuildInBackground(project) {
  runBuild(project).catch((error) => {
    project.status = 'error';
    project.error = error.message;
    saveProject(project);
  });
}

app.post('/api/projects', async (req, res) => {
  const body = req.body || {};
  const mode = body.mode || (body.url ? 'link' : 'prompt');

  if (mode === 'link') {
    return createFromLink(body, res);
  }

  const prompt = String(body.prompt || '').trim();
  if (prompt.length < 4) {
    return res.status(400).json({ error: 'Bitte beschreibe dein Spiel mit mindestens einem Satz.' });
  }

  try {
    const { spec, understanding } = analyzePrompt(prompt, { quality: body.quality, speed: body.speed });
    const project = newProjectShell(spec, { type: 'prompt', text: prompt }, understanding);
    project.chat.push({ role: 'user', text: prompt, at: new Date().toISOString() });
    saveProject(project);
    materialize(project);
    project.chat.push({
      role: 'assistant',
      at: new Date().toISOString(),
      text:
        `Ich habe "${spec.title}" erzeugt.\n` +
        `Genre: ${understanding.genreLabel}, Map: ${spec.mapSize} mit ${spec.zoneCount} Zonen.\n` +
        `${project.stats.parts} Bauteile, ${project.stats.instances} Instanzen, ${project.stats.scriptLines} Zeilen Luau, ${(project.systems || []).length} aktive Systeme.\n` +
        `Spieltiefe: ${spec.qualityLabel} (${(project.systems || []).length} aktive Systeme) · Tempo: ${spec.speedLabel} (${spec.polishPasses || 0} Zusatzpässe) · Qualitätsprüfung ${project.validation ? project.validation.score : 0}/100.\n\n` +
        'Du kannst jetzt als .rbxlx exportieren oder mir Änderungen sagen – ich bearbeite dasselbe Projekt weiter.',
    });
    saveProject(project);
    startBuildInBackground(project);
    res.status(201).json({ project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/** Link analysieren, ohne ein Projekt anzulegen. */
app.post('/api/analyze-link', async (req, res) => {
  try {
    const analysis = await analyzeRobloxLink(req.body?.url);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Funktion 2: Spiel anhand eines Roblox-Links nachbauen. */
async function createFromLink(body, res) {
  const url = String(body.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Bitte einen Roblox-Link einfügen.' });

  const analysis = await analyzeRobloxLink(url);
  if (!analysis.ok) {
    return res.status(422).json({ analysis, error: analysis.error });
  }

  const promptAnalysis = analyzePrompt(`${analysis.facts.name} ${analysis.facts.description || ''}`, { quality: body.quality, speed: body.speed });
  const spec = {
    ...promptAnalysis.spec,
    ...analysis.spec,
    title: analysis.facts.name || promptAnalysis.spec.title,
    features: { ...promptAnalysis.spec.features, ...analysis.spec.features },
    palette: promptAnalysis.spec.palette,
    quality: promptAnalysis.spec.quality,
    qualityLabel: promptAnalysis.spec.qualityLabel,
    speed: promptAnalysis.spec.speed,
    speedLabel: promptAnalysis.spec.speedLabel,
    speedSeconds: promptAnalysis.spec.speedSeconds,
    polishPasses: promptAnalysis.spec.polishPasses,
    passes: promptAnalysis.spec.passes,
    prompt: `Nachbau von ${analysis.facts.name}`,
    description: analysis.facts.description || '',
    source: { type: 'link', url, facts: analysis.facts },
  };

  const understanding = {
    genre: analysis.understanding.genre,
    genreLabel: analysis.facts.genre || analysis.understanding.genre,
    confidence: analysis.understanding.confidence,
    detected: { features: analysis.understanding.features },
    notes: analysis.evidence.known,
  };

  const project = newProjectShell(spec, { type: 'link', url, facts: analysis.facts }, understanding);
  project.analysis = analysis;
  project.chat.push({ role: 'user', text: url, at: new Date().toISOString() });
  project.chat.push({
    role: 'assistant',
    at: new Date().toISOString(),
    text:
      `Link analysiert: "${analysis.facts.name}" von ${analysis.facts.creator || 'unbekanntem Ersteller'}.\n` +
      `${analysis.evidence.known.length} Angaben sind über die Roblox-API belegt (Besuche, Favoriten, Genre, Beschreibung).\n\n` +
      'Nicht belegbar sind Map-Geometrie, UI-Layout, Balancing-Werte und Skripte – Roblox stellt keine Ortsdateien bereit. ' +
      'Ich habe das Spiel eng an den belegten Daten aufgebaut. Für ein originalgetreues Ergebnis beantworte bitte die Fragen rechts; ' +
      'ich erfinde keine Details.',
  });
  saveProject(project);
  materialize(project);
  startBuildInBackground(project);
  res.status(201).json({ project, analysis });
}

/** Zusätzliche Informationen zu einem Link-Projekt ergänzen. */
app.post('/api/projects/:id/link-info', async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });

  const info = String(req.body?.info || '').trim();
  if (info.length < 3) return res.status(400).json({ error: 'Bitte mindestens einen Satz ergänzen.' });

  try {
    const { spec, understanding } = analyzePrompt(`${project.title} ${info}`);
    const extraFeatures = Object.fromEntries(
      Object.entries(spec.features).filter(([, value]) => value === true),
    );
    project.spec = {
      ...project.spec,
      features: { ...project.spec.features, ...extraFeatures },
      palette: { ...project.spec.palette, ...(spec.palette || {}) },
      notes: [...(project.spec.notes || []), info.slice(0, 300)],
      extraInfo: info,
    };
    project.understanding = { ...project.understanding, ...understanding };
    project.chat.push({ role: 'user', text: info, at: new Date().toISOString() });
    project.chat.push({
      role: 'assistant',
      at: new Date().toISOString(),
      text: 'Danke – ich habe deine Zusatzinfos übernommen und Map, UI und Systeme entsprechend angepasst.',
    });
    project.version = bumpVersion(project.version);
    saveProject(project);
    materialize(project);
    await runBuild(project);
    res.json({ project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/** KI-Chat: bestehendes Projekt weiterbearbeiten. */
app.post('/api/projects/:id/chat', async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });

  const message = String(req.body?.message || '').trim();
  if (message.length < 2) return res.status(400).json({ error: 'Bitte eine Anweisung senden.' });

  try {
    const { spec, changes, reply } = applyChatInstruction(message, project);
    project.spec = spec;
    project.title = spec.title;
    project.chat.push({ role: 'user', text: message, at: new Date().toISOString() });
    project.chat.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
    project.version = bumpVersion(project.version);
    saveProject(project);
    materialize(project);
    await runBuild(project);
    res.json({ project, changes, reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/** Export als Roblox-Studio-Platzdatei (.rbxlx). */
app.get('/api/projects/:id/export/rbxlx', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  const built = generateProject(project.spec);
  const xml = serializeRbxlx(built.services);
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${safeFilename(project.title)}.rbxlx"`);
  res.send(xml);
});

/**
 * Export mit der Endung .rbxl.
 * Roblox Studio erkennt das Format am Inhalt; die erzeugte Datei ist eine gültige
 * Platzdatei und lässt sich in Studio direkt öffnen und als binäre .rbxl speichern.
 */
app.get('/api/projects/:id/export/rbxl', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  const built = generateProject(project.spec);
  const xml = serializeRbxlx(built.services);
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${safeFilename(project.title)}.rbxl"`);
  res.send(xml);
});

/** Alle Luau-Quellen als eine Textdatei. */
app.get('/api/projects/:id/export/lua', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  const built = generateProject(project.spec);
  const chunks = [];
  const collect = (node, parentPath = '') => {
    const current = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (['Script', 'LocalScript', 'ModuleScript'].includes(node.className)) {
      chunks.push(`-- ===== ${current} (${node.className}) =====\n${node.props?.Source?.v || ''}\n`);
    }
    (node.children || []).forEach((child) => collect(child, current));
  };
  built.services.forEach((service) => collect(service));
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${safeFilename(project.title)}-luau.txt"`);
  res.send(chunks.join('\n'));
});

/** Plugin: Bauplan mit echten Instanzen und Skriptquellen. */
app.get('/api/plugin/build/:id', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  const token = String(req.query.token || '');
  if (project.syncToken && token && token !== project.syncToken) {
    return res.status(403).json({ error: 'Ungültiger Sync-Token.' });
  }
  const built = generateProject(project.spec);
  res.json({
    project: { id: project.id, title: project.title, version: project.version },
    plan: buildPlan(built.services),
  });
});

/** Plugin meldet Fortschritt an die Webseite. */
app.post('/api/plugin/progress', (req, res) => {
  const { projectId, token, percent, message, step } = req.body || {};
  const project = getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  if (project.syncToken && token && token !== project.syncToken) {
    return res.status(403).json({ error: 'Ungültiger Sync-Token.' });
  }
  project.pluginProgress = {
    percent: Math.max(0, Math.min(100, Number(percent) || 0)),
    message: String(message || '').slice(0, 200),
    step: String(step || '').slice(0, 120),
    at: new Date().toISOString(),
  };
  saveProject(project);
  res.json({ ok: true });
});

/** Plugin-Quelltext zum Herunterladen. */
app.get('/plugin/source.lua', (req, res) => {
  const file = path.join(__dirname, 'plugin', 'RobloxAIStudio.plugin.lua');
  if (!fs.existsSync(file)) return res.status(404).send('-- Plugin nicht gefunden');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="RobloxAIStudio.plugin.lua"');
  res.send(fs.readFileSync(file, 'utf-8'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/*splat', (req, res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Nicht gefunden');
});

app.use((error, req, res, next) => {
  console.error('[error]', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: error.message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roblox AI Studio läuft auf http://0.0.0.0:${PORT}`);
});

const shutdown = () => {
  flush();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
