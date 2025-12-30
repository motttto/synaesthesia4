/**
 * VISUAL EFFECTS
 * 
 * Glitch, Pulse, Edge, Explode Effekte
 * Geometrie-Manipulation und Post-Processing
 */

import { THREE, scene, renderer } from '../core/three-setup.js';
import { 
    edgePass, afterimagePass, setTrailsIntensity,
    kaleidoscopePass, setKaleidoscopeEnabled, setKaleidoscopeSegments,
    setKaleidoscopeRotation, setKaleidoscopeZoom, setKaleidoscopeAutoRotate,
    updateKaleidoscope, kaleidoscopeState
} from '../core/postprocessing.js';
import { particleState, setParticlesEnabled, setParticlesIntensity, setParticlesSize } from '../core/particles.js';
import { modelState, originalGeometries, originalMaterialColors, storeOriginalGeometry, cleanupModelMaps, cleanupScene } from '../models/model-manager.js';

// ============================================
// STATE
// ============================================

export const activeEffects = new Set();

export const effectIntensities = {
    glitch: 0.5,
    pulse: 0.5,
    edge: 0.5,
    explode: 0.5,
    particles: 0.5,
    trails: 0.7,
    fractal: 0.5
};

export const effectState = {
    gainLinked: false,
    currentGainLevel: 0,
    audioScaleEnabled: false,
    audioScaleAmount: 0.3,
    effectTime: 0,
    edgeGlow: 0.3,
    // Fractal settings
    fractalScale: 0.3,
    fractalSpeed: 0.5,
    fractalOctaves: 3
};

// Callback für Visuals-Refresh (wird von main.js gesetzt)
let refreshVisualsCallback = null;

export function setRefreshVisualsCallback(callback) {
    refreshVisualsCallback = callback;
}

function refreshVisuals() {
    if (refreshVisualsCallback) {
        refreshVisualsCallback();
    }
}

// ============================================
// SIMPLEX NOISE (für Fraktal-Effekt)
// ============================================

// Simplex-ähnliche 3D Noise Funktion
const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// Initialisiere Permutation-Tabelle
(function() {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod12[i] = perm[i] % 12;
    }
})();

function dot3(g, x, y, z) {
    return g[0] * x + g[1] * y + g[2] * z;
}

function noise3D(x, y, z) {
    const F3 = 1.0 / 3.0;
    const G3 = 1.0 / 6.0;
    
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;
    
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
        if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
        else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
        else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
        if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
        else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
        else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;
    
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const gi0 = permMod12[ii + perm[jj + perm[kk]]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
    const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
    const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];
    
    let n0, n1, n2, n3;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * dot3(grad3[gi0], x0, y0, z0));
    
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * dot3(grad3[gi1], x1, y1, z1));
    
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * dot3(grad3[gi2], x2, y2, z2));
    
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    n3 = t3 < 0 ? 0 : (t3 *= t3, t3 * t3 * dot3(grad3[gi3], x3, y3, z3));
    
    return 32.0 * (n0 + n1 + n2 + n3);
}

/**
 * Fraktal Brownian Motion (FBM) Noise
 */
function fbmNoise(x, y, z, octaves) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    
    return value / maxValue;
}

// ============================================
// GEOMETRY RESET
// ============================================

/**
 * Setzt Geometrie und Material-Farben auf Original zurück
 */
export function resetGeometry(model) {
    if (!model) return;
    
    model.traverse((child) => {
        if (child.isMesh) {
            // Geometrie zurücksetzen
            if (child.geometry) {
                const original = originalGeometries.get(child.uuid);
                if (original) {
                    const posAttr = child.geometry.getAttribute('position');
                    posAttr.array.set(original);
                    posAttr.needsUpdate = true;
                    child.geometry.computeBoundingSphere();
                    child.geometry.computeBoundingBox();
                }
            }
            // Material zurücksetzen
            if (child.material) {
                child.material.wireframe = false;
                child.material.opacity = 1;
                child.material.needsUpdate = true;
                const originalColors = originalMaterialColors.get(child.uuid);
                if (originalColors) {
                    child.material.color.setHex(originalColors.color);
                    if (child.material.emissive) {
                        child.material.emissive.setHex(originalColors.emissive);
                    }
                }
            }
        }
    });
}

// ============================================
// EFFECT APPLICATION
// ============================================

/**
 * Wendet alle aktiven Effekte auf das Modell an
 */
