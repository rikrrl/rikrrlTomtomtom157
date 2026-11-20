/**
 * Lokale KI-Engine: versteht Beschreibungen (Deutsch/Englisch) und wandelt sie in eine
 * Spielspezifikation um. Läuft vollständig lokal, ohne API-Kosten.
 */

import { GENRES } from '../game/generator.js';

const GENRE_KEYWORDS = {
  simulator: ['simulator', 'simulation', 'farm', 'clicker', 'geld verdienen', 'coins sammeln', 'grind', 'tycoon-simulator'],
  tycoon: ['tycoon', 'fabrik', 'factory', 'business', 'firma', 'imperium', 'wirtschaft', 'produktion', 'lager'],
  horror: ['horror', 'grusel', 'spuk', 'monster', 'angst', 'scary', 'dark', 'nacht', 'verlassen', 'zombie', 'slender'],
  openworld: ['open world', 'openworld', 'offene welt', 'erkunden', 'exploration', 'adventure', 'abenteuer', 'riesige map', 'große welt'],
  obby: ['obby', 'parkour', 'hindernis', 'jump', 'springen', 'plattform', 'checkpoint'],
  rpg: ['rpg', 'rollenspiel', 'fantasy', 'magie', 'dungeon', 'levelsystem', 'krieger', 'zauber', 'inventar'],
  pets: ['pets', 'pet', 'haustier', 'haustiere', 'tiere', 'tier', 'begleiter'],
  battle: ['pvp', 'kampf', 'arena', 'battle royale', 'battleroyale', 'shooter', 'waffen', 'fight'],
  wortspiel: ['wortspiel', 'wörter spiel', 'wörter-spiel', 'wörter', 'worträtsel', 'wort ratsel', 'scrabble', 'kreuzworträtsel', 'kreuzwort', 'hangman', 'galgenmännchen', 'galgenmannchen', 'word game', 'wordgame', 'buchstaben', 'vokabel'],
};

const FEATURE_KEYWORDS = {
  pets: ['pet', 'haustier', 'haustiere', 'tier', 'begleiter', 'companion'],
  coins: ['coin', 'coins', 'münze', 'münzen', 'geld', 'währung', 'currency', 'cash'],
  shops: ['shop', 'shops', 'laden', 'läden', 'store', 'kaufen', 'markt', 'händler', 'market'],
  quests: ['quest', 'quests', 'auftrag', 'aufträge', 'mission', 'missionen', 'aufgabe', 'task'],
  npcs: ['npc', 'npcs', 'charakter', 'charaktere', 'bewohner', 'figuren'],
  rebirth: ['rebirth', 'prestige', 'neustart', 'reset bonus'],
  multiplayer: ['multiplayer', 'mehrspieler', 'co-op', 'coop', 'zusammen spielen', 'server'],
  save: ['speicher', 'speichern', 'save', 'fortschritt', 'daten'],
  animations: ['animation', 'animationen', 'effekt', 'effekte', 'partikel', 'vfx', 'tween'],
  combat: ['kampf', 'kämpfen', 'combat', 'angriff', 'schaden', 'hp', 'leben'],
  inventory: ['inventar', 'inventory', 'items', 'gegenstände'],
  leaderboard: ['rangliste', 'leaderboard', 'highscore', 'bestenliste'],
  achievements: ['achievement', 'achievements', 'erfolg', 'erfolge', 'trophäe', 'trophäen', 'badges'],
  talents: ['talent', 'talente', 'skill', 'skills', 'fähigkeiten', 'faehigkeiten', 'talentbaum', 'skilltree'],
  trading: ['trading', 'handel', 'handeln', 'tauschen', 'trade'],
  daily: ['daily', 'täglich', 'taeglich', 'tagesbelohnung', 'streak', 'login bonus'],
  boss: ['boss', 'bossfight', 'endgegner', 'raid'],
  weather: ['wetter', 'weather', 'tag nacht', 'tageszeit', 'day night'],
  wordgame: ['wortspiel', 'wörter', 'worträtsel', 'scrabble', 'kreuzworträtsel', 'hangman', 'word game'],
};

