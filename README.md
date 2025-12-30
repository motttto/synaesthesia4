# 🎨 Synästhesie

**Real-time audio-to-visual synesthesia visualization combining music theory with 3D graphics.**

Transform sound into mesmerizing visuals using two distinct synesthetic color systems, 3D model morphing, and live performance streaming capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-28.0-47848F.svg)
![Three.js](https://img.shields.io/badge/three.js-0.160-black.svg)

---

## ✨ Features

### 🎵 Audio Analysis
- **Polyphonic pitch detection** with 6 algorithms (HPS, YIN, Autocorrelation, Cepstrum, Peak Detection)
- **Real-time BPM detection** with beat-synchronized effects
- **Percussion classification** (Kick, Snare, Hi-Hat, Tom, Crash)
- **3-band parametric EQ** with master gain control
- **MIDI input support** with built-in synthesizer

### 🎨 Dual Color Systems

| Clara's System | Alex's System |
|----------------|---------------|
| Absolute note colors | Relative chord colors |
| C=Red, D=Yellow, E=Green... | Minor=Blue, Major=Red/Orange |
| Sharp/flat variants | Scale degree colors (I-VII) |
| Applied to 3D models | Applied to background/vignette |

### 🌀 3D Visualization
- **25 interval-based 3D models** (Prime to Double Octave)
- **Smooth morphing transitions** between shapes
- **Multiple model sets** with automatic detection
- **GPU-accelerated particle systems**

### ⚡ Effects
- Glitch, Pulse, Edge Detection, Explode
- Particle trails with afterglow
- Audio-reactive scaling and FOV
- Depth of field blur

### 📡 Live Performance
- **WebSocket streaming** (1920×1080 @ 30fps)
- Compatible with MadMapper, OBS, Resolume
- Stream client for projection mapping

### 🤖 AI Image Generation (Experimental)
- **Local ComfyUI integration** for Stable Diffusion
- Multiple aspect ratios (1:1, 16:9, 4:3, 9:16, 21:9, Fit Screen)
- Speech-to-prompt with auto-generation
- SD 1.5, SDXL, and Turbo model support

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
│   │   └── particles.js     # GPU particle system
│   ├── models/
│   │   └── model-manager.js # GLTF loading & morphing
│   ├── effects/
│   │   └── visual-effects.js# Glitch, pulse, explode
│   ├── audio/
│   │   ├── audio-chain.js   # EQ, gain, analyser
│   │   ├── pitch-detector.js# Multi-algorithm detection
│   │   ├── beat-detector.js # BPM & beat sync
│   │   └── percussion.js    # Drum classification
│   ├── input/
│   │   ├── midi.js          # MIDI controller support
│   │   └── speech.js        # Speech recognition
│   ├── analysis/
│   │   ├── intervals.js     # Chord analysis
│   │   └── colors.js        # Color calculations
│   ├── camera/
│   │   └── controls.js      # Orbit, FOV, auto-rotate
│   ├── stream/
│   │   └── obs-stream.js    # WebSocket streaming
│   └── ai/
│       └── ai-image.js      # ComfyUI integration
├── 3d-models/
│   ├── set_01/              # Model set 1 (25 intervals)
│   ├── set_02/              # Model set 2
│   └── set_03/              # Model set 3
├── css/
│   └── styles.css           # UI styling
└── index.html               # Main application
```

---

## 🎹 Color Systems Explained

### Clara's Note Colors (Chromesthesia)
Each musical note has a fixed color regardless of context:

| Note | Color | Hex |
|------|-------|-----|
| C | Red | `#FF0000` |
| D | Yellow | `#FFFF00` |
| E | Green | `#00FF00` |
| F | Orange | `#FFA500` |
| G | Blue | `#0000FF` |
| A | Gray | `#808080` |
| B/H | Brown | `#8B4513` |

Sharps (♯) and flats (♭) have lighter/darker variants.

### Alex's Mode Colors (Harmonic Perception)
Colors based on musical context and chord quality:

- **Major** → Warm (Red/Orange)
- **Minor** → Cool (Blue)
- **Scale degrees I-VII** → Individual colors within chords

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
