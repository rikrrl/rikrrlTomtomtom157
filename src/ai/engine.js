/**
 * Lokale KI-Engine: versteht Beschreibungen (Deutsch/Englisch) und wandelt sie in eine
 * Spielspezifikation um. Läuft vollständig lokal, ohne API-Kosten.
 */

import { GENRES } from '../game/generator.js';
import {
  THEMES, detectTheme, themePalette, zoneNamesFor, hashText,
} from './themes.js';

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
  fishing: ['angel', 'angeln', 'fisch', 'fische', 'fischen', 'fishing'],
  crafting: ['crafting', 'craften', 'basteln', 'rezept', 'rezepte', 'werkbank'],
  guilds: ['gilde', 'gilden', 'guild', 'clan', 'clans'],
  seasonpass: ['season pass', 'seasonpass', 'saisonpass', 'battle pass', 'season'],
  dialogue: ['dialog', 'dialoge', 'gespraech', 'reden', 'sprechende npc'],
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
 * Zwei voneinander unabhängige Regler:
 *
 *  - QUALITY_LEVELS = Spieltiefe. Bestimmt Umfang und Inhalt: Zonen, Systeme,
 *    Detaildichte, Deko und Detaillierungs-Durchläufe.
 *  - SPEED_LEVELS   = Tempo. Bestimmt, wie lange die KI arbeitet und wie viele
 *    Zusatzpässe sie fährt. Jeder Zusatzpass erzeugt echte zusätzliche Inhalte
 *    (Bauteile, Deko, Coins, Shop-Artikel, Quest-Ketten), keine Warte-Attrappe.
 *
 * Beispiel: "Turbo + Meister" = großes Spiel in kurzer Zeit,
 *           "Lass dir Zeit + Basis" = kleines Spiel mit maximaler Sorgfalt.
 */
export const QUALITY_LEVELS = {
  basis: {
    level: 'basis', label: 'Basis', blurb: 'Sauberes Grundspiel mit den Kernsystemen.',
    detail: 0.9, decor: 0.9, systems: 7, zoneCap: 4, boards: 1, passes: 1, timeBonus: 0, target: 74,
  },
  hoch: {
    level: 'hoch', label: 'Hoch', blurb: 'Mehr Zonen, mehr Deko, mehr Systeme.',
    detail: 1.25, decor: 1.35, systems: 10, zoneCap: 6, boards: 2, passes: 2, timeBonus: 1, target: 84,
  },
  profi: {
    level: 'profi', label: 'Profi', blurb: 'Volle Karte, tiefe Systeme, Feinschliff-Pässe.',
    detail: 1.7, decor: 1.95, systems: 13, zoneCap: 8, boards: 3, passes: 3, timeBonus: 2, target: 91,
  },
  meister: {
    level: 'meister', label: 'Meister', blurb: 'Maximaler Umfang, alle Systeme, mehrere Durchläufe.',
    detail: 2.2, decor: 2.6, systems: 16, zoneCap: 8, boards: 4, passes: 4, timeBonus: 3, target: 96,
  },
};

export const SPEED_LEVELS = {
  turbo: { level: 'turbo', label: 'Turbo', seconds: 2, extraPasses: 0, blurb: 'Sofort ein Ergebnis.' },
  normal: { level: 'normal', label: 'Normal', seconds: 5, extraPasses: 0, blurb: 'Zügig, ohne Zusatzpässe.' },
  gemuetlich: { level: 'gemuetlich', label: 'Gemütlich', seconds: 9, extraPasses: 1, blurb: 'Ein Feinschliff-Pass mehr.' },
  ausgiebig: { level: 'ausgiebig', label: 'Lass dir Zeit', seconds: 14, extraPasses: 2, blurb: 'Zwei Zusatzpässe, messbar mehr Inhalt.' },
};

/** Alte Projekte (schnell/gründlich/maximal) bleiben vollständig baubar. */
const LEGACY_QUALITY = { schnell: 'basis', grundlich: 'hoch', maximal: 'meister' };

export function resolveQuality(level) {
  const key = LEGACY_QUALITY[level] || level;
  return QUALITY_LEVELS[key] || QUALITY_LEVELS.hoch;
}