export function applyEffects(model, deltaTime) {
    if (!model) return;
    
    effectState.effectTime += deltaTime;
    
    // effectTime periodisch zurücksetzen
    if (effectState.effectTime > 10000) {
        effectState.effectTime = effectState.effectTime % 10000;
    }
    
    // Wenn keine Effekte aktiv
    if (activeEffects.size === 0) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.wireframe = false;
            }
        });
        edgePass.enabled = false;
        return;
    }
    
    // Edge-Effekt Status
    edgePass.enabled = activeEffects.has('edge');
    if (activeEffects.has('edge')) {
        edgePass.uniforms.edgeStrength.value = effectIntensities.edge * 3.0;
        edgePass.uniforms.edgeGlow.value = effectState.edgeGlow;
    }
    
    model.traverse((child) => {
        if (!child.isMesh) return;
        
        const geometry = child.geometry;
        const material = child.material;
        
        if (material) {
            material.wireframe = activeEffects.has('wireframe');
            
            // Emissive zurücksetzen vor Effekt-Anwendung
            const originalColors = originalMaterialColors.get(child.uuid);
            if (originalColors && material.emissive) {
                material.emissive.setHex(originalColors.emissive);
            }
        }
        
        let originalData = originalGeometries.get(child.uuid);
        
        // Falls keine Original-Daten, speichern
        if (geometry && !originalData) {
            const posAttr = geometry.getAttribute('position');
            if (posAttr) {
                originalGeometries.set(child.uuid, posAttr.array.slice());
                if (material && !originalMaterialColors.has(child.uuid)) {
                    originalMaterialColors.set(child.uuid, {
                        color: material.color.getHex(),
                        emissive: material.emissive ? material.emissive.getHex() : 0x000000
                    });
                }
                originalData = originalGeometries.get(child.uuid);
            }
        }
        
        if (!geometry || !originalData) return;
        
        const posAttr = geometry.getAttribute('position');
        const positions = posAttr.array;
        
        // Positionen auf Original zurücksetzen
        for (let i = 0; i < positions.length; i++) {
            positions[i] = originalData[i];
        }
        
        // Offset-Akkumulatoren
        const offsets = new Float32Array(positions.length);
        let scaleFactor = 1.0;
        const time = effectState.effectTime;
        
        // Alle aktiven Effekte anwenden
        for (const effect of activeEffects) {
            switch (effect) {
                case 'glitch': {
                    const glitchInt = effectIntensities.glitch;
                    for (let i = 0; i < positions.length; i += 3) {
                        if (Math.random() < 0.1 * glitchInt) {
                            offsets[i] += (Math.random() - 0.5) * glitchInt * 0.5;
                            offsets[i + 1] += (Math.random() - 0.5) * glitchInt * 0.5;
                            offsets[i + 2] += (Math.random() - 0.5) * glitchInt * 0.5;
                        }
                    }
                    if (material && Math.random() < 0.1 * glitchInt) {
                        material.emissive.setHex(Math.random() > 0.5 ? 0xff0066 : 0x00ffff);
                    }
                    break;
                }
                    
                case 'pulse': {
                    const pulseInt = effectIntensities.pulse;
                    const pulse = Math.sin(time * 4) * pulseInt * 0.3;
                    scaleFactor *= (1 + pulse);
                    if (material) {
                        const glow = 0.2 + Math.sin(time * 4) * 0.3 * pulseInt;
                        material.emissive.multiplyScalar(1 + glow * 0.5);
                    }
                    break;
                }
                    
                case 'edge': {
                    const edgeInt = effectIntensities.edge;
                    for (let i = 0; i < positions.length; i += 3) {
                        offsets[i] += Math.sin(time * 15 + i) * 0.005 * edgeInt;
                        offsets[i + 1] += Math.cos(time * 15 + i) * 0.005 * edgeInt;
                    }
                    break;
                }
                    
                case 'explode': {
                    const explodeInt = effectIntensities.explode;
                    const explodeAmount = explodeInt * (0.5 + Math.sin(time * 2) * 0.5);
                    for (let i = 0; i < positions.length; i += 3) {
                        const x = originalData[i];
                        const y = originalData[i + 1];
                        const z = originalData[i + 2];
                        const expandFactor = explodeAmount * 0.5;
                        offsets[i] += x * expandFactor + Math.sin(time * 3 + i) * 0.1 * explodeInt;
                        offsets[i + 1] += y * expandFactor + Math.cos(time * 3 + i) * 0.1 * explodeInt;
                        offsets[i + 2] += z * expandFactor + Math.sin(time * 2 + i) * 0.1 * explodeInt;
                    }
                    if (material) {
                        const hue = (time * 0.2) % 1;
                        material.emissive.offsetHSL(hue * 0.1, 0, explodeInt * 0.2);
                    }
                    break;
                }
                
                case 'fractal': {
                    const fractalInt = effectIntensities.fractal;
                    const scale = effectState.fractalScale * 5 + 1; // 1-6 range
                    const speed = effectState.fractalSpeed * 2;
                    const octaves = effectState.fractalOctaves;
                    const animTime = time * speed;
                    
                    for (let i = 0; i < positions.length; i += 3) {
                        const x = originalData[i];
                        const y = originalData[i + 1];
                        const z = originalData[i + 2];
                        
                        // FBM Noise für organische Verformung
                        const noiseX = fbmNoise(x * scale + animTime, y * scale, z * scale, octaves);
                        const noiseY = fbmNoise(x * scale, y * scale + animTime, z * scale + 100, octaves);
                        const noiseZ = fbmNoise(x * scale + 200, y * scale, z * scale + animTime, octaves);
                        
                        // Displacement basierend auf Noise
                        const displacement = fractalInt * 0.5;
                        offsets[i] += noiseX * displacement;
                        offsets[i + 1] += noiseY * displacement;
                        offsets[i + 2] += noiseZ * displacement;
                    }
                    
                    // Farbmodulation
                    if (material) {
                        const colorNoise = fbmNoise(time * 0.5, 0, 0, 2);
                        material.emissive.offsetHSL(colorNoise * 0.1 * fractalInt, 0, fractalInt * 0.1);
                    }
                    break;
                }
            }
        }
        
        // Offsets und Skalierung anwenden
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] = originalData[i] * scaleFactor + offsets[i];
            positions[i + 1] = originalData[i + 1] * scaleFactor + offsets[i + 1];
            positions[i + 2] = originalData[i + 2] * scaleFactor + offsets[i + 2];
        }
        
        posAttr.needsUpdate = true;
        if (geometry.boundingSphere) geometry.computeBoundingSphere();
        if (geometry.boundingBox) geometry.computeBoundingBox();
    });
}

