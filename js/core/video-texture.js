/**
 * VIDEO TEXTURE
 * 
 * Ermöglicht das Laden von Video-Dateien als Textur für 3D-Modelle
 * - Mehrere Videos in Library laden
 * - VideoTexture für Three.js erstellen
 * - Auf Modell-Materialien anwenden
 * - Playback-Kontrolle (Play/Pause, Loop, Geschwindigkeit)
 * - Thumbnail-Galerie für schnelles Wechseln
 */

import { THREE } from './three-setup.js';
import { modelState } from '../models/model-manager.js';

// ============================================
// STATE
// ============================================

export const videoState = {
    // Video Element
    videoElement: null,
    videoTexture: null,
    
    // Status
    enabled: false,
    loaded: false,
    playing: false,
    
    // Settings
    loop: true,
    playbackRate: 1.0,
    volume: 0,  // Default muted
    opacity: 1.0,
    
    // Blending
    blendMode: 'replace', // 'replace', 'multiply', 'add', 'overlay'
    blendAmount: 1.0,
    
    // Displacement
    displacementScale: 0, // -1000 bis +1000
    displacementAudioReactive: false, // Audio-reaktives Displacement
    currentAudioLevel: 0, // Aktueller Audio-Pegel für Displacement
    
    // Apply to all models
    applyToAllModels: true, // Textur auf alle Modelle anwenden (bei Wechsel)
    
    // Current Video Info
    currentFile: null,
    fileName: '',
    duration: 0,
    currentTime: 0,
    
    // Video Library (Multi-Video Support)
    library: [],  // Array of { id, file, name, url, thumbnail, duration }
    currentVideoId: null,
    nextVideoId: 1,
    
    // Auto-Cycle
    autoCycle: false,
    cycleInterval: 10000, // 10 Sekunden
    
    // Original Materials (für Reset)
    originalMaterials: new Map()
};

// UI Elements
let videoInput = null;
let videoPreview = null;
let videoStatus = null;
let playPauseBtn = null;
let progressSlider = null;
let timeDisplay = null;
let visibilityBtn = null;
let libraryContainer = null;
let libraryCount = null;

// Auto-cycle Timer
let cycleTimer = null;

// ============================================
// VIDEO ELEMENT SETUP
// ============================================

/**
 * Erstellt das versteckte Video-Element
 */
function createVideoElement() {
    if (videoState.videoElement) return videoState.videoElement;
    
    const video = document.createElement('video');
    video.id = 'videoTextureSource';
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = true;
    video.loop = videoState.loop;
    video.style.display = 'none';
    document.body.appendChild(video);
    
    // Event Listeners
    video.addEventListener('loadedmetadata', () => {
        console.log('Video loadedmetadata:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
        });
        videoState.duration = video.duration;
        videoState.loaded = true;
        updateVideoStatus('loaded');
        
        // Update library entry with duration
        const entry = videoState.library.find(v => v.id === videoState.currentVideoId);
        if (entry && !entry.duration) {
            entry.duration = video.duration;
            updateLibraryUI();
        }
    });
    
    video.addEventListener('canplay', () => {
        console.log('Video canplay event, readyState:', video.readyState);
    });
    
    video.addEventListener('timeupdate', () => {
        videoState.currentTime = video.currentTime;
        updateTimeDisplay();
        updateProgressSlider();
    });
    
    video.addEventListener('play', () => {
        videoState.playing = true;
        updatePlayPauseBtn();
    });
    
    video.addEventListener('pause', () => {
        videoState.playing = false;
        updatePlayPauseBtn();
    });
    
    video.addEventListener('ended', () => {
        if (!videoState.loop) {
            videoState.playing = false;
            updatePlayPauseBtn();
            
            // Auto-cycle to next video
            if (videoState.autoCycle && videoState.library.length > 1) {
                playNextVideo();
            }
        }
    });
    
    video.addEventListener('error', (e) => {
        console.error('Video Fehler:', e);
        updateVideoStatus('error');
    });
    
    videoState.videoElement = video;
    return video;
}

// ============================================
// VIDEO LIBRARY MANAGEMENT
// ============================================

/**
 * Fügt ein Video zur Library hinzu
 */
