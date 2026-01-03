// Instrument Detection using YAMNet (TensorFlow.js)
// Detects dominant instrument/sound class from live audio

// CORRECTED YAMNet class indices (from yamnet_class_map.csv)
// https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
const INSTRUMENT_CLASSES = {
    // Music general
    137: 'Musik',
    138: 'Musikinstrument',
    
    // Piano & Keys (WICHTIG: korrekte Indices!)
    153: 'Klavier',
    154: 'Keyboard',
    155: 'Klavier', // Piano alternative
    430: 'Klavier',
    431: 'E-Piano',
    432: 'Keyboard',
    433: 'Orgel',
    434: 'Orgel',
    435: 'Hammond-Orgel',
    436: 'Synthesizer',
    
    // Strings - Plucked
    420: 'Zupfinstrument',
    421: 'Gitarre',
    422: 'Akustik-Gitarre',
    423: 'E-Gitarre',
    424: 'Bass-Gitarre',
    425: 'E-Gitarre (clean)',
    426: 'E-Gitarre (distorted)',
    427: 'Slide-Gitarre',
    428: 'Slap-Bass',
    
    // Strings - Bowed
    440: 'Streichinstrument',
    441: 'Violine/Geige',
    442: 'Violine',
    443: 'Pizzicato',
    444: 'Cello',
    445: 'Kontrabass',
    
    // Drums & Percussion
    339: 'Schlagzeug',
    340: 'Snare',
    341: 'Bass Drum',
    342: 'Kick Drum',
    343: 'Tom-Tom',
    344: 'Hi-Hat',
    345: 'Becken',
    346: 'Crash',
    347: 'Ride',
    348: 'Rimshot',
    349: 'Drum Roll',
    350: 'Percussion',
    
    // Brass
    450: 'Blechblasinstrument',
    451: 'Horn',
    452: 'Trompete',
    453: 'Posaune',
    454: 'Tuba',
    455: 'Saxophon',
    
    // Woodwind
    460: 'Holzblasinstrument',
    461: 'Flöte',
    462: 'Klarinette',
    463: 'Oboe',
    464: 'Fagott',
    465: 'Mundharmonika',
    
    // Voice
    0: 'Sprache',
    1: 'Sprache (Männer)',
    2: 'Sprache (Frauen)',
    132: 'Gesang',
    133: 'Gesang',
    134: 'Chor',
    135: 'Männergesang',
    136: 'Frauengesang',
    
    // Other
    470: 'Harfe',
    471: 'Glockenspiel',
    472: 'Vibraphon',
    473: 'Marimba',
    474: 'Xylophon',
    475: 'Steeldrum',
    476: 'Akkordeon'
};

// English names for AI prompts
const INSTRUMENT_EN = {
    'Gitarre (akustisch)': 'acoustic guitar',
    'E-Gitarre': 'electric guitar',
    'Bass-Gitarre': 'bass guitar',
    'Gitarre (clean)': 'clean guitar',
    'Gitarre (distorted)': 'distorted guitar',
    'Violine': 'violin',
    'Viola': 'viola',
    'Cello': 'cello',
    'Kontrabass': 'double bass',
    'Streichinstrument': 'string instrument',
    'Klavier': 'piano',
    'E-Piano': 'electric piano',
    'Keyboard': 'keyboard synthesizer',
    'Orgel': 'organ',
    'Synthesizer': 'synthesizer',
    'Drums': 'drums',
    'Snare': 'snare drum',
    'Bass Drum': 'bass drum kick',
    'Hi-Hat': 'hi-hat cymbal',
    'Cymbal': 'cymbal',
    'Schlagzeug': 'drum kit',
    'Percussion': 'percussion',
    'Tambourine': 'tambourine',
    'Maracas': 'maracas',
    'Trompete': 'trumpet',
    'Posaune': 'trombone',
    'Tuba': 'tuba',
    'Saxophon': 'saxophone',
    'Klarinette': 'clarinet',
    'Flöte': 'flute',
    'Oboe': 'oboe',
    'Fagott': 'bassoon',
    'Mundharmonika': 'harmonica',
    'Sprache': 'speech',
    'Gesang': 'singing voice',
    'Chor': 'choir',
    'Männerstimme': 'male voice',
    'Frauenstimme': 'female voice',
    'Glocken': 'bells',
    'Xylophon': 'xylophone',
    'Marimba': 'marimba',
    'Harfe': 'harp',
    'Akkordeon': 'accordion',
    'Musik': 'music',
    'Musikinstrument': 'musical instrument'
};

