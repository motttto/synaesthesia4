/**
 * SKELETON TRACKER
 * 
 * Pose Estimation für Kamera-Input
 * - Mehrere Tracking-Modelle gleichzeitig (MediaPipe, MoveNet)
 * - Separate Farben pro Modell
 * - Skeleton Visualisierung
 * - Landmark-Daten für weitere Verarbeitung
 */

// ============================================
// STATE
// ============================================

export const skeletonState = {
    // Aktive Modelle (können mehrere gleichzeitig sein)
    activeModels: new Set(),  // 'mediapipe', 'movenet-lightning', 'movenet-thunder'
    loading: new Set(),
    ready: new Set(),
    
    // Detection Results pro Modell
    results: {
        'mediapipe': { landmarks: null, worldLandmarks: null },
        'movenet-lightning': { landmarks: null },
        'movenet-thunder': { landmarks: null }
    },
    
    // Visualization Settings pro Modell
    modelStyles: {
        'mediapipe': {
            color: '#00ff00',      // Grün
            pointColor: '#00ff00',
            lineWidth: 3,
            pointRadius: 5
        },
        'movenet-lightning': {
            color: '#ff00ff',      // Magenta
            pointColor: '#ff00ff',
            lineWidth: 3,
            pointRadius: 5
        },
        'movenet-thunder': {
            color: '#00ffff',      // Cyan
            pointColor: '#00ffff',
            lineWidth: 3,
            pointRadius: 5
        }
    },
    
    // Global Settings
    showSkeleton: true,
    showPoints: true,
    showLabels: false,
    opacity: 1.0,  // Skeleton Opacity (0-1)
    
    // Performance
    fps: {}
};

// Detector instances
let mediapipePose = null;
let movenetLightning = null;
let movenetThunder = null;

// MediaPipe Pose Connections (für Skeleton-Linien)
const POSE_CONNECTIONS_MEDIAPIPE = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    // Torso
    [9, 10], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    // Arms
    [15, 17], [15, 19], [15, 21], [17, 19],
    [16, 18], [16, 20], [16, 22], [18, 20],
    // Legs
    [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]
];

// MoveNet Connections (17 Keypoints)
const POSE_CONNECTIONS_MOVENET = [
    [0, 1], [0, 2], [1, 3], [2, 4],  // Face
    [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],  // Arms
    [5, 11], [6, 12], [11, 12],  // Torso
    [11, 13], [13, 15], [12, 14], [14, 16]  // Legs
];

// Landmark Namen (MediaPipe - 33 points)
const LANDMARK_NAMES_MEDIAPIPE = [
    'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
    'right_eye_inner', 'right_eye', 'right_eye_outer',
    'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
    'left_index', 'right_index', 'left_thumb', 'right_thumb',
    'left_hip', 'right_hip', 'left_knee', 'right_knee',
    'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index'
];

// MoveNet Namen (17 points)
const LANDMARK_NAMES_MOVENET = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

// ============================================
// MODEL LOADING
// ============================================

/**
 * Lädt ein spezifisches Modell
 */
export async function loadSkeletonModel(modelName) {
    if (skeletonState.loading.has(modelName)) return;
    if (skeletonState.ready.has(modelName)) return; // Bereits geladen
    
    skeletonState.loading.add(modelName);
    updateModelStatus(modelName, 'loading');
    
    try {
        if (modelName === 'mediapipe') {
            await loadMediaPipePose();
        } else if (modelName === 'movenet-lightning') {
            await loadMoveNet('lightning');
        } else if (modelName === 'movenet-thunder') {
            await loadMoveNet('thunder');
        }
        
        skeletonState.ready.add(modelName);
        skeletonState.activeModels.add(modelName);
        updateModelStatus(modelName, 'ready');
        console.log(`Skeleton model loaded: ${modelName}`);
        
    } catch (err) {
        console.error(`Failed to load skeleton model ${modelName}:`, err);
        updateModelStatus(modelName, 'error', err.message);
    }
    
    skeletonState.loading.delete(modelName);
}

/**
 * Entlädt ein spezifisches Modell
 */
export async function unloadSkeletonModel(modelName) {
    if (modelName === 'mediapipe' && mediapipePose) {
        mediapipePose.close();
        mediapipePose = null;
    } else if (modelName === 'movenet-lightning' && movenetLightning) {
        movenetLightning.dispose();
        movenetLightning = null;
    } else if (modelName === 'movenet-thunder' && movenetThunder) {
        movenetThunder.dispose();
        movenetThunder = null;
    }
    
    skeletonState.ready.delete(modelName);
    skeletonState.activeModels.delete(modelName);
    skeletonState.results[modelName] = { landmarks: null };
    updateModelStatus(modelName, 'disabled');
}

