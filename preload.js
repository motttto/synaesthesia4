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
    listModelSets: () => ipcRenderer.invoke('list-model-sets')
});

console.log('Synästhesie Electron App geladen');
