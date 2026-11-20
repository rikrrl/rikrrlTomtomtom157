/**
 * Roblox-Link-Analyse.
 *
 * Roblox stellt keine Ortsdateien (.rbxl) zum Download bereit. Was öffentlich verfügbar ist,
 * sind Metadaten über die offiziellen Web-APIs. Diese werden hier echt abgefragt.
 * Alles, was sich daraus nicht belegen lässt, wird als offene Frage zurückgegeben –
 * es wird nichts erfunden.
 */

const UA = 'RobloxAIStudio/1.0 (+https://appjet.dev)';
const TIMEOUT_MS = 9000;

export function parseRobloxUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Leerer Link.' };
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'Das ist keine gültige URL.' };
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const allowed = ['roblox.com', 'rbx.place', 'web.roblox.com', 'm.roblox.com'];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { ok: false, error: 'Bitte einen Link von roblox.com einfügen (z. B. https://www.roblox.com/games/PLACEID/Name).' };
  }

  const params = url.searchParams;
  const fromQuery = params.get('placeId') || params.get('placeid') || params.get('universeId') || params.get('universeid');
  if (fromQuery && /^\d+$/.test(fromQuery)) {
    const isUniverse = Boolean(params.get('universeId') || params.get('universeid'));
    return { ok: true, id: fromQuery, kind: isUniverse ? 'universe' : 'place', raw };
  }

  const match = url.pathname.match(/\/(?:games|game|places|discover\/games)\/(\d+)/i) || url.pathname.match(/\/(\d{5,})/);
  if (match) {
    return { ok: true, id: match[1], kind: 'place', raw };
  }
  return { ok: false, error: 'In diesem Link ist keine Roblox-Place-ID enthalten.' };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'Zeitüberschreitung' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUniverseId(placeId) {
  const result = await fetchJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (result.ok && result.data?.universeId) return result.data.universeId;
  return null;
}

const GENRE_HINTS = [
  { genre: 'horror', words: ['horror', 'scary', 'fear', 'spuk', 'grusel', 'ghost', 'haunted', 'nightmare', 'backrooms'] },
  { genre: 'tycoon', words: ['tycoon', 'factory', 'business', 'empire', 'industry', 'production'] },
  { genre: 'obby', words: ['obby', 'parkour', 'jump', 'tower of hell', 'stages'] },
  { genre: 'pets', words: ['pet', 'hatch', 'egg', 'companion'] },
  { genre: 'battle', words: ['pvp', 'battle', 'fight', 'arena', 'combat', 'battleground', 'blox fruits'] },
  { genre: 'rpg', words: ['rpg', 'quest', 'fantasy', 'magic', 'dungeon', 'adventure'] },
  { genre: 'openworld', words: ['open world', 'open-world', 'explore', 'survival', 'world'] },
  { genre: 'simulator', words: ['simulator', 'sim', 'clicker', 'grind', 'rebirth'] },
];

const FEATURE_HINTS = {
  pets: ['pet', 'egg', 'hatch', 'companion'],
  coins: ['coin', 'cash', 'money', 'gold', 'currency'],
  shops: ['shop', 'store', 'buy', 'purchase', 'market'],
  quests: ['quest', 'mission', 'objective', 'task'],
  rebirth: ['rebirth', 'prestige', 'reset'],
  combat: ['fight', 'combat', 'damage', 'sword', 'weapon', 'pvp'],
  inventory: ['inventory', 'backpack', 'items'],
  leaderboard: ['leaderboard', 'ranking', 'top'],
  multiplayer: ['multiplayer', 'co-op', 'team', 'trade'],
};

function deriveGenre(game) {
  const text = `${game.name || ''} ${game.description || ''} ${(game.genre_l1 || '')} ${(game.genre_l2 || '')}`.toLowerCase();
  const scores = GENRE_HINTS.map(({ genre, words }) => ({
    genre,
    score: words.reduce((sum, word) => (text.includes(word) ? sum + (word.includes(' ') ? 3 : 2) : sum), 0),
  })).sort((a, b) => b.score - a.score);
  return { genre: scores[0].score > 0 ? scores[0].genre : 'simulator', score: scores[0].score };
}

function deriveFeatures(game) {
  const text = `${game.name || ''} ${game.description || ''}`.toLowerCase();
  const found = [];
  const missing = [];
  for (const [feature, words] of Object.entries(FEATURE_HINTS)) {
    if (words.some((w) => text.includes(w))) found.push(feature);
    else missing.push(feature);
  }
  return { found, missing };
}

function formatNumber(value) {
  if (typeof value !== 'number') return null;
  return new Intl.NumberFormat('de-DE').format(value);
}

/**
 * Analysiert einen Roblox-Link vollständig.
 * @returns {Promise<object>} Analyse inkl. belegter Fakten und offener Fragen.
 */