export function addVideoToLibrary(file) {
    if (!file) return null;
    
    console.log('Adding video to library:', file.name, file.type, file.size);
    
    const id = videoState.nextVideoId++;
    const url = URL.createObjectURL(file);
    
    const entry = {
        id,
        file,
        name: file.name,
        url,
        thumbnail: null,
        duration: null
    };
    
    // Thumbnail generieren
    generateThumbnail(entry);
    
    videoState.library.push(entry);
    updateLibraryUI();
    
    // Wenn erstes Video, automatisch laden
    if (videoState.library.length === 1) {
        console.log('First video, auto-loading...');
        loadVideoFromLibrary(id);
    }
    
    return entry;
}

/**
 * Fügt mehrere Videos zur Library hinzu
 */
export function addVideosToLibrary(files) {
    for (const file of files) {
        if (file.type.startsWith('video/')) {
            addVideoToLibrary(file);
        }
    }
}

/**
 * Generiert ein Thumbnail für ein Video
 */
function generateThumbnail(entry) {
    const video = document.createElement('video');
    video.src = entry.url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    
    video.addEventListener('loadeddata', () => {
        // Springe zu 1 Sekunde für Thumbnail
        video.currentTime = Math.min(1, video.duration * 0.1);
    });
    
    video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 45;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        entry.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        entry.duration = video.duration;
        
        updateLibraryUI();
        video.src = ''; // Cleanup
    });
}

/**
 * Entfernt ein Video aus der Library
 */
export function removeVideoFromLibrary(id) {
    const index = videoState.library.findIndex(v => v.id === id);
    if (index === -1) return;
    
    const entry = videoState.library[index];
    
    // URL freigeben
    URL.revokeObjectURL(entry.url);
    
    // Aus Array entfernen
    videoState.library.splice(index, 1);
    
    // Wenn aktuelles Video entfernt wurde
    if (videoState.currentVideoId === id) {
        if (videoState.library.length > 0) {
            // Nächstes Video laden
            loadVideoFromLibrary(videoState.library[0].id);
        } else {
            // Kein Video mehr
            cleanupCurrentVideo();
        }
    }
    
    updateLibraryUI();
}

/**
 * Lädt ein Video aus der Library
 */
export function loadVideoFromLibrary(id) {
    const entry = videoState.library.find(v => v.id === id);
    if (!entry) {
        console.warn('Video nicht in Library gefunden:', id);
        return;
    }
    
    console.log('loadVideoFromLibrary:', entry.name);
    
    const video = createVideoElement();
    
    // Vorheriges Video pausieren
    video.pause();
    
    videoState.currentVideoId = id;
    videoState.currentFile = entry.file;
    videoState.fileName = entry.name;
    videoState.loaded = false;
    
    updateVideoStatus('loading');
    
    video.src = entry.url;
    video.load();
    
    // Preview aktualisieren
    if (videoPreview) {
        videoPreview.src = entry.url;
        videoPreview.style.display = 'block';
    }
    
    // Highlight in Library
    updateLibraryUI();
    
    // Texture neu erstellen wenn aktiv
    if (videoState.enabled) {
        const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            console.log('Video ready (canplay), recreating texture');
            videoState.loaded = true;
            createVideoTexture();
            applyVideoToModel();
            playVideo();
        };
        video.addEventListener('canplay', onCanPlay);
    }
}

/**
 * Spielt das nächste Video in der Library
 */
export function playNextVideo() {
    if (videoState.library.length <= 1) return;
    
    const currentIndex = videoState.library.findIndex(v => v.id === videoState.currentVideoId);
    const nextIndex = (currentIndex + 1) % videoState.library.length;
    loadVideoFromLibrary(videoState.library[nextIndex].id);
    
    if (videoState.enabled) {
        setTimeout(() => playVideo(), 100);
    }
}

/**
 * Spielt das vorherige Video in der Library
 */
export function playPrevVideo() {
    if (videoState.library.length <= 1) return;
    
    const currentIndex = videoState.library.findIndex(v => v.id === videoState.currentVideoId);
    const prevIndex = (currentIndex - 1 + videoState.library.length) % videoState.library.length;
    loadVideoFromLibrary(videoState.library[prevIndex].id);
    
    if (videoState.enabled) {
        setTimeout(() => playVideo(), 100);
    }
}

/**
 * Bereinigt das aktuelle Video
 */
