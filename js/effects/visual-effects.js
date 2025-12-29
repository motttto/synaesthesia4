/**
 * VISUAL EFFECTS
 * 
 * Glitch, Pulse, Edge, Explode Effekte
 * Geometrie-Manipulation und Post-Processing
 */

import { THREE, scene, renderer } from '../core/three-setup.js';
import { edgePass, afterimagePass, setTrailsIntensity } from '../core/postprocessing.js';
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
    trails: 0.7
};

export const effectState = {
    gainLinked: false,
    currentGainLevel: 0,
    audioScaleEnabled: false,
    audioScaleAmount: 0.3,
    effectTime: 0,
    edgeGlow: 0.3
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
