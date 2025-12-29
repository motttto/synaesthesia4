/**
 * INTERVALL-DEFINITIONEN für Synästhesie
 * 
 * Vollständige Abdeckung von Prime (0) bis Doppeloktave (24)
 * Inkl. Modell-Zuordnungen für 3D-Visualisierung
 */

// Namen und Kurzformen aller Intervalle
export const IntervalNames = {
    0:  { name: 'Prime', short: 'P1' },
    1:  { name: 'Kleine Sekunde', short: 'm2' },
    2:  { name: 'Große Sekunde', short: 'M2' },
    3:  { name: 'Kleine Terz', short: 'm3' },
    4:  { name: 'Große Terz', short: 'M3' },
    5:  { name: 'Quarte', short: 'P4' },
    6:  { name: 'Tritonus', short: 'TT' },
    7:  { name: 'Quinte', short: 'P5' },
    8:  { name: 'Kleine Sexte', short: 'm6' },
    9:  { name: 'Große Sexte', short: 'M6' },
    10: { name: 'Kleine Septime', short: 'm7' },
    11: { name: 'Große Septime', short: 'M7' },
    12: { name: 'Oktave', short: 'P8' },
    // Intervalle über der Oktave
    13: { name: 'Kleine None', short: 'm9' },
    14: { name: 'Große None', short: 'M9' },
    15: { name: 'Kleine Dezime', short: 'm10' },
    16: { name: 'Große Dezime', short: 'M10' },
    17: { name: 'Undezime', short: 'P11' },
    18: { name: 'Überm. Undezime', short: '#11' },
    19: { name: 'Duodezime', short: 'P12' },
    20: { name: 'Kleine Tredezime', short: 'm13' },
    21: { name: 'Große Tredezime', short: 'M13' },
    22: { name: 'Kleine Quartdezime', short: 'm14' },
    23: { name: 'Große Quartdezime', short: 'M14' },
    24: { name: 'Doppeloktave', short: 'P15' },
};

// Legacy-Modell-Zuordnungen (für Fallback ohne Set)
export const IntervalModels = {
    0:  'prime.glb',           // Prime
    1:  'sekunde.glb',         // kleine Sekunde
    2:  'sekunde.glb',         // große Sekunde
    3:  'terz-klein.glb',      // kleine Terz
    4:  'terz-gross.glb',      // große Terz
    5:  'quarte.glb',          // Quarte
    6:  'quarte.glb',          // Tritonus (Fallback)
    7:  'quinte.glb',          // Quinte
    8:  'sexte_1.glb',         // kleine Sexte
    9:  'sexte_1.glb',         // große Sexte
    10: 'septime_klein.glb',   // kleine Septime
    11: 'septime_klein.glb',   // große Septime (Fallback)
    12: 'oktave.glb',          // Oktave
    // Nonen (Oktave + Sekunde)
    13: 'sekunde.glb',         // kleine None
    14: 'sekunde.glb',         // große None
    // Dezimen (Oktave + Terz)
    15: 'terz-klein.glb',      // kleine Dezime
    16: 'dezime_gross.glb',    // große Dezime
    // Undezimen (Oktave + Quarte)
    17: 'quarte.glb',          // Undezime
    18: 'quarte.glb',          // überm. Undezime
    // Duodezime (Oktave + Quinte)
    19: 'quinte.glb',          // Duodezime
    // Tredezimen (Oktave + Sexte)
    20: 'sexte_1.glb',         // kleine Tredezime
    21: 'sexte_1.glb',         // große Tredezime
    // Quartdezimen (Oktave + Septime)
    22: 'septime_klein.glb',   // kleine Quartdezime
    23: 'septime_klein.glb',   // große Quartdezime
    // Doppeloktave
    24: 'oktave.glb',          // Doppeloktave
};

/**
 * Findet das passende Modell für ein Intervall
 * @param {number} semitones - Anzahl Halbtöne (0-24+)
 * @returns {string} Dateiname des Modells
 */
export function getModelForInterval(semitones) {
    // Direkte Zuordnung wenn vorhanden
    if (IntervalModels[semitones]) {
        return IntervalModels[semitones];
    }
    // Fallback: Auf Oktav-Äquivalent reduzieren
    const reduced = semitones % 12;
    return IntervalModels[reduced] || 'prime.glb';
}

// Alle verfügbaren Modelle mit Display-Namen (für UI-Dropdown)
export const AvailableModels = [
    { file: 'none_klein.glb', name: 'None/Prime' },
    { file: 'sekunde.glb', name: 'Sekunde' },
    { file: 'terz-gross.glb', name: 'Terz' },
    { file: 'quarte.glb', name: 'Quarte' },
    { file: 'quinte.glb', name: 'Quinte' },
    { file: 'sexte_1.glb', name: 'Sexte' },
    { file: 'septime_klein.glb', name: 'Septime' },
    { file: 'oktave.glb', name: 'Oktave' }
];
