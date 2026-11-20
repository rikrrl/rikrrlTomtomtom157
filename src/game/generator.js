/**
 * Spielgenerator: baut aus einer Spezifikation einen vollständigen Roblox-Instanzbaum.
 *
 * Deterministisch über spec.seed, damit ein Projekt bei jedem Export identisch ist.
 * Die Detaildichte hängt an spec.quality ("schnell" | "grundlich" | "maximal"):
 * mehr Zonen, mehr Gebäudedetails, mehr Deko und mehr Systeme.
 */

import {
  inst, part, folder, model, spawnLocation, pointLight,
  serverScript, localScript, moduleScript,
} from './build.js';
import {
  gameConfigModule, uiLibraryModule, serverMainModule, clientMainModule, mapStabilizerModule,
} from './lua.js';
import {
  questServiceModule, achievementServiceModule, talentServiceModule, dailyServiceModule,
  tradeServiceModule, bossServiceModule, wordGameServiceModule, wordGameClientModule,
  dayCycleModule, antiCheatModule, SYSTEM_CATALOG,
} from './systems.js';
import { treeStats } from './rbxlx.js';

export const GENRES = {
  simulator: {
    label: 'Simulator',
    nouns: ['Geld', 'Coins', 'Münzen', 'Simulator', 'Klicker', 'Farm'],
    zoneNames: ['Startplaza', 'Wiesen-Farm', 'Kristallhöhle', 'Lava-Zone', 'Wolken-Insel', 'Tiefsee-Becken', 'Sternen-Feld', 'Uralte Ruine'],
    buildingNames: ['Farm-Shop', 'Kristall-Händler', 'Lava-Schmiede', 'Wolken-Basar', 'Tiefsee-Markt', 'Sternen-Laden', 'Ruinen-Händler'],
    palette: { accent: [124, 92, 255], accent2: [64, 196, 255], ground: [86, 138, 74], base: [70, 66, 110] },
  },
  tycoon: {
    label: 'Tycoon',
    nouns: ['Tycoon', 'Fabrik', 'Business', 'Firma', 'Imperium'],
    zoneNames: ['Fabrikhalle', 'Büro-Turm', 'Lagerhaus', 'Produktions-Zone', 'Logistik-Hof', 'Forschungs-Labor', 'Vertriebs-Zentrale', 'Werks-Gelände'],
    buildingNames: ['Maschinen-Shop', 'Büro-Shop', 'Lager-Shop', 'Upgrade-Station', 'Forschungs-Shop', 'Vertriebs-Büro'],
    palette: { accent: [90, 120, 255], accent2: [0, 210, 200], ground: [96, 100, 112], base: [52, 58, 78] },
  },
  horror: {
    label: 'Horror',
    nouns: ['Horror', 'Grusel', 'Spuk', 'Monster', 'Nacht'],
    zoneNames: ['Verlassene Halle', 'Keller-Gewölbe', 'Kapelle', 'Friedhof', 'Waldlichtung', 'Spiegel-Saal', 'Blut-Krypta', 'Nebel-Moor'],
    buildingNames: ['Verlassener Laden', 'Kapellen-Altar', 'Blutbrunnen', 'Grabstein-Händler', 'Spiegel-Kabinett', 'Krypta-Tor'],
    palette: { accent: [168, 62, 92], accent2: [98, 40, 140], ground: [48, 46, 54], base: [34, 30, 42] },
  },
  openworld: {
    label: 'Open World',
    nouns: ['Open World', 'Openworld', 'Welt', 'Erkundung', 'Abenteuer'],
    zoneNames: ['Hauptstadt', 'Waldregion', 'Wüstenregion', 'Schneegipfel', 'Hafenviertel', 'Ruinenfeld', 'Vulkan-Küste', 'Sternen-Plateau'],
    buildingNames: ['Stadt-Markt', 'Wald-Hütte', 'Wüsten-Basar', 'Gipfel-Shop', 'Hafen-Kontor', 'Ruinen-Händler', 'Vulkan-Schmiede'],
    palette: { accent: [112, 96, 255], accent2: [86, 220, 255], ground: [104, 148, 92], base: [64, 74, 104] },
  },
  obby: {
    label: 'Obby',
    nouns: ['Obby', 'Parkour', 'Hindernis', 'Jump'],
    zoneNames: ['Start-Turm', 'Checkpoint 1', 'Checkpoint 2', 'Lava-Sprung', 'Eis-Parcours', 'Turm-Spirale', 'Finale-Sprung', 'Ziel-Plattform'],
    buildingNames: ['Checkpoint-Shop', 'Sprung-Booster', 'Skin-Laden', 'Zeit-Rekord-Halle'],
    palette: { accent: [255, 128, 64], accent2: [120, 96, 255], ground: [92, 92, 108], base: [56, 54, 72] },
  },
  rpg: {
    label: 'RPG',
    nouns: ['RPG', 'Rollenspiel', 'Fantasy', 'Magie', 'Krieger'],
    zoneNames: ['Dorf Eldoria', 'Zauberwald', 'Drachenkamm', 'Kristallsee', 'Schattenzitadelle', 'Runen-Tal', 'Himmels-Tempel', 'Dämonen-Schlund'],
    buildingNames: ['Waffen-Schmiede', 'Alchemist', 'Trank-Laden', 'Rüstungs-Händler', 'Runen-Händler', 'Tempel-Priester'],
    palette: { accent: [146, 108, 255], accent2: [86, 226, 190], ground: [82, 128, 92], base: [60, 56, 92] },
  },
  pets: {
    label: 'Pet-Simulator',
    nouns: ['Pets', 'Haustiere', 'Tiere'],
    zoneNames: ['Pet-Plaza', 'Wiesen-Gehege', 'Kristall-Hain', 'Himmels-Insel', 'Schatten-Wald', 'Glut-Krater', 'Eis-Garten'],
    buildingNames: ['Pet-Shop', 'Ei-Basar', 'Futter-Laden', 'Zucht-Station', 'Seltenheits-Markt'],
    palette: { accent: [140, 110, 255], accent2: [92, 224, 255], ground: [94, 146, 96], base: [66, 60, 104] },
  },
  battle: {
    label: 'Battle / PvP',
    nouns: ['PvP', 'Kampf', 'Arena', 'Battleroyale'],
    zoneNames: ['Arena', 'Trainingsplatz', 'Waffenkammer', 'Turm', 'Schatten-Grube', 'Belagerungs-Hof', 'Finale-Kreis'],
    buildingNames: ['Waffen-Shop', 'Rüstungs-Shop', 'Arena-Lobby', 'Kampf-Trainer'],
    palette: { accent: [255, 86, 120], accent2: [120, 96, 255], ground: [88, 84, 96], base: [48, 44, 62] },
  },
  wortspiel: {
    label: 'Wortspiel',
    nouns: ['Wortspiel', 'Wörter', 'Rätsel', 'Buchstaben', 'Silben'],
    zoneNames: ['Wort-Plaza', 'Buchstaben-Garten', 'Rätsel-Halle', 'Silben-Markt', 'Wörter-Turm', 'Kreuzwort-Kammer', 'Vokabel-Insel', 'Finale-Arena'],
    buildingNames: ['Rätsel-Shop', 'Buchstaben-Laden', 'Hinweis-Markt', 'Wörter-Basar', 'Punkte-Kasse', 'Silben-Stand'],
    palette: { accent: [124, 92, 255], accent2: [86, 226, 255], ground: [78, 122, 108], base: [52, 48, 84] },
  },
};

const MAP_SIZES = {
  klein: { half: 140, zones: 3, label: 'Klein' },
  mittel: { half: 210, zones: 4, label: 'Mittel' },
  groß: { half: 300, zones: 6, label: 'Groß' },
  riesig: { half: 410, zones: 7, label: 'Riesig' },
};

