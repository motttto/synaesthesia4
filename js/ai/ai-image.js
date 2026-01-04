/**
 * AI IMAGE GENERATION
 * 
 * Verbindet mit ComfyUI für lokale Stable Diffusion Bildgenerierung
 * - Overlay Opacity: Stufenlose Transparenz 0-100%
 * - Provider: Local (ComfyUI), Mix
 * - Models: SD 1.5, SDXL, Turbo
 * - Auto-Generation basierend auf Speech/Prompts
 * - Buffer Mode für smoothe Übergänge
 * - 3D Texture Mode: AI Bilder als Textur auf 3D Modelle
 */

import * as THREE from 'three';
import { getInstrumentForPrompt } from '../audio/instrument-detector.js';

// ============================================
// STATE
// ============================================

export const aiState = {
    // Display
    overlayOpacity: 0, // 0-100 (0 = off, 100 = full overlay)
    
    // Provider & Model
    provider: 'local',  // 'local', 'mix'
    model: 'local-sd15', // 'local-sd15', 'local-sdxl', 'local-turbo'
    
    // Resolution (WxH)
    resolution: '1920x1080', // Fixed pixel sizes or 'custom'
    customWidth: 1920,
    customHeight: 1080,
    
    // Upscale Settings
    upscaleEnabled: false,      // Generiere klein, skaliere hoch
    generateResolution: '768x432', // Kleine Generierungsauflösung (16:9)
    upscaleMethod: 'lanczos',   // 'nearest-exact', 'bilinear', 'bicubic', 'lanczos'
    
    // Advanced Generation Settings
    steps: 4,                   // Sampling steps (1-30)
    cfg: 1,                     // CFG scale (1-15)
    sampler: 'euler',           // Sampler name (euler = fastest)
    
    // Save Settings
    saveImages: false,          // true = SaveImage (dauerhaft), false = PreviewImage (temporär)
    
    // ComfyUI Connection
    comfyPort: 8188,
    comfyUrl: 'http://localhost:8188',
    connected: false,
    generating: false,
    customCheckpoint: null, // Manuell gewähltes Checkpoint
    
    // Settings
    autoGenerate: false,
    bufferMode: false,
    crossfadeEnabled: false,
    
    // Buffer Settings
    bufferSize: 24,
    bufferLoop: false,
    bufferShuffle: false,
    bufferImages: [],
    bufferIndex: 0,
    
    // Continuous Generation
    continuousGen: false,      // Generiert bis Buffer voll
    
    // Stream Mode (continuous output without storing)
    streamMode: false,         // Kontinuierlicher Output ohne Speichern
    streamPause: 0,            // Pause zwischen Generierungen (ms), 0 = sofort weiter
    
    // Playback Settings
    playbackActive: false,     // Spielt Buffer ab
    playbackSpeed: 2000,       // ms pro Bild (2 Sekunden default)
    
    // BPM Sync
    bpmSyncEnabled: false,     // Sync Playback to BPM
    bpmSyncBeats: 1,           // Bildwechsel alle X Beats (1, 2, 4, 8, 16)
    beatCounter: 0,            // Zählt Beats seit letztem Bildwechsel
    
    // Visibility
    enabled: true,             // AI Panel an/aus
    
    // 3D Texture
    useAsTexture: false,       // AI Bild als 3D-Modell-Textur
    textureApplyToAll: true,   // Auf alle Modelle anwenden

    // Prompt
    currentPrompt: '',
    lastGeneratedPrompt: '',
    
    // Images
    currentImage: null,
    bufferImage: null,
    
    // Filter (synced with speech.js)
    filterNouns: true,
    filterVerbs: false,
    filterAdj: false,
    
    // Prompt Modifiers
    promptModifiers: {
        cinematic: false,
        anatomy: false,
        highDetail: false,
        artistic: false
    },
    
    // Post-Processing Upscale (lokal in App)
    postUpscaleEnabled: false,    // Nachträgliches Upscaling aktiviert
    postUpscaleMethod: 'lanczos', // 'nearest', 'bilinear', 'bicubic', 'lanczos'
    postUpscaleTarget: '1920x1080', // Zielauflösung
    postUpscaleSharpen: 0,        // Schärfung 0-100
    
    // Translation Settings
    translateEnabled: true,      // Auto-translate non-English to English
    translateApiUrl: 'http://localhost:5000/translate', // LibreTranslate URL (optional)
    useApiTranslation: false,    // Use API instead of dictionary
    lastTranslatedPrompt: '',    // Letzter übersetzter Prompt
    
    // Translation Method Toggles
    translateDictionary: true,   // Direktes Wörterbuch-Lookup
    translateCompound: true,     // Zusammengesetzte Wörter zerlegen
    translateStemming: true,     // Deutsche Endungen entfernen
    translateFuzzy: true,        // Fuzzy-Matching für ähnliche Wörter
    translateSkipGerman: true,   // Nicht-übersetzbare deutsche Wörter überspringen
    fuzzyMaxDistance: 0,         // 0 = auto (abhängig von Wortlänge)
    
    // Prompt Modifier Texts
    modifierTexts: {
        cinematic: 'cinematic lighting, dramatic atmosphere, film grain, anamorphic lens, depth of field, volumetric lighting, color grading',
        anatomy: 'anatomically correct, proper human proportions, correct number of fingers, realistic body structure, natural pose',
        highDetail: '8k uhd, highly detailed, sharp focus, intricate details, professional photography',
        artistic: 'masterpiece, best quality, trending on artstation, award winning'
    }
};

// Playback Timer
let playbackTimer = null;
// Continuous Generation aktiv
let continuousGenActive = false;
// Stream Mode aktiv
let streamModeActive = false;
let streamImageCount = 0;
let streamStartTime = 0;

// Image Preload Cache für flüssiges Playback
let preloadedImages = new Map();  // URL -> decoded Image object

// UI Elements
let previewEl = null;
let statusEl = null;
let bufferStatusEl = null;
let bufferSettingsEl = null;
let bufferThumbsEl = null;
let currentInputEl = null;
let promptInputEl = null;
let overlayCanvas = null;
let overlayCtx = null;

// Auto-generation Timer
let autoGenTimer = null;
const AUTO_GEN_DELAY = 3000; // 3 Sekunden nach letztem Input

// Speech Buffer System
let speechBuffer = [];           // Array von erkannten Wörtern
let speechBufferTimer = null;    // Timer für Auto-Clear
let speechBufferTimeout = 3000;  // Clear nach X ms Stille (einstellbar)
let speechLastUpdate = 0;        // Timestamp des letzten Updates

// Wordcloud State
let wordcloudWords = {};         // {word: {count: N, lastSeen: timestamp}}
let wordcloudContainer = null;
let wordcloudRefreshTimer = null;

// Mini AI State
let miniAiState = {
    generating: false,
    autoMode: false,
    lastSeed: null,
    lastImage: null,
    lastPrompt: null
};
let miniAiPreviewEl = null;
let miniAiStatusEl = null;
let miniAiTimeEl = null;

// ============================================
// TRANSLATION SYSTEM (DE -> EN)
// ============================================

/**
 * Deutsch-Englisch Wörterbuch für häufige Prompt-Wörter
 * Fokus auf visuelle/künstlerische Begriffe
 */
const DE_EN_DICTIONARY = {
    // Farben
    'rot': 'red', 'blau': 'blue', 'grün': 'green', 'gelb': 'yellow',
    'orange': 'orange', 'lila': 'purple', 'violett': 'violet', 'rosa': 'pink',
    'schwarz': 'black', 'weiß': 'white', 'grau': 'gray', 'braun': 'brown',
    'gold': 'gold', 'silber': 'silver', 'türkis': 'turquoise', 'cyan': 'cyan',
    'dunkel': 'dark', 'hell': 'light', 'leuchtend': 'bright', 'matt': 'matte',
    
    // Natur
    'baum': 'tree', 'bäume': 'trees', 'wald': 'forest', 'blume': 'flower',
    'blumen': 'flowers', 'berg': 'mountain', 'berge': 'mountains', 'see': 'lake',
    'meer': 'sea', 'ozean': 'ocean', 'fluss': 'river', 'himmel': 'sky',
    'wolke': 'cloud', 'wolken': 'clouds', 'sonne': 'sun', 'mond': 'moon',
    'stern': 'star', 'sterne': 'stars', 'regen': 'rain', 'schnee': 'snow',
    'wasser': 'water', 'feuer': 'fire', 'erde': 'earth', 'luft': 'air',
    'wiese': 'meadow', 'gras': 'grass', 'blatt': 'leaf', 'blätter': 'leaves',
    'rose': 'rose', 'sonnenblume': 'sunflower', 'tulpe': 'tulip',
    
    // Tiere
    'hund': 'dog', 'katze': 'cat', 'vogel': 'bird', 'vögel': 'birds',
    'pferd': 'horse', 'fisch': 'fish', 'schmetterling': 'butterfly',
    'löwe': 'lion', 'tiger': 'tiger', 'bär': 'bear', 'wolf': 'wolf',
    'adler': 'eagle', 'eule': 'owl', 'drache': 'dragon', 'einhorn': 'unicorn',
    
    // Menschen & Körper
    'mensch': 'human', 'mann': 'man', 'frau': 'woman', 'kind': 'child',
    'gesicht': 'face', 'auge': 'eye', 'augen': 'eyes', 'hand': 'hand',
    'hände': 'hands', 'kopf': 'head', 'herz': 'heart', 'körper': 'body',
    'portrait': 'portrait', 'person': 'person', 'leute': 'people',
    
    // Gefühle & Stimmung
    'glücklich': 'happy', 'traurig': 'sad', 'wütend': 'angry',
    'friedlich': 'peaceful', 'ruhig': 'calm', 'wild': 'wild',
    'dunkel': 'dark', 'hell': 'bright', 'mystisch': 'mystical',
    'magisch': 'magical', 'romantisch': 'romantic', 'dramatisch': 'dramatic',
    'melancholisch': 'melancholic', 'fröhlich': 'cheerful',
    
    // Kunst & Stil
    'abstrakt': 'abstract', 'realistisch': 'realistic', 'surreal': 'surreal',
    'impressionistisch': 'impressionist', 'expressionistisch': 'expressionist',
    'minimalistisch': 'minimalist', 'modern': 'modern', 'klassisch': 'classical',
    'gemälde': 'painting', 'zeichnung': 'drawing', 'skizze': 'sketch',
    'kunstwerk': 'artwork', 'bild': 'image', 'foto': 'photo',
    'porträt': 'portrait', 'landschaft': 'landscape', 'stillleben': 'still life',
    'ölgemälde': 'oil painting', 'aquarell': 'watercolor',
    
    // Musik & Synästhesie
    'musik': 'music', 'melodie': 'melody', 'harmonie': 'harmony',
    'rhythmus': 'rhythm', 'klang': 'sound', 'ton': 'tone', 'töne': 'tones',
    'akkord': 'chord', 'dur': 'major', 'moll': 'minor',
    'laut': 'loud', 'leise': 'quiet', 'sanft': 'soft', 'hart': 'hard',
    'hoch': 'high', 'tief': 'low', 'warm': 'warm', 'kalt': 'cold',
    
    // Objekte
    'haus': 'house', 'stadt': 'city', 'straße': 'street', 'brücke': 'bridge',
    'turm': 'tower', 'schloss': 'castle', 'tempel': 'temple', 'kirche': 'church',
    'fenster': 'window', 'tür': 'door', 'licht': 'light', 'schatten': 'shadow',
    'spiegel': 'mirror', 'glas': 'glass', 'kristall': 'crystal',
    
    // Zeit & Raum
    'tag': 'day', 'nacht': 'night', 'morgen': 'morning', 'abend': 'evening',
    'sonnenuntergang': 'sunset', 'sonnenaufgang': 'sunrise', 'dämmerung': 'twilight',
    'raum': 'space', 'universum': 'universe', 'galaxie': 'galaxy',
    'nebel': 'fog', 'dunst': 'haze', 'horizont': 'horizon',
    
    // Adjektive
    'groß': 'big', 'klein': 'small', 'alt': 'old', 'neu': 'new',
    'schön': 'beautiful', 'hässlich': 'ugly', 'stark': 'strong', 'schwach': 'weak',
    'schnell': 'fast', 'langsam': 'slow', 'weich': 'soft', 'glatt': 'smooth',
    'rau': 'rough', 'scharf': 'sharp', 'verschwommen': 'blurry',
    'detailliert': 'detailed', 'einfach': 'simple', 'komplex': 'complex',
    
    // Verben (für Aktionen)
    'fliegen': 'flying', 'schwimmen': 'swimming', 'tanzen': 'dancing',
    'laufen': 'running', 'sitzen': 'sitting', 'stehen': 'standing',
    'träumen': 'dreaming', 'schlafen': 'sleeping', 'spielen': 'playing',
    
    // Qualität
    'hochauflösend': 'high resolution', 'hd': 'hd', '4k': '4k', '8k': '8k',
    'fotorealistisch': 'photorealistic', 'hyperrealistisch': 'hyperrealistic',
    'meisterwerk': 'masterpiece', 'professionell': 'professional',
    
    // Erweiterte Wörter für zusammengesetzte Begriffe
    'strom': 'power', 'ausfall': 'outage', 'fall': 'fall',
    'arbeit': 'work', 'platz': 'place', 'plätze': 'places',
    'industrie': 'industry', 'fabrik': 'factory',
    'gefahr': 'danger', 'sicherheit': 'safety', 'schutz': 'protection',
    'handel': 'trade', 'kammer': 'chamber', 'verband': 'association',
    'regierung': 'government', 'staat': 'state', 'politik': 'politics',
    'wirtschaft': 'economy', 'minister': 'minister', 'präsident': 'president',
    'krieg': 'war', 'frieden': 'peace', 'macht': 'power',
    'gewalt': 'violence', 'recht': 'law', 'gesetz': 'law',
    'wechsel': 'change', 'wandel': 'change', 'bewegung': 'movement',
    'entwicklung': 'development', 'forschung': 'research',
    'bildung': 'education', 'schule': 'school', 'universitaet': 'university',
    'gesundheit': 'health', 'krankheit': 'illness', 'arzt': 'doctor',
    'energie': 'energy', 'kraft': 'force', 'stärke': 'strength',
    'zukunft': 'future', 'vergangenheit': 'past', 'gegenwart': 'present',
    'anfang': 'beginning', 'ende': 'end', 'mitte': 'middle',
    'oben': 'above', 'unten': 'below', 'links': 'left', 'rechts': 'right',
    'innen': 'inside', 'außen': 'outside', 'vorne': 'front', 'hinten': 'back'
};

/**
 * Deutsche Stoppwörter die nicht übersetzt werden müssen
 */
const GERMAN_STOPWORDS = new Set([
    'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'mit', 'von', 'zu', 'bei', 'nach', 'vor',
    'in', 'an', 'auf', 'aus', 'um', 'für', 'durch', 'gegen', 'ohne',
    'ist', 'sind', 'war', 'hat', 'haben', 'wird', 'werden', 'wurde', 'worden',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man',
    'mein', 'dein', 'sein', 'unser', 'euer', 'ihr', 'ihre', 'ihren',
    'dieser', 'diese', 'dieses', 'jener', 'jene', 'jenes',
    'sehr', 'viel', 'mehr', 'wenig', 'weniger', 'auch', 'noch', 'schon',
    // Erweiterte Stoppwörter (Konjunktionen, Adverbien, Funktionswörter)
    'demnach', 'dabei', 'jedoch', 'bereits', 'zwischen', 'sowie', 'wobei',
    'daher', 'deshalb', 'dennoch', 'trotzdem', 'obwohl', 'weil', 'dass', 'daß',
    'wenn', 'falls', 'sofern', 'sobald', 'solange', 'bevor', 'nachdem', 'während',
    'bis', 'seit', 'ab', 'je', 'als', 'wie', 'so', 'dann', 'nun', 'jetzt',
    'hier', 'dort', 'wo', 'wohin', 'woher', 'wann', 'warum', 'weshalb', 'wieso',
    'was', 'wer', 'wem', 'wen', 'welche', 'welcher', 'welches', 'dessen', 'deren',
    'sich', 'selbst', 'einander', 'andere', 'anderer', 'anderen', 'anderem',
    'alle', 'alles', 'jede', 'jeder', 'jedes', 'jeden', 'jedem', 'keine', 'keiner',
    'kein', 'keinem', 'keinen', 'manche', 'mancher', 'manches', 'manchem',
    'beide', 'beider', 'beiden', 'beidem', 'solche', 'solcher', 'solches',
    'immer', 'nie', 'niemals', 'oft', 'selten', 'manchmal', 'meistens', 'meist',
    'etwa', 'ungefähr', 'ca', 'circa', 'fast', 'kaum', 'nur', 'bloß', 'bloß',
    'eigentlich', 'tatsächlich', 'wirklich', 'eben', 'gerade', 'sogar', 'zwar',
    'also', 'nämlich', 'übrigens', 'jedenfalls', 'immerhin', 'allerdings',
    'sei', 'seien', 'wäre', 'wären', 'hätte', 'hätten', 'könnte', 'könnten',
    'sollte', 'sollten', 'wollte', 'wollten', 'müsste', 'müssten', 'dürfte',
    'soll', 'will', 'kann', 'muss', 'darf', 'mag', 'können', 'müssen', 'dürfen',
    'laut', 'gemäß', 'entsprechend', 'hinsichtlich', 'bezüglich', 'angesichts',
    'zwecks', 'mittels', 'anhand', 'aufgrund', 'infolge', 'trotz', 'statt',
    'voraussichtlich', 'anscheinend', 'offenbar', 'vermutlich', 'wahrscheinlich'
]);