function cleanupCurrentVideo() {
    pauseVideo();
    
    if (videoState.videoTexture) {
        videoState.videoTexture.dispose();
        videoState.videoTexture = null;
    }
    
    videoState.loaded = false;
    videoState.currentFile = null;
    videoState.currentVideoId = null;
    videoState.fileName = '';
    videoState.duration = 0;
    
    if (videoPreview) {
        videoPreview.style.display = 'none';
    }
    
    updateVideoStatus('none');
}

// ============================================
// VIDEO TEXTURE
// ============================================

/**
 * Erstellt eine Three.js VideoTexture
 */
export function createVideoTexture() {
    console.log('createVideoTexture called', {
        videoElement: !!videoState.videoElement,
        loaded: videoState.loaded,
        readyState: videoState.videoElement?.readyState,
        videoWidth: videoState.videoElement?.videoWidth,
        videoHeight: videoState.videoElement?.videoHeight
    });
    
    if (!videoState.videoElement) {
        console.warn('Kein Video-Element vorhanden');
        return null;
    }
    
    if (videoState.videoElement.readyState < 2) {
        console.warn('Video noch nicht bereit, readyState:', videoState.videoElement.readyState);
        return null;
    }
    
    if (videoState.videoTexture) {
        videoState.videoTexture.dispose();
    }
    
    const texture = new THREE.VideoTexture(videoState.videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    videoState.videoTexture = texture;
    console.log('VideoTexture created successfully');
    return texture;
}

/**
 * Wendet die Video-Textur auf das aktuelle Modell an
 */
export function applyVideoToModel() {
    console.log('applyVideoToModel called', {
        hasModel: !!modelState.currentModel,
        hasTexture: !!videoState.videoTexture,
        modelChildren: modelState.currentModel?.children?.length
    });
    
    if (!modelState.currentModel) {
        console.warn('Kein Modell geladen');
        return;
    }
    
    if (!videoState.videoTexture) {
        console.log('Keine Textur vorhanden, erstelle neue...');
        createVideoTexture();
    }
    
    if (!videoState.videoTexture) {
        console.error('Konnte keine VideoTexture erstellen!');
        return;
    }
    
    let meshCount = 0;
    const normalizedDisplacement = videoState.displacementScale / 100;
    
    modelState.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
            meshCount++;
            
            // Original-Material speichern
            if (!videoState.originalMaterials.has(child.uuid)) {
                videoState.originalMaterials.set(child.uuid, {
                    map: child.material.map,
                    emissiveMap: child.material.emissiveMap,
                    displacementMap: child.material.displacementMap,
                    displacementScale: child.material.displacementScale,
                    color: child.material.color.clone(),
                    emissive: child.material.emissive ? child.material.emissive.clone() : null
                });
            }
            
            // Video-Textur anwenden basierend auf Blend-Mode
            switch (videoState.blendMode) {
                case 'replace':
                    child.material.map = videoState.videoTexture;
                    child.material.emissiveMap = videoState.videoTexture;
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = videoState.blendAmount * 0.5;
                    break;
                    
                case 'multiply':
                    child.material.map = videoState.videoTexture;
                    child.material.emissiveMap = null;
                    break;
                    
                case 'add':
                    child.material.emissiveMap = videoState.videoTexture;
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = videoState.blendAmount;
                    break;
                    
                case 'overlay':
                    child.material.map = videoState.videoTexture;
                    child.material.emissiveMap = videoState.videoTexture;
                    child.material.emissiveIntensity = videoState.blendAmount * 0.3;
                    break;
            }
            
            // Displacement anwenden
            if (videoState.displacementScale !== 0) {
                child.material.displacementMap = videoState.videoTexture;
                child.material.displacementScale = normalizedDisplacement * 0.5;
                child.material.displacementBias = -normalizedDisplacement * 0.25;
            } else {
                child.material.displacementMap = null;
                child.material.displacementScale = 0;
            }
            
            child.material.needsUpdate = true;
        }
    });
    
    console.log(`Video texture applied to ${meshCount} meshes`);
    videoState.enabled = true;
    updateVisibilityBtn(true);
}

/**
 * Entfernt die Video-Textur vom Modell
 */
