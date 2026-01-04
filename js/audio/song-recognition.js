/**
 * SONG RECOGNITION & LYRICS
 * 
 * Erkennt laufende Musik und lädt Songtexte
 * - ACRCloud/AudD für Audio-Fingerprinting
 * - lyrics.ovh für Lyrics (kostenlos)
 * - Integration mit AI Prompt System
 */

// ============================================
// STATE
// ============================================

export const songState = {
    // Recognition
    enabled: false,
    isRecognizing: false,
    lastRecognition: null,
    recognitionInterval: null,
    
    // Current Song
    currentSong: null,  // { title, artist, album, duration }
    currentLyrics: null,
    lyricsLines: [],    // Aufgeteilte Zeilen
    currentLyricIndex: 0,
    
    // Settings
    autoRecognize: false,       // Automatisch alle X Sekunden erkennen
    recognizeIntervalSec: 30,   // Intervall in Sekunden
    useLyricsAsPrompt: false,   // Lyrics als AI Prompt verwenden
    lyricsScrollSpeed: 5000,    // ms pro Zeile
    
    // Provider Selection: 'acoustid', 'acrcloud', 'audd'
    provider: 'acoustid',
    
    // AcoustID (kostenlos, unlimitiert)
    acoustidApiKey: '',
    acoustidAppName: 'Synaesthesie',
    
    // ACRCloud
    acrHost: 'identify-eu-west-1.acrcloud.com',
    acrAccessKey: '',
    acrAccessSecret: '',
    
    // AudD
    auddApiToken: '',
    
    // Audio Recording
    mediaRecorder: null,
    recordedChunks: [],
    audioStream: null
};

// Lyrics scroll timer
let lyricsScrollTimer = null;

// Callbacks
let onSongRecognizedCallback = null;
let onLyricsLineCallback = null;

// UI Elements
let statusEl = null;
let songInfoEl = null;
let lyricsContainerEl = null;
let currentLineEl = null;

// ============================================
// INITIALIZATION
// ============================================

export function initSongRecognition() {
    console.log('🎵 Song Recognition initialized');
    
    // UI Elements
    statusEl = document.getElementById('songRecognitionStatus');
    songInfoEl = document.getElementById('songInfo');
    lyricsContainerEl = document.getElementById('lyricsContainer');
    currentLineEl = document.getElementById('currentLyricLine');
    
    // Load saved API keys and provider from localStorage
    const savedProvider = localStorage.getItem('song_provider');
    const savedAcoustidKey = localStorage.getItem('acoustid_key');
    const savedAcrKey = localStorage.getItem('acrcloud_key');
    const savedAcrSecret = localStorage.getItem('acrcloud_secret');
    const savedAuddToken = localStorage.getItem('audd_token');
    
    if (savedProvider) songState.provider = savedProvider;
    if (savedAcoustidKey) songState.acoustidApiKey = savedAcoustidKey;
    if (savedAcrKey) songState.acrAccessKey = savedAcrKey;
    if (savedAcrSecret) songState.acrAccessSecret = savedAcrSecret;
    if (savedAuddToken) songState.auddApiToken = savedAuddToken;
    
    console.log('🎵 Provider:', songState.provider, '| AcoustID key:', songState.acoustidApiKey ? '✅' : '❌');
    
    setupEventListeners();
}

