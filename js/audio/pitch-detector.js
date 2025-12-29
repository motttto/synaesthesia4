/**
 * PITCH DETECTOR
 * 
 * Polyphoner Pitch Detection mit mehreren Algorithmen:
 * - HPS (Harmonic Product Spectrum)
 * - YIN Algorithm
 * - Autocorrelation
 * - Cepstrum
 * - Simple Peaks
 */

// ============================================
// STATE
// ============================================

export const activeAlgorithms = new Set(['hps']); // Default: HPS
export let combineMode = 'union'; // union, intersection, voting, strongest
export let sensitivity = 0.5;

// ============================================
// PITCH DETECTOR CLASS
// ============================================

export class PitchDetector {
    constructor(audioContext, analyser) {
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.sampleRate = audioContext.sampleRate;
        this.fftSize = analyser.fftSize;
        
        this.frequencyData = new Float32Array(analyser.frequencyBinCount);
        this.timeData = new Float32Array(analyser.fftSize);
        
        // HPS Config
        this.hpsHarmonics = 5;
        
        // Temporal Smoothing
        this.noteHistory = [];
        this.historyLength = 3;
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    freqToMidi(freq) {
        return 69 + 12 * Math.log2(freq / 440);
    }
    
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    
    midiToNote(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return {
            name: noteNames[noteIndex],
            octave: octave,
            full: noteNames[noteIndex] + octave,
            midi: midi,
            isSharp: noteNames[noteIndex].includes('#')
        };
    }
    
    binToFreq(bin) {
        return bin * this.sampleRate / this.fftSize;
    }
    
    freqToBin(freq) {
        return freq * this.fftSize / this.sampleRate;
    }
    
    // ============================================
    // SIGNAL PROCESSING
    // ============================================
    
    computeHPS(magnitudes, minBin, maxBin) {
        const hpsLength = Math.floor(maxBin / this.hpsHarmonics);
        const hps = new Float32Array(hpsLength);
        
        for (let i = minBin; i < hpsLength; i++) {
            let product = magnitudes[i];
            for (let h = 2; h <= this.hpsHarmonics; h++) {
                const harmonicBin = i * h;
                if (harmonicBin < maxBin) {
                    product += magnitudes[harmonicBin];
                }
            }
            hps[i] = product / this.hpsHarmonics;
        }
        
        return hps;
    }
    
    applyWhitening(magnitudes, windowSize = 50) {
        const whitened = new Float32Array(magnitudes.length);
        
        for (let i = 0; i < magnitudes.length; i++) {
            const start = Math.max(0, i - windowSize);
            const end = Math.min(magnitudes.length, i + windowSize);
            
            let localMean = 0;
            for (let j = start; j < end; j++) {
                localMean += magnitudes[j];
            }
            localMean /= (end - start);
            
            whitened[i] = magnitudes[i] - localMean;
        }
        
        return whitened;
    }
    
    detectPeaksImproved(magnitudes, minBin, maxBin, threshold) {
        const peaks = [];
        
        for (let i = minBin + 2; i < maxBin - 2; i++) {
            const curr = magnitudes[i];
            
            if (curr > magnitudes[i-1] && curr > magnitudes[i+1] &&
                curr > magnitudes[i-2] && curr > magnitudes[i+2] &&
                curr > threshold) {
                
                const alpha = magnitudes[i-1];
                const beta = magnitudes[i];
                const gamma = magnitudes[i+1];
                
                const delta = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma);
                const interpolatedBin = i + delta;
                const interpolatedMag = beta - 0.25 * (alpha - gamma) * delta;
                
                const freq = this.binToFreq(interpolatedBin);
                const sharpness = beta - (alpha + gamma) / 2;
                const confidence = Math.min(1, sharpness / 20);
                
                peaks.push({
                    frequency: freq,
                    magnitude: interpolatedMag,
                    bin: interpolatedBin,
                    confidence: confidence
                });
            }
        }
        
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        return peaks;
    }
    
    extractFundamentals(peaks, maxNotes = 4) {
        if (peaks.length === 0) return [];
        
        const fundamentals = [];
        const usedPeaks = new Set();
        
        for (const peak of peaks) {
            if (usedPeaks.has(peak)) continue;
            if (fundamentals.length >= maxNotes) break;
            
            const freq = peak.frequency;
            const midi = Math.round(this.freqToMidi(freq));
            
            let isHarmonic = false;
            for (const fund of fundamentals) {
                const ratio = freq / fund.frequency;
                for (let h = 2; h <= 6; h++) {
                    if (Math.abs(ratio - h) < 0.08) {
                        isHarmonic = true;
                        fund.confidence = Math.min(1, fund.confidence + 0.1);
                        break;
                    }
                }
                if (isHarmonic) break;
            }
            
            if (!isHarmonic) {
                for (const otherPeak of peaks) {
                    if (otherPeak === peak || usedPeaks.has(otherPeak)) continue;
                    
                    const ratio = freq / otherPeak.frequency;
                    for (let h = 2; h <= 4; h++) {
                        if (Math.abs(ratio - h) < 0.06 && otherPeak.magnitude > peak.magnitude * 0.3) {
                            isHarmonic = true;
                            break;
                        }
                    }
                    if (isHarmonic) break;
                }
            }
            
            if (!isHarmonic && midi >= 36 && midi <= 96) {
                fundamentals.push({
                    ...this.midiToNote(midi),
                    frequency: freq,
                    magnitude: peak.magnitude,
                    confidence: peak.confidence
                });
                usedPeaks.add(peak);
            }
        }
        
        fundamentals.sort((a, b) => a.midi - b.midi);
        return fundamentals;
    }
    
