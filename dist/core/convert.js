import { analyzePdfPages } from "./detect.js";
import { extractVectorFromPage } from "./vectorExtract.js";
import { extractTextFromPage } from "./textExtract.js";
import { cleanupAndMergeLinesByLayer } from "./merge.js";
import { detectCirclesAndArcs } from "./circleArcDetect.js";
import { toDxfWithLayers } from "./dxfWriter.js";

export async function convertPdfToDxf(pdfData, options = {}) {
  const analysis = await analyzePdfPages(pdfData);

  const layerPolicy = options.layerPolicy || "width";
  const merge = options.merge || { snap: 0.25, angleTolDeg: 2, minLen: 0.05 };
  const circles = options.circles || { maxRadialError: 0.8, minRadius: 3, closedDist: 2, minPoints: 12 };
  const textOpt = options.text || { joinSameLine: true, asMText: false };

  const all = { polylines: [], lines: [], circles: [], arcs: [], texts: [] };

  for (const p of analysis.pages) {
    if (p.kind === "raster") continue; // portable build focuses on vector PDFs

    const geom = await extractVectorFromPage(pdfData, p.pageIndex, { scale: 1.0, curveSteps: 12, layerPolicy });
    const merged = cleanupAndMergeLinesByLayer(geom.lines ?? [], merge);
    const cad = detectCirclesAndArcs(merged.polylines ?? [], circles);

    all.polylines.push(...(cad.remainingPolylines ?? []));
    all.circles.push(...(cad.circles ?? []));
    all.arcs.push(...(cad.arcs ?? []));

    const txt = await extractTextFromPage(pdfData, p.pageIndex, { scale: 1.0, joinSameLine: !!textOpt.joinSameLine });
    all.texts.push(...(txt.texts ?? []));
  }

  const dxf = toDxfWithLayers(all, { defaultLayer: "0", textAsMText: !!textOpt.asMText });

  return {
    dxf,
    meta: {
      pages: analysis.pages,
      extracted: {
        polylines: all.polylines.length,
        circles: all.circles.length,
        arcs: all.arcs.length,
        texts: all.texts.length
      },
      note: "Portable-Version: Raster/Scan-PDFs werden übersprungen. Für AutoCAD-Plot-PDFs (Vektor) optimiert."
    }
  };
}
