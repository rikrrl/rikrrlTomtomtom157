/**
 * Welt-Objekte für die Zusatzsysteme: Angelplatz, Werkbank, Gildenbrett,
 * Season-Pass-Brett, sprechende NPCs sowie zusätzliche Deko-Bausteine.
 *
 * Die Objekte tragen ProximityPrompts mit festen ObjectText-Werten
 * ("Angelplatz", "Werkbank", "Gilde", "Season-Pass", "Gespräch"), über die
 * die Luau-Systeme ihre Aktionen verbinden.
 */

import { inst, part, model, pointLight } from './build.js';

function prompt(objectText, actionText, hold = 0.6, distance = 12) {
  return inst('ProximityPrompt', 'Prompt', {
    ObjectText: { t: 'string', v: objectText },
    ActionText: { t: 'string', v: actionText },
    HoldDuration: { t: 'float', v: hold },
    MaxActivationDistance: { t: 'float', v: distance },
    RequiresLineOfSight: { t: 'bool', v: false },
    Enabled: { t: 'bool', v: true },
  });
}

/** Angelplatz mit Teich, Steg und drei Angel-Spots. */
export function buildFishingArea(pos, palette, rng) {
  const pond = [64, 148, 190];
  const wood = [124, 88, 56];
  const parts = [];

  parts.push(part({ name: 'Teich', pos: [pos[0], 0.6, pos[2]], size: [96, 1.2, 74], color: pond, material: 'water', transparency: 0.35, canCollide: false }));
  parts.push(part({ name: 'Teichgrund', pos: [pos[0], -0.4, pos[2]], size: [100, 1.6, 78], color: [42, 60, 78], material: 'sand' }));

  // Steg
  for (let i = 0; i < 5; i++) {
    parts.push(part({
      name: `Steg_${i + 1}`,
      pos: [pos[0] - 18 + i * 4, 2.2, pos[2] + 40],
      size: [3.6, 0.5, 14],
      color: wood,
      material: 'wood',
    }));
  }
  parts.push(part({ name: 'Steg_Pfosten_L', pos: [pos[0] - 22, 1.6, pos[2] + 46], size: [1, 5, 1], color: wood, material: 'wood' }));
  parts.push(part({ name: 'Steg_Pfosten_R', pos: [pos[0] + 0, 1.6, pos[2] + 46], size: [1, 5, 1], color: wood, material: 'wood' }));

  // Schild + Licht
  parts.push(part({ name: 'Angel_Schild', pos: [pos[0], 8, pos[2] + 50], size: [18, 4, 1], color: palette.accent, material: 'neon' }));
  parts.push(part({ name: 'Angel_Schild_Pfosten', pos: [pos[0], 4, pos[2] + 50], size: [1.2, 8, 1.2], color: [70, 66, 90], material: 'metal' }));
  parts.push(part({ name: 'Angel_Lampe', pos: [pos[0] - 26, 6, pos[2] + 44], size: [1, 1, 1], color: [255, 226, 160], material: 'neon', children: [pointLight('AngelLicht', [255, 226, 160], 2, 26)] }));

  // Angel-Spots am Ufer
  const spots = [
    [pos[0] - 20, 2.6, pos[2] + 34],
    [pos[0] + 12, 2.6, pos[2] + 34],
    [pos[0] - 4, 2.6, pos[2] - 34],
  ];
  spots.forEach((spot, index) => {
    parts.push(part({
      name: `AngelSpot_${index + 1}`,
      pos: spot,
      size: [3, 0.6, 3],
      color: [232, 244, 255],
      material: 'neon',
      children: [prompt('Angelplatz', 'Angeln')],
    }));
  });

  // Kleine Felsen und Schilf als Deko
  const decor = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < decor; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 40 + rng() * 16;
    parts.push(part({
      name: `Schilf_${i + 1}`,
      pos: [pos[0] + Math.cos(angle) * radius, 2.4, pos[2] + Math.sin(angle) * radius],
      size: [1.2, 3 + rng() * 2, 1.2],
      color: [96, 152, 88],
      material: 'grass',
      canCollide: false,
    }));
  }

  return model('Angelplatz', parts);
}