    applyTemporalSmoothing(notes) {
        this.noteHistory.push(notes.map(n => n.midi));
        if (this.noteHistory.length > this.historyLength) {
            this.noteHistory.shift();
        }
        if (this.noteHistory.length < 2) return notes;
        return notes;
    }
    
    // ============================================
    // DETECTION ALGORITHMS
    // ============================================
    
    detectHPS(useWhitening) {
        const minFreq = 80, maxFreq = 2000;
        const minBin = Math.floor(this.freqToBin(minFreq));
        const maxBin = Math.ceil(this.freqToBin(maxFreq));
        
        const hps = this.computeHPS(this.frequencyData, minBin, maxBin);
        const processed = useWhitening ? this.applyWhitening(hps, 30) : hps;
        
        let sum = 0, count = 0;
        for (let i = minBin; i < Math.min(processed.length, maxBin); i++) {
            sum += processed[i]; count++;
        }
        const avgLevel = sum / count;
        const threshold = avgLevel + 5 + (1 - sensitivity) * 15;
        
        const peaks = this.detectPeaksImproved(processed, minBin, Math.min(processed.length, maxBin), threshold);
        return this.extractFundamentals(peaks, 4);
    }
    
    detectSimplePeaks() {
        const minFreq = 80, maxFreq = 2000;
        const minBin = Math.floor(this.freqToBin(minFreq));
        const maxBin = Math.ceil(this.freqToBin(maxFreq));
        
        const peaks = [];
        const threshold = -50 + (1 - sensitivity) * 30;
        
        for (let i = minBin + 1; i < maxBin - 1; i++) {
            const prev = this.frequencyData[i - 1];
            const curr = this.frequencyData[i];
            const next = this.frequencyData[i + 1];
            
            if (curr > prev && curr > next && curr > threshold) {
                const delta = 0.5 * (prev - next) / (prev - 2 * curr + next);
                const freq = this.binToFreq(i + delta);
                peaks.push({ frequency: freq, magnitude: curr, confidence: 0.5 });
            }
        }
        
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        return this.extractFundamentals(peaks.slice(0, 10), 4);
    }
    
    detectAutocorrelation() {
        const buffer = this.timeData;
        const SIZE = buffer.length;
        
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return [];
        
        const correlations = new Float32Array(SIZE);
        for (let lag = 0; lag < SIZE; lag++) {
            let sum = 0;
            for (let i = 0; i < SIZE - lag; i++) sum += buffer[i] * buffer[i + lag];
            correlations[lag] = sum;
        }
        
        let d = 0;
        while (correlations[d] > correlations[d + 1] && d < SIZE / 2) d++;
        
        let maxVal = -1, maxPos = -1;
        for (let i = d; i < SIZE / 2; i++) {
            if (correlations[i] > maxVal) { maxVal = correlations[i]; maxPos = i; }
        }
        
        if (maxPos === -1) return [];
        
        const freq = this.sampleRate / maxPos;
        if (freq < 80 || freq > 2000) return [];
        
        const midi = Math.round(this.freqToMidi(freq));
        return [{
            ...this.midiToNote(midi),
            frequency: freq,
            magnitude: maxVal,
            confidence: Math.min(1, maxVal / correlations[0])
        }];
    }
    
    detectCepstrum() {
        const minFreq = 80, maxFreq = 2000;
        const minQuefrency = Math.floor(this.sampleRate / maxFreq);
        const maxQuefrency = Math.floor(this.sampleRate / minFreq);
        
        let bestQuefrency = 0, bestScore = 0;
        
        for (let q = minQuefrency; q < maxQuefrency; q++) {
            let score = 0;
            const freqStep = this.sampleRate / q;
            
            for (let h = 1; h <= 5; h++) {
                const bin = Math.round(this.freqToBin(freqStep * h));
                if (bin < this.frequencyData.length) {
                    score += Math.pow(10, this.frequencyData[bin] / 20);
                }
            }
            
            if (score > bestScore) { bestScore = score; bestQuefrency = q; }
        }
        
        if (bestQuefrency === 0) return [];
        
        const freq = this.sampleRate / bestQuefrency;
        const midi = Math.round(this.freqToMidi(freq));
        
        return [{
            ...this.midiToNote(midi),
            frequency: freq,
            magnitude: bestScore,
            confidence: 0.7
        }];
    }
    