const SIZE_KEYWORDS = [
  { size: 'riesig', words: ['riesig', 'huge', 'gigantisch', 'enorm', 'massiv', 'very big'] },
  { size: 'groß', words: ['groß', 'gross', 'large', 'big', 'weite', 'weitläufig'] },
  { size: 'klein', words: ['klein', 'small', 'mini', 'kompakt', 'winzig'] },
  { size: 'mittel', words: ['mittel', 'medium', 'normal'] },
];

const COLOR_KEYWORDS = [
  { name: 'lila', rgb: [140, 100, 255] },
  { name: 'violett', rgb: [150, 90, 240] },
  { name: 'blau', rgb: [70, 130, 255] },
  { name: 'türkis', rgb: [60, 210, 210] },
  { name: 'cyan', rgb: [70, 220, 240] },
  { name: 'grün', rgb: [90, 200, 120] },
  { name: 'rot', rgb: [235, 80, 90] },
  { name: 'orange', rgb: [250, 150, 60] },
  { name: 'gelb', rgb: [245, 210, 80] },
  { name: 'pink', rgb: [240, 110, 190] },
  { name: 'gold', rgb: [235, 190, 80] },
  { name: 'neon', rgb: [110, 250, 220] },
];

const STOP_WORDS = new Set([
  'erstelle', 'erstellen', 'mache', 'mach', 'baue', 'bauen', 'bitte', 'ein', 'eine', 'einen', 'einem',
  'ein', 'der', 'die', 'das', 'den', 'dem', 'mit', 'und', 'für', 'fuer', 'von', 'im', 'in', 'auf',
  'spiel', 'game', 'roblox', 'studio', 'soll', 'sollen', 'ich', 'mir', 'mein', 'meine', 'will',
  'möchte', 'moechte', 'create', 'make', 'build', 'a', 'an', 'the', 'with', 'and', 'for', 'of',
  'to', 'my', 'me', 'please', 'spiel', 'wie', 'als', 'auch', 'sehr', 'viele', 'viel', 'gute', 'guten',
]);

function normalise(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function stem(word) {
  return word.replace(/(es|en|e|s|n)$/u, '') || word;
}

export function detectGenre(text) {
  const t = normalise(text);
  let best = { genre: 'simulator', score: 0 };
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    // Wortstämme sammeln, damit "pet" und "pets" nicht doppelt zählen.
    const stems = new Set();
    for (const word of words) {
      if (t.includes(word)) stems.add(stem(word));
    }
    let score = stems.size * 2;
    if (stems.size > 0) {
      // "Erstelle ein Simulator-Spiel", "Simulator spiel", "tycoon game" wiegen stärker
      // als beiläufig genannte Inhalte wie "mit Pets und Coins".
      const direct = new RegExp(
        `(^|[\\s(])(erstelle|erstellen|mache|baue|create|make|build)?\\s*(ein|eine|einen|a|an)?\\s*${genre}`,
        'i',
      );
      if (direct.test(t)) score += 6;
      if (new RegExp(`${genre}[-\\s](spiel|game)`, 'i').test(t)) score += 4;
    }
    if (score > best.score) best = { genre, score };
  }
  if (best.score === 0) {
    // Ohne Genre-Treffer: Inhalte entscheiden
    if (containsAny(t, FEATURE_KEYWORDS.pets)) return { genre: 'pets', score: 1 };
    if (containsAny(t, ['obby', 'parkour'])) return { genre: 'obby', score: 1 };
  }
  return best;
}

export function detectFeatures(text) {
  const t = normalise(text);
  const features = {
    pets: false, coins: false, shops: false, quests: false, npcs: false,
    rebirth: false, multiplayer: true, save: true, animations: true,
    combat: false, inventory: false, leaderboard: false,
  };
  for (const [feature, words] of Object.entries(FEATURE_KEYWORDS)) {
    if (containsAny(t, words)) features[feature] = true;
  }
  if (!features.coins && !features.shops && !features.pets && !features.quests) {
    // Standardumfang eines vollständigen Spiels
    features.coins = true;
    features.shops = true;
    features.quests = true;
  }
  return features;
}

export function detectSize(text) {
  const t = normalise(text);
  for (const entry of SIZE_KEYWORDS) {
    if (containsAny(t, entry.words)) return entry.size;
  }
  return null;
}