function setupEventListeners() {
    // Recognize button
    const recognizeBtn = document.getElementById('songRecognizeBtn');
    if (recognizeBtn) {
        recognizeBtn.addEventListener('click', () => recognizeSong());
    }
    
    // Auto-recognize toggle
    const autoRecognizeEl = document.getElementById('songAutoRecognize');
    if (autoRecognizeEl) {
        autoRecognizeEl.checked = songState.autoRecognize;
        autoRecognizeEl.addEventListener('change', (e) => {
            songState.autoRecognize = e.target.checked;
            if (songState.autoRecognize) {
                startAutoRecognition();
            } else {
                stopAutoRecognition();
            }
        });
    }
    
    // Use lyrics as prompt toggle
    const useLyricsEl = document.getElementById('songUseLyricsAsPrompt');
    if (useLyricsEl) {
        useLyricsEl.checked = songState.useLyricsAsPrompt;
        useLyricsEl.addEventListener('change', (e) => {
            songState.useLyricsAsPrompt = e.target.checked;
            console.log('🎤 Lyrics as Prompt:', songState.useLyricsAsPrompt ? 'on' : 'off');
        });
    }
    
    // Interval slider
    const intervalEl = document.getElementById('songRecognizeInterval');
    const intervalValueEl = document.getElementById('songRecognizeIntervalValue');
    if (intervalEl) {
        intervalEl.value = songState.recognizeIntervalSec;
        if (intervalValueEl) intervalValueEl.textContent = `${songState.recognizeIntervalSec}s`;
        intervalEl.addEventListener('input', (e) => {
            songState.recognizeIntervalSec = parseInt(e.target.value);
            if (intervalValueEl) intervalValueEl.textContent = `${songState.recognizeIntervalSec}s`;
        });
    }
    
    // Lyrics scroll speed
    const scrollSpeedEl = document.getElementById('lyricsScrollSpeed');
    const scrollSpeedValueEl = document.getElementById('lyricsScrollSpeedValue');
    if (scrollSpeedEl) {
        scrollSpeedEl.value = songState.lyricsScrollSpeed / 1000;
        if (scrollSpeedValueEl) scrollSpeedValueEl.textContent = `${songState.lyricsScrollSpeed / 1000}s`;
        scrollSpeedEl.addEventListener('input', (e) => {
            songState.lyricsScrollSpeed = parseInt(e.target.value) * 1000;
            if (scrollSpeedValueEl) scrollSpeedValueEl.textContent = `${e.target.value}s`;
        });
    }
    
    // API Key inputs
    const acoustidKeyEl = document.getElementById('acoustidApiKey');
    const acrKeyEl = document.getElementById('acrAccessKey');
    const acrSecretEl = document.getElementById('acrAccessSecret');
    const auddTokenEl = document.getElementById('auddApiToken');
    
    if (acoustidKeyEl) {
        acoustidKeyEl.value = songState.acoustidApiKey;
        acoustidKeyEl.addEventListener('change', (e) => {
            songState.acoustidApiKey = e.target.value.trim();
            localStorage.setItem('acoustid_key', songState.acoustidApiKey);
            console.log('🎵 AcoustID API Key saved');
        });
    }
    
    if (acrKeyEl) {
        acrKeyEl.value = songState.acrAccessKey;
        acrKeyEl.addEventListener('change', (e) => {
            songState.acrAccessKey = e.target.value.trim();
            localStorage.setItem('acrcloud_key', songState.acrAccessKey);
        });
    }
    
    if (acrSecretEl) {
        acrSecretEl.value = songState.acrAccessSecret;
        acrSecretEl.addEventListener('change', (e) => {
            songState.acrAccessSecret = e.target.value.trim();
            localStorage.setItem('acrcloud_secret', songState.acrAccessSecret);
        });
    }
    
    if (auddTokenEl) {
        auddTokenEl.value = songState.auddApiToken;
        auddTokenEl.addEventListener('change', (e) => {
            songState.auddApiToken = e.target.value.trim();
            localStorage.setItem('audd_token', songState.auddApiToken);
        });
    }
    
    // Provider selector dropdown
    const providerEl = document.getElementById('songProvider');
    if (providerEl) {
        providerEl.value = songState.provider;
        providerEl.addEventListener('change', (e) => {
            songState.provider = e.target.value;
            localStorage.setItem('song_provider', songState.provider);
            console.log('🎵 Provider changed to:', songState.provider);
            updateProviderUI();
        });
    }
    
    // Fetch lyrics button
    const fetchLyricsBtn = document.getElementById('fetchLyricsBtn');
    if (fetchLyricsBtn) {
        fetchLyricsBtn.addEventListener('click', () => {
            if (songState.currentSong) {
                fetchLyrics(songState.currentSong.artist, songState.currentSong.title);
            }
        });
    }
    
    // Start/Stop lyrics scroll
    const startLyricsBtn = document.getElementById('startLyricsScroll');
    if (startLyricsBtn) {
        startLyricsBtn.addEventListener('click', toggleLyricsScroll);
    }
    
    // Clear song
    const clearSongBtn = document.getElementById('clearSongBtn');
    if (clearSongBtn) {
        clearSongBtn.addEventListener('click', clearCurrentSong);
    }
    
    // Manual song input
    const manualFetchBtn = document.getElementById('manualFetchBtn');
    const manualArtistEl = document.getElementById('manualArtist');
    const manualTitleEl = document.getElementById('manualTitle');
    
    if (manualFetchBtn && manualArtistEl && manualTitleEl) {
        manualFetchBtn.addEventListener('click', async () => {
            const artist = manualArtistEl.value.trim();
            const title = manualTitleEl.value.trim();
            
            if (artist && title) {
                await setManualSong(artist, title);
                manualFetchBtn.textContent = '✅';
                setTimeout(() => manualFetchBtn.textContent = '📝', 1000);
            } else {
                updateStatus('⚠️ Enter artist and title');
            }
        });
        
        // Enter-Taste in den Eingabefeldern
        [manualArtistEl, manualTitleEl].forEach(el => {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    manualFetchBtn.click();
                }
            });
        });
    }
    
    updateProviderUI();
}

