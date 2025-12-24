import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

export async function analyzePdfPages(pdfData) {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = pdf.numPages;

  const pages = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const opList = await page.getOperatorList();
    const vectorScore = scoreVectorOps(opList);
    const OPS = pdfjsLib.OPS;

    const hasImages = opList.fnArray.some(fn =>
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintJpegXObject
    );

    let kind = "raster";
    if (vectorScore > 0 && hasImages) kind = "hybrid";
    else if (vectorScore > 0) kind = "vector";

    pages.push({ pageIndex: i, kind, vectorScore, hasImages });
  }
  return { numPages, pages };
}

function scoreVectorOps(opList) {
  const OPS = pdfjsLib.OPS;
  let score = 0;
  for (const fn of opList.fnArray) {
    if (
      fn === OPS.moveTo ||
      fn === OPS.lineTo ||
      fn === OPS.curveTo ||
      fn === OPS.rectangle ||
      fn === OPS.closePath ||
      fn === OPS.stroke ||
      fn === OPS.fill ||
      fn === OPS.eoFill
    ) score++;
  }
  return score;
}
