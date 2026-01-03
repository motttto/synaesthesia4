/**
 * FARBSCHEMATA für Synästhesie
 * 
 * Clara: Absolute Tonfarben (jeder Ton hat eine feste Farbe)
 *        - Chromästhesie: Jeder Ton hat spezifische Farbe
 *        - #-Töne: hellere/pastellige Variante
 *        - b-Töne: dunklere/gedämpfte Variante
 * 
 * Alex: Relative Akkordfarben (Modus und Stufen bestimmen Farbe)
 *        - Moll = Blau, Dur = Rot/Orange
 *        - Akkordtöne (Stufen I-VII) haben eigene Farben
 * 
 * Basierend auf Original-Reflexbildern
 */

// Clara: Absolute Tonfarben nach Original-Bild
// Grundtöne: C=rot, D=gelb, E=grün, F=orange, G=blau, A=grau, H=braun
export const ClaraColors = {
    notes: {
        // Grundton          #-Ton (heller/Pastell)    b-Ton (gedämpft/verändert)
        'C':  { base: 0xff0000, sharp: 0xffaaaa, flat: null      },  // C = Rot, Cis = Rosa
        'D':  { base: 0xffff00, sharp: 0xffff99, flat: 0xb3b366  },  // D = Gelb, Dis = Hellgelb, Des = Olivgelb
        'E':  { base: 0x00cc00, sharp: null,     flat: 0x228B22  },  // E = Grün, Es = Dunkelgrün
        'F':  { base: 0xff8800, sharp: 0xffcc66, flat: null      },  // F = Orange, Fis = Hellorange
        'G':  { base: 0x0066ff, sharp: 0x99ccff, flat: 0x339999  },  // G = Blau, Gis = Hellblau, Ges = Türkis
        'A':  { base: 0x999999, sharp: 0xffcccc, flat: 0x666688  },  // A = Grau, Ais = Rosa, As = Blaugrau
        'B':  { base: 0x8B4513, sharp: null,     flat: 0x5D3A1A  },  // H = Braun, B = Dunkelbraun
    },
    
    // Intervall-Zuordnung zu Formen (nach Bild 1)
    // Sekunde = kleine Form, Terz = oval, größere = Linien
    intervals: {
        0:  'prime',           // Punkt
        1:  'sekunde_klein',   // Kleine Form (Strich)
        2:  'sekunde_gross',   // Kleine Form
        3:  'terz_klein',      // Oval
        4:  'terz_gross',      // Oval
        5:  'quarte',          // Linie
        6:  'tritonus',        // Linie
        7:  'quinte',          // Linie
        8:  'sexte_klein',     // Linie
        9:  'sexte_gross',     // Linie
        10: 'septime_klein',   // Linie
        11: 'septime_gross',   // Linie
        12: 'oktave'           // Fläche/Rechteck (gleichzeitig)
    },
    
    // Ziffernfarben nach Original-Bild (z.B. bei Taktarten)
    // 0=weiß, 1=rosa, 2=gelb, 3=rot, 4=grün, 5=grün, 6=rosa, 7=orange, 8=orange, 9=rot
    digits: {
        0: 0xf5f5f5,  // Weiß/Hellgrau
        1: 0xffaaaa,  // Rosa
        2: 0xffee00,  // Gelb
        3: 0xff3333,  // Rot
        4: 0x44aa44,  // Grün
        5: 0x66bb66,  // Grün (etwas heller)
        6: 0xffaacc,  // Rosa
        7: 0xff9933,  // Orange
        8: 0xffaa44,  // Orange
        9: 0xff4444   // Rot
    }
};

// Alex: Relative Akkordfarben nach Original-Bild
export const AlexColors = {
    // Modusfarben: Moll = Blau, Dur = Rot/Orange
    modes: {
        'minor': 0x3366cc,  // Blau
        'major': 0xcc5544,  // Rot/Orange
    },
    
    // Stufenfarben nach Original-Bild
    // I=hellgrau, bII=gelb, II=gelb, bIII=blau, III=blau, 
    // IV=rot, #IV=rot, V=gelb, bVI=blau, VI=grün, VII=orange, #VII=rot
    degrees: {
        0:  0xeeeeee,  // I - Hellgrau/Weiß (Tonika)
        1:  0xeecc00,  // bII - Gelb (Neapolitaner)
        2:  0xffee55,  // II - Helles Gelb
        3:  0x3366cc,  // bIII - Blau (Moll-Terz)
        4:  0x5588dd,  // III - Helleres Blau (Dur-Terz)
        5:  0xdd4433,  // IV - Rot (Subdominante)
        6:  0xcc3322,  // #IV/b5 - Rot (Tritonus)
        7:  0xffdd00,  // V - Gelb (Dominante)
        8:  0x2255aa,  // bVI - Dunkelblau
        9:  0x44aa44,  // VI - Grün
        10: 0xff8833,  // bVII - Orange
        11: 0xee6622,  // VII - Orange/Rot (Leitton)
    },
    
    // Sekundärfarben für Gradienten
    degreesSecondary: {
        0:  0xffffff,  // I
        1:  0xffee55,  // bII
        2:  0xffffaa,  // II
        3:  0x5588dd,  // bIII
        4:  0x88bbff,  // III
        5:  0xff6644,  // IV
        6:  0xee5533,  // #IV
        7:  0xffee66,  // V
        8:  0x4477cc,  // bVI
        9:  0x66cc66,  // VI
        10: 0xffaa55,  // bVII
        11: 0xff8844,  // VII
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