/** Qualitätsprofile: steuern Detaildichte, Systemumfang und Anzahl der Prüfdurchläufe. */
export const QUALITY_PROFILE = {
  schnell: { level: 'schnell', label: 'Schnell', detail: 0.6, decor: 0.55, systems: 3, passes: 1, boards: 1 },
  grundlich: { level: 'grundlich', label: 'Gründlich', detail: 1, decor: 1, systems: 6, passes: 2, boards: 2 },
  maximal: { level: 'maximal', label: 'Maximal', detail: 1.6, decor: 1.75, systems: 9, passes: 3, boards: 3 },
};

export function qualityProfile(spec) {
  return QUALITY_PROFILE[spec?.quality] || QUALITY_PROFILE.grundlich;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(rgb, factor) {
  return rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * factor))));
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** Balancing und Inhalte (Pets, Shops, Quests, Talente, Tagesbelohnung, Bosse) ableiten. */
export function buildGameConfig(spec) {
  const rng = mulberry32(spec.seed || hashSeed(spec.title || 'roblox'));
  const genre = GENRES[spec.genre] || GENRES.simulator;
  const quality = qualityProfile(spec);
  const petCount = Math.max(3, Math.min(10, spec.features.pets ? (spec.petCount || 6) : 4));

  const petNames = [
    'Funkelkatze', 'Steinwächter', 'Glutwelpe', 'Nebelgeist', 'Kristalldrache',
    'Schattenfuchs', 'Wolkenbär', 'Lavafalke', 'Eiskobold', 'Sternenluchs',
  ];
  const elements = ['Funke', 'Stein', 'Glut', 'Nebel', 'Kristall', 'Schatten', 'Wolke', 'Lava', 'Eis', 'Stern'];
  const abilities = ['Doppelter Coin-Fund', 'Schneller laufen', 'Automatisch sammeln', 'Bonus-Erfahrung', 'Seltene Funde', 'Extra-Sprung', 'Schutzschild', 'Zeit-Boost', 'Glücksbonus', 'Ketten-Multiplikator'];
  const pets = [];
  for (let i = 0; i < petCount; i++) {
    const color = [
      120 + Math.floor(rng() * 135),
      120 + Math.floor(rng() * 135),
      160 + Math.floor(rng() * 95),
    ];
    pets.push({
      id: `pet_${i + 1}`,
      name: petNames[i % petNames.length],
      element: elements[i % elements.length],
      ability: abilities[i % abilities.length],
      multiplier: Number((1.25 + i * 0.45).toFixed(2)),
      color,
      price: Math.round(150 * (i + 1) * (i + 1)),
      rarity: i < 2 ? 'Gewöhnlich' : i < 5 ? 'Selten' : i < 8 ? 'Episch' : 'Legendär',
    });
  }

  const zoneNames = genre.zoneNames.slice(0, Math.max(3, Math.min(8, spec.zoneCount || 5)));
  const shopNames = genre.buildingNames.slice(0, Math.max(2, Math.min(7, spec.shopCount || 4)));

  const itemKinds = [
    { kind: 'upgrade', label: 'Upgrade', description: 'Erhöht deinen Coin-Multiplikator dauerhaft.' },
    { kind: 'boost', label: 'Boost', description: 'Sofort-Coins für den nächsten Sprung.' },
    { kind: 'tool', label: 'Werkzeug', description: 'Schnelleres Sammeln und mehr Reichweite.' },
    { kind: 'cosmetic', label: 'Skin', description: 'Optische Verbesserung für deinen Charakter.' },
  ];

  const shops = [];
  shopNames.forEach((name, index) => {
    const items = [];
    const kind = itemKinds[index % itemKinds.length];
    items.push({
      id: `up_${index + 1}`,
      name: index === 0 ? 'Coin-Upgrade' : `Upgrade Stufe ${index + 1}`,
      description: 'Erhöht deinen Coin-Multiplikator dauerhaft um 25 %.',
      price: 100 * (index + 1) * (index + 1),
      kind: 'upgrade',
      amount: 1,
    });
    items.push({
      id: `item_${index + 1}`,
      name: `${kind.label} ${index + 1}`,
      description: kind.description,
      price: 75 * (index + 1),
      kind: kind.kind,
      value: 1,
    });
    if (index === 0 || spec.features.pets) {
      const pet = pets[Math.min(pets.length - 1, index)];
      items.push({
        id: `buy_${pet.id}`,
        name: `Pet: ${pet.name}`,
        description: `${pet.rarity} · ${pet.element} · Multiplikator x${pet.multiplier}`,
        price: pet.price,
        kind: 'pet',
        value: pet.id,
      });
    }
    if (index > 0 && spec.features.coins) {
      items.push({
        id: `boost_${index + 1}`,
        name: 'Coin-Boost',
        description: 'Sofort 500 Coins gutgeschrieben.',
        price: 250 * index,
        kind: 'boost',
        value: 500,
      });
    }
    if (index >= 1) {
      items.push({
        id: `unlock_${index + 1}`,
        name: `Bereich freischalten: ${zoneNames[Math.min(index, zoneNames.length - 1)]}`,
        description: 'Öffnet das Tor zur nächsten Zone.',
        price: 400 * index,
        kind: 'unlock',
        value: `Gate_${index + 1}`,
      });
    }
    if (quality.detail >= 1) {
      items.push({
        id: `charm_${index + 1}`,
        name: 'Glücksbringer',
        description: '5 Minuten lang 2x Coins für alle Aktionen.',
        price: 600 * (index + 1),
        kind: 'boost',
        value: 2,
      });
    }
    shops.push({
      id: `shop_${index + 1}`,
      name,
      description: `Shop in ${zoneNames[Math.min(index, zoneNames.length - 1)]}`,
      zone: zoneNames[Math.min(index, zoneNames.length - 1)],
      items,
    });
  });

  const quests = [
    { id: 'collect_coins', name: 'Fleißiger Sammler', description: 'Sammle 25 Coins in der Welt.', goal: 25, reward: 250, kind: 'collect' },
    { id: 'buy_items', name: 'Erster Einkauf', description: 'Kaufe 3 Artikel in einem Shop.', goal: 3, reward: 400, kind: 'buy' },
    { id: 'level_5', name: 'Aufsteiger', description: 'Erreiche Level 5.', goal: 5, reward: 800, kind: 'level' },
    { id: 'visit_zones', name: 'Entdecker', description: 'Besuche 3 verschiedene Zonen.', goal: 3, reward: 600, kind: 'zone' },
  ];
  if (spec.features.pets) {
    quests.push({ id: 'pet_friend', name: 'Pet-Freund', description: 'Kaufe dein erstes Pet und rüste es aus.', goal: 1, reward: 600, kind: 'pet' });
  }

  // Quest-Ketten: mehrere Stufen pro Kette, damit Fortschritt über mehrere Ziele läuft.
  const questChains = [
    {
      id: 'chain_start',
      name: 'Der erste Auftrag',
      stages: [
        { id: 'c1s1', name: 'Sammle 10 Coins', description: 'Die Welt ist voller Münzen.', kind: 'collect', goal: 10, reward: 150, xp: 40 },
        { id: 'c1s2', name: 'Kaufe ein Upgrade', description: 'Investiere deine ersten Coins.', kind: 'buy', goal: 1, reward: 300, xp: 70 },
        { id: 'c1s3', name: 'Erreiche Level 3', description: 'Erfahrung bringt neue Möglichkeiten.', kind: 'level', goal: 3, reward: 500, xp: 120 },
      ],
    },
    {
      id: 'chain_explore',
      name: 'Neue Gebiete',
      stages: [
        { id: 'c2s1', name: 'Besuche 2 Zonen', description: 'Die Karte ist größer als der Startplatz.', kind: 'zone', goal: 2, reward: 400, xp: 90 },
        { id: 'c2s2', name: 'Sammle 50 Coins', description: 'Fleiß zahlt sich aus.', kind: 'collect', goal: 50, reward: 700, xp: 150 },
        { id: 'c2s3', name: 'Erreiche Level 6', description: 'Zeig, was du kannst.', kind: 'level', goal: 6, reward: 1200, xp: 260 },
      ],
    },
    {
      id: 'chain_master',
      name: 'Meisterprüfung',
      stages: [
        { id: 'c3s1', name: 'Kaufe 5 Artikel', description: 'Ein echter Händler.', kind: 'buy', goal: 5, reward: 900, xp: 200 },
        { id: 'c3s2', name: 'Sammle 200 Coins', description: 'Der große Reichtum.', kind: 'collect', goal: 200, reward: 1800, xp: 400 },
        { id: 'c3s3', name: 'Erreiche Level 10', description: 'Die letzte Stufe der Kette.', kind: 'level', goal: 10, reward: 3000, xp: 700 },
      ],
    },
  ];

  const npcNames = [
    'Händler Miro', 'Wächterin Lya', 'Alter Weiser', 'Schmied Toran', 'Forscherin Neva',
    'Buchhändlerin Rilla', 'Kapitän Boro', 'Sternendeuterin Vela',
  ];
  const npcDialogs = [
    'Willkommen! Sammle Coins und kaufe dir bessere Upgrades.',
    'Der nächste Bereich ist gefährlich. Sei vorbereitet!',
    'Ich habe Gerüchte über einen legendären Fund gehört ...',
    'Mit jedem Level steigen deine Chancen. Bleib dran!',
    'Pets verstärken deinen Multiplikator – rüste sie im Pet-Menü aus.',
    'Jede Zone hat eine eigene Belohnung. Schau dich genau um.',
    'Meine Quests bringen dich schneller voran als reines Sammeln.',
    'Der Boss wartet am Rand der Karte. Nimm dir Zeit.',
  ];
  const npcs = [];
  const npcCount = Math.max(2, Math.min(7, spec.npcCount || 4));
  for (let i = 0; i < npcCount; i++) {
    npcs.push({
      id: `npc_${i + 1}`,
      name: npcNames[i % npcNames.length],
      dialog: npcDialogs[i % npcDialogs.length],
      quest: quests[i % quests.length]?.id || null,
    });
  }

  const talents = [
    { id: 't_speed', name: 'Flinke Beine', description: '+8 % Laufgeschwindigkeit.', cost: 250, tier: 1, bonus: 0.08 },
    { id: 't_coins', name: 'Goldene Hände', description: '+10 % Coin-Wert.', cost: 400, tier: 1, bonus: 0.1 },
    { id: 't_xp', name: 'Schnelllerner', description: '+12 % Erfahrung.', cost: 500, tier: 1, bonus: 0.12 },
    { id: 't_luck', name: 'Glückspilz', description: 'Höhere Chance auf seltene Funde.', cost: 750, tier: 2, bonus: 0.15 },
    { id: 't_pet', name: 'Pet-Flüsterer', description: '+15 % Pet-Multiplikator.', cost: 900, tier: 2, bonus: 0.15 },
    { id: 't_shop', name: 'Rabatt-Jäger', description: 'Shops 10 % günstiger.', cost: 1100, tier: 2, bonus: 0.1 },
    { id: 't_rebirth', name: 'Neustart-Profi', description: '+20 % Rebirth-Bonus.', cost: 1500, tier: 3, bonus: 0.2 },
    { id: 't_master', name: 'Meister des Spiels', description: 'Alle Boni +5 %.', cost: 2500, tier: 3, bonus: 0.05 },
  ];

  const dailyRewards = [
    { day: 1, label: 'Tagesbonus', coins: 100 },
    { day: 2, label: 'Doppelter Bonus', coins: 200 },
    { day: 3, label: 'Pet-Tag', coins: 350 },
    { day: 4, label: 'Boost-Tag', coins: 500 },
    { day: 5, label: 'Großer Bonus', coins: 750 },
    { day: 6, label: 'Seltenheits-Tag', coins: 1000 },
    { day: 7, label: 'Wochen-Jackpot', coins: 2000 },
  ];

  const bosses = zoneNames.slice(1, 4).map((zone, index) => ({
    id: `boss_${index + 1}`,
    name: `${zone}-Wächter`,
    zone,
    hp: 600 + index * 450,
    damage: 12 + index * 6,
    reward: 800 + index * 600,
  }));

  return {
    startCoins: 100,
    coinValue: 5,
    coinRespawn: 6,
    xpPerCoin: 2,
    xpPerLevel: 100,
    maxLevel: 25,
    rebirthMultiplier: 0.5,
    autosaveSeconds: 60,
    pets,
    shops,
    quests,
    questChains,
    npcs,
    talents,
    dailyRewards,
    bosses,
    upgrades: [
      { id: 'speed', name: 'Laufgeschwindigkeit', price: 300, value: 4 },
      { id: 'reach', name: 'Sammel-Reichweite', price: 450, value: 6 },
    ],
    systems: Object.keys(SYSTEM_CATALOG),
  };
}

