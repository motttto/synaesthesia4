/**
 * DMX OUTPUT
 * 
 * Sendet DMX-Daten an Lichtsteuerungen
 * - Art-Net (UDP Netzwerk)
 * - sACN / E1.31
 * - Enttec Open DMX USB (über SerialPort)
 * 
 * Features:
 * - Farben aus Clara/Alex System → RGB Fixtures
 * - Audio-Level → Dimmer
 * - Beat → Strobe/Flash
 * - Mehrere Universes
 * - Fixture-Profile
 */

// ============================================
// STATE
// ============================================

export const dmxState = {
    enabled: false,
    connected: false,
    
    // Protocol
    protocol: 'artnet',  // 'artnet', 'sacn', 'serial'
    
    // Art-Net Settings
    artnetHost: '127.0.0.1',  // Broadcast: '255.255.255.255' oder spezifische IP
    artnetPort: 6454,
    
    // sACN Settings
    sacnHost: '239.255.0.1',  // Multicast
    sacnPort: 5568,
    
    // Serial Settings (Enttec)
    serialPort: '',
    serialBaud: 250000,
    
    // Universe
    universe: 0,
    
    // DMX Buffer (512 Kanäle)
    buffer: new Uint8Array(512),
    
    // Master
    masterDimmer: 255,
    blackout: false,
    
    // Fixtures
    fixtures: [],  // Array of fixture configs
    
    // Color Source
    colorSource: 'clara',  // 'clara', 'alex', 'manual'
    manualColor: { r: 255, g: 255, b: 255 },
    
    // Audio Mapping
    audioToDimmer: false,
    audioToDimmerMin: 0,
    audioToDimmerMax: 255,
    currentAudioLevel: 0,
    
    // Beat Mapping
    beatToStrobe: false,
    strobeOnBeat: false,
    strobeDuration: 50,  // ms
    
    // Update Rate
    updateRate: 40,  // ~25 fps DMX
    lastUpdate: 0,
    
    // Connection
    socket: null,
    serialConnection: null
};

// Fixture Presets
export const fixturePresets = {
    'rgb': {
        name: 'RGB Par',
        channels: 3,
        mapping: { r: 1, g: 2, b: 3 }
    },
    'rgbw': {
        name: 'RGBW Par',
        channels: 4,
        mapping: { r: 1, g: 2, b: 3, w: 4 }
    },
    'rgbwd': {
        name: 'RGBW + Dimmer',
        channels: 5,
        mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5 }
    },
    'dimmer': {
        name: 'Dimmer Only',
        channels: 1,
        mapping: { dimmer: 1 }
    },
    'moving-head': {
        name: 'Moving Head (Basic)',
        channels: 8,
        mapping: { pan: 1, tilt: 2, dimmer: 3, r: 4, g: 5, b: 6, strobe: 7, speed: 8 }
    },
    'strobe': {
        name: 'Strobe',
        channels: 2,
        mapping: { dimmer: 1, speed: 2 }
    }
};

// ============================================
// ART-NET PROTOCOL
// ============================================

// Art-Net OpCodes
const ARTNET_OPCODE_OUTPUT = 0x5000;

/**
 * Erstellt ein Art-Net DMX Paket
 */
function createArtNetPacket(universe, dmxData) {
    // Art-Net Header: "Art-Net\0" + OpCode + Version + Sequence + Physical + Universe + Length + Data
    const packet = new Uint8Array(18 + dmxData.length);
    
    // "Art-Net\0"
    const header = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00];
    packet.set(header, 0);
    
    // OpCode (little-endian)
    packet[8] = ARTNET_OPCODE_OUTPUT & 0xff;
    packet[9] = (ARTNET_OPCODE_OUTPUT >> 8) & 0xff;
    
    // Protocol Version (14)
    packet[10] = 0x00;
    packet[11] = 0x0e;
    
    // Sequence (0 = disabled)
    packet[12] = 0x00;
    
    // Physical Port
    packet[13] = 0x00;
    
    // Universe (little-endian)
    packet[14] = universe & 0xff;
    packet[15] = (universe >> 8) & 0xff;
    
    // Length (big-endian)
    const length = dmxData.length;
    packet[16] = (length >> 8) & 0xff;
    packet[17] = length & 0xff;
    
    // DMX Data
    packet.set(dmxData, 18);
    
    return packet;
}