// State
export const instrumentState = {
    enabled: false,
    model: null,
    useYamnet: false,  // true if YAMNet loaded, false for frequency-based
    loading: false,
    lastDetection: null,
    dominantInstrument: null,
    dominantInstrumentEN: null,
    confidence: 0,
    addToPrompt: false,
    detectionInterval: null,
    audioContext: null,
    analyser: null,
    scriptProcessor: null,
    sampleRate: 16000,
    bufferSize: 15600, // ~1 second at 16kHz (YAMNet expects this)
    audioBuffer: new Float32Array(15600),
    bufferIndex: 0
};

// Load YAMNet model
async function loadModel() {
    if (instrumentState.model || instrumentState.loading) return;
    
    instrumentState.loading = true;
    updateStatus('Lade YAMNet Modell...');
    
    try {
        // Check if TensorFlow.js is loaded
        if (typeof tf === 'undefined') {
            // Load TensorFlow.js dynamically
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
        }
        
        // Try to load local model first
        const localModelPath = './models/yamnet/model.json';
        
        let model = null;
        let useFrequencyBased = false;
        
        // Try local model
        try {
            console.log('Trying to load local YAMNet model...');
            updateStatus('Lade lokales Modell...');
            model = await tf.loadGraphModel(localModelPath);
            console.log('✅ Loaded local YAMNet model');
        } catch (localErr) {
            console.warn('Local model not found:', localErr.message);
            
            // Try remote sources as fallback
            const remoteUrls = [
                'https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/model.json',
                'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'
            ];
            
            for (const url of remoteUrls) {
                try {
                    console.log('Trying remote:', url);
                    updateStatus('Lade von ' + new URL(url).hostname + '...');
                    
                    if (url.includes('tfhub.dev')) {
                        model = await tf.loadGraphModel(url, { fromTFHub: true });
                    } else {
                        model = await tf.loadGraphModel(url);
                    }
                    console.log('✅ Loaded YAMNet from:', url);
                    break;
                } catch (remoteErr) {
                    console.warn('Failed:', remoteErr.message);
                }
            }
        }
        
        if (model) {
            instrumentState.model = model;
            instrumentState.useYamnet = true;
            
            // Warm up the model
            console.log('Warming up YAMNet...');
            const dummyInput = tf.zeros([1, 15600]);
            await instrumentState.model.predict(dummyInput);
            dummyInput.dispose();
            
            instrumentState.loading = false;
            updateStatus('✅ YAMNet bereit');
            console.log('✅ YAMNet model ready');
        } else {
            // Fallback to frequency-based detection
            console.log('Falling back to frequency-based detection');
            instrumentState.model = 'frequency-based';
            instrumentState.useYamnet = false;
            instrumentState.loading = false;
            updateStatus('✅ Audio-Analyse bereit (Frequenz)');
        }
        
        return true;
    } catch (err) {
        console.error('Failed to initialize audio classification:', err);
        instrumentState.loading = false;
        
        // Ultimate fallback
        instrumentState.model = 'frequency-based';
        instrumentState.useYamnet = false;
        updateStatus('⚠️ Nur Frequenz-Analyse');
        return true;
    }
}

