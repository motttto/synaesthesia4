const { app, BrowserWindow, systemPreferences, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const streamServer = require('./stream-server');

let mainWindow = null;
let outputWindow = null;
let streamEnabled = false;
let streamPort = 9876;

// Für macOS: Mikrofonzugriff anfragen
async function requestMicrophoneAccess() {
    if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        if (status !== 'granted') {
            await systemPreferences.askForMediaAccess('microphone');
        }
    }
}

// Output-Fenster erstellen (für MadMapper/Syphon Capture)
function createOutputWindow() {
    if (outputWindow) {
        outputWindow.focus();
        return;
    }
    
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    outputWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        x: 100,
        y: 100,
        frame: false,
        titleBarStyle: 'hidden',
        transparent: false,
        backgroundColor: '#000000',
        resizable: true,
        movable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        title: 'Synästhesie Output',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    // Lade den Stream-Client
    outputWindow.loadURL(`http://localhost:${streamPort}`);
    
    outputWindow.on('closed', () => {
        outputWindow = null;
        createMenu();
    });
    
    // Kontextmenü für Output-Fenster
    outputWindow.webContents.on('context-menu', () => {
        const outputMenu = Menu.buildFromTemplate([
            { label: 'Vollbild', click: () => outputWindow.setFullScreen(!outputWindow.isFullScreen()) },
            { label: '1920x1080', click: () => outputWindow.setSize(1920, 1080) },
            { label: '1280x720', click: () => outputWindow.setSize(1280, 720) },
            { label: '1080x1080 (Square)', click: () => outputWindow.setSize(1080, 1080) },
            { type: 'separator' },
            { label: 'Immer im Vordergrund', type: 'checkbox', checked: outputWindow.isAlwaysOnTop(), 
              click: (item) => outputWindow.setAlwaysOnTop(item.checked) },
            { type: 'separator' },
            { label: 'Schließen', click: () => outputWindow.close() }
        ]);
        outputMenu.popup();
    });
    
    createMenu();
}

function closeOutputWindow() {
    if (outputWindow) {
        outputWindow.close();
        outputWindow = null;
    }
}

