/**
 * Persistenz: Projekte werden als JSON abgelegt.
 * Auf der Free-Hosting-Stufe ist das Dateisystem flüchtig – Projekte werden deshalb
 * zusätzlich clientseitig im Browser gespiegelt und können jederzeit neu erzeugt werden.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'projects.json');

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDir();
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      cache = Array.isArray(parsed) ? parsed : [];
    } else {
      cache = [];
    }
  } catch {
    cache = [];
  }
  return cache;
}

let writeTimer = null;
function persist() {
  ensureDir();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(load(), null, 2));
  fs.renameSync(tmp, FILE);
}

function schedulePersist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      persist();
    } catch (error) {
      console.error('[store] Speichern fehlgeschlagen:', error.message);
    }
  }, 120);
  writeTimer.unref?.();
}

export function newId() {
  return crypto.randomBytes(8).toString('hex');
}

export function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

export function listProjects() {
  return load()
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((p) => ({
      id: p.id,
      title: p.title,
      genre: p.spec?.genre || null,
      sourceType: p.source?.type || 'prompt',
      status: p.status,
      progress: p.progress,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      stats: p.stats || null,
      version: p.version,
    }));
}

export function getProject(id) {
  return load().find((p) => p.id === id) || null;
}

export function saveProject(project) {
  const projects = load();
  const index = projects.findIndex((p) => p.id === project.id);
  project.updatedAt = new Date().toISOString();
  if (index >= 0) projects[index] = project;
  else projects.unshift(project);
  if (projects.length > 200) projects.length = 200;
  schedulePersist();
  return project;
}

export function deleteProject(id) {
  const projects = load();
  const index = projects.findIndex((p) => p.id === id);
  if (index < 0) return false;
  projects.splice(index, 1);
  schedulePersist();
  return true;
}

export function flush() {
  try {
    persist();
  } catch (error) {
    console.error('[store] Flush fehlgeschlagen:', error.message);
  }
}