/**
 * Toggle Modell an/aus
 */
export async function toggleSkeletonModel(modelName, enabled) {
    if (enabled) {
        await loadSkeletonModel(modelName);
    } else {
        await unloadSkeletonModel(modelName);
    }
}

/**
 * Lädt MediaPipe Pose
 */
async function loadMediaPipePose() {
    // Prüfen ob MediaPipe bereits geladen
    if (typeof Pose === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    }
    
    mediapipePose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });
    
    mediapipePose.setOptions({
        modelComplexity: 1,  // 0=lite, 1=full, 2=heavy
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    mediapipePose.onResults(onMediaPipeResults);
    
    await mediapipePose.initialize();
}

/**
 * Lädt TensorFlow MoveNet
 */
async function loadMoveNet(variant) {
    // TensorFlow.js laden falls nicht vorhanden
    if (typeof tf === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
    }
    if (typeof poseDetection === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
    }
    
    const modelType = variant === 'thunder' 
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
    
    const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType }
    );
    
    if (variant === 'thunder') {
        movenetThunder = detector;
    } else {
        movenetLightning = detector;
    }
}

/**
 * Script dynamisch laden
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// DETECTION
// ============================================

/**
 * Führt Pose Detection mit allen aktiven Modellen durch
 */
export async function detectAllPoses(videoElement) {
    if (skeletonState.activeModels.size === 0) return;
    if (!videoElement || videoElement.readyState < 2) return;
    
    const promises = [];
    
    for (const modelName of skeletonState.activeModels) {
        if (!skeletonState.ready.has(modelName)) continue;
        promises.push(detectWithModel(modelName, videoElement));
    }
    
    await Promise.all(promises);
}

/**
 * Detection mit einem spezifischen Modell
 */
async function detectWithModel(modelName, videoElement) {
    const startTime = performance.now();
    
    try {
        if (modelName === 'mediapipe' && mediapipePose) {
            await mediapipePose.send({ image: videoElement });
            // Results über Callback
        } else if (modelName === 'movenet-lightning' && movenetLightning) {
            const poses = await movenetLightning.estimatePoses(videoElement);
            if (poses.length > 0) {
                skeletonState.results['movenet-lightning'].landmarks = poses[0].keypoints.map(kp => ({
                    x: kp.x / videoElement.videoWidth,
                    y: kp.y / videoElement.videoHeight,
                    z: 0,
                    visibility: kp.score
                }));
            } else {
                skeletonState.results['movenet-lightning'].landmarks = null;
            }
        } else if (modelName === 'movenet-thunder' && movenetThunder) {
            const poses = await movenetThunder.estimatePoses(videoElement);
            if (poses.length > 0) {
                skeletonState.results['movenet-thunder'].landmarks = poses[0].keypoints.map(kp => ({
                    x: kp.x / videoElement.videoWidth,
                    y: kp.y / videoElement.videoHeight,
                    z: 0,
                    visibility: kp.score
                }));
            } else {
                skeletonState.results['movenet-thunder'].landmarks = null;
            }
        }
        
        const elapsed = performance.now() - startTime;
        skeletonState.fps[modelName] = Math.round(1000 / elapsed);
        
    } catch (err) {
        console.warn(`Pose detection error (${modelName}):`, err);
    }
}

/**
 * MediaPipe Results Callback
 */
function onMediaPipeResults(results) {
    if (results.poseLandmarks) {
        skeletonState.results['mediapipe'].landmarks = results.poseLandmarks;
        skeletonState.results['mediapipe'].worldLandmarks = results.poseWorldLandmarks || null;
    } else {
        skeletonState.results['mediapipe'].landmarks = null;
        skeletonState.results['mediapipe'].worldLandmarks = null;
    }
}

// ============================================
// VISUALIZATION
// ============================================

/**
 * Zeichnet alle aktiven Skeletons
 */
