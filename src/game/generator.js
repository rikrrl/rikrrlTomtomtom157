/**
 * Spielgenerator: baut aus einer Spezifikation einen vollständigen Roblox-Instanzbaum.
 * Deterministisch über spec.seed, damit ein Projekt bei jedem Export identisch ist.
 */

import {
  inst, part, folder, model, spawnLocation, pointLight,
  serverScript, localScript, moduleScript, MATERIAL,
} from './build.js';
import {
  gameConfigModule, uiLibraryModule, serverMainModule, clientMainModule, mapStabilizerModule,
} from './lua.js';
import { treeStats } from './rbxlx.js';

export const GENRES = {
  simulator: {
    label: 'Simulator',
    nouns: ['Geld', 'Coins', 'Münzen', 'Simulator', 'Klicker', 'Farm'],
    zoneNames: ['Startplaza', 'Wiesen-Farm', 'Kristallhöhle', 'Lava-Zone', 'Wolken-Insel', 'Tiefsee-Becken'],
    buildingNames: ['Farm-Shop', 'Kristall-Händler', 'Lava-Schmiede', 'Wolken-Basar', 'Tiefsee-Markt'],
    palette: { accent: [124, 92, 255], accent2: [64, 196, 255], ground: [86, 138, 74], base: [70, 66, 110] },
  },
  tycoon: {
    label: 'Tycoon',
    nouns: ['Tycoon', 'Fabrik', 'Business', 'Firma', 'Imperium'],
    zoneNames: ['Fabrikhalle', 'Büro-Turm', 'Lagerhaus', 'Produktions-Zone', 'Logistik-Hof'],
    buildingNames: ['Maschinen-Shop', 'Büro-Shop', 'Lager-Shop', 'Upgrade-Station'],
    palette: { accent: [90, 120, 255], accent2: [0, 210, 200], ground: [96, 100, 112], base: [52, 58, 78] },
  },
  horror: {
    label: 'Horror',
    nouns: ['Horror', 'Grusel', 'Spuk', 'Monster', 'Nacht'],
    zoneNames: ['Verlassene Halle', 'Keller-Gewölbe', 'Kapelle', 'Friedhof', 'Waldlichtung'],
    buildingNames: ['Verlassener Laden', 'Kapellen-Altar', 'Blutbrunnen', 'Grabstein-Händler'],
    palette: { accent: [168, 62, 92], accent2: [98, 40, 140], ground: [48, 46, 54], base: [34, 30, 42] },
  },
  openworld: {
    label: 'Open World',
    nouns: ['Open World', 'Openworld', 'Welt', 'Erkundung', 'Abenteuer'],
    zoneNames: ['Hauptstadt', 'Waldregion', 'Wüstenregion', 'Schneegipfel', 'Hafenviertel', 'Ruinenfeld'],
    buildingNames: ['Stadt-Markt', 'Wald-Hütte', 'Wüsten-Basar', 'Gipfel-Shop', 'Hafen-Kontor'],
    palette: { accent: [112, 96, 255], accent2: [86, 220, 255], ground: [104, 148, 92], base: [64, 74, 104] },
  },
  obby: {
    label: 'Obby',
    nouns: ['Obby', 'Parkour', 'Hindernis', 'Jump'],
    zoneNames: ['Start-Turm', 'Checkpoint 1', 'Checkpoint 2', 'Lava-Sprung', 'Ziel-Plattform'],
    buildingNames: ['Checkpoint-Shop', 'Sprung-Booster', 'Skin-Laden'],
    palette: { accent: [255, 128, 64], accent2: [120, 96, 255], ground: [92, 92, 108], base: [56, 54, 72] },
  },
  rpg: {
    label: 'RPG',
    nouns: ['RPG', 'Rollenspiel', 'Fantasy', 'Magie', 'Krieger'],
    zoneNames: ['Dorf Eldoria', 'Zauberwald', 'Drachenkamm', 'Kristallsee', 'Schattenzitadelle'],
    buildingNames: ['Waffen-Schmiede', 'Alchemist', 'Trank-Laden', 'Rüstungs-Händler'],
    palette: { accent: [146, 108, 255], accent2: [86, 226, 190], ground: [82, 128, 92], base: [60, 56, 92] },
  },
  pets: {
    label: 'Pet-Simulator',
    nouns: ['Pets', 'Haustiere', 'Tiere'],
    zoneNames: ['Pet-Plaza', 'Wiesen-Gehege', 'Kristall-Hain', 'Himmels-Insel'],
    buildingNames: ['Pet-Shop', 'Ei-Basar', 'Futter-Laden'],
    palette: { accent: [140, 110, 255], accent2: [92, 224, 255], ground: [94, 146, 96], base: [66, 60, 104] },
  },
  battle: {
    label: 'Battle / PvP',
    nouns: ['PvP', 'Kampf', 'Arena', 'Battleroyale'],
    zoneNames: ['Arena', 'Trainingsplatz', 'Waffenkammer', 'Turm'],
    buildingNames: ['Waffen-Shop', 'Rüstungs-Shop', 'Arena-Lobby'],
    palette: { accent: [255, 86, 120], accent2: [120, 96, 255], ground: [88, 84, 96], base: [48, 44, 62] },
  },
};

