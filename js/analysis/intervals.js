/**
 * INTERVALL-ANALYSE
 * 
 * Analysiert erkannte Noten und berechnet:
 * - Intervalle zwischen Tönen
 * - Akkorderkennung
 * - Tonalitätsbestimmung (Dur/Moll)
 */

import { IntervalNames } from '../config/intervals.js';

// ============================================
// DEFAULT ANALYSIS (für Start ohne Audio)
// ============================================

export const defaultAnalysis = {
    notes: [],
    bass: { name: 'C', midi: 60, isSharp: false, octave: 4, full: 'C4' },
    intervals: [],
    chord: null,
    quality: 'neutral'
};

// ============================================
// INTERVAL ANALYSIS
// ============================================

/**
 * Analysiert Noten und extrahiert Intervalle
 * @param {Array} notes - Array von Note-Objekten mit midi, name, etc.
 * @returns {Object} Analysis-Objekt
 */
export function analyzeIntervals(notes) {
    if (!notes || notes.length === 0) {
        return { ...defaultAnalysis };
    }
    
    // Sortiere nach MIDI (tiefste Note zuerst)
    const sorted = [...notes].sort((a, b) => a.midi - b.midi);
    const bass = sorted[0];
    
    // Intervalle vom Bass aus berechnen
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
        const semitones = sorted[i].midi - bass.midi;
        const intervalInfo = IntervalNames[semitones] || IntervalNames[semitones % 12] || { name: `${semitones} HT`, short: `${semitones}` };
        
        intervals.push({
            semitones: semitones,
            name: intervalInfo.name,
            short: intervalInfo.short,
            fromNote: bass,
            toNote: sorted[i]
        });
    }
    
    // Akkord erkennen
    const chord = detectChord(sorted);
    
    // Qualität (Dur/Moll) bestimmen
    const quality = getChordQuality({ notes: sorted, intervals, chord });
    
    return {
        notes: sorted,
        bass: bass,
        intervals: intervals,
        chord: chord,
        quality: quality
    };
}

// ============================================
// CHORD DETECTION
// ============================================

/**
 * Erkennt Akkord aus Noten
 */
export function detectChord(notes) {
    if (!notes || notes.length < 2) return null;
    
    const bass = notes[0];
    const bassName = bass.name.replace('#', '').replace('b', '');
    
    // Intervalle in Halbtönen (relativ zum Bass)
    const intervals = notes.slice(1).map(n => (n.midi - bass.midi) % 12);
    
    // Einfache Akkorderkennung
    let type = '';
    let symbol = '';
    
    // Dur-Dreiklang: 4 + 3 Halbtöne
    if (intervals.includes(4) && intervals.includes(7)) {
        type = 'Dur';
        symbol = '';
    }
    // Moll-Dreiklang: 3 + 4 Halbtöne
    else if (intervals.includes(3) && intervals.includes(7)) {
        type = 'Moll';
        symbol = 'm';
    }
    // Vermindert: 3 + 3 Halbtöne
    else if (intervals.includes(3) && intervals.includes(6)) {
        type = 'vermindert';
        symbol = '°';
    }
    // Übermäßig: 4 + 4 Halbtöne
    else if (intervals.includes(4) && intervals.includes(8)) {
        type = 'übermäßig';
        symbol = '+';
    }
    // Sus4
    else if (intervals.includes(5) && intervals.includes(7)) {
        type = 'sus4';
        symbol = 'sus4';
    }
    // Sus2
    else if (intervals.includes(2) && intervals.includes(7)) {
        type = 'sus2';
        symbol = 'sus2';
    }
    // Power Chord (nur Quinte)
    else if (intervals.includes(7) && intervals.length === 1) {
        type = 'Power';
        symbol = '5';
    }
    // Nur Intervall (zwei Töne)
    else if (notes.length === 2) {
        const semitones = notes[1].midi - notes[0].midi;
        const intervalInfo = IntervalNames[semitones] || { name: `Intervall ${semitones}`, short: `${semitones}` };
        return {
            root: bassName,
            type: intervalInfo.name,
            symbol: intervalInfo.short,
            full: `${bassName} - ${intervalInfo.name}`
        };
    }
    
    // Septimen-Erweiterungen
    if (intervals.includes(10)) {
        symbol += '7';
        type += ' mit kl. Septime';
    } else if (intervals.includes(11)) {
        symbol += 'maj7';
        type += ' mit gr. Septime';
    }
    
    // Nonen-Erweiterungen
    if (intervals.includes(2) || intervals.includes(14)) {
        if (!symbol.includes('sus2')) {
            symbol += intervals.includes(10) || intervals.includes(11) ? '9' : 'add9';
        }
    }
    
    if (!type) {
        type = 'Akkord';
    }
    
    return {
        root: bassName,
        type: type,
        symbol: symbol,
        full: `${bassName}${symbol}`
    };
}

/**
 * Bestimmt Akkordqualität (major/minor/neutral)
 */
export function getChordQuality(analysis) {
    if (!analysis || !analysis.intervals || analysis.intervals.length === 0) {
        return 'neutral';
    }
    
    // Prüfe auf kleine Terz (3 Halbtöne) = Moll
    const hasMinorThird = analysis.intervals.some(i => i.semitones === 3 || i.semitones === 15);
    
    // Prüfe auf große Terz (4 Halbtöne) = Dur  
    const hasMajorThird = analysis.intervals.some(i => i.semitones === 4 || i.semitones === 16);
    
    if (hasMinorThird && !hasMajorThird) {
        return 'minor';
    }
    if (hasMajorThird && !hasMinorThird) {
        return 'major';
    }
    
    // Prüfe Akkord-Type
    if (analysis.chord) {
        if (analysis.chord.type.includes('Moll') || analysis.chord.symbol.includes('m')) {
            return 'minor';
        }
        if (analysis.chord.type.includes('Dur')) {
            return 'major';
        }
    }
    
    return 'neutral';
}