/** Werkbank zum Craften mit Amboss, Kisten und Werkzeugwand. */
export function buildCraftingBench(pos, palette) {
  const wood = [126, 92, 58];
  const parts = [];

  parts.push(part({ name: 'Werkbank_Tisch', pos: [pos[0], 4, pos[2]], size: [14, 1, 8], color: wood, material: 'wood' }));
  for (const [dx, dz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) {
    parts.push(part({ name: 'Werkbank_Bein', pos: [pos[0] + dx, 1.8, pos[2] + dz], size: [1, 4, 1], color: [96, 68, 42], material: 'wood' }));
  }
  parts.push(part({
    name: 'Amboss',
    pos: [pos[0] - 4, 5.4, pos[2]],
    size: [4, 1.8, 2.4],
    color: [70, 74, 88],
    material: 'metal',
    children: [prompt('Werkbank', 'Craften')],
  }));
  parts.push(part({ name: 'Werkzeugwand', pos: [pos[0] + 5, 6, pos[2] - 4], size: [10, 6, 0.6], color: [86, 72, 60], material: 'wood' }));
  parts.push(part({ name: 'Werkzeug_Hammer', pos: [pos[0] + 2, 6, pos[2] - 3.6], size: [0.6, 3, 0.6], color: [150, 150, 160], material: 'metal' }));
  parts.push(part({ name: 'Werkzeug_Zange', pos: [pos[0] + 7, 6, pos[2] - 3.6], size: [0.6, 2.6, 0.6], color: [180, 120, 60], material: 'metal' }));

  for (let i = 0; i < 3; i++) {
    parts.push(part({
      name: `Kiste_${i + 1}`,
      pos: [pos[0] - 9 + i * 3, 2.2 + (i % 2) * 2.4, pos[2] + 7],
      size: [2.8, 2.8, 2.8],
      color: [150, 108, 66],
      material: 'wood',
      rotY: i * 12,
    }));
  }

  parts.push(part({ name: 'Werkbank_Licht', pos: [pos[0], 9, pos[2]], size: [1, 1, 1], color: palette.accent2, material: 'neon', children: [pointLight('CraftLicht', palette.accent2, 2, 22)] }));

  return model('Werkbank', parts);
}

/** Gildenbrett mit Aushang, Fahnen und Sitzbank. */
export function buildGuildBoard(pos, palette) {
  const parts = [];
  parts.push(part({ name: 'Gilden_Brett', pos: [pos[0], 7, pos[2]], size: [18, 10, 0.8], color: [72, 54, 44], material: 'wood', children: [prompt('Gilde', 'Gilde öffnen')] }));
  parts.push(part({ name: 'Gilden_Rahmen', pos: [pos[0], 7, pos[2] - 0.6], size: [20, 12, 0.5], color: palette.accent, material: 'neon' }));
  for (const dx of [-8, 8]) {
    parts.push(part({ name: 'Gilden_Pfosten', pos: [pos[0] + dx, 4, pos[2]], size: [1.2, 10, 1.2], color: [84, 62, 48], material: 'wood' }));
  }
  parts.push(part({ name: 'Gilden_Fahne_L', pos: [pos[0] - 11, 12, pos[2]], size: [3, 6, 0.4], color: palette.accent2, material: 'fabric', canCollide: false }));
  parts.push(part({ name: 'Gilden_Fahne_R', pos: [pos[0] + 11, 12, pos[2]], size: [3, 6, 0.4], color: palette.accent, material: 'fabric', canCollide: false }));
  parts.push(part({ name: 'Gilden_Bank', pos: [pos[0], 2.4, pos[2] + 6], size: [14, 1, 3], color: [110, 78, 52], material: 'wood' }));
  return model('Gildenbrett', parts);
}

/** Season-Pass-Brett mit Stufenanzeige. */
export function buildSeasonBoard(pos, palette) {
  const parts = [];
  parts.push(part({ name: 'Season_Saeule', pos: [pos[0], 5, pos[2]], size: [10, 10, 1.4], color: [48, 44, 78], material: 'metal', children: [prompt('Season-Pass', 'Season-Pass')] }));
  parts.push(part({ name: 'Season_Krone', pos: [pos[0], 12, pos[2]], size: [10, 3, 1.4], color: palette.accent, material: 'neon' }));
  for (let i = 0; i < 5; i++) {
    parts.push(part({
      name: `Season_Stern_${i + 1}`,
      pos: [pos[0] - 4 + i * 2, 5.6 + (i % 2) * 3, pos[2] - 0.9],
      size: [1, 1, 0.5],
      color: [255, 236, 160],
      material: 'neon',
      canCollide: false,
    }));
  }
  parts.push(part({ name: 'Season_Licht', pos: [pos[0], 14, pos[2]], size: [1, 1, 1], color: palette.accent, material: 'neon', children: [pointLight('SeasonLicht', palette.accent, 2.5, 30)] }));
  return model('SeasonPassBrett', parts);
}

/** Sprechender NPC mit Hut und Gesprächs-Prompt. */
export function buildDialogNpc(pos, palette, name, index) {
  const shirt = index % 2 === 0 ? palette.accent : palette.accent2;
  return model(`DialogNpc_${index}`, [
    part({ name: 'Koerper', pos: [pos[0], 3, pos[2]], size: [3, 5, 2], color: shirt, material: 'fabric', children: [prompt('Gespräch', 'Reden', 0.3, 14)] }),
    part({ name: 'Kopf', pos: [pos[0], 6.4, pos[2]], size: [2.4, 2.4, 2.4], color: [236, 200, 170], material: 'plastic', shape: 'ball' }),
    part({ name: 'Hut', pos: [pos[0], 7.9, pos[2]], size: [2.8, 0.8, 2.8], color: [52, 44, 64], material: 'fabric' }),
    part({ name: 'Hut_Krempe', pos: [pos[0], 7.4, pos[2]], size: [3.6, 0.3, 3.6], color: [40, 34, 50], material: 'fabric', shape: 'cylinder' }),
    part({ name: 'Arme', pos: [pos[0], 3.4, pos[2] - 1.4], size: [4.4, 1, 1], color: shirt, material: 'fabric' }),
  ], { pos: [0, 0, 0] });
}

/** Pavillon als Treffpunkt (mehr Deko-Vielfalt). */
export function buildGazebo(pos, palette) {
  const parts = [];
  parts.push(part({ name: 'Pavillon_Boden', pos: [pos[0], 1.8, pos[2]], size: [20, 0.8, 20], color: [206, 196, 176], material: 'marble', shape: 'cylinder' }));
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    parts.push(part({
      name: `Pavillon_Saeule_${i + 1}`,
      pos: [pos[0] + Math.cos(angle) * 8, 5, pos[2] + Math.sin(angle) * 8],
      size: [1.2, 8, 1.2],
      color: [226, 220, 206],
      material: 'marble',
      shape: 'cylinder',
    }));
  }
  parts.push(part({ name: 'Pavillon_Dach', pos: [pos[0], 9.6, pos[2]], size: [22, 1.4, 22], color: palette.accent, material: 'slate', shape: 'cylinder' }));
  parts.push(part({ name: 'Pavillon_Spitze', pos: [pos[0], 11.6, pos[2]], size: [1.4, 2.6, 1.4], color: palette.accent2, material: 'neon', shape: 'ball' }));
  return model('Pavillon', parts);
}