export function removeVideoFromModel() {
    if (!modelState.currentModel) return;
    
    modelState.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
            const original = videoState.originalMaterials.get(child.uuid);
            if (original) {
                child.material.map = original.map;
                child.material.emissiveMap = original.emissiveMap;
                child.material.displacementMap = original.displacementMap || null;
                child.material.displacementScale = original.displacementScale || 0;
                if (original.color) child.material.color.copy(original.color);
                if (original.emissive) child.material.emissive.copy(original.emissive);
                child.material.emissiveIntensity = 0.3;
                child.material.needsUpdate = true;
            }
        }
    });
    
    videoState.originalMaterials.clear();
    videoState.enabled = false;
    lastModelUuid = null;
    updateVisibilityBtn(false);
}

// ============================================
// PLAYBACK CONTROL
// ============================================

export function playVideo() {
    if (videoState.videoElement && videoState.loaded) {
        videoState.videoElement.play();
    }
}

export function pauseVideo() {
    if (videoState.videoElement) {
        videoState.videoElement.pause();
    }
}

export function togglePlayPause() {
    if (videoState.playing) {
        pauseVideo();
    } else {
        playVideo();
    }
}

export function setVideoTime(time) {
    if (videoState.videoElement && videoState.loaded) {
        videoState.videoElement.currentTime = Math.max(0, Math.min(time, videoState.duration));
    }
}

export function setPlaybackRate(rate) {
    videoState.playbackRate = rate;
    if (videoState.videoElement) {
        videoState.videoElement.playbackRate = rate;
    }
}

export function setLoop(enabled) {
    videoState.loop = enabled;
    if (videoState.videoElement) {
        videoState.videoElement.loop = enabled;
    }
}

export function setVideoVolume(vol) {
    videoState.volume = vol;
    if (videoState.videoElement) {
        videoState.videoElement.volume = vol;
        videoState.videoElement.muted = vol === 0;
    }
}

export function setBlendMode(mode) {
    videoState.blendMode = mode;
    if (videoState.enabled) {
        applyVideoToModel();
    }
}

export function setBlendAmount(amount) {
    videoState.blendAmount = amount;
    if (videoState.enabled) {
        applyVideoToModel();
    }
}

/**
 * Setzt den Displacement-Wert
 * @param {number} value - Wert von -1000 bis +1000
 */
export function setDisplacement(value) {
    videoState.displacementScale = value;
    
    if (!videoState.enabled || !modelState.currentModel) return;
    
    applyDisplacementToModel();
}

/**
 * Setzt Audio-Reactive Displacement
 */
export function setDisplacementAudioReactive(enabled) {
    videoState.displacementAudioReactive = enabled;
    
    // Display und Slider zurücksetzen wenn deaktiviert
    if (!enabled) {
        const display = document.getElementById('videoDisplacementValue');
        const slider = document.getElementById('videoDisplacement');
        if (display) {
            display.textContent = videoState.displacementScale;
            display.style.color = ''; // Zurück zu default
        }
        if (slider) {
            slider.value = videoState.displacementScale;
        }
    }
}

/**
 * Setzt ob Textur auf alle Modelle angewendet werden soll
 */
export function setApplyToAllModels(enabled) {
    videoState.applyToAllModels = enabled;
}

/**
 * Wendet Displacement auf das Modell an
 */
function applyDisplacementToModel() {
    if (!modelState.currentModel || !videoState.videoTexture) return;
    
    let effectiveScale = videoState.displacementScale;
    
    // Audio-Reactive: Displacement mit Audio-Level modulieren
    if (videoState.displacementAudioReactive) {
        effectiveScale *= videoState.currentAudioLevel;
    }
    
    const normalizedScale = effectiveScale / 1000; // -1 bis +1
    
    modelState.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
            if (effectiveScale !== 0) {
                child.material.displacementMap = videoState.videoTexture;
                child.material.displacementScale = normalizedScale * 2.0; // Skalierungsfaktor
                child.material.displacementBias = -normalizedScale * 0.5;
            } else {
                child.material.displacementMap = null;
                child.material.displacementScale = 0;
            }
            child.material.needsUpdate = true;
        }
    });
}

/**
 * Auto-Cycle ein/ausschalten
 */
export function setAutoCycle(enabled) {
    videoState.autoCycle = enabled;
    
    if (enabled && videoState.library.length > 1) {
        startCycleTimer();
    } else {
        stopCycleTimer();
    }
}

function startCycleTimer() {
    stopCycleTimer();
    cycleTimer = setInterval(() => {
        if (videoState.autoCycle && videoState.enabled) {
            playNextVideo();
        }
    }, videoState.cycleInterval);
}

