const { app, BrowserWindow, systemPreferences, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
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
            contextIsolation: true,
            // WICHTIG: Stream läuft weiter auch wenn Fenster nicht im Fokus!
            backgroundThrottling: false
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
                    label: streamEnabled ? `   ${streamStatus.clients} WebSocket + ${streamStatus.mjpegClients || 0} MJPEG Client(s)` : '',
                    enabled: false,
                    visible: streamEnabled
                },
                { type: 'separator' },
                {
                    label: '📺 MJPEG URL kopieren (für OBS)',
                    enabled: streamEnabled,
                    click: () => {
                        const { clipboard } = require('electron');
                        clipboard.writeText(`http://localhost:${streamPort}/stream`);
                    }
                },
                {
                    label: '🌐 Browser URL kopieren',
                    enabled: streamEnabled,
                    click: () => {
                        const { clipboard } = require('electron');
                        clipboard.writeText(`http://localhost:${streamPort}`);
                    }
                },
                {
                    label: '📖 OBS Setup öffnen...',
                    enabled: streamEnabled,
                    click: () => {
                        require('electron').shell.openExternal(`http://localhost:${streamPort}/obs`);
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
        fullscreen: true,  // Startet im Vollbild
        title: 'Synästhesie',
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            // Für TensorFlow.js / MoveNet / externe CDN-Skripte
            webSecurity: false,
            allowRunningInsecureContent: true,
            // WICHTIG: Verhindert dass der Stream abbricht wenn App nicht im Fokus!
            backgroundThrottling: false
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

// DevTools toggle
ipcMain.handle('toggle-devtools', () => {
    if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    }
});

// ComfyUI starten
ipcMain.handle('start-comfyui', async () => {
    const { spawn } = require('child_process');
    const os = require('os');
    
    // Standard ComfyUI Pfade
    const homeDir = os.homedir();
    const possiblePaths = [
        path.join(homeDir, 'ComfyUI'),
        path.join(homeDir, 'Documents', 'ComfyUI'),
        path.join(homeDir, 'Desktop', 'ComfyUI'),
        '/Applications/ComfyUI'
    ];
    
    let comfyPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(path.join(p, 'main.py'))) {
            comfyPath = p;
            break;
        }
    }
    
    if (!comfyPath) {
        console.log('ComfyUI nicht gefunden in Standard-Pfaden');
        return { success: false, error: 'ComfyUI nicht gefunden' };
    }
    
    try {
        console.log('Starte ComfyUI in:', comfyPath);
        
        // Python/Python3 finden
        const pythonCmd = process.platform === 'darwin' ? 'python3' : 'python';
        
        const comfyProcess = spawn(pythonCmd, ['main.py'], {
            cwd: comfyPath,
            detached: true,
            stdio: 'ignore'
        });
        
        comfyProcess.unref();
        
        return { success: true, path: comfyPath };
    } catch (err) {
        console.error('Fehler beim Starten von ComfyUI:', err);
        return { success: false, error: err.message };
    }
});

// Model Sets scannen
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

// ============================================
// WHISPER LOCAL (whisper.cpp)
// ============================================

const { execSync, spawn: spawnProcess } = require('child_process');
const os = require('os');

// Track active child processes for cleanup
const activeProcesses = new Set();

// Whisper model directory
const whisperModelsDir = path.join(os.homedir(), '.whisper-models');

