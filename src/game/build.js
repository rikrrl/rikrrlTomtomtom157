/**
 * Bausteine für den Instanzbaum.
 * Jede Eigenschaft wird als { t: <xml-typ>, v: <wert> } abgelegt, damit der
 * Serialisierer nichts raten muss.
 */

export const MATERIAL = {
  plastic: 256,
  wood: 512,
  slate: 800,
  concrete: 816,
  brick: 848,
  sand: 864,
  cobblestone: 880,
  metal: 1088,
  grass: 1280,
  ice: 1536,
  neon: 288,
  glass: 1568,
  water: 2048,
  fabric: 1312,
  marble: 784,
  granite: 832,
};

export const SHAPE = { ball: 0, block: 1, cylinder: 2, wedge: 3, cornerWedge: 4 };

export function inst(className, name, props = {}, children = []) {
  return { className, name, props, children };
}

const rad = (deg) => (deg * Math.PI) / 180;

/** Rotation nur um die Y-Achse (reicht für Gebäude, Dekoration und Wege). */
export function cf(pos = [0, 0, 0], rotY = 0) {
  const c = Math.cos(rad(rotY));
  const s = Math.sin(rad(rotY));
  return [pos[0], pos[1], pos[2], c, 0, s, 0, 1, 0, -s, 0, c];
}

export function part({
  name = 'Part',
  pos = [0, 0, 0],
  size = [4, 1, 2],
  color = [120, 120, 130],
  material = 'plastic',
  shape = 'block',
  rotY = 0,
  anchored = true,
  canCollide = true,
  transparency = 0,
  className = 'Part',
  children = [],
  reflectance,
} = {}) {
  const props = {
    size: { t: 'Vector3', v: size },
    CFrame: { t: 'CFrame', v: cf(pos, rotY) },
    Color3uint8: { t: 'Color3uint8', v: color },
    Anchored: { t: 'bool', v: anchored },
    CanCollide: { t: 'bool', v: canCollide },
    Transparency: { t: 'float', v: transparency },
    Material: { t: 'token', v: MATERIAL[material] ?? MATERIAL.plastic },
    shape: { t: 'token', v: SHAPE[shape] ?? SHAPE.block },
  };
  if (reflectance !== undefined) props.Reflectance = { t: 'float', v: reflectance };
  return inst(className, name, props, children);
}

export function spawnLocation(name = 'SpawnLocation', pos = [0, 4, 0], size = [12, 1, 12], color = [90, 80, 200]) {
  return inst('SpawnLocation', name, {
    size: { t: 'Vector3', v: size },
    CFrame: { t: 'CFrame', v: cf(pos, 0) },
    Color3uint8: { t: 'Color3uint8', v: color },
    Anchored: { t: 'bool', v: true },
    CanCollide: { t: 'bool', v: true },
    Neutral: { t: 'bool', v: true },
    Transparency: { t: 'float', v: 0 },
    Material: { t: 'token', v: MATERIAL.neon },
    shape: { t: 'token', v: SHAPE.block },
  });
}

export function folder(name, children = []) {
  return inst('Folder', name, {}, children);
}

export function model(name, children = [], primary = null) {
  return inst('Model', name, {}, children);
}

export function scriptNode(name, source, className = 'Script') {
  return inst(className, name, { Source: { t: 'ProtectedString', v: source } });
}

export const serverScript = (name, source) => scriptNode(name, source, 'Script');
export const localScript = (name, source) => scriptNode(name, source, 'LocalScript');
export const moduleScript = (name, source) => scriptNode(name, source, 'ModuleScript');

export function pointLight(name = 'Light', color = [255, 220, 160], brightness = 2, range = 24) {
  return inst('PointLight', name, {
    Color: { t: 'Color3', v: color.map((c) => c / 255) },
    Brightness: { t: 'float', v: brightness },
    Range: { t: 'float', v: range },
    Shadows: { t: 'bool', v: true },
  });
}

export function surfaceSign(name, pos, size, color) {
  return part({ name, pos, size, color, material: 'neon', transparency: 0.15 });
}

/** Zählt alle Instanzen eines Klassennamens. */
export function countClass(node, className) {
  let n = node.className === className ? 1 : 0;
  for (const child of node.children || []) n += countClass(child, className);
  return n;
}

/** Sucht die erste Instanz mit Klassennamen (Tiefensuche). */
export function findClass(node, className) {
  if (node.className === className) return node;
  for (const child of node.children || []) {
    const hit = findClass(child, className);
    if (hit) return hit;
  }
  return null;
}
