import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3987;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return await response.json();
    } catch {
      // Server startet noch
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Server wurde nicht rechtzeitig bereit.');
}

test('Webseite und API arbeiten end-to-end', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roblox-ai-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  t.after(() => {
    server.kill('SIGTERM');
  });

  const health = await waitForServer();
  assert.equal(health.ok, true);
  assert.match(health.engine, /Lokal/i);

  // Startseite
  const page = await fetch(`${BASE}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Roblox AI Studio/);
  assert.match(html, /id="view"/);

  const css = await fetch(`${BASE}/styles.css`);
  assert.equal(css.status, 200);

  // Funktion 1: Spiel aus Beschreibung
  const created = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'prompt',
      prompt: 'Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.',
    }),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const { project } = await created.json();
  assert.ok(project.id);
  assert.equal(project.status, 'ready');
  assert.ok(project.stats.parts > 250);
  assert.ok(project.stats.scripts >= 5);
  assert.equal(project.progress, 100);
  assert.ok(project.stages.length >= 4);
  assert.ok(project.chat.length >= 2);
  assert.ok(project.syncToken);
  assert.ok(project.scripts.length >= 5);

  // Export .rbxlx
  const rbxlx = await fetch(`${BASE}/api/projects/${project.id}/export/rbxlx`);
  assert.equal(rbxlx.status, 200);
  assert.match(rbxlx.headers.get('content-type'), /xml/);
  assert.match(rbxlx.headers.get('content-disposition'), /attachment; filename=.*\.rbxlx/);
  const xml = await rbxlx.text();
  assert.ok(xml.startsWith('<roblox'));
  assert.ok(xml.includes('<Item class="Workspace"'));
  assert.ok(xml.includes('<ProtectedString name="Source">'));

  // Export .rbxl
  const rbxl = await fetch(`${BASE}/api/projects/${project.id}/export/rbxl`);
  assert.equal(rbxl.status, 200);
  assert.match(rbxl.headers.get('content-disposition'), /\.rbxl"/);

  // Luau-Bündel
  const lua = await fetch(`${BASE}/api/projects/${project.id}/export/lua`);
  assert.equal(lua.status, 200);
  const luaText = await lua.text();
  assert.match(luaText, /GameConfig|MainServer|PlayerAdded/);

  // KI-Chat: Projekt weiterbearbeiten
  const chat = await fetch(`${BASE}/api/projects/${project.id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Bitte mehr Pets und eine größere Map' }),
  });
  assert.equal(chat.status, 200, await chat.clone().text());
  const chatData = await chat.json();
  assert.ok(chatData.project.version !== project.version, 'Version sollte steigen');
  assert.ok(chatData.project.chat.length > project.chat.length);
  assert.ok(chatData.reply.length > 10);
  assert.ok(chatData.project.spec.petCount > project.spec.petCount);

  // Projektliste
  const list = await fetch(`${BASE}/api/projects`);
  const listData = await list.json();
  assert.ok(listData.projects.some((item) => item.id === project.id));

  // Plugin: Bauplan + Fortschritt
  const plan = await fetch(`${BASE}/api/plugin/build/${project.id}?token=${project.syncToken}`);
  assert.equal(plan.status, 200);
  const planData = await plan.json();
  assert.ok(planData.plan.roots.length >= 4);
  assert.ok(JSON.stringify(planData.plan).includes('"c":"Script"'));

  const badToken = await fetch(`${BASE}/api/plugin/build/${project.id}?token=falsch`);
  assert.equal(badToken.status, 403);

  const progress = await fetch(`${BASE}/api/plugin/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      token: project.syncToken,
      percent: 60,
      step: 'Baue Map',
      message: '120 Instanzen',
    }),
  });
  assert.equal(progress.status, 200);
  const afterProgress = await (await fetch(`${BASE}/api/projects/${project.id}`)).json();
  assert.equal(afterProgress.project.pluginProgress.percent, 60);

  // Plugin-Quelle
  const plugin = await fetch(`${BASE}/plugin/source.lua`);
  assert.equal(plugin.status, 200);
  const pluginText = await plugin.text();
  assert.match(pluginText, /CreateToolbar/);
  assert.match(pluginText, /api\/plugin\/build/);

  // Link-Analyse mit ungültigem Link
  const badLink = await fetch(`${BASE}/api/analyze-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/kein-roblox-link' }),
  });
  const badLinkData = await badLink.json();
  assert.equal(badLinkData.analysis.ok, false);

  // Löschen
  const removed = await fetch(`${BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const missing = await fetch(`${BASE}/api/projects/${project.id}`);
  assert.equal(missing.status, 404);

  assert.equal(stderr.includes('Error'), false, `Server-Fehler: ${stderr}`);
});