// Helper function to check whisper availability (used by multiple handlers)
async function checkWhisperAvailability() {
    try {
        // Try to find whisper executable (homebrew uses whisper-cli)
        const possiblePaths = [
            '/opt/homebrew/bin/whisper-cli',      // Homebrew M1/M2
            '/usr/local/bin/whisper-cli',         // Homebrew Intel
            '/opt/homebrew/bin/whisper',
            '/usr/local/bin/whisper',
            path.join(os.homedir(), 'whisper.cpp/main'),
            path.join(os.homedir(), 'whisper.cpp/build/bin/main'),
        ];
        
        for (const whisperPath of possiblePaths) {
            if (fs.existsSync(whisperPath)) {
                console.log('✅ Whisper found at:', whisperPath);
                return { available: true, path: whisperPath };
            }
        }
        
        // Try whisper-cli from PATH
        try {
            const result = execSync('which whisper-cli', { stdio: 'pipe', encoding: 'utf8' });
            const foundPath = result.trim();
            if (foundPath) {
                console.log('✅ Whisper found in PATH:', foundPath);
                return { available: true, path: foundPath };
            }
        } catch (e) {}
        
        // Try whisper from PATH
        try {
            const result = execSync('which whisper', { stdio: 'pipe', encoding: 'utf8' });
            const foundPath = result.trim();
            if (foundPath) {
                console.log('✅ Whisper found in PATH:', foundPath);
                return { available: true, path: foundPath };
            }
        } catch (e) {}
        
        console.log('❌ Whisper not found');
        return { available: false, path: null };
    } catch (err) {
        console.error('Whisper check error:', err);
        return { available: false, path: null, error: err.message };
    }
}

// Check for whisper-stream (for real-time transcription)
async function checkWhisperStreamAvailability() {
    try {
        const possiblePaths = [
            '/opt/homebrew/bin/whisper-stream',
            '/usr/local/bin/whisper-stream',
        ];
        
        for (const streamPath of possiblePaths) {
            if (fs.existsSync(streamPath)) {
                console.log('✅ Whisper-stream found at:', streamPath);
                return { available: true, path: streamPath };
            }
        }
        
        try {
            const result = execSync('which whisper-stream', { stdio: 'pipe', encoding: 'utf8' });
            const foundPath = result.trim();
            if (foundPath) {
                return { available: true, path: foundPath };
            }
        } catch (e) {}
        
        return { available: false, path: null };
    } catch (err) {
        return { available: false, path: null, error: err.message };
    }
}

// IPC Handler: Check if whisper.cpp is installed
ipcMain.handle('whisper-check', async () => {
    return await checkWhisperAvailability();
});

// IPC Handler: List available whisper models
ipcMain.handle('whisper-list-models', async () => {
    const basePaths = [
        whisperModelsDir,
        '/opt/homebrew/share/whisper-cpp/models',
        '/usr/local/share/whisper-cpp/models',
        path.join(os.homedir(), 'whisper.cpp/models'),
        path.join(os.homedir(), '.cache/whisper'),
    ];
    
    const foundModels = [];
    const searchedPaths = [];
    
    for (const basePath of basePaths) {
        if (fs.existsSync(basePath)) {
            try {
                const files = fs.readdirSync(basePath);
                const models = files.filter(f => f.includes('ggml') && f.endsWith('.bin'));
                
                for (const model of models) {
                    // Extract model name from filename (e.g., "ggml-large-v3.bin" -> "large-v3")
                    const match = model.match(/ggml-(.+)\.bin/);
                    if (match) {
                        const modelName = match[1];
                        const fullPath = path.join(basePath, model);
                        const stats = fs.statSync(fullPath);
                        const sizeMB = Math.round(stats.size / (1024 * 1024));
                        
                        foundModels.push({
                            name: modelName,
                            file: model,
                            path: fullPath,
                            size: sizeMB
                        });
                    }
                }
                
                searchedPaths.push({ path: basePath, found: models.length });
            } catch (e) {
                searchedPaths.push({ path: basePath, error: e.message });
            }
        } else {
            searchedPaths.push({ path: basePath, exists: false });
        }
    }
    
    console.log('🔍 Whisper models found:', foundModels.map(m => m.name));
    
    return {
        models: foundModels,
        searchedPaths: searchedPaths
    };
});

