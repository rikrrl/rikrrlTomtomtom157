/**
 * Themen-Erkennung: leitet aus der Beschreibung ab, WIE die Welt aussieht.
 *
 * Bisher kamen Zonen-Namen, Farben und Deko fest aus dem Genre – deshalb sahen
 * alle Spiele eines Genres gleich aus. Hier bekommt jedes Thema (Eis, Lava,
 * Weltraum, Mittelalter, Cyber, ...) eigene Zonen, Farben, Bodenmaterial,
 * Deko, Pets und NPC-Namen. Der Seed entsteht aus dem Text, damit derselbe Text
 * dasselbe Spiel ergibt und ein anderer Text ein anderes.
 */

export const THEMES = {
  default: {
    key: 'default',
    label: 'Standard',
    adjective: '',
    keywords: [],
    terrain: 'grass',
    decor: 'standard',
    palette: { accent: [124, 92, 255], accent2: [64, 196, 255], ground: [86, 138, 74], base: [70, 66, 110] },
    zones: [],
    pets: ['Funkelkatze', 'Steinwächter', 'Glutwelpe', 'Nebelgeist', 'Kristalldrache', 'Schattenfuchs', 'Wolkenbär', 'Lavafalke'],
    npcs: ['Händler Miro', 'Wächterin Lya', 'Alter Weiser', 'Schmied Toran', 'Forscherin Neva', 'Kapitän Boro', 'Sternendeuterin Vela', 'Buchhändlerin Rilla'],
  },
  eis: {
    key: 'eis',
    label: 'Eis & Schnee',
    adjective: 'Frost',
    keywords: ['eis', 'schnee', 'winter', 'frost', 'gletscher', 'pinguin', 'polar', 'ice', 'snow'],
    terrain: 'snow',
    decor: 'snow',
    palette: { accent: [96, 180, 255], accent2: [200, 245, 255], ground: [226, 238, 248], base: [150, 180, 215] },
    zones: ['Eisgipfel', 'Frosthöhle', 'Schneefeld', 'Gletscher-See', 'Eispalast', 'Nordlicht-Hügel', 'Lawinen-Pass', 'Gefrorene Ruine'],
    pets: ['Frostwelpe', 'Eispinguin', 'Schneehase', 'Gletscherbär', 'Polarfuchs', 'Eisdrache', 'Frostkobold', 'Nordlicht-Luchs'],
    npcs: ['Eisfischer Kalle', 'Wächterin Norja', 'Schneeschmied Björn', 'Forscherin Ilva', 'Polarführer Sven', 'Händlerin Frosta'],
  },
  lava: {
    key: 'lava',
    label: 'Lava & Vulkan',
    adjective: 'Glut',
    keywords: ['lava', 'vulkan', 'feuer', 'glut', 'magma', 'asche', 'obsidian', 'hölle', 'hoelle', 'fire'],
    terrain: 'rock',
    decor: 'lava',
    palette: { accent: [255, 110, 50], accent2: [255, 200, 60], ground: [72, 52, 50], base: [58, 40, 40] },
    zones: ['Vulkan-Krater', 'Lavastrom', 'Aschefeld', 'Obsidian-Höhle', 'Glut-Schmiede', 'Magma-See', 'Feuer-Tempel', 'Rauch-Klamm'],
    pets: ['Glutwelpe', 'Lavadrache', 'Aschefuchs', 'Magmawurm', 'Flammenfalke', 'Obsidiangolem', 'Feuersalamander', 'Rauchkatze'],
    npcs: ['Schmied Ignis', 'Wächterin Vatra', 'Aschehändler Koll', 'Forscherin Magda', 'Feuerpriester Ruhm', 'Kundschafterin Flamme'],
  },
  dschungel: {
    key: 'dschungel',
    label: 'Dschungel',
    adjective: 'Dschungel',
    keywords: ['dschungel', 'jungle', 'urwald', 'liane', 'tempel', 'regenwald', 'tropen', 'aff', 'schlange'],
    terrain: 'grass',
    decor: 'jungle',
    palette: { accent: [120, 230, 140], accent2: [235, 210, 90], ground: [58, 120, 72], base: [46, 84, 60] },
    zones: ['Dschungel-Tor', 'Lianen-Pfad', 'Tempel-Ruine', 'Wasserfall', 'Affen-Hain', 'Gift-Pflanzen-Garten', 'Sonnen-Terrasse', 'Verborgene Stadt'],
    pets: ['Dschungelaffe', 'Papagei', 'Blattfrosch', 'Tigerjunges', 'Riesenschlange', 'Kolibri', 'Panzerkroko', 'Orchideenkäfer'],
    npcs: ['Forscherin Lina', 'Tempelwächter Rama', 'Kräuterkundiger Olo', 'Händlerin Maya', 'Spurenleser Kibo', 'Pflanzenkundlerin Vera'],
  },
  weltraum: {
    key: 'weltraum',
    label: 'Weltraum',
    adjective: 'Sternen',
    keywords: ['weltraum', 'space', 'stern', 'planet', 'mond', 'alien', 'raumschiff', 'galaxie', 'asteroid', 'sci-fi', 'scifi'],
    terrain: 'rock',
    decor: 'space',
    palette: { accent: [150, 120, 255], accent2: [90, 230, 255], ground: [40, 42, 70], base: [36, 34, 62] },
    zones: ['Start-Rampe', 'Mondbasis', 'Asteroiden-Gürtel', 'Sternen-Nebel', 'Alien-Markt', 'Reaktor-Kern', 'Schwarzes Loch', 'Orbital-Station'],
    pets: ['Sternenluchs', 'Alien-Katze', 'Mondbär', 'Kometenfuchs', 'Roboterhund', 'Nebelqualle', 'Astro-Pinguin', 'Plasma-Drache'],
    npcs: ['Kommandant Rhea', 'Techniker Bol', 'Händlerin Nova', 'Forscherin Kepler', 'Pilot Orin', 'Androidin Vex'],
  },
  mittelalter: {
    key: 'mittelalter',
    label: 'Mittelalter',
    adjective: 'Königs',
    keywords: ['mittelalter', 'ritter', 'burg', 'könig', 'koenig', 'drache', 'schwert', 'magie', 'fantasy', 'zauber', 'krieger', 'taverne'],
    terrain: 'grass',
    decor: 'castle',
    palette: { accent: [190, 160, 90], accent2: [120, 150, 220], ground: [104, 120, 84], base: [110, 104, 96] },
    zones: ['Burgplatz', 'Marktgasse', 'Schmiedeviertel', 'Königshalle', 'Wachturm', 'Katakomben', 'Turnierfeld', 'Drachenhort'],
    pets: ['Burghund', 'Drachenei', 'Steingolem', 'Eule', 'Königspferd', 'Rabenbote', 'Wolfswelpe', 'Feenlicht'],
    npcs: ['Ritter Aldric', 'Schmiedin Brunhild', 'Magier Severin', 'Händlerin Greta', 'Burgwache Kurt', 'Heilerin Mira'],
  },
  cyber: {
    key: 'cyber',
    label: 'Cyber & Neon',
    adjective: 'Neon',
    keywords: ['cyber', 'neon', 'hacker', 'roboter', 'technik', 'stadt der zukunft', 'futuristisch', 'matrix', 'drohne', 'chip'],
    terrain: 'metal',
    decor: 'neon',
    palette: { accent: [255, 70, 180], accent2: [60, 240, 230], ground: [30, 34, 52], base: [26, 30, 48] },
    zones: ['Neon-Straße', 'Daten-Zentrum', 'Holo-Plaza', 'Chip-Markt', 'Skyline-Dach', 'Server-Keller', 'Drohnen-Park', 'Netzwerk-Kern'],
    pets: ['Neonkatze', 'Drohnen-Hund', 'Chipfuchs', 'Holo-Vogel', 'Robo-Hamster', 'Datenqualle', 'Pixelwolf', 'Servo-Spinne'],
    npcs: ['Hackerin Nyx', 'Techniker Dex', 'Händlerin Byte', 'Kurierin Vega', 'Wächter K-9', 'Programmierer Ion'],
  },
  unterwasser: {
    key: 'unterwasser',
    label: 'Unterwasser',
    adjective: 'Tiefsee',
    keywords: ['unterwasser', 'meer', 'ozean', 'tiefsee', 'koralle', 'fisch', 'hai', 'tauchen', 'hafen', 'insel'],
    terrain: 'water',
    decor: 'reef',
    palette: { accent: [70, 220, 220], accent2: [140, 250, 200], ground: [40, 110, 140], base: [30, 80, 110] },
    zones: ['Korallenriff', 'Tiefsee-Graben', 'Versunkene Stadt', 'Algen-Wald', 'Perlen-Bucht', 'U-Boot-Dock', 'Leucht-Höhle', 'Abgrund'],
    pets: ['Seepferdchen', 'Leuchtqualle', 'Riffhai', 'Schildkröte', 'Tintenfisch', 'Clownfisch', 'Seestern', 'Perlendrache'],
    npcs: ['Taucherin Marina', 'Händler Finn', 'Kapitänin Coral', 'Forscherin Nixe', 'Leuchtturmwärter Bo', 'Perlensammler Taro'],
  },
  wueste: {
    key: 'wueste',
    label: 'Wüste',
    adjective: 'Sand',
    keywords: ['wüste', 'wueste', 'sand', 'desert', 'pyramide', 'oase', 'kamel', 'karawane', 'pharao', 'ägypten', 'aegypten'],
    terrain: 'sand',
    decor: 'sand',
    palette: { accent: [250, 170, 80], accent2: [120, 200, 230], ground: [220, 190, 130], base: [190, 160, 110] },
    zones: ['Oasen-Stadt', 'Sandmeer', 'Pyramide', 'Karawanen-Route', 'Kaktus-Tal', 'Tempel-Ruine', 'Salz-Ebene', 'Vergessene Gruft'],
    pets: ['Wüstenfuchs', 'Sandechse', 'Kamel', 'Skorpion', 'Geierfalke', 'Pharaonenkatze', 'Sandwurm', 'Miragegeist'],
    npcs: ['Händler Samir', 'Forscherin Leyla', 'Karawanenführer Omar', 'Wächterin Nefra', 'Wasserhändler Tarek', 'Kartografin Zara'],
  },
  horror: {
    key: 'horror',
    label: 'Horror',
    adjective: 'Albtraum',
    keywords: ['horror', 'grusel', 'krankenhaus', 'klinik', 'keller', 'dachboden', 'leichenhalle', 'verlassen', 'albtraum', 'geisterhaus', 'zombie', 'monster', 'vampir', 'fluch'],
    terrain: 'concrete',
    decor: 'spooky',
    palette: { accent: [220, 70, 90], accent2: [140, 110, 220], ground: [58, 56, 64], base: [40, 38, 46] },
    zones: ['Eingangshalle', 'Keller', 'OP-Saal', 'Dachboden', 'Leichenhalle', 'Labor', 'Kapelle', 'Flur'],
    pets: ['Spukkatze', 'Nebelgeist', 'Blutflügel-Fledermaus', 'Skelett-Hund', 'Schattenratte', 'Poltergeist', 'Vampirfledermaus', 'Zombie-Hamster'],
    npcs: ['Nachtwächter Grimm', 'Geisterärztin Weiss', 'Pfleger Zombie', 'Medium Lila', 'Wächterin Nacht', 'Hausmeister Kralle'],
  },
  halloween: {
    key: 'halloween',
    label: 'Halloween & Grusel',
    adjective: 'Spuk',
    keywords: ['halloween', 'kürbis', 'kuerbis', 'hexe', 'geist', 'gespenst', 'grusel', 'spuk', 'monster', 'zombie', 'vampir'],
    terrain: 'grass',
    decor: 'spooky',
    palette: { accent: [255, 140, 40], accent2: [150, 90, 220], ground: [60, 52, 60], base: [46, 40, 52] },
    zones: ['Kürbis-Feld', 'Spuk-Haus', 'Grabstein-Garten', 'Hexen-Küche', 'Nebel-Wald', 'Monster-Ball', 'Süßigkeiten-Allee', 'Krypta'],
    pets: ['Spukkatze', 'Kürbisfledermaus', 'Geisterspinne', 'Skelett-Hund', 'Hexenkrähe', 'Vampirfledermaus', 'Nebelgeist', 'Zombie-Hamster'],
    npcs: ['Hexe Morgana', 'Hausmeister Grimm', 'Süßigkeiten-Händler Bo', 'Geisterführerin Lila', 'Kürbisschnitzer Tom', 'Wächterin Nacht'],
  },
  weihnachten: {
    key: 'weihnachten',
    label: 'Weihnachten',
    adjective: 'Winter',
    keywords: ['weihnacht', 'christmas', 'rentier', 'geschenk', 'nordpol', 'santa', 'schnee', 'tannenbaum', 'winterdorf'],
    terrain: 'snow',
    decor: 'festive',
    palette: { accent: [220, 60, 70], accent2: [110, 220, 150], ground: [230, 238, 245], base: [120, 60, 60] },
    zones: ['Geschenk-Platz', 'Tannen-Wald', 'Zuckerstangen-Weg', 'Werkstatt', 'Rentier-Stall', 'Schnee-Dorf', 'Glühwein-Hütte', 'Nordpol'],
    pets: ['Rentier', 'Schneehase', 'Wichtel', 'Polarfuchs', 'Schneeeule', 'Geschenke-Elch', 'Eiszapfen-Katze', 'Zimtstern-Bär'],
    npcs: ['Wichtel Pippin', 'Bäckerin Clara', 'Rentierpfleger Niko', 'Händlerin Noelle', 'Werkstattmeister Sven', 'Engel Alva'],
  },
  bauernhof: {
    key: 'bauernhof',
    label: 'Bauernhof',
    adjective: 'Bauern',
    keywords: ['bauernhof', 'farm', 'bauer', 'huhn', 'kuh', 'schwein', 'ernte', 'feld', 'traktor', 'scheune'],
    terrain: 'grass',
    decor: 'farm',
    palette: { accent: [240, 200, 90], accent2: [120, 190, 240], ground: [126, 170, 86], base: [150, 110, 70] },
    zones: ['Hof-Einfahrt', 'Stall', 'Felder', 'Mühle', 'Scheune', 'Teich', 'Marktstand', 'Waldrand'],
    pets: ['Huhn', 'Schwein', 'Kuh', 'Schäferhund', 'Ente', 'Ziege', 'Katze', 'Esel'],
    npcs: ['Bauer Henning', 'Bäuerin Rosa', 'Müller Kurt', 'Händlerin Anke', 'Hirte Jonas', 'Gärtnerin Mia'],
  },
  candy: {
    key: 'candy',
    label: 'Zuckerwelt',
    adjective: 'Zucker',
    keywords: ['candy', 'süßigkeit', 'suessigkeit', 'bonbon', 'schokolade', 'lolli', 'kuchen', 'zucker', 'gummi', 'eiscreme'],
    terrain: 'grass',
    decor: 'candy',
    palette: { accent: [255, 120, 190], accent2: [120, 230, 255], ground: [250, 200, 225], base: [230, 140, 180] },
    zones: ['Bonbon-Plaza', 'Lollis-Hügel', 'Schoko-Fluss', 'Gummi-Wald', 'Kuchen-Berg', 'Zucker-Wolke', 'Süßigkeiten-Laden', 'Karamell-Höhle'],
    pets: ['Zucker-Maus', 'Lolli-Hund', 'Bonbon-Bär', 'Schoko-Katze', 'Gummi-Frosch', 'Waffel-Vogel', 'Marshmallow-Hase', 'Karamell-Fuchs'],
    npcs: ['Konditorin Rosa', 'Händler Bonbon', 'Zuckerfee Lila', 'Bäcker Max', 'Schokoladenmeister Kao', 'Naschkatze Mia'],
  },
  stadt: {
    key: 'stadt',
    label: 'Stadt',
    adjective: 'Stadt',
    keywords: ['stadt', 'city', 'metropole', 'wohnung', 'büro', 'buero', 'polizei', 'feuerwehr', 'schule', 'straße', 'strasse', 'bahnhof', 'viertel'],
    terrain: 'concrete',
    decor: 'urban',
    palette: { accent: [255, 180, 60], accent2: [90, 200, 255], ground: [90, 94, 104], base: [70, 74, 86] },
    zones: ['Innenstadt', 'Wohnviertel', 'Hafen', 'Industrie-Zone', 'Stadtpark', 'Bahnhof', 'Einkaufsmeile', 'Aussichtsturm'],
    pets: ['Straßenkatze', 'Taube', 'Hofhund', 'Papagei', 'Kaninchen', 'Hamster', 'Frettchen', 'Wellensittich'],
    npcs: ['Verkäuferin Jana', 'Hausmeister Rudi', 'Polizist Mark', 'Bäckerin Sina', 'Taxifahrer Ali', 'Bibliothekarin Eva'],
  },
};