export function detectColors(text) {
  const t = normalise(text);
  return COLOR_KEYWORDS.filter((c) => t.includes(c.name)).map((c) => c.rgb);
}

/**
 * Qualitätsstufen: bestimmen Detaildichte, Anzahl der Systeme und die Rechenzeit.
 * "Die KI lässt sich Zeit" ist hier eine echte Größe, keine Anzeige-Attrappe.
 */
export const QUALITY_LEVELS = {
  schnell: { level: 'schnell', label: 'Schnell', detail: 0.6, decor: 0.55, systems: 3, zoneCap: 4, passes: 1, seconds: 1 },
  grundlich: { level: 'grundlich', label: 'Gründlich', detail: 1, decor: 1, systems: 6, zoneCap: 6, passes: 2, seconds: 5 },
  maximal: { level: 'maximal', label: 'Maximal', detail: 1.6, decor: 1.75, systems: 9, zoneCap: 8, passes: 3, seconds: 10 },
};

export function detectQuality(text) {
  const t = normalise(text);
  if (/(maximal|maximum|ultra|episch|perfekt|beste|best|so gut wie moeglich|so gut wie möglich|detailreich|so detailliert)/.test(t)) {
    return QUALITY_LEVELS.maximal;
  }
  if (/(schnell|quick|sofort|mal eben|kurz|simpel|einfach nur)/.test(t)) return QUALITY_LEVELS.schnell;
  return QUALITY_LEVELS.grundlich;
}

