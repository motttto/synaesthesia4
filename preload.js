// Preload-Script für sichere Kommunikation zwischen Main und Renderer
const { contextBridge, ipcRenderer } = require('electron');

// Electron APIs für den Renderer
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,
    
    // Stream für OBS
    stream: {
        getStatus: () => ipcRenderer.invoke('stream-get-status'),
        toggle: () => ipcRenderer.invoke('stream-toggle'),
        sendFrame: (dataUrl) => ipcRenderer.send('stream-frame', dataUrl),
        
        onStatusChange: (callback) => {
            ipcRenderer.on('stream-status', (event, data) => callback(data));
        }
    },
    
    // Model Sets scannen
    scanModelSet: (setName) => ipcRenderer.invoke('scan-model-set', setName),
    listModelSets: () => ipcRenderer.invoke('list-model-sets'),
    
    // DevTools
    toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
    
    // ComfyUI starten
    startComfyUI: () => ipcRenderer.invoke('start-comfyui'),
    
    // Output Window
    openOutputWindow: () => ipcRenderer.invoke('open-output-window'),
    
    // ============================================
    // WHISPER LOCAL
    // ============================================
    
    // Check if whisper.cpp is available
    checkWhisper: () => ipcRenderer.invoke('whisper-check'),
    
    // List available whisper models
    listWhisperModels: () => ipcRenderer.invoke('whisper-list-models'),
    
    // Download whisper model
    downloadWhisperModel: (model) => ipcRenderer.invoke('whisper-download-model', model),
    
    // Transcribe audio with whisper
    transcribeWhisper: (options) => ipcRenderer.invoke('whisper-transcribe', options),
    
    // ============================================
    // SONG RECOGNITION (AcoustID)
    // ============================================
    
    // Calculate audio fingerprint using fpcalc/chromaprint
    calculateFingerprint: (audioData) => ipcRenderer.invoke('calculate-fingerprint', audioData)
});

console.log('Synästhesie Electron App geladen');
