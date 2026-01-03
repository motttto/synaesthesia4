# Synästhesie – Changelog & Feature Documentation

## Version 1.4.1 (January 2025)

### 🎥 Stream Latenz Optimierung
- [x] **60fps statt 30fps** - Halbiert theoretische Latenz von ~33ms auf ~16.7ms
- [x] **JPEG Qualität reduziert** - 0.7 statt 0.85 für schnelleres Encoding
- [x] **Dynamische FPS** - Neue Funktion `setStreamFPS(fps)` für Anpassung (30-120fps)
- [x] **Clean Output Window** - Ebenfalls auf 60fps aktualisiert

### 🔍 AI Prompt Debug Panel
- [x] **Eigenes Panel** - Aus AI Image Panel herausgelöst
- [x] **Linke Spalte** - Neues Panel `🔍 AI Prompt` unter Debug-Panel
- [x] **Übersichtliche Anzeige:**
  - Base Prompt (Speech/Manual) - gelb
  - + Instrument - blau
  - + Modifiers - lila
  - 📤 Final Prompt - grün mit Border
- [x] **Copy & Refresh Buttons** - Final Prompt kopieren/aktualisieren
- [x] **Timestamp** - Letzte Aktualisierung

### ⏱️ Speech Buffer Timeout Slider
- [x] **Neuer Slider im AI Prompt Panel** - Steuert Auto-Clear Zeit
- [x] **Bereich: 1-10 Sekunden** - In 0.5s Schritten
- [x] **Default: 3.0s** - Guter Kompromiss
- [x] **Beschreibung** - "Auto-clear nach Stille"

---

## Version 1.4.0 (January 2025)

### 🎥 Background Streaming Fix (OBS/MadMapper)
- [x] **Stream läuft im Hintergrund** - Stream bricht nicht mehr ab wenn App nicht im Fokus
- [x] **Electron backgroundThrottling deaktiviert** - Beide Fenster (Main + Output)
- [x] **Chrome Background-Flags** - `disable-renderer-backgrounding`, `disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`
- [x] **Separater Background Stream Loop** - `setInterval` statt `requestAnimationFrame` für konstante 30fps
- [x] **Clean Output Window Fix** - Nutzt jetzt auch `setInterval` für Hintergrund-Rendering

**Technische Details:**
- Stream Capture läuft unabhängig vom Haupt-Animation-Loop
- Funktioniert auch bei minimierter App oder anderen aktiven Fenstern
- Keine Frame-Drops mehr beim App-Wechsel

### 🎙️ Speech Buffer System
- [x] **Wort-Akkumulation** - Erkannte Wörter werden gesammelt statt sofort überschrieben
- [x] **Auto-Clear nach 3 Sekunden** - Buffer leert sich automatisch nach Stille
- [x] **Duplikat-Vermeidung** - Letzte 10 Wörter werden nicht wiederholt
- [x] **Max 20 Wörter** - Älteste werden entfernt wenn Buffer voll
- [x] **Visuelles Feedback** - Zeigt `🎙️ [5] wort1 wort2...` mit Wortanzahl
- [x] **Konfigurierbar** - `setSpeechBufferTimeout(ms)` für Timeout (1-10s)

**Neue Funktionen:**
- `clearSpeechBuffer()` - Manuell leeren
- `setSpeechBufferTimeout(ms)` - Timeout anpassen
- `getSpeechBuffer()` - Aktuellen Buffer abrufen

---
## Version 1.3.0 (January 2025)

### 🎤 Whisper Local Speech Recognition (FIXED)
- [x] **whisper-cpp Homebrew Support** - Now detects `whisper-cli` from Homebrew installation
- [x] **Multiple Model Locations** - Searches homebrew, custom, and whisper.cpp directories
- [x] **Improved Argument Handling** - Compatible with both old and new whisper-cli argument formats
- [x] **Better Error Messages** - Clear feedback when ffmpeg or models are missing
- [x] **whisper-stream Detection** - Prepared for future real-time streaming support

