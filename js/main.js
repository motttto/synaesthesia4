/**
 * SYNÄSTHESIE - MAIN ENTRY POINT
 * 
 * Initialisiert alle Module und startet den Animation Loop
 */

// ============================================
// IMPORTS
// ============================================

// Config
import { ClaraColors, AlexColors, colorState } from './config/colors.js';
import { IntervalNames, getModelForInterval } from './config/intervals.js';

// Core
import { 
    THREE, scene, camera, renderer, composer, controls,
    handleResize, defaultCameraPosition, defaultCameraTarget, defaultFov
} from './core/three-setup.js';
import { edgePass, afterimagePass, blurPasses, setBlurIntensity, setTrailsIntensity } from './core/postprocessing.js';
import { 
    initParticleSystem, updateParticles, setParticleColor, 
    setParticlesEnabled, particleState 
} from './core/particles.js';

// Models
import { 
    initializeModels, loadModel, modelState,
    storeOriginalGeometry, cleanupModelMaps, cleanupScene,
    updateMorphTransition, setModelScale, setMorphingEnabled, 
    setMorphDuration, setModelVisibility,
    setRefreshVisualsCallback as setModelRefreshCallback
} from './models/model-manager.js';

// Effects
import { 
    activeEffects, effectIntensities, effectState,
    applyEffects, toggleEffect, clearAllEffects, resetAll,
    resetGeometry, initEffectUI, setRefreshVisualsCallback
} from './effects/visual-effects.js';

// Audio
import { 
    createAudioChain, audioContext, analyser, 
    setEqGain, setMasterGain, setReactionSmoothing,
    setPassthroughEnabled, setOutputDevice, setSensitivity, getCurrentLevel,
    dbToGain
} from './audio/audio-chain.js';
import { 
    detectBeat, triggerBeatEffects, updateBeatEffects, beatState, initBeatUI 
} from './audio/beat-detector.js';
import { 
    PitchDetector, createPitchDetector, getPitchDetector,
    activeAlgorithms, combineMode, setSensitivity as setPitchSensitivity,
    setCombineMode
} from './audio/pitch-detector.js';
import { 
    PercussionDetector, createPercussionDetector, percussionState,
    initPercussionUI, updatePercussionUI 
} from './audio/percussion.js';

// Input
import { 
    loadMidiDevices, connectMidiInput, getMidiNotes, midiState,
    initMidiUI, setOnMidiNoteCallback
} from './input/midi.js';
import { 
    initSpeechRecognition, startSpeech, stopSpeech, speechState,
    initSpeechUI, setOnSpeechResultCallback
} from './input/speech.js';

// Analysis
import { analyzeIntervals, detectChord, defaultAnalysis } from './analysis/intervals.js';
import { 
    applyColors, getColorForNote, getColorForChord,
    colorCalcState, setActiveSchema, refreshVisuals, initColorUI
} from './analysis/colors.js';

// Camera
import { 
    resetCamera, toggleAutoOrbit, updateAutoOrbit, updateFovWithAudio,
    cameraState, initCameraUI, setCameraLocked
} from './camera/controls.js';

// Stream
import { initStream, setMainCanvas, updateAiState } from './stream/obs-stream.js';

// AI Image
import { initAiUI, updateFromSpeech as updateAiFromSpeech, aiState } from './ai/ai-image.js';

// ============================================
// STATE
// ============================================

let lastFrameTime = performance.now();
let lastNotes = [];
let pitchDetector = null;
let percussionDetector = null;
let isRunning = false;

// UI Elements
let levelMeter = null;
let startBtn = null;
let audioSourceSelect = null;

// ============================================
// AUDIO SOURCE MANAGEMENT
// ============================================