/* ------------------------------------------------------------------ */
/* Bausteine: Gebäude, Figuren, Landschaft, Wortspiel-Elemente         */
/* ------------------------------------------------------------------ */

/** Ein Shop-/Zonengebäude mit Fenstern, Tür, Theke, Regalen und Interaktionspunkt. */
function buildBuilding({ name, pos, size, palette, rotY = 0, accent, promptId, detail = 1 }) {
  const [w, h, d] = size;
  const wallColor = shade(palette.base, 1.15);
  const trimColor = shade(palette.base, 1.45);
  const children = [
    part({ name: 'Floor', pos: [0, 0.5, 0], size: [w, 1, d], color: shade(palette.base, 0.9), material: 'concrete' }),
    part({ name: 'WallBack', pos: [0, h / 2, -d / 2], size: [w, h, 1], color: wallColor, material: 'brick' }),
    part({ name: 'WallLeft', pos: [-w / 2, h / 2, 0], size: [1, h, d], color: wallColor, material: 'brick' }),
    part({ name: 'WallRight', pos: [w / 2, h / 2, 0], size: [1, h, d], color: wallColor, material: 'brick' }),
    part({ name: 'WallFrontLeft', pos: [-w / 4 - 1.5, h / 2, d / 2], size: [Math.max(2, w / 2 - 4), h, 1], color: wallColor, material: 'brick' }),
    part({ name: 'WallFrontRight', pos: [w / 4 + 1.5, h / 2, d / 2], size: [Math.max(2, w / 2 - 4), h, 1], color: wallColor, material: 'brick' }),
    part({ name: 'DoorFrame', pos: [0, 3.5, d / 2], size: [7, 7, 1.2], color: trimColor, material: 'metal' }),
    part({ name: 'Roof', pos: [0, h + 0.5, 0], size: [w + 2, 1, d + 2], color: accent, material: 'metal' }),
    part({ name: 'RoofTrim', pos: [0, h + 1.2, d / 2], size: [w + 3, 0.6, 1], color: accent, material: 'neon' }),
    part({ name: 'Sign', pos: [0, h + 2.4, d / 2 - 0.4], size: [Math.min(w, 14), 3, 0.6], color: accent, material: 'neon', transparency: 0.05 }),
    part({ name: 'Counter', pos: [0, 1.6, d / 2 - 3], size: [Math.min(w - 4, 8), 1.6, 2], color: shade(palette.base, 1.4), material: 'wood' }),
    part({ name: 'CounterTop', pos: [0, 2.5, d / 2 - 3], size: [Math.min(w - 4, 8.4), 0.3, 2.4], color: trimColor, material: 'marble' }),
    part({
      name: 'PromptPad', pos: [0, 1.2, d / 2 - 1.4], size: [4, 0.4, 3], color: accent, material: 'neon',
      children: [
        inst('ProximityPrompt', 'OpenShop', {
          ActionText: { t: 'string', v: 'Shop öffnen' },
          ObjectText: { t: 'string', v: name },
          HoldDuration: { t: 'float', v: 0 },
          MaxActivationDistance: { t: 'float', v: 12 },
          RequiresLineOfSight: { t: 'bool', v: false },
          KeyboardKeyCode: { t: 'token', v: 69 },
        }),
      ],
    }),
  ];

  if (detail >= 0.8) {
    children.push(
      part({ name: 'WindowLeft', pos: [-w / 2 + 0.6, h * 0.62, 0], size: [0.5, 3, Math.min(8, d * 0.5)], color: [176, 222, 255], material: 'glass', transparency: 0.35 }),
      part({ name: 'WindowRight', pos: [w / 2 - 0.6, h * 0.62, 0], size: [0.5, 3, Math.min(8, d * 0.5)], color: [176, 222, 255], material: 'glass', transparency: 0.35 }),
      part({ name: 'ShelfLeft', pos: [-w / 4, 3, -d / 2 + 2], size: [6, 0.4, 2], color: shade(palette.base, 1.55), material: 'wood' }),
      part({ name: 'ShelfRight', pos: [w / 4, 3, -d / 2 + 2], size: [6, 0.4, 2], color: shade(palette.base, 1.55), material: 'wood' }),
      part({ name: 'StepFront', pos: [0, 0.4, d / 2 + 2], size: [10, 0.8, 4], color: shade(palette.base, 1.25), material: 'cobblestone' }),
    );
  }
  if (detail >= 1.3) {
    children.push(
      part({ name: 'Awning', pos: [0, h - 0.6, d / 2 + 1.4], size: [w * 0.8, 0.3, 4], color: accent, material: 'fabric', rotY: 8 }),
      part({ name: 'CrateA', pos: [-w / 2 + 3, 1.4, -d / 2 + 4], size: [3, 2.4, 3], color: [138, 102, 68], material: 'wood' }),
      part({ name: 'CrateB', pos: [-w / 2 + 6.5, 1.1, -d / 2 + 4], size: [2.4, 1.8, 2.4], color: [120, 88, 58], material: 'wood', rotY: 18 }),
      pointLight('ShopGlow', accent, 1.8, 26),
    );
  }
  return model(name.replace(/[^A-Za-z0-9_]/g, '_'), children, { pos, rotY, promptId });
}