// IPC Handler: Download whisper model
ipcMain.handle('whisper-download-model', async (event, modelName) => {
    try {
        // Ensure models directory exists
        if (!fs.existsSync(whisperModelsDir)) {
            fs.mkdirSync(whisperModelsDir, { recursive: true });
        }
        
        const modelFile = `ggml-${modelName}.bin`;
        const modelPath = path.join(whisperModelsDir, modelFile);
        
        // Check if already downloaded
        if (fs.existsSync(modelPath)) {
            return { success: true, path: modelPath, message: 'Model bereits vorhanden' };
        }
        
        // Download URL
        const baseUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
        const url = `${baseUrl}/${modelFile}`;
        
        console.log(`Downloading whisper model: ${url}`);
        
        // Use curl to download
        execSync(`curl -L -o "${modelPath}" "${url}"`, {
            stdio: 'inherit',
            timeout: 600000 // 10 minutes timeout
        });
        
        if (fs.existsSync(modelPath)) {
            return { success: true, path: modelPath };
        } else {
            return { success: false, error: 'Download fehlgeschlagen' };
        }
    } catch (err) {
        console.error('Model download error:', err);
        return { success: false, error: err.message };
    }
});

// IPC Handler: Transcribe audio with whisper.cpp
ipcMain.handle('whisper-transcribe', async (event, options) => {
    const { audio, model, language } = options;
    
    try {
        // Check whisper availability using helper function
        const checkResult = await checkWhisperAvailability();
        if (!checkResult?.available) {
            return { success: false, error: 'Whisper nicht installiert' };
        }
        
        const whisperPath = checkResult.path;
        
        // Check multiple model locations and name variants
        const modelName = model || 'base';
        
        // Handle model name variants (large-v3 might be stored as "large-v3" or just "large")
        const modelVariants = [modelName];
        if (modelName === 'large-v3') {
            modelVariants.push('large-v3', 'large_v3', 'large');
        } else if (modelName === 'large') {
            modelVariants.push('large-v3', 'large_v3');
        }
        
        const basePaths = [
            whisperModelsDir,
            '/opt/homebrew/share/whisper-cpp/models',
            '/usr/local/share/whisper-cpp/models',
            path.join(os.homedir(), 'whisper.cpp/models'),
            path.join(os.homedir(), '.cache/whisper'),
        ];
        
        let modelFile = null;
        
        // Search for model in all locations with all variants
        for (const basePath of basePaths) {
            for (const variant of modelVariants) {
                const possiblePaths = [
                    path.join(basePath, `ggml-${variant}.bin`),
                    path.join(basePath, `${variant}.bin`),
                    path.join(basePath, variant, 'model.bin'),
                ];
                
                for (const mp of possiblePaths) {
                    if (fs.existsSync(mp)) {
                        modelFile = mp;
                        console.log(`✅ Found whisper model '${modelName}' at:`, mp);
                        break;
                    }
                }
                if (modelFile) break;
            }
            if (modelFile) break;
        }
        
        // List available models if not found
        if (!modelFile) {
            console.log(`❌ Model '${modelName}' not found. Searching for available models...`);
            
            // List what models exist in each path
            for (const basePath of basePaths) {
                if (fs.existsSync(basePath)) {
                    try {
                        const files = fs.readdirSync(basePath);
                        const models = files.filter(f => f.includes('ggml') && f.endsWith('.bin'));
                        if (models.length > 0) {
                            console.log(`  Available in ${basePath}:`, models);
                        }
                    } catch (e) {}
                }
            }
            
            return { success: false, error: `Model '${modelName}' nicht gefunden. Verfügbare Modelle prüfen mit: ls /opt/homebrew/share/whisper-cpp/models/` };
        }
        
        // Create temp directory for audio
        const tempDir = path.join(os.tmpdir(), 'synaesthesie-whisper');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write audio data to temp file
        const timestamp = Date.now();
        const tempAudioPath = path.join(tempDir, `input_${timestamp}.webm`);
        const tempWavPath = path.join(tempDir, `input_${timestamp}.wav`);
        
        // Convert Uint8Array to Buffer and save
        const audioBuffer = Buffer.from(audio);
        fs.writeFileSync(tempAudioPath, audioBuffer);
        
        // Convert WebM to WAV using ffmpeg (required for whisper-cli)
        try {
            execSync(`ffmpeg -y -i "${tempAudioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWavPath}"`, {
                stdio: 'pipe',
                timeout: 30000
            });
        } catch (ffmpegErr) {
            console.warn('FFmpeg conversion failed:', ffmpegErr.message);
            // Cleanup and return error
            try { fs.unlinkSync(tempAudioPath); } catch (e) {}
            return { success: false, error: 'FFmpeg nicht installiert oder Konvertierung fehlgeschlagen' };
        }
        
        // whisper-cli arguments (different from old whisper.cpp main)
        // whisper-cli -m MODEL -l LANGUAGE FILE
        const args = [
            '--model', modelFile,
            '--language', language || 'de',
            '--no-timestamps',
            '--output-txt',
            '--file', tempWavPath
        ];
        
        console.log(`Running: ${whisperPath} ${args.join(' ')}`);
        
        let result;
        try {
            result = execSync(`"${whisperPath}" ${args.join(' ')}`, {
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024
            });
        } catch (execErr) {
            // Try alternative argument format (positional file)
            console.log('Trying alternative argument format...');
            const altArgs = [
                '-m', modelFile,
                '-l', language || 'de',
                tempWavPath
            ];
            result = execSync(`"${whisperPath}" ${altArgs.join(' ')}`, {
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024
            });
        }
        
        // Check for .txt output file
        const txtPath = tempWavPath + '.txt';
        let text = '';
        
        if (fs.existsSync(txtPath)) {
            text = fs.readFileSync(txtPath, 'utf8').trim();
            try { fs.unlinkSync(txtPath); } catch (e) {}
        } else {
            // Parse stdout
            text = result.trim();
        }
        
        // Cleanup temp files
        try {
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
        } catch (e) {}
        
        console.log('✅ Transcription result:', text.substring(0, 100));
        return { success: true, text };
        
    } catch (err) {
        console.error('Whisper transcription error:', err);
        return { success: false, error: err.message };
    }
});

