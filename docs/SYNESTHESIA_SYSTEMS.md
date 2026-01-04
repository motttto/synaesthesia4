# Synästhetische Farbsysteme

Diese Dokumentation beschreibt die beiden Farbsysteme, die in Synästhesie implementiert sind. Beide basieren auf authentischen synästhetischen Wahrnehmungen.

---

## Clara's System (Chromästhesie)

Claras System ist ein **absolutes Farbsystem**: Jeder Ton hat eine feste Farbe, unabhängig vom musikalischen Kontext.

### Grundtonfarben

| Note | Farbe    | Hex       | RGB             |
|------|----------|-----------|-----------------|
| C    | Rot      | `#FF0000` | 255, 0, 0       |
| D    | Gelb     | `#FFFF00` | 255, 255, 0     |
| E    | Grün     | `#00CC00` | 0, 204, 0       |
| F    | Orange   | `#FF8800` | 255, 136, 0     |
| G    | Blau     | `#0066FF` | 0, 102, 255     |
| A    | Grau     | `#999999` | 153, 153, 153   |
| H/B  | Braun    | `#8B4513` | 139, 69, 19     |

### Erhöhte Töne (♯ / -is)

Kreuztonarten erscheinen **heller/pastelliger** als ihre Grundtöne:

| Note | Farbe       | Hex       |
|------|-------------|-----------|
| Cis  | Rosa        | `#FFAAAA` |
| Dis  | Hellgelb    | `#FFFF99` |
| Fis  | Hellorange  | `#FFCC66` |
| Gis  | Hellblau    | `#99CCFF` |
| Ais  | Rosa        | `#FFCCCC` |

### Erniedrigte Töne (♭ / -es)

B-Tonarten erscheinen **dunkler/gedämpfter** als ihre Grundtöne:

| Note | Farbe        | Hex       |
|------|--------------|-----------|
| Des  | Olivgelb     | `#B3B366` |
| Es   | Dunkelgrün   | `#228B22` |
| Ges  | Türkis       | `#339999` |
| As   | Blaugrau     | `#666688` |
| B    | Dunkelbraun  | `#5D3A1A` |

### Intervallformen

Intervalle werden nicht nur durch Farben, sondern auch durch **geometrische Formen** charakterisiert:

| Intervall             | Form                            |
|-----------------------|---------------------------------|
| Prime (Unison)        | Punkt                           |
| Kleine Sekunde        | Kleine Form (kurzer Strich)     |
| Große Sekunde         | Kleine Form                     |
| Kleine Terz           | Oval                            |
| Große Terz            | Oval                            |
| Quarte und größer     | Linien (nacheinander gespielt)  |
| Oktave                | Rechteck/Fläche (gleichzeitig)  |

### Ziffernfarben

Zahlen (z.B. bei Taktarten wie 4/4, 6/8) haben eigene Farben:

| Ziffer | Farbe     | Hex       |
|--------|-----------|-----------|
| 0      | Weiß      | `#F5F5F5` |
| 1      | Rosa      | `#FFAAAA` |
| 2      | Gelb      | `#FFEE00` |
| 3      | Rot       | `#FF3333` |
| 4      | Grün      | `#44AA44` |
| 5      | Hellgrün  | `#66BB66` |
| 6      | Rosa      | `#FFAACC` |
| 7      | Orange    | `#FF9933` |
| 8      | Orange    | `#FFAA44` |
| 9      | Rot       | `#FF4444` |

---

## Alex' System (Harmonische Wahrnehmung)

Alex' System ist ein **relatives Farbsystem**: Farben werden durch den musikalischen Kontext (Modus und Akkordposition) bestimmt.

### Modusfarben

Die Grundstimmung eines Akkords bestimmt die dominante Farbe:

| Modus | Farbe      | Hex       | Beschreibung            |
|-------|------------|-----------|-------------------------|
| Moll  | Blau       | `#3366CC` | Kühle, melancholische Töne |
| Dur   | Rot/Orange | `#CC5544` | Warme, helle Töne       |

### Stufenfarben (Scale Degrees)

Jede Stufe innerhalb eines Akkords oder einer Tonleiter hat ihre eigene Farbe:

| Stufe | Name          | Farbe       | Hex       |
|-------|---------------|-------------|-----------|
| I     | Tonika        | Hellgrau    | `#EEEEEE` |
| ♭II   | Neapolitaner  | Gelb        | `#EECC00` |
| II    | Supertonica   | Hellgelb    | `#FFEE55` |
| ♭III  | Moll-Terz     | Blau        | `#3366CC` |
| III   | Dur-Terz      | Hellblau    | `#5588DD` |
| IV    | Subdominante  | Rot         | `#DD4433` |
| ♯IV   | Tritonus      | Rot         | `#CC3322` |
| V     | Dominante     | Gelb        | `#FFDD00` |
| ♭VI   | -             | Dunkelblau  | `#2255AA` |
| VI    | -             | Grün        | `#44AA44` |
| ♭VII  | -             | Orange      | `#FF8833` |
| VII   | Leitton       | Orange/Rot  | `#EE6622` |

### Anwendung im Programm

- **Hintergrund-Gradient**: Modusfarbe (Dur/Moll) beeinflusst den Hintergrundfarbverlauf
- **Vignette**: Stufenfarben werden für den Vignette-Effekt verwendet
- **Intensität**: Akkordspannung kann die Farbsättigung beeinflussen

---

## Vergleich der Systeme

| Aspekt           | Clara                    | Alex                        |
|------------------|--------------------------|-----------------------------|
| Farbzuordnung    | Absolut (Note → Farbe)   | Relativ (Kontext → Farbe)   |
| Basis            | Einzelne Töne            | Akkorde & Modi              |
| Wahrnehmung      | Chromästhesie            | Harmonische Synästhesie     |
| 3D-Modelle       | ✓ (Modellfarben)         | —                           |
| Hintergrund      | —                        | ✓ (Gradient/Vignette)       |
| Intervalle       | Formen                   | —                           |

---

## Technische Implementation

Die Farbdefinitionen befinden sich in:
```
js/config/colors.js
```

### ClaraColors Export
```javascript
import { ClaraColors } from './js/config/colors.js';

// Grundton abrufen
const cRed = ClaraColors.notes['C'].base;  // 0xff0000

// Erhöhter Ton
const cisRosa = ClaraColors.notes['C'].sharp;  // 0xffaaaa

// Ziffernfarbe
const digit4Green = ClaraColors.digits[4];  // 0x44aa44
```

### AlexColors Export
```javascript
import { AlexColors } from './js/config/colors.js';

// Modusfarbe
const minorBlue = AlexColors.modes['minor'];  // 0x3366cc

// Stufenfarbe (0-11)
const tonicGray = AlexColors.degrees[0];  // 0xeeeeee
const dominantYellow = AlexColors.degrees[7];  // 0xffdd00
```

---

## Quellen

Die Farbsysteme basieren auf dokumentierten synästhetischen Erfahrungen von Clara und Alex (siehe Originalbilder im Projektordner).

*Letzte Aktualisierung: Januar 2026*
