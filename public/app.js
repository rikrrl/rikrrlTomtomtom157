const state = {
  view: 'home',
  projects: [],
  current: null,
  analysis: null,
  analyzing: false,
  busy: false,
  draftPrompt: '',
  draftUrl: '',
  linkInfo: '',
};

const EXAMPLES = [
  'Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.',
  'Erstelle ein Tycoon-Spiel mit Fabrik, Upgrades und Einnahmen.',
  'Erstelle ein Horror-Spiel mit dunkler Map, Monstern und Quests.',
  'Erstelle ein Open-World-Spiel mit vier Regionen, NPCs und Shops.',
  'Erstelle ein RPG mit Levelsystem, Inventar, Quests und Dungeon.',
];

const CHAT_SUGGESTIONS = [
  'Mehr Pets',
  'Größere Map',
  'Mehr Shops',
  'Farbe pink',
  'Schwerer machen',
  'Genre Horror',
  'Mehr NPCs',
];

const els = {
  view: document.getElementById('view'),
  crumbs: document.getElementById('crumbs'),
  projectList: document.getElementById('project-list'),
  projectCount: document.getElementById('project-count'),
  toasts: document.getElementById('toasts'),
  badge: document.getElementById('engine-badge'),
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n) {
  if (typeof n !== 'number') return '–';
  return new Intl.NumberFormat('de-DE').format(n);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = (data && (data.error || data.analysis?.error)) || `Fehler ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  els.toasts.appendChild(node);
  setTimeout(() => node.remove(), 5200);
}

/* ---------- Sidebar ---------- */

function renderSidebar() {
  els.projectCount.textContent = String(state.projects.length);
  if (!state.projects.length) {
    els.projectList.innerHTML = '<p class="empty">Noch keine Projekte.</p>';
    return;
  }
  els.projectList.innerHTML = state.projects
    .map((project) => {
      const statusClass = project.status === 'ready' ? 'live' : project.status === 'building' ? 'busy' : 'err';
      const active = state.current && state.current.id === project.id ? ' active' : '';
      const genre = project.genre || 'Spiel';
      return `
        <button class="project-item${active}" data-project="${esc(project.id)}">
          <span class="pi-title">${esc(project.title)}</span>
          <span class="pi-meta"><span class="dot ${statusClass}"></span>${esc(genre)} · v${esc(project.version)}</span>
        </button>`;
    })
    .join('');
}

async function loadProjects() {
  try {
    const data = await api('/api/projects');
    state.projects = data.projects || [];
    renderSidebar();
  } catch (error) {
    toast(`Projekte konnten nicht geladen werden: ${error.message}`, 'error');
  }
}

/* ---------- Home ---------- */

function renderHome() {
  els.crumbs.textContent = 'Übersicht';
  const analysisHtml = state.analysis ? renderAnalysis(state.analysis) : '';
  els.view.innerHTML = `
    <section class="hero">
      <h1>Dein KI-Entwickler für <span class="grad">Roblox Studio</span></h1>
      <p>Beschreibe ein Spiel oder füge einen Roblox-Link ein. Die KI erzeugt Map, Gebäude, Shops, Pets, NPCs,
      Quests, UI und Luau-Skripte – und exportiert alles als Roblox-Studio-Datei. Alles läuft lokal auf diesem Server.</p>
    </section>

    <section class="cards">
      <article class="card accent">
        <div class="card-head"><span class="num">1</span><h2>Spiel beschreiben</h2></div>
        <p class="hint">Sage in eigenen Worten, was gebaut werden soll. Genre, Umfang und Features erkennt die KI aus dem Text.</p>
        <textarea id="prompt-input" placeholder="z. B. Erstelle ein Simulator-Spiel mit Pets, Coins, Shops und einer großen Map.">${esc(state.draftPrompt)}</textarea>
        <div class="chips" id="examples">
          ${EXAMPLES.map((example) => `<button class="chip" data-example="${esc(example)}">${esc(example.split(' ').slice(0, 4).join(' '))}…</button>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn" id="create-prompt" ${state.busy ? 'disabled' : ''}>Spiel erstellen</button>
          <span class="hint">${state.busy ? 'Die KI baut dein Spiel …' : 'Dauert wenige Sekunden'}</span>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><span class="num">2</span><h2>Roblox-Link nachbauen</h2></div>
        <p class="hint">Link zu einem Roblox-Spiel einfügen. Die KI liest die echten Spieldaten über die Roblox-API und fragt nach,
        was sich nicht belegen lässt – statt Details zu erfinden.</p>
        <input type="url" id="link-input" placeholder="https://www.roblox.com/games/PLACEID/Spielname" value="${esc(state.draftUrl)}" />
        <div class="btn-row">
          <button class="btn secondary" id="analyze-link" ${state.analyzing ? 'disabled' : ''}>
            ${state.analyzing ? 'Analysiere …' : 'Link analysieren'}
          </button>
          <button class="btn" id="rebuild-link" ${state.analyzing || state.busy ? 'disabled' : ''}>Nachbauen</button>
        </div>
        <p class="tiny">Hinweis: Roblox stellt keine Ortsdateien (.rbxl) zum Download bereit. Belegt sind Metadaten,
        Beschreibung und Statistiken; Map-Geometrie und UI brauchen Screenshots oder Beschreibungen von dir.</p>
      </article>
    </section>

    ${analysisHtml}
  `;

  const promptInput = document.getElementById('prompt-input');
  promptInput.addEventListener('input', (event) => {
    state.draftPrompt = event.target.value;
  });
  document.querySelectorAll('[data-example]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.draftPrompt = chip.dataset.example;
      promptInput.value = state.draftPrompt;
      promptInput.focus();
    });
  });
  document.getElementById('create-prompt').addEventListener('click', () => createFromPrompt());

  const linkInput = document.getElementById('link-input');
  linkInput.addEventListener('input', (event) => {
    state.draftUrl = event.target.value;
  });
  document.getElementById('analyze-link').addEventListener('click', () => analyzeLink());
  document.getElementById('rebuild-link').addEventListener('click', () => createFromLink());

  const infoButton = document.getElementById('send-link-info');
  if (infoButton) {
    infoButton.addEventListener('click', () => sendLinkInfo(state.current ? state.current.id : null));
  }
  const infoField = document.getElementById('link-info');
  if (infoField) {
    infoField.addEventListener('input', (event) => {
      state.linkInfo = event.target.value;
    });
  }
}