function updateProviderUI() {
    const acoustidSettings = document.getElementById('acoustidSettings');
    const acrSettings = document.getElementById('acrcloudSettings');
    const auddSettings = document.getElementById('auddSettings');
    
    const provider = songState.provider;
    
    if (acoustidSettings) acoustidSettings.style.display = provider === 'acoustid' ? 'block' : 'none';
    if (acrSettings) acrSettings.style.display = provider === 'acrcloud' ? 'block' : 'none';
    if (auddSettings) auddSettings.style.display = provider === 'audd' ? 'block' : 'none';
}

// ============================================
// AUDIO RECORDING
// ============================================

/**
 * Nimmt Audio für Fingerprinting auf
 */
async function recordAudioSample(durationMs = 5000) {
    return new Promise(async (resolve, reject) => {
        try {
            // Versuche App-Audio zu bekommen (wenn verfügbar)
            let stream = songState.audioStream;
            
            if (!stream) {
                // Fallback: System-Audio via Electron
                if (window.electronAPI?.getDesktopAudio) {
                    try {
                        stream = await window.electronAPI.getDesktopAudio();
                    } catch (e) {
                        console.warn('Desktop audio not available:', e);
                    }
                }
            }
            
            if (!stream) {
                // Letzter Fallback: Mikrofon
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            
            const chunks = [];
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                resolve(blob);
            };
            
            mediaRecorder.onerror = (e) => {
                reject(e.error);
            };
            
            mediaRecorder.start();
            
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, durationMs);
            
        } catch (e) {
            reject(e);
        }
    });
}

// ============================================
// SONG RECOGNITION
// ============================================

/**
 * Hauptfunktion: Erkennt den aktuell spielenden Song
 */