// ============================================
// EFFECT TOGGLE
// ============================================

/**
 * Toggled einen Effekt an/aus
 */
export function toggleEffect(effect) {
    if (activeEffects.has(effect)) {
        activeEffects.delete(effect);
    } else {
        activeEffects.add(effect);
    }
    
    // Particles
    if (effect === 'particles') {
        setParticlesEnabled(activeEffects.has('particles'));
    }
    
    // Trails
    if (effect === 'trails') {
        afterimagePass.enabled = activeEffects.has('trails');
    }
    
    // Edge
    if (effect === 'edge') {
        edgePass.enabled = activeEffects.has('edge');
    }
    
    // Kaleidoscope
    if (effect === 'kaleidoscope') {
        setKaleidoscopeEnabled(activeEffects.has('kaleidoscope'));
    }
    
    // Geometrie zurücksetzen wenn keine Effekte
    if (activeEffects.size === 0 && modelState.currentModel) {
        resetGeometry(modelState.currentModel);
        modelState.modelMaterials.forEach(mat => {
            mat.wireframe = false;
            mat.opacity = 1;
            mat.transparent = true;
        });
        edgePass.enabled = false;
        afterimagePass.enabled = false;
    }
    
    // Original-Geometrien speichern wenn Effekte aktiv
    if (activeEffects.size > 0 && modelState.currentModel) {
        storeOriginalGeometry(modelState.currentModel);
    }
    
    // UI Updates
    const sliderContainer = document.getElementById(`${effect}SliderContainer`);
    if (sliderContainer) {
        sliderContainer.classList.toggle('visible', activeEffects.has(effect));
    }
    
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.toggle('active', activeEffects.has(btn.dataset.effect));
    });
    
    refreshVisuals();
}

/**
 * Deaktiviert alle Effekte
 */
export function clearAllEffects() {
    activeEffects.clear();
    edgePass.enabled = false;
    afterimagePass.enabled = false;
    setParticlesEnabled(false);
    setKaleidoscopeEnabled(false);
    
    if (modelState.currentModel) {
        resetGeometry(modelState.currentModel);
        modelState.modelMaterials.forEach(mat => {
            mat.wireframe = false;
            mat.opacity = 1;
            mat.transparent = true;
        });
    }
    
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.effect-slider').forEach(container => {
        container.classList.remove('visible');
    });
    
    refreshVisuals();
}

/**
 * Reset All - Vollständige Bereinigung
 */