// Helper to load external script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Load YAMNet class map
let yamnetClasses = null;
async function loadClassMap() {
    if (yamnetClasses) return yamnetClasses;
    
    try {
        const response = await fetch('https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv');
        const text = await response.text();
        const lines = text.trim().split('\n').slice(1); // Skip header
        
        yamnetClasses = {};
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 3) {
                const index = parseInt(parts[0]);
                const name = parts[2].replace(/"/g, '').trim();
                yamnetClasses[index] = name;
            }
        });
        
        console.log('Loaded', Object.keys(yamnetClasses).length, 'YAMNet classes');
        return yamnetClasses;
    } catch (err) {
        console.error('Failed to load class map:', err);
        return null;
    }
}

// Start detection
export async function startInstrumentDetection(audioContext, sourceNode) {
    if (instrumentState.enabled) return;
    
    // Load model if needed
    if (!instrumentState.model) {
        const loaded = await loadModel();
        if (!loaded) return;
    }
    
    // Load class map
    await loadClassMap();
    
    instrumentState.audioContext = audioContext;
    
    // Create a new audio context for resampling to 16kHz
    const offlineCtx = new OfflineAudioContext(1, instrumentState.bufferSize, instrumentState.sampleRate);
    
    // Use ScriptProcessor to capture audio (deprecated but works everywhere)
    // We'll accumulate samples and run detection periodically
    instrumentState.enabled = true;
    
    // Run detection every 1.5 seconds
    instrumentState.detectionInterval = setInterval(() => {
        if (instrumentState.enabled) {
            detectFromAnalyser();
        }
    }, 1500);
    
    updateStatus('🎵 Erkennung aktiv');
    console.log('Instrument detection started');
}

// Stop detection
export function stopInstrumentDetection() {
    instrumentState.enabled = false;
    
    if (instrumentState.detectionInterval) {
        clearInterval(instrumentState.detectionInterval);
        instrumentState.detectionInterval = null;
    }
    
    instrumentState.dominantInstrument = null;
    instrumentState.dominantInstrumentEN = null;
    instrumentState.confidence = 0;
    
    updateStatus('⏹ Gestoppt');
    updateDisplay(null);
}

// Detect from analyser node - uses YAMNet if available, otherwise frequency-based
async function detectFromAnalyser() {
    if (!instrumentState.model || !instrumentState.enabled) return;
    
    try {
        // Get analyser from main app
        const analyser = window.Synaesthesia?.analyser;
        if (!analyser) {
            if (!window._instrumentNoAnalyserWarned) {
                console.warn('No analyser available for instrument detection - start audio first');
                window._instrumentNoAnalyserWarned = true;
            }
            return;
        }
        window._instrumentNoAnalyserWarned = false;
        
        // Get audio data
        const bufferLength = analyser.frequencyBinCount;
        const freqData = new Uint8Array(bufferLength);
        const timeData = new Float32Array(analyser.fftSize);
        analyser.getByteFrequencyData(freqData);
        analyser.getFloatTimeDomainData(timeData);
        
        // Check if there's actual audio
        let maxVal = 0;
        for (let i = 0; i < timeData.length; i++) {
            maxVal = Math.max(maxVal, Math.abs(timeData[i]));
        }
        if (maxVal < 0.01) return;
        
        // Use YAMNet if available
        if (instrumentState.useYamnet && instrumentState.model !== 'frequency-based') {
            await detectWithYamnet(analyser, timeData);
        } else {
            // Fallback to frequency-based
            detectWithFrequency(analyser, freqData, timeData);
        }
        
    } catch (err) {
        console.error('Instrument detection error:', err);
    }
}