export async function recognizeSong() {
    if (songState.isRecognizing) {
        console.log('⏳ Recognition already in progress');
        return null;
    }
    
    // Prüfe ob API konfiguriert ist
    const provider = songState.provider;
    
    if (provider === 'acoustid' && !songState.acoustidApiKey) {
        updateStatus('⚠️ AcoustID API Key fehlt');
        console.warn('⚠️ AcoustID API key not configured. Get one at https://acoustid.org/api-key');
        console.log('💡 Tipp: AcoustID ist kostenlos und hat keine Limits!');
        return null;
    }
    
    if (provider === 'audd' && !songState.auddApiToken) {
        updateStatus('⚠️ AudD API Token fehlt');
        console.warn('⚠️ AudD API Token not configured. Get one at https://audd.io/');
        return null;
    }
    
    if (provider === 'acrcloud' && (!songState.acrAccessKey || !songState.acrAccessSecret)) {
        updateStatus('⚠️ ACRCloud Keys fehlen');
        console.warn('⚠️ ACRCloud API keys not configured. Get them at https://console.acrcloud.com/');
        return null;
    }
    
    songState.isRecognizing = true;
    updateStatus(`🎧 Recording audio... (${provider})`);
    
    try {
        // 1. Audio aufnehmen (AcoustID braucht länger für bessere Erkennung)
        const recordDuration = provider === 'acoustid' ? 10000 : 5000;
        const audioBlob = await recordAudioSample(recordDuration);
        
        updateStatus(`🔍 Identifying song via ${provider}...`);
        
        // 2. Song erkennen je nach Provider
        let result;
        switch (provider) {
            case 'acoustid':
                result = await recognizeWithAcoustID(audioBlob);
                break;
            case 'audd':
                result = await recognizeWithAudD(audioBlob);
                break;
            case 'acrcloud':
            default:
                result = await recognizeWithACRCloud(audioBlob);
                break;
        }
        
        if (result && result.title) {
            songState.currentSong = result;
            songState.lastRecognition = new Date();
            
            updateSongInfo(result);
            updateStatus(`✅ Found: ${result.artist} - ${result.title}`);
            
            console.log('🎵 Song recognized:', result);
            
            // Callback auslösen
            if (onSongRecognizedCallback) {
                onSongRecognizedCallback(result);
            }
            
            // Automatisch Lyrics laden
            await fetchLyrics(result.artist, result.title);
            
            return result;
        } else {
            updateStatus('❌ Song not recognized');
            console.log('🎵 Song not found');
            return null;
        }
        
    } catch (e) {
        console.error('Recognition error:', e);
        updateStatus(`❌ Error: ${e.message}`);
        return null;
    } finally {
        songState.isRecognizing = false;
    }
}

/**
 * Erkennung via AcoustID (kostenlos, unlimitiert)
 * Verwendet Chromaprint für Audio-Fingerprinting
 */
async function recognizeWithAcoustID(audioBlob) {
    if (!songState.acoustidApiKey) {
        throw new Error('AcoustID API key not configured');
    }
    
    // Fingerprint berechnen (via Electron/fpcalc)
    let fingerprint, duration;
    
    if (window.electronAPI?.calculateFingerprint) {
        // Electron: Nutze fpcalc CLI
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const result = await window.electronAPI.calculateFingerprint(Array.from(uint8Array));
        
        if (!result.success) {
            throw new Error(result.error || 'Fingerprint calculation failed');
        }
        
        fingerprint = result.fingerprint;
        duration = result.duration;
    } else {
        // Browser Fallback: Nutze Web Audio API Fingerprint (vereinfacht)
        console.warn('⚠️ fpcalc not available, using simplified fingerprint');
        const fpResult = await calculateBrowserFingerprint(audioBlob);
        fingerprint = fpResult.fingerprint;
        duration = fpResult.duration;
    }
    
    console.log('💾 Fingerprint calculated, duration:', duration, 's');
    
    // AcoustID API aufrufen
    const params = new URLSearchParams({
        client: songState.acoustidApiKey,
        duration: Math.round(duration).toString(),
        fingerprint: fingerprint,
        meta: 'recordings releasegroups'  // Mehr Metadaten anfordern
    });
    
    const response = await fetch(`https://api.acoustid.org/v2/lookup?${params}`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.results && data.results.length > 0) {
        const best = data.results[0];
        
        if (best.recordings && best.recordings.length > 0) {
            const recording = best.recordings[0];
            
            // Artist extrahieren
            let artist = 'Unknown';
            if (recording.artists && recording.artists.length > 0) {
                artist = recording.artists.map(a => a.name).join(', ');
            }
            
            // Album extrahieren
            let album = '';
            if (recording.releasegroups && recording.releasegroups.length > 0) {
                album = recording.releasegroups[0].title || '';
            }
            
            return {
                title: recording.title,
                artist: artist,
                album: album,
                duration: recording.duration || 0,
                score: best.score,
                musicbrainzId: recording.id,
                source: 'acoustid'
            };
        }
    }
    
    return null;
}

