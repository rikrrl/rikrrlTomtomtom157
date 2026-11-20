/**
 * Build-Schritt: prüft, dass alle Server- und Client-Dateien vorhanden und syntaktisch
 * gültig sind, und erzeugt ein kleines Beispielprojekt als Smoke-Test.
 * Es gibt keinen Bundler – der Client läuft als ES-Modul direkt aus public/.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'server.js',
  'src/store.js',
  'src/ai/engine.js',
  'src/ai/link.js',
  'src/game/build.js',
  'src/game/generator.js',
  'src/game/lua.js',
  'src/game/plan.js',
  'src/game/rbxlx.js',
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'plugin/RobloxAIStudio.plugin.lua',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`FEHLT: ${file}`);
    failed = true;
  }
}
if (failed) process.exit(1);

for (const file of required.filter((f) => f.endsWith('.js') && !f.startsWith('public/'))) {
  execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
}
execFileSync(process.execPath, ['--check', 'public/app.js'], { cwd: root, stdio: 'inherit' });

const { analyzePrompt } = await import('./src/ai/engine.js');
const { generateProject } = await import('./src/game/generator.js');
const { serializeRbxlx } = await import('./src/game/rbxlx.js');

const { spec } = analyzePrompt('Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.');
const project = generateProject(spec);
const xml = serializeRbxlx(project.services);

if (!xml.startsWith('<roblox') || !xml.includes('<Item class=')) {
  console.error('FEHLER: rbxlx-Ausgabe ist leer oder ungültig.');
  process.exit(1);
}

console.log(
  `Build OK – Beispielprojekt: ${project.stats.parts} Bauteile, ` +
    `${project.stats.scripts} Skripte, ${project.stats.scriptLines} Zeilen Luau, ${(xml.length / 1024).toFixed(0)} KB XML.`,
);
