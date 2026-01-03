/**
 * AUDIO CHAIN
 * 
 * Audio-Verarbeitungskette:
 * - 5-Band Parametric EQ
 * - Master Gain
 * - Analyser für Visualisierung
 * - Audio Passthrough
 */

// ============================================
// STATE
// ============================================

export let audioContext = null;
export let analyser = null;
export let masterGainNode = null;
export let eqNodes = {};

// Getter für sicheren Zugriff auf analyser (ES6 live binding workaround)
export function getAnalyser() {
    return analyser;
}

export const audioState = {
    sensitivity: 0.05,
    reactionSmoothing: 0.3,
    passthroughEnabled: false,
    currentOutputDeviceId: ''
};

// Passthrough Nodes
let passthroughGainNode = null;
let passthroughDestination = null;
let passthroughAudioElement = null;

// ============================================
// AUDIO CHAIN CREATION
// ============================================

/**
 * Erstellt die komplette Audio-Verarbeitungskette
 * @param {MediaStream} stream - Audio-Input Stream
 * @returns {AudioContext}
 */
export function createAudioChain(stream) {
    audioContext = new AudioContext();
    
    const source = audioContext.createMediaStreamSource(stream);
    
    // 5-Band Parametric EQ Konfiguration
    const eqConfig = {
        low:     { freq: 100,  type: 'lowshelf' },
        lowMid:  { freq: 400,  type: 'peaking', Q: 1.5 },
        mid:     { freq: 1000, type: 'peaking', Q: 1.5 },
        highMid: { freq: 2500, type: 'peaking', Q: 1.5 },
        high:    { freq: 6000, type: 'highshelf' }
    };
    
    let lastNode = source;
    
    // EQ-Bänder erstellen und verketten
    Object.entries(eqConfig).forEach(([name, config]) => {
        const eq = audioContext.createBiquadFilter();
        eq.type = config.type;
        eq.frequency.value = config.freq;
        if (config.Q) eq.Q.value = config.Q;
        eq.gain.value = 0;
        
        lastNode.connect(eq);
        lastNode = eq;
        eqNodes[name] = eq;
    });
    
    // Master Gain
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 1;
    lastNode.connect(masterGainNode);
    
    // Analyser für Visualisierung
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = audioState.reactionSmoothing;
    masterGainNode.connect(analyser);
    
    // Audio Passthrough Setup
    setupPassthrough();
    
    return audioContext;
}

/**
 * Richtet Audio-Passthrough ein
 */
function setupPassthrough() {
    if (!audioContext || !masterGainNode) return;
    
    passthroughGainNode = audioContext.createGain();
    passthroughGainNode.gain.value = 0; // Startet stumm
    masterGainNode.connect(passthroughGainNode);
    
    // MediaStreamDestination für Audio-Output
    passthroughDestination = audioContext.createMediaStreamDestination();
    passthroughGainNode.connect(passthroughDestination);
    
    // Audio-Element für Output-Gerät-Auswahl
    if (!passthroughAudioElement) {
        passthroughAudioElement = document.createElement('audio');
        passthroughAudioElement.autoplay = true;
        document.body.appendChild(passthroughAudioElement);
    }
    passthroughAudioElement.srcObject = passthroughDestination.stream;
    
    // Ausgabegerät setzen wenn bereits gewählt
    if (audioState.currentOutputDeviceId && passthroughAudioElement.setSinkId) {
        passthroughAudioElement.setSinkId(audioState.currentOutputDeviceId).catch(e => {
            console.warn('Konnte Ausgabegerät nicht setzen:', e);
        });
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Konvertiert dB zu linearem Gain
 */
export function dbToGain(db) {
    return Math.pow(10, db / 20);
}

/**
 * Konvertiert linearen Gain zu dB
 */
export function gainToDb(gain) {
    return 20 * Math.log10(gain);
}

// ============================================
// SETTERS
// ============================================

/**
 * Setzt EQ-Band Gain
 */
export function setEqGain(band, gainDb) {
    if (eqNodes[band]) {
        eqNodes[band].gain.value = gainDb;
    }
}

/**
 * Setzt Master-Gain (0-2, 1 = Unity)
 */
export function setMasterGain(value) {
    if (masterGainNode) {
        masterGainNode.gain.value = value;
    }
}

/**
 * Setzt Analyser Smoothing
 */
export function setReactionSmoothing(value) {
    audioState.reactionSmoothing = value;
    if (analyser) {
        analyser.smoothingTimeConstant = value;
    }
}

/**
 * Aktiviert/Deaktiviert Passthrough
 */
export function setPassthroughEnabled(enabled) {
    audioState.passthroughEnabled = enabled;
    if (passthroughGainNode) {
        passthroughGainNode.gain.value = enabled ? 1 : 0;
    }
}

/**
 * Setzt Output-Gerät für Passthrough
 */
export async function setOutputDevice(deviceId) {
    audioState.currentOutputDeviceId = deviceId;
    if (passthroughAudioElement && passthroughAudioElement.setSinkId) {
        try {
            await passthroughAudioElement.setSinkId(deviceId);
        } catch (e) {
            console.warn('Konnte Ausgabegerät nicht setzen:', e);
        }
    }
}

/**
 * Setzt Sensitivity für Pitch Detection
 */
export function setSensitivity(value) {
    audioState.sensitivity = value;
}

// ============================================
// GETTERS
// ============================================

export function getAudioContext() {
    return audioContext;
}

export function isAudioActive() {
    return audioContext !== null && audioContext.state === 'running';
}

/**
 * Gibt aktuellen Audio-Level zurück (0-1)
 */
export function getCurrentLevel() {
    if (!analyser) return 0;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    
    return sum / (dataArray.length * 255);
}