/**
 * Browser-basierte Fingerprint-Berechnung (Fallback)
 * Weniger genau als fpcalc, aber funktioniert ohne Electron
 */
async function calculateBrowserFingerprint(audioBlob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Vereinfachter Fingerprint: Spektrale Features
        const fftSize = 4096;
        const hopSize = fftSize / 2;
        const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
        
        // Feature-Vektor erstellen
        const features = [];
        for (let i = 0; i < Math.min(numFrames, 100); i++) {
            const start = i * hopSize;
            const frame = channelData.slice(start, start + fftSize);
            
            // RMS Energy
            let sum = 0;
            for (let j = 0; j < frame.length; j++) {
                sum += frame[j] * frame[j];
            }
            const rms = Math.sqrt(sum / frame.length);
            
            // Zero Crossing Rate
            let zcr = 0;
            for (let j = 1; j < frame.length; j++) {
                if ((frame[j] >= 0) !== (frame[j-1] >= 0)) zcr++;
            }
            
            features.push(Math.round(rms * 1000));
            features.push(Math.round(zcr));
        }
        
        // Als Base64-ähnlichen String kodieren
        const fingerprint = btoa(features.join(','));
        
        return { fingerprint, duration };
        
    } finally {
        audioContext.close();
    }
}

/**
 * Erkennung via ACRCloud
 */
async function recognizeWithACRCloud(audioBlob) {
    if (!songState.acrAccessKey || !songState.acrAccessSecret) {
        throw new Error('ACRCloud API keys not configured');
    }
    
    // ACRCloud benötigt signierte Requests
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${songState.acrAccessKey}\naudio\n1\n${timestamp}`;
    
    // Signature berechnen (HMAC-SHA1)
    const signature = await hmacSha1(songState.acrAccessSecret, stringToSign);
    
    // FormData erstellen
    const formData = new FormData();
    formData.append('sample', audioBlob, 'sample.webm');
    formData.append('access_key', songState.acrAccessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${songState.acrHost}/v1/identify`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (data.status?.code === 0 && data.metadata?.music?.[0]) {
        const music = data.metadata.music[0];
        return {
            title: music.title,
            artist: music.artists?.[0]?.name || 'Unknown',
            album: music.album?.name || '',
            duration: music.duration_ms || 0,
            genres: music.genres?.map(g => g.name) || [],
            releaseDate: music.release_date || '',
            source: 'acrcloud'
        };
    }
    
    return null;
}

/**
 * Erkennung via AudD
 */
async function recognizeWithAudD(audioBlob) {
    if (!songState.auddApiToken) {
        throw new Error('AudD API token not configured');
    }
    
    // Audio zu Base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const response = await fetch('https://api.audd.io/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            api_token: songState.auddApiToken,
            audio: base64,
            return: 'lyrics'
        })
    });
    
    const data = await response.json();
    
    if (data.status === 'success' && data.result) {
        const result = data.result;
        return {
            title: result.title,
            artist: result.artist,
            album: result.album || '',
            duration: 0,
            lyrics: result.lyrics?.lyrics || null,
            source: 'audd'
        };
    }
    
    return null;
}

/**
 * HMAC-SHA1 für ACRCloud Signature
 */
async function hmacSha1(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const key = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ============================================
// LYRICS FETCHING
// ============================================

/**
 * Holt Lyrics von lyrics.ovh (kostenlos, kein API-Key)
 */
export async function fetchLyrics(artist, title) {
    if (!artist || !title) return null;
    
    updateStatus('📝 Fetching lyrics...');
    
    try {
        // lyrics.ovh API (kostenlos)
        const response = await fetch(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.lyrics) {
                songState.currentLyrics = data.lyrics;
                songState.lyricsLines = parseLyrics(data.lyrics);
                songState.currentLyricIndex = 0;
                
                displayLyrics(songState.lyricsLines);
                updateStatus(`📝 Lyrics loaded (${songState.lyricsLines.length} lines)`);
                
                console.log('📝 Lyrics fetched:', songState.lyricsLines.length, 'lines');
                return data.lyrics;
            }
        }
        
        // Fallback: Versuche alternativen Service
        const fallbackLyrics = await fetchLyricsAlternative(artist, title);
        if (fallbackLyrics) {
            return fallbackLyrics;
        }
        
        updateStatus('❌ Lyrics not found');
        return null;
        
    } catch (e) {
        console.error('Lyrics fetch error:', e);
        updateStatus('⚠️ Lyrics fetch failed');
        return null;
    }
}