function titleFromText(text, genre) {
  const words = normalise(text)
    .replace(/[^a-zäöüß0-9\s]/gi, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const label = (GENRES[genre] || GENRES.simulator).label;
  if (words.length === 0) return `${label} Experience`;
  const core = words.slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${core} ${label}`;
}

export function countMentions(text, words) {
  const t = normalise(text);
  let n = 0;
  for (const word of words) {
    const matches = t.match(new RegExp(`\\b${word}`, 'g'));
    if (matches) n += matches.length;
  }
  return n;
}

/** Standard-Palette (dunkles Design mit lila-blauen Akzenten). */
export function basePalette(colors = []) {
  const accent = colors[0] || [124, 92, 255];
  const accent2 = colors[1] || [64, 196, 255];
  return {
    accent,
    accent2,
    ground: [86, 130, 88],
    base: [58, 56, 88],
    lightAmbient: [70, 70, 100],
    lightOutdoor: [110, 110, 140],
    brightness: 2,
  };
}

/**
 * Beschreibung -> Spielspezifikation.
 * @returns {{spec: object, understanding: object}}
 */
export function analyzePrompt(text, options = {}) {
  const raw = String(text || '').trim();
  const { genre, score } = detectGenre(raw);
  const features = detectFeatures(raw);
  const size = detectSize(raw);
  const colors = detectColors(raw);

  const zoneHint = countMentions(raw, ['zone', 'zonen', 'gebiet', 'bereich', 'insel', 'welt', 'region', 'biome']);
  const shopHint = countMentions(raw, ['shop', 'shops', 'laden', 'läden', 'markt']);
  const npcHint = countMentions(raw, ['npc', 'npcs', 'händler', 'charakter', 'bewohner']);
  const petHint = countMentions(raw, ['pet', 'pets', 'haustier', 'haustiere', 'tier', 'tiere']);

  const quality = options.quality ? (QUALITY_LEVELS[options.quality] || QUALITY_LEVELS.grundlich) : detectQuality(raw);
  const mapSize = size || (features.pets && /groß|big|riesig|huge/.test(normalise(raw)) ? 'groß' : 'mittel');

  const spec = {
    title: options.title || titleFromText(raw, genre),
    genre,
    description: raw,
    prompt: raw,
    seed: Math.floor(Math.random() * 1_000_000),
    version: '1.0.0',
    features,
    mapSize,
    quality: quality.level,
    qualityLabel: quality.label,
    zoneCount: Math.max(2, Math.min(quality.zoneCap, zoneHint || (mapSize === 'riesig' ? 7 : mapSize === 'groß' ? 6 : 5))),
    shopCount: Math.max(2, Math.min(7, Math.max(shopHint || 0, features.shops ? 5 : 3))),
    npcCount: Math.max(2, Math.min(7, npcHint || (features.npcs ? 5 : 4))),
    petCount: features.pets ? Math.max(6, Math.min(10, petHint || 8)) : Math.max(2, Math.min(5, petHint || 4)),
    difficulty: /schwer|hard|brutal|schwierig/.test(normalise(raw)) ? 'schwer'
      : /leicht|easy|entspannt|chill/.test(normalise(raw)) ? 'leicht' : 'normal',
    theme: raw.slice(0, 120),
    palette: basePalette(colors),
    source: { type: 'prompt', text: raw },
  };

  const understanding = {
    genre,
    genreLabel: (GENRES[genre] || GENRES.simulator).label,
    confidence: Math.min(0.98, 0.55 + score * 0.1 + (features.pets ? 0.05 : 0)),
    detected: {
      features: Object.entries(features).filter(([, v]) => v).map(([k]) => k),
      mapSize,
      colors: colors.length,
      difficulty: spec.difficulty,
    },
    notes: [
      `Genre erkannt: ${(GENRES[genre] || GENRES.simulator).label}`,
      `Kartengröße: ${mapSize} mit ${spec.zoneCount} Zonen`,
      `Shops: ${spec.shopCount}, NPCs: ${spec.npcCount}${features.pets ? `, Pets: ${spec.petCount}` : ''}`,
      `Qualitätsstufe: ${quality.label} (${quality.systems} Systeme, ${quality.passes} Prüfdurchläufe)`,
    ],
  };

  return { spec, understanding };
}

/** Chat-Anweisung auf ein bestehendes Projekt anwenden (inkrementell, ohne Neustart). */
export function applyChatInstruction(message, project) {
  const text = normalise(message);
  const spec = JSON.parse(JSON.stringify(project.spec));
  const changes = [];
  let reply = '';

  const bump = (key, amount, min, max, label) => {
    const before = spec[key];
    spec[key] = Math.max(min, Math.min(max, (spec[key] || min) + amount));
    if (spec[key] !== before) changes.push(`${label}: ${before} → ${spec[key]}`);
  };

  // Umbenennen
  const renameMatch = message.match(/(?:nenne|nenn|benenne|name|titel|title)[^"'„“]*["'„“]?([A-Za-zÄÖÜäöüß0-9 :\-]{3,40})["'“”]?/i);
  if (renameMatch && /nenne|nenn|benenne|umbenennen|titel|title/i.test(message)) {
    const newTitle = renameMatch[1].replace(/^(es|das spiel|the game)\s+/i, '').trim();
    if (newTitle.length >= 3) {
      changes.push(`Titel: ${spec.title} → ${newTitle}`);
      spec.title = newTitle;
    }
  }

  // Genre wechseln
  const genreHit = detectGenre(message);
  if (genreHit.score > 0 && /(statt|instead|mach|mache|ändere|aendere|change|switch|als)/.test(text) && genreHit.genre !== spec.genre) {
    changes.push(`Genre: ${spec.genre} → ${genreHit.genre}`);
    spec.genre = genreHit.genre;
  } else if (genreHit.score >= 2 && genreHit.genre !== spec.genre && /(genre|spielart)/.test(text)) {
    changes.push(`Genre: ${spec.genre} → ${genreHit.genre}`);
    spec.genre = genreHit.genre;
  }

  // Features hinzufügen / entfernen
  const wantsRemove = /(entferne|entfern|ohne|keine|kein|remove|weniger|loesche|lösche)/.test(text);
  for (const [feature, words] of Object.entries(FEATURE_KEYWORDS)) {
    if (!containsAny(text, words)) continue;
    if (wantsRemove && !/(mehr|more|hinzufuegen|hinzufügen|add)/.test(text)) {
      if (spec.features[feature]) {
        spec.features[feature] = false;
        changes.push(`Feature entfernt: ${feature}`);
      }
    } else if (!spec.features[feature]) {
      spec.features[feature] = true;
      changes.push(`Feature aktiviert: ${feature}`);
    }
  }

  // Mengen
  if (/(mehr|more|größer|groesser|bigger)\s+(pets|haustiere|tiere)/.test(text)) bump('petCount', 2, 3, 10, 'Pets');
  if (/(weniger|fewer|less)\s+(pets|haustiere)/.test(text)) bump('petCount', -2, 3, 10, 'Pets');
  if (/(mehr|more)\s+(shops|läden|laeden)/.test(text)) bump('shopCount', 1, 2, 7, 'Shops');
  if (/(mehr|more)\s+(zonen|zones|gebiete|inseln)/.test(text)) bump('zoneCount', 1, 2, 8, 'Zonen');
  if (/(mehr|more)\s+(npcs|händler|haendler)/.test(text)) bump('npcCount', 1, 2, 7, 'NPCs');

  // Qualität / Detailtiefe erhöhen
  if (/(besser|mehr details|mehr inhalt|mehr systeme|mehr tiefe|ausführlicher|ausfuehrlicher|hübscher|huebscher|aufwendiger|mehr liebe)/.test(text)) {
    const order = ['schnell', 'grundlich', 'maximal'];
    const current = order.indexOf(spec.quality || 'grundlich');
    if (current < order.length - 1) {
      spec.quality = order[current + 1];
      changes.push(`Qualitätsstufe: ${spec.quality}`);
    } else {
      spec.seed = (spec.seed || 1) + 13;
      changes.push('Zusätzliche Detail- und Variationsstufe erzeugt');
    }
  }

  // Kartengröße
  const sizeHit = detectSize(message);
  if (sizeHit && sizeHit !== spec.mapSize && /(map|karte|welt|world|größer|groesser|kleiner)/.test(text)) {
    changes.push(`Kartengröße: ${spec.mapSize} → ${sizeHit}`);
    spec.mapSize = sizeHit;
  }

  // Farben
  const colors = detectColors(message);
  if (colors.length > 0 && /(farbe|color|farben|design|akzent|lila|blau|rot|grün|gruen|pink|gold|orange|türkis|tuerkis|neon|cyan|violett|gelb)/.test(text)) {
    spec.palette = { ...spec.palette, accent: colors[0], accent2: colors[1] || spec.palette.accent2 };
    changes.push(`Akzentfarben: ${colors.map((c) => `rgb(${c.join(',')})`).join(' / ')}`);
  }

  // Atmosphäre
  if (/(dunkler|dunkel|darker)/.test(text)) {
    spec.palette = { ...spec.palette, brightness: Math.max(0.5, spec.palette.brightness - 0.6), lightAmbient: spec.palette.lightAmbient.map((c) => Math.round(c * 0.7)) };
    changes.push('Beleuchtung dunkler');
  }
  if (/(heller|hell|brighter)/.test(text)) {
    spec.palette = { ...spec.palette, brightness: Math.min(4, spec.palette.brightness + 0.6), lightAmbient: spec.palette.lightAmbient.map((c) => Math.min(255, Math.round(c * 1.25))) };
    changes.push('Beleuchtung heller');
  }

  // Schwierigkeit / Progression
  if (/(schwerer|schwieriger|harder)/.test(text)) {
    spec.difficulty = 'schwer';
    changes.push('Schwierigkeit: schwer');
  }
  if (/(leichter|einfacher|easier)/.test(text)) {
    spec.difficulty = 'leicht';
    changes.push('Schwierigkeit: leicht');
  }

  if (changes.length === 0) {
    // Fallback: Anweisung als Design-Notiz übernehmen, damit nichts verloren geht
    const note = String(message).trim().slice(0, 200);
    spec.notes = Array.isArray(spec.notes) ? spec.notes : [];
    spec.notes.push(note);
    changes.push('Design-Notiz im Projekt gespeichert');
    reply = `Ich habe deine Anweisung als Design-Notiz übernommen: "${note}". Sage mir konkreter, was ich bauen soll (z. B. "mehr Pets", "größere Map", "Farbe pink", "mehr Shops", "Genre Horror"), dann ändere ich die passenden Systeme.`;
  } else {
    spec.seed = (spec.seed || 1) + 7; // neue Variation, gleiche Basis
    reply = `Erledigt. Ich habe dein bestehendes Projekt weiterbearbeitet:\n${changes.map((c) => `• ${c}`).join('\n')}\n\nDie Karte, Skripte und Systeme wurden neu erzeugt – Fortschritt, Idee und alle bisherigen Einstellungen bleiben erhalten. Du kannst die neue Version direkt exportieren.`;
  }

  return { spec, changes, reply };
}
