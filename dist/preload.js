import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  pickPdf: () => ipcRenderer.invoke("pick-pdf"),
  convert: (payload) => ipcRenderer.invoke("convert", payload),
  saveDxf: (payload) => ipcRenderer.invoke("save-dxf", payload)
});