/**
 * Alternative Lyrics-Quelle
 */
async function fetchLyricsAlternative(artist, title) {
    // Hier könnten weitere APIs hinzugefügt werden
    // z.B. Genius (benötigt API Key)
    return null;
}

/**
 * Parst Lyrics in einzelne Zeilen
 */
function parseLyrics(lyricsText) {
    if (!lyricsText) return [];
    
    return lyricsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('['));  // Filter [Verse], [Chorus] etc.
}

// ============================================
// LYRICS SCROLLING & PROMPT INTEGRATION
// ============================================

/**
 * Startet/Stoppt das automatische Lyrics-Scrolling
 */
export function toggleLyricsScroll() {
    if (lyricsScrollTimer) {
        stopLyricsScroll();
    } else {
        startLyricsScroll();
    }
}

function startLyricsScroll() {
    if (!songState.lyricsLines || songState.lyricsLines.length === 0) {
        console.log('⚠️ No lyrics to scroll');
        return;
    }
    
    const startBtn = document.getElementById('startLyricsScroll');
    if (startBtn) {
        startBtn.textContent = '⏸️ Stop';
        startBtn.style.background = 'linear-gradient(135deg, #a44, #622)';
    }
    
    // Erste Zeile sofort zeigen
    showLyricLine(songState.currentLyricIndex);
    
    // Timer für automatisches Weiterscrollen
    lyricsScrollTimer = setInterval(() => {
        songState.currentLyricIndex++;
        
        if (songState.currentLyricIndex >= songState.lyricsLines.length) {
            songState.currentLyricIndex = 0;  // Loop
        }
        
        showLyricLine(songState.currentLyricIndex);
        
    }, songState.lyricsScrollSpeed);
    
    console.log('▶️ Lyrics scroll started');
}

function stopLyricsScroll() {
    if (lyricsScrollTimer) {
        clearInterval(lyricsScrollTimer);
        lyricsScrollTimer = null;
    }
    
    const startBtn = document.getElementById('startLyricsScroll');
    if (startBtn) {
        startBtn.textContent = '▶️ Start';
        startBtn.style.background = '';
    }
    
    console.log('⏹️ Lyrics scroll stopped');
}

/**
 * Zeigt eine einzelne Lyrics-Zeile
 */
function showLyricLine(index) {
    const line = songState.lyricsLines[index];
    if (!line) return;
    
    // UI aktualisieren
    if (currentLineEl) {
        currentLineEl.textContent = line;
        currentLineEl.style.opacity = '0';
        setTimeout(() => {
            currentLineEl.style.opacity = '1';
        }, 50);
    }
    
    // Highlight in Lyrics Container
    const lineElements = lyricsContainerEl?.querySelectorAll('.lyric-line');
    lineElements?.forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
    
    // Scroll to active line
    const activeLine = lyricsContainerEl?.querySelector('.lyric-line.active');
    if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Callback für AI Prompt
    if (songState.useLyricsAsPrompt && onLyricsLineCallback) {
        onLyricsLineCallback(line);
    }
    
    console.log(`🎤 Lyric [${index + 1}/${songState.lyricsLines.length}]:`, line);
}

/**
 * Manuelle Zeilenauswahl
 */
export function selectLyricLine(index) {
    songState.currentLyricIndex = index;
    showLyricLine(index);
}

/**
 * Nächste/Vorherige Zeile
 */
export function nextLyricLine() {
    songState.currentLyricIndex = (songState.currentLyricIndex + 1) % songState.lyricsLines.length;
    showLyricLine(songState.currentLyricIndex);
}

