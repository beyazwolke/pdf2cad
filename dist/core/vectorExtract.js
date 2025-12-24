import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

export async function extractVectorFromPage(pdfData, pageIndex, {
  scale = 1.0,
  curveSteps = 12,
  layerPolicy = "width"
} = {}) {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(pageIndex);

  const viewport = page.getViewport({ scale });
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;

  const baseT = viewport.transform;

  const tStack = [];
  let currentT = identity();

  const gStack = [];
  let gs = { lineWidth: 1.0, strokeRGB: { r: 0, g: 0, b: 0 } };

  const lines = [];
  const polylines = [];

  let currentPath = [];
  let last = null;

  const applyPoint = (x, y) => {
    const p1 = applyMatrix(currentT, x, y);
    return applyMatrix(baseT, p1.x, p1.y);
  };

  const currentLayer = () => layerFromState(gs, layerPolicy);

  const flush = (force) => {
    if ((force || currentPath.length > 1) && currentPath.length > 1) {
      const pl = currentPath.map(p => ({ x: p.x, y: p.y }));
      pl.layer = currentLayer();
      polylines.push(pl);
    }
    currentPath = [];
    last = null;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.save) {
      tStack.push(cloneMatrix(currentT));
      gStack.push({ ...gs, strokeRGB: { ...gs.strokeRGB } });
      continue;
    }
    if (fn === OPS.restore) {
      currentT = tStack.length ? tStack.pop() : identity();
      gs = gStack.length ? gStack.pop() : { lineWidth: 1.0, strokeRGB: { r: 0, g: 0, b: 0 } };
      continue;
    }

    if (fn === OPS.transform) {
      const m = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
      currentT = multiplyMatrix(currentT, m);
      continue;
    }

    if (fn === OPS.setLineWidth) {
      gs.lineWidth = Number(args[0]) || gs.lineWidth;
      continue;
    }
    if (fn === OPS.setStrokeRGBColor) {
      gs.strokeRGB = { r: clamp255(args[0] * 255), g: clamp255(args[1] * 255), b: clamp255(args[2] * 255) };
      continue;
    }
    if (fn === OPS.setStrokeGray) {
      const v = clamp255(args[0] * 255);
      gs.strokeRGB = { r: v, g: v, b: v };
      continue;
    }
    if (fn === OPS.setStrokeCMYKColor) {
      const [c, m, y, k] = args.map(Number);
      gs.strokeRGB = cmykToRgb(c, m, y, k);
      continue;
    }

    if (fn === OPS.moveTo) {
      flush(false);
      const p = applyPoint(args[0], args[1]);
      currentPath = [p];
      last = p;
      continue;
    }

    if (fn === OPS.lineTo) {
      const p = applyPoint(args[0], args[1]);
      if (last) {
        lines.push({ x1: last.x, y1: last.y, x2: p.x, y2: p.y, layer: currentLayer() });
        currentPath.push(p);
      } else {
        currentPath = [p];
      }
      last = p;
      continue;
    }

    if (fn === OPS.curveTo) {
      const [x1, y1, x2, y2, x3, y3] = args;
      const c1 = applyPoint(x1, y1);
      const c2 = applyPoint(x2, y2);
      const p3 = applyPoint(x3, y3);
      if (!last) {
        last = p3;
        currentPath = [p3];
        continue;
      }
      const segs = approximateCubicBezier(last, c1, c2, p3, curveSteps);
      for (const s of segs) {
        lines.push({ ...s, layer: currentLayer() });
        currentPath.push({ x: s.x2, y: s.y2 });
      }
      last = p3;
      continue;
    }

    if (fn === OPS.closePath || fn === OPS.stroke || fn === OPS.fill || fn === OPS.eoFill) {
      flush(true);
      continue;
    }
  }

  flush(true);

  return { lines, polylines, viewport: { width: viewport.width, height: viewport.height } };
}

function layerFromState(gs, policy) {
  const w = (gs.lineWidth ?? 1.0);
  const ww = roundTo(w, 0.05);
  const { r, g, b } = gs.strokeRGB ?? { r: 0, g: 0, b: 0 };

  if (policy === "single") return "0";
  if (policy === "width") return `L_W${ww.toFixed(2)}`;
  if (policy === "color") return `L_RGB_${pad3(r)}_${pad3(g)}_${pad3(b)}`;
  return `L_RGB_${pad3(r)}_${pad3(g)}_${pad3(b)}_W${ww.toFixed(2)}`;
}
function roundTo(v, step) { return Math.round(v / step) * step; }
function pad3(n) { return String(Math.max(0, Math.min(255, Math.round(n)))).padStart(3, "0"); }
function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function clamp01(v){ return Math.max(0, Math.min(1, Number(v) || 0)); }
function cmykToRgb(c, m, y, k) {
  const cc = clamp01(c), mm = clamp01(m), yy = clamp01(y), kk = clamp01(k);
  return { r: clamp255(255 * (1 - cc) * (1 - kk)), g: clamp255(255 * (1 - mm) * (1 - kk)), b: clamp255(255 * (1 - yy) * (1 - kk)) };
}

function identity() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
function cloneMatrix(m) { return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f }; }
function multiplyMatrix(m1, m2) {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f
  };
}
function applyMatrix(m, x, y) { return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }

function approximateCubicBezier(p0, p1, p2, p3, steps = 12) {
  const segs = [];
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = cubic(p0, p1, p2, p3, t);
    segs.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y });
    prev = p;
  }
  return segs;
}
function cubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}