**Supported Paths:**
- `/opt/homebrew/bin/whisper-cli` (Homebrew M1/M2)
- `/usr/local/bin/whisper-cli` (Homebrew Intel)
- `~/whisper.cpp/main` (Self-compiled)
- `~/.whisper-models/` (Custom model directory)

**Requirements:**
- `brew install whisper-cpp` - Whisper executable
- `brew install ffmpeg` - Audio conversion
- Whisper model (base/small/medium) in `~/.whisper-models/`

---

## Version 1.2.0 (December 2024)

### 📺 Video Out Processing Panel (NEW)
- [x] **Gain Control** - Output brightness/amplification (0-200%)
- [x] **Gamma Correction** - Mid-tone adjustment (0.50-2.00)
- [x] **Contrast** - Dynamic range control (50-200%)
- [x] **Saturation** - Color intensity (0-200%, 0% = grayscale)
- [x] **RGB Color EQ** - Individual channel gains:
  - Red channel (0-200%)
  - Green channel (0-200%)
  - Blue channel (0-200%)
- [x] **Reset Button** - Restore all values to defaults
- [x] **Performance Optimized** - Gamma lookup table for fast processing
- [x] **Stream Integration** - Filters applied to Clean Output (OBS/MadMapper)

**Technical Details:**
- Processing order: Gamma → Contrast → Saturation → RGB Gains
- Applied via ImageData manipulation at stream canvas level
- Only processes when values differ from defaults (performance)
- Located in right column UI after Camera panel

---

## Version 1.1.0 (December 2024)

### 🎥 Video Texture System (NEW)
- [x] **Video File Loading** - Load local video files as texture source
- [x] **Three.js VideoTexture** - Real-time video texture for 3D models
- [x] **Playback Controls** - Play/Pause, Progress Slider, Time Display
- [x] **Loop Mode** - Toggle video looping
- [x] **Playback Speed** - Adjustable from 0.25x to 2x
- [x] **Blend Modes** - Replace, Multiply, Add (Glow), Overlay
- [x] **Intensity Control** - Adjustable blend amount
- [x] **Auto Re-Apply** - Video texture persists through model changes
- [x] **Preview** - Small preview in the control panel

---

## Version 1.0.0 (December 2024)

---

## 🎵 Audio System

### Audio Input
- [x] System microphone selection
- [x] Audio interface support (multi-channel)
- [x] Real-time audio capture via Web Audio API
- [x] Audio passthrough to output device
- [x] Adjustable passthrough volume

### Audio Processing
- [x] 3-band parametric EQ (Low/Mid/High, ±24dB)
- [x] Master gain control (-60dB to +12dB)
- [x] Real-time level meter with peak detection
- [x] FFT analysis (2048 samples)

### Pitch Detection
- [x] **HPS** (Harmonic Product Spectrum)
- [x] **HPS + Whitening** (noise-resistant variant)
- [x] **Autocorrelation** (time-domain)
- [x] **YIN** (fundamental frequency estimation)
- [x] **Cepstrum** (spectral analysis)
- [x] **Peak Detection** (simple frequency peaks)
- [x] Multi-algorithm ensemble modes:
  - Union (all detected notes)
  - Intersection (agreement required)
  - Voting (majority wins)
  - Strongest confidence
- [x] Adjustable reaction speed/smoothing
- [x] Polyphonic detection (multiple simultaneous notes)

### Beat Detection
- [x] Real-time BPM calculation
- [x] Beat indicator (visual flash)
- [x] Adjustable sensitivity
- [x] Beat-synchronized effects:
  - Flash (brightness pulse)
  - Pulse (model scale)
  - Rotation (camera movement)

### Percussion Recognition
- [x] Drum classification via spectral analysis
- [x] Detected instruments:
  - Kick drum
  - Snare drum
  - Hi-Hat
  - Tom
  - Crash/Cymbal
- [x] Real-time display with confidence

---

## 🎹 MIDI System

### MIDI Input
- [x] Device selection dropdown
- [x] Hot-plug detection
- [x] Note On/Off handling
- [x] Velocity sensitivity
- [x] Toggle MIDI as primary input

### MIDI Synthesizer
- [x] Built-in Web Audio synth
- [x] Adjustable volume
- [x] Polyphonic playback
- [x] ADSR envelope