function buildNpc(npc, pos, palette) {
  const body = [
    part({ name: 'Torso', pos: [0, 3, 0], size: [2, 2.4, 1], color: shade(palette.accent2, 0.9), material: 'fabric' }),
    part({ name: 'Head', pos: [0, 4.8, 0], size: [1.6, 1.6, 1.6], color: [236, 200, 160], material: 'plastic', shape: 'ball' }),
    part({ name: 'Legs', pos: [0, 1.2, 0], size: [1.8, 2, 1], color: shade(palette.base, 1.2), material: 'fabric' }),
    part({ name: 'Hat', pos: [0, 5.9, 0], size: [1.9, 0.5, 1.9], color: palette.accent, material: 'neon' }),
    part({ name: 'ArmLeft', pos: [-1.3, 3, 0], size: [0.6, 2, 0.6], color: shade(palette.accent2, 0.8), material: 'fabric' }),
    part({ name: 'ArmRight', pos: [1.3, 3, 0], size: [0.6, 2, 0.6], color: shade(palette.accent2, 0.8), material: 'fabric' }),
    part({
      name: 'Interaction', pos: [0, 3, 0], size: [4, 4, 4], color: palette.accent, transparency: 1, canCollide: false,
      children: [
        inst('ProximityPrompt', 'TalkPrompt', {
          ActionText: { t: 'string', v: 'Reden' },
          ObjectText: { t: 'string', v: npc.name },
          HoldDuration: { t: 'float', v: 0 },
          MaxActivationDistance: { t: 'float', v: 14 },
          RequiresLineOfSight: { t: 'bool', v: false },
          KeyboardKeyCode: { t: 'token', v: 69 },
        }),
      ],
    }),
    pointLight('NpcGlow', palette.accent2, 1.5, 14),
  ];
  return model(npc.id, body, { pos });
}

function buildTree(pos, rng, palette) {
  const scale = 0.8 + rng() * 0.7;
  return model(`Tree_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Trunk', pos: [0, 3 * scale, 0], size: [1.6, 6 * scale, 1.6], color: [104, 74, 52], material: 'wood', shape: 'cylinder' }),
    part({ name: 'Leaves', pos: [0, 7 * scale, 0], size: [7 * scale, 6 * scale, 7 * scale], color: shade(palette.ground, 0.75), material: 'grass', shape: 'ball' }),
    part({ name: 'LeavesTop', pos: [0, 10 * scale, 0], size: [4.6 * scale, 4 * scale, 4.6 * scale], color: shade(palette.ground, 0.9), material: 'grass', shape: 'ball' }),
  ], { pos });
}

function buildLamp(pos, palette) {
  return model(`Lamp_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Pole', pos: [0, 6, 0], size: [0.6, 12, 0.6], color: [70, 70, 86], material: 'metal', shape: 'cylinder' }),
    part({ name: 'Lamp', pos: [0, 12.4, 0], size: [2.2, 1, 2.2], color: palette.accent2, material: 'neon', shape: 'ball', children: [pointLight('LampLight', palette.accent2, 2.4, 30)] }),
  ], { pos });
}

function buildRock(pos, rng, palette) {
  return model(`Rock_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({
      name: 'Rock', pos: [0, 1.5, 0],
      size: [4 + rng() * 5, 3 + rng() * 4, 4 + rng() * 5],
      color: shade(palette.base, 1.1), material: 'slate', shape: 'ball', rotY: rng() * 360,
    }),
  ], { pos });
}

function buildBench(pos, palette) {
  return model(`Bench_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Seat', pos: [0, 1.6, 0], size: [6, 0.4, 2], color: [138, 102, 68], material: 'wood' }),
    part({ name: 'Back', pos: [0, 2.6, -0.9], size: [6, 1.6, 0.4], color: [120, 88, 58], material: 'wood' }),
    part({ name: 'LegLeft', pos: [-2.4, 0.8, 0], size: [0.5, 1.6, 1.6], color: [70, 70, 86], material: 'metal' }),
    part({ name: 'LegRight', pos: [2.4, 0.8, 0], size: [0.5, 1.6, 1.6], color: [70, 70, 86], material: 'metal' }),
  ], { pos });
}

