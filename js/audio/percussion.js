/**
 * PERCUSSION DETECTOR
 * 
 * Erkennt Drum-Sounds in Echtzeit:
 * - Kick, Snare, Hi-Hat (closed/open), Tom, Crash
 * - Onset Detection mit Energy-Analyse
 * - Frequenzband-basierte Klassifikation
 * - Verschiedene Presets für unterschiedliche Quellen
 */

// ============================================
// PRESETS
// ============================================

export const percussionPresets = {
    standard: {
        name: 'Standard',
        description: 'Ausgewogene Erkennung',
        onsetThreshold: 1.5,
        onsetCooldown: 50,
        historySize: 43,
        decayRate: 0.85,
        // Frequenzbänder [low, high]
        bands: {
            subBass: [20, 80],
            bass: [80, 200],
            lowMid: [200, 500],
            mid: [500, 2000],
            highMid: [2000, 6000],
            high: [6000, 16000]
        },
        // Klassifikations-Schwellwerte
        thresholds: {
            kick: { lowRatio: 0.4 },
            snare: { midRatio: 0.2, highRatio: 0.15 },
            hihatClosed: { highRatio: 0.4 },
            hihatOpen: { highRatioMin: 0.25, highRatioMax: 0.45, midRatio: 0.2 },
            tom: { midRatio: 0.35, lowRatio: 0.15, highRatioMax: 0.3 },
            crash: { highRatio: 0.3, midRatio: 0.15 }
        }
    },
    
    acoustic: {
        name: 'Acoustic Kit',
        description: 'Für akustische Drums',
        onsetThreshold: 1.4,
        onsetCooldown: 45,
        historySize: 40,
        decayRate: 0.82,
        bands: {
            subBass: [30, 100],
            bass: [100, 250],
            lowMid: [250, 600],
            mid: [600, 2500],
            highMid: [2500, 7000],
            high: [7000, 18000]
        },
        thresholds: {
            kick: { lowRatio: 0.35 },
            snare: { midRatio: 0.18, highRatio: 0.12 },
            hihatClosed: { highRatio: 0.35 },
            hihatOpen: { highRatioMin: 0.2, highRatioMax: 0.4, midRatio: 0.18 },
            tom: { midRatio: 0.3, lowRatio: 0.12, highRatioMax: 0.35 },
            crash: { highRatio: 0.25, midRatio: 0.12 }
        }
    },
    
    electronic: {
        name: 'Electronic',
        description: 'Für elektronische Drums/808',
        onsetThreshold: 1.6,
        onsetCooldown: 40,
        historySize: 35,
        decayRate: 0.88,
        bands: {
            subBass: [20, 60],
            bass: [60, 150],
            lowMid: [150, 400],
            mid: [400, 1500],
            highMid: [1500, 5000],
            high: [5000, 14000]
        },
        thresholds: {
            kick: { lowRatio: 0.45 },
            snare: { midRatio: 0.25, highRatio: 0.2 },
            hihatClosed: { highRatio: 0.45 },
            hihatOpen: { highRatioMin: 0.3, highRatioMax: 0.5, midRatio: 0.15 },
            tom: { midRatio: 0.4, lowRatio: 0.2, highRatioMax: 0.25 },
            crash: { highRatio: 0.35, midRatio: 0.1 }
        }
    },
    
    live: {
        name: 'Live/Noisy',
        description: 'Höhere Schwellwerte für Live-Situationen',
        onsetThreshold: 2.0,
        onsetCooldown: 60,
        historySize: 50,
        decayRate: 0.8,
        bands: {
            subBass: [25, 90],
            bass: [90, 220],
            lowMid: [220, 550],
            mid: [550, 2200],
            highMid: [2200, 6500],
            high: [6500, 16000]
        },
        thresholds: {
            kick: { lowRatio: 0.5 },
            snare: { midRatio: 0.28, highRatio: 0.2 },
            hihatClosed: { highRatio: 0.5 },
            hihatOpen: { highRatioMin: 0.35, highRatioMax: 0.55, midRatio: 0.25 },
            tom: { midRatio: 0.45, lowRatio: 0.2, highRatioMax: 0.25 },
            crash: { highRatio: 0.4, midRatio: 0.2 }
        }
    },
    
    sensitive: {
        name: 'Sensitive',
        description: 'Für leise Quellen',
        onsetThreshold: 1.2,
        onsetCooldown: 35,
        historySize: 30,
        decayRate: 0.9,
        bands: {
            subBass: [20, 80],
            bass: [80, 200],
            lowMid: [200, 500],
            mid: [500, 2000],
            highMid: [2000, 6000],
            high: [6000, 16000]
        },
        thresholds: {
            kick: { lowRatio: 0.3 },
            snare: { midRatio: 0.15, highRatio: 0.1 },
            hihatClosed: { highRatio: 0.3 },
            hihatOpen: { highRatioMin: 0.18, highRatioMax: 0.35, midRatio: 0.15 },
            tom: { midRatio: 0.25, lowRatio: 0.1, highRatioMax: 0.35 },
            crash: { highRatio: 0.2, midRatio: 0.1 }
        }
    },
    
    kickFocus: {
        name: 'Kick Focus',
        description: 'Optimiert für Kick-Erkennung',
        onsetThreshold: 1.3,
        onsetCooldown: 40,
        historySize: 35,
        decayRate: 0.85,
        bands: {
            subBass: [20, 100],
            bass: [100, 250],
            lowMid: [250, 600],
            mid: [600, 2000],
            highMid: [2000, 6000],
            high: [6000, 16000]
        },
        thresholds: {
            kick: { lowRatio: 0.25 },
            snare: { midRatio: 0.35, highRatio: 0.25 },
            hihatClosed: { highRatio: 0.55 },
            hihatOpen: { highRatioMin: 0.4, highRatioMax: 0.6, midRatio: 0.3 },
            tom: { midRatio: 0.5, lowRatio: 0.25, highRatioMax: 0.2 },
            crash: { highRatio: 0.45, midRatio: 0.25 }
        }
    },
    
    hiphop: {
        name: 'Hip-Hop/Trap',
        description: 'Für tiefe 808 Kicks & Snares',
        onsetThreshold: 1.4,
        onsetCooldown: 45,
        historySize: 38,
        decayRate: 0.87,
        bands: {
            subBass: [15, 50],
            bass: [50, 120],
            lowMid: [120, 350],
            mid: [350, 1200],
            highMid: [1200, 4000],
            high: [4000, 12000]
        },
        thresholds: {
            kick: { lowRatio: 0.35 },
            snare: { midRatio: 0.22, highRatio: 0.18 },
            hihatClosed: { highRatio: 0.38 },
            hihatOpen: { highRatioMin: 0.25, highRatioMax: 0.42, midRatio: 0.18 },
            tom: { midRatio: 0.38, lowRatio: 0.18, highRatioMax: 0.28 },
            crash: { highRatio: 0.32, midRatio: 0.15 }
        }
    },
    
    rock: {
        name: 'Rock/Metal',
        description: 'Für aggressive Drums',
        onsetThreshold: 1.7,
        onsetCooldown: 35,
        historySize: 32,
        decayRate: 0.83,
        bands: {
            subBass: [30, 100],
            bass: [100, 280],
            lowMid: [280, 700],
            mid: [700, 3000],
            highMid: [3000, 8000],
            high: [8000, 18000]
        },
        thresholds: {
            kick: { lowRatio: 0.38 },
            snare: { midRatio: 0.2, highRatio: 0.15 },
            hihatClosed: { highRatio: 0.4 },
            hihatOpen: { highRatioMin: 0.28, highRatioMax: 0.48, midRatio: 0.2 },
            tom: { midRatio: 0.32, lowRatio: 0.15, highRatioMax: 0.32 },
            crash: { highRatio: 0.28, midRatio: 0.15 }
        }
    }
};

