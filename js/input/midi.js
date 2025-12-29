/**
 * MIDI INPUT & SYNTHESIZER
 * 
 * MIDI-Geräteverwaltung und einfacher Synthesizer
 * - MIDI-Input Erkennung und Verbindung
 * - Note On/Off Verarbeitung
 * - Einfacher Triangle-Wave Synth mit ADSR
 */

// ============================================
// STATE
// ============================================

let midiAccess = null;
let currentMidiInput = null;
let midiNotes = new Map(); // MIDI-Nummer -> { note, velocity, timestamp }

export const midiState = {
    enabled: false,
    synthEnabled: false,
    synthVolume: 0.5,
    connected: false,
    deviceName: ''
};

// Synth
let midiSynthContext = null;
let midiSynthGain = null;
const midiOscillators = new Map();

// Callbacks
let onMidiNoteCallback = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * MIDI-Nummer zu Note-Name
 */
export function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[midi % 12];
    const isSharp = noteName.includes('#');
    return { 
        name: noteName,
        baseName: noteName.replace('#', ''),
        isSharp: isSharp,
        octave: octave
    };
}

/**
 * MIDI zu Note-Object (kompatibel mit PitchDetector)
 */
export function midiToNoteObject(midiNum, velocity = 100) {
    const noteInfo = midiToNoteName(midiNum);
    const freq = 440 * Math.pow(2, (midiNum - 69) / 12);
    return {
        midi: midiNum,
        frequency: freq,
        name: noteInfo.name,
        isSharp: noteInfo.isSharp,
        octave: noteInfo.octave,
        full: noteInfo.name + noteInfo.octave,
        confidence: velocity / 127,
        source: 'midi'
    };
}

// ============================================
// MIDI DEVICE MANAGEMENT
// ============================================

/**
 * Lädt verfügbare MIDI-Geräte
 */
export async function loadMidiDevices() {
    const select = document.getElementById('midiDeviceSelect');
    const status = document.getElementById('midiStatus');
    
    try {
        midiAccess = await navigator.requestMIDIAccess();
        
        if (select) {
            select.innerHTML = '<option value="">-- MIDI Gerät wählen --</option>';
        }
        
        const inputs = Array.from(midiAccess.inputs.values());
        
        if (inputs.length === 0) {
            if (status) {
                status.textContent = 'Keine MIDI-Geräte gefunden';
                status.style.color = '#f66';
            }
            return [];
        }
        
        inputs.forEach((input, index) => {
            if (select) {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name || `MIDI Input ${index + 1}`;
                select.appendChild(option);
            }
        });
        
        if (status) {
            status.textContent = `${inputs.length} MIDI-Gerät(e) gefunden`;
            status.style.color = '#6f6';
        }
        
        // Auf Geräteänderungen hören
        midiAccess.onstatechange = () => loadMidiDevices();
        
        return inputs;
        
    } catch (err) {
        console.error('MIDI-Fehler:', err);
        if (status) {
            status.textContent = 'MIDI nicht verfügbar';
            status.style.color = '#f66';
        }
        return [];
    }
}

/**
 * Verbindet MIDI-Input
 */
export function connectMidiInput(inputId) {
    const status = document.getElementById('midiStatus');
    
    // Alte Verbindung trennen
    if (currentMidiInput) {
        currentMidiInput.onmidimessage = null;
        currentMidiInput = null;
    }
    
    if (!inputId || !midiAccess) {
        midiState.connected = false;
        return;
    }
    
    const input = midiAccess.inputs.get(inputId);
    if (!input) return;
    
    currentMidiInput = input;
    currentMidiInput.onmidimessage = handleMidiMessage;
    
    midiState.connected = true;
    midiState.deviceName = input.name;
    
    if (status) {
        status.textContent = `Verbunden: ${input.name}`;
        status.style.color = '#6f6';
    }
}

/**
 * Verarbeitet MIDI-Nachrichten
 */
function handleMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status >> 4;
    
    // Note On (command 9) oder Note Off (command 8)
    if (command === 9 && velocity > 0) {
        // Note On
        midiNotes.set(note, {
            note: midiToNoteObject(note, velocity),
            velocity: velocity,
            timestamp: performance.now()
        });
        startSynthNote(note, velocity);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
        // Note Off
        midiNotes.delete(note);
        stopSynthNote(note);
    }
    
    // Callback aufrufen
    if (midiState.enabled && onMidiNoteCallback) {
        onMidiNoteCallback(getMidiNotes());
    }
}