// YAMNet-based detection
async function detectWithYamnet(analyser, timeData) {
    try {
        // Resample to 16kHz and correct length for YAMNet
        const resampled = resampleAudio(timeData, analyser.context.sampleRate, 16000, 15600);
        
        // Run inference
        const inputTensor = tf.tensor2d(resampled, [1, 15600]);
        const predictions = await instrumentState.model.predict(inputTensor);
        
        // Get scores
        const scores = await predictions.data();
        inputTensor.dispose();
        predictions.dispose();
        
        // Find top predictions
        const topK = getTopK(scores, 5);
        
        // Filter for instrument-related classes
        const instrumentPredictions = topK.filter(p => {
            const name = yamnetClasses?.[p.index] || INSTRUMENT_CLASSES[p.index] || '';
            return isInstrumentClass(name, p.index);
        });
        
        if (instrumentPredictions.length > 0) {
            const top = instrumentPredictions[0];
            const className = yamnetClasses?.[top.index] || INSTRUMENT_CLASSES[top.index] || `Class ${top.index}`;
            const germanName = getGermanName(className);
            const englishName = getEnglishName(className);
            
            instrumentState.dominantInstrument = germanName;
            instrumentState.dominantInstrumentEN = englishName;
            instrumentState.confidence = top.score;
            instrumentState.lastDetection = {
                instrument: germanName,
                instrumentEN: englishName,
                confidence: top.score,
                allPredictions: instrumentPredictions.slice(0, 3).map(p => ({
                    name: getGermanName(yamnetClasses?.[p.index] || `Class ${p.index}`),
                    score: p.score
                }))
            };
            
            updateDisplay(instrumentState.lastDetection);
        }
    } catch (err) {
        console.error('YAMNet detection error:', err);
        // Fall back to frequency-based for this cycle
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        detectWithFrequency(analyser, freqData, new Float32Array(analyser.fftSize));
    }
}

// Frequency-based detection
function detectWithFrequency(analyser, freqData, timeData) {
    const bufferLength = analyser.frequencyBinCount;
    const sampleRate = analyser.context.sampleRate;
    const nyquist = sampleRate / 2;
    const binSize = nyquist / bufferLength;
    
    // Calculate energy in different frequency bands
    const bands = {
        subBass: { min: 20, max: 60, energy: 0 },
        bass: { min: 60, max: 250, energy: 0 },
        lowMid: { min: 250, max: 500, energy: 0 },
        mid: { min: 500, max: 2000, energy: 0 },
        highMid: { min: 2000, max: 4000, energy: 0 },
        presence: { min: 4000, max: 6000, energy: 0 },
        brilliance: { min: 6000, max: 20000, energy: 0 }
    };
    
    let totalEnergy = 0;
    for (let i = 0; i < bufferLength; i++) {
        const freq = i * binSize;
        const energy = freqData[i] / 255;
        totalEnergy += energy;
        
        for (const band of Object.values(bands)) {
            if (freq >= band.min && freq < band.max) {
                band.energy += energy;
            }
        }
    }
    
    // Normalize bands
    for (const band of Object.values(bands)) {
        band.energy = totalEnergy > 0 ? band.energy / totalEnergy : 0;
    }
    
    // Detect transients
    const hasTransient = detectTransient(timeData);
    
    // Classify
    const classification = classifyInstrument(bands, hasTransient, freqData, binSize);
    
    if (classification) {
        instrumentState.dominantInstrument = classification.german;
        instrumentState.dominantInstrumentEN = classification.english;
        instrumentState.confidence = classification.confidence;
        instrumentState.lastDetection = {
            instrument: classification.german,
            instrumentEN: classification.english,
            confidence: classification.confidence,
            allPredictions: classification.alternatives || []
        };
        
        updateDisplay(instrumentState.lastDetection);
    }
}

// Detect transients (sharp attacks) in audio
function detectTransient(timeData) {
    let maxDiff = 0;
    for (let i = 1; i < timeData.length; i++) {
        const diff = Math.abs(timeData[i] - timeData[i-1]);
        maxDiff = Math.max(maxDiff, diff);
    }
    return maxDiff > 0.3;
}

