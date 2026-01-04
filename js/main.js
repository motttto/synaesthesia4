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
import {
    initVideoUI, updateVideoTexture, videoState,
    applyVideoToModel, removeVideoFromModel, onModelChanged
} from './core/video-texture.js';

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
    resetGeometry, initEffectUI, setRefreshVisualsCallback,
    updateKaleidoscope
} from './effects/visual-effects.js';
import {
    gridState, initGridFloor, updateGrid, setGridEnabled,
    setGridSize, setGridSpacing, setGridPosition, setLineWidth,
    setGlowEnabled, setGlowIntensity, setAudioEnabled, setAudioIntensity,
    setWaveHeight, setWaveSpeed, setGridColor, setUseSchemaColor, setGridEQ
} from './effects/grid-floor.js';

// Audio
import { 
    createAudioChain, audioContext, analyser, getAnalyser,
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
import {
    instrumentState, initInstrumentUI, getInstrumentForPrompt,
    startInstrumentDetection, stopInstrumentDetection
} from './audio/instrument-detector.js';

// Input
import { 
    loadMidiDevices, connectMidiInput, getMidiNotes, midiState,
    initMidiUI, setOnMidiNoteCallback
} from './input/midi.js';
import { 
    startSpeech, stopSpeech, speechState,
    initSpeechUI, setOnSpeechResultCallback, setAppAudioStream,
    detectSystemMicrophone, setBackend
} from './input/speech.js';
import {
    initSongRecognition, onLyricsLine, setAudioStream as setSongAudioStream,
    songState, getCurrentLyricLine
} from './audio/song-recognition.js';
import {
    cameraInputState, initCameraInputUI, renderCameraOverlay,
    loadCameraDevices, updateCameraTexture, onCameraModelChanged,
    getMappedPosition, skeletonState
} from './input/camera-input.js';

// Output
import {
    dmxState, initDMXUI, setDMXColor, setDMXAudioLevel, triggerDMXBeat
} from './output/dmx-output.js';
import {
    avatarState, initAvatarUI, updateAvatarPose, loadCharacter,
    setAvatarEnabled, setAvatarScale, setAvatarSmoothing, setAvatarMirror
} from './input/character-avatar.js';

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
import { initStream, setMainCanvas, updateAiState, captureAndSendFrame, compositeCleanOutput } from './stream/obs-stream.js';

// UI
import { initIntervalModal, setModelSet as setModalModelSet } from './ui/interval-modal.js';
import { spectrumAnalyzer } from './ui/spectrum.js';

// AI Image
import { initAiUI, updateFromSpeech as updateAiFromSpeech, aiState, onBeat as onAiBeat } from './ai/ai-image.js';

// ============================================
// STATE
// ============================================

let lastFrameTime = performance.now();
let lastNotes = [];
let pitchDetector = null;
let percussionDetector = null;
let isRunning = false;

// Background Stream Loop (läuft auch wenn App nicht im Fokus)
let backgroundStreamInterval = null;
let BACKGROUND_STREAM_FPS = 60; // Erhöht von 30 auf 60 für niedrigere Latenz

// UI Elements
let levelMeter = null;
let startBtn = null;
let audioSourceSelect = null;

// ============================================
// BACKGROUND STREAM LOOP
// Läuft unabhängig von requestAnimationFrame
// damit der Stream nicht abbricht wenn App nicht im Fokus
// ============================================

function startBackgroundStreamLoop() {
    if (backgroundStreamInterval) {
        clearInterval(backgroundStreamInterval);
    }
    
    console.log(`🎥 Background Stream Loop gestartet @ ${BACKGROUND_STREAM_FPS}fps`);
    
    backgroundStreamInterval = setInterval(() => {
        // Composite und Frame senden (läuft auch im Hintergrund!)
        captureAndSendFrame();
    }, 1000 / BACKGROUND_STREAM_FPS);
}

function stopBackgroundStreamLoop() {
    if (backgroundStreamInterval) {
        clearInterval(backgroundStreamInterval);
        backgroundStreamInterval = null;
        console.log('🎥 Background Stream Loop gestoppt');
    }
}

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
        
        // Spectrum Analyzer verbinden
        spectrumAnalyzer.setAnalyser(analyser);
        
        // Audio Stream für Speech Recognition bereitstellen (Whisper backends)
        setAppAudioStream(stream);
        setSongAudioStream(stream);
        console.log('🎙️ Audio Stream an Speech & Song Recognition weitergeleitet');
        
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
    const currentAnalyser = getAnalyser();
    
    // Debug: Einmal pro Sekunde loggen
    if (!window._levelMeterDebugTime || Date.now() - window._levelMeterDebugTime > 2000) {
        console.log('LevelMeter Debug:', {
            hasAnalyser: !!currentAnalyser,
            hasLevelMeter: !!levelMeter,
            levelMeterId: levelMeter?.id
        });
        window._levelMeterDebugTime = Date.now();
    }
    
    if (!currentAnalyser || !levelMeter) return 0;
    
    const timeData = new Float32Array(currentAnalyser.fftSize);
    currentAnalyser.getFloatTimeDomainData(timeData);
    
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
        sum += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sum / timeData.length);
    const db = 20 * Math.log10(rms + 0.0001);
    const percent = Math.max(0, Math.min(100, (db + 60) * 1.67));
    
    // Debug bei Audio
    if (percent > 1 && (!window._lastLevelLog || Date.now() - window._lastLevelLog > 1000)) {
        console.log('Audio Level:', percent.toFixed(1) + '%');
        window._lastLevelLog = Date.now();
    }
    
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
    
    // DMX Audio Level senden
    if (dmxState.enabled && dmxState.audioToDimmer) {
        setDMXAudioLevel(audioLevel);
    }
    
    // MIDI hat Priorität
    if (midiState.enabled && getMidiNotes().length > 0) {
        const midiNotesList = getMidiNotes();
        const analysis = analyzeIntervals(midiNotesList);
        updateUI(midiNotesList, analysis);
        applyColors(analysis);
        // DMX Farben senden
        if (dmxState.enabled && colorCalcState.lastColor) {
            const c = colorCalcState.lastColor;
            setDMXColor((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
        }
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
            // DMX Farben senden
            if (dmxState.enabled && colorCalcState.lastColor) {
                const c = colorCalcState.lastColor;
                setDMXColor((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
            }
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
            triggerDMXBeat();  // DMX Strobe on Beat
            // AI Image BPM Sync
            if (beatState.currentBpm > 0) {
                onAiBeat(beatState.currentBpm);
            }
        }
    }
    
    // Beat-Effekte abklingen
    updateBeatEffects(deltaTime);
    
    // Kamera
    updateAutoOrbit();
    updateFovWithAudio(audioLevel);
    
    // Partikel
    updateParticles(deltaTime, audioLevel);
    
    // Video Texture Update (mit Audio-Level für reactive displacement)
    updateVideoTexture(audioLevel);
    
    // Kaleidoscope Auto-Rotate
    updateKaleidoscope(deltaTime);
    
    // Grid Floor Update mit EQ-Daten
    const gridAnalyser = getAnalyser();
    if (gridState.enabled && gridAnalyser) {
        const freqData = new Uint8Array(gridAnalyser.frequencyBinCount);
        gridAnalyser.getByteFrequencyData(freqData);
        
        // EQ Bands berechnen (Low: 0-200Hz, Mid: 200-2000Hz, High: 2000-20000Hz)
        const nyquist = audioContext ? audioContext.sampleRate / 2 : 22050;
        const binSize = nyquist / freqData.length;
        
        const lowEnd = Math.floor(200 / binSize);
        const midEnd = Math.floor(2000 / binSize);
        
        let lowSum = 0, midSum = 0, highSum = 0;
        for (let i = 0; i < lowEnd && i < freqData.length; i++) lowSum += freqData[i];
        for (let i = lowEnd; i < midEnd && i < freqData.length; i++) midSum += freqData[i];
        for (let i = midEnd; i < freqData.length; i++) highSum += freqData[i];
        
        const low = (lowSum / Math.max(1, lowEnd)) / 255;
        const mid = (midSum / Math.max(1, midEnd - lowEnd)) / 255;
        const high = (highSum / Math.max(1, freqData.length - midEnd)) / 255;
        
        updateGrid(deltaTime, { low, mid, high });
    } else if (gridState.enabled) {
        updateGrid(deltaTime, { low: 0, mid: 0, high: 0 });
    }
    
    // Visual Effects auf Modell
    if (modelState.currentModel && colorCalcState.activeSchema !== 'alex') {
        // Audio-Level für Explode-Effekt setzen
        effectState.currentAudioLevel = audioLevel;
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
    // Auch Morphing-Modelle verstecken wenn Visibility aus
    if (modelState.morphOutgoingModel) {
        modelState.morphOutgoingModel.visible = showModel;
    }
    if (modelState.morphIncomingModel) {
        modelState.morphIncomingModel.visible = showModel;
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
        
        // 3D Model Mapping auf Tracking-Position
        const mappedPos = getMappedPosition();
        if (mappedPos && skeletonState.modelMapping.target !== 'none') {
            // Normalisierte Koordinaten (0-1) in 3D-Koordinaten umrechnen
            // x: 0 = links (-range), 1 = rechts (+range)
            // y: 0 = oben (+range), 1 = unten (-range) - invertiert!
            const range = 15; // Bewegungsbereich in 3D-Einheiten
            const x = (mappedPos.x - 0.5) * 2 * range;
            const y = (0.5 - mappedPos.y) * 2 * range; // invertiert
            const z = mappedPos.z * range * 0.5; // z ist meist klein
            
            modelState.currentModel.position.set(x, y, z);
            
            // Scale vom Mapping anwenden
            finalScale *= mappedPos.scale;
        } else {
            // Zurück zur Standardposition wenn Mapping aus
            modelState.currentModel.position.set(0, 0, 0);
        }
        
        modelState.currentModel.scale.set(finalScale, finalScale, finalScale);
    }
    
    // Controls und Render
    controls.update();
    composer.render();
    
    // Camera Input Overlay (nach dem Haupt-Render)
    if (cameraInputState.enabled) {
        renderCameraOverlay(renderer.domElement, audioLevel);
        updateCameraTexture();
    }
    
    // Character Avatar Update (Skeleton -> 3D Character)
    if (avatarState.enabled) {
        updateAvatarPose(deltaTime);
    }
    
    // Stream Capture wird vom Background Loop gehandelt (setInterval)
    // damit es auch läuft wenn die App nicht im Fokus ist
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
    
    // Callback für refreshVisuals setzen (inkl. Video-Textur und Camera-Textur Re-Apply)
    const combinedRefresh = () => {
        refreshVisuals();
        onModelChanged();
        onCameraModelChanged();
    };
    setRefreshVisualsCallback(combinedRefresh);
    setModelRefreshCallback(combinedRefresh);
    
    // MIDI Note Callback
    setOnMidiNoteCallback((notes) => {
        const analysis = analyzeIntervals(notes);
        updateUI(notes, analysis);
        applyColors(analysis);
    });
    
    // Module initialisieren
    initParticleSystem();
    initGridFloor();
    await initializeModels();
    
    // UI Handlers initialisieren
    initEffectUI();
    initGridFloorUI();
    initBeatUI();
    initPercussionUI();
    initInstrumentUI();
    initMidiUI();
    initSpeechUI();
    initColorUI();
    initCameraUI();
    initStream();
    initAiUI();
    initSongRecognition();
    initIntervalModal();
    initVideoUI();
    initCameraInputUI();
    initDMXUI();
    initAvatarUI();
    
    // Lyrics -> AI Prompt Integration
    onLyricsLine((line) => {
        if (songState.useLyricsAsPrompt && line) {
            console.log('🎤 Lyrics -> AI:', line);
            updateAiFromSpeech(line);
        }
    });
    
    // DevTools Button (nur in Electron)
    const devToolsBtn = document.getElementById('devToolsToggle');
    if (devToolsBtn && window.electronAPI?.isElectron) {
        devToolsBtn.style.display = 'flex';
        devToolsBtn.addEventListener('click', () => {
            window.electronAPI.toggleDevTools();
        });
    }
    
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
        // Initial: Modell ist sichtbar = active = grün
        modelVisibilityBtn.classList.add('active');
        modelState.modelVisible = true;
        
        modelVisibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = modelVisibilityBtn.classList.toggle('active');
            // active = sichtbar = grün, nicht active = versteckt = rot
            setModelVisibility(isVisible);
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
    
    // Background Stream Loop starten (läuft auch wenn App nicht im Fokus!)
    startBackgroundStreamLoop();
    
    console.log('Synästhesie bereit!');
}

// ============================================
// GRID FLOOR UI INITIALIZATION
// ============================================

function initGridFloorUI() {
    // Visibility Toggle
    const gridVisibilityBtn = document.getElementById('gridVisibilityBtn');
    if (gridVisibilityBtn) {
        gridVisibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = gridVisibilityBtn.classList.toggle('active');
            setGridEnabled(isActive);
        });
    }
    
    // Grid Size X
    const gridSizeX = document.getElementById('gridSizeX');
    if (gridSizeX) {
        gridSizeX.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const gridSizeY = document.getElementById('gridSizeY');
            setGridSize(val, gridSizeY ? parseInt(gridSizeY.value) : 40);
            const display = document.getElementById('gridSizeXValue');
            if (display) display.textContent = val;
        });
    }
    
    // Grid Size Y
    const gridSizeY = document.getElementById('gridSizeY');
    if (gridSizeY) {
        gridSizeY.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const gridSizeX = document.getElementById('gridSizeX');
            setGridSize(gridSizeX ? parseInt(gridSizeX.value) : 40, val);
            const display = document.getElementById('gridSizeYValue');
            if (display) display.textContent = val;
        });
    }
    
    // Spacing
    const gridSpacing = document.getElementById('gridSpacing');
    if (gridSpacing) {
        gridSpacing.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setGridSpacing(val);
            const display = document.getElementById('gridSpacingValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Position Y (Height)
    const gridPositionY = document.getElementById('gridPositionY');
    if (gridPositionY) {
        gridPositionY.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setGridPosition(val);
            const display = document.getElementById('gridPositionYValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Line Width
    const gridLineWidth = document.getElementById('gridLineWidth');
    if (gridLineWidth) {
        gridLineWidth.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setLineWidth(val);
            const display = document.getElementById('gridLineWidthValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Glow Enabled
    const gridGlowEnabled = document.getElementById('gridGlowEnabled');
    if (gridGlowEnabled) {
        gridGlowEnabled.addEventListener('change', (e) => {
            setGlowEnabled(e.target.checked);
        });
    }
    
    // Glow Intensity
    const gridGlowIntensity = document.getElementById('gridGlowIntensity');
    if (gridGlowIntensity) {
        gridGlowIntensity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setGlowIntensity(val);
            const display = document.getElementById('gridGlowIntensityValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Audio Enabled
    const gridAudioEnabled = document.getElementById('gridAudioEnabled');
    if (gridAudioEnabled) {
        gridAudioEnabled.addEventListener('change', (e) => {
            setAudioEnabled(e.target.checked);
        });
    }
    
    // Wave Height
    const gridWaveHeight = document.getElementById('gridWaveHeight');
    if (gridWaveHeight) {
        gridWaveHeight.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setWaveHeight(val);
            const display = document.getElementById('gridWaveHeightValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Wave Speed
    const gridWaveSpeed = document.getElementById('gridWaveSpeed');
    if (gridWaveSpeed) {
        gridWaveSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setWaveSpeed(val);
            const display = document.getElementById('gridWaveSpeedValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Audio Intensity
    const gridAudioIntensity = document.getElementById('gridAudioIntensity');
    if (gridAudioIntensity) {
        gridAudioIntensity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setAudioIntensity(val);
            const display = document.getElementById('gridAudioIntensityValue');
            if (display) display.textContent = val.toFixed(1);
        });
    }
    
    // Use Schema Color
    const gridUseSchemaColor = document.getElementById('gridUseSchemaColor');
    if (gridUseSchemaColor) {
        gridUseSchemaColor.addEventListener('change', (e) => {
            setUseSchemaColor(e.target.checked);
        });
    }
    
    // Custom Color
    const gridColor = document.getElementById('gridColor');
    if (gridColor) {
        gridColor.addEventListener('input', (e) => {
            setGridColor(e.target.value);
        });
    }
    
    console.log('Grid Floor UI initialisiert');
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
    instrumentState,
    aiState,
    videoState,
    cameraInputState,
    gridState,
    dmxState,
    activeEffects,
    scene,
    camera,
    renderer,
    // For instrument detection
    get analyser() { return getAnalyser(); },
    get audioContext() { return audioContext; }
};
