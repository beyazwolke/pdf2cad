# PDF2CAD – Setup/Portable Build (Windows)

Dieses Paket ist **Setup-ready**: Es enthält die korrekte `package.json` für
- **Portable EXE** (eine Datei, kein Installer)
- **NSIS Setup.exe** (klassischer Installer)

## Voraussetzungen (Windows 10/11)
- Node.js LTS (18 oder 20): https://nodejs.org
- Optional: Git

## Installation der Abhängigkeiten
Öffnen Sie CMD/PowerShell im Projektordner:

```bat
npm install
```

## Portable EXE bauen
```bat
npm run dist:portable
```
Output: `dist\PDF2CAD.exe` (oder ähnlich)

## Setup.exe (Installer) bauen
```bat
npm run dist:setup
```
Output liegt unter `dist\` und heißt typischerweise:
- `PDF2CAD Setup <VERSION>.exe` oder
- `PDF2CAD Setup.exe`

## Beide Artefakte bauen (portable + setup)
```bat
npm run dist:all
```

## Wenn Setup.exe nicht erscheint
1) Prüfen Sie den Ordner `dist\` auf **eine zweite .exe**.
2) Windows Defender/AV kann die Datei verschieben: Windows Sicherheit → Schutzverlauf.
3) Führen Sie den Build in einem lokalen Ordner ohne Sonderrechte (z.B. `C:\work\pdf2cad`).

Hinweis: Diese App ist für **Vektor-PDFs (AutoCAD-Plot PDFs)** optimiert.
Raster/Scan-PDFs werden in dieser Build-Variante übersprungen.