export function resetAll() {
    console.log('=== RESET ALL gestartet ===');
    
    // 1. Alle Effekte deaktivieren
    clearAllEffects();
    
    // 2. Morphing abbrechen
    if (modelState.morphingInProgress) {
        if (modelState.morphOutgoingModel) {
            cleanupModelMaps(modelState.morphOutgoingModel);
            scene.remove(modelState.morphOutgoingModel);
        }
        if (modelState.morphIncomingModel) {
            cleanupModelMaps(modelState.morphIncomingModel);
            scene.remove(modelState.morphIncomingModel);
        }
        modelState.morphOutgoingModel = null;
        modelState.morphIncomingModel = null;
        modelState.morphingInProgress = false;
    }
    
    // 3. Scene bereinigen
    cleanupScene();
    
    // 4. effectTime zurücksetzen
    effectState.effectTime = 0;
    
    // 5. Geometrie zurücksetzen
    if (modelState.currentModel) {
        resetGeometry(modelState.currentModel);
        modelState.modelMaterials.forEach(mat => {
            mat.wireframe = false;
            mat.opacity = 1;
            mat.transparent = true;
        });
    }
    
    // 6. Farben neu anwenden
    refreshVisuals();
    
    console.log('=== RESET ALL abgeschlossen ===');
}

// ============================================
// UI INITIALIZATION
// ============================================

/**
 * Initialisiert alle Effect UI Event-Handler
 */
