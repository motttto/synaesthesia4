# 🎨 Synästhesie

**Real-time audio-to-visual synesthesia visualization combining music theory with 3D graphics.**

Transform sound into mesmerizing visuals using two distinct synesthetic color systems, 3D model morphing, and live performance streaming capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-28.0-47848F.svg)
![Three.js](https://img.shields.io/badge/three.js-0.160-black.svg)

---

## ✨ Features

📖 **Complete documentation:** [docs/FEATURES.md](docs/FEATURES.md)

### 🎵 Audio Analysis
- **Polyphonic pitch detection** with 6 algorithms (HPS, YIN, Autocorrelation, Cepstrum, Peak Detection, WASM)
- **Ensemble modes**: unanimous, majority, weighted, any
- **Real-time BPM detection** with beat-synchronized effects
- **Percussion classification** (Kick, Snare, Hi-Hat, Tom, Crash)
- **Instrument detection** via YAMNet/TensorFlow.js (Piano, Guitar, Strings, Brass, Voice...)
- **Song recognition** with lyrics (AcoustID, ACRCloud, AudD)
- **3-band parametric EQ** with master gain control
- **MIDI input support** with built-in synthesizer

### 🎨 Dual Color Systems

Based on authentic synesthetic perception systems:

| Clara's System | Alex's System |
|----------------|---------------|
| Absolute note colors (Chromesthesia) | Relative chord colors (Harmonic Perception) |
| C=Red, D=Yellow, E=Green, F=Orange, G=Blue, A=Gray, B=Brown | Minor=Blue, Major=Red/Orange |
| Sharp tones: lighter/pastel variants | Scale degree colors (I-VII) |
| Flat tones: darker/muted variants | Context-dependent coloring |
| Applied to 3D models | Applied to background/vignette |
| Includes digit colors (0-9) | — |
| Interval shapes (small→lines→rectangles) | — |

📖 **Full documentation:** [docs/SYNESTHESIA_SYSTEMS.md](docs/SYNESTHESIA_SYSTEMS.md)

### 🌀 3D Visualization
- **25 interval-based 3D models** (Prime to Double Octave)
- **Smooth morphing transitions** between shapes
- **Multiple model sets** with automatic detection
- **Video textures** with library, blending modes, displacement
- **GPU-accelerated particle systems**

### ⚡ Effects
- **Geometry:** Glitch, Pulse, Explode, Fractal noise
- **Post-processing:** Edge Detection (Sobel), Blur, Trails/Afterimage
- **Kaleidoscope** with segments, rotation, zoom
- **Tron Grid Floor** (Synthwave-style, audio-reactive)
- Audio-reactive scaling and FOV

### 📷 Input Methods
- **Audio:** Microphone, Virtual Audio Device, Audio Interface
- **MIDI:** Note input with velocity, built-in synth
- **Speech:** Voice-to-text for AI prompts
- **Camera:** Webcam overlay with blend modes
- **Skeleton Tracking:** MediaPipe Pose, MoveNet, Face Mesh, Hands, Object Detection

### 📡 Live Performance
- **WebSocket streaming** (1920×1080 @ 30fps)
- **DMX output** via Art-Net, sACN, or USB Serial (Enttec)
- Compatible with MadMapper, OBS, Resolume
- Stream client for projection mapping

### 🤖 AI Image Generation
- **Local ComfyUI integration** for Stable Diffusion (SD 1.5, SDXL, Turbo)
- **Buffer mode** with continuous generation & crossfade
- **BPM-synchronized playback** (1, 2, 4, 8, 16 beats)
- **Stream mode** for continuous output
- Multiple aspect ratios (1:1, 16:9, 4:3, 9:16, 21:9)
- **Upscaling** with Lanczos, Bicubic, Bilinear
- Speech/Lyrics-to-prompt with auto-generation
- As overlay or 3D model texture

### 📊 Video Output
- **Gain, Gamma, Contrast, Saturation** controls
- **RGB EQ** for individual color channel adjustment
- Real-time spectrum analyzer

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/synaesthesia.git
cd synaesthesia

# Install dependencies
npm install

# Start the Electron app
npm start

# Or run in browser (development)
npm run web
# Open http://localhost:3000
```

### Build for Distribution

```bash
npm run build:mac    # macOS (.dmg, .zip)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

---

## 🎮 Usage

### Basic Workflow

1. **Select audio source** from the dropdown
2. **Click Start** to begin audio capture
3. **Choose color schema**: Clara, Alex, or Both
4. **Play music** — watch the visuals respond!

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `ESC` | Exit fullscreen |

### Panel Overview

| Panel | Function |
|-------|----------|
| **Audio Source** | Select microphone or audio interface |
| **Color Schema** | Switch between Clara/Alex systems |
| **3D Model** | Scale, morphing, model set selection |
| **Effects** | Visual effects with intensity controls |
| **AI Image** | Stable Diffusion integration |
| **Master** | Gain control and level meter |
| **Beat** | BPM display and beat effects |
| **Camera** | FOV, orbit, blur controls |

---

## 🏗️ Architecture

```
synaesthesia/
├── js/
│   ├── main.js              # Entry point & animation loop
│   ├── config/
│   │   ├── colors.js        # Clara/Alex color definitions
│   │   └── intervals.js     # Musical interval mappings
│   ├── core/
│   │   ├── three-setup.js   # Scene, camera, renderer
│   │   ├── postprocessing.js# Shaders & effects
│   │   ├── particles.js     # GPU particle system
│   │   └── video-texture.js # Video as 3D texture
│   ├── models/
│   │   └── model-manager.js # GLTF loading & morphing
│   ├── effects/
│   │   ├── visual-effects.js# Glitch, pulse, explode
│   │   └── grid-floor.js    # Tron grid effect
│   ├── audio/
│   │   ├── audio-chain.js   # EQ, gain, analyser
│   │   ├── pitch-detector.js# Multi-algorithm detection
│   │   ├── beat-detector.js # BPM & beat sync
│   │   ├── percussion.js    # Drum classification
│   │   ├── instrument-detector.js # YAMNet
│   │   └── song-recognition.js    # Shazam-like
│   ├── input/
│   │   ├── midi.js          # MIDI controller support
│   │   ├── speech.js        # Speech recognition
│   │   ├── camera-input.js  # Webcam input
│   │   └── skeleton-tracker.js # MediaPipe pose
│   ├── analysis/
│   │   ├── intervals.js     # Chord analysis
│   │   └── colors.js        # Color calculations
│   ├── camera/
│   │   └── controls.js      # Orbit, FOV, auto-rotate
│   ├── stream/
│   │   └── obs-stream.js    # WebSocket streaming
│   ├── output/
│   │   └── dmx-output.js    # DMX/Art-Net output
│   ├── ai/
│   │   └── ai-image.js      # ComfyUI integration
│   └── ui/
│       ├── interval-modal.js# Interval overview
│       └── spectrum.js      # Spectrum analyzer
├── 3d-models/
│   ├── set_01/              # Model set 1 (25 intervals)
│   ├── set_02/              # Model set 2
│   └── set_03/              # Model set 3
├── css/
│   └── styles.css           # UI styling
├── docs/
│   ├── FEATURES.md          # Complete feature documentation
│   └── SYNESTHESIA_SYSTEMS.md # Color system documentation
└── index.html               # Main application
```

---

## 🎹 Color Systems Explained

For complete documentation with all hex values, see **[docs/SYNESTHESIA_SYSTEMS.md](docs/SYNESTHESIA_SYSTEMS.md)**

### Clara's Note Colors (Chromesthesia)
Each musical note has a fixed color regardless of context:

| Note | Color | Hex | Sharp (♯) | Flat (♭) |
|------|-------|-----|-----------|----------|
| C | Red | `#FF0000` | Rosa `#FFAAAA` | — |
| D | Yellow | `#FFFF00` | Light `#FFFF99` | Olive `#B3B366` |
| E | Green | `#00CC00` | — | Forest `#228B22` |
| F | Orange | `#FF8800` | Light `#FFCC66` | — |
| G | Blue | `#0066FF` | Light `#99CCFF` | Teal `#339999` |
| A | Gray | `#999999` | Pink `#FFCCCC` | Blue-gray `#666688` |
| B/H | Brown | `#8B4513` | — | Dark `#5D3A1A` |

Clara also perceives **interval shapes** (Sekunde=small, Terz=oval, larger intervals=lines) and **digit colors** (0-9).

### Alex's Mode Colors (Harmonic Perception)
Colors based on musical context and chord quality:

| Mode | Color | Hex |
|------|-------|-----|
| Major | Red/Orange | `#CC5544` |
| Minor | Blue | `#3366CC` |

**Scale Degree Colors (I-VII):** Each degree has a unique color — I (gray), II (yellow), III (blue), IV (red), V (yellow), VI (green), VII (orange)

---

## 📡 Streaming Setup

### For OBS / MadMapper / Resolume

1. Start the stream server:
   ```bash
   node stream-server.js
   ```

2. Open `stream-client.html` in a browser

3. In your VJ software:
   - Add a browser/web source
   - URL: `http://localhost:9876`
   - Resolution: 1920×1080

---

## 🤖 AI Image Setup (Optional)

Requires [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running locally.

1. Install ComfyUI with desired checkpoints
2. Start ComfyUI: `python main.py`
3. In Synästhesie, the AI panel will auto-connect to `localhost:8188`

### Supported Models
- **SD 1.5**: v1-5-pruned-emaonly.safetensors
- **SDXL**: sd_xl_base_1.0.safetensors  
- **Turbo**: sd_turbo.safetensors

---

## 🔧 Configuration

### Adding Custom 3D Models

Create a new folder in `3d-models/` named `set_XX/` containing 25 GLB files:

```
set_04/
├── 01_prime.glb
├── 02_kleine_sekunde.glb
├── 03_grosse_sekunde.glb
...
└── 25_doppelte_oktave.glb
```

The app automatically detects new model sets on startup.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No audio detected | Check microphone permissions in system settings |
| Models not loading | Verify GLB files exist in `3d-models/` |
| MIDI not working | Connect MIDI device before launching app |
| Speech recognition fails | Use Chrome/Chromium (Web Speech API required) |
| ComfyUI not connecting | Ensure ComfyUI is running on port 8188 |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) — 3D graphics library
- [Electron](https://www.electronjs.org/) — Desktop app framework
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) — AI image generation

---

<p align="center">
  <i>Visualizing the invisible connection between sound and color.</i>
</p>
