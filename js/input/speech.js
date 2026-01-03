/**
 * SPEECH RECOGNITION
 * 
 * Drei Backend-Optionen:
 * 1. Web Speech API (Google Cloud) - Standard, nutzt System-Mikrofon
 * 2. Whisper via ComfyUI - Lokal über ComfyUI, nutzt App-Audio
 * 3. Whisper Local (whisper.cpp) - Komplett lokal, nutzt App-Audio
 */

// ============================================
// STATE
// ============================================

export const speechState = {
    enabled: false,
    backend: 'whisper-local', // 'webspeech', 'whisper-comfy', 'whisper-local' - Standard: Lokales Whisper
    language: 'de-DE',
    filterNouns: true,
    filterVerbs: false,
    filterAdj: false,
    lastInput: '',
    
    // Whisper settings - large-v3 ist das beste Modell
    whisperModel: 'large-v3',
    whisperComfyUrl: 'http://localhost:8188',
    
    // Audio buffer for Whisper
    audioBuffer: null,
    audioContext: null,
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false
};

let speechRecognition = null;
let speechHistory = [];
const maxSpeechHistory = 5;

// Callback für erkannte Sprache
let onSpeechResultCallback = null;

// Whisper polling interval
let whisperPollInterval = null;

// Audio stream reference (from main app)
let appAudioStream = null;

// ============================================
// SYSTEM MICROPHONE DETECTION
// ============================================

let systemMicrophoneId = null;
let systemMicrophoneName = null;

/**
 * Ermittelt das System-Standard-Mikrofon
 */
export async function detectSystemMicrophone() {
    const micInfoEl = document.getElementById('speechMicInfo');
    
    try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        tempStream.getTracks().forEach(t => t.stop());
        
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        
        if (audioInputs.length > 0) {
            const defaultMic = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0];
            
            systemMicrophoneId = defaultMic.deviceId;
            systemMicrophoneName = defaultMic.label || 'System Mikrofon';
            
            let displayName = systemMicrophoneName;
            if (displayName.length > 30) {
                displayName = displayName.substring(0, 27) + '...';
            }
            
            console.log('🎙️ System-Mikrofon:', systemMicrophoneName);
            return systemMicrophoneName;
        }
    } catch (err) {
        console.warn('Konnte System-Mikrofon nicht ermitteln:', err);
    }
    
    return null;
}

/**
 * Updates mic info display based on backend
 */
function updateMicInfo() {
    const micInfoEl = document.getElementById('speechMicInfo');
    if (!micInfoEl) return;
    
    switch (speechState.backend) {
        case 'webspeech':
            micInfoEl.innerHTML = `⚠️ System: ${systemMicrophoneName?.substring(0, 25) || 'Default'}`;
            micInfoEl.style.color = '#f80';
            micInfoEl.style.background = '#221100';
            micInfoEl.title = 'Web Speech API nutzt immer das System-Standard-Mikrofon';
            break;
        case 'whisper-comfy':
        case 'whisper-local':
            micInfoEl.innerHTML = '✅ Nutzt App Audio-Eingang';
            micInfoEl.style.color = '#4f4';
            micInfoEl.style.background = '#112211';
            micInfoEl.title = 'Whisper nutzt den in der App ausgewählten Audio-Eingang';
            break;
    }
}

// ============================================
// WORD LISTS - IMPROVED
// ============================================

// Stopwords (werden immer entfernt)
const GERMAN_STOPWORDS = new Set([
    // Artikel
    'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
    // Pronomen
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'sich', 'uns', 'euch',
    'mir', 'dir', 'ihm', 'ihr', 'ihnen', 'mein', 'dein', 'sein', 'unser', 'euer',
    'meiner', 'deiner', 'seiner', 'unserer', 'meinem', 'deinem', 'diesem', 'dieser', 'dieses',
    'jener', 'jene', 'jenes', 'welcher', 'welche', 'welches', 'wer', 'was', 'wem', 'wen',
    // Konjunktionen
    'und', 'oder', 'aber', 'denn', 'weil', 'dass', 'ob', 'wenn', 'als', 'obwohl', 'damit',
    'sondern', 'jedoch', 'doch', 'also', 'deshalb', 'daher', 'trotzdem', 'wobei', 'sodass',
    // Präpositionen
    'in', 'an', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'zu', 'für', 'über', 'unter',
    'vor', 'hinter', 'neben', 'zwischen', 'durch', 'gegen', 'ohne', 'um', 'bis', 'seit',
    'während', 'trotz', 'wegen', 'statt', 'anstatt', 'außerhalb', 'innerhalb',
    // Hilfsverben & Modalverben (Grundformen bleiben, konjugierte raus)
    'ist', 'sind', 'war', 'waren', 'bin', 'bist', 'seid', 'gewesen',
    'hat', 'haben', 'hatte', 'hatten', 'habe', 'hast', 'habt', 'gehabt',
    'wird', 'werden', 'wurde', 'wurden', 'werde', 'wirst', 'werdet', 'geworden',
    'kann', 'können', 'konnte', 'konnten', 'kannst', 'könnt', 'gekonnt',
    'muss', 'müssen', 'musste', 'mussten', 'musst', 'müsst', 'gemusst',
    'soll', 'sollen', 'sollte', 'sollten', 'sollst', 'sollt', 'gesollt',
    'darf', 'dürfen', 'durfte', 'durften', 'darfst', 'dürft', 'gedurft',
    'will', 'wollen', 'wollte', 'wollten', 'willst', 'wollt', 'gewollt',
    'mag', 'mögen', 'mochte', 'mochten', 'magst', 'mögt', 'gemocht',
    'möchte', 'möchten', 'möchtest', 'möchtet',
    'würde', 'würden', 'würdest', 'würdet',
    // Adverbien (häufige)
    'nicht', 'auch', 'nur', 'noch', 'schon', 'sehr', 'so', 'wie', 'wo', 'wann', 'warum',
    'hier', 'dort', 'da', 'dann', 'jetzt', 'nun', 'heute', 'gestern', 'morgen',
    'immer', 'nie', 'oft', 'manchmal', 'vielleicht', 'wohl', 'etwa', 'eben', 'gerade',
    'ganz', 'ziemlich', 'etwas', 'mehr', 'weniger', 'fast', 'kaum', 'bald', 'später',
    // Sonstige
    'ja', 'nein', 'okay', 'ok', 'hmm', 'ähm', 'äh', 'halt', 'mal', 'denn', 'eigentlich',
    'jedenfalls', 'zumindest', 'quasi', 'sozusagen', 'nämlich', 'allerdings', 'außerdem',
    // Demonstrativa
    'alle', 'alles', 'jeder', 'jede', 'jedes', 'beide', 'einige', 'manche', 'viele', 'wenige',
    'andere', 'anderer', 'anderes', 'solche', 'solcher', 'solches', 'selbst', 'selber'
]);

const ENGLISH_STOPWORDS = new Set([
    // Articles
    'the', 'a', 'an',
    // Pronouns
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
    'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
    // Conjunctions
    'and', 'or', 'but', 'nor', 'so', 'yet', 'for', 'because', 'although', 'though',
    'if', 'unless', 'until', 'while', 'as', 'since', 'when', 'where', 'whether',
    // Prepositions
    'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'about', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over',
    'against', 'without', 'within', 'along', 'around', 'among', 'behind', 'beyond',
    // Auxiliary & Modal verbs (conjugated forms)
    'is', 'are', 'was', 'were', 'am', 'been', 'being', 'be',
    'has', 'have', 'had', 'having',
    'do', 'does', 'did', 'doing', 'done',
    'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
    // Adverbs (common)
    'not', 'also', 'only', 'just', 'still', 'already', 'even', 'ever', 'never',
    'always', 'often', 'sometimes', 'usually', 'here', 'there', 'now', 'then',
    'very', 'too', 'quite', 'rather', 'almost', 'perhaps', 'maybe', 'probably',
    'really', 'actually', 'basically', 'simply', 'generally', 'usually',
    // Other
    'yes', 'no', 'well', 'oh', 'um', 'uh', 'like', 'okay', 'ok',
    'each', 'every', 'either', 'neither', 'both', 'all', 'any', 'some', 'few', 'many',
    'much', 'more', 'most', 'less', 'least', 'other', 'another', 'such', 'same',
    'own', 'able', 'of'
]);

