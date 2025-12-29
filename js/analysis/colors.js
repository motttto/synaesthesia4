/**
 * COLOR CALCULATION
 * 
 * Berechnet und wendet Farben basierend auf:
 * - Clara-Schema: Absolute Ton-Farben
 * - Alex-Schema: Mode-basierte Farben
 * - Vignette-Effekte für Hintergrund
 */

import * as THREE from 'three';
import { ClaraColors, AlexColors, colorState } from '../config/colors.js';
import { renderer, scene } from '../core/three-setup.js';
import { setParticleColor } from '../core/particles.js';
import { modelState } from '../models/model-manager.js';
import { effectState } from '../effects/visual-effects.js';
import { getChordQuality } from './intervals.js';

// ============================================
// STATE
// ============================================

export const colorCalcState = {
    activeSchema: 'clara', // 'clara', 'alex', 'both'
    lastAnalysis: null,
    blendEnabled: false,
    blendAmount: 0.5,
    alexDegreeColorsEnabled: false,
    alexVignetteEnabled: true,
    alexGradientEnabled: true
};

// UI Elements
let vignetteOverlay = null;

// ============================================
// COLOR GETTERS
// ============================================

/**
 * Holt Farbe für eine Note basierend auf Schema
 */
export function getColorForNote(note, schema = colorCalcState.activeSchema) {
    if (schema === 'clara' || schema === 'both') {
        const noteName = note.name.replace('#', '').replace('b', '');
        const colorSet = ClaraColors.notes[noteName];
        if (!colorSet) return 0xffffff;
        
        if (note.isSharp && colorSet.sharp) return colorSet.sharp;
        if (note.name.includes('b') && colorSet.flat) return colorSet.flat;
        return colorSet.base;
    }
    
    return 0xffffff;
}

/**
 * Holt Farbe für einen Akkord/Analyse basierend auf Schema
 */
export function getColorForChord(analysis, schema = colorCalcState.activeSchema) {
    if (!analysis) return 0x333333;
    
    if (schema === 'clara') {
        return getColorForNote(analysis.bass, 'clara');
    }
    
    if (schema === 'alex') {
        const quality = getChordQuality(analysis);
        if (quality === 'minor') {
            return AlexColors.modes.minor;
        }
        return AlexColors.modes.major;
    }
    
    if (schema === 'both') {
        const claraColor = new THREE.Color(getColorForChord(analysis, 'clara'));
        const alexColor = new THREE.Color(getColorForChord(analysis, 'alex'));
        
        if (colorCalcState.blendEnabled) {
            claraColor.lerp(alexColor, colorCalcState.blendAmount);
        }
        return claraColor.getHex();
    }
    
    return 0x666666;
}

/**
 * Holt Alex Stufen-Farbe für ein Intervall
 */
export function getDegreeColor(interval) {
    return AlexColors.degrees[interval] || 0xffffff;
}

// ============================================
// APPLY COLORS
// ============================================

/**
 * Wendet Farben auf Modell, Hintergrund und Vignette an
 * @param {Object} analysis - Analyse-Objekt mit notes, bass, intervals, chord
 */
export function applyColors(analysis) {
    if (!analysis) return;
    
    colorCalcState.lastAnalysis = analysis;
    
    // Gain-Multiplikator für Helligkeit
    const gainMult = effectState.gainLinked ? effectState.currentGainLevel : 1;
    
    // Vignette Element holen falls noch nicht vorhanden
    if (!vignetteOverlay) {
        vignetteOverlay = document.getElementById('vignetteOverlay');
    }
    
    // HINWEIS: Modell-Sichtbarkeit wird in main.js animate() gesteuert
    // (berücksichtigt sowohl Schema als auch modelVisible Button)
    
    // === MODELL-FARBEN (IMMER CLARA) ===
    if (colorCalcState.activeSchema !== 'alex' && analysis.bass) {
        applyModelColors(analysis, gainMult);
    }
    
    // === HINTERGRUND-FARBEN ===
    applyBackgroundColors(analysis, gainMult);
}

/**
 * Wendet Clara-Farben auf das 3D-Modell an
 */