// ============================================
// STATE
// ============================================

export const percussionState = {
    enabled: false,
    currentPreset: 'standard',
    kick: { active: false, decay: 0 },
    snare: { active: false, decay: 0 },
    'hihat-closed': { active: false, decay: 0 },
    'hihat-open': { active: false, decay: 0 },
    tom: { active: false, decay: 0 },
    crash: { active: false, decay: 0 }
};

// ============================================
// PERCUSSION DETECTOR CLASS
// ============================================

export class PercussionDetector {
    constructor(audioContext, analyser) {
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.sampleRate = audioContext.sampleRate;
        this.fftSize = analyser.fftSize;
        
        this.frequencyData = new Float32Array(analyser.frequencyBinCount);
        this.timeData = new Float32Array(analyser.fftSize);
        
        // Default Preset laden
        this.loadPreset('standard');
        
        // Onset Detection State
        this.prevEnergy = 0;
        this.energyHistory = [];
        this.lastOnsetTime = 0;
    }
    
    loadPreset(presetName) {
        const preset = percussionPresets[presetName];
        if (!preset) {
            console.warn(`Percussion preset '${presetName}' not found`);
            return;
        }
        
        this.onsetThreshold = preset.onsetThreshold;
        this.onsetCooldown = preset.onsetCooldown;
        this.historySize = preset.historySize;
        this.decayRate = preset.decayRate;
        this.bands = preset.bands;
        this.thresholds = preset.thresholds;
        
        // History zurücksetzen bei Preset-Wechsel
        this.energyHistory = [];
        
        percussionState.currentPreset = presetName;
        console.log(`Percussion preset loaded: ${preset.name}`);
    }
    
