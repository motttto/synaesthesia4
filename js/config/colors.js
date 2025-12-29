/**
 * FARBSCHEMATA für Synästhesie
 * 
 * Clara: Absolute Tonfarben (jeder Ton hat eine feste Farbe)
 * Alex: Relative Akkordfarben (Modus und Stufen bestimmen Farbe)
 */

// Clara: Absolute Tonfarben (maximale Sättigung nach Original-Bild)
export const ClaraColors = {
    notes: {
        //       Grundton        #-Ton (heller)   b-Ton (dunkler)
        'C':  { base: 0xff0000, sharp: 0xff6666, flat: 0xdd0000 },  // C = Reines Rot
        'D':  { base: 0xffff00, sharp: 0xffff77, flat: 0xdddd00 },  // D = Reines Gelb
        'E':  { base: 0x00ff00, sharp: null,     flat: 0x00cc00 },  // E = Reines Grün
        'F':  { base: 0xff8800, sharp: 0xffaa44, flat: null },      // F = Kräftiges Orange
        'G':  { base: 0x0066ff, sharp: 0x66aaff, flat: 0x0044cc },  // G = Kräftiges Blau
        'A':  { base: 0x999999, sharp: 0xbbbbbb, flat: 0x666666 },  // A = Grau
        'B':  { base: 0x8B4513, sharp: null,     flat: 0x5D2E0C },  // H = Braun
    },
    intervals: {
        0:  'prime',
        1:  'sekunde_klein',
        2:  'sekunde_gross', 
        3:  'terz_klein',
        4:  'terz_gross',
        5:  'quarte',
        6:  'tritonus',
        7:  'quinte',
        8:  'sexte_klein',
        9:  'sexte_gross',
        10: 'septime_klein',
        11: 'septime_gross',
        12: 'oktave'
    },
    digits: {
        0: 0xffffff, 1: 0xff0000, 2: 0xff6699, 3: 0xffcc00,
        4: 0x996633, 5: 0x99cc00, 6: 0x00cc66,
        7: 0x66cccc, 8: 0xff9900, 9: 0xcc99ff
    }
};

// Alex: Relative Akkordfarben
export const AlexColors = {
    modes: {
        'minor': 0x3366cc,
        'major': 0xff6633,
    },
    // Erweiterte Stufenfarben mit mehr Variation
    degrees: {
        0:  0xff2222,  // I - Rot (Tonika)
        1:  0xe6b800,  // bII - Gold/Gelb (Neapolitaner)
        2:  0xffee55,  // II - Helles Gelb
        3:  0x2255dd,  // bIII - Tiefes Blau (Moll-Terz)
        4:  0x44aaff,  // III - Hellblau (Dur-Terz)
        5:  0xff5500,  // IV - Orange (Subdominante)
        6:  0x9922cc,  // #IV/b5 - Violett (Tritonus)
        7:  0xffcc00,  // V - Gelb-Gold (Dominante)
        8:  0x3344aa,  // bVI - Dunkelblau
        9:  0x22cc66,  // VI - Grün
        10: 0xff8833,  // bVII - Helles Orange
        11: 0xcc4422,  // VII - Rotbraun (Leitton)
    },
    // Sekundärfarben für Gradienten
    degreesSecondary: {
        0:  0xff6644,  // I
        1:  0xffdd33,  // bII
        2:  0xffffaa,  // II
        3:  0x4477ff,  // bIII
        4:  0x88ccff,  // III
        5:  0xffaa33,  // IV
        6:  0xcc44ff,  // #IV
        7:  0xffee66,  // V
        8:  0x5566cc,  // bVI
        9:  0x44ee88,  // VI
        10: 0xffbb66,  // bVII
        11: 0xff6633,  // VII
    },
    degreeNames: {
        0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV',
        6: '#IV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII'
    }
};

// State für Gradient/Vignette (wird von UI gesteuert)
export const colorState = {
    alexGradientEnabled: false,
    alexVignetteEnabled: false,
    currentVignetteColor: null  // { r, g, b, a } oder null wenn inaktiv
};
