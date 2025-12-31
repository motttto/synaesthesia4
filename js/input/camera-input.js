/**
 * CAMERA INPUT
 * 
 * USB/Webcam-Eingang mit Overlay-Funktion
 * - Kamera-Auswahl
 * - Overlay auf Canvas
 * - Audio-reaktive Opacity
 * - Als Textur für 3D Modelle
 * - Skeleton Tracking
 */

import { THREE } from '../core/three-setup.js';
import { modelState } from '../models/model-manager.js';
import { 
    skeletonState, detectAllPoses, drawAllSkeletons, 
    initSkeletonUI, loadSkeletonModel, cleanupSkeleton,
    getLandmark, getAllLandmarks, getLandmarks, getActiveModels,
    getHandLandmarks, getFaceLandmarks, getMappedPosition,
    setShowSkeleton, setShowPoints, setModelColor, setSkeletonOpacity,
    setModelMappingEnabled, setModelMappingTarget, setModelMappingSmoothing, setModelMappingScale
} from './skeleton-tracker.js';

// Re-export Skeleton functions
export { 
    skeletonState, loadSkeletonModel, cleanupSkeleton,
    getLandmark, getAllLandmarks, getLandmarks, getActiveModels,
    getHandLandmarks, getFaceLandmarks, getMappedPosition,
    setSkeletonOpacity, setModelMappingEnabled, setModelMappingTarget
};

// ============================================
// STATE
// ============================================

export const cameraInputState = {
    enabled: false,
    stream: null,
    videoElement: null,
    selectedDeviceId: null,
    
    // Overlay Settings
    opacity: 0.5,
    blendMode: 'normal', // 'normal', 'overlay', 'multiply', 'screen', 'add'
    
    // Audio-Reactive
    audioReactive: false,
    audioOpacityMin: 0.0,
    audioOpacityMax: 1.0,
    currentAudioLevel: 0,
    
    // Mirror/Flip
    mirror: false,
    
    // Als Textur für 3D Modelle
    useAsTexture: false,
    videoTexture: null,
    
    // Apply to all models (bei Wechsel Textur übertragen)
    applyToAllModels: true
};

// UI Elements
let cameraSelect = null;
let cameraCanvas = null;
let cameraCtx = null;
let opacitySlider = null;
let visibilityBtn = null;
let overlayCanvas = null;
let overlayCtx = null;

// ============================================
// DEVICE ENUMERATION
// ============================================

/**
 * Lädt verfügbare Video-Geräte
 */
export async function loadCameraDevices() {
    try {
        // Erst Berechtigung holen
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (cameraSelect) {
            cameraSelect.innerHTML = '<option value="">-- Select Camera --</option>';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
        }
        
        console.log(`Found ${videoDevices.length} camera(s)`);
        return videoDevices;
    } catch (err) {
        console.error('Camera enumeration failed:', err);
        return [];
    }
}

// ============================================
// CAMERA STREAM
// ============================================

/**
 * Startet den Kamera-Stream
 */
export async function startCamera(deviceId) {
    try {
        // Vorherigen Stream stoppen
        stopCamera();
        
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraInputState.stream = stream;
        cameraInputState.selectedDeviceId = deviceId;
        
        // Video Element erstellen
        if (!cameraInputState.videoElement) {
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.display = 'none';
            document.body.appendChild(video);
            cameraInputState.videoElement = video;
        }
        
        cameraInputState.videoElement.srcObject = stream;
        await cameraInputState.videoElement.play();
        
        cameraInputState.enabled = true;
        updateVisibilityBtn(true);
        updateCameraStatus('connected');
        
        // Falls Textur-Modus aktiv, auf Modell anwenden
        if (cameraInputState.useAsTexture) {
            // Kurz warten bis Video bereit ist
            setTimeout(() => applyCameraTextureToModel(), 100);
        }
        
        console.log('Camera started:', deviceId);
        return true;
    } catch (err) {
        console.error('Camera start failed:', err);
        updateCameraStatus('error');
        return false;
    }
}

/**
 * Stoppt den Kamera-Stream
 */