// Bekannte deutsche Verben (Infinitive und wichtige Formen)
const GERMAN_VERBS = new Set([
    // Bewegung
    'gehen', 'laufen', 'rennen', 'springen', 'hüpfen', 'kriechen', 'fliegen', 'schwimmen',
    'fahren', 'reiten', 'klettern', 'steigen', 'fallen', 'sinken', 'gleiten', 'rollen',
    'tanzen', 'drehen', 'wenden', 'bewegen', 'schreiten', 'wandern', 'marschieren',
    'schweben', 'taumeln', 'stolpern', 'rutschen', 'schlittern', 'wirbeln', 'kreisen',
    'flattern', 'segeln', 'treiben', 'strömen', 'fließen', 'rinnen', 'tropfen', 'spritzen',
    'explodieren', 'implodieren', 'zerplatzen', 'zerspringen', 'aufsteigen', 'absinken',
    // Kommunikation
    'sagen', 'sprechen', 'reden', 'erzählen', 'fragen', 'antworten', 'rufen', 'schreien',
    'flüstern', 'murmeln', 'singen', 'summen', 'pfeifen', 'lachen', 'weinen', 'seufzen',
    'brüllen', 'kreischen', 'stöhnen', 'ächzen', 'grölen', 'jaulen', 'heulen', 'schluchzen',
    // Wahrnehmung
    'sehen', 'schauen', 'blicken', 'beobachten', 'hören', 'lauschen', 'fühlen', 'spüren',
    'riechen', 'schmecken', 'tasten', 'berühren', 'erkennen', 'bemerken', 'entdecken',
    'wahrnehmen', 'erfassen', 'erspüren', 'erahnen', 'wittern', 'ertasten',
    // Handlung
    'machen', 'tun', 'arbeiten', 'spielen', 'schaffen', 'bauen', 'basteln', 'nähen',
    'kochen', 'backen', 'braten', 'schneiden', 'hacken', 'mischen', 'rühren',
    'schreiben', 'lesen', 'zeichnen', 'malen', 'fotografieren', 'filmen',
    'nehmen', 'geben', 'holen', 'bringen', 'tragen', 'halten', 'legen', 'stellen', 'setzen',
    'werfen', 'fangen', 'schießen', 'treffen', 'ziehen', 'drücken', 'schieben', 'heben',
    'öffnen', 'schließen', 'drehen', 'wenden', 'biegen', 'brechen', 'reißen', 'schnappen',
    'greifen', 'packen', 'fassen', 'klammern', 'umklammern', 'festhalten', 'loslassen',
    'schlagen', 'klopfen', 'hämmern', 'stampfen', 'treten', 'stoßen', 'rammen',
    'kratzen', 'reiben', 'scheuern', 'polieren', 'schleifen', 'feilen', 'sägen',
    'bohren', 'stechen', 'piksen', 'durchbohren', 'durchstechen',
    // Zustand
    'sein', 'werden', 'bleiben', 'scheinen', 'erscheinen', 'wirken', 'aussehen',
    'leben', 'wohnen', 'existieren', 'stehen', 'liegen', 'sitzen', 'hängen',
    'schlafen', 'wachen', 'träumen', 'ruhen', 'entspannen', 'dösen', 'schlummern',
    // Kognition
    'denken', 'überlegen', 'nachdenken', 'glauben', 'meinen', 'wissen', 'verstehen',
    'lernen', 'studieren', 'erinnern', 'vergessen', 'planen', 'entscheiden',
    'träumen', 'fantasieren', 'visualisieren', 'vorstellen', 'imaginieren',
    // Emotion
    'lieben', 'hassen', 'mögen', 'freuen', 'ärgern', 'fürchten', 'hoffen', 'wünschen',
    'begeistern', 'erschrecken', 'erstaunen', 'verwundern', 'faszinieren', 'bezaubern',
    'berühren', 'bewegen', 'ergreifen', 'überwältigen', 'verzaubern', 'betören',
    // Veränderung
    'ändern', 'verändern', 'wachsen', 'schrumpfen', 'entstehen', 'verschwinden',
    'beginnen', 'anfangen', 'starten', 'enden', 'aufhören', 'stoppen', 'beenden',
    'verwandeln', 'transformieren', 'mutieren', 'entwickeln', 'entfalten', 'erblühen',
    'welken', 'verblassen', 'verblühen', 'vergehen', 'zerfallen', 'zerbrechen',
    'verschmelzen', 'vereinen', 'trennen', 'spalten', 'teilen', 'zerteilen',
    // Musik/Kunst
    'spielen', 'musizieren', 'komponieren', 'improvisieren', 'interpretieren',
    'klingen', 'tönen', 'hallen', 'schwingen', 'vibrieren', 'pulsieren',
    'erklingen', 'ertönen', 'nachhallen', 'widerhallen', 'dröhnen', 'brummen',
    'summen', 'sirren', 'zischen', 'rauschen', 'knistern', 'knacken', 'knarren',
    // Licht
    'leuchten', 'strahlen', 'glänzen', 'funkeln', 'blitzen', 'flackern', 'schimmern', 'glitzern',
    'blinken', 'blenden', 'erleuchten', 'erhellen', 'verdunkeln', 'beschatten',
    'reflektieren', 'spiegeln', 'brechen', 'streuen', 'absorbieren', 'durchscheinen',
    'glühen', 'lodern', 'flammen', 'brennen', 'schwelen', 'qualmen', 'dampfen',
    // Natur
    'regnen', 'schneien', 'hageln', 'stürmen', 'wehen', 'blasen', 'donnern',
    'blitzen', 'gewittern', 'tauen', 'frieren', 'schmelzen', 'verdunsten'
]);

// Bekannte englische Verben
const ENGLISH_VERBS = new Set([
    // Motion
    'go', 'walk', 'run', 'jump', 'hop', 'skip', 'fly', 'swim', 'drive', 'ride',
    'climb', 'fall', 'sink', 'float', 'glide', 'roll', 'spin', 'turn', 'move',
    'dance', 'march', 'crawl', 'slide', 'bounce', 'swing', 'wave', 'sway',
    'hover', 'soar', 'dive', 'plunge', 'leap', 'spring', 'dash', 'rush',
    'drift', 'wander', 'roam', 'stroll', 'stride', 'stumble', 'trip', 'tumble',
    'whirl', 'twirl', 'spiral', 'circle', 'orbit', 'rotate', 'revolve',
    'flow', 'stream', 'pour', 'gush', 'trickle', 'drip', 'splash', 'spray',
    'explode', 'burst', 'erupt', 'collapse', 'crumble', 'shatter',
    // Communication
    'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'call', 'shout', 'scream',
    'whisper', 'sing', 'hum', 'laugh', 'cry', 'sigh', 'yell', 'chat',
    'roar', 'howl', 'shriek', 'wail', 'moan', 'groan', 'murmur', 'mumble',
    // Perception
    'see', 'look', 'watch', 'hear', 'listen', 'feel', 'touch', 'smell', 'taste',
    'notice', 'observe', 'recognize', 'discover', 'sense', 'perceive',
    'detect', 'spot', 'glimpse', 'gaze', 'stare', 'glance', 'peer', 'scan',
    // Action
    'make', 'create', 'build', 'work', 'play', 'write', 'read', 'draw', 'paint',
    'cook', 'bake', 'cut', 'chop', 'mix', 'stir', 'pour', 'fill', 'empty',
    'take', 'give', 'get', 'bring', 'carry', 'hold', 'put', 'place', 'set',
    'throw', 'catch', 'shoot', 'hit', 'kick', 'pull', 'push', 'lift', 'drop',
    'open', 'close', 'turn', 'bend', 'break', 'tear', 'fold', 'wrap',
    'grab', 'grasp', 'grip', 'clutch', 'seize', 'snatch', 'release',
    'strike', 'punch', 'slap', 'knock', 'tap', 'pound', 'hammer', 'smash',
    'scratch', 'scrape', 'rub', 'polish', 'grind', 'carve', 'sculpt',
    // State
    'be', 'become', 'stay', 'remain', 'seem', 'appear', 'look', 'sound',
    'live', 'exist', 'stand', 'sit', 'lie', 'hang', 'sleep', 'wake', 'dream', 'rest',
    'wait', 'linger', 'pause', 'freeze', 'settle', 'balance', 'float',
    // Cognition
    'think', 'believe', 'know', 'understand', 'learn', 'study', 'remember', 'forget',
    'plan', 'decide', 'choose', 'guess', 'wonder', 'imagine', 'realize',
    'dream', 'fantasize', 'visualize', 'envision', 'conceive', 'contemplate',
    // Emotion
    'love', 'hate', 'like', 'enjoy', 'fear', 'hope', 'wish', 'want', 'need',
    'amaze', 'astonish', 'astound', 'stun', 'shock', 'thrill', 'excite',
    'calm', 'soothe', 'relax', 'comfort', 'enchant', 'mesmerize', 'captivate',
    // Change
    'change', 'grow', 'shrink', 'start', 'begin', 'stop', 'end', 'finish',
    'transform', 'morph', 'mutate', 'evolve', 'develop', 'unfold', 'bloom',
    'fade', 'wither', 'decay', 'dissolve', 'melt', 'freeze', 'crystallize',
    'merge', 'blend', 'fuse', 'split', 'divide', 'separate', 'scatter',
    // Music/Art
    'play', 'perform', 'compose', 'improvise', 'sound', 'ring', 'echo',
    'vibrate', 'pulse', 'beat', 'flow', 'stream', 'resonate', 'reverberate',
    'hum', 'buzz', 'drone', 'chime', 'toll', 'clash', 'clang', 'rattle',
    // Light
    'shine', 'glow', 'sparkle', 'flash', 'flicker', 'gleam', 'glitter', 'radiate', 'illuminate',
    'beam', 'blaze', 'dazzle', 'blind', 'dim', 'darken', 'shadow', 'shade',
    'reflect', 'mirror', 'refract', 'scatter', 'absorb', 'transmit',
    'burn', 'blaze', 'flame', 'smolder', 'smoke', 'steam', 'vaporize',
    // Nature
    'rain', 'snow', 'storm', 'thunder', 'lightning', 'blow', 'freeze', 'thaw', 'melt'
]);

