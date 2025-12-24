export function cleanupAndMergeLinesByLayer(lines, opts = {}) {
  const groups = new Map();
  for (const l of lines ?? []) {
    const layer = l.layer || "0";
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer).push(l);
  }
  const out = { polylines: [], lines: [] };
  for (const [layer, ls] of groups) {
    const merged = cleanupAndMergeLines(ls, opts);
    for (const pl of merged.polylines ?? []) { pl.layer = layer; out.polylines.push(pl); }
  }
  return out;
}

export function cleanupAndMergeLines(lines, { snap = 0.25, angleTolDeg = 2.0, minLen = 0.05 } = {}) {
  const angleTol = (Math.PI / 180) * angleTolDeg;

  const snapped = [];
  for (const l of lines ?? []) {
    const a = snapPoint({ x: l.x1, y: l.y1 }, snap);
    const b = snapPoint({ x: l.x2, y: l.y2 }, snap);
    if (dist2(a, b) < minLen * minLen) continue;
    snapped.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  const dedup = dedupeUndirected(snapped);

  const nodes = new Map();
  const edges = [];
  const addNode = (p) => {
    const k = keyOf(p);
    if (!nodes.has(k)) nodes.set(k, { x: p.x, y: p.y, edges: new Set() });
    return k;
  };

  for (const l of dedup) {
    const a = { x: l.x1, y: l.y1 };
    const b = { x: l.x2, y: l.y2 };
    const aKey = addNode(a);
    const bKey = addNode(b);
    const id = edges.length;
    edges.push({ aKey, bKey });
    nodes.get(aKey).edges.add(id);
    nodes.get(bKey).edges.add(id);
  }

  const used = new Array(edges.length).fill(false);
  const polylines = [];

  const edgeVecFrom = (edge, fromKey) => {
    const a = nodes.get(edge.aKey);
    const b = nodes.get(edge.bKey);
    if (fromKey === edge.aKey) return { x: b.x - a.x, y: b.y - a.y };
    return { x: a.x - b.x, y: a.y - b.y };
  };

  let startKeys = [];
  for (const [k, n] of nodes) if (n.edges.size !== 2) startKeys.push(k);
  if (startKeys.length === 0) startKeys = [...nodes.keys()];

  for (const startKey of startKeys) {
    const n = nodes.get(startKey);
    for (const eid of n.edges) {
      if (used[eid]) continue;

      const poly = [];
      let curKey = startKey;
      let curEid = eid;
      poly.push({ x: nodes.get(curKey).x, y: nodes.get(curKey).y });

      while (true) {
        used[curEid] = true;
        const e = edges[curEid];
        const nextKey = (curKey === e.aKey) ? e.bKey : e.aKey;
        poly.push({ x: nodes.get(nextKey).x, y: nodes.get(nextKey).y });

        const nextNode = nodes.get(nextKey);
        const candidates = [...nextNode.edges].filter(x => !used[x]);
        if (candidates.length === 0) break;

        if (candidates.length === 1) { curKey = nextKey; curEid = candidates[0]; continue; }

        const vPrev = edgeVecFrom(e, nextKey);
        let best = null, bestScore = -1;

        for (const candId of candidates) {
          const ce = edges[candId];
          const vCand = edgeVecFrom(ce, nextKey);
          const score = collinearScore(vPrev, vCand);
          if (score > bestScore) { bestScore = score; best = candId; }
        }

        if (bestScore < Math.cos(angleTol)) break;
        curKey = nextKey;
        curEid = best;
      }

      if (poly.length >= 2) polylines.push(poly);
    }
  }

  return { lines: [], polylines };
}

function snapPoint(p, snap) { if (!snap || snap <= 0) return p; return { x: Math.round(p.x / snap) * snap, y: Math.round(p.y / snap) * snap }; }
function keyOf(p) { return `${p.x.toFixed(6)},${p.y.toFixed(6)}`; }
function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function dedupeUndirected(lines) {
  const map = new Map();
  for (const l of lines) {
    const ka = keyOf({ x: l.x1, y: l.y1 });
    const kb = keyOf({ x: l.x2, y: l.y2 });
    const key = (ka < kb) ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!map.has(key)) map.set(key, l);
  }
  return [...map.values()];
}
function norm(v) { const len = Math.hypot(v.x, v.y); if (len === 0) return { x: 0, y: 0 }; return { x: v.x / len, y: v.y / len }; }
function collinearScore(v1, v2) { const a = norm(v1), b = norm(v2); return Math.abs(a.x * b.x + a.y * b.y); }