/**
 * Erkennt ob ein Text deutsch ist
 * Verwendet Umlaute, Wörterbuch UND typisch deutsche Wortendungen
 * @param {string} text - Eingabetext
 * @returns {boolean} - true wenn wahrscheinlich deutsch
 */
function isGermanText(text) {
    if (!text || text.trim().length === 0) return false;
    
    const words = text.toLowerCase().split(/\s+/);
    let germanIndicators = 0;
    let totalWords = 0;
    
    // Typisch deutsche Wortendungen
    const germanEndings = [
        'ung', 'heit', 'keit', 'schaft', 'tum', 'nis', 'sal',  // Substantiv-Endungen
        'chen', 'lein', 'ling',  // Diminutive
        'bar', 'lich', 'ig', 'isch', 'haft', 'sam', 'los',  // Adjektiv-Endungen
        'ieren', 'eln', 'ern',  // Verb-Endungen
        'eur', 'ent', 'ant', 'ät',  // Fremdwort-Endungen im Deutschen
    ];
    
    // Typisch deutsche Wortanfänge
    const germanPrefixes = [
        'ge', 'be', 'ver', 'zer', 'ent', 'emp', 'er', 'miss', 'un', 'ur',
        'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'mit', 'nach', 'vor', 'zu'
    ];
    
    for (const word of words) {
        // Entferne Satzzeichen am Ende
        const cleanWord = word.replace(/[.,!?;:]+$/, '');
        if (cleanWord.length < 2) continue;
        totalWords++;
        
        // Check for German-specific characters (Umlaute, ß)
        if (/[äöüßÄÖÜ]/.test(cleanWord)) {
            germanIndicators += 3; // Starker Indikator
            continue;
        }
        
        // Check if word is in German dictionary or stopwords
        if (DE_EN_DICTIONARY[cleanWord] || GERMAN_STOPWORDS.has(cleanWord)) {
            germanIndicators += 2;
            continue;
        }
        
        // Check for German word endings
        for (const ending of germanEndings) {
            if (cleanWord.length > ending.length + 2 && cleanWord.endsWith(ending)) {
                germanIndicators += 1.5;
                break;
            }
        }
        
        // Check for German prefixes (nur bei längeren Wörtern)
        if (cleanWord.length > 5) {
            for (const prefix of germanPrefixes) {
                if (cleanWord.startsWith(prefix)) {
                    germanIndicators += 0.5;
                    break;
                }
            }
        }
    }
    
    // Consider German if indicators suggest it (>25% threshold, lowered from 30%)
    const ratio = totalWords > 0 ? germanIndicators / totalWords : 0;
    const isGerman = ratio > 0.25;
    
    if (isGerman) {
        console.log(`🇩🇪 German detected (score: ${ratio.toFixed(2)}): "${text}"`);
    }
    
    return isGerman;
}

/**
 * Berechnet die Levenshtein-Distanz zwischen zwei Strings
 * (Anzahl der Einfügungen, Löschungen, Ersetzungen um s1 in s2 umzuwandeln)
 */
function levenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    
    // Optimierung für leere Strings
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;
    
    // Matrix erstellen
    const matrix = [];
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    // Matrix füllen
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Löschung
                matrix[i][j - 1] + 1,      // Einfügung
                matrix[i - 1][j - 1] + cost // Ersetzung
            );
        }
    }
    
    return matrix[len1][len2];
}

/**
 * Findet das ähnlichste Wort im Wörterbuch
 * @param {string} word - Das zu suchende Wort
 * @param {number} maxDistance - Maximale erlaubte Distanz (default: abhängig von Wortlänge)
 * @returns {{word: string, translation: string, distance: number}|null}
 */
function findClosestDictionaryWord(word, maxDistance = null) {
    if (!word || word.length < 3) return null;
    
    // Maximale Distanz abhängig von Wortlänge
    // Kurze Wörter: max 1, mittlere: max 2, lange: max 3
    if (maxDistance === null) {
        if (word.length <= 4) maxDistance = 1;
        else if (word.length <= 7) maxDistance = 2;
        else maxDistance = 3;
    }
    
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const [germanWord, englishWord] of Object.entries(DE_EN_DICTIONARY)) {
        // Überspringe Wörter mit sehr unterschiedlicher Länge
        if (Math.abs(germanWord.length - word.length) > maxDistance) continue;
        
        const distance = levenshteinDistance(word, germanWord);
        
        if (distance < bestDistance && distance <= maxDistance) {
            bestDistance = distance;
            bestMatch = {
                word: germanWord,
                translation: englishWord,
                distance: distance
            };
            
            // Perfekter Match gefunden
            if (distance === 0) break;
        }
    }
    
    return bestMatch;
}

/**
 * Übersetzt einen deutschen Text ins Englische
 * Verwendet das lokale Wörterbuch mit erweiterter Logik:
 * - Zusammengesetzte Wörter werden zerlegt
 * - Deutsche Endungen werden für Stammsuche entfernt
 * - Fuzzy-Matching für phonetische Varianten
 * - Nicht-übersetzbare Wörter werden übersprungen
 * @param {string} text - Deutscher Text
 * @returns {string} - Englischer Text
 */
function translateWithDictionary(text) {
    if (!text || text.trim().length === 0) return text;
    
    const words = text.split(/\s+/);
    const translatedWords = [];
    
    for (const word of words) {
        // Entferne Satzzeichen am Ende
        const cleanWord = word.replace(/[.,!?;:]+$/, '').toLowerCase();
        
        // Skip stopwords
        if (GERMAN_STOPWORDS.has(cleanWord)) {
            continue;
        }
        
        // 1. Direkte Übersetzung (Dictionary)
        if (aiState.translateDictionary && DE_EN_DICTIONARY[cleanWord]) {
            translatedWords.push(DE_EN_DICTIONARY[cleanWord]);
            continue;
        }
        
        // 2. Versuche zusammengesetztes Wort zu zerlegen (Compound)
        if (aiState.translateCompound) {
            const compoundTranslation = translateCompoundWord(cleanWord);
            if (compoundTranslation) {
                translatedWords.push(compoundTranslation);
                continue;
            }
        }
        
        // 3. Versuche Wort ohne deutsche Endung zu finden (Stemming)
        if (aiState.translateStemming) {
            const stemTranslation = translateWithStemming(cleanWord);
            if (stemTranslation) {
                translatedWords.push(stemTranslation);
                continue;
            }
        }
        
        // 4. Fuzzy-Matching: Finde ähnlichstes Wort im Wörterbuch
        if (aiState.translateFuzzy) {
            const maxDist = aiState.fuzzyMaxDistance > 0 ? aiState.fuzzyMaxDistance : null;
            const fuzzyMatch = findClosestDictionaryWord(cleanWord, maxDist);
            if (fuzzyMatch) {
                console.log(`🔍 Fuzzy match: "${cleanWord}" → "${fuzzyMatch.word}" (dist: ${fuzzyMatch.distance}) → "${fuzzyMatch.translation}"`);
                translatedWords.push(fuzzyMatch.translation);
                continue;
            }
        }
        
        // 5. Wort sieht deutsch aus aber nicht übersetzbar?
        if (aiState.translateSkipGerman && looksGerman(cleanWord)) {
            console.log(`⚠️ Skipping untranslatable German word: "${cleanWord}"`);
            continue;
        }
        
        // 6. Sonst: Wort behalten (vermutlich englisch oder Name)
        translatedWords.push(word);
    }
    
    return translatedWords.join(' ');
}

/**
 * Prüft ob ein einzelnes Wort deutsch aussieht
 */
function looksGerman(word) {
    // Umlaute - sicherer Indikator
    if (/[äöüßÄÖÜ]/.test(word)) return true;
    
    // Typisch deutsche Endungen (erweitert)
    const germanEndings = [
        'ung', 'heit', 'keit', 'schaft', 'tum', 'nis', 'sal',
        'lich', 'ig', 'isch', 'bar', 'sam', 'haft', 'los',
        'chen', 'lein', 'ling', 'ieren', 'eln', 'ern',
        'ent', 'ant', 'eur', 'tion', 'sion', 
        'er', 'en', 'el', 'em', 'es'  // Kürzere Endungen nur bei längeren Wörtern
    ];
    
    for (const ending of germanEndings) {
        // Kürzere Endungen nur bei längeren Wörtern prüfen
        const minLength = ending.length <= 2 ? 6 : ending.length + 2;
        if (word.length >= minLength && word.endsWith(ending)) return true;
    }
    
    // Typisch deutsche Präfixe bei längeren Wörtern
    if (word.length >= 6) {
        const germanPrefixes = ['ge', 'be', 'ver', 'zer', 'ent', 'emp', 'er', 'miss', 'un', 'ur', 'vor', 'nach', 'aus', 'ein', 'ab', 'an', 'auf', 'zu'];
        for (const prefix of germanPrefixes) {
            if (word.startsWith(prefix)) return true;
        }
    }
    
    // Sehr lange Wörter (>12 Zeichen) ohne Bindestrich sind oft deutsch (zusammengesetzt)
    if (word.length > 12 && !word.includes('-')) return true;
    
    // Typisch deutsche Buchstabenkombinationen
    if (/sch|ch|ck|tz|pf|dt|gn|kn|pn/.test(word) && word.length > 4) return true;
    
    return false;
}

/**
 * Versucht ein zusammengesetztes deutsches Wort zu übersetzen
 * z.B. "Stromausfall" -> "power outage" (Strom + Ausfall)
 */
function translateCompoundWord(word) {
    if (word.length < 6) return null;
    
    // Versuche das Wort an verschiedenen Stellen zu teilen
    for (let i = 3; i < word.length - 2; i++) {
        const part1 = word.substring(0, i);
        const part2 = word.substring(i);
        
        const trans1 = DE_EN_DICTIONARY[part1];
        const trans2 = DE_EN_DICTIONARY[part2];
        
        if (trans1 && trans2) {
            return `${trans1} ${trans2}`;
        }
        
        // Versuche auch mit 's' oder 'n' Fugenlaut
        if (word[i] === 's' || word[i] === 'n') {
            const part2WithoutFuge = word.substring(i + 1);
            const trans2Alt = DE_EN_DICTIONARY[part2WithoutFuge];
            if (trans1 && trans2Alt) {
                return `${trans1} ${trans2Alt}`;
            }
        }
    }
    
    return null;
}

/**
 * Versucht Wort ohne deutsche Endung im Wörterbuch zu finden
 */
function translateWithStemming(word) {
    const endings = ['en', 'er', 'es', 'em', 'e', 'n', 's', 'ung', 'heit', 'keit'];
    
    for (const ending of endings) {
        if (word.length > ending.length + 2 && word.endsWith(ending)) {
            const stem = word.substring(0, word.length - ending.length);
            if (DE_EN_DICTIONARY[stem]) {
                return DE_EN_DICTIONARY[stem];
            }
        }
    }
    
    return null;
}

/**
 * Versucht Übersetzung über LibreTranslate API (optional)
 * @param {string} text - Text zum Übersetzen
 * @returns {Promise<string|null>} - Übersetzter Text oder null bei Fehler
 */
async function translateWithApi(text) {
    if (!aiState.useApiTranslation || !aiState.translateApiUrl) {
        return null;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(aiState.translateApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text,
                source: 'de',
                target: 'en',
                format: 'text'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            if (data.translatedText) {
                console.log('🌐 API Translation:', text, '->', data.translatedText);
                return data.translatedText;
            }
        }
    } catch (e) {
        console.warn('⚠️ Translation API not available:', e.message);
    }
    
    return null;
}

/**
 * Hauptfunktion: Übersetzt Prompt wenn nötig
 * @param {string} prompt - Original Prompt
 * @returns {Promise<string>} - Übersetzter Prompt (oder Original wenn schon Englisch)
 */
export async function translatePrompt(prompt) {
    if (!aiState.translateEnabled || !prompt || prompt.trim().length === 0) {
        return prompt;
    }
    
    // Versuche zuerst API-Übersetzung (wenn aktiviert)
    if (aiState.useApiTranslation) {
        const apiTranslation = await translateWithApi(prompt);
        if (apiTranslation && apiTranslation !== prompt) {
            console.log('🌐 API translated:', prompt, '->', apiTranslation);
            aiState.lastTranslatedPrompt = apiTranslation;
            updateTranslationDebug(prompt, apiTranslation, 'API');
            return apiTranslation;
        }
    }
    
    // Wörterbuch-Übersetzung - IMMER versuchen
    const dictTranslation = translateWithDictionary(prompt);
    
    // Wenn sich was geändert hat, war es deutsch
    if (dictTranslation !== prompt) {
        console.log('📖 Dictionary translated:', prompt, '->', dictTranslation);
        aiState.lastTranslatedPrompt = dictTranslation;
        updateTranslationDebug(prompt, dictTranslation, 'Dictionary');
        return dictTranslation;
    }
    
    // Nichts geändert - war wohl schon englisch
    console.log('🇬🇧 No translation needed:', prompt);
    return prompt;
}

/**
 * Aktualisiert die Übersetzungs-Debug-Anzeige
 */
function updateTranslationDebug(original, translated, method) {
    const originalEl = document.getElementById('aiDebugOriginalPrompt');
    const translatedEl = document.getElementById('aiDebugTranslatedPrompt');
    const methodEl = document.getElementById('aiDebugTranslateMethod');
    
    if (originalEl) originalEl.textContent = original || '-';
    if (translatedEl) translatedEl.textContent = translated || '-';
    if (methodEl) methodEl.textContent = method || '-';
}

/**
 * Setter für Translation Settings
 */
export function setTranslateEnabled(enabled) {
    aiState.translateEnabled = enabled;
    console.log('🌐 Translation:', enabled ? 'enabled' : 'disabled');
}

export function setUseApiTranslation(enabled) {
    aiState.useApiTranslation = enabled;
    console.log('🌐 API Translation:', enabled ? 'enabled' : 'disabled');
}

export function setTranslateApiUrl(url) {
    aiState.translateApiUrl = url;
    console.log('🌐 Translate API URL:', url);
}

// ============================================
// COMFYUI CONNECTION
// ============================================

/**
 * Prüft Verbindung zu ComfyUI
 */
export async function checkComfyConnection() {
    console.log(`🔌 Checking ComfyUI connection at ${aiState.comfyUrl}...`);
    
    if (statusEl) {
        statusEl.textContent = '🔄 Connecting...';
        statusEl.style.color = '#ff0';
    }
    
    // Versuche beide Adressen
    const urlsToTry = [
        `http://127.0.0.1:${aiState.comfyPort}`,
        `http://localhost:${aiState.comfyPort}`
    ];
    
    for (const baseUrl of urlsToTry) {
        try {
            console.log(`🔌 Trying ${baseUrl}/system_stats...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${baseUrl}/system_stats`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`🔌 ${baseUrl} response status:`, response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ ComfyUI connected! System stats:', data);
                
                // Speichere funktionierende URL
                aiState.comfyUrl = baseUrl;
                aiState.connected = true;
                
                if (statusEl) {
                    statusEl.textContent = `✅ ComfyUI connected (${baseUrl.includes('127.0.0.1') ? '127.0.0.1' : 'localhost'})`;
                    statusEl.style.color = '#4f4';
                }
                
                // Lade verfügbare Checkpoints
                await loadAvailableCheckpoints();
                
                return true;
            }
        } catch (e) {
            console.warn(`⚠️ ${baseUrl} failed:`, e.name, e.message);
        }
    }
    
    // Beide fehlgeschlagen
    console.error('❌ ComfyUI connection failed on all addresses');
    
    aiState.connected = false;
    if (statusEl) {
        statusEl.textContent = `❌ ComfyUI not reachable on port ${aiState.comfyPort}`;
        statusEl.style.color = '#f66';
    }
    return false;
}