    detectYIN() {
        const buffer = this.timeData;
        const SIZE = buffer.length;
        const threshold = 0.1;
        
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return [];
        
        const yinBuffer = new Float32Array(SIZE / 2);
        
        for (let tau = 1; tau < SIZE / 2; tau++) {
            let sum = 0;
            for (let i = 0; i < SIZE / 2; i++) {
                const delta = buffer[i] - buffer[i + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }
        
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < SIZE / 2; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }
        
        let tauEstimate = -1;
        for (let tau = 2; tau < SIZE / 2; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < SIZE / 2 && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
                tauEstimate = tau;
                break;
            }
        }
        
        if (tauEstimate === -1) return [];
        
        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < SIZE / 2 - 1) {
            const s0 = yinBuffer[tauEstimate - 1];
            const s1 = yinBuffer[tauEstimate];
            const s2 = yinBuffer[tauEstimate + 1];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }
        
        const freq = this.sampleRate / betterTau;
        if (freq < 80 || freq > 2000) return [];
        
        const midi = Math.round(this.freqToMidi(freq));
        const confidence = 1 - yinBuffer[tauEstimate];
        
        return [{
            ...this.midiToNote(midi),
            frequency: freq,
            magnitude: 0,
            confidence: Math.max(0, Math.min(1, confidence))
        }];
    }
    
    // ============================================
    // MAIN DETECT METHOD
    // ============================================
    
    detect() {
        this.analyser.getFloatFrequencyData(this.frequencyData);
        this.analyser.getFloatTimeDomainData(this.timeData);
        
        if (activeAlgorithms.size === 0) return [];
        
        const allResults = [];
        
        for (const algo of activeAlgorithms) {
            let notes = [];
            switch(algo) {
                case 'hps': notes = this.detectHPS(false); break;
                case 'hpsWhitening': notes = this.detectHPS(true); break;
                case 'peaks': notes = this.detectSimplePeaks(); break;
                case 'autocorr': notes = this.detectAutocorrelation(); break;
                case 'cepstrum': notes = this.detectCepstrum(); break;
                case 'yin': notes = this.detectYIN(); break;
            }
            allResults.push({ algo, notes });
        }
        
        let combined = this.combineResults(allResults);
        combined = this.applyTemporalSmoothing(combined);
        
        return combined;
    }
    
    combineResults(allResults) {
        if (allResults.length === 0) return [];
        if (allResults.length === 1) return allResults[0].notes;
        
        const noteVotes = {};
        
        for (const { algo, notes } of allResults) {
            for (const note of notes) {
                if (!noteVotes[note.midi]) {
                    noteVotes[note.midi] = { count: 0, totalConfidence: 0, bestNote: note };
                }
                noteVotes[note.midi].count++;
                noteVotes[note.midi].totalConfidence += (note.confidence || 0.5);
                if ((note.confidence || 0.5) > (noteVotes[note.midi].bestNote.confidence || 0.5)) {
                    noteVotes[note.midi].bestNote = note;
                }
            }
        }
        
        const numAlgos = allResults.length;
        let result = [];
        
        switch(combineMode) {
            case 'union':
                result = Object.values(noteVotes).map(v => ({
                    ...v.bestNote, confidence: v.totalConfidence / numAlgos
                }));
                break;
            case 'intersection':
                result = Object.values(noteVotes)
                    .filter(v => v.count === numAlgos)
                    .map(v => ({ ...v.bestNote, confidence: v.totalConfidence / numAlgos }));
                break;
            case 'voting':
                const threshold = Math.ceil(numAlgos / 2);
                result = Object.values(noteVotes)
                    .filter(v => v.count >= threshold)
                    .map(v => ({ ...v.bestNote, confidence: v.count / numAlgos }));
                break;
            case 'strongest':
                result = Object.values(noteVotes)
                    .map(v => ({ ...v.bestNote, confidence: v.totalConfidence / v.count }))
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 4);
                break;
        }
        
        result.sort((a, b) => a.midi - b.midi);
        return result.slice(0, 4);
    }
}

// ============================================
// FACTORY & SETTERS
// ============================================

let pitchDetectorInstance = null;

export function createPitchDetector(audioContext, analyser) {
    pitchDetectorInstance = new PitchDetector(audioContext, analyser);
    return pitchDetectorInstance;
}

export function getPitchDetector() {
    return pitchDetectorInstance;
}

export function setSensitivity(value) {
    sensitivity = value;
}

export function setCombineMode(mode) {
    combineMode = mode;
}

export function toggleAlgorithm(algo) {
    if (activeAlgorithms.has(algo)) {
        activeAlgorithms.delete(algo);
    } else {
        activeAlgorithms.add(algo);
    }
}

export function setAlgorithmActive(algo, active) {
    if (active) {
        activeAlgorithms.add(algo);
    } else {
        activeAlgorithms.delete(algo);
    }
}