function buildFountain(pos, palette) {
  return model(`Fountain_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Basin', pos: [0, 1, 0], size: [16, 2, 16], color: shade(palette.base, 1.3), material: 'marble', shape: 'cylinder' }),
    part({ name: 'Water', pos: [0, 1.9, 0], size: [14, 0.6, 14], color: [90, 190, 240], material: 'water', shape: 'cylinder', transparency: 0.25, canCollide: false }),
    part({ name: 'Column', pos: [0, 4, 0], size: [2.4, 6, 2.4], color: shade(palette.base, 1.5), material: 'marble', shape: 'cylinder' }),
    part({ name: 'Bowl', pos: [0, 7, 0], size: [6, 1, 6], color: shade(palette.base, 1.6), material: 'marble', shape: 'cylinder' }),
    part({ name: 'Jet', pos: [0, 9, 0], size: [1, 4, 1], color: [160, 230, 255], material: 'neon', shape: 'cylinder', transparency: 0.35, canCollide: false }),
    pointLight('FountainGlow', palette.accent2, 1.6, 22),
  ], { pos });
}

function buildStatue(pos, palette, label) {
  return model(`Statue_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Base', pos: [0, 1.2, 0], size: [8, 2.4, 8], color: shade(palette.base, 1.4), material: 'granite' }),
    part({ name: 'Pedestal', pos: [0, 3.6, 0], size: [5, 2.4, 5], color: shade(palette.base, 1.6), material: 'marble' }),
    part({ name: 'Figure', pos: [0, 7.4, 0], size: [3, 5, 3], color: palette.accent, material: 'metal' }),
    part({ name: 'FigureHead', pos: [0, 10.6, 0], size: [2.2, 2.2, 2.2], color: palette.accent2, material: 'metal', shape: 'ball' }),
    part({ name: 'Plaque', pos: [0, 2.6, 4.2], size: [5, 1.4, 0.4], color: palette.accent2, material: 'neon' }),
    pointLight('StatueGlow', palette.accent, 1.4, 20),
  ], { pos, label });
}

function buildFence(pos, length, palette, rotY = 0) {
  const children = [];
  const posts = Math.max(2, Math.round(length / 4));
  for (let i = 0; i < posts; i++) {
    children.push(part({
      name: `Post_${i + 1}`,
      pos: [-length / 2 + (i * length) / Math.max(1, posts - 1), 1.6, 0],
      size: [0.5, 3.2, 0.5],
      color: [120, 96, 72],
      material: 'wood',
    }));
  }
  children.push(part({ name: 'RailTop', pos: [0, 2.6, 0], size: [length, 0.35, 0.35], color: [132, 104, 78], material: 'wood' }));
  children.push(part({ name: 'RailBottom', pos: [0, 1.4, 0], size: [length, 0.35, 0.35], color: [132, 104, 78], material: 'wood' }));
  return model(`Fence_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, children, { pos, rotY });
}

function buildFlowers(pos, rng, palette) {
  const children = [];
  for (let i = 0; i < 6; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = rng() * 3;
    children.push(part({
      name: `Flower_${i + 1}`,
      pos: [Math.cos(angle) * radius, 0.6, Math.sin(angle) * radius],
      size: [0.8, 1.2, 0.8],
      color: pick(rng, [palette.accent, palette.accent2, [255, 220, 120], [255, 140, 190]]),
      material: 'neon',
      shape: 'ball',
      canCollide: false,
    }));
  }
  return model(`Flowers_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, children, { pos });
}

function buildBanner(pos, palette, rotY = 0) {
  return model(`Banner_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Pole', pos: [0, 6, 0], size: [0.5, 12, 0.5], color: [70, 70, 86], material: 'metal', shape: 'cylinder' }),
    part({ name: 'Cloth', pos: [1.6, 9.4, 0], size: [3, 4.6, 0.2], color: palette.accent, material: 'fabric' }),
    part({ name: 'ClothTrim', pos: [1.6, 11.6, 0], size: [3.2, 0.4, 0.3], color: palette.accent2, material: 'neon' }),
  ], { pos, rotY });
}

function buildHill(pos, rng, palette) {
  const width = 30 + rng() * 40;
  return model(`Hill_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'HillBase', pos: [0, 2, 0], size: [width, 10, width * 0.8], color: shade(palette.ground, 0.9), material: 'grass', shape: 'ball' }),
    part({ name: 'HillTop', pos: [width * 0.1, 6, 0], size: [width * 0.6, 8, width * 0.5], color: shade(palette.ground, 1.05), material: 'grass', shape: 'ball' }),
  ], { pos });
}

function buildBridge(pos, length, palette, rotY = 0) {
  const children = [
    part({ name: 'Deck', pos: [0, 1.4, 0], size: [length, 0.5, 8], color: [138, 102, 68], material: 'wood' }),
    part({ name: 'RailLeft', pos: [0, 2.6, -4], size: [length, 0.4, 0.4], color: [120, 88, 58], material: 'wood' }),
    part({ name: 'RailRight', pos: [0, 2.6, 4], size: [length, 0.4, 0.4], color: [120, 88, 58], material: 'wood' }),
  ];
  const posts = Math.max(2, Math.round(length / 6));
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i * length) / Math.max(1, posts - 1);
    children.push(part({ name: `Pylon_${i + 1}`, pos: [x, 0.6, -4], size: [0.6, 2.8, 0.6], color: [110, 80, 54], material: 'wood' }));
    children.push(part({ name: `PylonR_${i + 1}`, pos: [x, 0.6, 4], size: [0.6, 2.8, 0.6], color: [110, 80, 54], material: 'wood' }));
  }
  return model(`Bridge_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, children, { pos, rotY });
}

function buildPortal(pos, palette, label) {
  return model(`Portal_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'FrameLeft', pos: [-4, 6, 0], size: [1.2, 12, 1.2], color: palette.accent, material: 'metal' }),
    part({ name: 'FrameRight', pos: [4, 6, 0], size: [1.2, 12, 1.2], color: palette.accent, material: 'metal' }),
    part({ name: 'FrameTop', pos: [0, 12, 0], size: [9.2, 1.2, 1.2], color: palette.accent, material: 'metal' }),
    part({ name: 'Swirl', pos: [0, 6, 0], size: [7.4, 11, 0.6], color: palette.accent2, material: 'neon', transparency: 0.25, canCollide: false }),
    pointLight('PortalGlow', palette.accent2, 3, 34),
  ], { pos, label });
}

