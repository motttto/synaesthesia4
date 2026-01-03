/**
 * STREAM FÜR OBS / MADMAPPER
 * 
 * Clean Output Canvas - alle visuellen Elemente zusammengeführt
 * - Separates Fenster für OBS Window Capture
 * - WebSocket-basierter Video-Stream (optional)
 * - 1920x1080 Output @ 30fps
 */

import { colorState } from '../config/colors.js';

// ============================================
// CONSTANTS
// ============================================

let STREAM_FPS = 60; // Erhöht von 30 auf 60 für niedrigere Latenz
const STREAM_WIDTH = 1920;
const STREAM_HEIGHT = 1080;

// ============================================
// STATE
// ============================================

export const streamState = {
    enabled: false,
    port: 9876,
    cleanOutputEnabled: false,
    cleanOutputWindow: null,
    
    // Video Output Processing
    outputGain: 1.0,      // 0.0 - 2.0 (Helligkeit/Verstärkung)
    outputGamma: 1.0,     // 0.5 - 2.0 (Gamma-Korrektur)
    outputContrast: 1.0,  // 0.5 - 2.0
    outputSaturation: 1.0, // 0.0 - 2.0
    
    // Color EQ (RGB Gains)
    eqRed: 1.0,           // 0.0 - 2.0
    eqGreen: 1.0,         // 0.0 - 2.0
    eqBlue: 1.0           // 0.0 - 2.0
};

let streamFrameInterval = null;
let mainCanvas = null;
let streamStatusEl = null;

// Separater Canvas für Stream-Output (Clean Output)
const streamCanvas = document.createElement('canvas');
streamCanvas.width = STREAM_WIDTH;
streamCanvas.height = STREAM_HEIGHT;
streamCanvas.id = 'cleanOutputCanvas';
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
// CLEAN OUTPUT WINDOW
// ============================================

/**
 * Öffnet ein separates Fenster mit dem Clean Output
 * Perfekt für OBS Window Capture
 */
export function openCleanOutputWindow() {
    // Falls bereits offen, fokussieren
    if (streamState.cleanOutputWindow && !streamState.cleanOutputWindow.closed) {
        streamState.cleanOutputWindow.focus();
        return streamState.cleanOutputWindow;
    }
    
    // Neues Fenster öffnen
    const windowFeatures = `width=${STREAM_WIDTH},height=${STREAM_HEIGHT},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
    streamState.cleanOutputWindow = window.open('', 'SynaesthesiaCleanOutput', windowFeatures);
    
    if (!streamState.cleanOutputWindow) {
        console.error('Popup blocked! Bitte Popups erlauben.');
        alert('Popup blocked! Bitte erlaube Popups für diese Seite.');
        return null;
    }
    
    // HTML für das neue Fenster
    streamState.cleanOutputWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Synästhesie - Clean Output</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    background: #000; 
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                #cleanCanvas {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .info {
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    color: #666;
                    font-family: monospace;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                body:hover .info { opacity: 1; }
            </style>
        </head>
        <body>
            <canvas id="cleanCanvas" width="${STREAM_WIDTH}" height="${STREAM_HEIGHT}"></canvas>
            <div class="info">
                Synästhesie Clean Output<br>
                ${STREAM_WIDTH}x${STREAM_HEIGHT} @ ${STREAM_FPS}fps<br>
                Nutze OBS "Window Capture" für dieses Fenster
            </div>
        </body>
        </html>
    `);
    streamState.cleanOutputWindow.document.close();
    
    // Canvas Referenz holen
    const cleanCanvas = streamState.cleanOutputWindow.document.getElementById('cleanCanvas');
    const cleanCtx = cleanCanvas.getContext('2d');
    
    // Render-Loop für das Clean Output Fenster
    // WICHTIG: setInterval statt requestAnimationFrame - damit es im Hintergrund weiterläuft!
    let cleanOutputInterval = null;
    
    function renderCleanOutput() {
        if (streamState.cleanOutputWindow?.closed) {
            streamState.cleanOutputWindow = null;
            streamState.cleanOutputEnabled = false;
            updateCleanOutputButton(false);
            if (cleanOutputInterval) {
                clearInterval(cleanOutputInterval);
                cleanOutputInterval = null;
            }
            return;
        }
        
        // Frame vom Stream-Canvas kopieren
        cleanCtx.drawImage(streamCanvas, 0, 0);
    }
    
    // 60fps mit setInterval (läuft auch im Hintergrund!)
    // ~16.67ms interval für 60fps
    cleanOutputInterval = setInterval(renderCleanOutput, 1000 / STREAM_FPS);
    
    // Cleanup wenn Fenster geschlossen wird
    streamState.cleanOutputWindow.addEventListener('beforeunload', () => {
        if (cleanOutputInterval) {
            clearInterval(cleanOutputInterval);
            cleanOutputInterval = null;
        }
    });
    
    streamState.cleanOutputEnabled = true;
    updateCleanOutputButton(true);
    renderCleanOutput();
    
    console.log('Clean Output Window geöffnet');
    return streamState.cleanOutputWindow;
}