function applyModelColors(analysis, gainMult) {
    const bassNote = analysis.bass;
    const noteName = bassNote.name.replace('#', '').replace('b', '');
    const colorSet = ClaraColors.notes[noteName];
    let claraHex = 0xff3333; // Fallback Rot
    
    if (colorSet) {
        if (bassNote.isSharp && colorSet.sharp) {
            claraHex = colorSet.sharp;
        } else if (bassNote.name.includes('b') && colorSet.flat) {
            claraHex = colorSet.flat;
        } else {
            claraHex = colorSet.base;
        }
    }
    
    const mainColor = new THREE.Color(claraHex);
    
    // Partikelfarbe aktualisieren
    setParticleColor(claraHex);
    
    // Farbe auf alle Materialien anwenden
    if (modelState.modelMaterials.length > 0) {
        modelState.modelMaterials.forEach((mat, index) => {
            const variation = mainColor.clone();
            variation.offsetHSL(0, 0, (index * 0.015) - 0.02);
            variation.multiplyScalar(gainMult);
            
            mat.color.copy(variation);
            mat.emissive = variation.clone().multiplyScalar(0.5);
        });
    } else if (modelState.currentModel) {
        // Fallback: Direkt auf Modell-Meshes
        modelState.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                const variation = mainColor.clone();
                variation.multiplyScalar(gainMult);
                child.material.color.copy(variation);
                child.material.emissive = variation.clone().multiplyScalar(0.5);
            }
        });
    }
}

/**
 * Wendet Hintergrund-Farben basierend auf Schema an
 */
function applyBackgroundColors(analysis, gainMult) {
    if (colorCalcState.activeSchema === 'clara') {
        // Clara: Schwarzer Hintergrund
        renderer.setClearColor(0x111111);
        if (vignetteOverlay) vignetteOverlay.classList.remove('active');
        colorState.currentVignetteColor = null;
        return;
    }
    
    // Alex oder Beide
    let bgColor;
    
    if (colorCalcState.alexDegreeColorsEnabled && analysis.notes.length >= 2) {
        // Stufen-Farben als Hintergrund
        applyDegreeBackground(analysis, gainMult);
    } else {
        // Standard Modus-Farbe
        bgColor = new THREE.Color(getColorForChord(analysis, 'alex'));
        bgColor.multiplyScalar(gainMult);
        applyVignetteOrSolid(bgColor, gainMult);
    }
}

/**
 * Wendet Stufen-basierte Hintergrund-Farben an
 */
function applyDegreeBackground(analysis, gainMult) {
    const bassNote = analysis.bass.midi;
    const degreeColors = analysis.notes.map(note => {
        const interval = (note.midi - bassNote) % 12;
        return new THREE.Color(AlexColors.degrees[interval] || 0xffffff);
    });
    
    // Mische alle Stufen-Farben
    const bgColor = degreeColors[0].clone();
    for (let i = 1; i < degreeColors.length; i++) {
        bgColor.lerp(degreeColors[i], 1 / (i + 1));
    }
    bgColor.multiplyScalar(gainMult);
    
    if (colorCalcState.alexVignetteEnabled) {
        renderer.setClearColor(0x000000);
        
        if (colorCalcState.alexGradientEnabled && degreeColors.length >= 2) {
            // Gradient-Vignette
            const colors = degreeColors.map(c => {
                c.multiplyScalar(gainMult);
                return `rgba(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)}, ${0.6 * gainMult})`;
            });
            
            const stops = colors.map((c, i) => {
                const pos = (i / (colors.length - 1)) * 60;
                return `${c} ${pos}%`;
            }).join(', ');
            
            if (vignetteOverlay) {
                vignetteOverlay.style.background = `radial-gradient(ellipse at center, ${stops}, rgba(0, 0, 0, 0) 85%)`;
                vignetteOverlay.classList.add('active');
            }
            
            const firstColor = degreeColors[0];
            colorState.currentVignetteColor = { r: firstColor.r, g: firstColor.g, b: firstColor.b, a: 0.6 * gainMult };
        } else {
            // Einfache Vignette
            applySimpleVignette(bgColor, gainMult);
        }
    } else {
        // Vollflächige Farbe
        bgColor.multiplyScalar(0.25);
        renderer.setClearColor(bgColor);
        if (vignetteOverlay) vignetteOverlay.classList.remove('active');
        colorState.currentVignetteColor = null;
    }
}

/**
 * Wendet einfache Vignette oder Vollfarbe an
 */
function applyVignetteOrSolid(bgColor, gainMult) {
    if (colorCalcState.alexVignetteEnabled) {
        applySimpleVignette(bgColor, gainMult);
    } else {
        bgColor.multiplyScalar(0.3);
        renderer.setClearColor(bgColor);
        if (vignetteOverlay) vignetteOverlay.classList.remove('active');
        colorState.currentVignetteColor = null;
    }
}