// Classify instrument based on frequency profile
// VEREINFACHT: Nur Hauptkategorien für zuverlässige Erkennung
function classifyInstrument(bands, hasTransient, freqData, binSize) {
    const results = [];
    
    // Calculate spectral features
    const spectralCentroid = calculateSpectralCentroid(freqData, binSize);
    const spectralFlatness = calculateSpectralFlatness(freqData);
    const harmonicRatio = detectHarmonics(freqData, binSize);
    
    // Debug logging (einmal pro 10 Aufrufe)
    if (!window._instrumentDebugCount) window._instrumentDebugCount = 0;
    if (window._instrumentDebugCount++ % 10 === 0) {
        console.log('Instrument Analysis:', {
            centroid: Math.round(spectralCentroid),
            flatness: spectralFlatness.toFixed(2),
            harmonics: harmonicRatio.toFixed(2),
            transient: hasTransient,
            bands: {
                sub: bands.subBass.energy.toFixed(2),
                bass: bands.bass.energy.toFixed(2),
                lowMid: bands.lowMid.energy.toFixed(2),
                mid: bands.mid.energy.toFixed(2),
                highMid: bands.highMid.energy.toFixed(2),
                presence: bands.presence.energy.toFixed(2),
                brilliance: bands.brilliance.energy.toFixed(2)
            }
        });
    }
    
    // === 1. PERCUSSION / DRUMS ===
    // Starke Transienten + entweder Bass-lastig oder Brillanz-lastig
    if (hasTransient) {
        // Kick/Bass Drum: starker Sub-Bass mit Transient
        if (bands.subBass.energy > 0.25 || (bands.bass.energy > 0.3 && bands.mid.energy < 0.2)) {
            results.push({ german: 'Percussion (Bass)', english: 'percussion drums', confidence: 0.8 });
        }
        // Hi-Hat/Becken: hohe Frequenzen mit Transient
        else if (bands.brilliance.energy > 0.2 && bands.presence.energy > 0.15 && bands.bass.energy < 0.15) {
            results.push({ german: 'Percussion (Hi)', english: 'percussion cymbals', confidence: 0.75 });
        }
        // Snare/Tom: mittlere Frequenzen mit Transient und Rauschen
        else if (bands.mid.energy > 0.15 && spectralFlatness > 0.25) {
            results.push({ german: 'Percussion', english: 'percussion drums', confidence: 0.7 });
        }
    }
    
    // === 2. GESANG / VOCALS ===
    // Menschliche Stimme: 300-3500Hz Fokus, harmonisch, kein starker Bass
    if (bands.mid.energy > 0.18 && 
        bands.highMid.energy > 0.1 &&
        bands.bass.energy < 0.2 && 
        bands.subBass.energy < 0.1 &&
        spectralCentroid > 400 && spectralCentroid < 3500 &&
        harmonicRatio > 0.25 &&
        !hasTransient) {
        results.push({ german: 'Gesang', english: 'vocals singing', confidence: 0.65 });
    }
    
    // === 3. STREICHER / STRINGS ===
    // Violine, Cello, etc: sustained, harmonisch, kein Transient, mittlere Frequenzen
    if (harmonicRatio > 0.35 && 
        !hasTransient &&
        spectralFlatness < 0.35 &&
        bands.mid.energy > 0.15 &&
        (bands.lowMid.energy > 0.12 || bands.highMid.energy > 0.12)) {
        
        // Hohe Streicher (Violine) vs Tiefe (Cello)
        if (spectralCentroid > 1200) {
            results.push({ german: 'Streicher (hoch)', english: 'strings violin', confidence: 0.6 });
        } else if (spectralCentroid < 600 && bands.bass.energy > 0.15) {
            results.push({ german: 'Streicher (tief)', english: 'strings cello', confidence: 0.6 });
        } else {
            results.push({ german: 'Streicher', english: 'strings', confidence: 0.55 });
        }
    }
    
    // === 4. BLÄSER / WINDS ===
    // Starke Harmonische, höherer Centroid, kein Bass
    if (harmonicRatio > 0.3 &&
        spectralCentroid > 800 &&
        bands.highMid.energy > 0.12 &&
        bands.presence.energy > 0.1 &&
        bands.bass.energy < 0.2 &&
        bands.subBass.energy < 0.1 &&
        spectralFlatness < 0.4) {
        
        // Blechbläser vs Holzbläser
        if (spectralCentroid > 1500 && bands.presence.energy > 0.15) {
            results.push({ german: 'Bläser (Blech)', english: 'brass winds', confidence: 0.55 });
        } else {
            results.push({ german: 'Bläser', english: 'winds', confidence: 0.5 });
        }
    }
    
    // === 5. KLAVIER / PIANO ===
    // Breites Spektrum, Transienten, starke Harmonische
    if (hasTransient && 
        harmonicRatio > 0.3 &&
        bands.mid.energy > 0.12 && 
        bands.lowMid.energy > 0.08 &&
        bands.highMid.energy > 0.08 &&
        spectralCentroid > 600 && spectralCentroid < 4000 &&
        spectralFlatness < 0.4) {
        results.push({ german: 'Klavier', english: 'piano', confidence: 0.6 });
    }
    
    // === 6. GITARRE / GUITAR ===
    // Zupf-Transienten, mittlere Frequenzen, moderate Harmonische
    if (hasTransient &&
        bands.lowMid.energy > 0.15 && 
        bands.mid.energy > 0.12 &&
        harmonicRatio > 0.2 && harmonicRatio < 0.5 &&
        spectralCentroid > 300 && spectralCentroid < 2500) {
        results.push({ german: 'Gitarre', english: 'guitar', confidence: 0.55 });
    }
    
    // === 7. BASS ===
    // Tiefe Frequenzen dominant, wenig Höhen
    if ((bands.subBass.energy > 0.2 || bands.bass.energy > 0.3) &&
        bands.mid.energy < 0.2 &&
        bands.highMid.energy < 0.1 &&
        !hasTransient) {
        results.push({ german: 'Bass', english: 'bass', confidence: 0.6 });
    }
    
    // === 8. SYNTHESIZER / ELEKTRONIK ===
    // Flaches Spektrum (viele Frequenzen gleichmäßig)
    if (spectralFlatness > 0.45 && bands.mid.energy > 0.1) {
        results.push({ german: 'Synthesizer', english: 'synthesizer electronic', confidence: 0.45 });
    }
    
    // Default: allgemeine Musik
    if (results.length === 0) {
        // Versuche zumindest eine grobe Einordnung
        if (bands.bass.energy > 0.25) {
            results.push({ german: 'Tiefe Töne', english: 'low frequency', confidence: 0.3 });
        } else if (bands.brilliance.energy > 0.2) {
            results.push({ german: 'Hohe Töne', english: 'high frequency', confidence: 0.3 });
        } else {
            results.push({ german: 'Musik', english: 'music', confidence: 0.25 });
        }
    }
    
    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    
    const top = results[0];
    top.alternatives = results.slice(1, 4).map(r => ({
        name: r.german,
        score: r.confidence
    }));
    
    return top;
}