    binToFreq(bin) {
        return bin * this.sampleRate / this.fftSize;
    }
    
    freqToBin(freq) {
        return Math.round(freq * this.fftSize / this.sampleRate);
    }
    
    getEnergyInRange(lowFreq, highFreq) {
        const lowBin = this.freqToBin(lowFreq);
        const highBin = this.freqToBin(highFreq);
        let energy = 0;
        for (let i = lowBin; i <= highBin && i < this.frequencyData.length; i++) {
            const magnitude = Math.pow(10, this.frequencyData[i] / 20);
            energy += magnitude * magnitude;
        }
        return energy;
    }
    
    detect() {
        this.analyser.getFloatFrequencyData(this.frequencyData);
        this.analyser.getFloatTimeDomainData(this.timeData);
        
        // Gesamt-Energie berechnen
        let totalEnergy = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            totalEnergy += this.timeData[i] * this.timeData[i];
        }
        totalEnergy = Math.sqrt(totalEnergy / this.timeData.length);
        
        // Energie-Historie updaten
        this.energyHistory.push(totalEnergy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }
        
        // Durchschnitt berechnen
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        
        // Onset Detection
        const now = performance.now();
        const isOnset = totalEnergy > avgEnergy * this.onsetThreshold && 
                       totalEnergy > this.prevEnergy * 1.1 &&
                       (now - this.lastOnsetTime) > this.onsetCooldown;
        
        if (isOnset) {
            this.lastOnsetTime = now;
            this.classifyPercussion();
        }
        
        this.prevEnergy = totalEnergy;
        
        // Decay anwenden
        for (const key of ['kick', 'snare', 'hihat-closed', 'hihat-open', 'tom', 'crash']) {
            const state = percussionState[key];
            if (state.decay > 0) {
                state.decay *= this.decayRate;
                if (state.decay < 0.1) {
                    state.decay = 0;
                    state.active = false;
                }
            }
        }
        
        return percussionState;
    }
    
    classifyPercussion() {
        // Energie in verschiedenen Frequenzbereichen (mit Preset-Bändern)
        const subBass = this.getEnergyInRange(...this.bands.subBass);
        const bass = this.getEnergyInRange(...this.bands.bass);
        const lowMid = this.getEnergyInRange(...this.bands.lowMid);
        const mid = this.getEnergyInRange(...this.bands.mid);
        const highMid = this.getEnergyInRange(...this.bands.highMid);
        const high = this.getEnergyInRange(...this.bands.high);
        
        const total = subBass + bass + lowMid + mid + highMid + high + 0.0001;
        
        // Relative Verteilung
        const lowRatio = (subBass + bass) / total;
        const midRatio = (lowMid + mid) / total;
        const highRatio = (highMid + high) / total;
        
        const t = this.thresholds;
        
        // Kick: Hauptenergie im Bass-Bereich
        if (lowRatio > t.kick.lowRatio) {
            percussionState.kick.active = true;
            percussionState.kick.decay = 1;
        }
        
        // Snare: Breitbandig mit hohem Anteil
        if (midRatio > t.snare.midRatio && highRatio > t.snare.highRatio) {
            percussionState.snare.active = true;
            percussionState.snare.decay = 1;
        }
        
        // Hi-Hat Closed: Sehr hoch
        if (highRatio > t.hihatClosed.highRatio) {
            percussionState['hihat-closed'].active = true;
            percussionState['hihat-closed'].decay = 1;
        }
        
        // Hi-Hat Open: Hoch aber breiter
        if (highRatio > t.hihatOpen.highRatioMin && 
            highRatio < t.hihatOpen.highRatioMax && 
            midRatio > t.hihatOpen.midRatio) {
            percussionState['hihat-open'].active = true;
            percussionState['hihat-open'].decay = 1;
        }
        
        // Tom: Mittlere Frequenzen dominant
        if (midRatio > t.tom.midRatio && 
            lowRatio > t.tom.lowRatio && 
            highRatio < t.tom.highRatioMax) {
            percussionState.tom.active = true;
            percussionState.tom.decay = 1;
        }
        
        // Crash: Breitbandig
        if (highRatio > t.crash.highRatio && midRatio > t.crash.midRatio) {
            percussionState.crash.active = true;
            percussionState.crash.decay = 1;
        }
    }
}

