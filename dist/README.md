# PDF2CAD – Portable Windows EXE (Electron)

Diese App konvertiert **Vektor-PDFs** (AutoCAD-Plot PDFs) lokal in **DXF**.

## Build auf Windows
1. Node.js LTS installieren (18/20)
2. In diesem Ordner:

```bash
npm install
npm run dist
```

Ergebnis: `dist/PDF2CAD.exe` (portable).

Hinweis: Raster/Scan-PDFs werden in dieser Portable-Version übersprungen.