/** Laternen-Reihe für Wege (mehr Atmosphäre). */
export function buildLanternRow(start, dir, count, palette) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const x = start[0] + dir[0] * i * 12;
    const z = start[2] + dir[1] * i * 12;
    parts.push(part({ name: `Laterne_${i + 1}`, pos: [x, 2.4, z], size: [0.8, 5, 0.8], color: [58, 54, 70], material: 'metal' }));
    parts.push(part({
      name: `Laterne_Licht_${i + 1}`,
      pos: [x, 5.4, z],
      size: [1.4, 1.4, 1.4],
      color: [255, 222, 150],
      material: 'neon',
      canCollide: false,
      children: [pointLight('Licht', [255, 222, 150], 1.4, 18)],
    }));
  }
  return parts;
}

/** Baut alle Feature-Objekte passend zur Kartengröße. */
export function buildFeatureWorld(spec, palette, half, rng, zoneCenters = []) {
  const nodes = [];
  const r = Math.max(70, Math.min(half * 0.62, 260));

  nodes.push(buildFishingArea([r, 0, -r * 0.55], palette, rng));
  nodes.push(buildCraftingBench([-r, 0, -r * 0.5], palette));
  nodes.push(buildGuildBoard([r * 0.7, 0, r * 0.62], palette));
  nodes.push(buildSeasonBoard([-r * 0.78, 0, r * 0.58], palette));
  nodes.push(buildGazebo([0, 0, -r * 0.9], palette));

  nodes.push(...buildLanternRow([-16, 0, 34], [1, 0], 4, palette));
  nodes.push(...buildLanternRow([-16, 0, -34], [1, 0], 4, palette));

  const npcCount = 3;
  for (let i = 0; i < npcCount; i++) {
    const angle = (i / npcCount) * Math.PI * 2 + 0.4;
    const radius = 30 + i * 6;
    const center = zoneCenters[i % Math.max(1, zoneCenters.length)] || [0, 0];
    nodes.push(buildDialogNpc(
      [center[0] + Math.cos(angle) * radius, 0, center[1] + Math.sin(angle) * radius],
      palette,
      `Bewohner ${i + 1}`,
      i + 1,
    ));
  }

  return nodes;
}