// Calculate spectral centroid ("brightness")
function calculateSpectralCentroid(freqData, binSize) {
    let weightedSum = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < freqData.length; i++) {
        const freq = i * binSize;
        const energy = freqData[i] / 255;
        weightedSum += freq * energy;
        totalEnergy += energy;
    }
    
    return totalEnergy > 0 ? weightedSum / totalEnergy : 0;
}

// Calculate spectral flatness (noise vs tonal)
function calculateSpectralFlatness(freqData) {
    let logSum = 0;
    let sum = 0;
    let count = 0;
    
    for (let i = 1; i < freqData.length; i++) {
        const val = Math.max(freqData[i] / 255, 0.0001);
        logSum += Math.log(val);
        sum += val;
        count++;
    }
    
    if (count === 0 || sum === 0) return 0;
    
    const geometricMean = Math.exp(logSum / count);
    const arithmeticMean = sum / count;
    
    return geometricMean / arithmeticMean;
}

// Detect harmonic content
function detectHarmonics(freqData, binSize) {
    // Find fundamental frequency (strongest low-mid peak)
    let maxEnergy = 0;
    let fundamentalBin = 0;
    
    const searchStart = Math.floor(80 / binSize);  // Start at ~80Hz
    const searchEnd = Math.floor(1000 / binSize);  // End at ~1000Hz
    
    for (let i = searchStart; i < searchEnd && i < freqData.length; i++) {
        if (freqData[i] > maxEnergy) {
            maxEnergy = freqData[i];
            fundamentalBin = i;
        }
    }
    
    if (fundamentalBin === 0 || maxEnergy < 20) return 0;
    
    // Check for harmonics (2x, 3x, 4x fundamental)
    let harmonicEnergy = 0;
    let totalChecked = 0;
    
    for (let harmonic = 2; harmonic <= 6; harmonic++) {
        const harmonicBin = fundamentalBin * harmonic;
        if (harmonicBin >= freqData.length) break;
        
        // Check +/- 2 bins around expected harmonic
        let localMax = 0;
        for (let offset = -2; offset <= 2; offset++) {
            const bin = harmonicBin + offset;
            if (bin >= 0 && bin < freqData.length) {
                localMax = Math.max(localMax, freqData[bin]);
            }
        }
        
        harmonicEnergy += localMax / 255;
        totalChecked++;
    }
    
    return totalChecked > 0 ? harmonicEnergy / totalChecked : 0;
}