// Bekannte deutsche Adjektive
const GERMAN_ADJECTIVES = new Set([
    // Farben - Grundfarben
    'rot', 'blau', 'grün', 'gelb', 'orange', 'lila', 'violett', 'rosa', 'pink',
    'braun', 'schwarz', 'weiß', 'grau', 'golden', 'silbern', 'bunt', 'farbig',
    // Farben - Nuancen
    'hellrot', 'dunkelrot', 'karmesinrot', 'purpurrot', 'weinrot', 'kirschrot', 'blutrot',
    'hellblau', 'dunkelblau', 'himmelblau', 'marineblau', 'kobaltblau', 'azurblau', 'türkis',
    'hellgrün', 'dunkelgrün', 'smaragdgrün', 'olivgrün', 'mintgrün', 'limonengrün', 'jadegrün',
    'zitronengelb', 'sonnengelb', 'goldgelb', 'ockergelb', 'bernsteinfarben', 'safrangelb',
    'purpur', 'magenta', 'fuchsia', 'lavendel', 'malve', 'aubergine', 'pflaume',
    'beige', 'creme', 'elfenbein', 'sand', 'karamell', 'schokobraun', 'mahagoni',
    'anthrazit', 'graphit', 'schiefergrau', 'silbergrau', 'perlgrau', 'aschgrau',
    // Lichtqualität
    'hell', 'dunkel', 'leuchtend', 'matt', 'kräftig', 'blass', 'transparent',
    'strahlend', 'glänzend', 'schimmernd', 'funkelnd', 'glitzernd', 'blendend',
    'phosphoreszierend', 'fluoreszierend', 'irisierend', 'opaleszierend', 'schillernd',
    'neon', 'pastellfarben', 'gedämpft', 'gedeckt', 'gesättigt', 'verwaschen', 'verblichen',
    // Größe
    'groß', 'klein', 'riesig', 'winzig', 'lang', 'kurz', 'hoch', 'niedrig', 'tief',
    'breit', 'schmal', 'dick', 'dünn', 'weit', 'eng', 'massiv', 'kompakt',
    'gigantisch', 'monumental', 'kolossal', 'mikroskopisch', 'zierlich', 'stattlich',
    'ausgedehnt', 'unermesslich', 'grenzenlos', 'begrenzt', 'schrumpfend', 'wachsend',
    // Form
    'rund', 'eckig', 'spitz', 'flach', 'gerade', 'krumm', 'gebogen', 'gewellt',
    'spiralförmig', 'sternförmig', 'kugelrund', 'oval', 'quadratisch', 'rechteckig',
    'dreieckig', 'hexagonal', 'polygonal', 'asymmetrisch', 'symmetrisch', 'organisch',
    'geometrisch', 'fraktal', 'amorph', 'kristallin', 'facettiert', 'prismatisch',
    'konisch', 'zylindrisch', 'pyramidal', 'kuppelförmig', 'bogig', 'gezackt',
    // Textur
    'glatt', 'rau', 'weich', 'hart', 'fest', 'locker', 'flauschig', 'samtig',
    'seidig', 'pelzig', 'borstig', 'stachelig', 'dornig', 'körnig', 'sandig',
    'porös', 'schwammig', 'elastisch', 'gummiartig', 'ledrig', 'papierartig',
    'kristallin', 'metallisch', 'glasig', 'wachsartig', 'ölig', 'fettig', 'nass', 'trocken',
    'rissig', 'bröckelig', 'splittrig', 'schuppig', 'faltig', 'zerknittert', 'gläsern',
    // Temperatur
    'warm', 'kalt', 'heiß', 'kühl', 'eisig', 'lauwarm', 'glühend', 'brennend',
    'frostig', 'gefroren', 'geschmolzen', 'siedend', 'dampfend', 'schwelend',
    // Geschwindigkeit
    'schnell', 'langsam', 'rasant', 'gemächlich', 'flink', 'träge', 'zügig',
    'blitzschnell', 'schleichend', 'kriechend', 'rasend', 'stürmisch', 'gemäßigt',
    // Intensität
    'stark', 'schwach', 'intensiv', 'sanft', 'leicht', 'schwer', 'heftig', 'mild',
    'laut', 'leise', 'still', 'ruhig', 'wild', 'zahm', 'chaotisch', 'harmonisch',
    'extrem', 'moderat', 'subtil', 'drastisch', 'gewaltig', 'zart', 'brutal', 'aggressiv',
    'durchdringend', 'betäubend', 'überwältigend', 'berauschend', 'hypnotisch',
    // Qualität
    'gut', 'schlecht', 'schön', 'hässlich', 'neu', 'alt', 'jung', 'frisch',
    'sauber', 'schmutzig', 'klar', 'trüb', 'rein', 'echt', 'falsch',
    'perfekt', 'makellos', 'fehlerhaft', 'roh', 'raffiniert', 'elegant', 'primitiv',
    'komplex', 'einfach', 'schlicht', 'opulent', 'üppig', 'minimalistisch', 'barock',
    // Emotion
    'fröhlich', 'traurig', 'wütend', 'glücklich', 'ängstlich', 'mutig', 'ruhig',
    'aufgeregt', 'entspannt', 'angespannt', 'friedlich', 'aggressiv', 'liebevoll',
    'melancholisch', 'nostalgisch', 'sehnsüchtig', 'euphorisch', 'ekstatisch', 'verzweifelt',
    'hoffnungsvoll', 'resigniert', 'verwirrt', 'fasziniert', 'verzaubert', 'betroffen',
    'erschüttert', 'berührt', 'ergriffen', 'hingerissen', 'entzückt', 'beseelt',
    // Musik
    'melodisch', 'rhythmisch', 'harmonisch', 'dissonant', 'lyrisch', 'dramatisch',
    'episch', 'intim', 'majestätisch', 'zart', 'kraftvoll', 'sanft', 'pulsierend',
    'symphonisch', 'kontrapunktisch', 'polyphon', 'monophon', 'atonal', 'modal',
    'synkopiert', 'crescendierend', 'decrescendierend', 'staccato', 'legato', 'vibrato',
    // Abstrakt
    'abstrakt', 'konkret', 'real', 'surreal', 'magisch', 'mystisch', 'kosmisch',
    'unendlich', 'ewig', 'zeitlos', 'flüchtig', 'vergänglich', 'lebendig', 'tot',
    'transzendent', 'immanent', 'ätherisch', 'spirituell', 'metaphysisch', 'arkadisch',
    'utopisch', 'dystopisch', 'apokalyptisch', 'genesis', 'zyklisch', 'linear',
    'parallel', 'dimensional', 'multidimensional', 'holographisch', 'virtuell'
]);

// Bekannte englische Adjektive
const ENGLISH_ADJECTIVES = new Set([
    // Colors - Basic
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'violet', 'pink',
    'brown', 'black', 'white', 'gray', 'grey', 'golden', 'silver', 'colorful',
    // Colors - Nuances
    'crimson', 'scarlet', 'maroon', 'burgundy', 'ruby', 'cherry', 'blood-red',
    'azure', 'navy', 'cobalt', 'indigo', 'turquoise', 'teal', 'cyan', 'aqua',
    'emerald', 'jade', 'olive', 'lime', 'mint', 'forest', 'chartreuse',
    'lemon', 'amber', 'ochre', 'saffron', 'canary', 'mustard', 'honey',
    'magenta', 'fuchsia', 'lavender', 'mauve', 'plum', 'lilac', 'orchid',
    'beige', 'cream', 'ivory', 'sand', 'caramel', 'chocolate', 'mahogany',
    'charcoal', 'slate', 'pewter', 'ash', 'pearl', 'smoke',
    // Light quality
    'bright', 'dark', 'light', 'vivid', 'pale', 'transparent', 'opaque',
    'radiant', 'luminous', 'gleaming', 'sparkling', 'glittering', 'dazzling',
    'phosphorescent', 'fluorescent', 'iridescent', 'opalescent', 'pearlescent',
    'neon', 'pastel', 'muted', 'saturated', 'faded', 'washed-out', 'bleached',
    // Size
    'big', 'small', 'large', 'tiny', 'huge', 'giant', 'long', 'short', 'tall',
    'wide', 'narrow', 'thick', 'thin', 'deep', 'shallow', 'massive', 'compact',
    'gigantic', 'colossal', 'monumental', 'microscopic', 'petite', 'towering',
    'vast', 'immense', 'boundless', 'limited', 'expanding', 'shrinking',
    // Shape
    'round', 'square', 'flat', 'straight', 'curved', 'wavy', 'spiral', 'pointed',
    'sharp', 'angular', 'circular', 'oval', 'rectangular', 'triangular',
    'hexagonal', 'polygonal', 'asymmetric', 'symmetric', 'organic', 'geometric',
    'fractal', 'amorphous', 'crystalline', 'faceted', 'prismatic', 'jagged',
    'conical', 'cylindrical', 'pyramidal', 'domed', 'arched', 'serrated',
    // Texture
    'smooth', 'rough', 'soft', 'hard', 'firm', 'loose', 'fluffy', 'silky', 'velvety',
    'shiny', 'matte', 'glossy', 'metallic', 'crystalline', 'glittering',
    'furry', 'fuzzy', 'bristly', 'spiky', 'thorny', 'grainy', 'sandy', 'gritty',
    'porous', 'spongy', 'elastic', 'rubbery', 'leathery', 'papery', 'glassy',
    'waxy', 'oily', 'greasy', 'wet', 'dry', 'cracked', 'crumbly', 'scaly',
    // Temperature
    'warm', 'cold', 'hot', 'cool', 'icy', 'freezing', 'burning', 'glowing',
    'frosty', 'frozen', 'molten', 'boiling', 'steaming', 'smoldering', 'sizzling',
    // Speed
    'fast', 'slow', 'quick', 'rapid', 'swift', 'sluggish', 'steady',
    'lightning', 'creeping', 'crawling', 'racing', 'rushing', 'moderate', 'gradual',
    // Intensity
    'strong', 'weak', 'intense', 'gentle', 'mild', 'heavy', 'light', 'fierce',
    'loud', 'quiet', 'silent', 'calm', 'wild', 'chaotic', 'harmonic', 'peaceful',
    'extreme', 'subtle', 'drastic', 'powerful', 'delicate', 'brutal', 'soft',
    'piercing', 'deafening', 'overwhelming', 'intoxicating', 'hypnotic', 'mesmerizing',
    // Quality
    'good', 'bad', 'beautiful', 'ugly', 'new', 'old', 'young', 'fresh',
    'clean', 'dirty', 'clear', 'pure', 'real', 'fake', 'true', 'false',
    'perfect', 'flawless', 'raw', 'refined', 'elegant', 'primitive', 'complex',
    'simple', 'plain', 'opulent', 'lush', 'minimalist', 'baroque', 'ornate',
    // Emotion
    'happy', 'sad', 'angry', 'fearful', 'brave', 'excited', 'relaxed', 'tense',
    'peaceful', 'aggressive', 'loving', 'joyful', 'melancholic', 'serene',
    'nostalgic', 'yearning', 'euphoric', 'ecstatic', 'desperate', 'hopeful',
    'resigned', 'confused', 'fascinated', 'enchanted', 'moved', 'touched',
    'shattered', 'stirred', 'captivated', 'mesmerized', 'bewitched', 'soulful',
    // Music
    'melodic', 'rhythmic', 'harmonic', 'dissonant', 'lyrical', 'dramatic',
    'epic', 'intimate', 'majestic', 'tender', 'powerful', 'pulsating', 'flowing',
    'symphonic', 'contrapuntal', 'polyphonic', 'monophonic', 'atonal', 'modal',
    'syncopated', 'staccato', 'legato', 'vibrating', 'resonant', 'reverberant',
    // Abstract
    'abstract', 'concrete', 'surreal', 'magical', 'mystical', 'cosmic',
    'infinite', 'eternal', 'timeless', 'fleeting', 'alive', 'dead', 'vivid',
    'transcendent', 'ethereal', 'spiritual', 'metaphysical', 'otherworldly',
    'utopian', 'dystopian', 'apocalyptic', 'primal', 'cyclic', 'linear',
    'parallel', 'dimensional', 'holographic', 'virtual', 'dreamlike', 'nightmarish'
]);