const MAP_SIZES = {
  klein: { half: 130, zones: 3, label: 'Klein' },
  mittel: { half: 200, zones: 4, label: 'Mittel' },
  groß: { half: 290, zones: 6, label: 'Groß' },
  riesig: { half: 400, zones: 7, label: 'Riesig' },
};

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

/** Balancing und Inhalte (Pets, Shops, Quests, NPCs) aus der Spezifikation ableiten. */
export function buildGameConfig(spec) {
  const rng = mulberry32(spec.seed || hashSeed(spec.title || 'roblox'));
  const genre = GENRES[spec.genre] || GENRES.simulator;
  const petCount = Math.max(3, Math.min(8, spec.features.pets ? (spec.petCount || 5) : 3));
  const petNames = ['Funkelkatze', 'Steinwächter', 'Glutwelpe', 'Nebelgeist', 'Kristalldrache', 'Schattenfuchs', 'Wolkenbär', 'Lavafalke'];
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
      multiplier: Number((1.25 + i * 0.5).toFixed(2)),
      color,
      price: 150 * (i + 1) * (i + 1),
      rarity: i < 2 ? 'Gewöhnlich' : i < 4 ? 'Selten' : 'Legendär',
    });
  }

  const zoneNames = genre.zoneNames.slice(0, Math.max(3, Math.min(6, spec.zoneCount || 4)));
  const shopNames = genre.buildingNames.slice(0, Math.max(2, Math.min(5, spec.shopCount || 3)));

  const shops = [];
  shopNames.forEach((name, index) => {
    const items = [];
    items.push({
      id: `up_${index + 1}`,
      name: index === 0 ? 'Coin-Upgrade' : `Upgrade Stufe ${index + 1}`,
      description: 'Erhöht deinen Coin-Multiplikator dauerhaft um 25 %.',
      price: 100 * (index + 1) * (index + 1),
      kind: 'upgrade',
      amount: 1,
    });
    if (index === 0 || spec.features.pets) {
      const pet = pets[Math.min(pets.length - 1, index)];
      items.push({
        id: `buy_${pet.id}`,
        name: `Pet: ${pet.name}`,
        description: `${pet.rarity} - Multiplikator x${pet.multiplier}`,
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
    shops.push({ id: `shop_${index + 1}`, name, description: `Shop in ${zoneNames[Math.min(index, zoneNames.length - 1)]}`, items });
  });

  const quests = [
    { id: 'collect_coins', name: 'Fleißiger Sammler', description: 'Sammle 25 Coins in der Welt.', goal: 25, reward: 250, kind: 'collect' },
    { id: 'buy_items', name: 'Erster Einkauf', description: 'Kaufe 3 Artikel in einem Shop.', goal: 3, reward: 400, kind: 'buy' },
    { id: 'level_5', name: 'Aufsteiger', description: 'Erreiche Level 5.', goal: 5, reward: 800, kind: 'level' },
  ];
  if (spec.features.pets) {
    quests.push({ id: 'pet_friend', name: 'Pet-Freund', description: 'Kaufe dein erstes Pet und rüste es aus.', goal: 1, reward: 600, kind: 'pet' });
  }

  const npcNames = ['Händler Miro', 'Wächterin Lya', 'Alter Weiser', 'Schmied Toran', 'Forscherin Neva'];
  const npcDialogs = [
    'Willkommen! Sammle Coins und kaufe dir bessere Upgrades.',
    'Der nächste Bereich ist gefährlich. Sei vorbereitet!',
    'Ich habe Gerüchte über einen legendären Fund gehört ...',
    'Mit jedem Level steigen deine Chancen. Bleib dran!',
    'Pets verstärken deinen Multiplikator - rüste sie im Pet-Menü aus.',
  ];
  const npcs = [];
  const npcCount = Math.max(2, Math.min(5, spec.npcCount || 3));
  for (let i = 0; i < npcCount; i++) {
    npcs.push({ id: `npc_${i + 1}`, name: npcNames[i % npcNames.length], dialog: npcDialogs[i % npcDialogs.length] });
  }

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
    npcs,
    upgrades: [{ id: 'speed', name: 'Laufgeschwindigkeit', price: 300, value: 4 }],
  };
}

/** Ein Shop-/Zonengebäude mit Schild, Wänden, Dach und Interaktionspunkt. */
function buildBuilding({ name, pos, size, palette, rotY, accent, promptId }) {
  const [w, h, d] = size;
  const wallColor = shade(palette.base, 1.15);
  const children = [
    part({ name: 'Floor', pos: [0, 0.5, 0], size: [w, 1, d], color: shade(palette.base, 0.9), material: 'concrete' }),
    part({ name: 'WallBack', pos: [0, h / 2, -d / 2], size: [w, h, 1], color: wallColor, material: 'brick' }),
    part({ name: 'WallLeft', pos: [-w / 2, h / 2, 0], size: [1, h, d], color: wallColor, material: 'brick' }),
    part({ name: 'WallRight', pos: [w / 2, h / 2, 0], size: [1, h, d], color: wallColor, material: 'brick' }),
    part({ name: 'Roof', pos: [0, h + 0.5, 0], size: [w + 2, 1, d + 2], color: accent, material: 'metal' }),
    part({ name: 'Sign', pos: [0, h + 2.4, d / 2 - 0.4], size: [Math.min(w, 14), 3, 0.6], color: accent, material: 'neon', transparency: 0.05 }),
    part({ name: 'Counter', pos: [0, 1.6, d / 2 - 3], size: [Math.min(w - 4, 8), 1.6, 2], color: shade(palette.base, 1.4), material: 'wood' }),
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
  return model(name.replace(/[^A-Za-z0-9_]/g, '_'), children, { pos, rotY, promptId });
}

function buildNpc(npc, pos, palette) {
  const body = [
    part({ name: 'Torso', pos: [0, 3, 0], size: [2, 2.4, 1], color: shade(palette.accent2, 0.9), material: 'fabric' }),
    part({ name: 'Head', pos: [0, 4.8, 0], size: [1.6, 1.6, 1.6], color: [236, 200, 160], material: 'plastic', shape: 'ball' }),
    part({ name: 'Legs', pos: [0, 1.2, 0], size: [1.8, 2, 1], color: shade(palette.base, 1.2), material: 'fabric' }),
    part({ name: 'Hat', pos: [0, 5.9, 0], size: [1.9, 0.5, 1.9], color: palette.accent, material: 'neon' }),
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

function buildZone(zone, palette, rng, index) {
  const [cx, cz] = zone.center;
  const children = [
    part({ name: 'ZoneFloor', pos: [cx, 0.6, cz], size: [zone.size, 1, zone.size], color: shade(palette.ground, 0.85 + rng() * 0.2), material: 'ground' in MATERIAL ? 'grass' : 'concrete' }),
    part({ name: 'ZoneTrim', pos: [cx, 1.3, cz - zone.size / 2 + 2], size: [zone.size, 0.4, 1], color: palette.accent, material: 'neon' }),
    part({ name: 'ZoneTrimBack', pos: [cx, 1.3, cz + zone.size / 2 - 2], size: [zone.size, 0.4, 1], color: palette.accent, material: 'neon' }),
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
  const decor = [];
  for (let i = 0; i < 6; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = zone.size / 2 - 8 - rng() * 12;
    const px = cx + Math.cos(angle) * radius;
    const pz = cz + Math.sin(angle) * radius;
    decor.push(rng() > 0.35 ? buildTree([px, 0.6, pz], rng, palette) : buildLamp([px, 0.6, pz], palette));
  }
  children.push(...decor);
  return model(`Zone_${index + 1}_${zone.name.replace(/[^A-Za-z0-9_]/g, '_')}`, children);
}

/** Baut den kompletten Instanzbaum. */
export function generateProject(spec) {
  const rng = mulberry32((spec.seed || hashSeed(spec.title || 'game')) ^ 0x9e3779b9);
  const genre = GENRES[spec.genre] || GENRES.simulator;
  const palette = { ...genre.palette, ...(spec.palette || {}) };
  const mapInfo = MAP_SIZES[spec.mapSize] || MAP_SIZES.mittel;
  const half = mapInfo.half;
  const config = buildGameConfig(spec);

  const zoneCount = Math.max(2, Math.min(6, spec.zoneCount || mapInfo.zones));
  const shopZones = Math.max(1, Math.min(zoneCount, config.shops.length));
  const zoneRadius = half * 0.55;

  const zones = [];
  for (let i = 0; i < zoneCount; i++) {
    const angle = (i / zoneCount) * Math.PI * 2 - Math.PI / 2;
    const cx = i === 0 ? 0 : Math.cos(angle) * zoneRadius;
    const cz = i === 0 ? -Math.min(90, half * 0.45) : Math.sin(angle) * zoneRadius;
    const size = i === 0 ? 90 : 74;
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
      }));
    } else {
      buildings.push(buildBuilding({
        name: `${genre.label} Denkmal`,
        pos: [0, 0, 0],
        size: [18, 8, 16],
        palette,
        accent: palette.accent2,
        promptId: null,
      }));
    }
    const npcs = i < config.npcs.length ? [buildNpc(config.npcs[i], [0, 0, 0], palette)] : [];
    zones.push({ name: genre.zoneNames[i % genre.zoneNames.length], center: [Math.round(cx), Math.round(cz)], size, buildings, npcs });
  }

  const mapChildren = [
    part({ name: 'Ground', pos: [0, 0, 0], size: [half * 2, 2, half * 2], color: palette.ground, material: 'grass' }),
    part({ name: 'UnderBase', pos: [0, -1.6, 0], size: [half * 2 + 40, 2, half * 2 + 40], color: shade(palette.ground, 0.6), material: 'slate' }),
    part({ name: 'PlazaRing', pos: [0, 1.2, 0], size: [46, 0.6, 46], color: palette.accent, material: 'neon', transparency: 0.25 }),
    part({ name: 'PlazaFloor', pos: [0, 1.5, 0], size: [42, 0.6, 42], color: shade(palette.base, 1.3), material: 'marble' }),
    spawnLocation('SpawnLocation', [0, 2.4, 0], [12, 1, 12], palette.accent2),
  ];

  // Wege zwischen den Zonen
  zones.forEach((zone, i) => {
    if (i === 0) return;
    const [cx, cz] = zone.center;
    const length = Math.sqrt(cx * cx + cz * cz);
    const angle = (Math.atan2(cz, cx) * 180) / Math.PI;
    mapChildren.push(part({
      name: `Path_${i}`,
      pos: [cx / 2, 1.1, cz / 2],
      size: [length, 0.4, 10],
      color: shade(palette.base, 1.25),
      material: 'concrete',
      rotY: angle,
    }));
  });

  zones.forEach((zone, i) => mapChildren.push(buildZone(zone, palette, rng, i)));

  // Tore zu gesperrten Bereichen
  zones.slice(1).forEach((zone, i) => {
    const [cx, cz] = zone.center;
    const gate = part({
      name: `Gate_${i + 1}`,
      pos: [cx, 6, cz + zone.size / 2 + 2],
      size: [22, 12, 1],
      color: palette.accent2,
      material: 'neon',
      transparency: 0.35,
    });
    mapChildren.push(gate);
  });

  // Deko über die ganze Karte
  const decor = folder('Decor', []);
  for (let i = 0; i < 26; i++) {
    const px = (rng() - 0.5) * (half * 1.7);
    const pz = (rng() - 0.5) * (half * 1.7);
    if (Math.abs(px) < 30 && Math.abs(pz) < 30) continue;
    decor.children.push(rng() > 0.45 ? buildTree([px, 1, pz], rng, palette) : buildLamp([px, 1, pz], palette));
  }
  for (let i = 0; i < 8; i++) {
    decor.children.push(model(`Rock_${i}`, [
      part({ name: 'Rock', pos: [(rng() - 0.5) * half * 1.6, 1.5, (rng() - 0.5) * half * 1.6], size: [4 + rng() * 5, 3 + rng() * 4, 4 + rng() * 5], color: shade(palette.base, 1.1), material: 'slate', shape: 'ball', rotY: rng() * 360 }),
    ]));
  }
  mapChildren.push(decor);

  // Begrenzungswände
  const walls = folder('Boundaries', [
    part({ name: 'WallNorth', pos: [0, 12, -half], size: [half * 2, 24, 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallSouth', pos: [0, 12, half], size: [half * 2, 24, 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallWest', pos: [-half, 12, 0], size: [2, 24, half * 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
    part({ name: 'WallEast', pos: [half, 12, 0], size: [2, 24, half * 2], color: shade(palette.base, 0.8), material: 'concrete', transparency: 0.55 }),
  ]);
  mapChildren.push(walls);

  // Coin-Spots: unsichtbare Anker, der Server spawnt dort echte Coins
  const coinSpots = folder('CoinSpots', []);
  const coinCount = Math.max(24, Math.min(80, Math.round(zoneCount * 12)));
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
    });
    shopModel.name = `Shop_${i + 1}_${config.shops[i].name.replace(/[^A-Za-z0-9_]/g, '_')}`;
    shops.children.push(shopModel);
  });

  const npcs = folder('NPCs', []);
  zones.forEach((zone, i) => {
    if (i >= config.npcs.length) return;
    const [cx, cz] = zone.center;
    const npcModel = buildNpc(config.npcs[i], [cx + 8, 1.6, cz + 18], palette);
    npcs.children.push(npcModel);
  });

  const workspaceNode = inst('Workspace', 'Workspace', {
    FilteringEnabled: { t: 'bool', v: true },
    StreamingEnabled: { t: 'bool', v: false },
    Gravity: { t: 'float', v: 196.2 },
  }, [
    folder('Map', mapChildren),
    shops,
    npcs,
    coinSpots,
    serverScript('MapStabilizer', mapStabilizerModule(spec)),
  ]);

  const remotes = folder('Remotes', [
    inst('RemoteEvent', 'DataSync'), inst('RemoteEvent', 'Notify'), inst('RemoteEvent', 'BuyItem'),
    inst('RemoteEvent', 'EquipPet'), inst('RemoteEvent', 'PetEquipped'), inst('RemoteEvent', 'ClaimQuest'),
    inst('RemoteEvent', 'Rebirth'), inst('RemoteEvent', 'Dialog'),
  ]);

  const shared = folder('Shared', [
    moduleScript('GameConfig', gameConfigModule(spec, config)),
    moduleScript('UILibrary', uiLibraryModule(spec)),
  ]);

  const replicatedStorage = inst('ReplicatedStorage', 'ReplicatedStorage', {}, [shared, remotes]);

  const serverScriptService = inst('ServerScriptService', 'ServerScriptService', {}, [
    folder('Core', [serverScript('GameServer', serverMainModule(spec, config))]),
  ]);

  const starterPlayer = inst('StarterPlayer', 'StarterPlayer', {}, [
    folder('StarterPlayerScripts', [localScript('ClientMain', clientMainModule(spec))]),
  ]);

  const lighting = inst('Lighting', 'Lighting', {
    Ambient: { t: 'Color3', v: spec.palette.lightAmbient.map((c) => c / 255) },
    OutdoorAmbient: { t: 'Color3', v: spec.palette.lightOutdoor.map((c) => c / 255) },
    Brightness: { t: 'float', v: spec.palette.brightness },
    GlobalShadows: { t: 'bool', v: spec.genre !== 'horror' },
  });

  const starterGui = inst('StarterGui', 'StarterGui', {}, []);
  const soundService = inst('SoundService', 'SoundService', {}, []);
  const teams = inst('Teams', 'Teams', {}, []);

  const services = [workspaceNode, replicatedStorage, serverScriptService, starterPlayer, lighting, starterGui, soundService, teams];
  const stats = treeStats(inst('Root', 'Root', {}, services));
  return { services, config, stats, palette, mapInfo, zoneCount };
}