export async function analyzeRobloxLink(input) {
  const parsed = parseRobloxUrl(input);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, stage: 'parse' };
  }

  let universeId = parsed.kind === 'universe' ? parsed.id : null;
  const placeId = parsed.kind === 'place' ? parsed.id : null;
  if (!universeId) {
    universeId = await resolveUniverseId(placeId);
  }

  if (!universeId) {
    return {
      ok: false,
      stage: 'resolve',
      placeId,
      error: `Roblox konnte zu dieser Place-ID (${placeId}) kein Spiel finden. Prüfe den Link – oder trage die Spieldaten unten manuell ein.`,
    };
  }

  const [gameResult, votesResult, favoritesResult] = await Promise.all([
    fetchJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
    fetchJson(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`),
    fetchJson(`https://games.roblox.com/v1/games/${universeId}/favorites/count`),
  ]);

  const game = gameResult.ok ? gameResult.data?.data?.[0] : null;
  if (!game) {
    return {
      ok: false,
      stage: 'metadata',
      placeId,
      universeId,
      error: 'Die Roblox-Metadaten waren nicht abrufbar (API nicht erreichbar oder Spiel nicht öffentlich). Bitte später erneut versuchen oder Spieldaten manuell eintragen.',
    };
  }

  const votes = votesResult.ok ? votesResult.data?.data?.[0] : null;
  const favorites = favoritesResult.ok ? favoritesResult.data : null;
  const { genre, score } = deriveGenre(game);
  const { found, missing } = deriveFeatures(game);

  const thumbnailUrl = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`;
  const thumbnailResult = await fetchJson(thumbnailUrl);
  const iconUrl = thumbnailResult.ok ? thumbnailResult.data?.data?.[0]?.imageUrl || null : null;

  const facts = {
    placeId,
    universeId,
    name: game.name,
    description: game.description || null,
    creator: game.creator?.name || null,
    creatorType: game.creator?.type || null,
    created: game.created || null,
    updated: game.updated || null,
    visits: game.visits ?? null,
    playing: game.playing ?? null,
    maxPlayers: game.maxPlayers ?? null,
    favorites: favorites?.favoritesCount ?? null,
    likes: votes?.upVotes ?? null,
    dislikes: votes?.downVotes ?? null,
    genre: game.genre_l1 || game.genre || null,
    genreL2: game.genre_l2 || null,
    iconUrl,
    url: `https://www.roblox.com/games/${placeId || game.rootPlaceId || ''}/`,
  };

  const known = [
    `Name: ${facts.name}`,
    facts.creator ? `Ersteller: ${facts.creator} (${facts.creatorType})` : null,
    facts.genre ? `Roblox-Genre: ${facts.genre}${facts.genreL2 ? ` / ${facts.genreL2}` : ''}` : null,
    facts.visits !== null ? `Besuche: ${formatNumber(facts.visits)}` : null,
    facts.favorites !== null ? `Favoriten: ${formatNumber(facts.favorites)}` : null,
    facts.maxPlayers ? `Max. Spieler: ${facts.maxPlayers}` : null,
    facts.updated ? `Zuletzt aktualisiert: ${new Date(facts.updated).toLocaleDateString('de-DE')}` : null,
    facts.description ? `Beschreibung: ${facts.description.slice(0, 400)}` : 'Beschreibung: keine öffentliche Beschreibung vorhanden',
  ].filter(Boolean);

  const unknowns = [
    'Genaue Map-Geometrie, Gebäudemaße und Geländeformen',
    'Layout und Gestaltung der Benutzeroberfläche (HUD, Shops, Menüs)',
    'Konkrete Balancing-Werte (Preise, XP-Kurven, Drop-Raten)',
    'Skripte, Remote-Events und serverseitige Systeme',
    'Animationen, Sounds und Partikeleffekte',
  ];

  const questions = [
    {
      id: 'screenshots',
      question: 'Bitte lade 2–5 Screenshots aus dem Spiel hoch (Map-Übersicht, HUD, Shop-Fenster, Inventar).',
      why: 'Roblox liefert keine Ortsdateien. Ohne Bilder lassen sich Layout und UI nicht belegen.',
      required: true,
    },
    {
      id: 'mechanics',
      question: 'Welche Kernmechaniken sind dir wichtig? (z. B. Rebirth, Trading, Kampf, Quests, Haustiere)',
      why: 'Die Mechaniken stehen nicht in den Metadaten.',
      required: true,
    },
    {
      id: 'ui',
      question: 'Wie sieht die Oberfläche aus – Farben, Anordnung, wichtige Buttons?',
      why: 'Für eine originalgetreue UI werden konkrete Angaben benötigt.',
      required: false,
    },
    {
      id: 'map',
      question: 'Wie ist die Map aufgebaut (Zonen, Gebäude, Wege, Besonderheiten)?',
      why: 'Kartenlayout ist nur über Bilder oder Beschreibung rekonstruierbar.',
      required: false,
    },
  ];

  const confidence = Math.min(0.85, 0.35 + (facts.description ? 0.2 : 0) + score * 0.03 + (found.length ? 0.1 : 0));

  return {
    ok: true,
    stage: 'done',
    facts,
    understanding: {
      genre,
      genreScore: score,
      features: found,
      missingFeatures: missing,
      confidence: Number(confidence.toFixed(2)),
    },
    evidence: { known, unknowns, questions },
    spec: {
      genre,
      title: facts.name || 'Roblox Rebuild',
      features: {
        pets: found.includes('pets'),
        coins: found.includes('coins'),
        shops: found.includes('shops'),
        quests: found.includes('quests'),
        npcs: true,
        rebirth: found.includes('rebirth'),
        multiplayer: true,
        save: true,
        animations: true,
        combat: found.includes('combat'),
        inventory: found.includes('inventory'),
        leaderboard: found.includes('leaderboard'),
      },
      mapSize: (facts.maxPlayers || 0) > 30 ? 'groß' : 'mittel',
      zoneCount: Math.min(6, Math.max(3, Math.round((facts.maxPlayers || 12) / 8))),
      shopCount: found.includes('shops') ? 3 : 2,
      npcCount: 3,
      petCount: found.includes('pets') ? 6 : 4,
      difficulty: 'normal',
      palette: { accent: [124, 92, 255], accent2: [64, 196, 255] },
    },
  };
}