function renderAnalysis(analysis) {
  if (!analysis.ok) {
    return `
      <article class="card">
        <h2>Analyse nicht möglich</h2>
        <p class="hint">${esc(analysis.error || 'Der Link konnte nicht ausgewertet werden.')}</p>
      </article>`;
  }
  const facts = analysis.facts || {};
  const rows = [
    ['Name', facts.name],
    ['Ersteller', facts.creator],
    ['Roblox-Genre', [facts.genre, facts.genreL2].filter(Boolean).join(' / ')],
    ['Besuche', facts.visits != null ? fmt(facts.visits) : null],
    ['Favoriten', facts.favorites != null ? fmt(facts.favorites) : null],
    ['Max. Spieler', facts.maxPlayers],
    ['Likes / Dislikes', facts.likes != null ? `${fmt(facts.likes)} / ${fmt(facts.dislikes)}` : null],
    ['Place-ID', facts.placeId],
  ].filter(([, value]) => value != null && value !== '');

  return `
    <article class="card">
      <div class="card-head"><span class="num">✓</span><h2>Link analysiert: ${esc(facts.name || 'Unbekannt')}</h2></div>
      <div class="grid-2" style="gap:16px">
        <div class="stack">
          <div class="section-title">Belegte Daten (Roblox-API)</div>
          <div class="facts">
            ${rows.map(([key, value]) => `<div class="fact"><span class="fk">${esc(key)}</span><span class="fv">${esc(value)}</span></div>`).join('')}
          </div>
          ${facts.description ? `<div class="section-title">Beschreibung</div><p class="hint">${esc(String(facts.description).slice(0, 600))}</p>` : ''}
          <div class="section-title">Erkannte Features</div>
          <div class="meta-row">
            ${(analysis.understanding.features || []).map((f) => `<span class="tag purple">${esc(f)}</span>`).join('') || '<span class="tag">keine aus der Beschreibung erkennbar</span>'}
          </div>
        </div>
        <div class="stack">
          <div class="section-title">Nicht belegbar – dafür brauche ich dich</div>
          ${(analysis.evidence.unknowns || []).map((item) => `<div class="question"><span class="q-ico">!</span><span>${esc(item)}</span></div>`).join('')}
          <div class="section-title">Fragen</div>
          ${(analysis.evidence.questions || []).map((q) => `<div class="question"><span class="q-ico">?</span><span>${esc(q.question)}</span></div>`).join('')}
        </div>
      </div>
    </article>`;
}