export function initEffectUI() {
    // Effekt-Buttons
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleEffect(btn.dataset.effect);
        });
    });
    
    // Intensitäts-Slider
    ['glitch', 'pulse', 'edge', 'explode'].forEach(effect => {
        const slider = document.getElementById(`${effect}Intensity`);
        const valueDisplay = document.getElementById(`${effect}IntensityValue`);
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                effectIntensities[effect] = parseInt(e.target.value) / 100;
                valueDisplay.textContent = e.target.value + '%';
                if (effect === 'edge' && edgePass.enabled) {
                    edgePass.uniforms.edgeStrength.value = effectIntensities.edge * 3.0;
                }
            });
        }
    });
    
    // Edge Glow
    const edgeGlowSlider = document.getElementById('edgeGlow');
    if (edgeGlowSlider) {
        edgeGlowSlider.addEventListener('input', (e) => {
            effectState.edgeGlow = parseFloat(e.target.value) / 100;
            document.getElementById('edgeGlowValue').textContent = e.target.value + '%';
            if (edgePass.enabled) {
                edgePass.uniforms.edgeGlow.value = effectState.edgeGlow;
            }
        });
    }
    
    // Partikel Slider
    const particlesIntSlider = document.getElementById('particlesIntensity');
    if (particlesIntSlider) {
        particlesIntSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) / 100;
            setParticlesIntensity(val);
            effectIntensities.particles = val;
            document.getElementById('particlesIntensityValue').textContent = e.target.value + '%';
        });
    }
    
    const particlesSizeSlider = document.getElementById('particlesSize');
    if (particlesSizeSlider) {
        particlesSizeSlider.addEventListener('input', (e) => {
            setParticlesSize(parseInt(e.target.value) / 100);
            document.getElementById('particlesSizeValue').textContent = e.target.value + '%';
        });
    }
    
    // Trails Slider
    const trailsSlider = document.getElementById('trailsIntensity');
    if (trailsSlider) {
        trailsSlider.addEventListener('input', (e) => {
            const intensity = parseInt(e.target.value) / 100;
            effectIntensities.trails = intensity;
            document.getElementById('trailsIntensityValue').textContent = e.target.value + '%';
            setTrailsIntensity(intensity);
        });
    }
    
    // Initial Trails
    setTrailsIntensity(0.7);
    
    // Fractal Slider
    const fractalIntSlider = document.getElementById('fractalIntensity');
    if (fractalIntSlider) {
        fractalIntSlider.addEventListener('input', (e) => {
            effectIntensities.fractal = parseInt(e.target.value) / 100;
            document.getElementById('fractalIntensityValue').textContent = e.target.value + '%';
        });
    }
    
    const fractalScaleSlider = document.getElementById('fractalScale');
    if (fractalScaleSlider) {
        fractalScaleSlider.addEventListener('input', (e) => {
            effectState.fractalScale = parseInt(e.target.value) / 100;
            document.getElementById('fractalScaleValue').textContent = e.target.value + '%';
        });
    }
    
    const fractalSpeedSlider = document.getElementById('fractalSpeed');
    if (fractalSpeedSlider) {
        fractalSpeedSlider.addEventListener('input', (e) => {
            effectState.fractalSpeed = parseInt(e.target.value) / 100;
            document.getElementById('fractalSpeedValue').textContent = e.target.value + '%';
        });
    }
    
    const fractalOctavesSlider = document.getElementById('fractalOctaves');
    if (fractalOctavesSlider) {
        fractalOctavesSlider.addEventListener('input', (e) => {
            effectState.fractalOctaves = parseInt(e.target.value);
            document.getElementById('fractalOctavesValue').textContent = e.target.value;
        });
    }
    
    // Kaleidoscope Slider
    const kaleidoscopeSegmentsSlider = document.getElementById('kaleidoscopeSegments');
    if (kaleidoscopeSegmentsSlider) {
        kaleidoscopeSegmentsSlider.addEventListener('input', (e) => {
            const segments = parseInt(e.target.value);
            setKaleidoscopeSegments(segments);
            document.getElementById('kaleidoscopeSegmentsValue').textContent = segments;
        });
    }
    
    const kaleidoscopeRotationSlider = document.getElementById('kaleidoscopeRotation');
    if (kaleidoscopeRotationSlider) {
        kaleidoscopeRotationSlider.addEventListener('input', (e) => {
            const degrees = parseInt(e.target.value);
            const radians = degrees * Math.PI / 180;
            setKaleidoscopeRotation(radians);
            document.getElementById('kaleidoscopeRotationValue').textContent = degrees + '°';
        });
    }
    
    const kaleidoscopeZoomSlider = document.getElementById('kaleidoscopeZoom');
    if (kaleidoscopeZoomSlider) {
        kaleidoscopeZoomSlider.addEventListener('input', (e) => {
            const zoom = parseInt(e.target.value) / 100;
            setKaleidoscopeZoom(zoom);
            document.getElementById('kaleidoscopeZoomValue').textContent = e.target.value + '%';
        });
    }
    
    const kaleidoscopeAutoRotateCheckbox = document.getElementById('kaleidoscopeAutoRotate');
    if (kaleidoscopeAutoRotateCheckbox) {
        kaleidoscopeAutoRotateCheckbox.addEventListener('change', (e) => {
            const speedSlider = document.getElementById('kaleidoscopeSpeed');
            const speed = speedSlider ? parseInt(speedSlider.value) / 100 : 0.3;
            setKaleidoscopeAutoRotate(e.target.checked, speed);
        });
    }
    
    const kaleidoscopeSpeedSlider = document.getElementById('kaleidoscopeSpeed');
    if (kaleidoscopeSpeedSlider) {
        kaleidoscopeSpeedSlider.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value) / 100;
            document.getElementById('kaleidoscopeSpeedValue').textContent = e.target.value + '%';
            const autoRotate = document.getElementById('kaleidoscopeAutoRotate');
            if (autoRotate?.checked) {
                setKaleidoscopeAutoRotate(true, speed);
            }
        });
    }
    
    // Audio-Skalierung
    const audioScaleCheckbox = document.getElementById('audioScaleEnabled');
    const audioScaleSlider = document.getElementById('audioScaleAmount');
    const audioScaleControl = document.getElementById('audioScaleControl');
    
    if (audioScaleCheckbox) {
        audioScaleCheckbox.addEventListener('change', (e) => {
            effectState.audioScaleEnabled = e.target.checked;
            if (audioScaleSlider) audioScaleSlider.disabled = !e.target.checked;
            if (audioScaleControl) audioScaleControl.style.opacity = e.target.checked ? '1' : '0.5';
        });
    }
    
    if (audioScaleSlider) {
        audioScaleSlider.addEventListener('input', (e) => {
            effectState.audioScaleAmount = parseInt(e.target.value) / 100;
            document.getElementById('audioScaleAmountValue').textContent = e.target.value + '%';
        });
    }
    
    // Audio-Helligkeit
    const gainLinkedCheckbox = document.getElementById('gainLinked');
    if (gainLinkedCheckbox) {
        gainLinkedCheckbox.addEventListener('change', (e) => {
            effectState.gainLinked = e.target.checked;
            if (!e.target.checked) {
                effectState.currentGainLevel = 1;
            }
            refreshVisuals();
        });
    }
    
    // Black Level
    const blackLevelSlider = document.getElementById('blackLevel');
    if (blackLevelSlider) {
        blackLevelSlider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value);
            document.getElementById('blackLevelValue').textContent = level;
            const hex = (level << 16) | (level << 8) | level;
            renderer.setClearColor(hex);
        });
    }
    
    // Reset All Button
    const resetAllBtn = document.getElementById('resetAllBtn');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', resetAll);
    }
}

// ============================================
// SETTERS
// ============================================

export function setGainLevel(level) {
    effectState.currentGainLevel = level;
}

export function setEffectIntensity(effect, intensity) {
    effectIntensities[effect] = intensity;
}

// Re-export für Animation Loop
export { updateKaleidoscope };