export function prevLyricLine() {
    songState.currentLyricIndex = (songState.currentLyricIndex - 1 + songState.lyricsLines.length) % songState.lyricsLines.length;
    showLyricLine(songState.currentLyricIndex);
}

// ============================================
// AUTO RECOGNITION
// ============================================

function startAutoRecognition() {
    if (songState.recognitionInterval) {
        clearInterval(songState.recognitionInterval);
    }
    
    songState.recognitionInterval = setInterval(() => {
        if (!songState.isRecognizing) {
            recognizeSong();
        }
    }, songState.recognizeIntervalSec * 1000);
    
    console.log(`🔄 Auto-recognition started (every ${songState.recognizeIntervalSec}s)`);
}

function stopAutoRecognition() {
    if (songState.recognitionInterval) {
        clearInterval(songState.recognitionInterval);
        songState.recognitionInterval = null;
    }
    console.log('⏹️ Auto-recognition stopped');
}

// ============================================
// UI UPDATES
// ============================================

function updateStatus(message) {
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function updateSongInfo(song) {
    if (!songInfoEl) return;
    
    songInfoEl.innerHTML = `
        <div style="font-weight: bold; color: #fff;">${song.title}</div>
        <div style="color: #aaa;">${song.artist}</div>
        ${song.album ? `<div style="color: #666; font-size: 0.9em;">${song.album}</div>` : ''}
    `;
}

function displayLyrics(lines) {
    if (!lyricsContainerEl) return;
    
    lyricsContainerEl.innerHTML = lines.map((line, i) => 
        `<div class="lyric-line" data-index="${i}" style="padding: 4px 8px; cursor: pointer; border-radius: 3px; transition: all 0.2s;">${line}</div>`
    ).join('');
    
    // Click handler für manuelle Auswahl
    lyricsContainerEl.querySelectorAll('.lyric-line').forEach((el, i) => {
        el.addEventListener('click', () => selectLyricLine(i));
    });
}

function clearCurrentSong() {
    songState.currentSong = null;
    songState.currentLyrics = null;
    songState.lyricsLines = [];
    songState.currentLyricIndex = 0;
    
    stopLyricsScroll();
    
    if (songInfoEl) songInfoEl.innerHTML = '<span style="color: #666;">No song detected</span>';
    if (lyricsContainerEl) lyricsContainerEl.innerHTML = '';
    if (currentLineEl) currentLineEl.textContent = '-';
    
    updateStatus('Ready');
}

// ============================================
// CALLBACKS & INTEGRATION
// ============================================

/**
 * Setzt Callback für erkannte Songs
 */
export function onSongRecognized(callback) {
    onSongRecognizedCallback = callback;
}

/**
 * Setzt Callback für Lyrics-Zeilen (für AI Prompt)
 */
export function onLyricsLine(callback) {
    onLyricsLineCallback = callback;
}

/**
 * Setzt den Audio-Stream für Recognition
 */
export function setAudioStream(stream) {
    songState.audioStream = stream;
}

/**
 * Gibt die aktuelle Lyrics-Zeile zurück
 */
export function getCurrentLyricLine() {
    return songState.lyricsLines[songState.currentLyricIndex] || '';
}

/**
 * Gibt alle Lyrics zurück
 */
export function getAllLyrics() {
    return songState.currentLyrics;
}

/**
 * Gibt Song-Info zurück
 */
export function getCurrentSong() {
    return songState.currentSong;
}

/**
 * Manueller Song-Eintrag (ohne Recognition)
 */
export async function setManualSong(artist, title) {
    if (!artist || !title) {
        console.warn('⚠️ Artist and title required');
        return null;
    }
    
    songState.currentSong = {
        title: title,
        artist: artist,
        album: '',
        duration: 0,
        source: 'manual'
    };
    
    updateSongInfo(songState.currentSong);
    updateStatus(`✅ Set: ${artist} - ${title}`);
    
    // Lyrics laden
    await fetchLyrics(artist, title);
    
    return songState.currentSong;
}

// Export für manuelle Lyrics-Eingabe via Console
window.setSong = setManualSong;
window.fetchLyrics = fetchLyrics;