---

## 🗣️ Speech Recognition

### Speech-to-Text
- [x] Multi-language support:
  - German (de-DE)
  - English US (en-US)
  - English UK (en-GB)
  - French (fr-FR)
  - Spanish (es-ES)
- [x] Real-time transcription display
- [x] Word filtering:
  - Nouns only
  - Verbs only
  - Adjectives only
- [x] Integration with AI image generation

---

## 🎨 Color Systems

### Clara's System (Chromesthesia)
- [x] Fixed note-to-color mapping:
  | Note | Color |
  |------|-------|
  | C | Red |
  | C#/Db | Pink/Dark Red |
  | D | Yellow |
  | D#/Eb | Olive/Dark Yellow |
  | E | Green |
  | F | Orange |
  | F#/Gb | Light Orange/Amber |
  | G | Blue |
  | G#/Ab | Light Blue/Steel |
  | A | Gray |
  | A#/Bb | Light Gray/Taupe |
  | B/H | Brown |
- [x] Applied to 3D model materials
- [x] Sharp/flat color variants

### Alex's System (Harmonic Perception)
- [x] Mode-based coloring:
  - Major → Red/Orange (warm)
  - Minor → Blue (cool)
- [x] Scale degree colors (I through VII)
- [x] Background gradient coloring
- [x] Radial vignette effect
- [x] Toggle degree colors on/off

### Blend Mode
- [x] Clara ↔ Alex slider (0-100%)
- [x] Smooth color interpolation
- [x] "Both" schema option

---

## 🌀 3D Visualization

### Model System
- [x] 25 interval-based models:
  | # | Interval | Semitones |
  |---|----------|-----------|
  | 01 | Prime (Unison) | 0 |
  | 02 | Minor 2nd | 1 |
  | 03 | Major 2nd | 2 |
  | 04 | Minor 3rd | 3 |
  | 05 | Major 3rd | 4 |
  | 06 | Perfect 4th | 5 |
  | 07 | Tritone | 6 |
  | 08 | Perfect 5th | 7 |
  | 09 | Minor 6th | 8 |
  | 10 | Major 6th | 9 |
  | 11 | Minor 7th | 10 |
  | 12 | Major 7th | 11 |
  | 13 | Octave | 12 |
  | 14 | Minor 9th | 13 |
  | 15 | Major 9th | 14 |
  | 16 | Minor 10th | 15 |
  | 17 | Major 10th | 16 |
  | 18 | Perfect 11th | 17 |
  | 19 | Augmented 11th | 18 |
  | 20 | Perfect 12th | 19 |
  | 21 | Minor 13th | 20 |
  | 22 | Major 13th | 21 |
  | 23 | Minor 14th | 22 |
  | 24 | Major 14th | 23 |
  | 25 | Double Octave | 24 |
- [x] Multiple model sets (auto-detection)
- [x] GLB/GLTF format support
- [x] Model caching for performance

### Morphing
- [x] Smooth transitions between models
- [x] Adjustable morph duration (100-1500ms)
- [x] Geometry interpolation
- [x] Toggle morphing on/off

### Model Controls
- [x] Scale slider (0.1x - 5x)
- [x] Sensitivity (color reaction speed)
- [x] Visibility toggle (eye icon)
- [x] Model set selector with scan button

---

## ⚡ Visual Effects

### Effect Types
- [x] **Glitch**: Random vertex displacement
- [x] **Pulse**: Rhythmic scale breathing
- [x] **Edge Detection**: Sobel shader outline
- [x] **Explode**: Vertex expansion outward
- [x] **Particles**: GPU particle system
- [x] **Trails**: Afterimage/motion blur

### Effect Controls
- [x] Individual intensity sliders (0-100%)
- [x] Multi-selection (combine effects)
- [x] Edge glow intensity
- [x] Particle amount & size
- [x] Trail afterglow duration

### Audio Reactivity
- [x] Audio → Scale (model size)
- [x] Audio → Brightness (gain-linked)
- [x] Black level adjustment
- [x] Reset All button

---

## 📷 Camera System

