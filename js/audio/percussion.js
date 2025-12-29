/**
 * PERCUSSION DETECTOR
 * 
 * Erkennt Drum-Sounds in Echtzeit:
 * - Kick, Snare, Hi-Hat (closed/open), Tom, Crash
 * - Onset Detection mit Energy-Analyse
 * - Frequenzband-basierte Klassifikation
 */

// ============================================
// STATE
// ============================================

export const percussionState = {
    enabled: false,
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
        
        // Onset Detection
        this.prevEnergy = 0;
        this.energyHistory = [];
        this.historySize = 43; // ~1 Sekunde bei 43 fps
        this.onsetThreshold = 1.5;
        this.lastOnsetTime = 0;
        this.onsetCooldown = 50; // ms zwischen Onsets
        
        this.decayRate = 0.85;
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
        // Energie in verschiedenen Frequenzbereichen
        const subBass = this.getEnergyInRange(20, 80);      // Sub-Bass
        const bass = this.getEnergyInRange(80, 200);        // Bass/Kick
        const lowMid = this.getEnergyInRange(200, 500);     // Snare Body
        const mid = this.getEnergyInRange(500, 2000);       // Tom/Snare
        const highMid = this.getEnergyInRange(2000, 6000);  // Snare Wire/Hi-Hat
        const high = this.getEnergyInRange(6000, 16000);    // Hi-Hat/Crash
        
        const total = subBass + bass + lowMid + mid + highMid + high + 0.0001;
        
        // Relative Verteilung
        const lowRatio = (subBass + bass) / total;
        const midRatio = (lowMid + mid) / total;
        const highRatio = (highMid + high) / total;
        
        // Kick: Hauptenergie im Bass-Bereich
        if (lowRatio > 0.4) {
            percussionState.kick.active = true;
            percussionState.kick.decay = 1;
        }
        
        // Snare: Breitbandig mit hohem Anteil
        if (midRatio > 0.2 && highRatio > 0.15) {
            percussionState.snare.active = true;
            percussionState.snare.decay = 1;
        }
        
        // Hi-Hat Closed: Sehr hoch
        if (highRatio > 0.4) {
            percussionState['hihat-closed'].active = true;
            percussionState['hihat-closed'].decay = 1;
        }
        
        // Hi-Hat Open: Hoch aber breiter
        if (highRatio > 0.25 && highRatio < 0.45 && midRatio > 0.2) {
            percussionState['hihat-open'].active = true;
            percussionState['hihat-open'].decay = 1;
        }
        
        // Tom: Mittlere Frequenzen dominant
        if (midRatio > 0.35 && lowRatio > 0.15 && highRatio < 0.3) {
            percussionState.tom.active = true;
            percussionState.tom.decay = 1;
        }
        
        // Crash: Breitbandig
        if (highRatio > 0.3 && midRatio > 0.15) {
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

export function initPercussionUI() {
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
    
    // Event Handler
    const checkbox = document.getElementById('percussionEnabled');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            percussionState.enabled = e.target.checked;
            if (e.target.checked) {
                initPercussionUI();
            } else if (detectedPercussionEl) {
                detectedPercussionEl.innerHTML = '<span style="color:#666">-</span>';
            }
        });
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
