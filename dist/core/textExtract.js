import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

export async function extractTextFromPage(pdfData, pageIndex, { scale = 1.0, joinSameLine = true } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(pageIndex);
  const viewport = page.getViewport({ scale });

  const tc = await page.getTextContent({ includeMarkedContent: false, disableCombineTextItems: false });

  const items = [];
  for (const it of tc.items ?? []) {
    const str = (it.str ?? "").trim();
    if (!str) continue;

    const m = it.transform; // [a,b,c,d,e,f]
    const angleDeg = Math.atan2(m[1], m[0]) * (180 / Math.PI);
    const p = applyMatrix(viewport.transform, m[4], m[5]);
    const fontSize = Math.max(Math.abs(m[0]), Math.abs(m[3])) * scale;

    const fs = roundTo(fontSize, 0.5);
    const rot = roundTo(normalizeAngle(angleDeg), 5);

    items.push({
      text: str,
      x: p.x,
      y: p.y,
      angleDeg: normalizeAngle(angleDeg),
      fontSize: clamp(fontSize, 1, 200),
      layer: `TEXT_FS${fs.toFixed(1)}_R${rot.toFixed(0)}`
    });
  }

  const out = joinSameLine ? mergeNearbyText(items) : items;
  return { texts: out, viewport: { width: viewport.width, height: viewport.height } };
}

function applyMatrix(m, x, y) {
  const [a, b, c, d, e, f] = m;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}
function normalizeAngle(a) {
  let x = a;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function roundTo(v, step) { return Math.round(v / step) * step; }

function mergeNearbyText(texts) {
  const tolY = 2.0, tolAngle = 2.0, tolGap = 6.0;
  const sorted = [...texts].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const merged = [];
  let cur = null;

  for (const t of sorted) {
    if (!cur) { cur = { ...t }; continue; }
    const sameAngle = Math.abs(cur.angleDeg - t.angleDeg) <= tolAngle;
    const sameLine = Math.abs(cur.y - t.y) <= tolY;
    const gap = t.x - (cur.x + estimateTextWidth(cur));

    if (sameAngle && sameLine && gap >= -1 && gap <= tolGap) {
      cur.text = (cur.text + " " + t.text).replace(/\s+/g, " ").trim();
      cur.fontSize = Math.max(cur.fontSize, t.fontSize);
    } else {
      merged.push(cur);
      cur = { ...t };
    }
  }
  if (cur) merged.push(cur);
  return merged;
}
function estimateTextWidth(t) { return (t.text?.length ?? 0) * ((t.fontSize || 10) * 0.55); }