// Bekannte deutsche Substantive (visuell relevante)
const GERMAN_NOUNS = new Set([
    // Natur - Himmel
    'Sonne', 'Mond', 'Stern', 'Sterne', 'Himmel', 'Wolke', 'Wolken', 'Horizont',
    'Dämmerung', 'Morgenröte', 'Sonnenaufgang', 'Sonnenuntergang', 'Abendrot',
    'Aurora', 'Nordlicht', 'Polarlicht', 'Milchstraße', 'Galaxie', 'Nebula',
    // Natur - Wetter
    'Regen', 'Schnee', 'Hagel', 'Wind', 'Sturm', 'Orkan', 'Tornado', 'Hurrikan',
    'Blitz', 'Donner', 'Gewitter', 'Regenbogen', 'Nebel', 'Dunst', 'Tau', 'Frost',
    // Natur - Elemente
    'Feuer', 'Wasser', 'Erde', 'Luft', 'Flamme', 'Glut', 'Asche', 'Rauch', 'Dampf',
    'Eis', 'Schnee', 'Lava', 'Magma', 'Kristall', 'Mineral', 'Erz',
    // Natur - Landschaft
    'Berg', 'Berge', 'Gebirge', 'Gipfel', 'Tal', 'Schlucht', 'Klippe', 'Felsen',
    'Fluss', 'Bach', 'Strom', 'Wasserfall', 'Quelle', 'See', 'Teich',
    'Meer', 'Ozean', 'Welle', 'Wellen', 'Brandung', 'Gischt', 'Strand', 'Küste',
    'Wüste', 'Oase', 'Düne', 'Sand', 'Steppe', 'Savanne', 'Dschungel',
    'Wald', 'Forst', 'Hain', 'Lichtung', 'Wiese', 'Feld', 'Heide', 'Moor', 'Sumpf',
    // Natur - Pflanzen
    'Baum', 'Bäume', 'Blume', 'Blumen', 'Blüte', 'Blüten', 'Blatt', 'Blätter',
    'Gras', 'Halm', 'Zweig', 'Ast', 'Äste', 'Stamm', 'Wurzel', 'Wurzeln',
    'Rose', 'Lilie', 'Tulpe', 'Orchidee', 'Lotus', 'Sonnenblume', 'Mohn',
    'Farn', 'Moos', 'Pilz', 'Pilze', 'Ranke', 'Efeu', 'Klee',
    // Tiere
    'Vogel', 'Vögel', 'Fisch', 'Fische', 'Schmetterling', 'Schmetterlinge',
    'Katze', 'Hund', 'Pferd', 'Adler', 'Löwe', 'Tiger', 'Panther', 'Leopard',
    'Schlange', 'Drache', 'Drachen', 'Einhorn', 'Phoenix', 'Greif', 'Pegasus',
    'Wolf', 'Wölfe', 'Bär', 'Bären', 'Fuchs', 'Hirsch', 'Reh', 'Elch',
    'Schwan', 'Rabe', 'Krähe', 'Eule', 'Falke', 'Kolibri', 'Pfau',
    'Delphin', 'Wal', 'Hai', 'Qualle', 'Krake', 'Oktopus', 'Seepferdchen',
    'Spinne', 'Biene', 'Libelle', 'Käfer', 'Glühwürmchen', 'Zikade',
    // Körper
    'Auge', 'Augen', 'Hand', 'Hände', 'Herz', 'Herzen', 'Kopf', 'Gesicht',
    'Körper', 'Seele', 'Geist', 'Gehirn', 'Haut', 'Haar', 'Haare',
    'Flügel', 'Feder', 'Federn', 'Schuppe', 'Schuppen', 'Kralle', 'Klaue',
    // Objekte - Materialien
    'Licht', 'Schatten', 'Dunkelheit', 'Finsternis', 'Spiegel', 'Spiegelung',
    'Kristall', 'Kristalle', 'Diamant', 'Rubin', 'Saphir', 'Smaragd', 'Opal',
    'Gold', 'Silber', 'Bronze', 'Kupfer', 'Eisen', 'Stahl', 'Platin',
    'Glas', 'Stein', 'Steine', 'Metall', 'Holz', 'Stoff', 'Seide', 'Samt',
    'Perle', 'Perlen', 'Jade', 'Bernstein', 'Koralle', 'Elfenbein', 'Perlmutt',
    // Geometrie
    'Kreis', 'Kreise', 'Kugel', 'Kugeln', 'Linie', 'Linien', 'Punkt', 'Punkte',
    'Spirale', 'Spiralen', 'Welle', 'Wellen', 'Kurve', 'Kurven', 'Form', 'Formen',
    'Dreieck', 'Quadrat', 'Würfel', 'Pyramide', 'Pyramiden', 'Zylinder',
    'Prisma', 'Helix', 'Fraktal', 'Mandala', 'Mosaik', 'Netz', 'Gitter', 'Raster',
    // Musik
    'Ton', 'Töne', 'Klang', 'Klänge', 'Melodie', 'Melodien', 'Harmonie', 'Harmonien',
    'Rhythmus', 'Rhythmen', 'Takt', 'Note', 'Noten', 'Akkord', 'Akkorde',
    'Musik', 'Lied', 'Lieder', 'Symphonie', 'Konzert', 'Oper', 'Sonate', 'Fuge',
    'Stimme', 'Stimmen', 'Echo', 'Echos', 'Resonanz', 'Schwingung', 'Vibration',
    'Crescendo', 'Fortissimo', 'Pianissimo', 'Staccato', 'Legato',
    'Bass', 'Tenor', 'Alt', 'Sopran', 'Chor', 'Orchester', 'Ensemble',
    // Abstrakt
    'Traum', 'Träume', 'Vision', 'Visionen', 'Fantasie', 'Illusion', 'Illusionen',
    'Energie', 'Energien', 'Kraft', 'Kräfte', 'Magie', 'Zauber', 'Zauberei',
    'Zeit', 'Raum', 'Räume', 'Dimension', 'Dimensionen', 'Ebene', 'Ebenen',
    'Universum', 'Kosmos', 'All', 'Weltall', 'Unendlichkeit', 'Ewigkeit',
    'Liebe', 'Hass', 'Freude', 'Trauer', 'Angst', 'Hoffnung', 'Frieden', 'Krieg',
    'Leben', 'Tod', 'Geburt', 'Werden', 'Vergehen', 'Wandel', 'Transformation',
    'Chaos', 'Ordnung', 'Balance', 'Gleichgewicht', 'Harmonie', 'Dissonanz',
    'Stille', 'Ruhe', 'Leere', 'Nichts', 'Fülle', 'Reichtum', 'Überfluss',
    // Kunst
    'Bild', 'Bilder', 'Farbe', 'Farben', 'Kunst', 'Gemälde', 'Skulptur',
    'Muster', 'Textur', 'Texturen', 'Motiv', 'Motive', 'Symbol', 'Symbole',
    'Pinselstrich', 'Leinwand', 'Rahmen', 'Galerie', 'Ausstellung',
    // Architektur
    'Turm', 'Türme', 'Brücke', 'Brücken', 'Tor', 'Tore', 'Portal', 'Portale',
    'Fenster', 'Treppe', 'Treppen', 'Säule', 'Säulen', 'Bogen', 'Bögen',
    'Kuppel', 'Kuppeln', 'Dom', 'Kathedrale', 'Tempel', 'Palast', 'Schloss',
    'Ruine', 'Ruinen', 'Mauer', 'Mauern', 'Labyrinth', 'Irrgarten',
    // Lichtphänomene
    'Strahl', 'Strahlen', 'Funke', 'Funken', 'Blitz', 'Blitze', 'Schein',
    'Glanz', 'Schimmer', 'Glühen', 'Leuchten', 'Flackern', 'Flimmern',
    'Reflektion', 'Brechung', 'Spektrum', 'Prisma', 'Halo', 'Aureole', 'Aura'
]);