async function loadAudioDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        
        // Input-Geräte
        if (audioSourceSelect) {
            audioSourceSelect.innerHTML = '<option value="">-- Select Audio Source --</option>';
            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${audioSourceSelect.options.length}`;
                audioSourceSelect.appendChild(option);
            });
        }
        
        // Output-Geräte
        const audioOutputSelect = document.getElementById('audioOutputSelect');
        if (audioOutputSelect) {
            audioOutputSelect.innerHTML = '<option value="">-- Select Output --</option>';
            audioOutputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Speaker ${audioOutputSelect.options.length}`;
                audioOutputSelect.appendChild(option);
            });
        }
        
        return audioInputs;
    } catch (err) {
        console.error('Audio devices could not be loaded:', err);
        return [];
    }
}

async function startAudio(deviceId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        
        const ctx = createAudioChain(stream);
        
        // Pitch Detector erstellen
        pitchDetector = createPitchDetector(ctx, analyser);
        
        // Percussion Detector erstellen falls aktiviert
        if (percussionState.enabled) {
            percussionDetector = createPercussionDetector(ctx, analyser);
        }
        
        isRunning = true;
        
        if (startBtn) {
            startBtn.textContent = '⏹ Stop';
            startBtn.style.background = 'linear-gradient(135deg, #f44, #c33)';
        }
        
        console.log('Audio gestartet');
        
    } catch (err) {
        console.error('Audio-Start fehlgeschlagen:', err);
        alert('Audioquelle konnte nicht gestartet werden: ' + err.message);
    }
}

function stopAudio() {
    isRunning = false;
    pitchDetector = null;
    percussionDetector = null;
    
    if (startBtn) {
        startBtn.textContent = '▶ Start';
        startBtn.style.background = '';
    }
}

// ============================================
// UI UPDATE
// ============================================

function updateUI(notes, analysis) {
    // Erkannte Töne als farbige Badges anzeigen
    const notesDisplay = document.getElementById('detectedNotes');
    if (notesDisplay) {
        if (notes.length === 0) {
            notesDisplay.innerHTML = '<span style="color:#666">-</span>';
        } else {
            notesDisplay.innerHTML = notes.map(note => {
                const colorHex = getColorForNote(note);
                const color = '#' + colorHex.toString(16).padStart(6, '0');
                return `<span class="note-badge" style="background:${color}">${note.full || note.name}</span>`;
            }).join('');
        }
    }
    
    // Intervalle und Akkord anzeigen
    const intervalDisplay = document.getElementById('intervalDisplay');
    if (intervalDisplay && analysis) {
        let text = '';
        if (analysis.intervals && analysis.intervals.length > 0) {
            text = analysis.intervals.map(i => i.name).join(', ');
        }
        if (analysis.chord) {
            text += (text ? ' | ' : '') + analysis.chord.full;
        }
        intervalDisplay.textContent = text || '-';
    } else if (intervalDisplay) {
        intervalDisplay.textContent = '-';
    }
    
    // Modell wechseln basierend auf Intervall
    if (analysis && analysis.intervals.length > 0) {
        const mainInterval = analysis.intervals[0].semitones;
        loadModel(mainInterval);
    }
}

function updateLevelMeter() {
    if (!analyser || !levelMeter) return;
    
    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);
    
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
        sum += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sum / timeData.length);
    const db = 20 * Math.log10(rms + 0.0001);
    const percent = Math.max(0, Math.min(100, (db + 60) * 1.67));
    
    levelMeter.style.width = percent + '%';
    
    // Gain-Level für Helligkeit
    if (effectState.gainLinked) {
        effectState.currentGainLevel = percent / 100;
    }
    
    return percent / 100;
}