/** Buchstaben-Board für das Wortspiel: Kacheln, Podest, Hinweisschild. */
function buildLetterBoard(pos, word, palette, rotY = 0) {
  const children = [
    part({ name: 'BoardBase', pos: [0, 1, 0], size: [Math.max(12, word.length * 5 + 4), 2, 10], color: shade(palette.base, 1.25), material: 'marble' }),
    part({ name: 'BoardBack', pos: [0, 6, -4], size: [Math.max(12, word.length * 5 + 4), 10, 1], color: shade(palette.base, 0.85), material: 'brick' }),
    part({ name: 'BoardSign', pos: [0, 11.4, -4], size: [Math.max(10, word.length * 4), 1.6, 0.6], color: palette.accent, material: 'neon' }),
    pointLight('BoardGlow', palette.accent, 2, 26),
  ];
  const spacing = 5;
  const startX = -((word.length - 1) * spacing) / 2;
  for (let i = 0; i < word.length; i++) {
    children.push(part({
      name: `Tile_${i + 1}`,
      pos: [startX + i * spacing, 3.4, 0],
      size: [4, 4, 1.2],
      color: i % 2 === 0 ? palette.accent : palette.accent2,
      material: 'neon',
      transparency: 0.05,
      children: [pointLight(`TileGlow_${i + 1}`, palette.accent2, 0.8, 10)],
    }));
  }
  return model(`LetterBoard_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, children, { pos, rotY, word });
}

/** Rätsel-Station mit ProximityPrompt, die eine Wort-Runde startet. */
function buildPuzzleStation(pos, palette, label) {
  return model(`PuzzleStation_${Math.floor(pos[0])}_${Math.floor(pos[2])}`, [
    part({ name: 'Base', pos: [0, 0.6, 0], size: [6, 1.2, 6], color: shade(palette.base, 1.3), material: 'marble' }),
    part({ name: 'Column', pos: [0, 3, 0], size: [1.6, 5, 1.6], color: shade(palette.base, 1.5), material: 'metal', shape: 'cylinder' }),
    part({
      name: 'Console', pos: [0, 6, 0], size: [4, 1.2, 3], color: palette.accent2, material: 'neon',
      children: [
        inst('ProximityPrompt', 'StartPuzzle', {
          ActionText: { t: 'string', v: 'Rätsel starten' },
          ObjectText: { t: 'string', v: label || 'Wort-Rätsel' },
          HoldDuration: { t: 'float', v: 0 },
          MaxActivationDistance: { t: 'float', v: 12 },
          RequiresLineOfSight: { t: 'bool', v: false },
          KeyboardKeyCode: { t: 'token', v: 69 },
        }),
      ],
    }),
    part({ name: 'HoloBoard', pos: [0, 8.4, 0], size: [7, 3.6, 0.3], color: palette.accent, material: 'neon', transparency: 0.3, canCollide: false }),
    pointLight('StationGlow', palette.accent2, 1.8, 20),
  ], { pos });
}

function buildZone(zone, palette, rng, index, detail) {
  const [cx, cz] = zone.center;
  const children = [
    part({ name: 'ZoneFloor', pos: [cx, 0.6, cz], size: [zone.size, 1, zone.size], color: shade(palette.ground, 0.85 + rng() * 0.2), material: 'grass' }),
    part({ name: 'ZoneTrim', pos: [cx, 1.3, cz - zone.size / 2 + 2], size: [zone.size, 0.4, 1], color: palette.accent, material: 'neon' }),
    part({ name: 'ZoneTrimBack', pos: [cx, 1.3, cz + zone.size / 2 - 2], size: [zone.size, 0.4, 1], color: palette.accent, material: 'neon' }),
    part({ name: 'ZonePad', pos: [cx, 1.1, cz], size: [zone.size * 0.5, 0.3, zone.size * 0.5], color: shade(palette.base, 1.1), material: 'cobblestone' }),
  ];
  zone.buildings.forEach((building, bi) => {
    const offsetX = (bi - (zone.buildings.length - 1) / 2) * 34;
    children.push({
      ...building,
      props: {
        ...building.props,
        CFrame: { t: 'CFrame', v: [cx + offsetX, 0.6, cz - 8, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
      },
    });
  });
  if (zone.npcs) {
    zone.npcs.forEach((npc, ni) => {
      const offset = (ni - (zone.npcs.length - 1) / 2) * 14;
      children.push({
        ...npc,
        props: { ...npc.props, CFrame: { t: 'CFrame', v: [cx + offset, 0.6, cz + 22, 1, 0, 0, 0, 1, 0, 0, 0, 1] } },
      });
    });
  }
  if (zone.boards) {
    zone.boards.forEach((board, bi) => {
      children.push({
        ...board,
        props: { ...board.props, CFrame: { t: 'CFrame', v: [cx - 18 + bi * 36, 0.6, cz + 6, 1, 0, 0, 0, 1, 0, 0, 0, 1] } },
      });
    });
  }
  if (zone.stations) {
    zone.stations.forEach((station, si) => {
      children.push({
        ...station,
        props: { ...station.props, CFrame: { t: 'CFrame', v: [cx + 20 - si * 12, 0.6, cz - 26, 1, 0, 0, 0, 1, 0, 0, 0, 1] } },
      });
    });
  }
  const decor = [];
  const decorCount = Math.max(4, Math.round(8 * detail));
  for (let i = 0; i < decorCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = zone.size / 2 - 8 - rng() * 12;
    const px = cx + Math.cos(angle) * radius;
    const pz = cz + Math.sin(angle) * radius;
    const roll = rng();
    if (roll > 0.72) decor.push(buildLamp([px, 0.6, pz], palette));
    else if (roll > 0.5) decor.push(buildFlowers([px, 0.6, pz], rng, palette));
    else if (roll > 0.34) decor.push(buildBench([px, 0.6, pz], palette));
    else if (roll > 0.2) decor.push(buildRock([px, 0.6, pz], rng, palette));
    else decor.push(buildTree([px, 0.6, pz], rng, palette));
  }
  children.push(...decor);
  return model(`Zone_${index + 1}_${zone.name.replace(/[^A-Za-z0-9_]/g, '_')}`, children);
}

/* ------------------------------------------------------------------ */
/* Hauptgenerator                                                      */
/* ------------------------------------------------------------------ */

/** Baut den kompletten Instanzbaum. */
export function generateProject(spec) {
  const rng = mulberry32((spec.seed || hashSeed(spec.title || 'game')) ^ 0x9e3779b9);
  const genre = GENRES[spec.genre] || GENRES.simulator;
  const palette = { ...genre.palette, ...(spec.palette || {}) };
  const mapInfo = MAP_SIZES[spec.mapSize] || MAP_SIZES.mittel;
  const quality = qualityProfile(spec);
  const half = mapInfo.half;
  const config = buildGameConfig(spec);
  const isWordGame = spec.genre === 'wortspiel';

  const zoneCount = Math.max(2, Math.min(8, spec.zoneCount || mapInfo.zones));
  const shopZones = Math.max(1, Math.min(zoneCount, config.shops.length));
  const zoneRadius = half * 0.55;

  const wordPool = ['WORT', 'RÄTSEL', 'BUCHSTABE', 'SILBE', 'SPIEL', 'LEXIKON', 'VOKABEL', 'PUNKTE'];
  const zones = [];
  for (let i = 0; i < zoneCount; i++) {
    const angle = (i / zoneCount) * Math.PI * 2 - Math.PI / 2;
    const cx = i === 0 ? 0 : Math.cos(angle) * zoneRadius;
    const cz = i === 0 ? -Math.min(90, half * 0.45) : Math.sin(angle) * zoneRadius;
    const size = i === 0 ? 96 : 78;
    const buildings = [];
    if (i < shopZones) {
      const shop = config.shops[i];
      buildings.push(buildBuilding({
        name: shop.name,
        pos: [0, 0, 0],
        size: [26, 12, 20],
        palette,
        accent: i % 2 === 0 ? palette.accent : palette.accent2,
        promptId: shop.id,
        detail: quality.detail,
      }));
    } else {
      buildings.push(buildBuilding({
        name: `${genre.label} Denkmal`,
        pos: [0, 0, 0],
        size: [18, 8, 16],
        palette,
        accent: palette.accent2,
        promptId: null,
        detail: quality.detail,
      }));
    }
    const npcs = i < config.npcs.length ? [buildNpc(config.npcs[i], [0, 0, 0], palette)] : [];
    const boards = isWordGame && i < quality.boards
      ? [buildLetterBoard([0, 0, 0], wordPool[i % wordPool.length], palette)]
      : [];
    const stations = isWordGame
      ? [buildPuzzleStation([0, 0, 0], palette, `${zoneLabel(genre, i)}-Rätsel`)]
      : [];
    zones.push({
      name: genre.zoneNames[i % genre.zoneNames.length],
      center: [Math.round(cx), Math.round(cz)],
      size, buildings, npcs, boards, stations,
    });
  }

  const mapChildren = [
    part({ name: 'Ground', pos: [0, 0, 0], size: [half * 2, 2, half * 2], color: palette.ground, material: 'grass' }),
    part({ name: 'UnderBase', pos: [0, -1.6, 0], size: [half * 2 + 40, 2, half * 2 + 40], color: shade(palette.ground, 0.6), material: 'slate' }),
    part({ name: 'PlazaRing', pos: [0, 1.2, 0], size: [52, 0.6, 52], color: palette.accent, material: 'neon', transparency: 0.25 }),
    part({ name: 'PlazaFloor', pos: [0, 1.5, 0], size: [48, 0.6, 48], color: shade(palette.base, 1.3), material: 'marble' }),
    spawnLocation('SpawnLocation', [0, 2.4, 0], [12, 1, 12], palette.accent2),
    buildFountain([0, 1.6, 16], palette),
    buildStatue([-22, 1.6, 10], palette, `${spec.title}`),
    buildBanner([22, 1.6, 10], palette, 180),
  ];

  // Wege zwischen den Zonen (breiter, mit Randsteinen)
  zones.forEach((zone, i) => {
    if (i === 0) return;
    const [cx, cz] = zone.center;
    const length = Math.sqrt(cx * cx + cz * cz);
    const angle = (Math.atan2(cz, cx) * 180) / Math.PI;
    mapChildren.push(part({
      name: `Path_${i}`,
      pos: [cx / 2, 1.1, cz / 2],
      size: [length, 0.4, 12],
      color: shade(palette.base, 1.25),
      material: 'concrete',
      rotY: angle,
    }));
    if (quality.detail >= 1) {
      mapChildren.push(part({
        name: `PathTrim_${i}`,
        pos: [cx / 2, 1.35, cz / 2 - 6.5],
        size: [length, 0.3, 0.8],
        color: palette.accent2,
        material: 'neon',
        rotY: angle,
        transparency: 0.2,
      }));
      mapChildren.push(part({
        name: `PathTrimB_${i}`,
        pos: [cx / 2, 1.35, cz / 2 + 6.5],
        size: [length, 0.3, 0.8],
        color: palette.accent2,
        material: 'neon',
        rotY: angle,
        transparency: 0.2,
      }));
    }
  });

  zones.forEach((zone, i) => mapChildren.push(buildZone(zone, palette, rng, i, quality.detail)));

  // Tore zu gesperrten Bereichen
  zones.slice(1).forEach((zone, i) => {
    const [cx, cz] = zone.center;
    mapChildren.push(part({
      name: `Gate_${i + 1}`,
      pos: [cx, 6, cz + zone.size / 2 + 2],
      size: [22, 12, 1],
      color: palette.accent2,
      material: 'neon',
      transparency: 0.35,
    }));
  });

  // Landschaft: Hügel, Felsen, Bäume, Laternen, Blumen, Bänke, Zäune, Brücken
  const decor = folder('Decor', []);
  const treeCount = Math.round(30 * quality.decor);
  for (let i = 0; i < treeCount; i++) {
    const px = (rng() - 0.5) * (half * 1.75);
    const pz = (rng() - 0.5) * (half * 1.75);
    if (Math.abs(px) < 34 && Math.abs(pz) < 34) continue;
    const roll = rng();
    if (roll > 0.78) decor.children.push(buildLamp([px, 1, pz], palette));
    else if (roll > 0.62) decor.children.push(buildFlowers([px, 1, pz], rng, palette));
    else if (roll > 0.5) decor.children.push(buildBench([px, 1, pz], palette));
    else if (roll > 0.36) decor.children.push(buildRock([px, 1, pz], rng, palette));
    else decor.children.push(buildTree([px, 1, pz], rng, palette));
  }
  for (let i = 0; i < Math.round(10 * quality.decor); i++) {
    decor.children.push(buildHill(
      [(rng() - 0.5) * half * 1.5, 1, (rng() - 0.5) * half * 1.5],
      rng,
      palette,
    ));
  }
  if (quality.detail >= 1) {
    decor.children.push(buildFence([0, 1, half * 0.62], half * 1.2, palette, 0));
    decor.children.push(buildFence([-half * 0.62, 1, 0], half * 1.2, palette, 90));
    decor.children.push(buildBridge([half * 0.3, 1, -half * 0.3], 26, palette, 35));
    decor.children.push(buildPortal([-half * 0.42, 1, half * 0.3], palette, 'Zonen-Portal'));
  }
  mapChildren.push(decor);

  // Wasserstelle mit Steg
  mapChildren.push(folder('Lake', [
    part({ name: 'LakeBed', pos: [half * 0.45, -0.4, half * 0.42], size: [90, 2, 90], color: [48, 96, 132], material: 'slate' }),
    part({ name: 'Water', pos: [half * 0.45, 0.6, half * 0.42], size: [88, 1.2, 88], color: [70, 160, 220], material: 'water', transparency: 0.15, canCollide: false }),
    part({ name: 'Dock', pos: [half * 0.45, 1.4, half * 0.42 - 30], size: [12, 0.6, 24], color: [138, 102, 68], material: 'wood' }),
  ]));

  // Begrenzungswände
  mapChildren.push(folder('Boundaries', [
    part({ name: 'WallNorth', pos: [0, 12, -half], size: [half * 2, 24, 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallSouth', pos: [0, 12, half], size: [half * 2, 24, 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallWest', pos: [-half, 12, 0], size: [2, 24, half * 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallEast', pos: [half, 12, 0], size: [2, 24, half * 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
  ]));

  // Coin-Spots: unsichtbare Anker, der Server spawnt dort echte Coins
  const coinSpots = folder('CoinSpots', []);
  const coinCount = Math.max(30, Math.min(160, Math.round(zoneCount * 16 * quality.detail)));
  for (let i = 0; i < coinCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 12 + rng() * (half * 0.75);
    coinSpots.children.push(part({
      name: `CoinSpot_${i + 1}`,
      pos: [Math.cos(angle) * radius, 3, Math.sin(angle) * radius],
      size: [2, 2, 2],
      color: palette.accent,
      transparency: 1,
      canCollide: false,
    }));
  }

  const shops = folder('Shops', []);
  zones.forEach((zone, i) => {
    if (i >= config.shops.length) return;
    const [cx, cz] = zone.center;
    const shopModel = buildBuilding({
      name: config.shops[i].name,
      pos: [cx, 1.6, cz + zone.size / 2 - 14],
      size: [24, 11, 18],
      palette,
      accent: i % 2 === 0 ? palette.accent : palette.accent2,
      promptId: config.shops[i].id,
      detail: quality.detail,
    });
    shopModel.name = `Shop_${i + 1}_${config.shops[i].name.replace(/[^A-Za-z0-9_]/g, '_')}`;
    shops.children.push(shopModel);
  });

  const npcs = folder('NPCs', []);
  zones.forEach((zone, i) => {
    if (i >= config.npcs.length) return;
    const [cx, cz] = zone.center;
    npcs.children.push(buildNpc(config.npcs[i], [cx + 8, 1.6, cz + 18], palette));
  });

  // Interaktive Objekte (Bänke, Lagerfeuer, Fackeln)
  const interactive = folder('Interactive', []);
  for (let i = 0; i < Math.round(6 * quality.decor); i++) {
    const angle = (i / Math.max(1, Math.round(6 * quality.decor))) * Math.PI * 2;
    interactive.children.push(buildBench([Math.cos(angle) * 26, 1.6, Math.sin(angle) * 26], palette));
  }

  // Wortspiel: zentrale Wort-Arena mit Buchstaben-Boards
  if (isWordGame) {
    const arena = folder('WordArena', [
      part({ name: 'ArenaFloor', pos: [0, 1.4, 40], size: [64, 0.8, 40], color: shade(palette.base, 1.2), material: 'marble' }),
      part({ name: 'ArenaTrim', pos: [0, 1.9, 40], size: [66, 0.3, 42], color: palette.accent, material: 'neon', transparency: 0.3 }),
      buildLetterBoard([0, 1.8, 30], 'ROBLOX', palette),
      buildPuzzleStation([-20, 1.8, 46], palette, 'Wort-Rätsel'),
      buildPuzzleStation([20, 1.8, 46], palette, 'Wort-Rätsel'),
    ]);
    mapChildren.push(arena);
  }

  const workspaceNode = inst('Workspace', 'Workspace', {
    FilteringEnabled: { t: 'bool', v: true },
    StreamingEnabled: { t: 'bool', v: false },
    Gravity: { t: 'float', v: 196.2 },
  }, [
    folder('Map', mapChildren),
    shops,
    npcs,
    interactive,
    coinSpots,
    serverScript('MapStabilizer', mapStabilizerModule(spec)),
  ]);

  const remotes = folder('Remotes', [
    inst('RemoteEvent', 'DataSync'), inst('RemoteEvent', 'Notify'), inst('RemoteEvent', 'BuyItem'),
    inst('RemoteEvent', 'EquipPet'), inst('RemoteEvent', 'PetEquipped'), inst('RemoteEvent', 'ClaimQuest'),
    inst('RemoteEvent', 'Rebirth'), inst('RemoteEvent', 'Dialog'),
    inst('RemoteEvent', 'QuestReward'), inst('RemoteEvent', 'QuestProgress'), inst('RemoteEvent', 'QuestState'),
    inst('RemoteEvent', 'AchievementUnlocked'), inst('RemoteEvent', 'BuyTalent'),
    inst('RemoteEvent', 'DailyReward'), inst('RemoteEvent', 'DailyState'),
    inst('RemoteEvent', 'TradeRequest'), inst('RemoteEvent', 'TradeComplete'),
    inst('RemoteEvent', 'WordRound'), inst('RemoteEvent', 'WordSubmit'), inst('RemoteEvent', 'WordStart'),
    inst('RemoteEvent', 'WordSolved'), inst('RemoteEvent', 'WordWrong'),
  ]);

  const shared = folder('Shared', [
    moduleScript('GameConfig', gameConfigModule(spec, config)),
    moduleScript('UILibrary', uiLibraryModule(spec)),
  ]);

  const replicatedStorage = inst('ReplicatedStorage', 'ReplicatedStorage', {}, [shared, remotes]);

  // Systeme nach Qualitätsstufe zusammenstellen
  const systemBuilders = [
    { id: 'quests', node: () => serverScript('QuestService', questServiceModule(spec, config)) },
    { id: 'achievements', node: () => serverScript('AchievementService', achievementServiceModule(spec, config)) },
    { id: 'daily', node: () => serverScript('DailyRewardService', dailyServiceModule(spec, config)) },
    { id: 'anticheat', node: () => serverScript('AntiCheat', antiCheatModule(spec)) },
    { id: 'talents', node: () => serverScript('TalentService', talentServiceModule(spec, config)) },
    { id: 'weather', node: () => serverScript('DayNightCycle', dayCycleModule(spec)) },
    { id: 'boss', node: () => serverScript('BossService', bossServiceModule(spec, config)) },
    { id: 'trading', node: () => serverScript('TradeService', tradeServiceModule(spec, config)) },
    { id: 'wordgame', node: () => serverScript('WordGameService', wordGameServiceModule(spec, config)) },
  ];
  const activeSystems = systemBuilders
    .filter((entry, index) => index < quality.systems || (entry.id === 'wordgame' && isWordGame))
    .map((entry) => entry.id);

  const coreScripts = [serverScript('GameServer', serverMainModule(spec, config))];
  const systemScripts = systemBuilders
    .filter((entry) => activeSystems.includes(entry.id))
    .map((entry) => entry.node());

  const serverScriptService = inst('ServerScriptService', 'ServerScriptService', {}, [
    folder('Core', coreScripts),
    folder('Systems', systemScripts),
  ]);

  const clientScripts = [localScript('ClientMain', clientMainModule(spec))];
  if (activeSystems.includes('wordgame')) {
    clientScripts.push(localScript('WordGameUI', wordGameClientModule(spec, config)));
  }
  const starterPlayer = inst('StarterPlayer', 'StarterPlayer', {}, [
    folder('StarterPlayerScripts', clientScripts),
  ]);

  const lighting = inst('Lighting', 'Lighting', {
    Ambient: { t: 'Color3', v: spec.palette.lightAmbient.map((c) => c / 255) },
    OutdoorAmbient: { t: 'Color3', v: spec.palette.lightOutdoor.map((c) => c / 255) },
    Brightness: { t: 'float', v: spec.palette.brightness },
    GlobalShadows: { t: 'bool', v: spec.genre !== 'horror' },
    ClockTime: { t: 'float', v: spec.genre === 'horror' ? 0 : 14 },
  });

  const starterGui = inst('StarterGui', 'StarterGui', {}, []);
  const soundService = inst('SoundService', 'SoundService', {}, []);
  const teams = inst('Teams', 'Teams', {}, []);

  const services = [workspaceNode, replicatedStorage, serverScriptService, starterPlayer, lighting, starterGui, soundService, teams];
  const stats = treeStats(inst('Root', 'Root', {}, services));
  return {
    services,
    config,
    stats,
    palette,
    mapInfo,
    zoneCount,
    systems: activeSystems,
    quality: quality.level,
  };
}

function zoneLabel(genre, index) {
  return genre.zoneNames[index % genre.zoneNames.length];
}

/**
 * Prüft den erzeugten Baum und vergibt einen Qualitäts-Score.
 * Echte Prüfungen: Spawnpunkt, Shops, Skripte, Remotes, Zonen, Systeme.
 */
export function validateBuild(built, spec) {
  const find = (node, predicate) => {
    if (predicate(node)) return node;
    for (const child of node.children || []) {
      const hit = find(child, predicate);
      if (hit) return hit;
    }
    return null;
  };
  const root = inst('Root', 'Root', {}, built.services);
  const hasSpawn = Boolean(find(root, (n) => n.className === 'SpawnLocation'));
  const shopCount = built.stats.classes.Model ? built.config.shops.length : 0;
  const scriptCount = built.stats.scripts;
  const remoteCount = built.stats.classes.RemoteEvent || 0;
  const hasConfig = Boolean(find(root, (n) => n.className === 'ModuleScript' && n.name === 'GameConfig'));
  const hasUi = Boolean(find(root, (n) => n.className === 'ModuleScript' && n.name === 'UILibrary'));

  const checks = [
    { id: 'spawn', label: 'Spawnpunkt vorhanden', ok: hasSpawn },
    { id: 'shops', label: `${shopCount} Shops mit Artikeln`, ok: shopCount >= 2 },
    { id: 'scripts', label: `${scriptCount} Luau-Skripte`, ok: scriptCount >= 4 },
    { id: 'remotes', label: `${remoteCount} RemoteEvents`, ok: remoteCount >= 8 },
    { id: 'config', label: 'GameConfig-Modul vorhanden', ok: hasConfig },
    { id: 'ui', label: 'UILibrary-Modul vorhanden', ok: hasUi },
    { id: 'zones', label: `${built.zoneCount} Zonen gebaut`, ok: built.zoneCount >= 2 },
    { id: 'systems', label: `${built.systems.length} Systeme aktiv`, ok: built.systems.length >= 3 },
  ];

  const partsScore = Math.min(30, (built.stats.parts / 400) * 30);
  const scriptScore = Math.min(25, (built.stats.scriptLines / 2000) * 25);
  const systemScore = Math.min(20, (built.systems.length / 9) * 20);
  const zoneScore = Math.min(15, (built.zoneCount / 6) * 15);
  const detailScore = Math.min(10, ((built.stats.models || 0) / 60) * 10);
  const score = Math.round(partsScore + scriptScore + systemScore + zoneScore + detailScore);

  return {
    ok: checks.every((c) => c.ok),
    checks,
    score: Math.max(0, Math.min(100, score)),
    passes: qualityProfile(spec).passes,
  };
}
