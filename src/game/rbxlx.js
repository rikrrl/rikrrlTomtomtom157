/**
 * Serialisierer für Roblox-Studio-Ortsdateien (.rbxlx).
 *
 * Ein Projekt wird intern als Instanzbaum gehalten:
 *   { className, name, props: { <serialisierterName>: { t: <typ>, v: <wert> } }, children: [] }
 * und hier in das von Roblox Studio gelesene XML-Format geschrieben.
 */

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE[ch]);
}

function num(n) {
  if (!Number.isFinite(n)) return '0';
  const round = Math.round(n * 1e6) / 1e6;
  return Object.is(round, -0) ? '0' : String(round);
}

function vector3(v) {
  return `<X>${num(v[0])}</X><Y>${num(v[1])}</Y><Z>${num(v[2])}</Z>`;
}

function coordinateFrame(v) {
  const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = v;
  return [
    `<X>${num(x)}</X>`, `<Y>${num(y)}</Y>`, `<Z>${num(z)}</Z>`,
    `<R00>${num(r00)}</R00>`, `<R01>${num(r01)}</R01>`, `<R02>${num(r02)}</R02>`,
    `<R10>${num(r10)}</R10>`, `<R11>${num(r11)}</R11>`, `<R12>${num(r12)}</R12>`,
    `<R20>${num(r20)}</R20>`, `<R21>${num(r21)}</R21>`, `<R22>${num(r22)}</R22>`,
  ].join('');
}

function udim2(v) {
  return `<XS>${num(v[0])}</XS><XO>${num(v[1])}</XO><YS>${num(v[2])}</YS><YO>${num(v[3])}</YO>`;
}

/** Typ-Registry: serialisierter Eigenschaftsname -> XML-Darstellung. */
const PROP_SERIALIZERS = {
  string: (name, v) => `<string name="${name}">${escapeXml(v)}</string>`,
  bool: (name, v) => `<bool name="${name}">${v ? 'true' : 'false'}</bool>`,
  int: (name, v) => `<int name="${name}">${Math.round(v)}</int>`,
  int64: (name, v) => `<int64 name="${name}">${Math.round(v)}</int64>`,
  float: (name, v) => `<float name="${name}">${num(v)}</float>`,
  double: (name, v) => `<double name="${name}">${num(v)}</double>`,
  token: (name, v) => `<token name="${name}">${Math.round(v)}</token>`,
  Vector3: (name, v) => `<Vector3 name="${name}">${vector3(v)}</Vector3>`,
  CFrame: (name, v) => `<CoordinateFrame name="${name}">${coordinateFrame(v)}</CoordinateFrame>`,
  Color3uint8: (name, v) => `<Color3uint8 name="${name}">${v.map((c) => Math.max(0, Math.min(255, Math.round(c)))).join(' ')}</Color3uint8>`,
  Color3: (name, v) => `<Color3 name="${name}"><R>${num(v[0])}</R><G>${num(v[1])}</G><B>${num(v[2])}</B></Color3>`,
  UDim2: (name, v) => `<UDim2 name="${name}">${udim2(v)}</UDim2>`,
  ProtectedString: (name, v) => `<ProtectedString name="${name}">${escapeXml(v)}</ProtectedString>`,
  Content: (name, v) => `<Content name="${name}"><url>${escapeXml(v)}</url></Content>`,
  stringArray: (name, v) => `<string-array name="${name}">${v.map((s) => `<string>${escapeXml(s)}</string>`).join('')}</string-array>`,
};

export const KNOWN_PROP_TYPES = Object.keys(PROP_SERIALIZERS);

let referentCounter = 0;

function writeItem(node, depth, out) {
  const pad = '\t'.repeat(depth);
  const referent = `RBX${referentCounter++}`;
  out.push(`${pad}<Item class="${node.className}" referent="${referent}">`);
  out.push(`${pad}\t<Properties>`);

  const props = node.props || {};
  const names = Object.keys(props);
  if (node.name !== undefined && !names.includes('Name')) {
    out.push(`${pad}\t\t<string name="Name">${escapeXml(node.name || node.className)}</string>`);
  }
  for (const name of names) {
    const prop = props[name];
    if (!prop) continue;
    const serialiser = PROP_SERIALIZERS[prop.t];
    if (!serialiser) continue; // unbekannte Typen werden ausgelassen (Studio ignoriert sie ebenfalls)
    out.push(`${pad}\t\t${serialiser(name, prop.v)}`);
  }
  out.push(`${pad}\t</Properties>`);

  for (const child of node.children || []) writeItem(child, depth + 1, out);
  out.push(`${pad}</Item>`);
}

/**
 * Erzeugt das komplette XML einer Ortsdatei.
 * @paras {InstanceNode[]} services  Wurzelinstanzen (Services)
 */
export function serializeRbxlx(services) {
  referentCounter = 0;
  const out = [];
  out.push('<?xml version="1.0" encoding="utf-8"?>');
  out.push(
    '<roblox xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
  );
  out.push('\t<External>null</External>');
  out.push('\t<External>nil</External>');
  for (const service of services) writeItem(service, 1, out);
  out.push('</roblox>');
  return out.join('\n') + '\n';
}

/** Zählt Instanzen und Skripte für die Fortschritts-/Statanzeige. */
export function treeStats(tree) {
  const stats = { instances: 0, parts: 0, scripts: 0, models: 0, folders: 0, guis: 0, scriptLines: 0, classes: {} };
  const walk = (node) => {
    stats.instances++;
    const cls = node.className;
    stats.classes[cls] = (stats.classes[cls] || 0) + 1;
    if (['Part', 'WedgePart', 'TrussPart', 'SpawnLocation'].includes(cls)) stats.parts++;
    if (['Script', 'LocalScript', 'ModuleScript'].includes(cls)) {
      stats.scripts++;
      const src = node.props?.Source?.v || '';
      stats.scriptLines += String(src).split('\n').length;
    }
    if (cls === 'Model') stats.models++;
    if (cls === 'Folder') stats.folders++;
    if (['ScreenGui', 'SurfaceGui'].includes(cls)) stats.guis++;
    (node.children || []).forEach(walk);
  };
  walk(tree);
  return stats;
}