// ============================================
// FACTORY & UI
// ============================================

let percussionDetectorInstance = null;
let detectedPercussionEl = null;

export function createPercussionDetector(audioContext, analyser) {
    percussionDetectorInstance = new PercussionDetector(audioContext, analyser);
    return percussionDetectorInstance;
}

export function getPercussionDetector() {
    return percussionDetectorInstance;
}

export function setPercussionPreset(presetName) {
    if (percussionDetectorInstance) {
        percussionDetectorInstance.loadPreset(presetName);
    }
    percussionState.currentPreset = presetName;
    
    // Status anzeigen
    const statusEl = document.getElementById('percussionPresetStatus');
    if (statusEl) {
        const preset = percussionPresets[presetName];
        if (preset) {
            statusEl.textContent = preset.description;
            statusEl.style.color = '#4f4';
            setTimeout(() => {
                statusEl.style.color = '#666';
            }, 2000);
        }
    }
}

export function initPercussionUI() {
    console.log('initPercussionUI called');
    
    detectedPercussionEl = document.getElementById('detectedPercussion');
    if (detectedPercussionEl) {
        detectedPercussionEl.innerHTML = `
            <span class="perc-badge kick">KICK</span>
            <span class="perc-badge snare">SNARE</span>
            <span class="perc-badge hihat-closed">HH-C</span>
            <span class="perc-badge hihat-open">HH-O</span>
            <span class="perc-badge tom">TOM</span>
            <span class="perc-badge crash">CRASH</span>
        `;
    }
    
    // Preset Dropdown - Event Handler hinzufügen
    const presetSelect = document.getElementById('percussionPreset');
    if (presetSelect) {
        // Aktuellen Wert setzen
        presetSelect.value = percussionState.currentPreset;
        
        presetSelect.addEventListener('change', (e) => {
            console.log('Percussion preset changed:', e.target.value);
            setPercussionPreset(e.target.value);
        });
    }
    
    // Enable Checkbox Event Handler
    const checkbox = document.getElementById('percussionEnabled');
    console.log('Percussion checkbox element:', checkbox);
    
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            console.log('Percussion checkbox changed:', e.target.checked);
            percussionState.enabled = e.target.checked;
            if (e.target.checked) {
                // Badges anzeigen
                if (detectedPercussionEl) {
                    detectedPercussionEl.innerHTML = `
                        <span class="perc-badge kick">KICK</span>
                        <span class="perc-badge snare">SNARE</span>
                        <span class="perc-badge hihat-closed">HH-C</span>
                        <span class="perc-badge hihat-open">HH-O</span>
                        <span class="perc-badge tom">TOM</span>
                        <span class="perc-badge crash">CRASH</span>
                    `;
                }
            } else if (detectedPercussionEl) {
                detectedPercussionEl.innerHTML = '<span style="color:#666">-</span>';
            }
        });
        console.log('Percussion checkbox handler attached');
    } else {
        console.error('Percussion checkbox NOT FOUND!');
    }
}

export function updatePercussionUI() {
    if (!detectedPercussionEl) return;
    
    for (const name of ['kick', 'snare', 'hihat-closed', 'hihat-open', 'tom', 'crash']) {
        const state = percussionState[name];
        const badge = detectedPercussionEl.querySelector(`.perc-badge.${name}`);
        if (badge) {
            if (state.active || state.decay > 0.3) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        }
    }
}

export function setPercussionEnabled(enabled) {
    percussionState.enabled = enabled;
}

export function isPercussionEnabled() {
    return percussionState.enabled;
}