// Bekannte englische Substantive (visuell relevante)
const ENGLISH_NOUNS = new Set([
    // Nature - Sky
    'sun', 'moon', 'star', 'stars', 'sky', 'skies', 'cloud', 'clouds', 'horizon',
    'dawn', 'dusk', 'sunrise', 'sunset', 'twilight', 'aurora', 'galaxy', 'nebula',
    // Nature - Weather
    'rain', 'snow', 'hail', 'wind', 'storm', 'hurricane', 'tornado', 'cyclone',
    'lightning', 'thunder', 'rainbow', 'fog', 'mist', 'dew', 'frost', 'ice',
    // Nature - Elements
    'fire', 'water', 'earth', 'air', 'flame', 'flames', 'ember', 'embers',
    'ash', 'smoke', 'steam', 'vapor', 'lava', 'magma', 'crystal', 'mineral',
    // Nature - Landscape
    'mountain', 'mountains', 'peak', 'summit', 'valley', 'canyon', 'cliff', 'rock',
    'river', 'stream', 'waterfall', 'spring', 'lake', 'pond', 'pool',
    'sea', 'ocean', 'wave', 'waves', 'surf', 'spray', 'beach', 'shore', 'coast',
    'desert', 'oasis', 'dune', 'dunes', 'sand', 'savanna', 'jungle', 'rainforest',
    'forest', 'woods', 'grove', 'clearing', 'meadow', 'field', 'prairie', 'swamp',
    // Nature - Plants
    'tree', 'trees', 'flower', 'flowers', 'blossom', 'blossoms', 'bloom', 'blooms',
    'leaf', 'leaves', 'grass', 'blade', 'branch', 'branches', 'trunk', 'root', 'roots',
    'rose', 'lily', 'tulip', 'orchid', 'lotus', 'sunflower', 'poppy', 'daisy',
    'fern', 'moss', 'mushroom', 'vine', 'vines', 'ivy', 'clover', 'petal', 'petals',
    // Animals
    'bird', 'birds', 'fish', 'fishes', 'butterfly', 'butterflies', 'moth', 'moths',
    'cat', 'dog', 'horse', 'horses', 'eagle', 'lion', 'tiger', 'panther', 'leopard',
    'snake', 'serpent', 'dragon', 'dragons', 'unicorn', 'phoenix', 'griffin', 'pegasus',
    'wolf', 'wolves', 'bear', 'bears', 'fox', 'deer', 'stag', 'elk', 'moose',
    'swan', 'raven', 'crow', 'owl', 'falcon', 'hawk', 'hummingbird', 'peacock',
    'dolphin', 'whale', 'shark', 'jellyfish', 'octopus', 'seahorse', 'coral',
    'spider', 'bee', 'dragonfly', 'beetle', 'firefly', 'fireflies', 'cicada',
    // Body
    'eye', 'eyes', 'hand', 'hands', 'heart', 'hearts', 'head', 'face', 'faces',
    'body', 'bodies', 'soul', 'souls', 'spirit', 'spirits', 'mind', 'minds',
    'skin', 'hair', 'wing', 'wings', 'feather', 'feathers', 'scale', 'scales', 'claw',
    // Objects - Materials
    'light', 'lights', 'shadow', 'shadows', 'darkness', 'mirror', 'reflection',
    'crystal', 'crystals', 'diamond', 'diamonds', 'ruby', 'sapphire', 'emerald', 'opal',
    'gold', 'silver', 'bronze', 'copper', 'iron', 'steel', 'platinum',
    'glass', 'stone', 'stones', 'metal', 'wood', 'fabric', 'silk', 'velvet', 'satin',
    'pearl', 'pearls', 'jade', 'amber', 'coral', 'ivory', 'mother-of-pearl',
    // Geometry
    'circle', 'circles', 'sphere', 'spheres', 'line', 'lines', 'point', 'points',
    'spiral', 'spirals', 'wave', 'waves', 'curve', 'curves', 'shape', 'shapes', 'form', 'forms',
    'triangle', 'triangles', 'square', 'squares', 'cube', 'cubes', 'pyramid', 'pyramids',
    'prism', 'helix', 'fractal', 'fractals', 'mandala', 'mosaic', 'grid', 'mesh', 'web',
    // Music
    'tone', 'tones', 'sound', 'sounds', 'melody', 'melodies', 'harmony', 'harmonies',
    'rhythm', 'rhythms', 'beat', 'beats', 'note', 'notes', 'chord', 'chords',
    'music', 'song', 'songs', 'symphony', 'concert', 'opera', 'sonata', 'fugue',
    'voice', 'voices', 'echo', 'echoes', 'resonance', 'vibration', 'vibrations',
    'crescendo', 'bass', 'tenor', 'alto', 'soprano', 'choir', 'orchestra', 'ensemble',
    // Abstract
    'dream', 'dreams', 'vision', 'visions', 'fantasy', 'fantasies', 'illusion', 'illusions',
    'energy', 'energies', 'power', 'powers', 'force', 'forces', 'magic', 'spell', 'enchantment',
    'time', 'space', 'spaces', 'dimension', 'dimensions', 'realm', 'realms', 'void',
    'universe', 'cosmos', 'infinity', 'eternity', 'abyss', 'oblivion',
    'love', 'hate', 'joy', 'sorrow', 'grief', 'fear', 'hope', 'despair', 'peace', 'war',
    'life', 'death', 'birth', 'rebirth', 'change', 'transformation', 'metamorphosis',
    'chaos', 'order', 'balance', 'harmony', 'dissonance', 'silence', 'stillness',
    'emptiness', 'void', 'fullness', 'abundance', 'essence', 'existence',
    // Art
    'image', 'images', 'color', 'colors', 'colour', 'colours', 'art', 'painting',
    'sculpture', 'pattern', 'patterns', 'texture', 'textures', 'motif', 'symbol', 'symbols',
    'brushstroke', 'canvas', 'frame', 'gallery', 'masterpiece',
    // Architecture
    'tower', 'towers', 'bridge', 'bridges', 'gate', 'gates', 'portal', 'portals',
    'window', 'windows', 'stairs', 'stairway', 'column', 'columns', 'pillar', 'pillars',
    'arch', 'arches', 'dome', 'domes', 'cathedral', 'temple', 'palace', 'castle',
    'ruins', 'wall', 'walls', 'labyrinth', 'maze',
    // Light phenomena
    'ray', 'rays', 'beam', 'beams', 'spark', 'sparks', 'flash', 'glow', 'glimmer',
    'shimmer', 'shine', 'gleam', 'glitter', 'sparkle', 'flicker', 'halo', 'aura'
]);

// Verb-Endungen für Heuristik (Fallback)
const GERMAN_VERB_ENDINGS = ['en', 'ern', 'eln', 'igen', 'ieren'];
const GERMAN_VERB_PREFIXES = ['ge', 'be', 'ver', 'ent', 'er', 'zer', 'miss', 'auf', 'ab', 'an', 'aus', 'ein', 'vor', 'nach', 'mit', 'zu', 'über', 'unter', 'um', 'durch', 'wieder', 'wider'];

const GERMAN_ADJ_ENDINGS = ['ig', 'lich', 'isch', 'bar', 'sam', 'haft', 'los', 'voll', 'reich', 'arm', 'artig', 'förmig', 'mäßig'];
const ENGLISH_ADJ_ENDINGS = ['ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ial', 'ic', 'ish', 'ent', 'ant', 'ary', 'ory'];

// ============================================
// TEXT FILTERING - IMPROVED
// ============================================

/**
 * Klassifiziert ein Wort als Nomen, Verb oder Adjektiv
 * Verwendet Wortlisten + Heuristiken
 */