/**
 * Schließt das Clean Output Fenster
 */
export function closeCleanOutputWindow() {
    if (streamState.cleanOutputWindow && !streamState.cleanOutputWindow.closed) {
        streamState.cleanOutputWindow.close();
    }
    streamState.cleanOutputWindow = null;
    streamState.cleanOutputEnabled = false;
    updateCleanOutputButton(false);
}

/**
 * Toggle Clean Output Fenster
 */
export function toggleCleanOutputWindow() {
    if (streamState.cleanOutputEnabled && streamState.cleanOutputWindow && !streamState.cleanOutputWindow.closed) {
        closeCleanOutputWindow();
    } else {
        openCleanOutputWindow();
    }
}

/**
 * Aktualisiert den Clean Output Button Status
 */
function updateCleanOutputButton(active) {
    const btn = document.getElementById('cleanOutputBtn');
    if (btn) {
        btn.classList.toggle('active', active);
        btn.textContent = active ? '🖥️ Clean Output (Open)' : '🖥️ Clean Output';
    }
}

// ============================================
// CAPTURE FUNCTIONS
// ============================================

/**
 * Berechnet Crop-Parameter für Cover-Skalierung
 */
function calculateCropParams(srcWidth, srcHeight) {
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
    
    return { sx, sy, sw, sh };
}

/**
 * Composited alle visuellen Layer auf den Stream Canvas
 * Wird im Animation Loop aufgerufen
 */
export function compositeCleanOutput() {
    if (!mainCanvas) return;
    
    const { sx, sy, sw, sh } = calculateCropParams(mainCanvas.width, mainCanvas.height);
    
    // === LAYER 1: Schwarzer Hintergrund ===
    streamCtx.fillStyle = 'rgb(0,0,0)';
    streamCtx.fillRect(0, 0, STREAM_WIDTH, STREAM_HEIGHT);
    
    // === LAYER 2: 3D Canvas (Three.js mit Post-Processing) ===
    streamCtx.drawImage(
        mainCanvas,
        sx, sy, sw, sh,
        0, 0, STREAM_WIDTH, STREAM_HEIGHT
    );
    
    // === LAYER 3: Vignette (Alex-Schema) ===
    drawStreamVignette();
    
    // === LAYER 4: Camera Overlay (inkl. Skeleton Tracking) ===
    const cameraOverlay = document.getElementById('cameraOverlayCanvas');
    if (cameraOverlay && cameraOverlay.width > 0 && cameraOverlay.height > 0) {
        try {
            streamCtx.drawImage(cameraOverlay, 0, 0, STREAM_WIDTH, STREAM_HEIGHT);
        } catch (e) {
            console.warn('[Stream] Camera overlay draw failed:', e);
        }
    }
    
    // === LAYER 5: AI Overlay Canvas ===
    const aiOverlay = document.getElementById('aiOverlayCanvas');
    if (aiOverlay && aiOverlay.width > 0 && aiOverlay.style.display !== 'none') {
        streamCtx.drawImage(
            aiOverlay,
            sx, sy, sw, sh,
            0, 0, STREAM_WIDTH, STREAM_HEIGHT
        );
    }
    
    // === LAYER 6: AI Bild (Fallback) ===
    drawStreamAiImage();
}

/**
 * Erfasst einen Stream-Frame für WebSocket-Streaming
 * Niedrigere Qualität = schnellere Encodierung = weniger Latenz
 */