export function drawAllSkeletons(ctx, canvasWidth, canvasHeight, mirror = false) {
    if (skeletonState.opacity <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = skeletonState.opacity;
    
    for (const modelName of skeletonState.activeModels) {
        const result = skeletonState.results[modelName];
        if (!result || !result.landmarks) continue;
        
        const style = skeletonState.modelStyles[modelName];
        const connections = modelName === 'mediapipe' ? POSE_CONNECTIONS_MEDIAPIPE : POSE_CONNECTIONS_MOVENET;
        
        drawSkeletonSingle(ctx, canvasWidth, canvasHeight, result.landmarks, connections, style, mirror, modelName);
    }
    
    ctx.restore();
}

/**
 * Zeichnet ein einzelnes Skeleton
 */
function drawSkeletonSingle(ctx, canvasWidth, canvasHeight, landmarks, connections, style, mirror, label) {
    if (!landmarks || landmarks.length === 0) return;
    
    ctx.save();
    
    if (mirror) {
        ctx.translate(canvasWidth, 0);
        ctx.scale(-1, 1);
    }
    
    // Verbindungen zeichnen
    if (skeletonState.showSkeleton) {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.lineCap = 'round';
        
        for (const [startIdx, endIdx] of connections) {
            if (startIdx >= landmarks.length || endIdx >= landmarks.length) continue;
            
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];
            
            if ((start.visibility || 0) < 0.5 || (end.visibility || 0) < 0.5) continue;
            
            ctx.beginPath();
            ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
            ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);
            ctx.stroke();
        }
    }
    
    // Punkte zeichnen
    if (skeletonState.showPoints) {
        ctx.fillStyle = style.pointColor;
        
        for (const landmark of landmarks) {
            if ((landmark.visibility || 0) < 0.5) continue;
            
            ctx.beginPath();
            ctx.arc(
                landmark.x * canvasWidth,
                landmark.y * canvasHeight,
                style.pointRadius,
                0,
                2 * Math.PI
            );
            ctx.fill();
        }
    }
    
    // Label zeichnen
    if (skeletonState.showLabels && landmarks[0]) {
        ctx.restore(); // Mirror aufheben für Text
        ctx.save();
        
        const noseX = mirror ? canvasWidth - landmarks[0].x * canvasWidth : landmarks[0].x * canvasWidth;
        const noseY = landmarks[0].y * canvasHeight - 30;
        
        ctx.font = '12px monospace';
        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.fillText(label, noseX, noseY);
    }
    
    ctx.restore();
}

// ============================================
// GETTERS
// ============================================

/**
 * Gibt Landmarks eines spezifischen Modells zurück
 */
export function getLandmarks(modelName = 'mediapipe') {
    return skeletonState.results[modelName]?.landmarks || null;
}

/**
 * Gibt spezifischen Landmark nach Namen zurück
 */
export function getLandmark(name, modelName = 'mediapipe') {
    const landmarks = skeletonState.results[modelName]?.landmarks;
    if (!landmarks) return null;
    
    const names = modelName === 'mediapipe' ? LANDMARK_NAMES_MEDIAPIPE : LANDMARK_NAMES_MOVENET;
    const index = names.indexOf(name);
    
    if (index === -1 || index >= landmarks.length) return null;
    return landmarks[index];
}

/**
 * Gibt alle Landmarks als Object zurück
 */
export function getAllLandmarks(modelName = 'mediapipe') {
    const landmarks = skeletonState.results[modelName]?.landmarks;
    if (!landmarks) return null;
    
    const names = modelName === 'mediapipe' ? LANDMARK_NAMES_MEDIAPIPE : LANDMARK_NAMES_MOVENET;
    const result = {};
    
    names.forEach((name, index) => {
        if (index < landmarks.length) {
            result[name] = landmarks[index];
        }
    });
    
    return result;
}

/**
 * Gibt Liste der aktiven Modelle zurück
 */
export function getActiveModels() {
    return Array.from(skeletonState.activeModels);
}

// ============================================
// SETTERS
// ============================================

export function setShowSkeleton(show) {
    skeletonState.showSkeleton = show;
}

export function setShowPoints(show) {
    skeletonState.showPoints = show;
}

export function setShowLabels(show) {
    skeletonState.showLabels = show;
}

export function setSkeletonOpacity(opacity) {
    skeletonState.opacity = Math.max(0, Math.min(1, opacity));
}

export function setModelColor(modelName, color) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].color = color;
        skeletonState.modelStyles[modelName].pointColor = color;
    }
}

export function setModelLineWidth(modelName, width) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].lineWidth = width;
    }
}

export function setModelPointRadius(modelName, radius) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].pointRadius = radius;
    }
}

// ============================================
// UI
// ============================================