function classifyWord(word, lang) {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '');
    const originalWord = word.replace(/[.,!?;:'"()\[\]{}]/g, '');
    
    // Zu kurz
    if (cleanWord.length < 2) return { noun: false, verb: false, adj: false };
    
    // Stopword-Check
    const stopwords = lang === 'de' ? GERMAN_STOPWORDS : ENGLISH_STOPWORDS;
    if (stopwords.has(cleanWord)) return { noun: false, verb: false, adj: false };
    
    let isNoun = false, isVerb = false, isAdj = false;
    
    if (lang === 'de') {
        // === DEUTSCH ===
        
        // 1. Bekannte Substantive (exakter Match)
        if (GERMAN_NOUNS.has(originalWord) || GERMAN_NOUNS.has(cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1))) {
            isNoun = true;
        }
        
        // 2. Großschreibung = wahrscheinlich Substantiv (im Deutschen)
        if (!isNoun && originalWord.length > 0 && originalWord[0] === originalWord[0].toUpperCase() && /[A-ZÄÖÜ]/.test(originalWord[0])) {
            // Aber nicht wenn es ein bekanntes Verb/Adjektiv ist
            if (!GERMAN_VERBS.has(cleanWord) && !GERMAN_ADJECTIVES.has(cleanWord)) {
                isNoun = true;
            }
        }
        
        // 3. Bekannte Verben
        if (GERMAN_VERBS.has(cleanWord)) {
            isVerb = true;
        } else {
            // Verb-Heuristik: Endungen prüfen
            for (const ending of GERMAN_VERB_ENDINGS) {
                if (cleanWord.endsWith(ending) && cleanWord.length > ending.length + 2) {
                    // Zusätzlich: typische Verb-Präfixe?
                    const hasPrefix = GERMAN_VERB_PREFIXES.some(p => cleanWord.startsWith(p));
                    if (hasPrefix || ending === 'ieren') {
                        isVerb = true;
                        break;
                    }
                }
            }
        }
        
        // 4. Bekannte Adjektive
        if (GERMAN_ADJECTIVES.has(cleanWord)) {
            isAdj = true;
        } else {
            // Adjektiv-Heuristik: Endungen prüfen
            for (const ending of GERMAN_ADJ_ENDINGS) {
                if (cleanWord.endsWith(ending) && cleanWord.length > ending.length + 2) {
                    isAdj = true;
                    break;
                }
            }
        }
        
    } else {
        // === ENGLISCH ===
        
        // 1. Bekannte Substantive
        if (ENGLISH_NOUNS.has(cleanWord)) {
            isNoun = true;
        }
        
        // 2. Bekannte Verben
        if (ENGLISH_VERBS.has(cleanWord)) {
            isVerb = true;
        } else {
            // Verb-Formen erkennen: -ing, -ed, -s
            if (cleanWord.endsWith('ing') && cleanWord.length > 4) {
                const stem = cleanWord.slice(0, -3);
                if (ENGLISH_VERBS.has(stem) || ENGLISH_VERBS.has(stem + 'e')) {
                    isVerb = true;
                }
            } else if (cleanWord.endsWith('ed') && cleanWord.length > 3) {
                const stem = cleanWord.slice(0, -2);
                const stem2 = cleanWord.slice(0, -1); // für "loved" -> "love"
                if (ENGLISH_VERBS.has(stem) || ENGLISH_VERBS.has(stem2)) {
                    isVerb = true;
                }
            } else if (cleanWord.endsWith('s') && cleanWord.length > 2) {
                const stem = cleanWord.slice(0, -1);
                if (ENGLISH_VERBS.has(stem)) {
                    isVerb = true;
                }
            }
        }
        
        // 3. Bekannte Adjektive
        if (ENGLISH_ADJECTIVES.has(cleanWord)) {
            isAdj = true;
        } else {
            // Adjektiv-Heuristik
            for (const ending of ENGLISH_ADJ_ENDINGS) {
                if (cleanWord.endsWith(ending) && cleanWord.length > ending.length + 2) {
                    isAdj = true;
                    break;
                }
            }
        }
        
        // 4. Fallback: Wenn nichts erkannt, könnte es ein Nomen sein
        if (!isNoun && !isVerb && !isAdj && cleanWord.length > 2) {
            isNoun = true;
        }
    }
    
    return { noun: isNoun, verb: isVerb, adj: isAdj };
}

/**
 * Filtert Text nach Wortarten
 * @param {string} text - Eingabetext
 * @param {boolean} filterNouns - Substantive behalten
 * @param {boolean} filterVerbs - Verben behalten
 * @param {boolean} filterAdj - Adjektive behalten
 * @returns {string} Gefilterter Text
 */
export function filterTextByWordType(text, filterNouns, filterVerbs, filterAdj) {
    if (!text) return '';
    
    // Wenn kein Filter aktiv, alles zurückgeben (aber Stopwords entfernen)
    if (!filterNouns && !filterVerbs && !filterAdj) {
        return text;
    }
    
    const lang = speechState.language.startsWith('de') ? 'de' : 'en';
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const filteredWords = [];
    
    // Debug
    console.log(`🏷️ Filtering [${lang}]: "${text}"`);
    console.log(`🏷️ Filters: Nouns=${filterNouns}, Verbs=${filterVerbs}, Adj=${filterAdj}`);
    
    for (const word of words) {
        const classification = classifyWord(word, lang);
        
        let include = false;
        if (filterNouns && classification.noun) include = true;
        if (filterVerbs && classification.verb) include = true;
        if (filterAdj && classification.adj) include = true;
        
        if (include) {
            filteredWords.push(word);
            console.log(`  ✅ "${word}" -> N:${classification.noun} V:${classification.verb} A:${classification.adj}`);
        } else {
            console.log(`  ❌ "${word}" -> N:${classification.noun} V:${classification.verb} A:${classification.adj}`);
        }
    }
    
    const result = filteredWords.join(' ');
    console.log(`🏷️ Result: "${result}"`);
    
    return result;
}

// ============================================
// WEB SPEECH API (Backend 1)
// ============================================

function initWebSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusEl = document.getElementById('speechStatus');
    const checkbox = document.getElementById('speechEnabled');
    
    if (!SpeechRecognition) {
        if (statusEl) {
            statusEl.innerHTML = '❌ Web Speech nicht verfügbar';
            statusEl.style.color = '#f66';
        }
        return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechState.language;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        if (statusEl) {
            statusEl.innerHTML = '🔴 Hört zu... (Web Speech)';
            statusEl.style.color = '#4f4';
        }
    };
    
    recognition.onend = () => {
        if (speechState.enabled && speechState.backend === 'webspeech') {
            if (statusEl) {
                statusEl.innerHTML = '🟡 Neustart...';
                statusEl.style.color = '#ff0';
            }
            setTimeout(() => {
                if (speechState.enabled && speechState.backend === 'webspeech' && speechRecognition) {
                    try { speechRecognition.start(); } catch (e) {}
                }
            }, 300);
        } else {
            if (statusEl) {
                statusEl.innerHTML = '⏸ Off';
                statusEl.style.color = '#888';
            }
        }
    };
    
    recognition.onerror = (event) => {
        if (!statusEl) return;
        
        switch(event.error) {
            case 'no-speech':
                statusEl.innerHTML = '🔴 ...';
                break;
            case 'audio-capture':
                statusEl.innerHTML = '❌ Kein Mikrofon!';
                statusEl.style.color = '#f66';
                break;
            case 'not-allowed':
                statusEl.innerHTML = '❌ Nicht erlaubt!';
                statusEl.style.color = '#f66';
                speechState.enabled = false;
                if (checkbox) checkbox.checked = false;
                break;
            case 'network':
                statusEl.innerHTML = '❌ Netzwerk!';
                statusEl.style.color = '#f66';
                break;
            case 'aborted':
                break;
            default:
                statusEl.innerHTML = '⚠ ' + event.error;
                statusEl.style.color = '#f80';
        }
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            processRecognizedText(finalTranscript.trim());
        } else {
            updateSpeechUI(interimTranscript);
        }
    };
    
    return recognition;
}

// ============================================
// WHISPER COMFYUI (Backend 2)
// ============================================

let whisperComfyConnected = false;

async function checkWhisperComfyAvailable() {
    const statusEl = document.getElementById('whisperComfyStatus');
    
    try {
        // Check if ComfyUI is running and has whisper node
        const response = await fetch(`${speechState.whisperComfyUrl}/object_info/WhisperTranscribe`, {
            method: 'GET'
        });
        
        if (response.ok) {
            whisperComfyConnected = true;
            if (statusEl) {
                statusEl.innerHTML = '✅ Whisper Node verfügbar';
                statusEl.style.color = '#4f4';
            }
            return true;
        }
    } catch (e) {
        // Try alternative node names
        try {
            const response2 = await fetch(`${speechState.whisperComfyUrl}/object_info`, {
                method: 'GET'
            });
            if (response2.ok) {
                const data = await response2.json();
                // Check for any whisper-related node
                const hasWhisper = Object.keys(data).some(k => 
                    k.toLowerCase().includes('whisper') || 
                    k.toLowerCase().includes('speech') ||
                    k.toLowerCase().includes('transcribe')
                );
                
                if (hasWhisper) {
                    whisperComfyConnected = true;
                    if (statusEl) {
                        statusEl.innerHTML = '✅ Speech Node gefunden';
                        statusEl.style.color = '#4f4';
                    }
                    return true;
                }
            }
        } catch (e2) {}
    }
    
    whisperComfyConnected = false;
    if (statusEl) {
        statusEl.innerHTML = '❌ Whisper Node nicht gefunden - Installiere comfyui-whisper';
        statusEl.style.color = '#f66';
    }
    return false;
}