// Menü erstellen
function createMenu() {
    const streamStatus = streamServer.getStatus();
    
    const template = [
        {
            label: 'Synästhesie',
            submenu: [
                { role: 'about', label: 'Über Synästhesie' },
                { type: 'separator' },
                { role: 'hide', label: 'Ausblenden' },
                { role: 'hideOthers', label: 'Andere ausblenden' },
                { role: 'unhide', label: 'Alle einblenden' },
                { type: 'separator' },
                { role: 'quit', label: 'Beenden' }
            ]
        },
        {
            label: 'Bearbeiten',
            submenu: [
                { role: 'undo', label: 'Rückgängig' },
                { role: 'redo', label: 'Wiederholen' },
                { type: 'separator' },
                { role: 'cut', label: 'Ausschneiden' },
                { role: 'copy', label: 'Kopieren' },
                { role: 'paste', label: 'Einfügen' },
                { role: 'selectAll', label: 'Alles auswählen' }
            ]
        },
        {
            label: 'Ansicht',
            submenu: [
                { role: 'reload', label: 'Neu laden' },
                { role: 'forceReload', label: 'Erzwungenes Neuladen' },
                { role: 'toggleDevTools', label: 'Entwicklertools' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Originalgröße' },
                { role: 'zoomIn', label: 'Vergrößern' },
                { role: 'zoomOut', label: 'Verkleinern' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Vollbild' }
            ]
        },
        {
            label: 'Output',
            submenu: [
                {
                    label: streamEnabled ? '⏹ Stream stoppen' : '▶ Stream starten',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => toggleStream()
                },
                { type: 'separator' },
                {
                    label: outputWindow ? '✓ Output-Fenster schließen' : '🖥 Output-Fenster öffnen',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    enabled: streamEnabled,
                    click: () => {
                        if (outputWindow) {
                            closeOutputWindow();
                        } else {
                            createOutputWindow();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Output-Fenster Größe',
                    enabled: !!outputWindow,
                    submenu: [
                        { label: '1920 x 1080 (Full HD)', click: () => outputWindow?.setSize(1920, 1080) },
                        { label: '1280 x 720 (HD)', click: () => outputWindow?.setSize(1280, 720) },
                        { label: '1080 x 1080 (Square)', click: () => outputWindow?.setSize(1080, 1080) },
                        { label: '1080 x 1920 (Vertical)', click: () => outputWindow?.setSize(1080, 1920) },
                        { label: '3840 x 2160 (4K)', click: () => outputWindow?.setSize(3840, 2160) },
                    ]
                },
                { type: 'separator' },
                {
                    label: streamEnabled ? `✓ Stream läuft auf Port ${streamPort}` : 'Stream inaktiv',
                    enabled: false
                },
                {
                    label: streamEnabled ? `   ${streamStatus.clients} Client(s) verbunden` : '',
                    enabled: false,
                    visible: streamEnabled
                },
                { type: 'separator' },
                {
                    label: 'URL kopieren',
                    enabled: streamEnabled,
                    click: () => {
                        const { clipboard } = require('electron');
                        clipboard.writeText(`http://localhost:${streamPort}`);
                    }
                },
                { type: 'separator' },
                {
                    label: '📖 MadMapper Setup...',
                    click: () => showMadMapperHelp()
                }
            ]
        },
        {
            label: 'Fenster',
            submenu: [
                { role: 'minimize', label: 'Minimieren' },
                { role: 'zoom', label: 'Zoom' },
                { type: 'separator' },
                { role: 'front', label: 'Alle nach vorne' },
                { type: 'separator' },
                {
                    label: 'Immer im Vordergrund',
                    type: 'checkbox',
                    checked: mainWindow ? mainWindow.isAlwaysOnTop() : false,
                    click: (menuItem) => {
                        mainWindow.setAlwaysOnTop(menuItem.checked);
                    }
                }
            ]
        },
        {
            label: 'Hilfe',
            submenu: [
                {
                    label: 'MadMapper Setup...',
                    click: () => showMadMapperHelp()
                },
                {
                    label: 'Syphon Simple Client (empfohlen)',
                    click: () => require('electron').shell.openExternal('http://syphon.v002.info/')
                },
                { type: 'separator' },
                {
                    label: 'OBS Studio',
                    click: () => require('electron').shell.openExternal('https://obsproject.com/')
                }
            ]
        }
    ];

    if (process.platform !== 'darwin') {
        template.shift();
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function showMadMapperHelp() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'MadMapper Setup',
        message: 'So verbindest du mit MadMapper:',
        detail: `OPTION 1: Output-Fenster (am einfachsten)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Menü → Output → Stream starten
2. Menü → Output → Output-Fenster öffnen
3. In MadMapper: Media → Add Window Capture
4. "Synästhesie Output" wählen

OPTION 2: Mit Syphon Simple Client
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Lade "Syphon Simple Client" von syphon.v002.info
2. In Syphon: Window Capture → Synästhesie Output
3. In MadMapper: Media → Syphon → Simple Client

OPTION 3: Browser-Quelle in MadMapper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Menü → Output → Stream starten
2. In MadMapper: Media → Add Web Page
3. URL: http://localhost:${streamPort}

Rechtsklick auf Output-Fenster für Größenoptionen.`
    });
}

// Stream toggle
function toggleStream() {
    if (streamEnabled) {
        streamServer.stopServer();
        streamEnabled = false;
        closeOutputWindow();
        mainWindow.webContents.send('stream-status', { enabled: false });
    } else {
        const result = streamServer.startServer(streamPort);
        if (result.success) {
            streamEnabled = true;
            mainWindow.webContents.send('stream-status', { 
                enabled: true, 
                port: streamPort,
                url: result.url 
            });
        } else {
            dialog.showErrorBox('Stream Fehler', result.error);
        }
    }
    createMenu();
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'Synästhesie',
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
    });
    
    // Menü regelmäßig aktualisieren für Client-Anzahl
    setInterval(() => {
        if (streamEnabled) {
            createMenu();
        }
    }, 2000);
}

// IPC Handlers
ipcMain.handle('stream-get-status', () => {
    return {
        enabled: streamEnabled,
        ...streamServer.getStatus()
    };
});

ipcMain.handle('stream-toggle', () => {
    toggleStream();
    return { enabled: streamEnabled };
});

ipcMain.on('stream-frame', (event, dataUrl) => {
    if (streamEnabled) {
        streamServer.sendFrame(dataUrl);
    }
});

ipcMain.handle('open-output-window', () => {
    if (streamEnabled) {
        createOutputWindow();
    }
    return { opened: !!outputWindow };
});

// Model Sets scannen
const fs = require('fs');

ipcMain.handle('list-model-sets', () => {
    try {
        const modelsDir = path.join(__dirname, '3d-models');
        const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
        
        const sets = entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('set_'))
            .map(entry => entry.name)
            .sort();
        
        console.log('Gefundene Model Sets:', sets);
        return sets;
    } catch (err) {
        console.error('Fehler beim Scannen der Model Sets:', err);
        return [];
    }
});

ipcMain.handle('scan-model-set', (event, setName) => {
    try {
        const setDir = path.join(__dirname, '3d-models', setName);
        const files = fs.readdirSync(setDir);
        
        // Nur .glb Dateien mit Nummer am Anfang (00-24)
        const models = files
            .filter(f => f.endsWith('.glb') && /^\d{2}[_\-.]/.test(f))
            .sort();
        
        console.log(`Model Set ${setName}: ${models.length} Modelle gefunden`);
        return models;
    } catch (err) {
        console.error(`Fehler beim Scannen von ${setName}:`, err);
        return [];
    }
});

app.whenReady().then(async () => {
    await requestMicrophoneAccess();
    createMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (streamEnabled) {
        streamServer.stopServer();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.commandLine.appendSwitch('enable-features', 'WebMidi');
