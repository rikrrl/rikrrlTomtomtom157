/**
 * Wandelt den internen Instanzbaum in einen "Build Plan" für das Roblox-Studio-Plugin.
 * Das Plugin legt damit echte Instanzen an (Instance.new) – inklusive Luau-Quellcode.
 */

const MATERIAL_NAMES = {
  256: 'Plastic', 512: 'Wood', 800: 'Slate', 816: 'Concrete', 848: 'Brick', 864: 'Sand',
  880: 'Cobblestone', 1088: 'Metal', 1280: 'Grass', 1536: 'Ice', 288: 'Neon', 1568: 'Glass',
  2048: 'Water', 1312: 'Fabric', 784: 'Marble', 832: 'Granite',
};

const SHAPE_NAMES = { 0: 'Ball', 1: 'Block', 2: 'Cylinder', 3: 'Wedge', 4: 'CornerWedge' };

function planNode(node) {
  const out = { c: node.className, n: node.name || node.className, p: {}, k: [] };
  const props = node.props || {};

  if (props.size) out.p.size = props.size.v;
  if (props.CFrame) out.p.cframe = props.CFrame.v;
  if (props.Color3uint8) out.p.color = props.Color3uint8.v;
  if (props.Color) out.p.colorFloat = props.Color.v;
  if (props.Anchored) out.p.anchored = props.Anchored.v;
  if (props.CanCollide) out.p.canCollide = props.CanCollide.v;
  if (props.Transparency) out.p.transparency = props.Transparency.v;
  if (props.Material) out.p.material = MATERIAL_NAMES[props.Material.v] || 'Plastic';
  if (props.shape) out.p.shape = SHAPE_NAMES[props.shape.v] || 'Block';
  if (props.Source) out.p.source = props.Source.v;
  if (props.Neutral) out.p.neutral = props.Neutral.v;
  if (props.Brightness) out.p.brightness = props.Brightness.v;
  if (props.Range) out.p.range = props.Range.v;
  if (props.ActionText) out.p.actionText = props.ActionText.v;
  if (props.ObjectText) out.p.objectText = props.ObjectText.v;
  if (props.HoldDuration) out.p.holdDuration = props.HoldDuration.v;
  if (props.MaxActivationDistance) out.p.maxActivationDistance = props.MaxActivationDistance.v;
  if (props.RequiresLineOfSight) out.p.requiresLineOfSight = props.RequiresLineOfSight.v;

  out.k = (node.children || []).map(planNode);
  return out;
}

/** Erzeugt den Plan für ein Projekt (ohne die großen Service-Container). */
export function buildPlan(services) {
  const roots = services
    .filter((s) => ['Workspace', 'ReplicatedStorage', 'ServerScriptService', 'StarterPlayer'].includes(s.className))
    .map(planNode);
  return { roots, generatedAt: new Date().toISOString() };
}

/** Flache Skriptliste für die Anzeige im Web-UI. */
export function listScripts(node, path = '') {
  const result = [];
  const current = path ? `${path}/${node.name || node.className}` : node.name || node.className;
  if (['Script', 'LocalScript', 'ModuleScript'].includes(node.className)) {
    result.push({
      name: node.name,
      className: node.className,
      path: current,
      lines: String(node.props?.Source?.v || '').split('\n').length,
    });
  }
  for (const child of node.children || []) result.push(...listScripts(child, current));
  return result;
}