async function startWhisperComfy() {
    const statusEl = document.getElementById('speechStatus');
    
    if (!whisperComfyConnected) {
        const available = await checkWhisperComfyAvailable();
        if (!available) {
            if (statusEl) {
                statusEl.innerHTML = '❌ Whisper ComfyUI nicht verfügbar';
                statusEl.style.color = '#f66';
            }
            return;
        }
    }
    
    // Start recording from app audio
    await startAudioRecording();
    
    if (statusEl) {
        statusEl.innerHTML = '🎙️ Recording... (Whisper ComfyUI)';
        statusEl.style.color = '#4af';
    }
    
    // Process audio every 3 seconds
    whisperPollInterval = setInterval(async () => {
        if (!speechState.enabled || speechState.backend !== 'whisper-comfy') {
            return;
        }
        
        const audioBlob = await stopAndGetAudioBlob();
        if (audioBlob && audioBlob.size > 1000) {
            await transcribeWithComfyWhisper(audioBlob);
        }
        
        // Restart recording
        if (speechState.enabled && speechState.backend === 'whisper-comfy') {
            await startAudioRecording();
        }
    }, 3000);
}

async function transcribeWithComfyWhisper(audioBlob) {
    const statusEl = document.getElementById('speechStatus');
    
    try {
        // Convert blob to base64
        const reader = new FileReader();
        const base64Audio = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });
        
        // Create workflow for whisper
        const workflow = {
            "1": {
                "class_type": "LoadAudioBase64",
                "inputs": {
                    "audio_base64": base64Audio
                }
            },
            "2": {
                "class_type": "WhisperTranscribe",
                "inputs": {
                    "audio": ["1", 0],
                    "model": speechState.whisperModel,
                    "language": speechState.language.split('-')[0] // 'de' from 'de-DE'
                }
            }
        };
        
        // Queue the workflow
        const response = await fetch(`${speechState.whisperComfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (response.ok) {
            const data = await response.json();
            // Poll for result
            const result = await pollWhisperResult(data.prompt_id);
            if (result) {
                processRecognizedText(result);
            }
        }
    } catch (e) {
        console.error('Whisper ComfyUI error:', e);
        if (statusEl) {
            statusEl.innerHTML = '⚠️ Transcription Fehler';
            statusEl.style.color = '#f80';
        }
    }
}

async function pollWhisperResult(promptId, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 200));
        
        try {
            const response = await fetch(`${speechState.whisperComfyUrl}/history/${promptId}`);
            if (response.ok) {
                const history = await response.json();
                if (history[promptId]?.outputs) {
                    // Find text output
                    for (const nodeId of Object.keys(history[promptId].outputs)) {
                        const output = history[promptId].outputs[nodeId];
                        if (output.text) {
                            return output.text;
                        }
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

function stopWhisperComfy() {
    if (whisperPollInterval) {
        clearInterval(whisperPollInterval);
        whisperPollInterval = null;
    }
    stopAudioRecording();
}

// ============================================
// WHISPER LOCAL (Backend 3)
// ============================================

let whisperLocalAvailable = false;
let whisperLocalPath = null;

async function checkWhisperLocalAvailable() {
    const statusEl = document.getElementById('whisperLocalStatus');
    
    // Check via Electron IPC
    if (window.electronAPI?.checkWhisper) {
        try {
            const result = await window.electronAPI.checkWhisper();
            whisperLocalAvailable = result.available;
            whisperLocalPath = result.path;
            
            if (statusEl) {
                if (whisperLocalAvailable) {
                    statusEl.innerHTML = `✅ whisper.cpp gefunden: ${whisperLocalPath}`;
                    statusEl.style.color = '#4f4';
                } else {
                    statusEl.innerHTML = '❌ whisper.cpp nicht gefunden';
                    statusEl.style.color = '#f66';
                }
            }
            return whisperLocalAvailable;
        } catch (e) {
            console.warn('Electron whisper check failed:', e);
        }
    }
    
    // Fallback: Not in Electron or no API
    if (statusEl) {
        statusEl.innerHTML = '⚠️ Nur in Electron App verfügbar';
        statusEl.style.color = '#f80';
    }
    return false;
}

async function downloadWhisperModel() {
    const statusEl = document.getElementById('whisperLocalStatus');
    const model = speechState.whisperModel;
    
    if (!window.electronAPI?.downloadWhisperModel) {
        alert('Model Download nur in Electron App verfügbar');
        return;
    }
    
    if (statusEl) {
        statusEl.innerHTML = `⬇️ Downloading ${model} model...`;
        statusEl.style.color = '#ff0';
    }
    
    try {
        const result = await window.electronAPI.downloadWhisperModel(model);
        if (result.success) {
            if (statusEl) {
                statusEl.innerHTML = `✅ Model ${model} heruntergeladen`;
                statusEl.style.color = '#4f4';
            }
        } else {
            if (statusEl) {
                statusEl.innerHTML = `❌ Download fehlgeschlagen: ${result.error}`;
                statusEl.style.color = '#f66';
            }
        }
    } catch (e) {
        if (statusEl) {
            statusEl.innerHTML = `❌ Download Fehler: ${e.message}`;
            statusEl.style.color = '#f66';
        }
    }
}

/**
 * Listet alle verfügbaren Whisper-Modelle auf
 */
async function listAvailableWhisperModels() {
    const statusEl = document.getElementById('whisperLocalStatus');
    const modelsEl = document.getElementById('whisperAvailableModels');
    const modelSelect = document.getElementById('whisperLocalModel');
    
    if (!window.electronAPI?.listWhisperModels) {
        if (modelsEl) modelsEl.innerHTML = '⚠️ Nur in Electron App verfügbar';
        return;
    }
    
    if (statusEl) {
        statusEl.innerHTML = '🔍 Suche Modelle...';
        statusEl.style.color = '#ff0';
    }
    
    try {
        const result = await window.electronAPI.listWhisperModels();
        
        if (result.models && result.models.length > 0) {
            // Sortiere nach Größe
            const sorted = result.models.sort((a, b) => a.size - b.size);
            
            // Zeige gefundene Modelle
            const modelList = sorted.map(m => `✅ ${m.name} (${m.size}MB)`).join('<br>');
            
            if (modelsEl) {
                modelsEl.innerHTML = modelList;
                modelsEl.style.color = '#4f4';
            }
            
            if (statusEl) {
                statusEl.innerHTML = `✅ ${result.models.length} Modelle gefunden`;
                statusEl.style.color = '#4f4';
            }
            
            // Prüfe ob aktuell gewähltes Modell verfügbar ist
            const currentModel = speechState.whisperModel;
            const isAvailable = result.models.some(m => 
                m.name === currentModel || 
                m.name === currentModel.replace('-', '_') ||
                (currentModel === 'large-v3' && m.name === 'large')
            );
            
            if (!isAvailable && result.models.length > 0) {
                // Wähle bestes verfügbares Modell
                const best = sorted[sorted.length - 1]; // größstes
                speechState.whisperModel = best.name;
                if (modelSelect) modelSelect.value = best.name;
                
                console.log(`💡 Model '${currentModel}' not found, using '${best.name}' instead`);
            }
            
            console.log('🔍 Available whisper models:', result.models.map(m => m.name));
        } else {
            if (modelsEl) {
                modelsEl.innerHTML = '❌ Keine Modelle gefunden';
                modelsEl.style.color = '#f66';
            }
            
            if (statusEl) {
                statusEl.innerHTML = '❌ Keine Modelle installiert';
                statusEl.style.color = '#f66';
            }
            
            // Zeige wo gesucht wurde
            console.log('🔍 Searched paths:', result.searchedPaths);
        }
    } catch (e) {
        console.error('Error listing models:', e);
        if (statusEl) {
            statusEl.innerHTML = `❌ Fehler: ${e.message}`;
            statusEl.style.color = '#f66';
        }
    }
}

async function startWhisperLocal() {
    const statusEl = document.getElementById('speechStatus');
    
    if (!whisperLocalAvailable) {
        const available = await checkWhisperLocalAvailable();
        if (!available) {
            if (statusEl) {
                statusEl.innerHTML = '❌ Whisper Local nicht verfügbar';
                statusEl.style.color = '#f66';
            }
            return;
        }
    }
    
    // Start recording from app audio
    await startAudioRecording();
    
    if (statusEl) {
        statusEl.innerHTML = '🎙️ Recording... (Whisper Local)';
        statusEl.style.color = '#4f4';
    }
    
    // Process audio every 3 seconds
    whisperPollInterval = setInterval(async () => {
        if (!speechState.enabled || speechState.backend !== 'whisper-local') {
            return;
        }
        
        const audioBlob = await stopAndGetAudioBlob();
        if (audioBlob && audioBlob.size > 1000) {
            await transcribeWithLocalWhisper(audioBlob);
        }
        
        // Restart recording
        if (speechState.enabled && speechState.backend === 'whisper-local') {
            await startAudioRecording();
        }
    }, 3000);
}

async function transcribeWithLocalWhisper(audioBlob) {
    const statusEl = document.getElementById('speechStatus');
    
    if (!window.electronAPI?.transcribeWhisper) {
        console.error('Electron whisper API not available');
        return;
    }
    
    try {
        // Convert blob to ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        if (statusEl) {
            statusEl.innerHTML = '🔄 Transcribing...';
            statusEl.style.color = '#ff0';
        }
        
        const result = await window.electronAPI.transcribeWhisper({
            audio: Array.from(uint8Array),
            model: speechState.whisperModel,
            language: speechState.language.split('-')[0]
        });
        
        if (result.success && result.text) {
            processRecognizedText(result.text.trim());
            
            if (statusEl) {
                statusEl.innerHTML = '🎙️ Recording... (Whisper Local)';
                statusEl.style.color = '#4f4';
            }
        } else if (result.error) {
            console.error('Whisper error:', result.error);
        }
    } catch (e) {
        console.error('Local Whisper error:', e);
        if (statusEl) {
            statusEl.innerHTML = '⚠️ Transcription Fehler';
            statusEl.style.color = '#f80';
        }
    }
}

function stopWhisperLocal() {
    if (whisperPollInterval) {
        clearInterval(whisperPollInterval);
        whisperPollInterval = null;
    }
    stopAudioRecording();
}

// ============================================
// AUDIO RECORDING (for Whisper backends)
// ============================================

/**
 * Set the audio stream from main app
 * This allows Whisper to use the same audio input as pitch detection
 */
export function setAppAudioStream(stream) {
    appAudioStream = stream;
    console.log('🎙️ Speech: App audio stream set');
}

async function startAudioRecording() {
    if (speechState.isRecording) return;
    
    try {
        let stream = appAudioStream;
        
        // Fallback to default mic if no app stream
        if (!stream) {
            console.warn('No app audio stream, falling back to default mic');
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        speechState.recordedChunks = [];
        speechState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        speechState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                speechState.recordedChunks.push(e.data);
            }
        };
        
        speechState.mediaRecorder.start(100); // Collect data every 100ms
        speechState.isRecording = true;
        
    } catch (e) {
        console.error('Failed to start audio recording:', e);
    }
}

async function stopAndGetAudioBlob() {
    if (!speechState.mediaRecorder || !speechState.isRecording) {
        return null;
    }
    
    return new Promise((resolve) => {
        speechState.mediaRecorder.onstop = () => {
            const blob = new Blob(speechState.recordedChunks, { type: 'audio/webm' });
            speechState.recordedChunks = [];
            speechState.isRecording = false;
            resolve(blob);
        };
        
        speechState.mediaRecorder.stop();
    });
}

function stopAudioRecording() {
    if (speechState.mediaRecorder && speechState.isRecording) {
        try {
            speechState.mediaRecorder.stop();
        } catch (e) {}
    }
    speechState.isRecording = false;
    speechState.recordedChunks = [];
}

// ============================================
// COMMON FUNCTIONS
// ============================================

function processRecognizedText(text) {
    if (!text) return;
    
    speechHistory.push(text);
    if (speechHistory.length > maxSpeechHistory) {
        speechHistory.shift();
    }
    
    speechState.lastInput = text;
    
    const filtered = filterTextByWordType(
        text,
        speechState.filterNouns,
        speechState.filterVerbs,
        speechState.filterAdj
    );
    
    if (onSpeechResultCallback) {
        onSpeechResultCallback(text, filtered);
    }
    
    updateSpeechUI('');
}

function updateSpeechUI(interim = '') {
    const textEl = document.getElementById('speechText');
    if (!textEl) return;
    
    let html = '';
    
    speechHistory.forEach(text => {
        html += `<div class="final">${text}</div>`;
    });
    
    if (interim) {
        html += `<div class="interim">${interim}</div>`;
    }
    
    textEl.innerHTML = html;
    textEl.scrollTop = textEl.scrollHeight;
}

// ============================================
// CONTROL FUNCTIONS
// ============================================

export function startSpeech() {
    const statusEl = document.getElementById('speechStatus');
    
    if (statusEl) {
        statusEl.innerHTML = '🟡 Starte...';
        statusEl.style.color = '#ff0';
    }
    
    speechState.enabled = true;
    
    switch (speechState.backend) {
        case 'webspeech':
            if (!speechRecognition) {
                speechRecognition = initWebSpeechRecognition();
            }
            if (speechRecognition) {
                speechRecognition.lang = speechState.language;
                try {
                    speechRecognition.start();
                } catch (e) {
                    if (statusEl) {
                        statusEl.innerHTML = '⚠ Fehler';
                        statusEl.style.color = '#f80';
                    }
                }
            }
            break;
            
        case 'whisper-comfy':
            startWhisperComfy();
            break;
            
        case 'whisper-local':
            startWhisperLocal();
            break;
    }
}

export function stopSpeech() {
    speechState.enabled = false;
    
    // Stop all backends
    if (speechRecognition) {
        try { speechRecognition.stop(); } catch (e) {}
    }
    stopWhisperComfy();
    stopWhisperLocal();
    
    speechHistory = [];
    
    const textEl = document.getElementById('speechText');
    const statusEl = document.getElementById('speechStatus');
    
    if (textEl) textEl.innerHTML = '';
    if (statusEl) {
        statusEl.innerHTML = '⏸ Off';
        statusEl.style.color = '#888';
    }
}

export function setBackend(backend) {
    const wasEnabled = speechState.enabled;
    
    if (wasEnabled) {
        stopSpeech();
    }
    
    speechState.backend = backend;
    updateMicInfo();
    updateBackendUI();
    
    if (wasEnabled) {
        setTimeout(startSpeech, 100);
    }
}

export function setLanguage(lang) {
    speechState.language = lang;
    
    if (speechRecognition) {
        const wasEnabled = speechState.enabled;
        if (wasEnabled && speechState.backend === 'webspeech') {
            speechRecognition.stop();
        }
        speechRecognition.lang = lang;
        if (wasEnabled && speechState.backend === 'webspeech') {
            setTimeout(() => {
                try { speechRecognition.start(); } catch (e) {}
            }, 100);
        }
    }
}

function updateBackendUI() {
    const webSettings = document.getElementById('speechWebSettings');
    const comfySettings = document.getElementById('speechWhisperComfySettings');
    const localSettings = document.getElementById('speechWhisperLocalSettings');
    
    if (webSettings) webSettings.style.display = speechState.backend === 'webspeech' ? 'block' : 'none';
    if (comfySettings) comfySettings.style.display = speechState.backend === 'whisper-comfy' ? 'block' : 'none';
    if (localSettings) localSettings.style.display = speechState.backend === 'whisper-local' ? 'block' : 'none';
}

// ============================================
// SETTERS
// ============================================

export function setFilterNouns(enabled) {
    speechState.filterNouns = enabled;
}

export function setFilterVerbs(enabled) {
    speechState.filterVerbs = enabled;
}

export function setFilterAdj(enabled) {
    speechState.filterAdj = enabled;
}

export function setOnSpeechResultCallback(callback) {
    onSpeechResultCallback = callback;
}

export function setWhisperModel(model) {
    speechState.whisperModel = model;
}

// ============================================
// UI INITIALIZATION
// ============================================

export async function initSpeechUI() {
    console.log('initSpeechUI called');
    
    const checkbox = document.getElementById('speechEnabled');
    const langSelect = document.getElementById('speechLang');
    const backendSelect = document.getElementById('speechBackend');
    const statusEl = document.getElementById('speechStatus');
    
    // Detect system microphone
    await detectSystemMicrophone();
    updateMicInfo();
    
    // Backend selection
    if (backendSelect) {
        backendSelect.addEventListener('change', (e) => {
            setBackend(e.target.value);
        });
    }
    
    // Enable/Disable checkbox
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                startSpeech();
            } else {
                stopSpeech();
            }
        });
    }
    
    // Language selection
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
    
    // Whisper ComfyUI model selection
    const whisperComfyModelSelect = document.getElementById('whisperComfyModel');
    if (whisperComfyModelSelect) {
        whisperComfyModelSelect.addEventListener('change', (e) => {
            setWhisperModel(e.target.value);
        });
    }
    
    // Whisper Local model selection
    const whisperLocalModelSelect = document.getElementById('whisperLocalModel');
    if (whisperLocalModelSelect) {
        whisperLocalModelSelect.addEventListener('change', (e) => {
            setWhisperModel(e.target.value);
        });
    }
    
    // Download Whisper model button
    const downloadBtn = document.getElementById('whisperDownloadModel');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadWhisperModel);
    }
    
    // Check available models button
    const checkModelsBtn = document.getElementById('whisperCheckModels');
    if (checkModelsBtn) {
        checkModelsBtn.addEventListener('click', listAvailableWhisperModels);
    }
    
    // Test Whisper Local button
    const testBtn = document.getElementById('whisperTestLocal');
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            await checkWhisperLocalAvailable();
        });
    }
    
    // Check Whisper ComfyUI availability
    checkWhisperComfyAvailable();
    
    // Check Whisper Local availability and list models
    checkWhisperLocalAvailable();
    listAvailableWhisperModels();
    
    // Filter Checkboxes
    const nounsCheckbox = document.getElementById('aiFilterNouns');
    const verbsCheckbox = document.getElementById('aiFilterVerbs');
    const adjCheckbox = document.getElementById('aiFilterAdj');
    
    if (nounsCheckbox) {
        nounsCheckbox.addEventListener('change', (e) => setFilterNouns(e.target.checked));
    }
    if (verbsCheckbox) {
        verbsCheckbox.addEventListener('change', (e) => setFilterVerbs(e.target.checked));
    }
    if (adjCheckbox) {
        adjCheckbox.addEventListener('change', (e) => setFilterAdj(e.target.checked));
    }
    
    // Initial UI state
    updateBackendUI();
    
    console.log('Speech UI initialized');
}

// ============================================
// GETTERS
// ============================================

export function isSpeechEnabled() {
    return speechState.enabled;
}

export function getSpeechHistory() {
    return [...speechHistory];
}

export function getLastSpeechInput() {
    return speechState.lastInput;
}

export function getBackend() {
    return speechState.backend;
}