/**
 * Generiert ein Bild mit ComfyUI
 */
export async function generateImage(prompt) {
    if (!aiState.connected || aiState.generating) {
        console.log('Cannot generate: not connected or already generating');
        return null;
    }
    
    if (!prompt || prompt.trim() === '') {
        console.log('Cannot generate: empty prompt');
        return null;
    }
    
    aiState.generating = true;
    aiState.lastGeneratedPrompt = prompt;
    
    if (statusEl) {
        statusEl.textContent = '🎨 Generating...';
        statusEl.style.color = '#ff0';
    }
    
    // Workflow basierend auf Model (async wegen Übersetzung)
    const workflow = await createWorkflow(prompt, aiState.model);
    
    try {
        // Queue prompt
        const queueResponse = await fetch(`${aiState.comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (!queueResponse.ok) {
            const errorText = await queueResponse.text();
            console.error('ComfyUI Error Response:', errorText);
            
            // Parse error for better message
            let errorMsg = 'Failed to queue prompt';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMsg = errorJson.error.message;
                } else if (errorJson.node_errors) {
                    // Checkpoint not found error
                    const nodeErrors = Object.values(errorJson.node_errors);
                    if (nodeErrors.length > 0 && nodeErrors[0].errors) {
                        errorMsg = nodeErrors[0].errors.map(e => e.message).join(', ');
                    }
                }
            } catch (e) {
                errorMsg = errorText.substring(0, 100);
            }
            
            if (statusEl) {
                statusEl.textContent = `❌ ${errorMsg}`;
                statusEl.style.color = '#f66';
            }
            throw new Error(errorMsg);
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        // Poll for completion
        const imageUrl = await pollForCompletion(promptId);
        
        if (imageUrl) {
            console.log('✅ Image generated successfully!');
            console.log('🖼️ Image URL:', imageUrl);
            
            aiState.generating = false;
            if (statusEl) {
                statusEl.textContent = '✅ Image ready';
                statusEl.style.color = '#4f4';
            }
            
            // Buffer handling
            if (aiState.bufferMode && aiState.currentImage) {
                aiState.bufferImage = aiState.currentImage;
            }
            aiState.currentImage = imageUrl;
            
            displayImage(imageUrl);
            addToBuffer(imageUrl);
            return imageUrl;
        } else {
            console.warn('⚠️ pollForCompletion returned null - no image found');
        }
        
    } catch (e) {
        console.error('Generation error:', e);
        if (statusEl) {
            statusEl.textContent = '❌ Generation failed';
            statusEl.style.color = '#f66';
        }
    }
    
    aiState.generating = false;
    return null;
}

/**
 * Erstellt ComfyUI Workflow
 */
async function createWorkflow(prompt, model) {
    // Prompt mit aktiven Modifiern erweitern (inkl. Übersetzung)
    const enhancedPrompt = await buildEnhancedPrompt(prompt);
    
    // Verwende manuelle Settings aus aiState
    const steps = aiState.steps;
    const cfg = aiState.cfg;
    const sampler = aiState.sampler;
    const scheduler = (sampler.includes('euler') || sampler === 'ddim') ? 'normal' : 'karras';
    
    console.log(`🎨 Workflow: ${steps} steps, CFG ${cfg}, ${sampler}, ${scheduler}`);
    
    // Negative Prompt mit Anatomy-Erweiterung wenn aktiv
    let negativePrompt = 'ugly, blurry, bad quality, distorted';
    if (aiState.promptModifiers.anatomy) {
        negativePrompt += ', extra fingers, missing fingers, extra limbs, missing limbs, deformed hands, bad anatomy, disfigured, mutated';
    }
    
    // Dimensionen bestimmen
    let genDims, outputDims;
    if (aiState.upscaleEnabled) {
        // Kleine Generierungsauflösung
        genDims = getImageDimensions(aiState.generateResolution, model);
        outputDims = getImageDimensions(aiState.resolution, model);
        console.log(`🔍 Upscale: Generate ${genDims.width}x${genDims.height} → ${outputDims.width}x${outputDims.height}`);
    } else {
        genDims = getImageDimensions(aiState.resolution, model);
        outputDims = genDims;
    }
    
    // Basis-Workflow
    const workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": Math.floor(Math.random() * 1000000000),
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler,
                "scheduler": scheduler,
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": getCheckpointName(model)
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": genDims.width,
                "height": genDims.height,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": enhancedPrompt,
                "clip": ["4", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negativePrompt,
                "clip": ["4", 1]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            }
        }
    };
    
    // Upscale Node hinzufügen wenn aktiviert
    if (aiState.upscaleEnabled && (outputDims.width !== genDims.width || outputDims.height !== genDims.height)) {
        workflow["10"] = {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["8", 0],
                "upscale_method": aiState.upscaleMethod,
                "width": outputDims.width,
                "height": outputDims.height,
                "crop": "disabled"
            }
        };
        // SaveImage oder PreviewImage je nach Einstellung
        if (aiState.saveImages) {
            workflow["9"] = {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "synaesthesie",
                    "images": ["10", 0]
                }
            };
        } else {
            workflow["9"] = {
                "class_type": "PreviewImage",
                "inputs": {
                    "images": ["10", 0]
                }
            };
        }
    } else {
        // SaveImage oder PreviewImage je nach Einstellung
        if (aiState.saveImages) {
            workflow["9"] = {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "synaesthesie",
                    "images": ["8", 0]
                }
            };
        } else {
            workflow["9"] = {
                "class_type": "PreviewImage",
                "inputs": {
                    "images": ["8", 0]
                }
            };
        }
    }
    
    return workflow;
}

/**
 * Baut den erweiterten Prompt mit aktiven Modifiern und Instrument
 * Inkl. automatische Übersetzung von Deutsch nach Englisch
 */
async function buildEnhancedPrompt(basePrompt) {
    // Schritt 1: Übersetze den Basis-Prompt wenn nötig
    let translatedPrompt = basePrompt;
    if (aiState.translateEnabled) {
        translatedPrompt = await translatePrompt(basePrompt);
        if (translatedPrompt !== basePrompt) {
            console.log('🌐 Translated:', basePrompt, '->', translatedPrompt);
        }
    }
    
    const parts = [translatedPrompt];
    
    // Instrument hinzufügen wenn aktiviert
    const instrument = getInstrumentForPrompt();
    if (instrument) {
        parts.push(instrument);
        console.log('🎸 Added instrument to prompt:', instrument);
    }
    
    // Sammle aktive Modifier
    const activeModifiers = [];
    for (const [key, isActive] of Object.entries(aiState.promptModifiers)) {
        if (isActive && aiState.modifierTexts[key]) {
            parts.push(aiState.modifierTexts[key]);
            activeModifiers.push(aiState.modifierTexts[key]);
        }
    }
    
    const enhanced = parts.join(', ');
    
    // Zeige erweiterten Prompt in Console
    if (parts.length > 1) {
        console.log('📝 Enhanced prompt:', enhanced);
    }
    
    // NICHT die Debug UI aktualisieren - das macht refreshPromptDebug()
    // So wird die UI nicht mit alten Prompts überschrieben während Stream läuft
    
    return enhanced;
}

/**
 * Aktualisiert die Prompt-Debug-Anzeige
 * Zeigt die Pipeline: Input → Translation → Instrument → Modifiers → Final
 */
function updatePromptDebug(basePrompt, instrument, modifiers, finalPrompt, translatedPrompt = null) {
    const baseEl = document.getElementById('aiDebugBasePrompt');
    const translationRow = document.getElementById('aiTranslationRow');
    const translatedEl = document.getElementById('aiDebugTranslatedPrompt');
    const instrumentEl = document.getElementById('aiDebugInstrument');
    const modifiersEl = document.getElementById('aiDebugModifiers');
    const finalEl = document.getElementById('aiDebugFinalPrompt');
    const timestampEl = document.getElementById('aiDebugTimestamp');
    
    const hasInput = basePrompt && basePrompt.trim().length > 0;
    
    // Step 1: Input (original prompt, may be German)
    if (baseEl) {
        baseEl.textContent = hasInput ? basePrompt : '-';
        if (!hasInput) {
            baseEl.style.color = '#666'; // Grau = leer/inaktiv
        } else if (isGermanText(basePrompt)) {
            baseEl.style.color = '#ff8'; // Gelb = Deutsch
        } else {
            baseEl.style.color = '#8f8'; // Grün = Englisch
        }
    }
    
    // Step 2: Translation (nur sichtbar wenn übersetzt wurde)
    const wasTranslated = hasInput && translatedPrompt && translatedPrompt !== basePrompt;
    if (translationRow) {
        translationRow.style.display = wasTranslated ? 'flex' : 'none';
    }
    if (translatedEl) {
        translatedEl.textContent = wasTranslated ? translatedPrompt : '-';
    }
    
    // Step 3: Instrument
    if (instrumentEl) {
        instrumentEl.textContent = instrument || '(none)';
        instrumentEl.style.opacity = instrument ? '1' : '0.5';
    }
    
    // Step 4: Modifiers
    if (modifiersEl) {
        if (modifiers.length > 0) {
            const shortModifiers = modifiers.map(m => {
                if (m.length > 30) return m.substring(0, 27) + '...';
                return m;
            });
            modifiersEl.textContent = shortModifiers.join(' | ');
            modifiersEl.style.opacity = '1';
        } else {
            modifiersEl.textContent = '(none)';
            modifiersEl.style.opacity = '0.5';
        }
    }
    
    // Final Output - zeige '-' wenn kein Input vorhanden, 🌐 wenn übersetzt
    if (finalEl) {
        if (!hasInput) {
            finalEl.textContent = '-';
            finalEl.style.color = '#666';
        } else {
            // Zeige 🌐 Icon wenn übersetzt wurde
            const prefix = wasTranslated ? '🌐 ' : '';
            finalEl.textContent = prefix + (finalPrompt || '-');
            finalEl.style.color = wasTranslated ? '#4af' : '#4f4'; // Blau wenn übersetzt, grün sonst
        }
    }
    if (timestampEl) timestampEl.textContent = new Date().toLocaleTimeString();
}

/**
 * Exportierte Funktion zum manuellen Refresh der Debug-Anzeige
 * Zeigt den aktuellen Prompt-Stand inkl. letzter Übersetzung (falls vorhanden)
 */
export function refreshPromptDebug() {
    const basePrompt = promptInputEl?.value.trim() || aiState.currentPrompt || '';
    const instrument = getInstrumentForPrompt();
    
    const activeModifiers = [];
    for (const [key, isActive] of Object.entries(aiState.promptModifiers)) {
        if (isActive && aiState.modifierTexts[key]) {
            activeModifiers.push(aiState.modifierTexts[key]);
        }
    }
    
    // IMMER versuchen zu übersetzen - wenn sich was ändert, war es deutsch
    let translatedPrompt = null;
    if (aiState.translateEnabled && basePrompt) {
        const attempted = translateWithDictionary(basePrompt);
        // Wenn Übersetzung sich unterscheidet ODER leer ist (alles übersprungen), war es deutsch
        if (attempted !== basePrompt) {
            translatedPrompt = attempted;
            console.log('🌐 Translation preview:', basePrompt, '->', translatedPrompt);
        }
    }
    
    // Baue den finalen Prompt (mit übersetztem Text wenn vorhanden)
    const promptForFinal = translatedPrompt || basePrompt;
    const parts = [promptForFinal];
    if (instrument) parts.push(instrument);
    parts.push(...activeModifiers);
    const finalPrompt = parts.filter(p => p).join(', ');
    
    updatePromptDebug(basePrompt, instrument, activeModifiers, finalPrompt, translatedPrompt);
    
    return finalPrompt;
}

/**
 * Berechnet Bilddimensionen basierend auf Resolution
 * Resolution ist jetzt im Format "WxH" (z.B. "1920x1080") oder "custom"
 */
function getImageDimensions(resolution, model) {
    let width, height;
    
    // Custom Resolution
    if (resolution === 'custom') {
        width = aiState.customWidth;
        height = aiState.customHeight;
    } else {
        // Parse "WxH" Format
        const parts = resolution.split('x');
        if (parts.length === 2) {
            width = parseInt(parts[0]);
            height = parseInt(parts[1]);
        } else {
            // Fallback auf 1920x1080
            width = 1920;
            height = 1080;
        }
    }
    
    // Auf 64er-Grid runden (wichtig für Stable Diffusion)
    width = Math.round(width / 64) * 64;
    height = Math.round(height / 64) * 64;
    
    // Mindestgröße 64x64
    return {
        width: Math.max(64, width),
        height: Math.max(64, height)
    };
}

// Verfügbare Checkpoints (wird von ComfyUI geladen)
let availableCheckpoints = [];

/**
 * Lädt verfügbare Checkpoints von ComfyUI
 */
export async function loadAvailableCheckpoints() {
    try {
        const response = await fetch(`${aiState.comfyUrl}/object_info/CheckpointLoaderSimple`);
        if (response.ok) {
            const data = await response.json();
            const ckptInput = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name;
            if (ckptInput && Array.isArray(ckptInput[0])) {
                availableCheckpoints = ckptInput[0];
                console.log('Available checkpoints:', availableCheckpoints);
                updateCheckpointUI();
                return availableCheckpoints;
            }
        }
    } catch (e) {
        console.warn('Could not load checkpoints:', e);
    }
    return [];
}

/**
 * Aktualisiert Checkpoint-UI mit verfügbaren Modellen
 */
function updateCheckpointUI() {
    const selectEl = document.getElementById('comfyCheckpoint');
    if (!selectEl || availableCheckpoints.length === 0) return;
    
    selectEl.innerHTML = '';
    availableCheckpoints.forEach(ckpt => {
        const option = document.createElement('option');
        option.value = ckpt;
        option.textContent = ckpt.replace('.safetensors', '').replace('.ckpt', '');
        selectEl.appendChild(option);
    });
    
    // Setze aktuelles Modell
    const currentCkpt = getCheckpointName(aiState.model);
    if (availableCheckpoints.includes(currentCkpt)) {
        selectEl.value = currentCkpt;
    } else if (availableCheckpoints.length > 0) {
        selectEl.value = availableCheckpoints[0];
        aiState.customCheckpoint = availableCheckpoints[0];
    }
}

/**
 * Gibt Checkpoint-Name basierend auf Model zurück
 */
function getCheckpointName(model) {
    // Custom checkpoint hat Vorrang
    if (aiState.customCheckpoint) {
        return aiState.customCheckpoint;
    }
    
    // Defaults
    const defaults = {
        'local-sdxl': 'sd_xl_base_1.0.safetensors',
        'local-turbo': 'sd_turbo.safetensors',
        'local-sd15': 'v1-5-pruned-emaonly.safetensors'
    };
    
    const defaultCkpt = defaults[model] || defaults['local-sd15'];
    
    // Prüfe ob default verfügbar ist
    if (availableCheckpoints.length > 0 && !availableCheckpoints.includes(defaultCkpt)) {
        // Suche nach ähnlichem Namen
        const similar = availableCheckpoints.find(c => 
            c.toLowerCase().includes('sd15') || 
            c.toLowerCase().includes('v1-5') ||
            c.toLowerCase().includes('1.5')
        );
        if (similar) return similar;
        
        // Fallback: erstes verfügbares
        return availableCheckpoints[0];
    }
    
    return defaultCkpt;
}

/**
 * Pollt ComfyUI für Completion
 */
async function pollForCompletion(promptId, maxAttempts = 180) {
    console.log(`⏳ Polling for completion, promptId: ${promptId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 500));
        
        try {
            const historyResponse = await fetch(`${aiState.comfyUrl}/history/${promptId}`);
            if (!historyResponse.ok) continue;
            
            const history = await historyResponse.json();
            
            if (history[promptId] && history[promptId].outputs) {
                const outputs = history[promptId].outputs;
                
                // Finde SaveImage Output
                for (const nodeId of Object.keys(outputs)) {
                    if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                        const image = outputs[nodeId].images[0];
                        console.log('🖼️ Found image in outputs:', image);
                        
                        // URL zusammenbauen - subfolder kann leer sein
                        let imageUrl = `${aiState.comfyUrl}/view?filename=${encodeURIComponent(image.filename)}`;
                        if (image.subfolder) {
                            imageUrl += `&subfolder=${encodeURIComponent(image.subfolder)}`;
                        }
                        imageUrl += `&type=${image.type || 'output'}`;
                        
                        console.log('🖼️ Constructed image URL:', imageUrl);
                        return imageUrl;
                    }
                }
            }
        } catch (e) {
            console.warn(`Polling attempt ${i + 1} failed:`, e.message);
        }
        
        // Update status
        if (statusEl) {
            statusEl.textContent = `🎨 Generating... ${Math.round(((i + 1) / maxAttempts) * 100)}%`;
        }
    }
    
    console.warn('⚠️ Polling timed out after', maxAttempts, 'attempts');
    return null;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Zeigt Bild im Preview und/oder Overlay an
 */