/** Reihenfolge der Prüfung: spezifische Themen vor allgemeinen. */
const THEME_ORDER = [
  'weihnachten', 'halloween', 'horror', 'candy', 'wueste', 'eis', 'lava', 'unterwasser', 'weltraum',
  'cyber', 'mittelalter', 'dschungel', 'bauernhof', 'stadt',
];

export function normaliseThemeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Erkennt das Thema der Beschreibung. Gibt 'default' zurück, wenn keins passt. */
export function detectTheme(text) {
  const t = normaliseThemeText(text);
  if (!t) return 'default';
  let best = { key: 'default', score: 0 };
  for (const key of THEME_ORDER) {
    const theme = THEMES[key];
    let hits = 0;
    for (const word of theme.keywords) {
      const stem = normaliseThemeText(word).slice(0, Math.max(4, Math.min(6, word.length)));
      if (stem && t.includes(stem)) hits += 1;
    }
    if (hits > best.score) best = { key, score: hits };
  }
  return best.key;
}

/** Palette des Themas, überschrieben von ausdrücklich genannten Farben. */
export function themePalette(themeKey, explicitColors = []) {
  const theme = THEMES[themeKey] || THEMES.default;
  const palette = { ...theme.palette };
  if (explicitColors.length > 0) palette.accent = explicitColors[0];
  if (explicitColors.length > 1) palette.accent2 = explicitColors[1];
  return palette;
}

/** Deterministischer Seed aus Text – gleicher Text, gleiches Spiel. */
export function hashText(text) {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000_007;
}

/** Zufallsgenerator, damit gleiche Seeds immer gleiche Welten ergeben. */
export function seededRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mischt eine Liste deterministisch. */
export function shuffleBySeed(list, seed) {
  const rng = seededRng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Zonen-Namen aus Thema und Genre mischen. Die Startzone bleibt immer zuerst,
 * damit der Spawnplatz nicht plötzlich "Abgrund" heißt.
 */
export function zoneNamesFor(themeKey, genreZones, seed, count) {
  const theme = THEMES[themeKey] || THEMES.default;
  const wanted = Math.max(2, Math.min(8, count || 5));
  const start = (genreZones && genreZones[0]) || 'Startplaza';
  const pool = [...(theme.zones || []), ...(genreZones || []).slice(1)];
  if (pool.length === 0) return [start];
  const shuffled = shuffleBySeed(pool, seed);
  const chosen = [];
  for (const name of shuffled) {
    if (chosen.length >= wanted - 1) break;
    if (!chosen.includes(name) && name !== start) chosen.push(name);
  }
  return [start, ...chosen];
}
