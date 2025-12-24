const btnPick = document.getElementById("btnPick");
const btnConvert = document.getElementById("btnConvert");
const btnSave = document.getElementById("btnSave");
const pdfPathEl = document.getElementById("pdfPath");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");

const layerPolicyEl = document.getElementById("layerPolicy");
const snapEl = document.getElementById("snap");
const angEl = document.getElementById("ang");
const minlenEl = document.getElementById("minlen");

let pdfPath = null;
let last = null;

btnPick.addEventListener("click", async () => {
  pdfPath = await window.api.pickPdf();
  if (!pdfPath) return;
  pdfPathEl.textContent = pdfPath;
  btnConvert.disabled = false;
  btnSave.disabled = true;
  last = null;
  statusEl.textContent = "PDF gewählt. Bereit zur Konvertierung.";
  metaEl.textContent = "";
});

btnConvert.addEventListener("click", async () => {
  if (!pdfPath) return;

  const options = {
    layerPolicy: layerPolicyEl.value,
    merge: {
      snap: Number(snapEl.value),
      angleTolDeg: Number(angEl.value),
      minLen: Number(minlenEl.value)
    },
    circles: {
      maxRadialError: 0.8,
      minRadius: 3,
      closedDist: 2,
      minPoints: 12
    },
    text: { joinSameLine: true, asMText: false }
  };

  statusEl.textContent = "Konvertierung läuft…";
  btnSave.disabled = true;

  const res = await window.api.convert({ pdfPath, options });
  last = res;

  statusEl.textContent = "Fertig. DXF ist bereit zum Speichern.";
  metaEl.textContent = JSON.stringify(res.meta, null, 2);
  btnSave.disabled = false;
});

btnSave.addEventListener("click", async () => {
  if (!last?.dxfBase64) return;
  const saved = await window.api.saveDxf({ suggestedName: "export.dxf", dxfBase64: last.dxfBase64 });
  if (saved) statusEl.textContent = `Gespeichert: ${saved}`;
});
