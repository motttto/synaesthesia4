# Synästhesie — Vollständige Feature-Dokumentation

Diese Dokumentation beschreibt alle implementierten Funktionen der Synästhesie-Anwendung.

---

## 📊 Inhaltsverzeichnis

1. [Audio-Analyse](#1-audio-analyse)
2. [Visuelle Darstellung](#2-visuelle-darstellung)
3. [3D-Modelle & Morphing](#3-3d-modelle--morphing)
4. [Effekte](#4-effekte)
5. [Input-Methoden](#5-input-methoden)
6. [AI-Bildgenerierung](#6-ai-bildgenerierung)
7. [Streaming & Output](#7-streaming--output)
8. [Farbsysteme](#8-farbsysteme)

---

## 1. Audio-Analyse

### 1.1 Pitch Detection (Tonhöhenerkennung)

Polyphonische Tonhöhenerkennung mit 6 verschiedenen Algorithmen:

| Algorithmus | Beschreibung | Stärke |
|-------------|--------------|--------|
| **HPS** | Harmonic Product Spectrum | Akkorde, polyphon |
| **YIN** | Autokorrelation-basiert | Monophone Stimmen |
| **Autocorrelation** | Klassische Autokorrelation | Schnell, einfach |
| **Cepstrum** | Cepstrale Analyse | Fundamentalfrequenz |
| **Peak Detection** | Spektrum-Peaks | Mehrere Töne |
| **WASM** | WebAssembly-optimiert | Performance |

**Ensemble-Modi:**
- `unanimous` — Alle Algorithmen müssen übereinstimmen
- `majority` — Mehrheitsentscheidung
- `weighted` — Gewichtete Kombination
- `any` — Erster Treffer

### 1.2 Beat Detection (BPM)

- Echtzeit-BPM-Erkennung
- Beat-Trigger für visuelle Effekte
- Tap-Tempo für manuelle Eingabe
- Beat-Counter für synchronisierte Animationen

### 1.3 Percussion Classification

Automatische Erkennung von Schlagzeug-Elementen:

| Instrument | Frequenzbereich |
|------------|-----------------|
| Kick | 20–150 Hz |
| Snare | 150–500 Hz |
| Hi-Hat | 5–15 kHz |
| Tom | 80–400 Hz |
| Crash | 3–20 kHz |

### 1.4 Instrument Detection (YAMNet)

TensorFlow.js-basierte Instrumenterkennung mit YAMNet-Modell:

- **Tasteninstrumente:** Klavier, Keyboard, Orgel, Synthesizer
- **Saiteninstrumente:** Akustik-Gitarre, E-Gitarre, Bass, Violine, Cello
- **Blasinstrumente:** Trompete, Saxophon, Flöte, Klarinette
- **Schlaginstrumente:** Schlagzeug, Percussion
- **Stimme:** Gesang (männlich/weiblich), Chor

Das erkannte Instrument kann automatisch in AI-Prompts integriert werden.

### 1.5 Song Recognition & Lyrics

Erkennung von Musik und automatischer Lyrics-Abruf:

| Provider | Typ | Limit |
|----------|-----|-------|
| **AcoustID** | Audio-Fingerprint | Kostenlos, unlimitiert |
| **ACRCloud** | Audio-Fingerprint | API-Key erforderlich |
| **AudD** | Audio-Fingerprint | API-Key erforderlich |

**Features:**
- Automatische Erkennung alle X Sekunden
- Lyrics-Anzeige mit Scroll
- Lyrics als AI-Prompt für Bildgenerierung

### 1.6 Audio-Chain

| Modul | Funktion |
|-------|----------|
| **3-Band EQ** | Low, Mid, High (-12 bis +12 dB) |
| **Master Gain** | Gesamtlautstärke |
| **Sensitivity** | Empfindlichkeit der Analyse |
| **Smoothing** | Reaktionsglättung |
| **Passthrough** | Audio an Ausgang weiterleiten |

---

## 2. Visuelle Darstellung

### 2.1 Hintergrund

- **Solid Color:** Einfarbiger Hintergrund
- **Gradient:** Farbverlauf (Alex' Modus-Farben)
- **Vignette:** Randabdunklung mit Farbton

### 2.2 Spectrum Analyzer

Echtzeit-Frequenzspektrum-Visualisierung im UI.

### 2.3 Video Output Processing

Nachbearbeitung des gesamten Outputs:

| Parameter | Bereich | Beschreibung |
|-----------|---------|--------------|
| **Gain** | 0–200% | Helligkeitsanpassung |
| **Gamma** | 0.2–2.2 | Gammakurve |
| **Contrast** | 0–200% | Kontrastanpassung |
| **Saturation** | 0–200% | Farbsättigung |
| **RGB EQ** | je 0–200% | Einzelne Farbkanäle |

---

## 3. 3D-Modelle & Morphing

### 3.1 Intervall-Modelle

25 verschiedene 3D-Modelle für musikalische Intervalle:

| Nr. | Intervall | Halbtonschritte | Synästhetische Form |
|-----|-----------|-----------------|---------------------|
| 0 | Prime (Unison) | 0 | Punkt |
| 1 | Kleine Sekunde | 1 | Klein |
| 2 | Große Sekunde | 2 | Klein |
| 3 | Kleine Terz | 3 | Oval |
| 4 | Große Terz | 4 | Oval |
| 5 | Quarte | 5 | Linie |
| 6 | Tritonus | 6 | Linie |
| 7 | Quinte | 7 | Linie |
| 8 | Kleine Sexte | 8 | Linie |
| 9 | Große Sexte | 9 | Linie |
| 10 | Kleine Septime | 10 | Linie |
| 11 | Große Septime | 11 | Linie |
| 12 | Oktave | 12 | Rahmen |
| 13–24 | Erweiterte Intervalle | 13–24 | Varianten |

### 3.2 Model Sets

Mehrere 3D-Modell-Sets können parallel existieren:
- `set_01/`, `set_02/`, `set_03/` etc.
- Automatische Erkennung beim Start
- Wechsel zwischen Sets zur Laufzeit

### 3.3 Morphing

Smooth-Transitions zwischen Modellen:
- **Morph Duration:** Übergangszeit (ms)
- **Morphing Enable/Disable:** An/Aus-Schaltung
- **Vertex Interpolation:** Geometrie-Morphing

### 3.4 Video Texture

Video-Dateien als Textur auf 3D-Modellen:

| Feature | Beschreibung |
|---------|--------------|
| **Video Library** | Mehrere Videos laden und wechseln |
| **Playback Control** | Play, Pause, Loop, Speed |
| **Blend Modes** | Replace, Multiply, Add, Overlay |
| **Displacement** | Video-Helligkeit als Geometrie-Versatz |
| **Audio-Reactive Displacement** | Displacement reagiert auf Audio |
| **Auto-Cycle** | Automatischer Video-Wechsel |

---

## 4. Effekte

### 4.1 Geometrie-Effekte

| Effekt | Beschreibung | Parameter |
|--------|--------------|-----------|
| **Glitch** | Zufällige Vertex-Verschiebung | Intensity |
| **Pulse** | Rhythmisches Skalieren | Intensity, Speed |
| **Explode** | Faces fliegen auseinander | Intensity, Oscillator, Audio-Reactive |
| **Fractal** | Noise-basierte Deformation | Scale, Speed, Octaves |

### 4.2 Post-Processing Shader

| Effekt | Beschreibung | Parameter |
|--------|--------------|-----------|
| **Edge Detection** | Sobel-Kantenerkennung | Strength, Glow, Color |
| **Trails / Afterimage** | Nachzieheffekt | Intensity (Damp) |
| **Blur** | Weichzeichnung | Intensity |
| **Kaleidoscope** | Spiegel-Effekt | Segments, Rotation, Zoom, Auto-Rotate |

### 4.3 Tron Grid Floor

Synthwave/Retro-Style Gitter-Boden:

| Parameter | Beschreibung |
|-----------|--------------|
| **Grid Size** | Anzahl der Linien (X/Y) |
| **Spacing** | Abstand zwischen Linien |
| **Line Width** | Liniendicke |
| **Glow** | Neon-Leuchteffekt |
| **Scroll Speed** | Bewegung zum Betrachter |
| **Audio-Reactive** | Helligkeit reagiert auf Audio |
| **Wave Height/Speed** | Wellenanimation |
| **Color** | Linienfarbe (oder Schema-Farbe) |

### 4.4 Particle System

GPU-beschleunigte Partikel:

| Parameter | Beschreibung |
|-----------|--------------|
| **Particle Count** | Anzahl der Partikel |
| **Size** | Partikelgröße |
| **Speed** | Bewegungsgeschwindigkeit |
| **Color** | Partikelfarbe (oder Note-Farbe) |
| **Intensity** | Emissionsrate |

---

## 5. Input-Methoden

### 5.1 Audio Source

- **Mikrofon:** Systemstandard oder USB-Mikrofon
- **Virtual Audio Device:** BlackHole, Loopback etc.
- **Audio Interface:** Externe Soundkarten

### 5.2 MIDI Input

| Feature | Beschreibung |
|---------|--------------|
| **Device Selection** | MIDI-Controller auswählen |
| **Note Input** | Noten triggern Modelle/Farben |
| **Velocity** | Anschlagstärke für Effekte |
| **Built-in Synth** | Integrierter Synthesizer für Playback |

### 5.3 Speech Recognition

Spracherkennung für AI-Prompts:

| Feature | Beschreibung |
|---------|--------------|
| **Web Speech API** | Browser-native Erkennung |
| **Backend Selection** | Local, Google, Azure |
| **Continuous Mode** | Dauerhaftes Zuhören |
| **Auto-Prompt** | Erkannter Text als AI-Prompt |

### 5.4 Camera Input

USB-Webcam als visueller Input:

| Feature | Beschreibung |
|---------|--------------|
| **Device Selection** | Kamera auswählen |
| **Overlay** | Kamerabild über 3D-Szene |
| **Opacity** | Transparenz des Overlays |
| **Blend Modes** | Normal, Overlay, Multiply, Screen, Add |
| **Audio-Reactive Opacity** | Transparenz reagiert auf Audio |
| **As 3D Texture** | Kamerabild auf Modell |

### 5.5 Skeleton Tracking (MediaPipe)

Pose-Estimation aus Kamerabild:

| Modell | Beschreibung |
|--------|--------------|
| **MediaPipe Pose** | 33 Body-Landmarks |
| **MoveNet Lightning** | Schnelles Body-Tracking |
| **MoveNet Thunder** | Präzises Body-Tracking |
| **MediaPipe Face Mesh** | 468 Face-Landmarks |
| **MediaPipe Hands** | 21 Hand-Landmarks pro Hand |
| **Object Detection** | Objekte im Bild erkennen |

**3D-Model Mapping:**
- Landmark auf Modell-Position mappen
- Smoothing für flüssige Bewegung
- Scale-Anpassung

---

## 6. AI-Bildgenerierung

### 6.1 ComfyUI Integration

Lokale Stable Diffusion über ComfyUI:

| Modell | Beschreibung |
|--------|--------------|
| **SD 1.5** | Stable Diffusion 1.5 |
| **SDXL** | Stable Diffusion XL |
| **SD Turbo** | Schnelle Generierung |
| **Custom** | Eigene Checkpoints |

### 6.2 Generierungs-Parameter

| Parameter | Beschreibung |
|-----------|--------------|
| **Steps** | Sampling-Schritte (1–30) |
| **CFG** | Classifier-Free Guidance (1–15) |
| **Sampler** | euler, dpm++, etc. |
| **Resolution** | 512×512 bis 1920×1080 |
| **Aspect Ratios** | 1:1, 16:9, 4:3, 9:16, 21:9, Fit Screen |

### 6.3 Upscaling

| Parameter | Beschreibung |
|-----------|--------------|
| **Generate Resolution** | Kleine Auflösung für schnelle Generierung |
| **Upscale Method** | Nearest, Bilinear, Bicubic, Lanczos |
| **Target Resolution** | Finale Ausgabeauflösung |

### 6.4 Buffer Mode

Vorproduzierte Bilder für flüssige Übergänge:

| Feature | Beschreibung |
|---------|--------------|
| **Buffer Size** | Anzahl der vorproduzierten Bilder |
| **Continuous Generation** | Generiert bis Buffer voll |
| **Loop** | Buffer wiederholen |
| **Shuffle** | Zufällige Reihenfolge |
| **Crossfade** | Überblendung zwischen Bildern |

### 6.5 Playback & Sync

| Feature | Beschreibung |
|---------|--------------|
| **Playback Speed** | ms pro Bild |
| **BPM Sync** | Bildwechsel auf Beat |
| **Beats per Image** | 1, 2, 4, 8, 16 Beats |
| **Stream Mode** | Kontinuierlicher Output |

### 6.6 Overlay

| Parameter | Beschreibung |
|-----------|--------------|
| **Overlay Opacity** | 0–100% über 3D-Szene |
| **As 3D Texture** | AI-Bild als Modell-Textur |

---

## 7. Streaming & Output

### 7.1 WebSocket Streaming

| Parameter | Wert |
|-----------|------|
| **Resolution** | 1920×1080 |
| **Frame Rate** | 30 fps |
| **Port** | 9876 (default) |
| **Client** | stream-client.html |

### 7.2 Kompatible Software

- OBS Studio (Browser Source)
- MadMapper
- Resolume Arena/Avenue
- VDMX
- TouchDesigner

### 7.3 DMX Output (In Arbeit)

Geplante Features:
- DMX Controller Selection
- Universe/Channel Mapping
- Color-to-DMX Conversion

---

## 8. Farbsysteme

### 8.1 Clara's System (Chromästhesie)

Absolutes Farbsystem — jeder Ton hat eine feste Farbe:

| Note | Farbe | Sharp (♯) | Flat (♭) |
|------|-------|-----------|----------|
| C | Rot | Rosa | — |
| D | Gelb | Hellgelb | Olivgelb |
| E | Grün | — | Dunkelgrün |
| F | Orange | Hellorange | — |
| G | Blau | Hellblau | Türkis |
| A | Grau | Rosa | Blaugrau |
| H/B | Braun | — | Dunkelbraun |

**Zusätzlich:**
- Intervallformen (Punkt → Oval → Linie → Rechteck)
- Ziffernfarben (0–9)

### 8.2 Alex' System (Harmonische Wahrnehmung)

Relatives Farbsystem — Farben basieren auf musikalischem Kontext:

| Modus | Farbe |
|-------|-------|
| Dur | Rot/Orange |
| Moll | Blau |

**Stufenfarben (I–VII):** Jede Stufe hat eine eigene Farbe.

### 8.3 Schema-Auswahl

| Modus | Anwendung |
|-------|-----------|
| **Clara** | 3D-Modell-Farben |
| **Alex** | Hintergrund-Gradient, Vignette |
| **Both** | Kombiniert beide Systeme |

---

## Tastaturkürzel

| Taste | Funktion |
|-------|----------|
| `F` | Fullscreen an/aus |
| `ESC` | Fullscreen beenden |

---

## Dateistruktur

```
synaesthesia_4/
├── js/
│   ├── main.js              # Entry Point
│   ├── config/
│   │   ├── colors.js        # Farbdefinitionen
│   │   └── intervals.js     # Intervall-Mappings
│   ├── core/
│   │   ├── three-setup.js   # Three.js Scene
│   │   ├── postprocessing.js# Shader-Effekte
│   │   ├── particles.js     # Partikelsystem
│   │   └── video-texture.js # Video als Textur
│   ├── models/
│   │   └── model-manager.js # GLTF Loader & Morphing
│   ├── effects/
│   │   ├── visual-effects.js# Geometrie-Effekte
│   │   └── grid-floor.js    # Tron Grid
│   ├── audio/
│   │   ├── audio-chain.js   # EQ, Gain, Analyser
│   │   ├── pitch-detector.js# Tonhöhenerkennung
│   │   ├── beat-detector.js # BPM Detection
│   │   ├── percussion.js    # Drum Classification
│   │   ├── instrument-detector.js # YAMNet
│   │   └── song-recognition.js    # Shazam-ähnlich
│   ├── input/
│   │   ├── midi.js          # MIDI Controller
│   │   ├── speech.js        # Spracherkennung
│   │   ├── camera-input.js  # Webcam
│   │   └── skeleton-tracker.js # MediaPipe
│   ├── analysis/
│   │   ├── intervals.js     # Akkord-Analyse
│   │   └── colors.js        # Farbberechnung
│   ├── camera/
│   │   └── controls.js      # Orbit, FOV
│   ├── stream/
│   │   └── obs-stream.js    # WebSocket
│   ├── ai/
│   │   └── ai-image.js      # ComfyUI
│   └── ui/
│       ├── interval-modal.js# Intervall-Übersicht
│       └── spectrum.js      # Spektrum-Anzeige
├── 3d-models/
│   ├── set_01/              # 25 GLB-Dateien
│   ├── set_02/
│   └── set_03/
├── css/
│   └── styles.css
├── docs/
│   ├── FEATURES.md          # Diese Datei
│   └── SYNESTHESIA_SYSTEMS.md
└── index.html
```

---

*Letzte Aktualisierung: Januar 2026*