// IPC Handler: Alternative Whisper via Python (falls whisper.cpp nicht verfügbar)
ipcMain.handle('whisper-transcribe-python', async (event, options) => {
    const { audio, model, language } = options;
    
    try {
        const tempDir = path.join(os.tmpdir(), 'synaesthesie-whisper');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempAudioPath = path.join(tempDir, `input_${Date.now()}.webm`);
        const audioBuffer = Buffer.from(audio);
        fs.writeFileSync(tempAudioPath, audioBuffer);
        
        // Python script for whisper
        const pythonScript = `
import whisper
import sys
import json

model = whisper.load_model("${model || 'base'}")
result = model.transcribe("${tempAudioPath}", language="${language || 'de'}")
print(json.dumps({"text": result["text"]}))
`;
        
        const scriptPath = path.join(tempDir, 'transcribe.py');
        fs.writeFileSync(scriptPath, pythonScript);
        
        const result = execSync(`python3 "${scriptPath}"`, {
            encoding: 'utf8',
            timeout: 120000
        });
        
        // Cleanup
        try {
            fs.unlinkSync(tempAudioPath);
            fs.unlinkSync(scriptPath);
        } catch (e) {}
        
        const parsed = JSON.parse(result);
        return { success: true, text: parsed.text };
        
    } catch (err) {
        console.error('Python Whisper error:', err);
        return { success: false, error: err.message };
    }
});