function updateModelStatus(modelName, status, detail = '') {
    const statusEl = document.getElementById(`skeleton-status-${modelName}`);
    if (!statusEl) return;
    
    switch (status) {
        case 'loading':
            statusEl.textContent = '⏳';
            statusEl.title = 'Loading...';
            break;
        case 'ready':
            statusEl.textContent = '✅';
            statusEl.title = 'Ready';
            break;
        case 'disabled':
            statusEl.textContent = '';
            statusEl.title = '';
            break;
        case 'error':
            statusEl.textContent = '❌';
            statusEl.title = detail;
            break;
    }
    
    updateGlobalStatus();
}

function updateGlobalStatus() {
    const statusEl = document.getElementById('skeletonStatus');
    if (!statusEl) return;
    
    const activeCount = skeletonState.activeModels.size;
    const loadingCount = skeletonState.loading.size;
    
    if (loadingCount > 0) {
        statusEl.textContent = `⏳ Loading ${loadingCount} model(s)...`;
        statusEl.style.color = '#ff0';
    } else if (activeCount > 0) {
        const fps = Object.entries(skeletonState.fps)
            .filter(([k]) => skeletonState.activeModels.has(k))
            .map(([k, v]) => `${k.split('-')[0]}:${v}`)
            .join(' | ');
        statusEl.textContent = `✅ ${activeCount} active ${fps ? `(${fps} fps)` : ''}`;
        statusEl.style.color = '#4f4';
    } else {
        statusEl.textContent = '⚫ No models active';
        statusEl.style.color = '#666';
    }
}

export function initSkeletonUI() {
    // Model Checkboxen
    const models = ['mediapipe', 'movenet-lightning', 'movenet-thunder'];
    
    for (const modelName of models) {
        const checkbox = document.getElementById(`skeleton-${modelName}`);
        if (checkbox) {
            checkbox.addEventListener('change', async (e) => {
                await toggleSkeletonModel(modelName, e.target.checked);
            });
        }
        
        // Color Picker
        const colorInput = document.getElementById(`skeleton-color-${modelName}`);
        if (colorInput) {
            colorInput.value = skeletonState.modelStyles[modelName].color;
            colorInput.addEventListener('input', (e) => {
                setModelColor(modelName, e.target.value);
            });
        }
    }
    
    // Global Show Skeleton
    const showSkeletonCheckbox = document.getElementById('skeletonShowLines');
    if (showSkeletonCheckbox) {
        showSkeletonCheckbox.checked = skeletonState.showSkeleton;
        showSkeletonCheckbox.addEventListener('change', (e) => {
            setShowSkeleton(e.target.checked);
        });
    }
    
    // Global Show Points
    const showPointsCheckbox = document.getElementById('skeletonShowPoints');
    if (showPointsCheckbox) {
        showPointsCheckbox.checked = skeletonState.showPoints;
        showPointsCheckbox.addEventListener('change', (e) => {
            setShowPoints(e.target.checked);
        });
    }
    
    // Show Labels
    const showLabelsCheckbox = document.getElementById('skeletonShowLabels');
    if (showLabelsCheckbox) {
        showLabelsCheckbox.checked = skeletonState.showLabels;
        showLabelsCheckbox.addEventListener('change', (e) => {
            setShowLabels(e.target.checked);
        });
    }
    
    // Line Width (global)
    const lineWidthSlider = document.getElementById('skeletonLineWidth');
    if (lineWidthSlider) {
        lineWidthSlider.addEventListener('input', (e) => {
            const width = parseInt(e.target.value);
            for (const modelName of models) {
                setModelLineWidth(modelName, width);
            }
            const display = document.getElementById('skeletonLineWidthValue');
            if (display) display.textContent = e.target.value + 'px';
        });
    }
    
    // Skeleton Opacity
    const skeletonOpacitySlider = document.getElementById('skeletonOpacity');
    if (skeletonOpacitySlider) {
        skeletonOpacitySlider.value = skeletonState.opacity * 100;
        skeletonOpacitySlider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value) / 100;
            setSkeletonOpacity(opacity);
            const display = document.getElementById('skeletonOpacityValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // FPS Update Interval
    setInterval(updateGlobalStatus, 500);
    
    updateGlobalStatus();
    console.log('Skeleton UI initialized (multi-model)');
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupSkeleton() {
    for (const modelName of [...skeletonState.activeModels]) {
        await unloadSkeletonModel(modelName);
    }
}

// Legacy exports für Kompatibilität
export const detectPose = detectAllPoses;
export const drawSkeleton = drawAllSkeletons;
