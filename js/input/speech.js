/**
 * SPEECH RECOGNITION
 * 
 * Echtzeit-Spracherkennung mit Textfilterung
 * - Web Speech API
 * - Multi-Language Support (DE/EN)
 * - Wortarten-Filterung (Nomen, Verben, Adjektive)
 */

// ============================================
// STATE
// ============================================

let speechRecognition = null;
let speechHistory = [];
const maxSpeechHistory = 5;

export const speechState = {
    enabled: false,
    language: 'de-DE',
    filterNouns: true,
    filterVerbs: false,
    filterAdj: false,
    lastInput: ''
};

// Callback für erkannte Sprache
let onSpeechResultCallback = null;

// ============================================
// WORD LISTS
// ============================================

const GERMAN_STOPWORDS = new Set(['der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'Sie', 'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'in', 'an', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'zu', 'für', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen', 'durch', 'gegen', 'ohne', 'um', 'als', 'wenn', 'weil', 'dass', 'ob', 'nicht', 'auch', 'nur', 'noch', 'schon', 'sehr', 'so', 'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches', 'diesem', 'dieser', 'dieses', 'jeder', 'jede', 'jedes', 'alle', 'alles', 'mehr', 'viel', 'wenig', 'ganz', 'kann', 'könnte', 'möchte', 'muss', 'soll', 'darf', 'will', 'würde']);

const ENGLISH_STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'will', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'in', 'on', 'at', 'from', 'to', 'for', 'with', 'by', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'would', 'could', 'of', 'if', 'as', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom']);

const GERMAN_VERB_ENDINGS = ['en', 'st', 't', 'e', 'te', 'tet', 'ten', 'est', 'et'];
const GERMAN_ADJ_ENDINGS = ['ig', 'lich', 'isch', 'bar', 'sam', 'haft', 'los', 'voll', 'reich', 'arm', 'er', 'ere', 'erer', 'ste', 'sten'];
const ENGLISH_VERB_ENDINGS = ['ing', 'ed', 's', 'es'];
const ENGLISH_ADJ_ENDINGS = ['ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ial', 'ic', 'ly', 'y', 'ish', 'ent', 'ant'];

// ============================================
// TEXT FILTERING
// ============================================

/**
 * Filtert Text nach Wortarten
 */
export function filterTextByWordType(text, filterNouns, filterVerbs, filterAdj) {
    if (!text) return '';
    
    if (!filterNouns && !filterVerbs && !filterAdj) {
        return text;
    }
    
    const lang = speechState.language.startsWith('de') ? 'de' : 'en';
    const stopwords = lang === 'de' ? GERMAN_STOPWORDS : ENGLISH_STOPWORDS;
    const verbEndings = lang === 'de' ? GERMAN_VERB_ENDINGS : ENGLISH_VERB_ENDINGS;
    const adjEndings = lang === 'de' ? GERMAN_ADJ_ENDINGS : ENGLISH_ADJ_ENDINGS;
    
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const filteredWords = [];
    
    for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');
        
        if (stopwords.has(cleanWord)) continue;
        if (cleanWord.length < 2) continue;
        
        let isVerb = false, isAdj = false, isNoun = false;
        
        // Verb-Check
        for (const ending of verbEndings) {
            if (cleanWord.endsWith(ending) && cleanWord.length > ending.length + 2) {
                isVerb = true;
                break;
            }
        }
        
        // Adjektiv-Check
        for (const ending of adjEndings) {
            if (cleanWord.endsWith(ending) && cleanWord.length > ending.length + 2) {
                isAdj = true;
                break;
            }
        }
        
        // Nomen-Check
        if (lang === 'de' && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
            isNoun = true;
        } else if (!isVerb && !isAdj) {
            isNoun = true;
        }
        
        let include = false;
        if (filterNouns && isNoun) include = true;
        if (filterVerbs && isVerb) include = true;
        if (filterAdj && isAdj) include = true;
        
        if (include) {
            filteredWords.push(word);
        }
    }
    
    return filteredWords.join(' ');
}

// ============================================
// SPEECH RECOGNITION
// ============================================

/**
 * Initialisiert Speech Recognition
 */
export function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusEl = document.getElementById('speechStatus');
    const checkbox = document.getElementById('speechEnabled');
    
    if (!SpeechRecognition) {
        if (statusEl) {
            statusEl.innerHTML = '❌ Nicht verfügbar (nur Chrome)';
            statusEl.style.color = '#f66';
        }
        if (checkbox) checkbox.disabled = true;
        return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechState.language;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        if (statusEl) {
            statusEl.innerHTML = '🔴 Hört zu...';
            statusEl.style.color = '#4f4';
        }
    };
    
    recognition.onend = () => {
        if (speechState.enabled) {
            if (statusEl) {
                statusEl.innerHTML = '🟡 Neustart...';
                statusEl.style.color = '#ff0';
            }
            setTimeout(() => {
                if (speechState.enabled && speechRecognition) {
                    try { speechRecognition.start(); } catch (e) {}
                }
            }, 300);
        } else {
            if (statusEl) {
                statusEl.innerHTML = '⏸ Aus';
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
            const trimmed = finalTranscript.trim();
            speechHistory.push(trimmed);
            if (speechHistory.length > maxSpeechHistory) {
                speechHistory.shift();
            }
            
            speechState.lastInput = trimmed;
            
            // Gefilterten Text erstellen
            const filtered = filterTextByWordType(
                trimmed,
                speechState.filterNouns,
                speechState.filterVerbs,
                speechState.filterAdj
            );
            
            // Callback aufrufen
            if (onSpeechResultCallback) {
                onSpeechResultCallback(trimmed, filtered);
            }
            
            updateSpeechUI('');
        } else {
            updateSpeechUI(interimTranscript);
        }
    };
    
    recognition.onsoundstart = () => {
        if (statusEl) {
            statusEl.innerHTML = '🟢 Sound...';
            statusEl.style.color = '#4f4';
        }
    };
    
    recognition.onspeechstart = () => {
        if (statusEl) {
            statusEl.innerHTML = '🟢 Sprache!';
            statusEl.style.color = '#4f4';
        }
    };
    
    return recognition;
}

/**
 * Aktualisiert Speech UI
 */
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

/**
 * Startet Speech Recognition
 */
export function startSpeech() {
    const statusEl = document.getElementById('speechStatus');
    
    if (statusEl) {
        statusEl.innerHTML = '🟡 Starte...';
        statusEl.style.color = '#ff0';
    }
    
    if (!speechRecognition) {
        speechRecognition = initSpeechRecognition();
    }
    
    if (speechRecognition) {
        speechRecognition.lang = speechState.language;
        try {
            speechRecognition.start();
            speechState.enabled = true;
        } catch (e) {
            if (statusEl) {
                statusEl.innerHTML = '⚠ Fehler';
                statusEl.style.color = '#f80';
            }
        }
    }
}

/**
 * Stoppt Speech Recognition
 */
export function stopSpeech() {
    speechState.enabled = false;
    
    if (speechRecognition) {
        speechRecognition.stop();
    }
    
    speechHistory = [];
    
    const textEl = document.getElementById('speechText');
    const statusEl = document.getElementById('speechStatus');
    
    if (textEl) textEl.innerHTML = '';
    if (statusEl) {
        statusEl.innerHTML = '⏸ Aus';
        statusEl.style.color = '#888';
    }
}

/**
 * Setzt Sprache
 */
export function setLanguage(lang) {
    speechState.language = lang;
    
    if (speechRecognition) {
        const wasEnabled = speechState.enabled;
        if (wasEnabled) {
            speechRecognition.stop();
        }
        speechRecognition.lang = lang;
        if (wasEnabled) {
            setTimeout(() => {
                try { speechRecognition.start(); } catch (e) {}
            }, 100);
        }
    }
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

// ============================================
// UI INITIALIZATION
// ============================================

export function initSpeechUI() {
    const checkbox = document.getElementById('speechEnabled');
    const langSelect = document.getElementById('speechLang');
    
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                startSpeech();
            } else {
                stopSpeech();
            }
        });
    }
    
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
    
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