function displayImage(imageUrl) {
    console.log('🖼️ displayImage called');
    
    // Preview - IMMER anzeigen wenn previewEl existiert
    if (previewEl) {
        previewEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.crossOrigin = 'anonymous';
        previewEl.appendChild(img);
    }
    
    // Overlay Canvas (wenn opacity > 0)
    if (aiState.overlayOpacity > 0 && overlayCanvas && overlayCtx) {
        
        // Prüfe ob Bild bereits im Preload-Cache ist
        if (preloadedImages.has(imageUrl)) {
            console.log('⚡ Using preloaded image (instant)');
            const cachedImg = preloadedImages.get(imageUrl);
            
            if (aiState.crossfadeEnabled && aiState.bufferImage) {
                crossfadeToImage(cachedImg);
            } else {
                drawImageToOverlay(cachedImg);
            }
            return;
        }
        
        // Nicht im Cache - muss geladen werden
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        
        // Pre-decode das Bild BEVOR wir es verwenden
        img.decode().then(() => {
            console.log('✅ Overlay image decoded');
            
            // ZUM CACHE HINZUFÜGEN für nächsten Crossfade!
            preloadedImages.set(imageUrl, img);
            
            // Cache-Größe begrenzen
            if (preloadedImages.size > 15) {
                const firstKey = preloadedImages.keys().next().value;
                preloadedImages.delete(firstKey);
            }
            
            if (aiState.crossfadeEnabled && aiState.bufferImage) {
                crossfadeToImage(img);
            } else {
                drawImageToOverlay(img);
            }
        }).catch((e) => {
            console.error('❌ Overlay image decode failed:', e);
            if (img.complete) {
                if (aiState.crossfadeEnabled && aiState.bufferImage) {
                    crossfadeToImage(img);
                } else {
                    drawImageToOverlay(img);
                }
            }
        });
    }
}

/**
 * Zeichnet Bild auf Overlay Canvas
 */
function drawImageToOverlay(img) {
    if (!overlayCanvas || !overlayCtx) return;
    
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Aspect-ratio erhaltend skalieren
    const scale = Math.min(
        overlayCanvas.width / img.width,
        overlayCanvas.height / img.height
    );
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (overlayCanvas.width - w) / 2;
    const y = (overlayCanvas.height - h) / 2;
    
    // Opacity aus State verwenden
    overlayCtx.globalAlpha = aiState.overlayOpacity / 100;
    overlayCtx.drawImage(img, x, y, w, h);
    overlayCtx.globalAlpha = 1;
}

/**
 * Crossfade zwischen zwei Bildern
 * Nutzt den Preload-Cache für sofortigen, ruckelfreien Übergang
 */
function crossfadeToImage(newImg, duration = 1000) {
    if (!overlayCanvas || !overlayCtx) return;
    
    const baseOpacity = aiState.overlayOpacity / 100;
    const oldImgUrl = aiState.bufferImage;
    
    // Cache für Dimensionen (wird einmal berechnet)
    let oldDims = null;
    let newDims = null;
    let oldImg = null;
    
    // Berechne Skalierung einmal
    function getScaledDimensions(img) {
        const scale = Math.min(
            overlayCanvas.width / img.width,
            overlayCanvas.height / img.height
        );
        return {
            w: img.width * scale,
            h: img.height * scale,
            x: (overlayCanvas.width - img.width * scale) / 2,
            y: (overlayCanvas.height - img.height * scale) / 2
        };
    }
    
    // Animation Loop
    let startTime = null;
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Easing für smootheren Übergang (ease-in-out)
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Altes Bild (fading out)
        if (oldDims && oldImg) {
            overlayCtx.globalAlpha = baseOpacity * (1 - easedProgress);
            overlayCtx.drawImage(oldImg, oldDims.x, oldDims.y, oldDims.w, oldDims.h);
        }
        
        // Neues Bild (fading in)
        if (newDims) {
            overlayCtx.globalAlpha = baseOpacity * easedProgress;
            overlayCtx.drawImage(newImg, newDims.x, newDims.y, newDims.w, newDims.h);
        }
        
        overlayCtx.globalAlpha = 1;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation fertig - aktuelles Bild für nächsten Crossfade speichern
            aiState.bufferImage = newImg.src;
        }
    }
    
    // Prüfe ob das alte Bild im Cache ist (INSTANT!)
    if (oldImgUrl && preloadedImages.has(oldImgUrl)) {
        console.log('⚡ Crossfade: Using cached old image (instant)');
        oldImg = preloadedImages.get(oldImgUrl);
        oldDims = getScaledDimensions(oldImg);
        newDims = getScaledDimensions(newImg);
        requestAnimationFrame(animate);
        return;
    }
    
    // Nicht im Cache - muss geladen werden (Fallback)
    if (oldImgUrl) {
        console.log('⏳ Crossfade: Loading old image (not cached)');
        oldImg = new Image();
        oldImg.crossOrigin = 'anonymous';
        oldImg.src = oldImgUrl;
        
        oldImg.decode().then(() => {
            oldDims = getScaledDimensions(oldImg);
            newDims = getScaledDimensions(newImg);
            // Zum Cache hinzufügen für nächstes Mal
            preloadedImages.set(oldImgUrl, oldImg);
            requestAnimationFrame(animate);
        }).catch(() => {
            // Ohne altes Bild starten
            newDims = getScaledDimensions(newImg);
            requestAnimationFrame(animate);
        });
    } else {
        // Kein altes Bild - nur neues einblenden
        newDims = getScaledDimensions(newImg);
        requestAnimationFrame(animate);
    }
}

/**
 * Aktualisiert Resolution-Anzeige
 */
function updateResolutionDisplay() {
    const displayEl = document.getElementById('aiResolutionDisplay');
    if (displayEl) {
        const dims = getImageDimensions(aiState.resolution, aiState.model);
        // Zeige auch gerundete Werte wenn sie sich unterscheiden
        const originalRes = aiState.resolution === 'custom' 
            ? `${aiState.customWidth}×${aiState.customHeight}` 
            : aiState.resolution.replace('x', '×');
        
        if (dims.width !== parseInt(originalRes.split('×')[0]) || 
            dims.height !== parseInt(originalRes.split('×')[1])) {
            displayEl.textContent = `${dims.width}×${dims.height}px (rounded)`;
            displayEl.style.color = '#ff8';
        } else {
            displayEl.textContent = `${dims.width}×${dims.height}px`;
            displayEl.style.color = '#888';
        }
    }
}

/**
 * Aktualisiert Buffer-Status Anzeige
 */
function updateBufferStatus() {
    const statusEl = document.getElementById('aiBufferStatus');
    if (statusEl) {
        statusEl.textContent = `Buffer: ${aiState.bufferImages.length}/${aiState.bufferSize}`;
    }
    updateBufferThumbnails();
}

/**
 * Aktualisiert Buffer-Thumbnails
 */