function stopCycleTimer() {
    if (cycleTimer) {
        clearInterval(cycleTimer);
        cycleTimer = null;
    }
}

/**
 * Schaltet Video-Textur ein/aus (für Auge-Icon)
 */
export function toggleVideoEnabled() {
    console.log('toggleVideoEnabled called, current state:', {
        enabled: videoState.enabled,
        loaded: videoState.loaded,
        libraryLength: videoState.library.length,
        videoElement: !!videoState.videoElement,
        readyState: videoState.videoElement?.readyState
    });
    
    if (videoState.enabled) {
        // Ausschalten
        removeVideoFromModel();
        pauseVideo();
        updateVisibilityBtn(false);
        console.log('Video texture disabled');
    } else {
        // Einschalten
        if (videoState.loaded && videoState.videoElement?.readyState >= 2) {
            // Video ist bereit
            createVideoTexture();
            applyVideoToModel();
            playVideo();
            console.log('Video texture enabled (video was ready)');
        } else if (videoState.library.length > 0) {
            // Video aus Library laden und warten bis es bereit ist
            const entry = videoState.library.find(v => v.id === videoState.currentVideoId) || videoState.library[0];
            console.log('Loading video from library:', entry.name);
            
            const video = videoState.videoElement || createVideoElement();
            
            const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay);
                console.log('Video canplay event fired, applying texture');
                videoState.loaded = true;
                createVideoTexture();
                applyVideoToModel();
                playVideo();
            };
            
            video.addEventListener('canplay', onCanPlay);
            
            // Falls Video bereits geladen ist
            if (video.readyState >= 3) {
                video.removeEventListener('canplay', onCanPlay);
                videoState.loaded = true;
                createVideoTexture();
                applyVideoToModel();
                playVideo();
                console.log('Video was already loaded, applied immediately');
            } else if (video.src !== entry.url) {
                // Video neu laden
                video.src = entry.url;
                video.load();
                videoState.currentVideoId = entry.id;
                videoState.fileName = entry.name;
            }
        } else {
            console.warn('Keine Videos in Library');
        }
    }
    
    const checkbox = document.getElementById('videoEnabled');
    if (checkbox) {
        checkbox.checked = videoState.enabled;
    }
}

/**
 * Setzt den Visibility-Button Status
 */
function updateVisibilityBtn(active) {
    if (!visibilityBtn) return;
    
    if (active) {
        visibilityBtn.classList.add('active');
        visibilityBtn.title = 'Disable Video Texture';
    } else {
        visibilityBtn.classList.remove('active');
        visibilityBtn.title = 'Enable Video Texture';
    }
}

// ============================================
// UPDATE (für Animation Loop)
// ============================================

/**
 * Update-Funktion für den Animation Loop
 * @param {number} audioLevel - Aktueller Audio-Pegel (0-1)
 */
export function updateVideoTexture(audioLevel = 0) {
    if (videoState.videoTexture && videoState.playing) {
        videoState.videoTexture.needsUpdate = true;
    }
    
    // Audio-Reactive Displacement updaten
    if (videoState.enabled && videoState.displacementAudioReactive && videoState.displacementScale !== 0) {
        videoState.currentAudioLevel = audioLevel;
        applyDisplacementToModel();
        
        // Live-Anzeige des effektiven Werts
        const effectiveValue = Math.round(videoState.displacementScale * audioLevel);
        const display = document.getElementById('videoDisplacementValue');
        if (display) {
            display.textContent = effectiveValue;
            display.style.color = audioLevel > 0.5 ? '#4f4' : (audioLevel > 0.2 ? '#ff0' : '#888');
        }
        
        // Slider live bewegen
        const slider = document.getElementById('videoDisplacement');
        if (slider) {
            slider.value = effectiveValue;
        }
    }
}

/**
 * Wird aufgerufen wenn sich das Modell ändert
 * Re-applied die Video-Textur wenn aktiviert und applyToAllModels true ist
 */
let lastModelUuid = null;

export function onModelChanged() {
    // Nur wenn Video aktiv UND "Apply to All" aktiviert ist
    if (!videoState.enabled || !videoState.loaded || !videoState.applyToAllModels) return;
    
    const currentUuid = modelState.currentModel?.uuid;
    if (currentUuid === lastModelUuid) return;
    
    lastModelUuid = currentUuid;
    
    setTimeout(() => {
        videoState.originalMaterials.clear();
        applyVideoToModel();
    }, 150);
}