// Check if class is instrument-related
function isInstrumentClass(name, index) {
    const lowerName = name.toLowerCase();
    
    // Explicit instrument keywords
    const instrumentKeywords = [
        'guitar', 'piano', 'violin', 'cello', 'bass', 'drum', 'synth',
        'organ', 'trumpet', 'saxophone', 'flute', 'clarinet', 'harp',
        'percussion', 'cymbal', 'hi-hat', 'snare', 'kick', 'tom',
        'keyboard', 'accordion', 'harmonica', 'banjo', 'ukulele',
        'mandolin', 'viola', 'oboe', 'bassoon', 'trombone', 'tuba',
        'french horn', 'music', 'musical', 'instrument', 'singing',
        'choir', 'voice', 'vocal', 'bell', 'xylophone', 'marimba',
        'vibraphone', 'glockenspiel', 'timpani', 'bongo', 'conga',
        'tambourine', 'triangle', 'maracas', 'shaker'
    ];
    
    for (const keyword of instrumentKeywords) {
        if (lowerName.includes(keyword)) return true;
    }
    
    // Check by index in our predefined list
    if (INSTRUMENT_CLASSES[index]) return true;
    
    return false;
}

// Get German name
function getGermanName(englishName) {
    const translations = {
        'acoustic guitar': 'Akustik-Gitarre',
        'electric guitar': 'E-Gitarre',
        'bass guitar': 'Bass',
        'guitar': 'Gitarre',
        'piano': 'Klavier',
        'electric piano': 'E-Piano',
        'keyboard': 'Keyboard',
        'organ': 'Orgel',
        'synthesizer': 'Synthesizer',
        'violin': 'Violine',
        'fiddle': 'Geige',
        'viola': 'Viola',
        'cello': 'Cello',
        'double bass': 'Kontrabass',
        'drums': 'Schlagzeug',
        'drum': 'Trommel',
        'snare drum': 'Snare',
        'bass drum': 'Bassdrum',
        'hi-hat': 'Hi-Hat',
        'cymbal': 'Becken',
        'percussion': 'Percussion',
        'trumpet': 'Trompete',
        'trombone': 'Posaune',
        'tuba': 'Tuba',
        'french horn': 'Horn',
        'saxophone': 'Saxophon',
        'clarinet': 'Klarinette',
        'flute': 'Flöte',
        'oboe': 'Oboe',
        'bassoon': 'Fagott',
        'harmonica': 'Mundharmonika',
        'accordion': 'Akkordeon',
        'harp': 'Harfe',
        'banjo': 'Banjo',
        'ukulele': 'Ukulele',
        'mandolin': 'Mandoline',
        'singing': 'Gesang',
        'voice': 'Stimme',
        'male singing': 'Männergesang',
        'female singing': 'Frauengesang',
        'choir': 'Chor',
        'speech': 'Sprache',
        'music': 'Musik',
        'musical instrument': 'Instrument',
        'bell': 'Glocke',
        'xylophone': 'Xylophon',
        'marimba': 'Marimba',
        'vibraphone': 'Vibraphon',
        'plucked string instrument': 'Zupfinstrument',
        'bowed string instrument': 'Streichinstrument',
        'brass instrument': 'Blechblasinstrument',
        'wind instrument': 'Blasinstrument',
        'woodwind instrument': 'Holzblasinstrument'
    };
    
    const lower = englishName.toLowerCase();
    for (const [en, de] of Object.entries(translations)) {
        if (lower.includes(en)) return de;
    }
    
    return englishName;
}

