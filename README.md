# Synästhesie - Electron App

Visualisiert harmonische Intervalle mit Farben und 3D-Modellen basierend auf synästhetischen Wahrnehmungen.

## Installation & Entwicklung

### Voraussetzungen
- Node.js (v18 oder höher)
- npm
- **Für NDI:** NDI SDK / NDI Tools von [ndi.tv/tools](https://ndi.tv/tools/)

### Setup

```bash
# In den Projektordner wechseln
cd synaesthesia_4

# Dependencies installieren
npm install

# Native Module für Electron rebuilden (für NDI)
npx electron-rebuild

# App starten (Entwicklungsmodus)
npm start
```

### App kompilieren

```bash
# Für macOS
npm run build:mac

# Für Windows
npm run build:win

# Für Linux
npm run build:linux

# Für alle Plattformen
npm run build
```

Die kompilierten Apps findest du im `dist/` Ordner.

## NDI Output

Die App kann das visuelle Output als NDI-Stream ins Netzwerk senden. Damit kannst du es in OBS, vMix, Resolume oder anderen NDI-fähigen Programmen empfangen.

### NDI Setup

1. **NDI Tools installieren:** Lade die kostenlosen NDI Tools von [ndi.tv/tools](https://ndi.tv/tools/) herunter
2. **App starten**
3. **Menü → NDI Output → NDI Stream starten**

### NDI Optionen (im Menü)

- **Stream starten/stoppen** - Aktiviert/deaktiviert den NDI-Output
- **Auflösung** - Full HD (1920x1080), HD (1280x720), 4K, Square (1080x1080), Vertical (1080x1920)
- **Framerate** - 60, 30, 25 oder 24 fps
- **Stream-Name** - Der Name, unter dem der Stream im Netzwerk erscheint

### NDI in anderen Apps empfangen

- **OBS Studio:** Quelle hinzufügen → NDI Source → "Synästhesie" auswählen
- **vMix:** Add Input → NDI → "Synästhesie"
- **Resolume:** Sources → NDI → "Synästhesie"

## Berechtigungen

### macOS
Die App benötigt Mikrofonzugriff. Beim ersten Start wirst du um Erlaubnis gefragt.

Falls der Zugriff verweigert wurde:
1. Öffne Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon
2. Aktiviere Synästhesie in der Liste

### Windows
Windows fragt automatisch beim ersten Zugriff auf das Mikrofon.

## Features

- **Audio-Analyse**: Echtzeit-Tonerkennung via Mikrofon oder Audio-Interface
- **MIDI-Support**: Direkter MIDI-Controller-Anschluss
- **Farbschemata**: Clara (absolute Tonfarben) & Alex (relative Akkordfarben)
- **3D-Modelle**: Intervall-basierte Formdarstellung
- **Effekte**: Glitch, Hologram, Pulse, Wireframe, Explode
- **Beat Detection**: BPM-Erkennung mit visuellen Effekten
- **NDI Output**: Stream ins Netzwerk für VJ-Software, OBS, etc.

## Tastenkürzel

- `F` - UI ein/ausblenden
- `F11` - Vollbild
- `ESC` - Vollbild verlassen
- Doppelklick auf Canvas - Browser-Vollbild

## Troubleshooting

### Kein Audio erkannt
1. Prüfe ob das richtige Audiogerät ausgewählt ist
2. Klicke auf "Starten"
3. Prüfe die Mikrofonberechtigungen

### 3D-Modelle werden nicht angezeigt
Die GLB-Dateien müssen im `3d-models/` Ordner liegen.

### MIDI funktioniert nicht
1. MIDI-Gerät vor App-Start anschließen
2. Gerät im Dropdown auswählen
3. "MIDI als Eingabe nutzen" aktivieren

### NDI nicht verfügbar
1. NDI Tools von [ndi.tv/tools](https://ndi.tv/tools/) installieren
2. App neu starten
3. Native Module rebuilden: `npx electron-rebuild`

### NDI Stream wird nicht empfangen
1. Prüfe ob Sender und Empfänger im gleichen Netzwerk sind
2. Firewall-Einstellungen prüfen (Ports 5960-5969)
3. NDI Access Manager prüfen (in den NDI Tools enthalten)