export function resolveSpeed(level) {
  return SPEED_LEVELS[level] || SPEED_LEVELS.normal;
}

/** Vorschau für die Oberfläche: Dauer, Umfang, Durchläufe einer Kombination. */
export function estimateBuild(quality, speed) {
  const q = resolveQuality(quality);
  const s = resolveSpeed(speed);
  const seconds = Math.min(17, s.seconds + q.timeBonus);
  return {
    quality: q.level,
    qualityLabel: q.label,
    speed: s.level,
    speedLabel: s.label,
    seconds,
    systems: q.systems,
    zoneCap: q.zoneCap,
    passes: q.passes + s.extraPasses,
    extraPasses: s.extraPasses,
    target: q.target,
  };
}

export function detectQuality(text) {
  const t = normalise(text);
  if (/(meister|meisterwerk|maximal|maximum|ultra|episch|perfekt|beste version|so gut wie moeglich|so gut wie möglich|detailreich|so detailliert)/.test(t)) {
    return QUALITY_LEVELS.meister;
  }
  if (/(profi|professionell|aufwendig|anspruchsvoll)/.test(t)) return QUALITY_LEVELS.profi;
  if (/(einfach|simpel|basic|minimal|nur klein|klein halten)/.test(t)) return QUALITY_LEVELS.basis;
  return QUALITY_LEVELS.hoch;
}

export function detectSpeed(text) {
  const t = normalise(text);
  if (/(lass dir zeit|laß dir zeit|nimm dir zeit|ausgiebig|so lange wie nötig|so lange wie noetig|ohne eile|mit ruhe|sorgfältig|sorgfaeltig|sehr genau|gründlich|gruendlich)/.test(t)) {
    return SPEED_LEVELS.ausgiebig;
  }
  if (/(gemütlich|gemuetlich|entspannt|zügig|zuegig|bald)/.test(t)) return SPEED_LEVELS.gemuetlich;
  if (/(schnell|sofort|turbo|beeil|mal eben|quick|asap)/.test(t)) return SPEED_LEVELS.turbo;
  return SPEED_LEVELS.normal;
}

/** Wörter, die fast jeder Prompt enthält und die keinen Spieltitel tragen. */
const GENERIC_TITLE_WORDS = new Set([
  'coins', 'coin', 'pets', 'pet', 'shops', 'shop', 'geld', 'muenzen', 'münzen', 'npcs', 'npc',
  'quests', 'quest', 'level', 'leveln', 'map', 'welt', 'spiel', 'spielen', 'features', 'funktionen',
  'systeme', 'mechaniken', 'update', 'version', 'sollen', 'sollte', 'kann', 'koennen', 'können',
  'wird', 'werden', 'haben', 'hat', 'gibt', 'geben', 'sowie', 'noch', 'mehr', 'sehr', 'ganz',
  'schoen', 'schön', 'gross', 'groß', 'klein', 'mittel', 'alles', 'alle', 'viele', 'bisschen',
  'sprechenden', 'sprechende', 'grosser', 'großer', 'grosse', 'große',
]);

/**
 * Titel aus der Beschreibung: die inhaltlich stärksten Wörter des Nutzers,
 * ergänzt um das Genre. Generische Wörter (Coins, Shops, Pets) rutschen nach
 * hinten, damit "Angeln Crafting Simulator" statt "Pets Coins Simulator" entsteht.
 */