/**
 * Wendet einfache Vignette an
 */
function applySimpleVignette(color, gainMult) {
    renderer.setClearColor(0x000000);
    
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    
    if (vignetteOverlay) {
        vignetteOverlay.style.background = `
            radial-gradient(
                ellipse at center,
                rgba(${r}, ${g}, ${b}, ${0.5 * gainMult}) 0%,
                rgba(${r}, ${g}, ${b}, ${0.45 * gainMult}) 8%,
                rgba(${r}, ${g}, ${b}, ${0.38 * gainMult}) 16%,
                rgba(${r}, ${g}, ${b}, ${0.30 * gainMult}) 24%,
                rgba(${r}, ${g}, ${b}, ${0.22 * gainMult}) 32%,
                rgba(${r}, ${g}, ${b}, ${0.16 * gainMult}) 40%,
                rgba(${r}, ${g}, ${b}, ${0.11 * gainMult}) 48%,
                rgba(${r}, ${g}, ${b}, ${0.07 * gainMult}) 56%,
                rgba(${r}, ${g}, ${b}, ${0.04 * gainMult}) 64%,
                rgba(${r}, ${g}, ${b}, ${0.02 * gainMult}) 72%,
                rgba(${r}, ${g}, ${b}, ${0.008 * gainMult}) 80%,
                rgba(0, 0, 0, 0) 90%
            )
        `;
        vignetteOverlay.classList.add('active');
    }
    
    colorState.currentVignetteColor = { r: color.r, g: color.g, b: color.b, a: 0.5 * gainMult };
}

// ============================================
// SETTERS & UI
// ============================================

export function setActiveSchema(schema) {
    colorCalcState.activeSchema = schema;
    if (colorCalcState.lastAnalysis) {
        applyColors(colorCalcState.lastAnalysis);
    }
}

export function setBlendEnabled(enabled) {
    colorCalcState.blendEnabled = enabled;
}

export function setBlendAmount(amount) {
    colorCalcState.blendAmount = amount;
}

export function setAlexDegreeColorsEnabled(enabled) {
    colorCalcState.alexDegreeColorsEnabled = enabled;
}

export function setAlexVignetteEnabled(enabled) {
    colorCalcState.alexVignetteEnabled = enabled;
}

export function setAlexGradientEnabled(enabled) {
    colorCalcState.alexGradientEnabled = enabled;
}

/**
 * Schnelle Aktualisierung mit gecachter Analyse
 */
export function refreshVisuals() {
    if (colorCalcState.lastAnalysis) {
        applyColors(colorCalcState.lastAnalysis);
    }
}

/**
 * Initialisiert Color UI Event Handler
 */
export function initColorUI() {
    // Schema-Auswahl
    document.querySelectorAll('.schema-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.schema-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setActiveSchema(btn.dataset.schema);
        });
    });
    
    // Alex Optionen
    const degreeCheckbox = document.getElementById('alexDegreeColors');
    if (degreeCheckbox) {
        degreeCheckbox.addEventListener('change', (e) => {
            setAlexDegreeColorsEnabled(e.target.checked);
            refreshVisuals();
        });
    }
    
    const vignetteCheckbox = document.getElementById('alexVignette');
    if (vignetteCheckbox) {
        vignetteCheckbox.addEventListener('change', (e) => {
            setAlexVignetteEnabled(e.target.checked);
            refreshVisuals();
        });
    }
    
    const gradientCheckbox = document.getElementById('alexGradient');
    if (gradientCheckbox) {
        gradientCheckbox.addEventListener('change', (e) => {
            setAlexGradientEnabled(e.target.checked);
            refreshVisuals();
        });
    }
    
    // Blend Controls
    const blendCheckbox = document.getElementById('blendSchemas');
    const blendControl = document.getElementById('blendControl');
    if (blendCheckbox) {
        blendCheckbox.addEventListener('change', (e) => {
            setBlendEnabled(e.target.checked);
            if (blendControl) {
                blendControl.style.display = e.target.checked ? 'block' : 'none';
            }
            refreshVisuals();
        });
    }
    
    const blendSlider = document.getElementById('blendSlider');
    if (blendSlider) {
        blendSlider.addEventListener('input', (e) => {
            setBlendAmount(parseInt(e.target.value) / 100);
            const display = document.getElementById('blendValue');
            if (display) display.textContent = e.target.value + '%';
            refreshVisuals();
        });
    }
}