// ============================================
// CONNECTION
// ============================================

let udpSocket = null;

/**
 * Verbindet mit dem DMX Interface
 */
export async function connectDMX() {
    if (dmxState.connected) {
        await disconnectDMX();
    }
    
    try {
        if (dmxState.protocol === 'artnet' || dmxState.protocol === 'sacn') {
            // In Electron: UDP Socket über Node.js
            if (typeof window !== 'undefined' && window.electronAPI) {
                const result = await window.electronAPI.dmxConnect({
                    protocol: dmxState.protocol,
                    host: dmxState.protocol === 'artnet' ? dmxState.artnetHost : dmxState.sacnHost,
                    port: dmxState.protocol === 'artnet' ? dmxState.artnetPort : dmxState.sacnPort,
                    universe: dmxState.universe
                });
                dmxState.connected = result.success;
                console.log(`[DMX] ${dmxState.protocol} connected:`, result);
            } else {
                // Browser-Fallback: WebSocket zu lokalem Server
                console.log('[DMX] Browser mode - using WebSocket bridge');
                await connectWebSocketBridge();
            }
        } else if (dmxState.protocol === 'serial') {
            // Serial Port für Enttec etc.
            if (window.electronAPI) {
                const result = await window.electronAPI.dmxConnectSerial({
                    port: dmxState.serialPort,
                    baudRate: dmxState.serialBaud
                });
                dmxState.connected = result.success;
            }
        }
        
        if (dmxState.connected) {
            dmxState.enabled = true;
            startDMXLoop();
        }
        
        return dmxState.connected;
    } catch (err) {
        console.error('[DMX] Connection error:', err);
        dmxState.connected = false;
        return false;
    }
}

/**
 * WebSocket Bridge für Browser-Modus
 */
let wsSocket = null;