### Controls
- [x] OrbitControls (mouse drag)
- [x] Camera lock toggle
- [x] Reset to default position
- [x] Auto-orbit mode

### FOV & Depth
- [x] Focal length slider (20° - 120°)
- [x] FOV → Audio link (reactive zoom)
- [x] Depth of field blur (0-100%)

---

## 📡 Streaming

### WebSocket Stream
- [x] Resolution: 1920×1080 (Full HD)
- [x] Frame rate: 30fps
- [x] Stream server (port 9876)
- [x] Stream client HTML page
- [x] Status indicator in UI

### Compatibility
- [x] MadMapper
- [x] OBS Studio
- [x] Resolume
- [x] Any WebSocket-capable software

---

## 🤖 AI Image Generation

### ComfyUI Integration
- [x] Local connection (localhost:8188)
- [x] Connection status indicator
- [x] Start ComfyUI button (Electron)

### Models
- [x] SD 1.5 (20 steps, CFG 7)
- [x] SDXL (25 steps, CFG 7)
- [x] Turbo (4 steps, CFG 1)

### Resolution Presets
- [x] Fit Screen (dynamic)
- [x] 1:1 Square
- [x] 16:9 Landscape
- [x] 9:16 Portrait
- [x] 4:3 Classic
- [x] 3:2 DSLR
- [x] 21:9 Ultra-wide
- [x] Model-aware sizing (512 vs 1024 base)

### Generation
- [x] Manual prompt input
- [x] Speech-to-prompt integration
- [x] Auto-generation mode (3s delay)
- [x] Text filters (Nouns/Verbs/Adjectives)

### Display
- [x] Off / On / Overlay modes
- [x] Preview panel
- [x] Overlay canvas layer
- [x] Crossfade transitions

### Buffer Mode
- [x] Collapsible settings panel (opens on activation)
- [x] Buffer size slider (5-50 images)
- [x] Loop buffer option
- [x] Shuffle option
- [x] Clickable thumbnail gallery
- [x] Buffer status display (current/max)

---

## 🖥️ User Interface

### Layout
- [x] Left column: Audio, MIDI, Notes, Percussion, Speech, Debug
- [x] Bottom bar: Color Schema, 3D Model, Effects, AI Image
- [x] Right column: Master, EQ, Pitch Detection, Beat, Camera
- [x] Collapsible panels (click header)
- [x] Fullscreen toggle (F key)

### Interval Overview Modal
- [x] Opens via ℹ️ button in 3D Model panel
- [x] Grid of all 25 intervals
- [x] Synesthetic shape symbols (● ▬ ⬭ ╱)
- [x] Name, semitones, shape description
- [x] Hover effects and click selection
- [x] ESC or click outside to close

### Indicators
- [x] Level meter (real-time)
- [x] Beat indicator (flash)
- [x] BPM display
- [x] Connection status (ComfyUI, Stream)
- [x] MIDI status

---

## 🔧 Technical

### Frameworks
- [x] Electron 28.0 (desktop app)
- [x] Three.js 0.160 (3D rendering)
- [x] Web Audio API (audio processing)
- [x] Web Speech API (speech recognition)
- [x] WebSocket (streaming)

### Build Targets
- [x] macOS (DMG, ZIP)
- [x] Windows (NSIS, Portable)
- [x] Linux (AppImage, DEB)

### Module Structure
```
js/
├── main.js           # Entry point
├── config/           # Color & interval definitions
├── core/             # Three.js setup, shaders, particles
├── models/           # GLTF loading & morphing
├── effects/          # Visual effects
├── audio/            # Audio chain, pitch, beat, percussion
├── input/            # MIDI, speech
├── analysis/         # Interval & color analysis
├── camera/           # Camera controls
├── stream/           # WebSocket streaming
└── ai/               # ComfyUI integration
```

---

## 📋 Planned Features

- [ ] NDI output support
- [ ] OSC input/output
- [ ] Preset save/load
- [ ] Recording to video file
- [ ] Custom color mapping editor
- [ ] MIDI CC mapping
- [ ] Syphon/Spout output

---

*Last updated: January 4, 2025*
