export function toDxfWithLayers(geom, { defaultLayer = "0", textAsMText = false } = {}) {
  const layers = collectLayers(geom, defaultLayer);
  const header = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
`;
  const tables = `0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
${layers.length}
${layers.map(layerTableRecord).join("")}0
ENDTAB
0
ENDSEC
`;
  const entitiesHeader = `0
SECTION
2
ENTITIES
`;
  const entities = [];
  for (const pl of geom.polylines ?? []) entities.push(lwPolylineEntity(pl, pl.layer ?? defaultLayer));
  for (const l of geom.lines ?? []) entities.push(lineEntity(l, l.layer ?? defaultLayer));
  for (const c of geom.circles ?? []) entities.push(circleEntity(c, c.layer ?? defaultLayer));
  for (const a of geom.arcs ?? []) entities.push(arcEntity(a, a.layer ?? defaultLayer));
  for (const t of geom.texts ?? []) {
    const layer = t.layer ?? "TEXT";
    const content = sanitizeDxfText(t.text ?? "");
    if (!content) continue;
    const needsMText = textAsMText || content.includes("\\P") || content.length > 80 || content.includes("\n");
    entities.push(needsMText ? mtextEntity(t, layer) : textEntity(t, layer));
  }
  const footer = `0
ENDSEC
0
EOF
`;
  return header + tables + entitiesHeader + entities.join("") + footer;
}
function collectLayers(geom, defaultLayer) {
  const s = new Set([defaultLayer, "TEXT"]);
  for (const pl of geom.polylines ?? []) s.add(pl.layer ?? defaultLayer);
  for (const l of geom.lines ?? []) s.add(l.layer ?? defaultLayer);
  for (const c of geom.circles ?? []) s.add(c.layer ?? defaultLayer);
  for (const a of geom.arcs ?? []) s.add(a.layer ?? defaultLayer);
  for (const t of geom.texts ?? []) s.add(t.layer ?? "TEXT");
  return [...s].filter(Boolean).map(shortLayerName);
}
function layerTableRecord(name) { return `0
LAYER
2
${name}
70
0
62
7
6
CONTINUOUS
`; }
function shortLayerName(name) { return name.length <= 64 ? name : name.slice(0, 64); }
function lwPolylineEntity(points, layer) {
  const ly = shortLayerName(layer);
  let s = `0
LWPOLYLINE
8
${ly}
90
${points.length}
70
0
`;
  for (const p of points) s += `10
${num(p.x)}
20
${num(p.y)}
`;
  return s;
}
function lineEntity({ x1, y1, x2, y2 }, layer) {
  const ly = shortLayerName(layer);
  return `0
LINE
8
${ly}
10
${num(x1)}
20
${num(y1)}
11
${num(x2)}
21
${num(y2)}
`;
}
function circleEntity(c, layer) {
  const ly = shortLayerName(layer);
  return `0
CIRCLE
8
${ly}
10
${num(c.cx)}
20
${num(c.cy)}
40
${num(c.r)}
`;
}
function arcEntity(a, layer) {
  const ly = shortLayerName(layer);
  let start = a.startDeg, end = a.endDeg;
  if (a.ccw === false) { const tmp = start; start = end; end = tmp; }
  return `0
ARC
8
${ly}
10
${num(a.cx)}
20
${num(a.cy)}
40
${num(a.r)}
50
${num(start)}
51
${num(end)}
`;
}
function textEntity(t, layer) {
  const ly = shortLayerName(layer);
  const h = Math.max(1, t.fontSize || 10);
  const rot = t.angleDeg || 0;
  const content = sanitizeDxfText(t.text ?? "");
  return `0
TEXT
8
${ly}
10
${num(t.x)}
20
${num(t.y)}
40
${num(h)}
1
${content}
50
${num(rot)}
7
STANDARD
`;
}
function mtextEntity(t, layer) {
  const ly = shortLayerName(layer);
  const h = Math.max(1, t.fontSize || 10);
  const rot = t.angleDeg || 0;
  const content = sanitizeDxfText(t.text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\\P");
  return `0
MTEXT
8
${ly}
10
${num(t.x)}
20
${num(t.y)}
40
${num(h)}
1
${content}
50
${num(rot)}
7
STANDARD
`;
}
function sanitizeDxfText(s) {
  const x = String(s).trim();
  if (!x) return "";
  return x.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}
function num(x) { return (typeof x === "number" && Number.isFinite(x)) ? x.toFixed(3) : "0"; }