// Get English name for AI prompt
function getEnglishName(className) {
    const lower = className.toLowerCase();
    
    // Already in our translation map
    if (INSTRUMENT_EN[className]) {
        return INSTRUMENT_EN[className];
    }
    
    // Clean up the class name for prompt use
    return lower
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Resample audio
function resampleAudio(input, fromRate, toRate, outputLength) {
    const ratio = fromRate / toRate;
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
        const t = srcIndex - srcIndexFloor;
        
        // Linear interpolation
        output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    
    return output;
}

// Get top K predictions
function getTopK(scores, k) {
    const indexed = Array.from(scores).map((score, index) => ({ score, index }));
    indexed.sort((a, b) => b.score - a.score);
    return indexed.slice(0, k);
}

// Update status display
function updateStatus(text) {
    const statusEl = document.getElementById('instrumentStatus');
    if (statusEl) statusEl.textContent = text;
}

// Update detection display
function updateDisplay(detection) {
    const displayEl = document.getElementById('instrumentDisplay');
    const instrumentEl = document.getElementById('detectedInstrument');
    const confidenceEl = document.getElementById('instrumentConfidence');
    
    if (!detection) {
        if (instrumentEl) instrumentEl.textContent = '-';
        if (confidenceEl) confidenceEl.textContent = '';
        return;
    }
    
    if (instrumentEl) {
        instrumentEl.textContent = detection.instrument;
        instrumentEl.title = `EN: ${detection.instrumentEN}`;
    }
    
    if (confidenceEl) {
        const percent = Math.round(detection.confidence * 100);
        confidenceEl.textContent = `${percent}%`;
        confidenceEl.style.color = percent > 50 ? '#4f4' : percent > 30 ? '#ff0' : '#f44';
    }
    
    // Update secondary predictions
    const secondaryEl = document.getElementById('instrumentSecondary');
    if (secondaryEl && detection.allPredictions) {
        const others = detection.allPredictions.slice(1)
            .map(p => `${p.name} (${Math.round(p.score * 100)}%)`)
            .join(', ');
        secondaryEl.textContent = others || '-';
    }
}

// Get current instrument for AI prompt
export function getInstrumentForPrompt() {
    if (!instrumentState.addToPrompt || !instrumentState.dominantInstrumentEN) {
        return null;
    }
    
    // Only return if confidence is above threshold
    if (instrumentState.confidence < 0.25) {
        return null;
    }
    
    return instrumentState.dominantInstrumentEN;
}

// Initialize UI
export function initInstrumentUI() {
    // Enable/disable toggle
    const enableCheckbox = document.getElementById('instrumentEnabled');
    if (enableCheckbox) {
        enableCheckbox.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Get audio context from main app
                const audioCtx = window.Synaesthesia?.audioContext || 
                    (window.audioContext);
                if (audioCtx) {
                    await startInstrumentDetection(audioCtx, null);
                } else {
                    updateStatus('⚠️ Erst Audio starten');
                    e.target.checked = false;
                }
            } else {
                stopInstrumentDetection();
            }
        });
    }
    
    // Add to prompt toggle
    const promptToggle = document.getElementById('instrumentToPrompt');
    if (promptToggle) {
        promptToggle.addEventListener('change', (e) => {
            instrumentState.addToPrompt = e.target.checked;
            console.log('Instrument → Prompt:', e.target.checked);
        });
    }
    
    console.log('🎸 Instrument Detection UI initialized');
}

// Export for debugging
export { INSTRUMENT_CLASSES, yamnetClasses };