async function connectWebSocketBridge() {
    return new Promise((resolve, reject) => {
        try {
            wsSocket = new WebSocket('ws://localhost:9877');
            
            wsSocket.onopen = () => {
                console.log('[DMX] WebSocket bridge connected');
                wsSocket.send(JSON.stringify({
                    type: 'init',
                    protocol: dmxState.protocol,
                    host: dmxState.artnetHost,
                    port: dmxState.artnetPort,
                    universe: dmxState.universe
                }));
                dmxState.connected = true;
                resolve(true);
            };
            
            wsSocket.onerror = (err) => {
                console.error('[DMX] WebSocket error:', err);
                dmxState.connected = false;
                reject(err);
            };
            
            wsSocket.onclose = () => {
                console.log('[DMX] WebSocket closed');
                dmxState.connected = false;
            };
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Trennt die DMX-Verbindung
 */
export async function disconnectDMX() {
    dmxState.enabled = false;
    
    // Blackout senden
    dmxState.buffer.fill(0);
    await sendDMX();
    
    if (wsSocket) {
        wsSocket.close();
        wsSocket = null;
    }
    
    if (window.electronAPI) {
        await window.electronAPI.dmxDisconnect();
    }
    
    dmxState.connected = false;
    console.log('[DMX] Disconnected');
}

// ============================================
// DMX OUTPUT
// ============================================

let dmxLoopId = null;

/**
 * Startet die DMX Update-Schleife
 */
function startDMXLoop() {
    if (dmxLoopId) return;
    
    const loop = () => {
        const now = performance.now();
        if (now - dmxState.lastUpdate >= dmxState.updateRate) {
            sendDMX();
            dmxState.lastUpdate = now;
        }
        
        if (dmxState.enabled) {
            dmxLoopId = requestAnimationFrame(loop);
        }
    };
    
    dmxLoopId = requestAnimationFrame(loop);
}

/**
 * Stoppt die DMX Update-Schleife
 */
function stopDMXLoop() {
    if (dmxLoopId) {
        cancelAnimationFrame(dmxLoopId);
        dmxLoopId = null;
    }
}

/**
 * Sendet den aktuellen DMX Buffer
 */
export async function sendDMX() {
    if (!dmxState.connected) return;
    
    // Blackout?
    const data = dmxState.blackout ? new Uint8Array(512) : dmxState.buffer;
    
    try {
        if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
            // Browser: über WebSocket
            wsSocket.send(JSON.stringify({
                type: 'dmx',
                universe: dmxState.universe,
                data: Array.from(data)
            }));
        } else if (window.electronAPI) {
            // Electron: direkt
            await window.electronAPI.dmxSend({
                universe: dmxState.universe,
                data: Array.from(data)
            });
        }
    } catch (err) {
        console.error('[DMX] Send error:', err);
    }
}

// ============================================
// FIXTURE MANAGEMENT
// ============================================

/**
 * Fügt ein Fixture hinzu
 */
export function addFixture(startChannel, presetName, name = '') {
    const preset = fixturePresets[presetName];
    if (!preset) {
        console.error('[DMX] Unknown preset:', presetName);
        return null;
    }
    
    const fixture = {
        id: Date.now(),
        name: name || `${preset.name} @ ${startChannel}`,
        startChannel,
        preset: presetName,
        channels: preset.channels,
        mapping: { ...preset.mapping },
        enabled: true
    };
    
    dmxState.fixtures.push(fixture);
    console.log('[DMX] Added fixture:', fixture);
    return fixture;
}

/**
 * Entfernt ein Fixture
 */
export function removeFixture(fixtureId) {
    const index = dmxState.fixtures.findIndex(f => f.id === fixtureId);
    if (index !== -1) {
        dmxState.fixtures.splice(index, 1);
        console.log('[DMX] Removed fixture:', fixtureId);
    }
}

/**
 * Setzt die Farbe für ein Fixture
 */
export function setFixtureColor(fixture, r, g, b, w = 0) {
    if (!fixture.enabled) return;
    
    const start = fixture.startChannel - 1;  // DMX ist 1-basiert
    const map = fixture.mapping;
    
    // Master Dimmer anwenden
    const dimmer = dmxState.blackout ? 0 : dmxState.masterDimmer / 255;
    
    if (map.dimmer) {
        dmxState.buffer[start + map.dimmer - 1] = Math.round(dmxState.masterDimmer);
    }
    
    if (map.r) dmxState.buffer[start + map.r - 1] = Math.round(r * dimmer);
    if (map.g) dmxState.buffer[start + map.g - 1] = Math.round(g * dimmer);
    if (map.b) dmxState.buffer[start + map.b - 1] = Math.round(b * dimmer);
    if (map.w) dmxState.buffer[start + map.w - 1] = Math.round(w * dimmer);
}

/**
 * Setzt den Dimmer für ein Fixture
 */
export function setFixtureDimmer(fixture, value) {
    if (!fixture.enabled) return;
    
    const start = fixture.startChannel - 1;
    const map = fixture.mapping;
    
    if (map.dimmer) {
        dmxState.buffer[start + map.dimmer - 1] = Math.round(value);
    }
}

// ============================================
// COLOR & AUDIO MAPPING
// ============================================

let currentColor = { r: 0, g: 0, b: 0 };

/**
 * Setzt die aktuelle Farbe (von Clara/Alex System)
 */
export function setDMXColor(r, g, b) {
    currentColor = { r, g, b };
    
    // Alle Fixtures aktualisieren
    for (const fixture of dmxState.fixtures) {
        if (fixture.enabled) {
            setFixtureColor(fixture, r, g, b);
        }
    }
}

/**
 * Setzt den Audio-Level für Dimmer-Mapping
 */
export function setDMXAudioLevel(level) {
    dmxState.currentAudioLevel = level;
    
    if (dmxState.audioToDimmer) {
        // Level (0-1) auf Dimmer-Range mappen
        const dimmerValue = dmxState.audioToDimmerMin + 
            (dmxState.audioToDimmerMax - dmxState.audioToDimmerMin) * level;
        
        for (const fixture of dmxState.fixtures) {
            if (fixture.enabled && fixture.mapping.dimmer) {
                setFixtureDimmer(fixture, dimmerValue);
            }
        }
    }
}

/**
 * Beat-Trigger für Strobe
 */
export function triggerDMXBeat() {
    if (!dmxState.beatToStrobe) return;
    
    dmxState.strobeOnBeat = true;
    
    // Strobe für alle Fixtures
    for (const fixture of dmxState.fixtures) {
        if (fixture.enabled && fixture.mapping.strobe) {
            const start = fixture.startChannel - 1;
            dmxState.buffer[start + fixture.mapping.strobe - 1] = 255;
        }
    }
    
    // Strobe nach Duration ausschalten
    setTimeout(() => {
        dmxState.strobeOnBeat = false;
        for (const fixture of dmxState.fixtures) {
            if (fixture.enabled && fixture.mapping.strobe) {
                const start = fixture.startChannel - 1;
                dmxState.buffer[start + fixture.mapping.strobe - 1] = 0;
            }
        }
    }, dmxState.strobeDuration);
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initDMXUI() {
    // Protocol Selection
    const protocolSelect = document.getElementById('dmxProtocol');
    if (protocolSelect) {
        protocolSelect.addEventListener('change', (e) => {
            dmxState.protocol = e.target.value;
            updateDMXSettingsVisibility();
        });
    }
    
    // Art-Net Host
    const artnetHostInput = document.getElementById('dmxArtnetHost');
    if (artnetHostInput) {
        artnetHostInput.value = dmxState.artnetHost;
        artnetHostInput.addEventListener('change', (e) => {
            dmxState.artnetHost = e.target.value;
        });
    }
    
    // Universe
    const universeInput = document.getElementById('dmxUniverse');
    if (universeInput) {
        universeInput.value = dmxState.universe;
        universeInput.addEventListener('change', (e) => {
            dmxState.universe = parseInt(e.target.value) || 0;
        });
    }
    
    // Connect Button
    const connectBtn = document.getElementById('dmxConnectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            if (dmxState.connected) {
                await disconnectDMX();
                connectBtn.textContent = '🔌 Connect';
                connectBtn.classList.remove('active');
            } else {
                const success = await connectDMX();
                if (success) {
                    connectBtn.textContent = '⚡ Disconnect';
                    connectBtn.classList.add('active');
                }
            }
            updateDMXStatus();
        });
    }
    
    // Master Dimmer
    const masterSlider = document.getElementById('dmxMasterDimmer');
    const masterValue = document.getElementById('dmxMasterValue');
    if (masterSlider) {
        masterSlider.addEventListener('input', (e) => {
            dmxState.masterDimmer = parseInt(e.target.value);
            if (masterValue) masterValue.textContent = dmxState.masterDimmer;
        });
    }
    
    // Blackout
    const blackoutBtn = document.getElementById('dmxBlackout');
    if (blackoutBtn) {
        blackoutBtn.addEventListener('click', () => {
            dmxState.blackout = !dmxState.blackout;
            blackoutBtn.classList.toggle('active', dmxState.blackout);
        });
    }
    
    // Color Source
    const colorSourceSelect = document.getElementById('dmxColorSource');
    if (colorSourceSelect) {
        colorSourceSelect.addEventListener('change', (e) => {
            dmxState.colorSource = e.target.value;
        });
    }
    
    // Audio to Dimmer
    const audioDimmerCheckbox = document.getElementById('dmxAudioToDimmer');
    if (audioDimmerCheckbox) {
        audioDimmerCheckbox.addEventListener('change', (e) => {
            dmxState.audioToDimmer = e.target.checked;
        });
    }
    
    // Beat to Strobe
    const beatStrobeCheckbox = document.getElementById('dmxBeatToStrobe');
    if (beatStrobeCheckbox) {
        beatStrobeCheckbox.addEventListener('change', (e) => {
            dmxState.beatToStrobe = e.target.checked;
        });
    }
    
    // Add Fixture Button
    const addFixtureBtn = document.getElementById('dmxAddFixture');
    if (addFixtureBtn) {
        addFixtureBtn.addEventListener('click', () => {
            showAddFixtureDialog();
        });
    }
    
    // Fixture List
    renderFixtureList();
    
    console.log('[DMX] UI initialized');
}

/**
 * Aktualisiert die Sichtbarkeit der Protokoll-spezifischen Einstellungen
 */
function updateDMXSettingsVisibility() {
    const artnetSettings = document.getElementById('dmxArtnetSettings');
    const serialSettings = document.getElementById('dmxSerialSettings');
    
    if (artnetSettings) {
        artnetSettings.style.display = 
            (dmxState.protocol === 'artnet' || dmxState.protocol === 'sacn') ? 'block' : 'none';
    }
    
    if (serialSettings) {
        serialSettings.style.display = dmxState.protocol === 'serial' ? 'block' : 'none';
    }
}

/**
 * Aktualisiert den Verbindungsstatus
 */
function updateDMXStatus() {
    const statusEl = document.getElementById('dmxStatus');
    if (statusEl) {
        if (dmxState.connected) {
            statusEl.textContent = `✅ Connected (${dmxState.protocol.toUpperCase()})`;
            statusEl.style.color = '#4f4';
        } else {
            statusEl.textContent = '⏹ Not connected';
            statusEl.style.color = '#888';
        }
    }
}

/**
 * Zeigt den Dialog zum Hinzufügen eines Fixtures
 */
function showAddFixtureDialog() {
    const startChannel = prompt('Start Channel (1-512):', '1');
    if (!startChannel) return;
    
    const presets = Object.keys(fixturePresets);
    const presetIndex = prompt(
        `Fixture Type:\n${presets.map((p, i) => `${i+1}. ${fixturePresets[p].name}`).join('\n')}`,
        '1'
    );
    if (!presetIndex) return;
    
    const presetName = presets[parseInt(presetIndex) - 1];
    if (!presetName) return;
    
    const name = prompt('Fixture Name (optional):', '');
    
    addFixture(parseInt(startChannel), presetName, name);
    renderFixtureList();
}

/**
 * Rendert die Fixture-Liste
 */
function renderFixtureList() {
    const listEl = document.getElementById('dmxFixtureList');
    if (!listEl) return;
    
    if (dmxState.fixtures.length === 0) {
        listEl.innerHTML = '<div style="color:#666; font-size:9px;">No fixtures added</div>';
        return;
    }
    
    listEl.innerHTML = dmxState.fixtures.map(f => `
        <div class="dmx-fixture-item" data-id="${f.id}">
            <span class="fixture-name">${f.name}</span>
            <span class="fixture-channel">Ch ${f.startChannel}-${f.startChannel + f.channels - 1}</span>
            <button class="fixture-remove" data-id="${f.id}">✕</button>
        </div>
    `).join('');
    
    // Remove-Buttons
    listEl.querySelectorAll('.fixture-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            removeFixture(id);
            renderFixtureList();
        });
    });
}

// ============================================
// SERIAL PORT LISTING (Electron only)
// ============================================

export async function listSerialPorts() {
    if (window.electronAPI) {
        return await window.electronAPI.listSerialPorts();
    }
    return [];
}

// ============================================
// EXPORT
// ============================================

export {
    createArtNetPacket
};