function updateBufferThumbnails() {
    if (!bufferThumbsEl) return;
    
    bufferThumbsEl.innerHTML = '';
    bufferThumbsEl.style.display = aiState.bufferMode ? 'flex' : 'none';
    bufferThumbsEl.style.flexWrap = 'wrap';
    bufferThumbsEl.style.gap = '2px';
    
    aiState.bufferImages.forEach((imgUrl, index) => {
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            width: 24px;
            height: 24px;
            background-image: url(${imgUrl});
            background-size: cover;
            background-position: center;
            border-radius: 2px;
            cursor: pointer;
            border: 1px solid ${index === aiState.bufferIndex ? '#4af' : '#333'};
        `;
        thumb.title = `Image ${index + 1}`;
        thumb.addEventListener('click', () => {
            aiState.bufferIndex = index;
            displayImage(imgUrl);
            updateBufferThumbnails();
        });
        bufferThumbsEl.appendChild(thumb);
    });
}

/**
 * Fügt Bild zum Buffer hinzu
 */
function addToBuffer(imageUrl) {
    if (!aiState.bufferMode) return;
    
    aiState.bufferImages.push(imageUrl);
    
    // Buffer-Größe begrenzen
    while (aiState.bufferImages.length > aiState.bufferSize) {
        aiState.bufferImages.shift();
    }
    
    aiState.bufferIndex = aiState.bufferImages.length - 1;
    updateBufferStatus();
}

/**
 * Aktualisiert Overlay-Sichtbarkeit basierend auf Opacity
 */
function updateOverlayVisibility() {
    if (!overlayCanvas) return;
    
    if (aiState.overlayOpacity > 0) {
        overlayCanvas.style.display = 'block';
        overlayCanvas.style.pointerEvents = 'none';
        
        // Aktuelles Bild neu zeichnen wenn vorhanden
        if (aiState.currentImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => drawImageToOverlay(img);
            img.src = aiState.currentImage;
        }
    } else {
        overlayCanvas.style.display = 'none';
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    }
}

// ============================================
// POST-PROCESSING UPSCALE (Lokal in App)
// ============================================

// Offscreen Canvas für Upscaling
let upscaleCanvas = null;
let upscaleCtx = null;

/**
 * Initialisiert das Upscale-Canvas
 */
function initUpscaleCanvas() {
    if (!upscaleCanvas) {
        upscaleCanvas = document.createElement('canvas');
        upscaleCtx = upscaleCanvas.getContext('2d');
    }
}

/**
 * Skaliert ein Bild lokal mit verschiedenen Methoden
 * @param {string} imageUrl - URL des Quellbilds
 * @param {number} targetWidth - Zielbreite
 * @param {number} targetHeight - Zielhöhe
 * @param {string} method - 'nearest', 'bilinear', 'bicubic', 'lanczos'
 * @param {number} sharpen - Schärfung 0-100
 * @returns {Promise<string>} - Data URL des skalierten Bilds
 */
export async function upscaleImage(imageUrl, targetWidth, targetHeight, method = 'lanczos', sharpen = 0) {
    initUpscaleCanvas();
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            console.log(`🔍 Upscaling ${img.width}x${img.height} → ${targetWidth}x${targetHeight} (${method})`);
            
            upscaleCanvas.width = targetWidth;
            upscaleCanvas.height = targetHeight;
            
            // Interpolations-Methode setzen
            switch (method) {
                case 'nearest':
                    upscaleCtx.imageSmoothingEnabled = false;
                    break;
                case 'bilinear':
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'low';
                    break;
                case 'bicubic':
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'medium';
                    break;
                case 'lanczos':
                default:
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'high';
                    break;
            }
            
            // Bild zeichnen
            upscaleCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
            
            // Schärfung anwenden wenn gewünscht
            if (sharpen > 0) {
                applySharpen(upscaleCtx, targetWidth, targetHeight, sharpen / 100);
            }
            
            // Als Data URL zurückgeben
            const dataUrl = upscaleCanvas.toDataURL('image/png');
            console.log(`✅ Upscale complete`);
            resolve(dataUrl);
        };
        
        img.onerror = (e) => {
            console.error('❌ Failed to load image for upscaling:', e);
            reject(e);
        };
        
        img.src = imageUrl;
    });
}

/**
 * Wendet Schärfung auf das Canvas an (Unsharp Mask)
 */
function applySharpen(ctx, width, height, amount) {
    if (amount <= 0) return;
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    
    // Schärfungskernel (Laplace)
    const strength = amount * 0.5; // 0-0.5 Bereich
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            for (let c = 0; c < 3; c++) { // RGB, nicht Alpha
                const center = copy[idx + c];
                const neighbors = (
                    copy[((y - 1) * width + x) * 4 + c] +
                    copy[((y + 1) * width + x) * 4 + c] +
                    copy[(y * width + x - 1) * 4 + c] +
                    copy[(y * width + x + 1) * 4 + c]
                ) / 4;
                
                const sharpened = center + (center - neighbors) * strength;
                data[idx + c] = Math.max(0, Math.min(255, sharpened));
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

/**
 * Skaliert das aktuelle Bild und zeigt es an
 */
export async function upscaleCurrentImage() {
    if (!aiState.currentImage) {
        console.warn('No image to upscale');
        return null;
    }
    
    const [targetW, targetH] = aiState.postUpscaleTarget.split('x').map(Number);
    
    if (statusEl) {
        statusEl.textContent = '🔍 Upscaling...';
        statusEl.style.color = '#ff0';
    }
    
    try {
        const upscaledUrl = await upscaleImage(
            aiState.currentImage,
            targetW,
            targetH,
            aiState.postUpscaleMethod,
            aiState.postUpscaleSharpen
        );
        
        // Upscaled Bild anzeigen
        displayImage(upscaledUrl);
        
        // Optional: Im Buffer ersetzen
        if (aiState.bufferMode && aiState.bufferImages.length > 0) {
            aiState.bufferImages[aiState.bufferIndex] = upscaledUrl;
            updateBufferThumbnails();
        }
        
        aiState.currentImage = upscaledUrl;
        
        if (statusEl) {
            statusEl.textContent = `✅ Upscaled to ${targetW}×${targetH}`;
            statusEl.style.color = '#4f4';
        }
        
        return upscaledUrl;
        
    } catch (e) {
        console.error('Upscale failed:', e);
        if (statusEl) {
            statusEl.textContent = '❌ Upscale failed';
            statusEl.style.color = '#f66';
        }
        return null;
    }
}

/**
 * Skaliert alle Bilder im Buffer
 */
export async function upscaleBuffer() {
    if (aiState.bufferImages.length === 0) {
        console.warn('Buffer is empty');
        return;
    }
    
    const [targetW, targetH] = aiState.postUpscaleTarget.split('x').map(Number);
    const total = aiState.bufferImages.length;
    
    console.log(`🔍 Upscaling ${total} images in buffer...`);
    
    for (let i = 0; i < total; i++) {
        if (statusEl) {
            statusEl.textContent = `🔍 Upscaling ${i + 1}/${total}...`;
            statusEl.style.color = '#ff0';
        }
        
        try {
            const upscaledUrl = await upscaleImage(
                aiState.bufferImages[i],
                targetW,
                targetH,
                aiState.postUpscaleMethod,
                aiState.postUpscaleSharpen
            );
            
            aiState.bufferImages[i] = upscaledUrl;
            
        } catch (e) {
            console.error(`Failed to upscale image ${i + 1}:`, e);
        }
    }
    
    // Aktuelles Bild aktualisieren
    aiState.currentImage = aiState.bufferImages[aiState.bufferIndex];
    displayImage(aiState.currentImage);
    updateBufferThumbnails();
    
    if (statusEl) {
        statusEl.textContent = `✅ Upscaled ${total} images`;
        statusEl.style.color = '#4f4';
    }
    
    console.log(`✅ Buffer upscale complete`);
}

// ============================================
// CONTINUOUS GENERATION
// ============================================

/**
 * Startet kontinuierliche Bildgenerierung bis Buffer voll
 */
export async function startContinuousGeneration(prompt) {
    if (!prompt || prompt.trim() === '') {
        console.warn('Cannot start continuous generation: no prompt');
        return;
    }
    
    if (!aiState.connected) {
        console.warn('Cannot start continuous generation: not connected');
        return;
    }
    
    aiState.continuousGen = true;
    continuousGenActive = true;
    console.log(`🔄 Starting continuous generation for ${aiState.bufferSize} images`);
    
    updateContinuousGenUI();
    
    while (continuousGenActive && aiState.bufferImages.length < aiState.bufferSize) {
        if (aiState.generating) {
            await new Promise(r => setTimeout(r, 500));
            continue;
        }
        
        const result = await generateImage(prompt);
        
        if (!result) {
            console.warn('Generation failed, stopping continuous gen');
            break;
        }
        
        // Status Update
        updateBufferStatus();
        
        // Kleine Pause zwischen Generierungen
        await new Promise(r => setTimeout(r, 100));
    }
    
    continuousGenActive = false;
    aiState.continuousGen = false;
    console.log(`✅ Continuous generation complete: ${aiState.bufferImages.length} images`);
    updateContinuousGenUI();
}

/**
 * Stoppt kontinuierliche Generierung
 */
export function stopContinuousGeneration() {
    continuousGenActive = false;
    aiState.continuousGen = false;
    console.log('⏹ Continuous generation stopped');
    updateContinuousGenUI();
}

/**
 * Aktualisiert UI für Continuous Gen
 */
function updateContinuousGenUI() {
    const btn = document.getElementById('aiContinuousGenBtn');
    if (btn) {
        if (aiState.continuousGen) {
            btn.textContent = '⏹ Stop';
            btn.style.background = '#a33';
        } else {
            btn.textContent = '🔄 Fill Buffer';
            btn.style.background = '';
        }
    }
}

// ============================================
// STREAM MODE (Continuous Output without Storage)
// ============================================

/**
 * Startet Stream Mode - generiert endlos ohne zu speichern
 * Jedes Bild wird sofort angezeigt und dann verworfen
 * @param {string} prompt - Der zu verwendende Prompt
 */
export async function startStreamMode(prompt) {
    if (!prompt || prompt.trim() === '') {
        console.warn('Cannot start stream mode: no prompt');
        return;
    }
    
    if (!aiState.connected) {
        console.warn('Cannot start stream mode: not connected');
        return;
    }
    
    // Stop andere Modi
    stopPlayback();
    stopContinuousGeneration();
    
    aiState.streamMode = true;
    streamModeActive = true;
    streamImageCount = 0;
    streamStartTime = Date.now();
    
    console.log(`📡 Starting Stream Mode (no buffer)`);
    updateStreamModeUI();
    
    while (streamModeActive) {
        if (aiState.generating) {
            await new Promise(r => setTimeout(r, 200));
            continue;
        }
        
        // Generiere Bild direkt ohne Buffer
        const result = await generateImageStream(prompt);
        
        if (!result) {
            console.warn('Stream generation failed, retrying...');
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }
        
        streamImageCount++;
        updateStreamStatus();
        
        // Optionale Pause zwischen Generierungen
        if (aiState.streamPause > 0) {
            await new Promise(r => setTimeout(r, aiState.streamPause));
        }
    }
    
    aiState.streamMode = false;
    console.log(`⏹ Stream Mode stopped. Generated ${streamImageCount} images.`);
    updateStreamModeUI();
}

/**
 * Generiert ein Bild für Stream Mode (ohne Buffer-Speicherung)
 */
async function generateImageStream(prompt) {
    if (!aiState.connected || aiState.generating) {
        return null;
    }
    
    aiState.generating = true;
    aiState.lastGeneratedPrompt = prompt;
    
    if (statusEl) {
        statusEl.textContent = `📡 Streaming #${streamImageCount + 1}...`;
        statusEl.style.color = '#4af';
    }
    
    const workflow = await createWorkflow(prompt, aiState.model);
    
    try {
        const queueResponse = await fetch(`${aiState.comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (!queueResponse.ok) {
            throw new Error('Failed to queue prompt');
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        const imageUrl = await pollForCompletion(promptId);
        
        if (imageUrl) {
            aiState.generating = false;
            
            // Nur anzeigen, NICHT in Buffer speichern
            // Vorheriges Bild für Crossfade merken
            if (aiState.crossfadeEnabled) {
                aiState.bufferImage = aiState.currentImage;
            }
            aiState.currentImage = imageUrl;
            
            displayImage(imageUrl);
            return imageUrl;
        }
        
    } catch (e) {
        console.error('Stream generation error:', e);
    }
    
    aiState.generating = false;
    return null;
}

/**
 * Stoppt Stream Mode
 */
export function stopStreamMode() {
    streamModeActive = false;
    aiState.streamMode = false;
    console.log('⏹ Stream Mode stopped');
    updateStreamModeUI();
}

/**
 * Toggle Stream Mode
 */
export function toggleStreamMode() {
    if (aiState.streamMode) {
        stopStreamMode();
    } else {
        const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
        if (prompt) {
            startStreamMode(prompt);
        } else {
            alert('Bitte gib zuerst einen Prompt ein!');
        }
    }
}

/**
 * Aktualisiert Stream Mode UI
 */
function updateStreamModeUI() {
    const btn = document.getElementById('aiStreamModeBtn');
    if (btn) {
        if (aiState.streamMode) {
            btn.textContent = '⏹ Stop Stream';
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg, #f44, #a22)';
        } else {
            btn.textContent = '📡 Stream';
            btn.classList.remove('active');
            btn.style.background = '';
        }
    }
}

/**
 * Aktualisiert Stream Status Anzeige
 */
function updateStreamStatus() {
    const elapsed = (Date.now() - streamStartTime) / 1000;
    const fps = streamImageCount / elapsed;
    const avgTime = elapsed / streamImageCount;
    
    const streamStatusEl = document.getElementById('aiStreamStatus');
    if (streamStatusEl) {
        streamStatusEl.textContent = `#${streamImageCount} | ${avgTime.toFixed(1)}s/img | ${fps.toFixed(2)} fps`;
        streamStatusEl.style.color = '#4af';
    }
    
    if (statusEl) {
        statusEl.textContent = `📡 Stream: #${streamImageCount}`;
        statusEl.style.color = '#4af';
    }
}

/**
 * Setzt Stream Pause
 */
export function setStreamPause(ms) {
    aiState.streamPause = Math.max(0, ms);
    console.log(`Stream pause set to ${ms}ms`);
}

// ============================================
// BUFFER PLAYBACK
// ============================================

/**
 * Startet Buffer-Wiedergabe
 */
export function startPlayback() {
    if (aiState.bufferImages.length === 0) {
        console.warn('Cannot start playback: buffer empty');
        return;
    }
    
    aiState.playbackActive = true;
    console.log(`▶ Starting playback at ${aiState.playbackSpeed}ms interval`);
    
    // ALLE Buffer-Bilder preloaden für flüssiges Crossfade!
    preloadAllBufferImages();
    
    // Erstes Bild sofort zeigen
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    
    // Timer starten
    playbackTimer = setInterval(() => {
        nextBufferImage();
    }, aiState.playbackSpeed);
    
    updatePlaybackUI();
}

/**
 * Preloaded ALLE Bilder im Buffer für ruckelfreies Playback
 */
function preloadAllBufferImages() {
    const total = aiState.bufferImages.length;
    console.log(`📦 Preloading ${total} buffer images...`);
    
    let loaded = 0;
    
    aiState.bufferImages.forEach((url) => {
        if (preloadedImages.has(url)) {
            loaded++;
            return;
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        
        img.decode().then(() => {
            preloadedImages.set(url, img);
            loaded++;
            if (loaded === total) {
                console.log(`✅ All ${total} buffer images preloaded!`);
            }
        }).catch(() => {
            loaded++;
        });
    });
}

/**
 * Stoppt Buffer-Wiedergabe
 */
export function stopPlayback() {
    aiState.playbackActive = false;
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
    console.log('⏸ Playback stopped');
    updatePlaybackUI();
}

/**
 * Toggle Playback
 */
export function togglePlayback() {
    if (aiState.playbackActive) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

/**
 * Nächstes Bild im Buffer
 */
export function nextBufferImage() {
    if (aiState.bufferImages.length === 0) return;
    
    if (aiState.bufferShuffle) {
        // Random
        aiState.bufferIndex = Math.floor(Math.random() * aiState.bufferImages.length);
    } else {
        // Sequential
        aiState.bufferIndex++;
        if (aiState.bufferIndex >= aiState.bufferImages.length) {
            if (aiState.bufferLoop) {
                aiState.bufferIndex = 0;
            } else {
                aiState.bufferIndex = aiState.bufferImages.length - 1;
                stopPlayback();
                return;
            }
        }
    }
    
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    updateBufferThumbnails();
    
    // Preload nächstes Bild für flüssigen Übergang
    preloadNextImage();
}

/**
 * Preloaded das nächste Bild im Buffer
 */
function preloadNextImage() {
    if (aiState.bufferImages.length <= 1) return;
    
    // Nächster Index berechnen
    let nextIndex;
    if (aiState.bufferShuffle) {
        // Bei Shuffle: Alle nicht-gecachten Bilder preloaden
        for (let i = 0; i < Math.min(3, aiState.bufferImages.length); i++) {
            const randomIndex = Math.floor(Math.random() * aiState.bufferImages.length);
            preloadImageUrl(aiState.bufferImages[randomIndex]);
        }
        return;
    } else {
        nextIndex = (aiState.bufferIndex + 1) % aiState.bufferImages.length;
    }
    
    const nextUrl = aiState.bufferImages[nextIndex];
    preloadImageUrl(nextUrl);
}

/**
 * Preloaded ein Bild und speichert es dekodiert im Cache
 */
function preloadImageUrl(url) {
    if (!url || preloadedImages.has(url)) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    img.decode().then(() => {
        preloadedImages.set(url, img);
        console.log('💾 Preloaded image:', url.substring(0, 50) + '...');
        
        // Cache auf max 10 Bilder begrenzen
        if (preloadedImages.size > 10) {
            const firstKey = preloadedImages.keys().next().value;
            preloadedImages.delete(firstKey);
        }
    }).catch((e) => {
        // Silently ignore preload failures
        console.debug('Preload failed:', url.substring(0, 30));
    });
}

/**
 * Vorheriges Bild im Buffer
 */
export function prevBufferImage() {
    if (aiState.bufferImages.length === 0) return;
    
    aiState.bufferIndex--;
    if (aiState.bufferIndex < 0) {
        if (aiState.bufferLoop) {
            aiState.bufferIndex = aiState.bufferImages.length - 1;
        } else {
            aiState.bufferIndex = 0;
        }
    }
    
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    updateBufferThumbnails();
}

/**
 * Setzt Playback-Geschwindigkeit
 */
export function setPlaybackSpeed(ms) {
    aiState.playbackSpeed = ms;
    console.log(`Playback speed set to ${ms}ms`);
    
    // Timer neu starten wenn aktiv
    if (aiState.playbackActive) {
        clearInterval(playbackTimer);
        playbackTimer = setInterval(() => {
            nextBufferImage();
        }, aiState.playbackSpeed);
    }
}

/**
 * Aktualisiert Playback-UI
 */
function updatePlaybackUI() {
    const playBtn = document.getElementById('aiPlaybackBtn');
    if (playBtn) {
        if (aiState.playbackActive) {
            playBtn.textContent = '⏸';
            playBtn.title = 'Pause';
        } else {
            playBtn.textContent = '▶';
            playBtn.title = 'Play';
        }
    }
}

/**
 * Löscht alle Bilder im Buffer
 */
export function clearBuffer() {
    stopPlayback();
    aiState.bufferImages = [];
    aiState.bufferIndex = 0;
    aiState.currentImage = null;
    aiState.bufferImage = null;
    updateBufferStatus();
    
    // Preview leeren
    if (previewEl) {
        previewEl.innerHTML = '<span class="placeholder">No Image</span>';
    }
    
    // Overlay leeren
    if (overlayCtx && overlayCanvas) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    
    console.log('🗑 Buffer cleared');
}

// ============================================
// AUTO-GENERATION & SPEECH BUFFER
// ============================================

/**
 * Aktualisiert Prompt von Speech Input
 * - Überschreibt den Buffer bei jedem neuen Input
 * - Cleared automatisch nach X Sekunden Stille
 */
export function updateFromSpeech(rawText, filteredText) {
    const textToUse = filteredText || rawText;
    
    if (!textToUse || textToUse.trim() === '') {
        return;
    }
    
    // Neue Wörter extrahieren
    const newWords = textToUse.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (newWords.length === 0) {
        return;
    }
    
    // Timestamp aktualisieren
    speechLastUpdate = Date.now();
    
    // Buffer KOMPLETT ÜBERSCHREIBEN (nicht akkumulieren)
    speechBuffer = [...newWords];
    
    // Zur Wordcloud hinzufügen (sammelt weiterhin alle Wörter)
    for (const word of newWords) {
        addToWordcloud(word);
    }
    
    // Aktuellen Prompt aus Buffer erstellen
    const bufferedPrompt = speechBuffer.join(' ');
    aiState.currentPrompt = bufferedPrompt;
    
    // UI aktualisieren
    if (currentInputEl) {
        const displayText = speechBuffer.length > 0 
            ? `🎙️ [${speechBuffer.length}] ${bufferedPrompt}`
            : '🎙️ -';
        currentInputEl.textContent = displayText;
        currentInputEl.style.color = '#4f4'; // Grün = aktiv
    }
    
    if (promptInputEl && bufferedPrompt) {
        promptInputEl.value = bufferedPrompt;
    }
    
    // Debug Panel aktualisieren
    refreshPromptDebug();
    
    // Auto-Clear Timer zurücksetzen
    clearTimeout(speechBufferTimer);
    speechBufferTimer = setTimeout(() => {
        clearSpeechBuffer();
    }, speechBufferTimeout);
    
    // Auto-Generate Timer reset (nur wenn Buffer gefüllt)
    if (aiState.autoGenerate && bufferedPrompt.length > 3) {
        clearTimeout(autoGenTimer);
        autoGenTimer = setTimeout(() => {
            if (aiState.autoGenerate && aiState.connected && !aiState.generating) {
                // Generiere mit aktuellem Buffer-Inhalt
                const promptToGenerate = aiState.currentPrompt;
                if (promptToGenerate && promptToGenerate.length > 3) {
                    generateImage(promptToGenerate);
                }
            }
        }, AUTO_GEN_DELAY);
    }
    
    // Mini AI Auto-Mode: Schnelle Vorschau generieren
    if (miniAiState.autoMode && bufferedPrompt.length > 2 && !miniAiState.generating) {
        generateMiniImage(bufferedPrompt);
    }
    
    console.log(`🗣️ Speech Buffer [${speechBuffer.length}]: "${bufferedPrompt}"`);
}

/**
 * Leert den Speech-Buffer
 */
export function clearSpeechBuffer() {
    speechBuffer = [];
    speechLastUpdate = 0;
    
    // UI zurücksetzen
    if (currentInputEl) {
        currentInputEl.textContent = '🎙️ -';
        currentInputEl.style.color = '#888'; // Grau = leer
    }
    
    // Prompt Input NICHT leeren - nur den Live-Feed
    // aiState.currentPrompt bleibt erhalten für manuelles Generieren
    
    console.log('🗑️ Speech Buffer cleared');
}

/**
 * Setzt die Speech-Buffer Timeout-Zeit
 */
export function setSpeechBufferTimeout(ms) {
    speechBufferTimeout = Math.max(1000, Math.min(10000, ms));
    console.log(`⏱️ Speech Buffer Timeout: ${speechBufferTimeout}ms`);
}

/**
 * Gibt den aktuellen Speech-Buffer zurück
 */
export function getSpeechBuffer() {
    return [...speechBuffer];
}

// ============================================
// WORDCLOUD
// ============================================

/**
 * Fügt Wort zur Wordcloud hinzu
 */
function addToWordcloud(word) {
    const wordLower = word.toLowerCase();
    const now = Date.now();
    
    if (wordcloudWords[wordLower]) {
        wordcloudWords[wordLower].count++;
        wordcloudWords[wordLower].lastSeen = now;
    } else {
        wordcloudWords[wordLower] = {
            original: word,
            count: 1,
            lastSeen: now
        };
    }
    
    renderWordcloud();
}

/**
 * Rendert die Wordcloud
 */
function renderWordcloud() {
    if (!wordcloudContainer) {
        wordcloudContainer = document.getElementById('wordcloudContainer');
    }
    if (!wordcloudContainer) return;
    
    // Sortiere nach Häufigkeit
    const sorted = Object.entries(wordcloudWords)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30); // Max 30 Wörter
    
    if (sorted.length === 0) {
        wordcloudContainer.innerHTML = '<span style="color: #444; font-size: 8px; font-style: italic;">Warte auf Speech...</span>';
        return;
    }
    
    // Max count für Skalierung
    const maxCount = Math.max(...sorted.map(([_, data]) => data.count));
    
    // Farben basierend auf Aktualität
    const now = Date.now();
    
    wordcloudContainer.innerHTML = '';
    
    sorted.forEach(([wordLower, data]) => {
        const span = document.createElement('span');
        span.className = 'wordcloud-word';
        span.textContent = data.original;
        span.dataset.word = data.original;
        
        // Größe basierend auf Häufigkeit (8-18px)
        const size = 8 + (data.count / maxCount) * 10;
        span.style.fontSize = size + 'px';
        
        // Farbe basierend auf Aktualität (grün = neu, grau = alt)
        const age = now - data.lastSeen;
        if (age < 2000) {
            span.style.color = '#4f4'; // Grün = gerade erkannt
            span.style.textShadow = '0 0 4px #4f4';
        } else if (age < 10000) {
            span.style.color = '#ff0'; // Gelb = vor kurzem
        } else {
            span.style.color = '#888'; // Grau = älter
        }
        
        // Opacity basierend auf count
        span.style.opacity = 0.5 + (data.count / maxCount) * 0.5;
        
        // Klick -> zum Prompt hinzufügen
        span.addEventListener('click', () => {
            addWordToPrompt(data.original);
            // Visuelles Feedback
            span.style.transform = 'scale(1.3)';
            span.style.color = '#4af';
            setTimeout(() => {
                span.style.transform = '';
            }, 200);
        });
        
        // Doppelklick -> Wort entfernen
        span.addEventListener('dblclick', (e) => {
            e.preventDefault();
            removeFromWordcloud(wordLower);
        });
        
        wordcloudContainer.appendChild(span);
    });
}

/**
 * Fügt Wort zum Prompt Input hinzu
 */
function addWordToPrompt(word) {
    if (!promptInputEl) return;
    
    const currentPrompt = promptInputEl.value.trim();
    if (currentPrompt) {
        // Prüfe ob Wort bereits im Prompt
        const words = currentPrompt.toLowerCase().split(/\s+/);
        if (!words.includes(word.toLowerCase())) {
            promptInputEl.value = currentPrompt + ' ' + word;
        }
    } else {
        promptInputEl.value = word;
    }
    
    aiState.currentPrompt = promptInputEl.value;
    refreshPromptDebug();
    console.log('☁️ Added to prompt:', word);
}

/**
 * Entfernt Wort aus Wordcloud
 */
function removeFromWordcloud(wordLower) {
    delete wordcloudWords[wordLower];
    renderWordcloud();
    console.log('🗑 Removed from wordcloud:', wordLower);
}

/**
 * Leert die Wordcloud komplett
 */
export function clearWordcloud() {
    wordcloudWords = {};
    renderWordcloud();
    console.log('🗑 Wordcloud cleared');
}

// ============================================
// MINI AI (128x128 Quick Preview)
// ============================================

/**
 * Generiert ein Mini-Bild (128x128) für schnelle Vorschau
 */
export async function generateMiniImage(prompt) {
    if (!aiState.connected || miniAiState.generating) {
        console.log('Mini AI: Cannot generate');
        return null;
    }
    
    if (!prompt || prompt.trim() === '') {
        prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
    }
    
    if (!prompt) {
        console.log('Mini AI: No prompt');
        return null;
    }
    
    miniAiState.generating = true;
    miniAiState.lastPrompt = prompt;
    const startTime = Date.now();
    
    if (miniAiStatusEl) {
        miniAiStatusEl.textContent = '🎨 Generating...';
        miniAiStatusEl.style.color = '#ff0';
    }
    
    // Seed generieren
    const seed = Math.floor(Math.random() * 1000000000);
    miniAiState.lastSeed = seed;
    
    // Mini Workflow (128x128, minimal steps)
    const workflow = createMiniWorkflow(prompt, seed);
    
    try {
        const queueResponse = await fetch(`${aiState.comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (!queueResponse.ok) {
            throw new Error('Failed to queue mini prompt');
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        // Poll for completion (shorter timeout for mini)
        const imageUrl = await pollForCompletion(promptId, 60);
        
        if (imageUrl) {
            const elapsed = Date.now() - startTime;
            miniAiState.lastImage = imageUrl;
            miniAiState.generating = false;
            
            // Preview aktualisieren
            if (miniAiPreviewEl) {
                miniAiPreviewEl.innerHTML = '';
                const img = document.createElement('img');
                img.src = imageUrl;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.crossOrigin = 'anonymous';
                miniAiPreviewEl.appendChild(img);
            }
            
            if (miniAiStatusEl) {
                miniAiStatusEl.textContent = '✅ Ready';
                miniAiStatusEl.style.color = '#4f4';
            }
            
            if (miniAiTimeEl) {
                miniAiTimeEl.textContent = `${(elapsed / 1000).toFixed(1)}s | Seed: ${seed}`;
            }
            
            console.log(`🖼️ Mini AI: ${elapsed}ms, seed ${seed}`);
            return imageUrl;
        }
        
    } catch (e) {
        console.error('Mini AI error:', e);
        if (miniAiStatusEl) {
            miniAiStatusEl.textContent = '❌ Error';
            miniAiStatusEl.style.color = '#f44';
        }
    }
    
    miniAiState.generating = false;
    return null;
}

/**
 * Erstellt Mini-Workflow (128x128, 1-2 steps)
 */
function createMiniWorkflow(prompt, seed) {
    // Einfacher Prompt ohne Modifier für Speed
    const negativePrompt = 'ugly, blurry';
    
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 1,
                "cfg": 1,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": getCheckpointName(aiState.model)
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": 128,
                "height": 128,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["4", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negativePrompt,
                "clip": ["4", 1]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            }
        },
        "9": {
            "class_type": "PreviewImage",
            "inputs": {
                "images": ["8", 0]
            }
        }
    };
}

/**
 * Generiert Hauptbild mit dem Seed vom Mini AI
 */
export async function generateFromMiniSeed() {
    if (!miniAiState.lastSeed || !miniAiState.lastPrompt) {
        console.warn('No mini seed available');
        return;
    }
    
    // Setze den Seed manuell im nächsten Generate
    console.log(`🎲 Using mini seed: ${miniAiState.lastSeed}`);
    
    // Kopiere Seed in Clipboard
    try {
        await navigator.clipboard.writeText(miniAiState.lastSeed.toString());
        if (miniAiTimeEl) {
            const original = miniAiTimeEl.textContent;
            miniAiTimeEl.textContent = '✅ Seed copied!';
            setTimeout(() => {
                miniAiTimeEl.textContent = original;
            }, 1000);
        }
    } catch (e) {
        console.error('Copy failed:', e);
    }
}

/**
 * Sendet Mini-Bild an Haupt-Preview
 */
export function miniToMain() {
    if (!miniAiState.lastImage) {
        console.warn('No mini image available');
        return;
    }
    
    // Zeige Mini-Bild im Haupt-Preview
    aiState.currentImage = miniAiState.lastImage;
    displayImage(miniAiState.lastImage);
    
    console.log('↗️ Mini image sent to main');
}

/**
 * Toggle Mini AI Auto-Mode
 */
export function toggleMiniAiAuto() {
    miniAiState.autoMode = !miniAiState.autoMode;
    
    const btn = document.getElementById('miniAiAuto');
    if (btn) {
        if (miniAiState.autoMode) {
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg, #f80, #a40)';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
        }
    }
    
    console.log('Mini AI Auto:', miniAiState.autoMode ? 'ON' : 'OFF');
}

// ============================================
// SETTERS
// ============================================

export function setOverlayOpacity(opacity) {
    aiState.overlayOpacity = Math.max(0, Math.min(100, opacity));
    updateOverlayVisibility();
}

export function setProvider(provider) {
    aiState.provider = provider;
}

export function setModel(model) {
    aiState.model = model;
}

export function setResolution(resolution) {
    aiState.resolution = resolution;
    console.log(`AI Resolution set to: ${resolution}`);
}

/**
 * Setzt den ComfyUI Port und aktualisiert die URL
 */
export function setComfyPort(port) {
    aiState.comfyPort = port;
    aiState.comfyUrl = `http://localhost:${port}`;
    console.log(`ComfyUI Port set to: ${port}`);
    
    // Status aktualisieren
    if (statusEl) {
        statusEl.textContent = `🖥️ Connecting to localhost:${port}`;
        statusEl.style.color = '#888';
    }
    
    // Verbindung prüfen
    checkComfyConnection();
}

export function setAutoGenerate(enabled) {
    aiState.autoGenerate = enabled;
    if (!enabled) {
        clearTimeout(autoGenTimer);
    }
}

export function setBufferMode(enabled) {
    aiState.bufferMode = enabled;
}

export function setCrossfadeEnabled(enabled) {
    aiState.crossfadeEnabled = enabled;
}

export function setFilterNouns(enabled) {
    aiState.filterNouns = enabled;
}

export function setFilterVerbs(enabled) {
    aiState.filterVerbs = enabled;
}

export function setFilterAdj(enabled) {
    aiState.filterAdj = enabled;
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initAiUI() {
    // Get Elements
    previewEl = document.getElementById('aiImagePreview');
    statusEl = document.getElementById('localSdStatus');
    bufferStatusEl = document.getElementById('aiModelBufferStatus');
    bufferSettingsEl = document.getElementById('aiBufferSettings');
    bufferThumbsEl = document.getElementById('aiBufferThumbs');
    currentInputEl = document.getElementById('aiCurrentInput');
    promptInputEl = document.getElementById('aiPromptInput');
    overlayCanvas = document.getElementById('aiOverlayCanvas');
    
    if (overlayCanvas) {
        overlayCtx = overlayCanvas.getContext('2d');
        // Resize to match window
        overlayCanvas.width = window.innerWidth;
        overlayCanvas.height = window.innerHeight;
        overlayCanvas.style.display = 'none';
    }
    
    // Overlay Opacity Slider
    const overlayOpacitySlider = document.getElementById('aiOverlayOpacity');
    const overlayOpacityValue = document.getElementById('aiOverlayOpacityValue');
    if (overlayOpacitySlider) {
        overlayOpacitySlider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value);
            setOverlayOpacity(opacity);
            if (overlayOpacityValue) overlayOpacityValue.textContent = opacity + '%';
        });
    }
    
    // Provider Tabs (falls vorhanden)
    document.querySelectorAll('.ai-provider-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ai-provider-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            setProvider(tab.dataset.provider);
            
            // Show/hide model groups
            document.querySelectorAll('.ai-model-group').forEach(g => {
                g.style.display = g.dataset.provider === tab.dataset.provider ? 'block' : 'none';
            });
        });
    });
    
    // Resolution Select
    const resolutionSelect = document.getElementById('aiResolutionSelect');
    const customResolutionDiv = document.getElementById('aiCustomResolution');
    const customWidthInput = document.getElementById('aiCustomWidth');
    const customHeightInput = document.getElementById('aiCustomHeight');
    
    if (resolutionSelect) {
        resolutionSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            setResolution(value);
            
            // Show/hide custom inputs
            if (customResolutionDiv) {
                customResolutionDiv.style.display = value === 'custom' ? 'block' : 'none';
            }
            
            updateResolutionDisplay();
        });
    }
    
    // Custom Resolution Inputs
    if (customWidthInput) {
        customWidthInput.addEventListener('change', (e) => {
            aiState.customWidth = parseInt(e.target.value) || 1920;
            updateResolutionDisplay();
        });
    }
    
    if (customHeightInput) {
        customHeightInput.addEventListener('change', (e) => {
            aiState.customHeight = parseInt(e.target.value) || 1080;
            updateResolutionDisplay();
        });
    }
    
    // ComfyUI Port Input
    const comfyPortInput = document.getElementById('comfyPort');
    if (comfyPortInput) {
        // Initial port aus State setzen
        comfyPortInput.value = aiState.comfyPort;
        
        // Port ändern bei Enter
        comfyPortInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const port = parseInt(comfyPortInput.value);
                if (port >= 1 && port <= 65535) {
                    setComfyPort(port);
                }
            }
        });
        
        // Port ändern bei Blur (Fokus verlieren)
        comfyPortInput.addEventListener('blur', () => {
            const port = parseInt(comfyPortInput.value);
            if (port >= 1 && port <= 65535 && port !== aiState.comfyPort) {
                setComfyPort(port);
            }
        });
    }
    
    // ComfyUI Connect Button
    const comfyConnectBtn = document.getElementById('comfyConnectBtn');
    if (comfyConnectBtn) {
        comfyConnectBtn.addEventListener('click', () => {
            const port = parseInt(comfyPortInput?.value || aiState.comfyPort);
            if (port >= 1 && port <= 65535) {
                setComfyPort(port);
            } else {
                checkComfyConnection();
            }
        });
    }
    
    // Checkpoint Select
    const checkpointSelect = document.getElementById('comfyCheckpoint');
    if (checkpointSelect) {
        checkpointSelect.addEventListener('change', (e) => {
            aiState.customCheckpoint = e.target.value;
            console.log('Checkpoint selected:', aiState.customCheckpoint);
        });
    }
    
    // Test ComfyUI in Browser Link
    const testComfyLink = document.getElementById('testComfyLink');
    if (testComfyLink) {
        testComfyLink.addEventListener('click', (e) => {
            e.preventDefault();
            const url = `http://127.0.0.1:${aiState.comfyPort}`;
            console.log('Opening ComfyUI in browser:', url);
            window.open(url, '_blank');
        });
    }
    
    // Start ComfyUI Button
    const startComfyBtn = document.getElementById('startComfyBtn');
    if (startComfyBtn) {
        startComfyBtn.addEventListener('click', async () => {
            // Terminal-Befehl zum Starten von ComfyUI MIT CORS
            const comfyCommand = 'cd ~/ComfyUI && python main.py --enable-cors-header';
            
            try {
                await navigator.clipboard.writeText(comfyCommand);
                console.log('ComfyUI command copied:', comfyCommand);
                // Visuelles Feedback
                const originalText = startComfyBtn.textContent;
                startComfyBtn.textContent = '✅ Kopiert!';
                startComfyBtn.style.background = '#2a5';
                setTimeout(() => {
                    startComfyBtn.textContent = originalText;
                    startComfyBtn.style.background = '';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy command:', err);
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = comfyCommand;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                startComfyBtn.textContent = '✅ Kopiert!';
                setTimeout(() => {
                    startComfyBtn.textContent = 'Start ComfyUI';
                }, 1500);
            }
            
            // Versuche über Electron ComfyUI zu starten
            if (window.electronAPI?.startComfyUI) {
                window.electronAPI.startComfyUI();
                if (statusEl) {
                    statusEl.textContent = '🚀 Starting ComfyUI...';
                    statusEl.style.color = '#ff0';
                }
                setTimeout(checkComfyConnection, 5000);
            }
        });
    }
    
    // Auto Generate Checkbox
    const autoGenCheckbox = document.getElementById('aiAutoGenerate');
    if (autoGenCheckbox) {
        autoGenCheckbox.addEventListener('change', (e) => {
            setAutoGenerate(e.target.checked);
        });
    }
    
    // Buffer Mode Checkbox
    const bufferCheckbox = document.getElementById('aiBufferMode');
    if (bufferCheckbox) {
        bufferCheckbox.addEventListener('change', (e) => {
            setBufferMode(e.target.checked);
            // Show/hide buffer settings panel
            if (bufferSettingsEl) {
                bufferSettingsEl.style.display = e.target.checked ? 'block' : 'none';
            }
            if (bufferThumbsEl) {
                bufferThumbsEl.style.display = e.target.checked ? 'flex' : 'none';
            }
            updateBufferStatus();
        });
    }
    
    // Buffer Size Slider
    const bufferSizeSlider = document.getElementById('aiBufferSize');
    const bufferSizeValue = document.getElementById('aiBufferSizeValue');
    if (bufferSizeSlider) {
        bufferSizeSlider.addEventListener('input', (e) => {
            aiState.bufferSize = parseInt(e.target.value);
            if (bufferSizeValue) bufferSizeValue.textContent = aiState.bufferSize;
            updateBufferStatus();
        });
    }
    
    // Buffer Loop Checkbox
    const bufferLoopCheckbox = document.getElementById('aiBufferLoop');
    if (bufferLoopCheckbox) {
        bufferLoopCheckbox.addEventListener('change', (e) => {
            aiState.bufferLoop = e.target.checked;
        });
    }
    
    // Buffer Shuffle Checkbox
    const bufferShuffleCheckbox = document.getElementById('aiBufferShuffle');
    if (bufferShuffleCheckbox) {
        bufferShuffleCheckbox.addEventListener('change', (e) => {
            aiState.bufferShuffle = e.target.checked;
        });
    }
    
    // Crossfade Checkbox
    const crossfadeCheckbox = document.getElementById('aiCrossfadeEnabled');
    if (crossfadeCheckbox) {
        crossfadeCheckbox.addEventListener('change', (e) => {
            setCrossfadeEnabled(e.target.checked);
        });
    }
    
    // Prompt Input
    if (promptInputEl) {
        promptInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const prompt = promptInputEl.value.trim();
                if (prompt) {
                    generateImage(prompt);
                }
            }
        });
    }
    
    // Generate Button
    const generateBtn = document.getElementById('aiGenerateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
            if (prompt) {
                generateImage(prompt);
            }
        });
    }
    
    // Clear Prompt Button
    const clearBtn = document.getElementById('aiClearPrompt');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (promptInputEl) promptInputEl.value = '';
            aiState.currentPrompt = '';
            if (currentInputEl) currentInputEl.textContent = '🎤 -';
        });
    }
    
    // Filter Checkboxes - NOTE: Diese werden von speech.js gehandled!
    // Die ai-image.js Handler sind nur für lokalen State (z.B. wenn AI ohne Speech verwendet wird)
    // Synchronisiere mit speechState für konsistentes Verhalten
    const nounsCheckbox = document.getElementById('aiFilterNouns');
    const verbsCheckbox = document.getElementById('aiFilterVerbs');
    const adjCheckbox = document.getElementById('aiFilterAdj');
    
    // Importiere speechState Setter wenn verfügbar
    const syncWithSpeech = (type, value) => {
        // Versuche speechState zu synchronisieren
        if (window.Synaesthesia?.speechState) {
            window.Synaesthesia.speechState[type] = value;
        }
    };
    
    if (nounsCheckbox) {
        nounsCheckbox.addEventListener('change', (e) => {
            setFilterNouns(e.target.checked);
            syncWithSpeech('filterNouns', e.target.checked);
            console.log('🏷️ Filter Nouns:', e.target.checked);
        });
    }
    if (verbsCheckbox) {
        verbsCheckbox.addEventListener('change', (e) => {
            setFilterVerbs(e.target.checked);
            syncWithSpeech('filterVerbs', e.target.checked);
            console.log('🏷️ Filter Verbs:', e.target.checked);
        });
    }
    if (adjCheckbox) {
        adjCheckbox.addEventListener('change', (e) => {
            setFilterAdj(e.target.checked);
            syncWithSpeech('filterAdj', e.target.checked);
            console.log('🏷️ Filter Adj:', e.target.checked);
        });
    }
    
    // Window resize handler for overlay
    window.addEventListener('resize', () => {
        if (overlayCanvas) {
            overlayCanvas.width = window.innerWidth;
            overlayCanvas.height = window.innerHeight;
        }
    });
    
    // ============================================
    // PLAYBACK & CONTINUOUS GEN CONTROLS
    // ============================================
    
    // Playback Button (Play/Pause)
    const playbackBtn = document.getElementById('aiPlaybackBtn');
    if (playbackBtn) {
        playbackBtn.addEventListener('click', togglePlayback);
    }
    
    // Previous Button
    const prevBtn = document.getElementById('aiPrevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', prevBufferImage);
    }
    
    // Next Button
    const nextBtn = document.getElementById('aiNextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextBufferImage);
    }
    
    // Clear Buffer Button
    const clearBufferBtn = document.getElementById('aiClearBufferBtn');
    if (clearBufferBtn) {
        clearBufferBtn.addEventListener('click', clearBuffer);
    }
    
    // Playback Speed Slider
    const playbackSpeedSlider = document.getElementById('aiPlaybackSpeed');
    const playbackSpeedValue = document.getElementById('aiPlaybackSpeedValue');
    if (playbackSpeedSlider) {
        playbackSpeedSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setPlaybackSpeed(ms);
            if (playbackSpeedValue) {
                playbackSpeedValue.textContent = (ms / 1000).toFixed(1) + 's';
            }
        });
    }
    
    // Continuous Generation Button
    const continuousGenBtn = document.getElementById('aiContinuousGenBtn');
    if (continuousGenBtn) {
        continuousGenBtn.addEventListener('click', () => {
            if (aiState.continuousGen) {
                stopContinuousGeneration();
            } else {
                const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
                if (prompt) {
                    startContinuousGeneration(prompt);
                } else {
                    console.warn('No prompt for continuous generation');
                    alert('Bitte gib zuerst einen Prompt ein!');
                }
            }
        });
    }
    
    // Buffer Loop initial state
    const bufferLoopInit = document.getElementById('aiBufferLoop');
    if (bufferLoopInit) {
        aiState.bufferLoop = bufferLoopInit.checked;
    }
    
    // ============================================
    // AI VISIBILITY BUTTON
    // ============================================
    
    const aiVisibilityBtn = document.getElementById('aiVisibilityBtn');
    if (aiVisibilityBtn) {
        aiVisibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isEnabled = aiVisibilityBtn.classList.toggle('active');
            setAiEnabled(isEnabled);
        });
    }
    
    // ============================================
    // BPM SYNC CONTROLS
    // ============================================
    
    const bpmSyncCheckbox = document.getElementById('aiBpmSync');
    const bpmSyncOptions = document.getElementById('aiBpmSyncOptions');
    const speedControl = document.getElementById('aiSpeedControl');
    
    if (bpmSyncCheckbox) {
        bpmSyncCheckbox.addEventListener('change', (e) => {
            aiState.bpmSyncEnabled = e.target.checked;
            
            // Show/hide BPM options
            if (bpmSyncOptions) {
                bpmSyncOptions.style.display = e.target.checked ? 'block' : 'none';
            }
            
            // Disable manual speed when BPM sync is on
            if (speedControl) {
                speedControl.style.opacity = e.target.checked ? '0.5' : '1';
                const slider = speedControl.querySelector('input');
                if (slider) slider.disabled = e.target.checked;
            }
            
            // Stop regular timer wenn BPM sync an
            if (e.target.checked && playbackTimer) {
                clearInterval(playbackTimer);
                playbackTimer = null;
            }
            
            console.log('BPM Sync:', e.target.checked ? 'enabled' : 'disabled');
        });
    }
    
    // BPM Beat Buttons (1, 2, 4, 8, 16)
    document.querySelectorAll('.ai-bpm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-bpm-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            aiState.bpmSyncBeats = parseInt(btn.dataset.beats);
            aiState.beatCounter = 0; // Reset counter
            console.log('BPM Sync Beats:', aiState.bpmSyncBeats);
        });
    });
    
    // ============================================
    // STREAM MODE CONTROLS
    // ============================================
    
    const streamModeBtn = document.getElementById('aiStreamModeBtn');
    if (streamModeBtn) {
        streamModeBtn.addEventListener('click', toggleStreamMode);
    }
    
    const streamPauseSlider = document.getElementById('aiStreamPause');
    const streamPauseValue = document.getElementById('aiStreamPauseValue');
    if (streamPauseSlider) {
        streamPauseSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setStreamPause(ms);
            if (streamPauseValue) {
                if (ms === 0) {
                    streamPauseValue.textContent = '0ms (max speed)';
                } else if (ms >= 1000) {
                    streamPauseValue.textContent = (ms / 1000).toFixed(1) + 's';
                } else {
                    streamPauseValue.textContent = ms + 'ms';
                }
            }
        });
    }
    
    // Save Images Checkbox
    const saveImagesCheckbox = document.getElementById('aiSaveImages');
    if (saveImagesCheckbox) {
        saveImagesCheckbox.addEventListener('change', (e) => {
            aiState.saveImages = e.target.checked;
            console.log('Save images:', e.target.checked ? 'ON (permanent)' : 'OFF (temp only)');
        });
    }
    
    // ============================================
    // PROMPT MODIFIER CONTROLS
    // ============================================
    
    const modifierCinematic = document.getElementById('modifierCinematic');
    const modifierAnatomy = document.getElementById('modifierAnatomy');
    const modifierHighDetail = document.getElementById('modifierHighDetail');
    const modifierArtistic = document.getElementById('modifierArtistic');
    
    if (modifierCinematic) {
        modifierCinematic.addEventListener('change', (e) => {
            aiState.promptModifiers.cinematic = e.target.checked;
            console.log('Cinematic modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierAnatomy) {
        modifierAnatomy.addEventListener('change', (e) => {
            aiState.promptModifiers.anatomy = e.target.checked;
            console.log('Anatomy modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierHighDetail) {
        modifierHighDetail.addEventListener('change', (e) => {
            aiState.promptModifiers.highDetail = e.target.checked;
            console.log('High Detail modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierArtistic) {
        modifierArtistic.addEventListener('change', (e) => {
            aiState.promptModifiers.artistic = e.target.checked;
            console.log('Artistic modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    // ============================================
    // UPSCALE CONTROLS
    // ============================================
    
    const upscaleCheckbox = document.getElementById('aiUpscaleEnabled');
    const upscaleSettings = document.getElementById('aiUpscaleSettings');
    const generateResSelect = document.getElementById('aiGenerateResolution');
    const upscaleMethodSelect = document.getElementById('aiUpscaleMethod');
    const upscaleInfo = document.getElementById('aiUpscaleInfo');
    
    function updateUpscaleInfo() {
        if (!upscaleInfo) return;
        const genRes = aiState.generateResolution.split('x');
        const outRes = aiState.resolution.split('x');
        const genPixels = parseInt(genRes[0]) * parseInt(genRes[1]);
        const outPixels = parseInt(outRes[0]) * parseInt(outRes[1]);
        const speedup = (outPixels / genPixels).toFixed(1);
        upscaleInfo.textContent = `${aiState.generateResolution.replace('x', '×')} → ${aiState.resolution.replace('x', '×')} (~${speedup}x faster)`;
    }
    
    if (upscaleCheckbox) {
        upscaleCheckbox.addEventListener('change', (e) => {
            aiState.upscaleEnabled = e.target.checked;
            if (upscaleSettings) {
                upscaleSettings.style.display = e.target.checked ? 'block' : 'none';
            }
            console.log('Upscale:', e.target.checked ? 'ON' : 'OFF');
            updateUpscaleInfo();
        });
    }
    
    if (generateResSelect) {
        generateResSelect.addEventListener('change', (e) => {
            aiState.generateResolution = e.target.value;
            console.log('Generate resolution:', e.target.value);
            updateUpscaleInfo();
        });
    }
    
    if (upscaleMethodSelect) {
        upscaleMethodSelect.addEventListener('change', (e) => {
            aiState.upscaleMethod = e.target.value;
            console.log('Upscale method:', e.target.value);
        });
    }
    
    // Update upscale info when output resolution changes
    if (resolutionSelect) {
        const originalHandler = resolutionSelect.onchange;
        resolutionSelect.addEventListener('change', updateUpscaleInfo);
    }
    
    // ============================================
    // ADVANCED SETTINGS CONTROLS
    // ============================================
    
    const stepsSlider = document.getElementById('aiSteps');
    const stepsValue = document.getElementById('aiStepsValue');
    const cfgSlider = document.getElementById('aiCfg');
    const cfgValue = document.getElementById('aiCfgValue');
    const samplerSelect = document.getElementById('aiSampler');
    const presetStatus = document.getElementById('presetStatus');
    
    function updateSettingsUI() {
        if (stepsSlider) stepsSlider.value = aiState.steps;
        if (stepsValue) stepsValue.textContent = aiState.steps;
        if (cfgSlider) cfgSlider.value = aiState.cfg;
        if (cfgValue) cfgValue.textContent = aiState.cfg;
        if (samplerSelect) samplerSelect.value = aiState.sampler;
        if (upscaleCheckbox) upscaleCheckbox.checked = aiState.upscaleEnabled;
        if (upscaleSettings) upscaleSettings.style.display = aiState.upscaleEnabled ? 'block' : 'none';
        if (generateResSelect) generateResSelect.value = aiState.generateResolution;
        if (upscaleMethodSelect) upscaleMethodSelect.value = aiState.upscaleMethod;
        if (saveImagesCheckbox) saveImagesCheckbox.checked = aiState.saveImages;
        // Resolution Dropdown aktualisieren
        if (resolutionSelect) resolutionSelect.value = aiState.resolution;
        updateUpscaleInfo();
        updateResolutionDisplay();
    }
    
    if (stepsSlider) {
        stepsSlider.addEventListener('input', (e) => {
            aiState.steps = parseInt(e.target.value);
            if (stepsValue) stepsValue.textContent = aiState.steps;
        });
    }
    
    if (cfgSlider) {
        cfgSlider.addEventListener('input', (e) => {
            aiState.cfg = parseFloat(e.target.value);
            if (cfgValue) cfgValue.textContent = aiState.cfg;
        });
    }
    
    if (samplerSelect) {
        samplerSelect.addEventListener('change', (e) => {
            aiState.sampler = e.target.value;
            console.log('Sampler:', aiState.sampler);
        });
    }
    
    // ============================================
    // SPEED PRESETS
    // ============================================
    
    // Aktualisiert visuelle Hervorhebung der Preset-Buttons
    function updatePresetButtons(activePresetId) {
        const presetBtns = ['presetMaxFps', 'presetFast', 'presetBalanced', 'presetQuality'];
        presetBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (id === activePresetId) {
                    btn.classList.add('active');
                    btn.style.boxShadow = '0 0 8px #4af';
                    btn.style.borderColor = '#4af';
                } else {
                    btn.classList.remove('active');
                    btn.style.boxShadow = '';
                    btn.style.borderColor = '';
                }
            }
        });
    }
    
    function applyPreset(name, settings, presetId) {
        Object.assign(aiState, settings);
        updateSettingsUI();
        updatePresetButtons(presetId);
        if (presetStatus) {
            // Zeige die tatsächliche Generierungs-Resolution
            const genRes = settings.upscaleEnabled ? settings.generateResolution : (settings.resolution || aiState.resolution);
            presetStatus.textContent = `✅ ${name}: ${settings.steps} steps, ${genRes}`;
            presetStatus.style.color = '#4a4';
        }
        console.log(`Preset '${name}' applied:`, settings);
    }
    
    // MAX FPS - Absolute maximum speed
    const presetMaxFps = document.getElementById('presetMaxFps');
    if (presetMaxFps) {
        presetMaxFps.addEventListener('click', () => {
            applyPreset('🚀 MAX FPS', {
                steps: 1,
                cfg: 1,
                sampler: 'euler',
                upscaleEnabled: true,
                generateResolution: '512x288',
                upscaleMethod: 'nearest-exact',
                saveImages: false
            }, 'presetMaxFps');
        });
    }
    
    // Fast - Good speed, decent quality
    const presetFast = document.getElementById('presetFast');
    if (presetFast) {
        presetFast.addEventListener('click', () => {
            applyPreset('Fast', {
                steps: 4,
                cfg: 1,
                sampler: 'euler',
                upscaleEnabled: true,
                generateResolution: '768x432',
                upscaleMethod: 'bilinear',
                saveImages: false
            }, 'presetFast');
        });
    }
    
    // Balanced - Balance of speed and quality
    const presetBalanced = document.getElementById('presetBalanced');
    if (presetBalanced) {
        presetBalanced.addEventListener('click', () => {
            applyPreset('Balanced', {
                steps: 4,
                cfg: 1,
                sampler: 'euler_ancestral',
                upscaleEnabled: true,
                generateResolution: '896x512',
                upscaleMethod: 'lanczos',
                saveImages: true
            }, 'presetBalanced');
        });
    }
    
    // Quality - Best quality, slower (generates natively at 1280x720)
    const presetQuality = document.getElementById('presetQuality');
    if (presetQuality) {
        presetQuality.addEventListener('click', () => {
            applyPreset('Quality', {
                steps: 8,
                cfg: 2,
                sampler: 'euler_ancestral',
                upscaleEnabled: false,
                resolution: '1280x720',
                saveImages: true
            }, 'presetQuality');
        });
    }
    
    // ============================================
    // POST-UPSCALE CONTROLS (Client-Side)
    // ============================================
    
    const postUpscaleCheckbox = document.getElementById('aiPostUpscaleEnabled');
    const postUpscaleSettings = document.getElementById('aiPostUpscaleSettings');
    const postUpscaleTargetSelect = document.getElementById('aiPostUpscaleTarget');
    const postUpscaleMethodSelect = document.getElementById('aiPostUpscaleMethod');
    const postUpscaleSharpenSlider = document.getElementById('aiPostUpscaleSharpen');
    const postUpscaleSharpenValue = document.getElementById('aiPostUpscaleSharpenValue');
    const upscaleCurrentBtn = document.getElementById('aiUpscaleCurrentBtn');
    const upscaleBufferBtn = document.getElementById('aiUpscaleBufferBtn');
    
    if (postUpscaleCheckbox) {
        postUpscaleCheckbox.addEventListener('change', (e) => {
            aiState.postUpscaleEnabled = e.target.checked;
            if (postUpscaleSettings) {
                postUpscaleSettings.style.display = e.target.checked ? 'block' : 'none';
            }
            console.log('Post-Upscale:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (postUpscaleTargetSelect) {
        postUpscaleTargetSelect.addEventListener('change', (e) => {
            aiState.postUpscaleTarget = e.target.value;
            console.log('Post-Upscale target:', e.target.value);
        });
    }
    
    if (postUpscaleMethodSelect) {
        postUpscaleMethodSelect.addEventListener('change', (e) => {
            aiState.postUpscaleMethod = e.target.value;
            console.log('Post-Upscale method:', e.target.value);
        });
    }
    
    if (postUpscaleSharpenSlider) {
        postUpscaleSharpenSlider.addEventListener('input', (e) => {
            aiState.postUpscaleSharpen = parseInt(e.target.value);
            if (postUpscaleSharpenValue) {
                postUpscaleSharpenValue.textContent = e.target.value + '%';
            }
        });
    }
    
    if (upscaleCurrentBtn) {
        upscaleCurrentBtn.addEventListener('click', () => {
            upscaleCurrentImage();
        });
    }
    
    if (upscaleBufferBtn) {
        upscaleBufferBtn.addEventListener('click', () => {
            upscaleBuffer();
        });
    }
    
    // Initial connection check
    setTimeout(checkComfyConnection, 1000);
    
    // Initial resolution display
    updateResolutionDisplay();
    
    // ============================================
    // REGENERATE BUTTONS
    // ============================================
    
    // Regenerate Button (neben Prompt Input)
    const regenerateBtn = document.getElementById('aiRegenerateBtn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            const prompt = aiState.lastGeneratedPrompt || promptInputEl?.value.trim() || aiState.currentPrompt;
            if (prompt) {
                console.log('🔄 Regenerating with prompt:', prompt);
                generateImage(prompt);
            } else {
                console.warn('No prompt to regenerate');
            }
        });
    }
    
    // Regenerate Overlay Button (auf Preview)
    const regenerateOverlayBtn = document.getElementById('aiRegenerateOverlay');
    if (regenerateOverlayBtn) {
        regenerateOverlayBtn.addEventListener('click', () => {
            const prompt = aiState.lastGeneratedPrompt || promptInputEl?.value.trim() || aiState.currentPrompt;
            if (prompt) {
                console.log('🔄 Regenerating with prompt:', prompt);
                generateImage(prompt);
            } else {
                console.warn('No prompt to regenerate');
            }
        });
    }
    
    // Generate from Debug Panel
    const regenerateFromDebugBtn = document.getElementById('aiRegenerateFromDebug');
    if (regenerateFromDebugBtn) {
        regenerateFromDebugBtn.addEventListener('click', () => {
            const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
            if (prompt) {
                console.log('🎨 Generating from debug panel:', prompt);
                generateImage(prompt);
            } else {
                console.warn('No prompt to generate');
            }
        });
    }
    
    // ============================================
    // PROMPT DEBUG CONTROLS
    // ============================================
    
    const debugCopyBtn = document.getElementById('aiDebugCopyPrompt');
    const debugRefreshBtn = document.getElementById('aiDebugRefresh');
    const clearSpeechBufferBtn = document.getElementById('aiClearSpeechBuffer');
    
    // Clear Speech Buffer Button
    if (clearSpeechBufferBtn) {
        clearSpeechBufferBtn.addEventListener('click', () => {
            clearSpeechBuffer();
            // Alle Prompt-States leeren
            if (promptInputEl) promptInputEl.value = '';
            aiState.currentPrompt = '';
            aiState.lastTranslatedPrompt = '';
            // Debug-Anzeige aktualisieren
            refreshPromptDebug();
            // Visuelles Feedback
            clearSpeechBufferBtn.textContent = '✅';
            clearSpeechBufferBtn.style.background = '#2a5';
            setTimeout(() => {
                clearSpeechBufferBtn.textContent = '🗑';
                clearSpeechBufferBtn.style.background = '';
            }, 1000);
            console.log('🗑️ Prompt cache cleared');
        });
    }
    
    if (debugCopyBtn) {
        debugCopyBtn.addEventListener('click', async () => {
            const finalPrompt = document.getElementById('aiDebugFinalPrompt')?.textContent || '';
            if (finalPrompt && finalPrompt !== '-') {
                try {
                    await navigator.clipboard.writeText(finalPrompt);
                    debugCopyBtn.textContent = '✅';
                    debugCopyBtn.style.background = '#2a5';
                    setTimeout(() => {
                        debugCopyBtn.textContent = '📋 Copy';
                        debugCopyBtn.style.background = '';
                    }, 1500);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
            }
        });
    }
    
    if (debugRefreshBtn) {
        debugRefreshBtn.addEventListener('click', () => {
            refreshPromptDebug();
            debugRefreshBtn.textContent = '✅';
            debugRefreshBtn.style.background = '#2a5';
            setTimeout(() => {
                debugRefreshBtn.textContent = '🔄';
                debugRefreshBtn.style.background = '';
            }, 1000);
        });
    }
    
    // Auto-update debug on prompt input change
    if (promptInputEl) {
        promptInputEl.addEventListener('input', () => {
            // Debounced refresh
            clearTimeout(window._promptDebugTimer);
            window._promptDebugTimer = setTimeout(refreshPromptDebug, 300);
        });
    }
    
    // Auto-update debug on modifier changes
    [modifierCinematic, modifierAnatomy, modifierHighDetail, modifierArtistic].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                setTimeout(refreshPromptDebug, 100);
            });
        }
    });
    
    // ============================================
    // TRANSLATION PANEL CONTROLS
    // ============================================
    
    const translateEnabledEl = document.getElementById('translateEnabled');
    const translateDictionaryEl = document.getElementById('translateDictionary');
    const translateCompoundEl = document.getElementById('translateCompound');
    const translateStemmingEl = document.getElementById('translateStemming');
    const translateFuzzyEl = document.getElementById('translateFuzzy');
    const translateSkipGermanEl = document.getElementById('translateSkipGerman');
    const fuzzyMaxDistanceEl = document.getElementById('fuzzyMaxDistance');
    const fuzzyMaxDistanceValueEl = document.getElementById('fuzzyMaxDistanceValue');
    const translateUseApiEl = document.getElementById('translateUseApi');
    const translateApiUrlEl = document.getElementById('translateApiUrl');
    const translateDictCountEl = document.getElementById('translateDictCount');
    const translateStopCountEl = document.getElementById('translateStopCount');
    
    // Update stats display
    if (translateDictCountEl) {
        translateDictCountEl.textContent = `${Object.keys(DE_EN_DICTIONARY).length} Wörter`;
    }
    if (translateStopCountEl) {
        translateStopCountEl.textContent = `${GERMAN_STOPWORDS.size} Wörter`;
    }
    
    // Master toggle
    if (translateEnabledEl) {
        translateEnabledEl.checked = aiState.translateEnabled;
        translateEnabledEl.addEventListener('change', (e) => {
            aiState.translateEnabled = e.target.checked;
            console.log('🌐 Translation:', aiState.translateEnabled ? 'enabled' : 'disabled');
            refreshPromptDebug();
        });
    }
    
    // Dictionary toggle
    if (translateDictionaryEl) {
        translateDictionaryEl.checked = aiState.translateDictionary;
        translateDictionaryEl.addEventListener('change', (e) => {
            aiState.translateDictionary = e.target.checked;
            console.log('📖 Dictionary:', aiState.translateDictionary ? 'on' : 'off');
            refreshPromptDebug();
        });
    }
    
    // Compound toggle
    if (translateCompoundEl) {
        translateCompoundEl.checked = aiState.translateCompound;
        translateCompoundEl.addEventListener('change', (e) => {
            aiState.translateCompound = e.target.checked;
            console.log('🔗 Compound:', aiState.translateCompound ? 'on' : 'off');
            refreshPromptDebug();
        });
    }
    
    // Stemming toggle
    if (translateStemmingEl) {
        translateStemmingEl.checked = aiState.translateStemming;
        translateStemmingEl.addEventListener('change', (e) => {
            aiState.translateStemming = e.target.checked;
            console.log('✂️ Stemming:', aiState.translateStemming ? 'on' : 'off');
            refreshPromptDebug();
        });
    }
    
    // Fuzzy toggle
    if (translateFuzzyEl) {
        translateFuzzyEl.checked = aiState.translateFuzzy;
        translateFuzzyEl.addEventListener('change', (e) => {
            aiState.translateFuzzy = e.target.checked;
            console.log('🔍 Fuzzy:', aiState.translateFuzzy ? 'on' : 'off');
            refreshPromptDebug();
        });
    }
    
    // Skip German toggle
    if (translateSkipGermanEl) {
        translateSkipGermanEl.checked = aiState.translateSkipGerman;
        translateSkipGermanEl.addEventListener('change', (e) => {
            aiState.translateSkipGerman = e.target.checked;
            console.log('🚫 Skip German:', aiState.translateSkipGerman ? 'on' : 'off');
            refreshPromptDebug();
        });
    }
    
    // Fuzzy max distance slider
    if (fuzzyMaxDistanceEl) {
        fuzzyMaxDistanceEl.value = aiState.fuzzyMaxDistance || 0;
        const updateFuzzyDisplay = () => {
            const val = parseInt(fuzzyMaxDistanceEl.value);
            aiState.fuzzyMaxDistance = val;
            if (fuzzyMaxDistanceValueEl) {
                fuzzyMaxDistanceValueEl.textContent = val === 0 ? 'auto' : val.toString();
            }
        };
        updateFuzzyDisplay();
        fuzzyMaxDistanceEl.addEventListener('input', () => {
            updateFuzzyDisplay();
            console.log('🔍 Fuzzy max distance:', aiState.fuzzyMaxDistance === 0 ? 'auto' : aiState.fuzzyMaxDistance);
            refreshPromptDebug();
        });
    }
    
    // API toggle
    if (translateUseApiEl) {
        translateUseApiEl.checked = aiState.useApiTranslation;
        translateUseApiEl.addEventListener('change', (e) => {
            aiState.useApiTranslation = e.target.checked;
            console.log('🌐 API Translation:', aiState.useApiTranslation ? 'on' : 'off');
        });
    }
    
    // API URL
    if (translateApiUrlEl) {
        translateApiUrlEl.value = aiState.translateApiUrl || '';
        translateApiUrlEl.addEventListener('change', (e) => {
            aiState.translateApiUrl = e.target.value.trim();
            console.log('🌐 API URL:', aiState.translateApiUrl);
        });
    }
    
    // ============================================
    // WORDCLOUD CONTROLS
    // ============================================
    
    wordcloudContainer = document.getElementById('wordcloudContainer');
    
    const wordcloudClearBtn = document.getElementById('wordcloudClear');
    if (wordcloudClearBtn) {
        wordcloudClearBtn.addEventListener('click', () => {
            clearWordcloud();
            // Visuelles Feedback
            wordcloudClearBtn.textContent = '✅';
            setTimeout(() => {
                wordcloudClearBtn.textContent = '🗑 Clear';
            }, 800);
        });
    }
    
    // Periodischer Refresh für Farb-Updates (alle 2 Sekunden)
    if (wordcloudRefreshTimer) clearInterval(wordcloudRefreshTimer);
    wordcloudRefreshTimer = setInterval(() => {
        if (Object.keys(wordcloudWords).length > 0) {
            renderWordcloud();
        }
    }, 2000);
    
    // ============================================
    // MINI AI CONTROLS
    // ============================================
    
    miniAiPreviewEl = document.getElementById('miniAiPreview');
    miniAiStatusEl = document.getElementById('miniAiStatus');
    miniAiTimeEl = document.getElementById('miniAiTime');
    
    const miniAiGenerateBtn = document.getElementById('miniAiGenerate');
    if (miniAiGenerateBtn) {
        miniAiGenerateBtn.addEventListener('click', () => {
            generateMiniImage();
        });
    }
    
    const miniAiAutoBtn = document.getElementById('miniAiAuto');
    if (miniAiAutoBtn) {
        miniAiAutoBtn.addEventListener('click', toggleMiniAiAuto);
    }
    
    const miniAiToMainBtn = document.getElementById('miniAiToMain');
    if (miniAiToMainBtn) {
        miniAiToMainBtn.addEventListener('click', miniToMain);
    }
    
    const miniAiToPromptBtn = document.getElementById('miniAiToPrompt');
    if (miniAiToPromptBtn) {
        miniAiToPromptBtn.addEventListener('click', generateFromMiniSeed);
    }
    
    // ============================================
    // SPEECH BUFFER TIMEOUT SLIDER
    // ============================================
    
    const speechBufferTimeoutSlider = document.getElementById('speechBufferTimeout');
    const speechBufferTimeoutValue = document.getElementById('speechBufferTimeoutValue');
    
    if (speechBufferTimeoutSlider) {
        speechBufferTimeoutSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setSpeechBufferTimeout(ms);
            if (speechBufferTimeoutValue) {
                speechBufferTimeoutValue.textContent = (ms / 1000).toFixed(1) + 's';
            }
        });
    }
    
    console.log('AI Image UI initialized');
}

// ============================================
// BPM SYNC FUNCTIONS
// ============================================

/**
 * Wird bei jedem erkannten Beat aufgerufen (von beat-detector.js)
 * @param {number} bpm - Aktuelle BPM
 */
export function onBeat(bpm) {
    if (!aiState.enabled || !aiState.bpmSyncEnabled || !aiState.playbackActive) {
        return;
    }
    
    if (aiState.bufferImages.length === 0) {
        return;
    }
    
    // Beat counter erhöhen
    aiState.beatCounter++;
    
    // BPM Status aktualisieren
    const statusEl = document.getElementById('aiBpmStatus');
    if (statusEl) {
        statusEl.textContent = `${Math.round(bpm)} BPM | Beat ${aiState.beatCounter}/${aiState.bpmSyncBeats}`;
        statusEl.style.color = '#4f4';
    }
    
    // Bildwechsel wenn genug Beats
    if (aiState.beatCounter >= aiState.bpmSyncBeats) {
        aiState.beatCounter = 0;
        nextBufferImage();
    }
}

/**
 * Aktualisiert BPM Status (aufgerufen wenn BPM sich ändert)
 */
export function updateBpmDisplay(bpm) {
    if (!aiState.bpmSyncEnabled) return;
    
    const statusEl = document.getElementById('aiBpmStatus');
    if (statusEl && bpm > 0) {
        statusEl.textContent = `${Math.round(bpm)} BPM`;
        statusEl.style.color = '#888';
    }
}

// ============================================
// AI ENABLE/DISABLE
// ============================================

/**
 * Aktiviert/Deaktiviert AI komplett
 */
export function setAiEnabled(enabled) {
    aiState.enabled = enabled;
    
    if (!enabled) {
        // Alles stoppen
        stopPlayback();
        stopContinuousGeneration();
        stopStreamMode();
        
        // Overlay verstecken
        aiState.overlayOpacity = 0;
        if (overlayCanvas) {
            overlayCanvas.style.display = 'none';
        }
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
        
        // Slider zurücksetzen
        const opacitySlider = document.getElementById('aiOverlayOpacity');
        const opacityValue = document.getElementById('aiOverlayOpacityValue');
        if (opacitySlider) opacitySlider.value = 0;
        if (opacityValue) opacityValue.textContent = '0%';
    }
    
    console.log('AI:', enabled ? 'enabled' : 'disabled');
}

// ============================================
// GETTERS
// ============================================

export function isConnected() {
    return aiState.connected;
}

export function isGenerating() {
    return aiState.generating;
}

export function getCurrentImage() {
    return aiState.currentImage;
}

export function getOverlayOpacity() {
    return aiState.overlayOpacity;
}

export function getResolution() {
    return aiState.resolution;
}

export function isEnabled() {
    return aiState.enabled;
}

export function isBpmSyncEnabled() {
    return aiState.bpmSyncEnabled;
}