// ============================================
// UI HELPERS
// ============================================

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateVideoStatus(status) {
    if (!videoStatus) return;
    
    switch (status) {
        case 'loading':
            videoStatus.textContent = `📂 Loading...`;
            videoStatus.style.color = '#ff0';
            break;
        case 'loaded':
            videoStatus.textContent = `✅ ${videoState.fileName.substring(0, 20)}${videoState.fileName.length > 20 ? '...' : ''}`;
            videoStatus.style.color = '#4f4';
            break;
        case 'error':
            videoStatus.textContent = '❌ Error';
            videoStatus.style.color = '#f44';
            break;
        case 'none':
            videoStatus.textContent = '📹 No video';
            videoStatus.style.color = '#666';
            break;
    }
}

function updatePlayPauseBtn() {
    if (!playPauseBtn) return;
    playPauseBtn.textContent = videoState.playing ? '⏸' : '▶';
    playPauseBtn.title = videoState.playing ? 'Pause' : 'Play';
}

function updateTimeDisplay() {
    if (!timeDisplay) return;
    timeDisplay.textContent = `${formatTime(videoState.currentTime)} / ${formatTime(videoState.duration)}`;
}

function updateProgressSlider() {
    if (!progressSlider || !videoState.duration) return;
    progressSlider.value = (videoState.currentTime / videoState.duration) * 100;
}

/**
 * Aktualisiert die Library-Thumbnail-Ansicht
 */
