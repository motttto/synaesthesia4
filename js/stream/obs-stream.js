/**
 * STREAM FÜR OBS / MADMAPPER
 * 
 * WebSocket-basierter Video-Stream
 * - 1920x1080 Output
 * - 30fps
 * - Mit Vignette und AI-Bild Support
 */

import { colorState } from '../config/colors.js';

// ============================================
// CONSTANTS
// ============================================

const STREAM_FPS = 30;
const STREAM_WIDTH = 1920;
const STREAM_HEIGHT = 1080;

// ============================================
// STATE
// ============================================

export const streamState = {
    enabled: false,
    port: 9876
};

let streamFrameInterval = null;
let mainCanvas = null;
let streamStatusEl = null;

// Separater Canvas für Stream-Output
const streamCanvas = document.createElement('canvas');
streamCanvas.width = STREAM_WIDTH;
streamCanvas.height = STREAM_HEIGHT;
const streamCtx = streamCanvas.getContext('2d');

// AI Image State (wird von AI-Modul gesetzt)
let aiState = {
    mode: 'off',
    currentImage: null,
    nextImage: null,
    loadedImage: null,
    crossfadeProgress: 1
};

// ============================================
// CAPTURE FUNCTIONS
// ============================================

/**
 * Erfasst einen Stream-Frame
 */
function captureStreamFrame() {
    if (!mainCanvas) return null;
    
    // Berechne Skalierung um Canvas zu füllen (cover/crop)
    const srcWidth = mainCanvas.width;
    const srcHeight = mainCanvas.height;
    const srcAspect = srcWidth / srcHeight;
    const dstAspect = STREAM_WIDTH / STREAM_HEIGHT;
    
    let sx, sy, sw, sh;
    
    if (srcAspect > dstAspect) {
        // Quelle ist breiter -> links/rechts croppen
        sh = srcHeight;
        sw = srcHeight * dstAspect;
        sx = (srcWidth - sw) / 2;
        sy = 0;
    } else {
        // Quelle ist höher -> oben/unten croppen
        sw = srcWidth;
        sh = srcWidth / dstAspect;
        sx = 0;
        sy = (srcHeight - sh) / 2;
    }
    
    // Schwarzen Hintergrund
    streamCtx.fillStyle = 'rgb(0,0,0)';
    streamCtx.fillRect(0, 0, STREAM_WIDTH, STREAM_HEIGHT);
    
    // Canvas auf Stream-Canvas zeichnen
    streamCtx.drawImage(
        mainCanvas,
        sx, sy, sw, sh,
        0, 0, STREAM_WIDTH, STREAM_HEIGHT
    );
    
    // Vignette für Stream zeichnen
    drawStreamVignette();
    
    // AI Bild für Stream zeichnen
    drawStreamAiImage();
    
    return streamCanvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Zeichnet Vignette auf Stream Canvas
 */
function drawStreamVignette() {
    const vignetteColor = colorState.currentVignetteColor;
    if (!vignetteColor) return;
    
    const { r, g, b, a } = vignetteColor;
    const centerX = STREAM_WIDTH / 2;
    const centerY = STREAM_HEIGHT / 2;
    const maxRadius = Math.max(STREAM_WIDTH, STREAM_HEIGHT) * 0.9;
    
    const gradient = streamCtx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius
    );
    
    const rInt = Math.round(r * 255);
    const gInt = Math.round(g * 255);
    const bInt = Math.round(b * 255);
    
    // Smooth Gradient Stops
    const stops = [
        [0.00, 1.00], [0.03, 0.96], [0.06, 0.91], [0.09, 0.85],
        [0.12, 0.78], [0.15, 0.71], [0.18, 0.64], [0.21, 0.57],
        [0.24, 0.50], [0.27, 0.44], [0.30, 0.38], [0.33, 0.33],
        [0.36, 0.28], [0.39, 0.24], [0.42, 0.20], [0.45, 0.17],
        [0.48, 0.14], [0.51, 0.11], [0.54, 0.09], [0.57, 0.07],
        [0.60, 0.055], [0.63, 0.042], [0.66, 0.031], [0.69, 0.022],
        [0.72, 0.015], [0.75, 0.010], [0.78, 0.006], [0.81, 0.003],
        [0.84, 0.001], [0.88, 0.000], [1.00, 0.000]
    ];
    
    stops.forEach(([pos, alpha]) => {
        gradient.addColorStop(pos, `rgba(${rInt}, ${gInt}, ${bInt}, ${a * alpha})`);
    });
    
    streamCtx.fillStyle = gradient;
    streamCtx.fillRect(0, 0, STREAM_WIDTH, STREAM_HEIGHT);
}