function titleFromText(text, genre, themeKey = 'default') {
  const theme = THEMES[themeKey] || THEMES.default;
  const label = (GENRES[genre] || GENRES.simulator).label;
  const labelWords = new Set(label.toLowerCase().split(/[\s/]+/));
  const words = normalise(text)
    .replace(/[^a-zäöüß0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !labelWords.has(w));

  const scored = words
    .map((w, i) => ({
      w,
      i,
      generic: GENERIC_TITLE_WORDS.has(w) ? 1 : 0,
      themeWord: theme.keywords.some((k) => w.startsWith(k.slice(0, 4))) ? 1 : 0,
    }))
    .sort((a, b) => (a.themeWord - b.themeWord) || (a.generic - b.generic) || (a.i - b.i));

  const core = [];
  for (const entry of scored) {
    if (core.includes(entry.w)) continue;
    core.push(entry.w);
    if (core.length === 2) break;
  }

  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const parts = [];
  if (theme.adjective) parts.push(theme.adjective);
  parts.push(...core.map(cap));
  let title = parts.join(' ').trim();
  if (!title) return `${label} Experience`;
  const firstLabelWord = label.split(' ')[0].toLowerCase();
  if (!title.toLowerCase().includes(firstLabelWord)) title = `${title} ${label}`;
  return title;
}

/** Explizit genannte Zonen: "Zonen: Wald, Strand, Höhle" oder "mit den Gebieten ...". */
export function explicitZoneNames(text) {
  const raw = String(text || '');
  const match = raw.match(/(?:zonen?|gebiete?|inseln?|bereiche?|welten?|biome?|regionen?)\s*[:\-–]\s*([^.;\n]+)/i)
    || raw.match(/(?:mit|aus)\s+(?:den\s+|diesen\s+)?(?:zonen|gebieten|inseln|bereichen|biomen)\s+([^.;\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(/,| und | & | sowie | \+ /i)
    .map((part) => part.trim().replace(/^(der|die|das|dem|den)\s+/i, '').replace(/[.!]$/, ''))
    .filter((part) => part.length >= 3 && part.length <= 28)
    .slice(0, 8);
}

/** Inhaltswörter des Prompts – Grundlage für Gebäude- und Shop-Namen. */
export function extractKeywords(text) {
  const words = normalise(text)
    .replace(/[^a-zäöüß0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  const out = [];
  for (const word of words) {
    const clean = word.replace(/-/g, '');
    if (out.includes(clean)) continue;
    out.push(clean);
    if (out.length >= 8) break;
  }
  return out;
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

  const quality = options.quality ? resolveQuality(options.quality) : detectQuality(raw);
  const speed = options.speed ? resolveSpeed(options.speed) : detectSpeed(raw);
  const estimate = estimateBuild(quality.level, speed.level);
  const mapSize = size || (features.pets && /groß|big|riesig|huge/.test(normalise(raw)) ? 'groß' : 'mittel');

  // Thema, Seed, Zonen und Layout entstehen aus dem Text selbst. Gleicher Text
  // ergibt dasselbe Spiel, ein anderer Text ein anderes – kein Zufallsbrei.
  const themeKey = detectTheme(raw);
  const theme = THEMES[themeKey] || THEMES.default;
  const seedValue = hashText([raw.toLowerCase(), quality.level, speed.level, options.salt || ''].join('|'));
  const explicitZones = explicitZoneNames(raw);
  const plannedZones = Math.max(2, Math.min(quality.zoneCap, explicitZones.length >= 2 ? explicitZones.length : (zoneHint || (mapSize === 'riesig' ? 7 : mapSize === 'groß' ? 6 : 5))));
  const zoneNames = explicitZones.length >= 2
    ? explicitZones.slice(0, plannedZones)
    : zoneNamesFor(themeKey, (GENRES[genre] || GENRES.simulator).zoneNames, seedValue, plannedZones);
  const layout = ['ring', 'line', 'spiral', 'grid', 'cluster'][seedValue % 5];
  const keywords = extractKeywords(raw);

  const spec = {
    title: options.title || titleFromText(raw, genre, themeKey),
    genre,
    description: raw,
    prompt: raw,
    seed: seedValue,
    themeKey,
    themeLabel: theme.label,
    layout,
    zoneNames,
    keywords,
    terrain: theme.terrain,
    version: '1.0.0',
    features,
    mapSize,
    quality: quality.level,
    qualityLabel: quality.label,
    speed: speed.level,
    speedLabel: speed.label,
    speedSeconds: estimate.seconds,
    polishPasses: speed.extraPasses,
    passes: estimate.passes,
    zoneCount: Math.max(2, Math.min(quality.zoneCap, plannedZones, zoneNames.length)),
    shopCount: Math.max(2, Math.min(7, Math.max(shopHint || 0, features.shops ? 5 : 3))),
    npcCount: Math.max(2, Math.min(7, npcHint || (features.npcs ? 5 : 4))),
    petCount: features.pets ? Math.max(6, Math.min(10, petHint || 8)) : Math.max(2, Math.min(5, petHint || 4)),
    difficulty: /schwer|hard|brutal|schwierig/.test(normalise(raw)) ? 'schwer'
      : /leicht|easy|entspannt|chill/.test(normalise(raw)) ? 'leicht' : 'normal',
    theme: raw.slice(0, 120),
    palette: { ...basePalette(colors), ...themePalette(themeKey, colors) },
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
      `Titel aus deinem Text: ${spec.title}`,
      `Genre erkannt: ${(GENRES[genre] || GENRES.simulator).label}`,
      `Thema: ${theme.label}${explicitZones.length >= 2 ? ' (Zonen aus deiner Beschreibung)' : ''}`,
      `Zonen: ${spec.zoneNames.join(', ')}`,
      `Kartengröße: ${mapSize} mit ${spec.zoneCount} Zonen, Layout: ${layout}`, 
      `Shops: ${spec.shopCount}, NPCs: ${spec.npcCount}${features.pets ? `, Pets: ${spec.petCount}` : ''}`,
      `Spieltiefe: ${quality.label} (${quality.systems} Systeme, bis ${quality.zoneCap} Zonen)`,
      `Tempo: ${speed.label} – ca. ${estimate.seconds} s Arbeitszeit, ${estimate.passes} Durchläufe${speed.extraPasses ? ` inkl. ${speed.extraPasses} Zusatzpässen` : ''}`,
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

  // Welt/Theme wechseln: "mach ein Eis-Spiel", "Weltraum", "Dschungel"
  const themeHit = detectTheme(message);
  const wantsTheme = /(thema|welt|setting|schauplatz|mach|mache|änder|aendere|statt|umbauen|umstellen|wechsel)/.test(text);
  if (themeHit !== 'default' && themeHit !== spec.themeKey && wantsTheme) {
    const nextTheme = THEMES[themeHit];
    spec.themeKey = themeHit;
    spec.themeLabel = nextTheme.label;
    spec.terrain = nextTheme.terrain;
    spec.palette = { ...spec.palette, ...themePalette(themeHit) };
    spec.zoneNames = zoneNamesFor(themeHit, (GENRES[spec.genre] || GENRES.simulator).zoneNames, spec.seed || 1, spec.zoneCount || 5);
    spec.seed = (spec.seed || 1) + 5;
    changes.push(`Welt: ${nextTheme.label} – neue Zonen (${spec.zoneNames.slice(0, 4).join(', ')}), Boden ${nextTheme.terrain}, eigene Deko`);
  }

  // Zonen umbenennen: "Zonen: Wald, Strand, Höhle"
  const namedZones = explicitZoneNames(message);
  if (namedZones.length >= 2 && /(zone|zonen|gebiet|gebiete|insel|inseln|benenn|nenne|umbenennen)/i.test(text)) {
    spec.zoneNames = namedZones;
    spec.zoneCount = Math.max(2, Math.min(8, namedZones.length));
    changes.push(`Zonen aus deiner Anweisung: ${namedZones.join(', ')}`);
  }

  // Andere Anordnung der Karte
  if (/(layout|anordnung|anordnen|aufbau der karte|karte umstellen)/.test(text)) {
    const layouts = ['ring', 'line', 'spiral', 'grid', 'cluster'];
    const currentIndex = Math.max(0, layouts.indexOf(spec.layout || 'ring'));
    spec.layout = layouts[(currentIndex + 1) % layouts.length];
    changes.push(`Karten-Layout: ${spec.layout}`);
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

  // Spieltiefe (Qualität) ändern – unabhängig vom Tempo
  const qualityOrder = ['basis', 'hoch', 'profi', 'meister'];
  const currentQuality = resolveQuality(spec.quality);
  const setQuality = (next) => {
    spec.quality = next.level;
    spec.qualityLabel = next.label;
    spec.passes = next.passes + (resolveSpeed(spec.speed).extraPasses || 0);
  };
  if (/(besser|mehr details|mehr inhalt|mehr systeme|mehr tiefe|ausführlicher|ausfuehrlicher|hübscher|huebscher|aufwendiger|mehr liebe|hochwertiger)/.test(text)) {
    const index = qualityOrder.indexOf(currentQuality.level);
    if (index < qualityOrder.length - 1) {
      const next = QUALITY_LEVELS[qualityOrder[index + 1]];
      changes.push(`Spieltiefe: ${currentQuality.label} → ${next.label} (${next.systems} Systeme, bis ${next.zoneCap} Zonen)`);
      setQuality(next);
    } else {
      spec.seed = (spec.seed || 1) + 13;
      changes.push('Spieltiefe bleibt auf Meister – zusätzlicher Detail-Durchgang mit neuer Variation');
    }
  } else if (/(weniger details|einfacher|reduzier|kleiner halten)/.test(text)) {
    const index = qualityOrder.indexOf(currentQuality.level);
    if (index > 0) {
      const next = QUALITY_LEVELS[qualityOrder[index - 1]];
      changes.push(`Spieltiefe: ${currentQuality.label} → ${next.label}`);
      setQuality(next);
    }
  }

  // Tempo ändern – bestimmt Arbeitszeit und Zusatzpässe
  const speedOrder = ['turbo', 'normal', 'gemuetlich', 'ausgiebig'];
  const currentSpeed = resolveSpeed(spec.speed);
  const setSpeed = (next) => {
    spec.speed = next.level;
    spec.speedLabel = next.label;
    spec.polishPasses = next.extraPasses;
    spec.speedSeconds = Math.min(17, next.seconds + resolveQuality(spec.quality).timeBonus);
    spec.passes = resolveQuality(spec.quality).passes + next.extraPasses;
  };
  if (/(zeit lassen|zeit zu lassen|mehr zeit|nimm dir zeit|langsamer|ausgiebig|gemütlich|gemuetlich|mit ruhe|ohne eile)/.test(text)) {
    const index = speedOrder.indexOf(currentSpeed.level);
    if (index < speedOrder.length - 1) {
      const next = SPEED_LEVELS[speedOrder[index + 1]];
      changes.push(`Tempo: ${currentSpeed.label} → ${next.label} (ca. ${Math.min(17, next.seconds + resolveQuality(spec.quality).timeBonus)} s, ${next.extraPasses} Zusatzpässe)`);
      setSpeed(next);
    } else {
      changes.push('Tempo bleibt auf „Lass dir Zeit“ – die KI arbeitet bereits mit allen Zusatzpässen');
    }
  } else if (/(schneller|sofort|turbo|beeil|keine zeit|schnell machen)/.test(text)) {
    const index = speedOrder.indexOf(currentSpeed.level);
    if (index > 0) {
      const next = SPEED_LEVELS[speedOrder[index - 1]];
      changes.push(`Tempo: ${currentSpeed.label} → ${next.label}`);
      setSpeed(next);
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
    const extra = extractKeywords(message).slice(0, 4);
    const note = String(message).trim().slice(0, 200);
    spec.notes = Array.isArray(spec.notes) ? spec.notes : [];
    spec.notes.push(note);
    if (extra.length > 0) {
      spec.keywords = [...new Set([...(spec.keywords || []), ...extra])].slice(0, 10);
      spec.seed = (spec.seed || 1) + 3;
      changes.push(`Neue Inhalte aus deiner Anweisung eingebaut: ${extra.join(', ')}`);
      reply = `Erledigt. Ich habe dein bestehendes Projekt um deine Inhalte erweitert:\n${changes.map((c) => `• ${c}`).join('\n')}\n\nDie neuen Inhalte stehen als eigene Shops und Bauteile in der Welt. Du kannst die neue Version direkt exportieren.`;
    } else {
      changes.push('Design-Notiz im Projekt gespeichert');
      reply = `Ich habe deine Anweisung als Design-Notiz übernommen: "${note}". Nenne mir konkrete Inhalte (z. B. "Drachen, Vulkan, Flugzeug, Schule") oder sage "mehr Pets", "größere Map", "Farbe pink" – dann baue ich es direkt ein.`;
    }
  } else {
    spec.seed = (spec.seed || 1) + 7; // neue Variation, gleiche Basis
    reply = `Erledigt. Ich habe dein bestehendes Projekt weiterbearbeitet:\n${changes.map((c) => `• ${c}`).join('\n')}\n\nDie Karte, Skripte und Systeme wurden neu erzeugt – Fortschritt, Idee und alle bisherigen Einstellungen bleiben erhalten. Du kannst die neue Version direkt exportieren.`;
  }

  return { spec, changes, reply };
}