/**
 * Gibt aktuelle MIDI-Noten zurück
 */
export function getMidiNotes() {
    const notes = Array.from(midiNotes.values())
        .map(n => n.note)
        .sort((a, b) => a.midi - b.midi);
    return notes.slice(0, 4); // Max 4 Noten
}

// ============================================
// SYNTHESIZER
// ============================================

/**
 * Initialisiert Synth AudioContext
 */
function initMidiSynth() {
    if (midiSynthContext) return;
    
    midiSynthContext = new AudioContext();
    midiSynthGain = midiSynthContext.createGain();
    midiSynthGain.gain.value = midiState.synthVolume;
    midiSynthGain.connect(midiSynthContext.destination);
}

/**
 * Startet Synth-Note
 */
function startSynthNote(midiNum, velocity = 100) {
    if (!midiState.synthEnabled || !midiSynthContext) return;
    if (midiOscillators.has(midiNum)) return;
    
    const freq = 440 * Math.pow(2, (midiNum - 69) / 12);
    
    const osc = midiSynthContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    const noteGain = midiSynthContext.createGain();
    const velGain = (velocity / 127) * 0.3;
    
    // Attack
    noteGain.gain.setValueAtTime(0, midiSynthContext.currentTime);
    noteGain.gain.linearRampToValueAtTime(velGain, midiSynthContext.currentTime + 0.02);
    
    osc.connect(noteGain);
    noteGain.connect(midiSynthGain);
    osc.start();
    
    midiOscillators.set(midiNum, { osc, gain: noteGain });
}

/**
 * Stoppt Synth-Note
 */
function stopSynthNote(midiNum) {
    const noteData = midiOscillators.get(midiNum);
    if (!noteData) return;
    
    const { osc, gain } = noteData;
    
    // Release
    gain.gain.linearRampToValueAtTime(0, midiSynthContext.currentTime + 0.1);
    
    setTimeout(() => {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
    }, 150);
    
    midiOscillators.delete(midiNum);
}

/**
 * Stoppt alle Synth-Noten
 */
export function stopAllSynthNotes() {
    for (const midiNum of midiOscillators.keys()) {
        stopSynthNote(midiNum);
    }
}

// ============================================
// SETTERS & UI INIT
// ============================================

export function setMidiEnabled(enabled) {
    midiState.enabled = enabled;
    if (!enabled) {
        midiNotes.clear();
    }
}

export function setSynthEnabled(enabled) {
    midiState.synthEnabled = enabled;
    if (enabled) {
        initMidiSynth();
    } else {
        stopAllSynthNotes();
    }
}

export function setSynthVolume(volume) {
    midiState.synthVolume = volume;
    if (midiSynthGain) {
        midiSynthGain.gain.value = volume;
    }
}

export function setOnMidiNoteCallback(callback) {
    onMidiNoteCallback = callback;
}

/**
 * Initialisiert MIDI UI
 */
export function initMidiUI() {
    const select = document.getElementById('midiDeviceSelect');
    const enabledCheckbox = document.getElementById('midiEnabled');
    const synthCheckbox = document.getElementById('midiSynthEnabled');
    const volumeSlider = document.getElementById('midiSynthVolume');
    const volumeControl = document.getElementById('midiSynthVolumeControl');
    
    if (select) {
        select.addEventListener('change', (e) => {
            connectMidiInput(e.target.value);
        });
    }
    
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            setMidiEnabled(e.target.checked);
        });
    }
    
    if (synthCheckbox) {
        synthCheckbox.addEventListener('change', (e) => {
            setSynthEnabled(e.target.checked);
            if (volumeControl) {
                volumeControl.style.opacity = e.target.checked ? '1' : '0.5';
            }
            if (volumeSlider) {
                volumeSlider.disabled = !e.target.checked;
            }
        });
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            setSynthVolume(e.target.value / 100);
            const display = document.getElementById('midiSynthVolumeValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // MIDI beim Start laden
    loadMidiDevices();
}

// ============================================
// GETTERS
// ============================================

export function isMidiEnabled() {
    return midiState.enabled;
}

export function isMidiConnected() {
    return midiState.connected;
}

export function hasMidiNotes() {
    return midiNotes.size > 0;
}
