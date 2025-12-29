/**
 * BEAT DETECTION
 * 
 * Erkennt Beats im Audio-Signal
 * BPM-Berechnung und Beat-getriggerte Effekte
 */

// ============================================
// STATE
// ============================================

export const beatState = {
    sensitivity: 0.5,
    minBpm: 60,
    maxBpm: 180,
    flashEnabled: true,
    pulseEnabled: false,
    rotationEnabled: false,
    baseRotationSpeed: 0.002,
    currentBpm: 0,
    pulseAmount: 0,
    rotationAmount: 0
};

// Interne Variablen
let beatTimes = [];
let lastBeatTime = 0;
let energyHistory = [];
const ENERGY_HISTORY_SIZE = 43; // ~1 Sekunde bei 60fps

// UI Elements
let beatIndicator = null;
let bpmValueDisplay = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialisiert Beat Detection UI
 */
export function initBeatUI() {
    beatIndicator = document.getElementById('beatIndicator');
    bpmValueDisplay = document.getElementById('bpmValue');
    
    // Event Handlers
    const sensitivitySlider = document.getElementById('beatSensitivity');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', (e) => {
            beatState.sensitivity = parseInt(e.target.value) / 100;
            document.getElementById('beatSensitivityValue').textContent = e.target.value + '%';
        });
    }
    
    const flashCheckbox = document.getElementById('beatFlashEnabled');
    if (flashCheckbox) {
        flashCheckbox.addEventListener('change', (e) => {
            beatState.flashEnabled = e.target.checked;
        });
    }
    
    const pulseCheckbox = document.getElementById('beatPulseEnabled');
    if (pulseCheckbox) {
        pulseCheckbox.addEventListener('change', (e) => {
            beatState.pulseEnabled = e.target.checked;
        });
    }
    
    const rotationCheckbox = document.getElementById('beatRotationEnabled');
    if (rotationCheckbox) {
        rotationCheckbox.addEventListener('change', (e) => {
            beatState.rotationEnabled = e.target.checked;
        });
    }
    
    const rotationSpeedSlider = document.getElementById('rotationSpeed');
    if (rotationSpeedSlider) {
        rotationSpeedSlider.addEventListener('input', (e) => {
            const percent = parseInt(e.target.value);
            document.getElementById('rotationSpeedValue').textContent = percent + '%';
            beatState.baseRotationSpeed = (percent / 100) * 0.01;
        });
    }
}

// ============================================
// BEAT DETECTION
// ============================================

/**
 * Analysiert Audio und erkennt Beats
 * @param {AnalyserNode} analyser - Web Audio Analyser
 * @returns {boolean} true wenn Beat erkannt
 */
export function detectBeat(analyser) {
    if (!analyser) return false;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Berechne Energie (gewichtet auf Bass/Kick-Frequenzen 60-150Hz)
    let energy = 0;
    const sampleRate = analyser.context.sampleRate;
    const binSize = sampleRate / analyser.fftSize;
    const lowBin = Math.floor(60 / binSize);
    const highBin = Math.floor(150 / binSize);
    
    for (let i = lowBin; i < highBin && i < bufferLength; i++) {
        energy += dataArray[i] * dataArray[i];
    }
    energy = Math.sqrt(energy / (highBin - lowBin));
    
    // Energie-Historie aktualisieren
    energyHistory.push(energy);
    if (energyHistory.length > ENERGY_HISTORY_SIZE) {
        energyHistory.shift();
    }
    
    // Durchschnitt und Varianz berechnen
    const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
    const variance = energyHistory.reduce((a, b) => a + (b - avgEnergy) ** 2, 0) / energyHistory.length;
    const threshold = avgEnergy + Math.sqrt(variance) * (2 - beatState.sensitivity * 1.5);
    
    // Mindestabstand zwischen Beats (basierend auf Max BPM)
    const minBeatInterval = 60000 / beatState.maxBpm;
    const now = performance.now();
    
    // Beat erkannt?
    if (energy > threshold && energy > 30 && (now - lastBeatTime) > minBeatInterval) {
        lastBeatTime = now;
        beatTimes.push(now);
        
        // Alte Beat-Zeiten entfernen (älter als 4 Sekunden)
        beatTimes = beatTimes.filter(t => now - t < 4000);
        
        // BPM berechnen
        if (beatTimes.length >= 4) {
            const intervals = [];
            for (let i = 1; i < beatTimes.length; i++) {
                intervals.push(beatTimes[i] - beatTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            
            // Nur aktualisieren wenn im gültigen Bereich
            if (calculatedBpm >= beatState.minBpm && calculatedBpm <= beatState.maxBpm) {
                beatState.currentBpm = calculatedBpm;
                if (bpmValueDisplay) {
                    bpmValueDisplay.textContent = calculatedBpm + ' BPM';
                }
            }
        }
        
        return true;
    }
    
    return false;
}

/**
 * Triggert Beat-Effekte (Flash, Pulse, Rotation)
 */
export function triggerBeatEffects() {
    if (beatState.flashEnabled && beatIndicator) {
        beatIndicator.classList.add('flash');
        setTimeout(() => beatIndicator.classList.remove('flash'), 100);
    }
    
    if (beatState.pulseEnabled) {
        beatState.pulseAmount = 1.0;
    }
    
    if (beatState.rotationEnabled) {
        beatState.rotationAmount = Math.PI / 4; // 45° Rotation pro Beat
    }
}

/**
 * Update Beat-Effekte (im Animation Loop aufrufen)
 * @param {number} deltaTime - Zeit seit letztem Frame
 */
export function updateBeatEffects(deltaTime) {
    // Pulse abklingen lassen
    if (beatState.pulseAmount > 0) {
        beatState.pulseAmount *= 0.9;
        if (beatState.pulseAmount < 0.01) {
            beatState.pulseAmount = 0;
        }
    }
    
    // Rotation abklingen lassen
    if (beatState.rotationAmount > 0) {
        beatState.rotationAmount *= 0.95;
        if (beatState.rotationAmount < 0.001) {
            beatState.rotationAmount = 0;
        }
    }
}

// ============================================
// SETTERS
// ============================================

export function setBeatSensitivity(value) {
    beatState.sensitivity = value;
}

export function setBpmRange(min, max) {
    beatState.minBpm = min;
    beatState.maxBpm = max;
}

export function setFlashEnabled(enabled) {
    beatState.flashEnabled = enabled;
}

export function setPulseEnabled(enabled) {
    beatState.pulseEnabled = enabled;
}

export function setRotationEnabled(enabled) {
    beatState.rotationEnabled = enabled;
}

export function setBaseRotationSpeed(speed) {
    beatState.baseRotationSpeed = speed;
}

// ============================================
// GETTERS
// ============================================

export function getCurrentBpm() {
    return beatState.currentBpm;
}

export function getPulseAmount() {
    return beatState.pulseAmount;
}

export function getRotationAmount() {
    return beatState.rotationAmount;
}

/**
 * Reset Beat Detection State
 */
export function resetBeatDetection() {
    beatTimes = [];
    lastBeatTime = 0;
    energyHistory = [];
    beatState.currentBpm = 0;
    beatState.pulseAmount = 0;
    beatState.rotationAmount = 0;
    if (bpmValueDisplay) {
        bpmValueDisplay.textContent = '-- BPM';
    }
}