function captureStreamFrame() {
    // Composite wird bereits im Animation Loop aufgerufen
    // Qualität 0.7 statt 0.85 für schnelleres Encoding
    return streamCanvas.toDataURL('image/jpeg', 0.7);
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
    
    // Smooth Gradient Stops (identisch mit HTML-Vignette)
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
// STREAM CONTROL (WebSocket)
// ============================================

let lastFrameTime = 0;
let frameInterval = 1000 / STREAM_FPS;

/**
 * Erfasst und sendet einen Stream-Frame via WebSocket
 * Wird nur alle ~33ms (30fps) tatsächlich gesendet
 */
export function captureAndSendFrame() {
    // Composite immer ausführen (für Clean Output Fenster)
    compositeCleanOutput();
    
    // WebSocket-Streaming nur wenn aktiviert
    if (!streamState.enabled || !window.electronAPI?.stream) return;
    
    const now = performance.now();
    if (now - lastFrameTime < frameInterval) return;
    lastFrameTime = now;
    
    const dataUrl = captureStreamFrame();
    if (dataUrl) {
        window.electronAPI.stream.sendFrame(dataUrl);
    }
}

/**
 * Startet WebSocket Stream
 */
export function startStreamCapture() {
    if (streamFrameInterval) {
        clearInterval(streamFrameInterval);
        streamFrameInterval = null;
    }
    console.log(`Stream aktiviert @ ${STREAM_FPS}fps, ${STREAM_WIDTH}x${STREAM_HEIGHT}`);
}

/**
 * Stoppt WebSocket Stream
 */
export function stopStreamCapture() {
    if (streamFrameInterval) {
        clearInterval(streamFrameInterval);
        streamFrameInterval = null;
    }
    console.log('Stream gestoppt');
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
            streamStatusEl.innerHTML = `<span style="font-size:7px;color:#888;">MJPEG:</span> localhost:${port}/stream`;
            streamStatusEl.title = 'Click to copy MJPEG URL for OBS';
            
            // Click to copy
            streamStatusEl.onclick = () => {
                const url = `http://localhost:${port}/stream`;
                navigator.clipboard.writeText(url).then(() => {
                    streamStatusEl.classList.add('copied');
                    const original = streamStatusEl.innerHTML;
                    streamStatusEl.innerHTML = '✅ URL copied!';
                    setTimeout(() => {
                        streamStatusEl.innerHTML = original;
                        streamStatusEl.classList.remove('copied');
                    }, 1500);
                }).catch(() => {
                    // Fallback
                    prompt('MJPEG URL für OBS:', url);
                });
            };
        }
    } else {
        stopStreamCapture();
        if (streamStatusEl) {
            streamStatusEl.classList.remove('active');
            streamStatusEl.onclick = null;
        }
    }
}

// ============================================
// SETTERS
// ============================================

export function setMainCanvas(canvas) {
    mainCanvas = canvas;
}

export function updateAiState(state) {
    aiState = { ...aiState, ...state };
}

// ============================================
// INITIALIZATION
// ============================================

export function initStream() {
    mainCanvas = document.getElementById('canvas');
    streamStatusEl = document.getElementById('streamStatus');
    
    // Clean Output Button
    const cleanOutputBtn = document.getElementById('cleanOutputBtn');
    if (cleanOutputBtn) {
        cleanOutputBtn.addEventListener('click', toggleCleanOutputWindow);
    }
    
    // Electron Stream Events
    if (window.electronAPI?.stream) {
        window.electronAPI.stream.onStatusChange((data) => {
            setStreamEnabled(data.enabled, data.port || 9876);
        });
        
        if (window.electronAPI.stream.getStatus) {
            window.electronAPI.stream.getStatus().then(status => {
                if (status && status.enabled) {
                    setStreamEnabled(true, status.port);
                }
            }).catch(() => {});
        }
    }
    
    console.log('Stream System initialisiert');
}

// ============================================
// GETTERS
// ============================================

export function isStreamEnabled() {
    return streamState.enabled;
}

export function isCleanOutputEnabled() {
    return streamState.cleanOutputEnabled;
}

export function getStreamCanvas() {
    return streamCanvas;
}

export function getStreamDimensions() {
    return { width: STREAM_WIDTH, height: STREAM_HEIGHT };
}

export function getStreamFPS() {
    return STREAM_FPS;
}

/**
 * Setzt die Stream-FPS (30 oder 60)
 * Höhere FPS = niedrigere Latenz, mehr CPU
 */
export function setStreamFPS(fps) {
    STREAM_FPS = Math.max(30, Math.min(120, fps));
    frameInterval = 1000 / STREAM_FPS;
    console.log(`🎥 Stream FPS gesetzt auf ${STREAM_FPS}`);
    return STREAM_FPS;
}