/**
 * Zeichnet AI Bild auf Stream Canvas
 */
function drawStreamAiImage() {
    if (aiState.mode === 'off') return;
    
    try {
        const destW = Math.min(512, STREAM_WIDTH * 0.4);
        
        const drawImage = (img, alpha) => {
            if (!img || !img.complete || !img.naturalWidth) return;
            
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const dH = (imgH / imgW) * destW;
            const destX = (STREAM_WIDTH - destW) / 2;
            const destY = (STREAM_HEIGHT - dH) / 2;
            
            streamCtx.save();
            streamCtx.globalAlpha = alpha * (aiState.mode === 'overlay' ? 0.5 : 1);
            if (aiState.mode === 'overlay') {
                streamCtx.globalCompositeOperation = 'screen';
            }
            streamCtx.drawImage(img, destX, destY, destW, dH);
            streamCtx.restore();
        };
        
        // Crossfade im Stream
        if (aiState.currentImage && aiState.nextImage && aiState.crossfadeProgress < 1) {
            drawImage(aiState.currentImage, 1 - aiState.crossfadeProgress);
            drawImage(aiState.nextImage, aiState.crossfadeProgress);
        } else if (aiState.currentImage) {
            drawImage(aiState.currentImage, 1);
        } else if (aiState.loadedImage) {
            drawImage(aiState.loadedImage, 1);
        }
    } catch (e) {
        console.warn('AI Bild konnte nicht auf Stream Canvas gezeichnet werden:', e);
    }
}

// ============================================
// STREAM CONTROL
// ============================================

/**
 * Startet Stream Capture
 */
export function startStreamCapture() {
    if (streamFrameInterval) return;
    
    const frameTime = 1000 / STREAM_FPS;
    
    streamFrameInterval = setInterval(() => {
        if (!streamState.enabled || !window.electronAPI?.stream) return;
        
        const dataUrl = captureStreamFrame();
        if (dataUrl) {
            window.electronAPI.stream.sendFrame(dataUrl);
        }
    }, frameTime);
    
    console.log(`Stream Capture gestartet @ ${STREAM_FPS}fps, ${STREAM_WIDTH}x${STREAM_HEIGHT}`);
}

/**
 * Stoppt Stream Capture
 */
export function stopStreamCapture() {
    if (streamFrameInterval) {
        clearInterval(streamFrameInterval);
        streamFrameInterval = null;
    }
    console.log('Stream Capture gestoppt');
}

/**
 * Setzt Stream Status
 */
export function setStreamEnabled(enabled, port = 9876) {
    streamState.enabled = enabled;
    streamState.port = port;
    
    if (enabled) {
        startStreamCapture();
        if (streamStatusEl) {
            streamStatusEl.classList.add('active');
            streamStatusEl.textContent = `localhost:${port}`;
        }
    } else {
        stopStreamCapture();
        if (streamStatusEl) {
            streamStatusEl.classList.remove('active');
        }
    }
}

// ============================================
// SETTERS
// ============================================

/**
 * Setzt Referenz zum Main Canvas
 */
export function setMainCanvas(canvas) {
    mainCanvas = canvas;
}

/**
 * Aktualisiert AI State für Stream
 */
export function updateAiState(state) {
    aiState = { ...aiState, ...state };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialisiert Stream System
 */
export function initStream() {
    mainCanvas = document.getElementById('canvas');
    streamStatusEl = document.getElementById('streamStatus');
    
    // Electron Stream Events
    if (window.electronAPI?.stream) {
        window.electronAPI.stream.onStatusChange((data) => {
            setStreamEnabled(data.enabled, data.port || 9876);
        });
        
        // Initial Status abfragen
        if (window.electronAPI.stream.getStatus) {
            window.electronAPI.stream.getStatus().then(status => {
                if (status && status.enabled) {
                    setStreamEnabled(true, status.port);
                }
            }).catch(() => {});
        }
    }
}

// ============================================
// GETTERS
// ============================================

export function isStreamEnabled() {
    return streamState.enabled;
}

export function getStreamCanvas() {
    return streamCanvas;
}

export function getStreamDimensions() {
    return { width: STREAM_WIDTH, height: STREAM_HEIGHT };
}