/* ---------- Projektansicht ---------- */

function statusTag(project) {
  if (project.status === 'ready') return '<span class="tag ok">Bereit</span>';
  if (project.status === 'building') return '<span class="tag warn">Wird gebaut</span>';
  return '<span class="tag warn">Fehler</span>';
}

function renderProject() {
  const project = state.current;
  if (!project) {
    renderHome();
    return;
  }
  els.crumbs.textContent = project.title;
  const stats = project.stats || {};
  const stages = project.stages || [];
  const scripts = project.scripts || [];
  const progress = project.progress || 0;
  const origin = window.location.origin;

  const analysisCard = project.analysis && project.analysis.ok
    ? `<article class="card">
        <div class="section-title">Nachbau-Quelle</div>
        <h3 style="font-size:15px">${esc(project.analysis.facts.name)}</h3>
        <p class="hint">${esc(project.analysis.facts.creator || 'Unbekannter Ersteller')} · Place-ID ${esc(project.analysis.facts.placeId)}</p>
        <div class="meta-row">
          ${(project.analysis.understanding.features || []).map((f) => `<span class="tag purple">${esc(f)}</span>`).join('')}
        </div>
        <div class="divider"></div>
        <div class="section-title">Offene Punkte für mehr Genauigkeit</div>
        ${(project.analysis.evidence.questions || []).map((q) => `<div class="question"><span class="q-ico">?</span><span>${esc(q.question)}</span></div>`).join('')}
        <textarea id="link-info" placeholder="Ergänze Details: Map-Aufbau, UI-Farben, Mechaniken, Preise …">${esc(state.linkInfo)}</textarea>
        <button class="btn secondary small" id="send-link-info">Informationen übernehmen</button>
      </article>`
    : '';

  els.view.innerHTML = `
    <section class="project-head">
      <div class="project-title">
        <h1>${esc(project.title)}</h1>
        <div class="meta-row">
          ${statusTag(project)}
          <span class="tag purple">${esc(project.spec?.genre || 'Spiel')}</span>
          <span class="tag">Version ${esc(project.version)}</span>
          <span class="tag">${esc(project.spec?.mapSize || 'mittel')}e Map</span>
          <span class="tag">${esc(project.zoneCount || project.spec?.zoneCount || 0)} Zonen</span>
          <span class="tag">${esc(project.source?.type === 'link' ? 'Nachbau' : 'Beschreibung')}</span>
        </div>
      </div>
      <div class="btn-row">
        <a class="btn small" href="/api/projects/${esc(project.id)}/export/rbxlx" download>⬇ .rbxlx</a>
        <button class="btn secondary small" id="delete-project">Löschen</button>
      </div>
    </section>

    <section class="grid-2">
      <div class="stack">
        <article class="card">
          <div class="progress-label">
            <span>Fortschritt</span><span>${progress}%</span>
          </div>
          <div class="progress"><div style="width:${progress}%"></div></div>
          <div class="stages">
            ${stages.map((stage) => `
              <div class="stage ${stage.status === 'done' ? 'done' : ''}">
                <span class="s-ico">${stage.status === 'done' ? '✓' : '•'}</span>${esc(stage.label)}
              </div>`).join('')}
          </div>
        </article>

        <article class="card">
          <div class="card-head"><span class="num">✦</span><h2>KI-Chat</h2></div>
          <p class="hint">Die KI kennt dein aktuelles Projekt und bearbeitet es weiter – ohne neu anzufangen.</p>
          <div class="messages" id="messages">
            ${(project.chat || []).map((message) => `
              <div class="msg ${message.role === 'user' ? 'user' : 'assistant'}">
                <span class="who">${message.role === 'user' ? 'Du' : 'KI'}</span>${esc(message.text)}
              </div>`).join('')}
          </div>
          <div class="chips">
            ${CHAT_SUGGESTIONS.map((s) => `<button class="chip" data-chat="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          <div class="chat-input">
            <textarea id="chat-input" placeholder="Was soll ich ändern? z. B. „mehr Pets und größere Map“"></textarea>
            <button class="btn" id="send-chat" ${state.busy ? 'disabled' : ''}>Senden</button>
          </div>
        </article>
      </div>

      <div class="stack">
        <article class="card">
          <div class="section-title">Projekt-Daten</div>
          <div class="stats">
            <div class="stat"><span class="v">${fmt(stats.parts)}</span><span class="k">Bauteile</span></div>
            <div class="stat"><span class="v">${fmt(stats.instances)}</span><span class="k">Instanzen</span></div>
            <div class="stat"><span class="v">${fmt(stats.scripts)}</span><span class="k">Skripte</span></div>
            <div class="stat"><span class="v">${fmt(stats.scriptLines)}</span><span class="k">Zeilen Luau</span></div>
            <div class="stat"><span class="v">${fmt(stats.models)}</span><span class="k">Modelle</span></div>
            <div class="stat"><span class="v">${fmt(project.spec?.shopCount)}</span><span class="k">Shops</span></div>
          </div>
        </article>

        <article class="card">
          <div class="section-title">Downloads</div>
          <div class="download-list">
            <a class="download" href="/api/projects/${esc(project.id)}/export/rbxlx" download>
              <span class="dl-main"><span class="dl-name">.rbxlx</span><span class="dl-desc">Roblox-Studio-Platzdatei (XML) – direkt öffnen</span></span>
              <span class="btn secondary small">Laden</span>
            </a>
            <a class="download" href="/api/projects/${esc(project.id)}/export/rbxl" download>
              <span class="dl-main"><span class="dl-name">.rbxl</span><span class="dl-desc">Platzdatei – in Studio öffnen und als Binärdatei speichern</span></span>
              <span class="btn secondary small">Laden</span>
            </a>
            <a class="download" href="/api/projects/${esc(project.id)}/export/lua" download>
              <span class="dl-main"><span class="dl-name">Luau-Quellen</span><span class="dl-desc">Alle Skripte als Textdatei</span></span>
              <span class="btn secondary small">Laden</span>
            </a>
          </div>
        </article>

        <article class="card">
          <div class="section-title">Roblox-Studio-Plugin</div>
          <p class="hint">Das Plugin holt den Bauplan und legt die Instanzen direkt in Studio an.</p>
          <div class="code">Server: ${esc(origin)}</div>
          <div class="code">Projekt-ID: ${esc(project.id)}</div>
          <div class="code">Token: ${esc(project.syncToken || '')}</div>
          <div class="steps">
            <div class="step">Plugin-Datei herunterladen.</div>
            <div class="step">In <b>%LOCALAPPDATA%\Roblox\Plugins</b> (Windows) bzw. <b>~/Documents/Roblox/Plugins</b> (Mac) legen.</div>
            <div class="step">Studio neu starten, Plugin öffnen, Server, Projekt-ID und Token einfügen.</div>
            <div class="step">„Projekt bauen“ – Instanzen und Skripte werden erzeugt.</div>
          </div>
          <div class="btn-row">
            <a class="btn secondary small" href="/plugin/source.lua" download>Plugin herunterladen</a>
          </div>
          ${project.pluginProgress ? `
            <div class="divider"></div>
            <div class="progress-label"><span>Studio: ${esc(project.pluginProgress.step || '')}</span><span>${esc(project.pluginProgress.percent)}%</span></div>
            <div class="progress"><div style="width:${esc(project.pluginProgress.percent)}%"></div></div>
            <p class="tiny">${esc(project.pluginProgress.message || '')}</p>` : ''}
        </article>

        <article class="card">
          <div class="section-title">Skripte (${scripts.length})</div>
          <div class="script-list">
            ${scripts.map((script) => `
              <div class="script-row">
                <span class="sr-path">${esc(script.path)}</span>
                <span class="sr-lines">${fmt(script.lines)} Z.</span>
              </div>`).join('')}
          </div>
        </article>

        ${analysisCard}
      </div>
    </section>
  `;

  document.getElementById('delete-project').addEventListener('click', async () => {
    try {
      await api(`/api/projects/${project.id}`, { method: 'DELETE' });
      state.current = null;
      state.view = 'home';
      await loadProjects();
      render();
      toast('Projekt gelöscht.', 'ok');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  const sendChat = () => sendMessage();
  document.getElementById('send-chat').addEventListener('click', sendChat);
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    }
  });
  document.querySelectorAll('[data-chat]').forEach((chip) => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.chat;
      chatInput.focus();
    });
  });

  const infoButton = document.getElementById('send-link-info');
  if (infoButton) {
    infoButton.addEventListener('click', () => sendLinkInfo(project.id));
  }
  const infoField = document.getElementById('link-info');
  if (infoField) {
    infoField.addEventListener('input', (event) => {
      state.linkInfo = event.target.value;
    });
  }

  const messages = document.getElementById('messages');
  if (messages) messages.scrollTop = messages.scrollHeight;
}

/* ---------- Aktionen ---------- */

async function createFromPrompt() {
  const prompt = (state.draftPrompt || '').trim();
  if (prompt.length < 4) {
    toast('Bitte beschreibe dein Spiel zuerst.', 'error');
    return;
  }
  state.busy = true;
  render();
  try {
    const data = await api('/api/projects', { method: 'POST', body: { mode: 'prompt', prompt } });
    state.current = data.project;
    state.view = 'project';
    state.draftPrompt = '';
    await loadProjects();
    toast(`„${data.project.title}“ wurde erstellt.`, 'ok');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.busy = false;
    render();
  }
}

async function analyzeLink() {
  const url = (state.draftUrl || '').trim();
  if (!url) {
    toast('Bitte einen Roblox-Link einfügen.', 'error');
    return;
  }
  state.analyzing = true;
  render();
  try {
    const data = await api('/api/analyze-link', { method: 'POST', body: { url } });
    state.analysis = data.analysis;
    if (!data.analysis.ok) toast(data.analysis.error, 'error');
    else toast('Link analysiert.', 'ok');
  } catch (error) {
    state.analysis = { ok: false, error: error.message };
    toast(error.message, 'error');
  } finally {
    state.analyzing = false;
    render();
  }
}

async function createFromLink() {
  const url = (state.draftUrl || '').trim();
  if (!url) {
    toast('Bitte einen Roblox-Link einfügen.', 'error');
    return;
  }
  state.busy = true;
  render();
  try {
    const data = await api('/api/projects', { method: 'POST', body: { mode: 'link', url } });
    state.current = data.project;
    state.view = 'project';
    state.draftUrl = '';
    await loadProjects();
    toast(`Nachbau von „${data.project.title}“ erstellt.`, 'ok');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.busy = false;
    render();
  }
}

async function sendMessage() {
  const project = state.current;
  if (!project || state.busy) return;
  const input = document.getElementById('chat-input');
  const message = (input.value || '').trim();
  if (!message) return;
  state.busy = true;
  project.chat = project.chat || [];
  project.chat.push({ role: 'user', text: message });
  render();
  try {
    const data = await api(`/api/projects/${project.id}/chat`, { method: 'POST', body: { message } });
    state.current = data.project;
    await loadProjects();
    toast('Projekt aktualisiert.', 'ok');
  } catch (error) {
    toast(error.message, 'error');
    await openProject(project.id);
  } finally {
    state.busy = false;
    render();
  }
}

async function sendLinkInfo(projectId) {
  if (!projectId) {
    toast('Baue zuerst ein Projekt aus dem Link.', 'error');
    return;
  }
  const info = (state.linkInfo || '').trim();
  if (info.length < 3) {
    toast('Bitte ergänze zuerst Details.', 'error');
    return;
  }
  state.busy = true;
  render();
  try {
    const data = await api(`/api/projects/${projectId}/link-info`, { method: 'POST', body: { info } });
    state.current = data.project;
    state.linkInfo = '';
    await loadProjects();
    toast('Informationen übernommen.', 'ok');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.busy = false;
    render();
  }
}

async function openProject(id) {
  try {
    const data = await api(`/api/projects/${id}`);
    state.current = data.project;
    state.view = 'project';
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- Render ---------- */

function render() {
  renderSidebar();
  if (state.view === 'project' && state.current) renderProject();
  else renderHome();
}

document.addEventListener('click', (event) => {
  const projectButton = event.target.closest('[data-project]');
  if (projectButton) openProject(projectButton.dataset.project);
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'new-prompt') {
      state.view = 'home';
      state.current = null;
      render();
      setTimeout(() => document.getElementById('prompt-input')?.focus(), 40);
    }
    if (action === 'new-link') {
      state.view = 'home';
      state.current = null;
      render();
      setTimeout(() => document.getElementById('link-input')?.focus(), 40);
    }
    if (action === 'plugin') {
      if (state.current) {
        render();
        document.querySelector('.code')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast('Öffne zuerst ein Projekt – dort findest du Server, Projekt-ID und Token.', 'info');
      }
    }
  }
});

async function init() {
  try {
    const health = await api('/api/health');
    els.badge.textContent = `${health.engine} · bereit`;
  } catch {
    els.badge.textContent = 'Server nicht erreichbar';
  }
  await loadProjects();
  render();
}

init();