export function stopCamera() {
    // Textur entfernen
    removeCameraTextureFromModel();
    
    // VideoTexture aufräumen
    if (cameraInputState.videoTexture) {
        cameraInputState.videoTexture.dispose();
        cameraInputState.videoTexture = null;
    }
    
    if (cameraInputState.stream) {
        cameraInputState.stream.getTracks().forEach(track => track.stop());
        cameraInputState.stream = null;
    }
    
    if (cameraInputState.videoElement) {
        cameraInputState.videoElement.srcObject = null;
    }
    
    cameraInputState.enabled = false;
    updateVisibilityBtn(false);
    updateCameraStatus('disconnected');
    
    // Overlay leeren und Original-Canvas wieder sichtbar machen
    if (overlayCanvas && overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    const mainCanvas = document.getElementById('canvas');
    if (mainCanvas) {
        mainCanvas.style.opacity = '1';
    }
}

/**
 * Toggle Kamera an/aus
 */
export function toggleCamera() {
    if (cameraInputState.enabled) {
        stopCamera();
    } else if (cameraInputState.selectedDeviceId) {
        startCamera(cameraInputState.selectedDeviceId);
    } else if (cameraSelect?.value) {
        startCamera(cameraSelect.value);
    }
}

// ============================================
// OVERLAY RENDERING
// ============================================

/**
 * Rendert das Kamera-Overlay auf das Canvas
 * Wird im Animation Loop aufgerufen
 */
export async function renderCameraOverlay(targetCanvas, audioLevel = 0) {
    if (!cameraInputState.enabled || !cameraInputState.videoElement) return;
    if (!cameraInputState.videoElement.videoWidth) return;
    
    // Overlay Canvas erstellen/holen falls nicht vorhanden
    if (!overlayCanvas) {
        overlayCanvas = document.getElementById('cameraOverlayCanvas');
        if (!overlayCanvas) {
            overlayCanvas = document.createElement('canvas');
            overlayCanvas.id = 'cameraOverlayCanvas';
            overlayCanvas.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none !important;
                z-index: 2;
            `;
            document.body.appendChild(overlayCanvas);
        }
        overlayCtx = overlayCanvas.getContext('2d');
    }
    
    // Temporäres Canvas für Video
    if (!cameraCanvas) {
        cameraCanvas = document.createElement('canvas');
        cameraCtx = cameraCanvas.getContext('2d');
    }
    
    const video = cameraInputState.videoElement;
    
    // Canvas-Größe anpassen
    if (overlayCanvas.width !== targetCanvas.width || overlayCanvas.height !== targetCanvas.height) {
        overlayCanvas.width = targetCanvas.width;
        overlayCanvas.height = targetCanvas.height;
        cameraCanvas.width = targetCanvas.width;
        cameraCanvas.height = targetCanvas.height;
    }
    
    // Audio-Reactive Opacity mit aggressiver Kurve (nur für Kamera)
    let cameraOpacity = cameraInputState.opacity;
    if (cameraInputState.audioReactive) {
        cameraInputState.currentAudioLevel = audioLevel;
        const boostedLevel = Math.min(1, audioLevel * 3);
        const curved = Math.pow(boostedLevel, 0.5);
        const range = cameraInputState.audioOpacityMax - cameraInputState.audioOpacityMin;
        cameraOpacity = cameraInputState.audioOpacityMin + (curved * range);
    }
    
    // Clear all
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
    
    // Aspect Ratio berechnen für "cover"
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = cameraCanvas.width / cameraCanvas.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (videoAspect > canvasAspect) {
        drawHeight = cameraCanvas.height;
        drawWidth = drawHeight * videoAspect;
        offsetX = (cameraCanvas.width - drawWidth) / 2;
        offsetY = 0;
    } else {
        drawWidth = cameraCanvas.width;
        drawHeight = drawWidth / videoAspect;
        offsetX = 0;
        offsetY = (cameraCanvas.height - drawHeight) / 2;
    }
    
    // === SCHRITT 1: Video auf cameraCanvas zeichnen (ohne Skeleton!) ===
    if (cameraInputState.mirror) {
        cameraCtx.save();
        cameraCtx.scale(-1, 1);
        cameraCtx.drawImage(video, -offsetX - drawWidth, offsetY, drawWidth, drawHeight);
        cameraCtx.restore();
    } else {
        cameraCtx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    }
    
    // === SCHRITT 2: Kamera-Bild mit Camera Opacity auf Overlay rendern ===
    const blendMode = cameraInputState.blendMode;
    const useBlending = blendMode !== 'normal' && blendMode !== 'source-over';
    
    if (useBlending) {
        // Für echte Blend Modes: 3D-Canvas kopieren, dann Kamera drüber blenden
        overlayCtx.drawImage(targetCanvas, 0, 0);
        overlayCtx.globalAlpha = cameraOpacity;
        overlayCtx.globalCompositeOperation = getCompositeOperation(blendMode);
        overlayCtx.drawImage(cameraCanvas, 0, 0);
        overlayCtx.globalCompositeOperation = 'source-over';
        overlayCtx.globalAlpha = 1;
        
        // Original-Canvas ausblenden damit nur Overlay sichtbar ist
        targetCanvas.style.opacity = '0';
    } else {
        // Einfaches Overlay ohne Blending
        targetCanvas.style.opacity = '1';
        
        // Kamera-Bild mit Camera Opacity
        if (cameraOpacity > 0) {
            overlayCtx.globalAlpha = cameraOpacity;
            overlayCtx.drawImage(cameraCanvas, 0, 0);
            overlayCtx.globalAlpha = 1;
        }
    }
    
    // === SCHRITT 3: Skeleton Detection & Drawing (SEPARAT mit eigener Opacity) ===
    if (skeletonState.activeModels.size > 0) {
        await detectAllPoses(video);
        // Skeleton wird direkt auf overlayCanvas gezeichnet mit eigener Opacity
        drawAllSkeletons(overlayCtx, overlayCanvas.width, overlayCanvas.height, cameraInputState.mirror);
    }
}

/**
 * Konvertiert Blend Mode zu Canvas Composite Operation
 */
function getCompositeOperation(mode) {
    switch (mode) {
        case 'overlay': return 'overlay';
        case 'multiply': return 'multiply';
        case 'screen': return 'screen';
        case 'add': return 'lighter';
        case 'difference': return 'difference';
        case 'hard-light': return 'hard-light';
        case 'soft-light': return 'soft-light';
        default: return 'source-over';
    }
}

// ============================================
// SETTERS
// ============================================

export function setCameraOpacity(value) {
    cameraInputState.opacity = value;
}

export function setCameraBlendMode(mode) {
    cameraInputState.blendMode = mode;
}

export function setCameraAudioReactive(enabled) {
    cameraInputState.audioReactive = enabled;
}

export function setCameraAudioOpacityRange(min, max) {
    cameraInputState.audioOpacityMin = min;
    cameraInputState.audioOpacityMax = max;
}

export function setCameraMirror(enabled) {
    cameraInputState.mirror = enabled;
}

export function setCameraApplyToAllModels(enabled) {
    cameraInputState.applyToAllModels = enabled;
}

// ============================================
// TEXTURE FOR 3D MODELS
// ============================================

/**
 * Erstellt VideoTexture aus Kamera-Feed
 */
function createCameraTexture() {
    if (!cameraInputState.videoElement) return null;
    
    const texture = new THREE.VideoTexture(cameraInputState.videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    return texture;
}

/**
 * Wendet Kamera als Textur auf alle Modell-Materialien an
 */
export function applyCameraTextureToModel() {
    if (!cameraInputState.useAsTexture || !cameraInputState.videoElement) {
        removeCameraTextureFromModel();
        return;
    }
    
    if (!modelState.currentModel) return;
    
    // Textur erstellen falls nicht vorhanden
    if (!cameraInputState.videoTexture) {
        cameraInputState.videoTexture = createCameraTexture();
    }
    
    if (!cameraInputState.videoTexture) return;
    
    // Direkt auf aktuellem Modell traversieren (zuverlässiger als modelMaterials)
    let meshCount = 0;
    modelState.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.map = cameraInputState.videoTexture;
            child.material.needsUpdate = true;
            meshCount++;
        }
    });
    
    console.log(`Camera texture applied to ${meshCount} meshes`);
}

/**
 * Entfernt Kamera-Textur von Modellen
 */
export function removeCameraTextureFromModel() {
    if (!modelState.currentModel) return;
    
    modelState.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
            if (child.material.map === cameraInputState.videoTexture) {
                child.material.map = null;
                child.material.needsUpdate = true;
            }
        }
    });
}

/**
 * Toggle Kamera als Textur
 */
export function setCameraAsTexture(enabled) {
    cameraInputState.useAsTexture = enabled;
    
    if (enabled && cameraInputState.enabled) {
        applyCameraTextureToModel();
    } else {
        removeCameraTextureFromModel();
        lastCameraModelUuid = null;
    }
}

/**
 * Update Textur (im Animation Loop aufrufen wenn nötig)
 */
export function updateCameraTexture() {
    if (cameraInputState.videoTexture && cameraInputState.useAsTexture) {
        cameraInputState.videoTexture.needsUpdate = true;
    }
}

/**
 * Callback für Modellwechsel - Textur auf neues Modell anwenden
 */
let lastCameraModelUuid = null;

export function onCameraModelChanged() {
    // Nur wenn Textur-Modus aktiv UND "Apply to All" aktiviert ist
    if (!cameraInputState.useAsTexture || !cameraInputState.enabled || !cameraInputState.applyToAllModels) return;
    
    const currentUuid = modelState.currentModel?.uuid;
    if (currentUuid === lastCameraModelUuid) return;
    
    lastCameraModelUuid = currentUuid;
    
    setTimeout(() => {
        applyCameraTextureToModel();
    }, 100);
}

// ============================================
// UI HELPERS
// ============================================

function updateVisibilityBtn(active) {
    if (!visibilityBtn) return;
    
    if (active) {
        visibilityBtn.classList.add('active');
        visibilityBtn.title = 'Disable Camera';
    } else {
        visibilityBtn.classList.remove('active');
        visibilityBtn.title = 'Enable Camera';
    }
}

function updateCameraStatus(status) {
    const statusEl = document.getElementById('cameraInputStatus');
    if (!statusEl) return;
    
    switch (status) {
        case 'connected':
            statusEl.textContent = '🟢 Connected';
            statusEl.style.color = '#4f4';
            break;
        case 'disconnected':
            statusEl.textContent = '⚫ Disconnected';
            statusEl.style.color = '#666';
            break;
        case 'error':
            statusEl.textContent = '🔴 Error';
            statusEl.style.color = '#f44';
            break;
    }
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initCameraInputUI() {
    cameraSelect = document.getElementById('cameraInputSelect');
    visibilityBtn = document.getElementById('cameraInputVisibilityBtn');
    opacitySlider = document.getElementById('cameraInputOpacity');
    
    // Refresh Button
    const refreshBtn = document.getElementById('cameraInputRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCameraDevices);
    }
    
    // Camera Select
    if (cameraSelect) {
        cameraSelect.addEventListener('change', async (e) => {
            if (e.target.value) {
                await startCamera(e.target.value);
            } else {
                stopCamera();
            }
        });
    }
    
    // Visibility Button
    if (visibilityBtn) {
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCamera();
        });
    }
    
    // Opacity Slider
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            setCameraOpacity(value);
            const display = document.getElementById('cameraInputOpacityValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // Blend Mode
    const blendSelect = document.getElementById('cameraInputBlendMode');
    if (blendSelect) {
        blendSelect.addEventListener('change', (e) => {
            setCameraBlendMode(e.target.value);
        });
    }
    
    // Audio-Reactive
    const audioReactiveCheckbox = document.getElementById('cameraInputAudioReactive');
    if (audioReactiveCheckbox) {
        audioReactiveCheckbox.addEventListener('change', (e) => {
            setCameraAudioReactive(e.target.checked);
        });
    }
    
    // Audio Opacity Min/Max
    const audioMinSlider = document.getElementById('cameraInputAudioMin');
    const audioMaxSlider = document.getElementById('cameraInputAudioMax');
    
    if (audioMinSlider) {
        audioMinSlider.addEventListener('input', (e) => {
            const min = parseInt(e.target.value) / 100;
            const max = cameraInputState.audioOpacityMax;
            setCameraAudioOpacityRange(min, max);
            const display = document.getElementById('cameraInputAudioMinValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    if (audioMaxSlider) {
        audioMaxSlider.addEventListener('input', (e) => {
            const min = cameraInputState.audioOpacityMin;
            const max = parseInt(e.target.value) / 100;
            setCameraAudioOpacityRange(min, max);
            const display = document.getElementById('cameraInputAudioMaxValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // Mirror
    const mirrorCheckbox = document.getElementById('cameraInputMirror');
    if (mirrorCheckbox) {
        mirrorCheckbox.addEventListener('change', (e) => {
            setCameraMirror(e.target.checked);
        });
    }
    
    // Use as Texture
    const textureCheckbox = document.getElementById('cameraInputAsTexture');
    if (textureCheckbox) {
        textureCheckbox.addEventListener('change', (e) => {
            setCameraAsTexture(e.target.checked);
        });
    }
    
    // Apply to All Models
    const applyToAllCheckbox = document.getElementById('cameraInputApplyToAll');
    if (applyToAllCheckbox) {
        applyToAllCheckbox.checked = cameraInputState.applyToAllModels;
        applyToAllCheckbox.addEventListener('change', (e) => {
            setCameraApplyToAllModels(e.target.checked);
        });
    }
    
    // Skeleton Tracking UI initialisieren
    initSkeletonUI();
    
    // Initial load
    loadCameraDevices();
    updateCameraStatus('disconnected');
    
    console.log('Camera Input UI initialized');
}

// ============================================
// CLEANUP
// ============================================

export function cleanupCameraInput() {
    stopCamera();
    
    if (cameraInputState.videoElement) {
        cameraInputState.videoElement.remove();
        cameraInputState.videoElement = null;
    }
    
    cameraCanvas = null;
    cameraCtx = null;
}