function updateLibraryUI() {
    if (!libraryContainer) return;
    
    // Count aktualisieren
    if (libraryCount) {
        libraryCount.textContent = `${videoState.library.length} video${videoState.library.length !== 1 ? 's' : ''}`;
    }
    
    // Container leeren
    libraryContainer.innerHTML = '';
    
    if (videoState.library.length === 0) {
        libraryContainer.innerHTML = '<span class="video-library-empty">Drop videos here or click 📂</span>';
        return;
    }
    
    // Thumbnails erstellen
    videoState.library.forEach(entry => {
        const thumb = document.createElement('div');
        thumb.className = 'video-thumb' + (entry.id === videoState.currentVideoId ? ' active' : '');
        thumb.dataset.id = entry.id;
        
        if (entry.thumbnail) {
            thumb.innerHTML = `
                <img src="${entry.thumbnail}" alt="${entry.name}">
                <span class="video-thumb-duration">${formatTime(entry.duration)}</span>
                <button class="video-thumb-remove" title="Remove">×</button>
            `;
        } else {
            thumb.innerHTML = `
                <span class="video-thumb-loading">⏳</span>
                <button class="video-thumb-remove" title="Remove">×</button>
            `;
        }
        
        thumb.title = entry.name;
        
        // Click zum Auswählen
        thumb.addEventListener('click', (e) => {
            if (e.target.classList.contains('video-thumb-remove')) {
                e.stopPropagation();
                removeVideoFromLibrary(entry.id);
            } else {
                loadVideoFromLibrary(entry.id);
                if (videoState.enabled) {
                    setTimeout(() => playVideo(), 100);
                }
            }
        });
        
        libraryContainer.appendChild(thumb);
    });
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initVideoUI() {
    videoInput = document.getElementById('videoFileInput');
    videoPreview = document.getElementById('videoPreview');
    videoStatus = document.getElementById('videoStatus');
    playPauseBtn = document.getElementById('videoPlayPause');
    progressSlider = document.getElementById('videoProgress');
    timeDisplay = document.getElementById('videoTime');
    visibilityBtn = document.getElementById('videoVisibilityBtn');
    libraryContainer = document.getElementById('videoLibrary');
    libraryCount = document.getElementById('videoLibraryCount');
    
    createVideoElement();
    
    // Visibility Button
    if (visibilityBtn) {
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleVideoEnabled();
        });
    }
    
    // File Input - Multi-Select
    if (videoInput) {
        videoInput.multiple = true;
        videoInput.addEventListener('change', (e) => {
            addVideosToLibrary(e.target.files);
            e.target.value = ''; // Reset für erneute Auswahl
        });
    }
    
    // Drag & Drop auf Library
    if (libraryContainer) {
        libraryContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            libraryContainer.classList.add('dragover');
        });
        
        libraryContainer.addEventListener('dragleave', () => {
            libraryContainer.classList.remove('dragover');
        });
        
        libraryContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            libraryContainer.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
            addVideosToLibrary(files);
        });
    }
    
    // Play/Pause
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', togglePlayPause);
    }
    
    // Prev/Next Buttons
    const prevBtn = document.getElementById('videoPrev');
    const nextBtn = document.getElementById('videoNext');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', playPrevVideo);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', playNextVideo);
    }
    
    // Progress
    if (progressSlider) {
        progressSlider.addEventListener('input', (e) => {
            const percent = parseFloat(e.target.value);
            const time = (percent / 100) * videoState.duration;
            setVideoTime(time);
        });
    }
    
    // Loop
    const loopCheckbox = document.getElementById('videoLoop');
    if (loopCheckbox) {
        loopCheckbox.checked = videoState.loop;
        loopCheckbox.addEventListener('change', (e) => {
            setLoop(e.target.checked);
        });
    }
    
    // Auto-Cycle
    const cycleCheckbox = document.getElementById('videoAutoCycle');
    if (cycleCheckbox) {
        cycleCheckbox.addEventListener('change', (e) => {
            setAutoCycle(e.target.checked);
        });
    }
    
    // Playback Rate
    const rateSlider = document.getElementById('videoRate');
    if (rateSlider) {
        rateSlider.addEventListener('input', (e) => {
            const rate = parseFloat(e.target.value);
            setPlaybackRate(rate);
            const display = document.getElementById('videoRateValue');
            if (display) display.textContent = rate.toFixed(1) + 'x';
        });
    }
    
    // Blend Mode
    const blendSelect = document.getElementById('videoBlendMode');
    if (blendSelect) {
        blendSelect.addEventListener('change', (e) => {
            setBlendMode(e.target.value);
        });
    }
    
    // Blend Amount
    const blendSlider = document.getElementById('videoBlendAmount');
    if (blendSlider) {
        blendSlider.addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) / 100;
            setBlendAmount(amount);
            const display = document.getElementById('videoBlendValue');
            if (display) display.textContent = Math.round(amount * 100) + '%';
        });
    }
    
    // Displacement
    const displacementSlider = document.getElementById('videoDisplacement');
    if (displacementSlider) {
        displacementSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            setDisplacement(value);
            const display = document.getElementById('videoDisplacementValue');
            if (display) display.textContent = value;
        });
    }
    
    // Audio-Reactive Displacement
    const displacementAudioCheckbox = document.getElementById('videoDisplacementAudio');
    if (displacementAudioCheckbox) {
        displacementAudioCheckbox.addEventListener('change', (e) => {
            setDisplacementAudioReactive(e.target.checked);
        });
    }
    
    // Apply to All Models
    const applyToAllCheckbox = document.getElementById('videoApplyToAll');
    if (applyToAllCheckbox) {
        applyToAllCheckbox.checked = videoState.applyToAllModels;
        applyToAllCheckbox.addEventListener('change', (e) => {
            setApplyToAllModels(e.target.checked);
        });
    }
    
    // Clear All Button
    const clearBtn = document.getElementById('videoClearAll');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            cleanupVideo();
        });
    }
    
    updateVideoStatus('none');
    updateLibraryUI();
    console.log('Video Texture UI initialisiert');
}

// ============================================
// CLEANUP
// ============================================

export function cleanupVideo() {
    pauseVideo();
    removeVideoFromModel();
    stopCycleTimer();
    
    if (videoState.videoTexture) {
        videoState.videoTexture.dispose();
        videoState.videoTexture = null;
    }
    
    // Alle Library URLs freigeben
    videoState.library.forEach(entry => {
        URL.revokeObjectURL(entry.url);
    });
    
    videoState.library = [];
    videoState.currentVideoId = null;
    videoState.loaded = false;
    videoState.currentFile = null;
    videoState.fileName = '';
    videoState.displacementScale = 0;
    
    if (videoPreview) {
        videoPreview.src = '';
        videoPreview.style.display = 'none';
    }
    
    // UI zurücksetzen
    const displacementSlider = document.getElementById('videoDisplacement');
    const displacementDisplay = document.getElementById('videoDisplacementValue');
    if (displacementSlider) displacementSlider.value = 0;
    if (displacementDisplay) displacementDisplay.textContent = '0';
    
    updateVideoStatus('none');
    updateVisibilityBtn(false);
    updateLibraryUI();
}