// IPC Handler: Calculate audio fingerprint for AcoustID
ipcMain.handle('calculate-fingerprint', async (event, audioData) => {
    const tempDir = path.join(os.tmpdir(), 'synaesthesie-fingerprint');
    
    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Audio als temporäre Datei speichern
        const tempAudioPath = path.join(tempDir, `audio_${Date.now()}.webm`);
        const audioBuffer = Buffer.from(audioData);
        fs.writeFileSync(tempAudioPath, audioBuffer);
        
        // fpcalc suchen
        const fpcalcPaths = [
            '/opt/homebrew/bin/fpcalc',
            '/usr/local/bin/fpcalc',
            '/usr/bin/fpcalc',
            path.join(os.homedir(), '.local/bin/fpcalc')
        ];
        
        let fpcalcPath = null;
        for (const p of fpcalcPaths) {
            if (fs.existsSync(p)) {
                fpcalcPath = p;
                break;
            }
        }
        
        if (!fpcalcPath) {
            // Versuche fpcalc über which zu finden
            try {
                const { stdout } = require('child_process').execSync('which fpcalc', { encoding: 'utf8' });
                if (stdout.trim()) {
                    fpcalcPath = stdout.trim();
                }
            } catch (e) {}
        }
        
        if (!fpcalcPath) {
            return { 
                success: false, 
                error: 'fpcalc not found. Install: brew install chromaprint' 
            };
        }
        
        console.log('🎵 Using fpcalc at:', fpcalcPath);
        
        // fpcalc ausführen
        return new Promise((resolve) => {
            const args = ['-json', tempAudioPath];
            const proc = spawn(fpcalcPath, args);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => stdout += data);
            proc.stderr.on('data', (data) => stderr += data);
            
            proc.on('close', (code) => {
                // Cleanup
                try { fs.unlinkSync(tempAudioPath); } catch (e) {}
                
                if (code !== 0) {
                    console.error('fpcalc error:', stderr);
                    resolve({ success: false, error: stderr || 'fpcalc failed' });
                    return;
                }
                
                try {
                    const result = JSON.parse(stdout);
                    console.log('🎵 Fingerprint calculated, duration:', result.duration, 's');
                    resolve({
                        success: true,
                        fingerprint: result.fingerprint,
                        duration: result.duration
                    });
                } catch (e) {
                    resolve({ success: false, error: 'Failed to parse fpcalc output' });
                }
            });
            
            proc.on('error', (err) => {
                try { fs.unlinkSync(tempAudioPath); } catch (e) {}
                resolve({ success: false, error: err.message });
            });
        });
        
    } catch (err) {
        console.error('Fingerprint error:', err);
        return { success: false, error: err.message };
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
    // Kill all active child processes
    cleanupProcesses();
    
    if (streamEnabled) {
        streamServer.stopServer();
    }
    
    // On macOS: also quit the app completely (don't stay in dock)
    // This ensures the terminal is freed up
    app.quit();
});

app.on('before-quit', () => {
    // Ensure all processes are killed before quit
    cleanupProcesses();
});

app.on('will-quit', () => {
    // Final cleanup
    cleanupProcesses();
});

// Cleanup function to kill all tracked processes
function cleanupProcesses() {
    console.log(`Cleaning up ${activeProcesses.size} active processes...`);
    
    for (const proc of activeProcesses) {
        try {
            if (proc && !proc.killed) {
                proc.kill('SIGTERM');
                // Force kill after timeout
                setTimeout(() => {
                    try {
                        if (!proc.killed) {
                            proc.kill('SIGKILL');
                        }
                    } catch (e) {}
                }, 1000);
            }
        } catch (err) {
            console.warn('Error killing process:', err.message);
        }
    }
    activeProcesses.clear();
    
    // Also try to kill any lingering whisper/ffmpeg processes
    try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
            // Kill any whisper-related processes started by this app
            execSync('pkill -f "whisper.*synaesthesie" 2>/dev/null || true', { stdio: 'ignore' });
            execSync('pkill -f "ffmpeg.*synaesthesie" 2>/dev/null || true', { stdio: 'ignore' });
        }
    } catch (e) {
        // Ignore errors - processes might not exist
    }
}

// Handle Ctrl+C in terminal
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, cleaning up...');
    cleanupProcesses();
    if (streamEnabled) {
        streamServer.stopServer();
    }
    app.quit();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up...');
    cleanupProcesses();
    if (streamEnabled) {
        streamServer.stopServer();
    }
    app.quit();
    process.exit(0);
});

app.commandLine.appendSwitch('enable-features', 'WebMidi');

// GPU-Flags für TensorFlow.js / WebGL
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// WICHTIG: Verhindert Throttling/Pausieren wenn App im Hintergrund
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