// ============================================
// ANIMATION LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);
    
    const now = performance.now();
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    
    // Audio-Level aktualisieren
    const audioLevel = updateLevelMeter() || 0;
    
    // MIDI hat Priorität
    if (midiState.enabled && getMidiNotes().length > 0) {
        const midiNotesList = getMidiNotes();
        const analysis = analyzeIntervals(midiNotesList);
        updateUI(midiNotesList, analysis);
        applyColors(analysis);
    } 
    // Pitch Detection
    else if (pitchDetector && isRunning) {
        const notes = pitchDetector.detect();
        
        const notesChanged = notes.length !== lastNotes.length || 
            notes.some((n, i) => !lastNotes[i] || n.midi !== lastNotes[i].midi);
        
        if (notesChanged) {
            lastNotes = notes;
            const analysis = analyzeIntervals(notes);
            updateUI(notes, analysis);
            applyColors(analysis);
        } else if (effectState.gainLinked && colorCalcState.lastAnalysis) {
            applyColors(colorCalcState.lastAnalysis);
        }
    } 
    // Nur Gain-Update
    else if (effectState.gainLinked && colorCalcState.lastAnalysis) {
        applyColors(colorCalcState.lastAnalysis);
    }
    
    // Percussion Detection
    if (percussionState.enabled && percussionDetector) {
        const percStates = percussionDetector.detect();
        updatePercussionUI(percStates);
    } else if (percussionState.enabled && !percussionDetector && analyser && audioContext) {
        percussionDetector = createPercussionDetector(audioContext, analyser);
    }
    
    // Beat Detection
    if (analyser) {
        const beatDetected = detectBeat(analyser);
        if (beatDetected) {
            triggerBeatEffects();
        }
    }
    
    // Beat-Effekte abklingen
    updateBeatEffects(deltaTime);
    
    // Kamera
    updateAutoOrbit();
    updateFovWithAudio(audioLevel);
    
    // Partikel
    updateParticles(deltaTime, audioLevel);
    
    // Visual Effects auf Modell
    if (modelState.currentModel && colorCalcState.activeSchema !== 'alex') {
        applyEffects(modelState.currentModel, deltaTime);
    }
    
    // Morphing Update
    if (modelState.morphingInProgress) {
        updateMorphTransition();
    }
    
    // Modell-Sichtbarkeit (modelVisible UND Schema berücksichtigen)
    const showModel = modelState.modelVisible && (colorCalcState.activeSchema !== 'alex');
    if (modelState.currentModel) {
        modelState.currentModel.visible = showModel;
    }
    
    // Modell-Rotation und Skalierung
    if (showModel && modelState.currentModel && !modelState.morphingInProgress) {
        let rotationSpeed = beatState.baseRotationSpeed;
        if (beatState.rotationEnabled && beatState.rotationAmount > 0) {
            rotationSpeed += beatState.rotationAmount;
        }
        modelState.currentModel.rotation.y += rotationSpeed;
        
        let finalScale = modelState.currentScale || 1;
        
        if (effectState.audioScaleEnabled && audioLevel > 0) {
            finalScale *= (1 + audioLevel * effectState.audioScaleAmount);
        }
        
        if (beatState.pulseEnabled && beatState.pulseAmount > 0) {
            finalScale *= (1 + beatState.pulseAmount * 0.15);
        }
        
        modelState.currentModel.scale.set(finalScale, finalScale, finalScale);
    }
    
    // Controls und Render
    controls.update();
    composer.render();
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    console.log('Synästhesie initialisieren...');
    
    // UI Elements
    levelMeter = document.getElementById('levelMeter');
    startBtn = document.getElementById('startBtn');
    audioSourceSelect = document.getElementById('audioSourceSelect');
    
    // Callback für refreshVisuals setzen
    setRefreshVisualsCallback(refreshVisuals);
    setModelRefreshCallback(refreshVisuals);
    
    // MIDI Note Callback
    setOnMidiNoteCallback((notes) => {
        const analysis = analyzeIntervals(notes);
        updateUI(notes, analysis);
        applyColors(analysis);
    });
    
    // Module initialisieren
    initParticleSystem();
    await initializeModels();
    
    // UI Handlers initialisieren
    initEffectUI();
    initBeatUI();
    initPercussionUI();
    initMidiUI();
    initSpeechUI();
    initColorUI();
    initCameraUI();
    initStream();
    initAiUI();
    
    // Speech → AI Callback
    setOnSpeechResultCallback((rawText, filteredText) => {
        updateAiFromSpeech(rawText, filteredText);
    });
    
    // Audio-Geräte laden
    await loadAudioDevices();
    loadMidiDevices();
    
    // Start Button Handler
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (isRunning) {
                stopAudio();
            } else {
                const deviceId = audioSourceSelect?.value;
                if (!deviceId) {
                    alert('Please select an audio source');
                    return;
                }
                await startAudio(deviceId);
            }
        });
    }
    
    // ============================================
    // AUDIO OUTPUT HANDLERS
    // ============================================
    
    const audioOutputSelect = document.getElementById('audioOutputSelect');
    if (audioOutputSelect) {
        audioOutputSelect.addEventListener('change', (e) => {
            setOutputDevice(e.target.value);
        });
    }
    
    const passthroughCheckbox = document.getElementById('audioPassthroughEnabled');
    const passthroughVolumeSlider = document.getElementById('passthroughVolume');
    const passthroughVolumeControl = document.getElementById('passthroughVolumeControl');
    
    if (passthroughCheckbox) {
        passthroughCheckbox.addEventListener('change', (e) => {
            setPassthroughEnabled(e.target.checked);
            if (passthroughVolumeSlider) passthroughVolumeSlider.disabled = !e.target.checked;
            if (passthroughVolumeControl) passthroughVolumeControl.style.opacity = e.target.checked ? '1' : '0.5';
        });
    }
    
    if (passthroughVolumeSlider) {
        passthroughVolumeSlider.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value) / 100;
            // TODO: setPassthroughVolume(vol) wenn implementiert
            const display = document.getElementById('passthroughVolumeValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // ============================================
    // MASTER & EQ HANDLERS
    // ============================================
    
    const masterGainSlider = document.getElementById('masterGain');
    if (masterGainSlider) {
        masterGainSlider.addEventListener('input', (e) => {
            const db = parseFloat(e.target.value);
            const gain = dbToGain(db);
            setMasterGain(gain);
            const display = document.getElementById('gainValue');
            if (display) display.textContent = db.toFixed(1) + ' dB';
        });
    }
    
    // EQ Sliders
    const eqLowSlider = document.getElementById('eqLow');
    const eqMidSlider = document.getElementById('eqMid');
    const eqHighSlider = document.getElementById('eqHigh');
    
    if (eqLowSlider) {
        eqLowSlider.addEventListener('input', (e) => {
            const db = parseFloat(e.target.value);
            setEqGain('low', db);
            const display = document.getElementById('eqLowValue');
            if (display) display.textContent = db.toFixed(0);
        });
    }
    
    if (eqMidSlider) {
        eqMidSlider.addEventListener('input', (e) => {
            const db = parseFloat(e.target.value);
            setEqGain('mid', db);
            const display = document.getElementById('eqMidValue');
            if (display) display.textContent = db.toFixed(0);
        });
    }
    
    if (eqHighSlider) {
        eqHighSlider.addEventListener('input', (e) => {
            const db = parseFloat(e.target.value);
            setEqGain('high', db);
            const display = document.getElementById('eqHighValue');
            if (display) display.textContent = db.toFixed(0);
        });
    }
    
    const eqResetBtn = document.getElementById('eqReset');
    if (eqResetBtn) {
        eqResetBtn.addEventListener('click', () => {
            setEqGain('low', 0);
            setEqGain('mid', 0);
            setEqGain('high', 0);
            if (eqLowSlider) eqLowSlider.value = 0;
            if (eqMidSlider) eqMidSlider.value = 0;
            if (eqHighSlider) eqHighSlider.value = 0;
            document.getElementById('eqLowValue').textContent = '0';
            document.getElementById('eqMidValue').textContent = '0';
            document.getElementById('eqHighValue').textContent = '0';
        });
    }
    
    // ============================================
    // 3D MODEL HANDLERS
    // ============================================
    
    const scaleSlider = document.getElementById('scaleSlider');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            setModelScale(scale);
            const display = document.getElementById('scaleValue');
            if (display) display.textContent = scale.toFixed(1);
        });
    }
    
    const sensitivitySlider = document.getElementById('sensitivitySlider');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', (e) => {
            const sens = parseFloat(e.target.value);
            setSensitivity(sens);
            const display = document.getElementById('sensitivityValue');
            if (display) display.textContent = sens.toFixed(2);
        });
    }
    
    const morphingCheckbox = document.getElementById('morphingEnabled');
    const morphDurationSlider = document.getElementById('morphDuration');
    const morphDurationControl = document.getElementById('morphDurationControl');
    
    if (morphingCheckbox) {
        morphingCheckbox.addEventListener('change', (e) => {
            setMorphingEnabled(e.target.checked);
            if (morphDurationControl) morphDurationControl.style.opacity = e.target.checked ? '1' : '0.5';
            if (morphDurationSlider) morphDurationSlider.disabled = !e.target.checked;
        });
    }
    
    if (morphDurationSlider) {
        morphDurationSlider.addEventListener('input', (e) => {
            const duration = parseInt(e.target.value);
            setMorphDuration(duration);
            const display = document.getElementById('morphDurationValue');
            if (display) display.textContent = duration + 'ms';
        });
    }
    
    const modelVisibilityBtn = document.getElementById('modelVisibilityBtn');
    if (modelVisibilityBtn) {
        // Initial: Modell ist sichtbar (Button nicht active)
        modelVisibilityBtn.classList.remove('active');
        modelState.modelVisible = true;
        
        modelVisibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = modelVisibilityBtn.classList.toggle('active');
            // active = Auge durchgestrichen = Modell versteckt
            setModelVisibility(!isHidden);
        });
    }
    
    // ============================================
    // PITCH DETECTION HANDLERS
    // ============================================
    
    const reactionSpeedSlider = document.getElementById('reactionSpeed');
    if (reactionSpeedSlider) {
        reactionSpeedSlider.addEventListener('input', (e) => {
            const percent = parseInt(e.target.value);
            // 0% = 0.9 (langsam), 100% = 0.1 (schnell)
            const smoothing = 0.9 - (percent / 100) * 0.8;
            setReactionSmoothing(smoothing);
            const display = document.getElementById('reactionSpeedValue');
            if (display) display.textContent = percent + '%';
        });
    }
    
    // Algorithm Buttons
    document.querySelectorAll('.algo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const algo = btn.dataset.algo;
            btn.classList.toggle('active');
            if (activeAlgorithms) {
                if (btn.classList.contains('active')) {
                    activeAlgorithms.add(algo);
                } else {
                    activeAlgorithms.delete(algo);
                }
            }
        });
    });
    
    const algoCombineModeSelect = document.getElementById('algoCombineMode');
    if (algoCombineModeSelect) {
        algoCombineModeSelect.addEventListener('change', (e) => {
            setCombineMode(e.target.value);
        });
    }
    
    // ============================================
    // CAMERA BLUR HANDLER
    // ============================================
    
    const cameraBlurSlider = document.getElementById('cameraBlur');
    if (cameraBlurSlider) {
        cameraBlurSlider.addEventListener('input', (e) => {
            const percent = parseInt(e.target.value);
            setBlurIntensity(percent / 100);
            const display = document.getElementById('cameraBlurValue');
            if (display) display.textContent = percent + '%';
        });
    }
    
    // Resize Handler
    window.addEventListener('resize', handleResize);
    
    // Default-Farben anwenden
    applyColors(defaultAnalysis);
    
    // Animation Loop starten
    animate();
    
    console.log('Synästhesie bereit!');
}

// ============================================
// START
// ============================================

// Warten bis DOM geladen
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export für Debugging
window.Synaesthesia = {
    modelState,
    colorCalcState,
    effectState,
    beatState,
    midiState,
    speechState,
    percussionState,
    aiState,
    activeEffects,
    scene,
    camera,
    renderer
};
