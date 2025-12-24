import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

import { convertPdfToDxf } from "./core/convert.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));
}

app.whenReady().then(createWindow);

ipcMain.handle("pick-pdf", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "PDF auswählen",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    properties: ["openFile"]
  });
  if (r.canceled || !r.filePaths?.[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle("convert", async (_evt, { pdfPath, options }) => {
  const pdf = await fs.readFile(pdfPath);
  const { dxf, meta } = await convertPdfToDxf(new Uint8Array(pdf), options || {});
  return { dxfBase64: Buffer.from(dxf, "utf8").toString("base64"), meta };
});

ipcMain.handle("save-dxf", async (_evt, { suggestedName, dxfBase64 }) => {
  const r = await dialog.showSaveDialog(win, {
    title: "DXF speichern",
    defaultPath: suggestedName || "export.dxf",
    filters: [{ name: "DXF", extensions: ["dxf"] }]
  });
  if (r.canceled || !r.filePath) return null;
  const buf = Buffer.from(dxfBase64, "base64");
  await fs.writeFile(r.filePath, buf);
  return r.filePath;
});
