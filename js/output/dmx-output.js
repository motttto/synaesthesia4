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
 * - Fixture Library mit 45+ Geräten
 */

import { 
    fixtureLibrary, 
    getCategories, 
    getFixturesByCategory, 
    getManufacturers,
    getFixturesByManufacturer,
    searchFixtures,
    getFixture,
    createFixtureFromLibrary,
    getLibraryStats 
} from './fixture-library.js';

// ============================================
// STATE
// ============================================

export const dmxState = {
    enabled: false,
    connected: false,
    
    // Protocol
    protocol: 'artnet',  // 'artnet', 'sacn', 'serial'
    
    // Art-Net Settings
    artnetHost: '127.0.0.1',
    artnetPort: 6454,
    
    // sACN Settings
    sacnHost: '239.255.0.1',
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
    fixtures: [],
    
    // Color Source
    colorSource: 'clara',
    manualColor: { r: 255, g: 255, b: 255 },
    
    // Audio Mapping
    audioToDimmer: false,
    audioToDimmerMin: 0,
    audioToDimmerMax: 255,
    currentAudioLevel: 0,
    
    // Beat Mapping
    beatToStrobe: false,
    strobeOnBeat: false,
    strobeDuration: 50,
    
    // Update Rate
    updateRate: 40,
    lastUpdate: 0,
    
    // Connection
    socket: null,
    serialConnection: null
};

// Legacy Presets (für Abwärtskompatibilität)
export const fixturePresets = {
    'rgb': { name: 'RGB Par', channels: 3, mapping: { r: 1, g: 2, b: 3 } },
    'rgbw': { name: 'RGBW Par', channels: 4, mapping: { r: 1, g: 2, b: 3, w: 4 } },
    'rgbwd': { name: 'RGBW + Dimmer', channels: 5, mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5 } },
    'dimmer': { name: 'Dimmer Only', channels: 1, mapping: { dimmer: 1 } },
    'moving-head': { name: 'Moving Head', channels: 8, mapping: { pan: 1, tilt: 2, dimmer: 3, r: 4, g: 5, b: 6, strobe: 7, speed: 8 } },
    'strobe': { name: 'Strobe', channels: 2, mapping: { dimmer: 1, speed: 2 } }
};

// ============================================
// ART-NET PROTOCOL
// ============================================

const ARTNET_OPCODE_OUTPUT = 0x5000;

function createArtNetPacket(universe, dmxData) {
    const packet = new Uint8Array(18 + dmxData.length);
    const header = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00];
    packet.set(header, 0);
    packet[8] = ARTNET_OPCODE_OUTPUT & 0xff;
    packet[9] = (ARTNET_OPCODE_OUTPUT >> 8) & 0xff;
    packet[10] = 0x00;
    packet[11] = 0x0e;
    packet[12] = 0x00;
    packet[13] = 0x00;
    packet[14] = universe & 0xff;
    packet[15] = (universe >> 8) & 0xff;
    const length = dmxData.length;
    packet[16] = (length >> 8) & 0xff;
    packet[17] = length & 0xff;
    packet.set(dmxData, 18);
    return packet;
}

// ============================================
// CONNECTION
// ============================================

let wsSocket = null;

export async function connectDMX() {
    if (dmxState.connected) {
        await disconnectDMX();
    }
    
    try {
        if (dmxState.protocol === 'artnet' || dmxState.protocol === 'sacn') {
            if (typeof window !== 'undefined' && window.electronAPI) {
                const result = await window.electronAPI.dmxConnect({
                    protocol: dmxState.protocol,
                    host: dmxState.protocol === 'artnet' ? dmxState.artnetHost : dmxState.sacnHost,
                    port: dmxState.protocol === 'artnet' ? dmxState.artnetPort : dmxState.sacnPort,
                    universe: dmxState.universe
                });
                dmxState.connected = result.success;
            } else {
                await connectWebSocketBridge();
            }
        } else if (dmxState.protocol === 'serial') {
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

async function connectWebSocketBridge() {
    return new Promise((resolve, reject) => {
        try {
            wsSocket = new WebSocket('ws://localhost:9877');
            wsSocket.onopen = () => {
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
                dmxState.connected = false;
                reject(err);
            };
            wsSocket.onclose = () => {
                dmxState.connected = false;
            };
        } catch (err) {
            reject(err);
        }
    });
}

export async function disconnectDMX() {
    dmxState.enabled = false;
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
}

// ============================================
// DMX OUTPUT
// ============================================

let dmxLoopId = null;

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

export async function sendDMX() {
    if (!dmxState.connected) return;
    
    const data = dmxState.blackout ? new Uint8Array(512) : dmxState.buffer;
    
    try {
        if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
            wsSocket.send(JSON.stringify({
                type: 'dmx',
                universe: dmxState.universe,
                data: Array.from(data)
            }));
        } else if (window.electronAPI) {
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
 * Fügt ein Fixture aus der Library hinzu
 */
export function addFixtureFromLibrary(libraryId, modeName, startChannel, customName = '') {
    const fixture = createFixtureFromLibrary(libraryId, modeName, startChannel, customName);
    if (!fixture) {
        console.error('[DMX] Could not create fixture from library:', libraryId, modeName);
        return null;
    }
    
    dmxState.fixtures.push(fixture);
    console.log('[DMX] Added fixture from library:', fixture);
    renderFixtureList();
    return fixture;
}

/**
 * Fügt ein Fixture mit Legacy-Preset hinzu
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
    renderFixtureList();
    return fixture;
}

export function removeFixture(fixtureId) {
    const index = dmxState.fixtures.findIndex(f => f.id === fixtureId);
    if (index !== -1) {
        dmxState.fixtures.splice(index, 1);
        renderFixtureList();
    }
}

export function setFixtureColor(fixture, r, g, b, w = 0) {
    if (!fixture.enabled) return;
    
    const start = fixture.startChannel - 1;
    const map = fixture.mapping;
    const dimmer = dmxState.blackout ? 0 : dmxState.masterDimmer / 255;
    
    if (map.dimmer) dmxState.buffer[start + map.dimmer - 1] = Math.round(dmxState.masterDimmer);
    if (map.r) dmxState.buffer[start + map.r - 1] = Math.round(r * dimmer);
    if (map.g) dmxState.buffer[start + map.g - 1] = Math.round(g * dimmer);
    if (map.b) dmxState.buffer[start + map.b - 1] = Math.round(b * dimmer);
    if (map.w) dmxState.buffer[start + map.w - 1] = Math.round(w * dimmer);
}

export function setFixtureDimmer(fixture, value) {
    if (!fixture.enabled) return;
    const start = fixture.startChannel - 1;
    const map = fixture.mapping;
    if (map.dimmer) dmxState.buffer[start + map.dimmer - 1] = Math.round(value);
}

// ============================================
// COLOR & AUDIO MAPPING
// ============================================

let currentColor = { r: 0, g: 0, b: 0 };

export function setDMXColor(r, g, b) {
    currentColor = { r, g, b };
    for (const fixture of dmxState.fixtures) {
        if (fixture.enabled) setFixtureColor(fixture, r, g, b);
    }
}

export function setDMXAudioLevel(level) {
    dmxState.currentAudioLevel = level;
    
    if (dmxState.audioToDimmer) {
        const dimmerValue = dmxState.audioToDimmerMin + 
            (dmxState.audioToDimmerMax - dmxState.audioToDimmerMin) * level;
        
        for (const fixture of dmxState.fixtures) {
            if (fixture.enabled && fixture.mapping.dimmer) {
                setFixtureDimmer(fixture, dimmerValue);
            }
        }
    }
}

export function triggerDMXBeat() {
    if (!dmxState.beatToStrobe) return;
    
    dmxState.strobeOnBeat = true;
    
    for (const fixture of dmxState.fixtures) {
        if (fixture.enabled && fixture.mapping.strobe) {
            const start = fixture.startChannel - 1;
            dmxState.buffer[start + fixture.mapping.strobe - 1] = 255;
        }
    }
    
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
// FIXTURE LIBRARY MODAL
// ============================================

let fixtureModalOpen = false;
let selectedCategory = null;
let selectedManufacturer = null;
let selectedFixture = null;
let selectedMode = null;

/**
 * Erstellt das Fixture Library Modal
 */
function createFixtureModal() {
    // Prüfen ob Modal bereits existiert
    if (document.getElementById('fixtureLibraryModal')) return;
    
    const stats = getLibraryStats();
    
    const modal = document.createElement('div');
    modal.id = 'fixtureLibraryModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 85vh;">
            <div class="modal-header">
                <h2>💡 Fixture Library</h2>
                <div style="font-size: 10px; color: #888;">
                    ${stats.totalFixtures} Fixtures • ${stats.totalModes} Modes • ${stats.totalManufacturers} Manufacturers
                </div>
                <span class="modal-close" id="fixtureModalClose">✕</span>
            </div>
            
            <div class="modal-body" style="display: flex; gap: 12px; height: calc(85vh - 180px); overflow: hidden;">
                <!-- Left: Categories & Search -->
                <div style="width: 200px; display: flex; flex-direction: column; gap: 8px;">
                    <!-- Search -->
                    <input type="text" id="fixtureSearch" placeholder="🔍 Search..." 
                        style="width: 100%; padding: 8px; background: #222; border: 1px solid #444; border-radius: 4px; color: #fff;">
                    
                    <!-- View Toggle -->
                    <div style="display: flex; gap: 4px;">
                        <button class="fixture-view-btn active" data-view="category">Categories</button>
                        <button class="fixture-view-btn" data-view="manufacturer">Brands</button>
                    </div>
                    
                    <!-- Category/Manufacturer List -->
                    <div id="fixtureCategoryList" style="flex: 1; overflow-y: auto; background: #1a1a1a; border-radius: 4px; padding: 4px;">
                        <!-- Dynamisch gefüllt -->
                    </div>
                </div>
                
                <!-- Middle: Fixture List -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div id="fixtureListHeader" style="font-size: 11px; color: #888; padding: 4px;">
                        Select a category or search
                    </div>
                    <div id="fixtureList" style="flex: 1; overflow-y: auto; background: #1a1a1a; border-radius: 4px; padding: 4px;">
                        <!-- Dynamisch gefüllt -->
                    </div>
                </div>
                
                <!-- Right: Details & Config -->
                <div style="width: 220px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 11px; color: #888; padding: 4px;">Configuration</div>
                    
                    <div id="fixtureDetails" style="flex: 1; background: #1a1a1a; border-radius: 4px; padding: 8px; overflow-y: auto;">
                        <div style="color: #666; font-size: 10px; text-align: center; padding: 20px;">
                            Select a fixture
                        </div>
                    </div>
                    
                    <!-- Add Configuration -->
                    <div id="fixtureAddConfig" style="background: #1a1a1a; border-radius: 4px; padding: 8px; display: none;">
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 9px; color: #888;">Mode</label>
                            <select id="fixtureModeSelect" style="width: 100%; margin-top: 2px;">
                                <!-- Dynamisch -->
                            </select>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 9px; color: #888;">Start Channel (1-512)</label>
                            <input type="number" id="fixtureStartChannel" min="1" max="512" value="1" 
                                style="width: 100%; margin-top: 2px; padding: 6px; background: #222; border: 1px solid #444; border-radius: 3px; color: #fff;">
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 9px; color: #888;">Name (optional)</label>
                            <input type="text" id="fixtureCustomName" placeholder="e.g. Front Left"
                                style="width: 100%; margin-top: 2px; padding: 6px; background: #222; border: 1px solid #444; border-radius: 3px; color: #fff;">
                        </div>
                        <button id="fixtureAddBtn" class="reset-btn" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #4a4, #282); font-size: 11px;">
                            ➕ Add Fixture
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #333;">
                <span style="font-size: 9px; color: #666;">
                    💡 Tip: Use Quick Add for common fixtures
                </span>
                <div style="display: flex; gap: 8px;">
                    <button id="fixtureQuickAdd" class="reset-btn" style="padding: 6px 12px; font-size: 10px;">
                        ⚡ Quick Add (Generic RGB)
                    </button>
                    <button id="fixtureModalDone" class="reset-btn" style="padding: 6px 16px; background: #444;">
                        Done
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event Listeners
    setupFixtureModalEvents();
    
    // Initial render
    renderCategoryList();
}

/**
 * Setup Modal Event Listeners
 */
function setupFixtureModalEvents() {
    const modal = document.getElementById('fixtureLibraryModal');
    
    // Close buttons
    document.getElementById('fixtureModalClose').addEventListener('click', closeFixtureModal);
    document.getElementById('fixtureModalDone').addEventListener('click', closeFixtureModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFixtureModal();
    });
    
    // Search
    document.getElementById('fixtureSearch').addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
            const results = searchFixtures(query);
            renderFixtureListFromArray(results, `Search: "${query}"`);
        } else if (query.length === 0) {
            renderFixtureList_Modal([]);
            document.getElementById('fixtureListHeader').textContent = 'Select a category or search';
        }
    });
    
    // View Toggle (Category/Manufacturer)
    document.querySelectorAll('.fixture-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.fixture-view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const view = e.target.dataset.view;
            if (view === 'category') {
                renderCategoryList();
            } else {
                renderManufacturerList();
            }
        });
    });
    
    // Quick Add
    document.getElementById('fixtureQuickAdd').addEventListener('click', () => {
        const nextChannel = getNextFreeChannel();
        addFixture(nextChannel, 'rgb', '');
        closeFixtureModal();
    });
    
    // Add Fixture Button
    document.getElementById('fixtureAddBtn').addEventListener('click', () => {
        if (!selectedFixture || !selectedMode) return;
        
        const startChannel = parseInt(document.getElementById('fixtureStartChannel').value) || 1;
        const customName = document.getElementById('fixtureCustomName').value;
        
        addFixtureFromLibrary(selectedFixture.id, selectedMode, startChannel, customName);
        
        // Update start channel for next fixture
        const fixture = getFixture(selectedFixture.id);
        const mode = fixture.modes[selectedMode];
        document.getElementById('fixtureStartChannel').value = startChannel + mode.channels;
        document.getElementById('fixtureCustomName').value = '';
    });
}

/**
 * Rendert die Kategorie-Liste
 */
function renderCategoryList() {
    const container = document.getElementById('fixtureCategoryList');
    const categories = getCategories();
    
    container.innerHTML = categories.map(cat => {
        const fixtures = getFixturesByCategory(cat.id);
        const icon = getCategoryIcon(cat.id);
        return `
            <div class="fixture-category-item" data-category="${cat.id}">
                <span>${icon} ${cat.name}</span>
                <span style="color: #666; font-size: 9px;">${fixtures.length}</span>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.fixture-category-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.fixture-category-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            const categoryId = item.dataset.category;
            const fixtures = getFixturesByCategory(categoryId);
            const cat = categories.find(c => c.id === categoryId);
            renderFixtureListFromArray(fixtures, cat.name);
        });
    });
}

/**
 * Rendert die Hersteller-Liste
 */
function renderManufacturerList() {
    const container = document.getElementById('fixtureCategoryList');
    const manufacturers = getManufacturers();
    
    container.innerHTML = manufacturers.map(mfr => {
        const fixtures = getFixturesByManufacturer(mfr);
        return `
            <div class="fixture-category-item" data-manufacturer="${mfr}">
                <span>${mfr}</span>
                <span style="color: #666; font-size: 9px;">${fixtures.length}</span>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.fixture-category-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.fixture-category-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            const manufacturer = item.dataset.manufacturer;
            const fixtures = getFixturesByManufacturer(manufacturer);
            renderFixtureListFromArray(fixtures, manufacturer);
        });
    });
}

/**
 * Rendert die Fixture-Liste
 */
function renderFixtureListFromArray(fixtures, headerText) {
    const container = document.getElementById('fixtureList');
    const header = document.getElementById('fixtureListHeader');
    
    header.textContent = `${headerText} (${fixtures.length})`;
    
    if (fixtures.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 10px; text-align: center; padding: 20px;">No fixtures found</div>';
        return;
    }
    
    container.innerHTML = fixtures.map(f => {
        const modeCount = Object.keys(f.modes).length;
        return `
            <div class="fixture-list-item" data-fixture-id="${f.id}">
                <div style="font-size: 11px; color: #fff;">${f.name}</div>
                <div style="font-size: 9px; color: #888;">${f.manufacturer} • ${modeCount} mode${modeCount > 1 ? 's' : ''}</div>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.fixture-list-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.fixture-list-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            const fixtureId = item.dataset.fixtureId;
            selectFixture(fixtureId);
        });
    });
}

/**
 * Wählt ein Fixture aus und zeigt Details
 */
function selectFixture(fixtureId) {
    const fixture = getFixture(fixtureId);
    if (!fixture) return;
    
    selectedFixture = fixture;
    selectedMode = Object.keys(fixture.modes)[0];
    
    // Details anzeigen
    const detailsEl = document.getElementById('fixtureDetails');
    const modes = Object.keys(fixture.modes);
    
    detailsEl.innerHTML = `
        <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: bold; color: #fff;">${fixture.name}</div>
            <div style="font-size: 9px; color: #888;">${fixture.manufacturer}</div>
        </div>
        
        <div style="font-size: 9px; color: #888; margin-bottom: 4px;">Type: ${fixture.type}</div>
        
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #333;">
            <div style="font-size: 9px; color: #888; margin-bottom: 6px;">Available Modes:</div>
            ${modes.map(mode => {
                const m = fixture.modes[mode];
                const channels = Object.keys(m.mapping);
                return `
                    <div style="background: #222; padding: 6px; border-radius: 3px; margin-bottom: 4px; font-size: 9px;">
                        <div style="color: #4af; font-weight: bold;">${mode} (${m.channels}ch)</div>
                        <div style="color: #666; margin-top: 2px;">${channels.join(', ')}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Config Panel anzeigen
    const configEl = document.getElementById('fixtureAddConfig');
    configEl.style.display = 'block';
    
    // Mode Select füllen
    const modeSelect = document.getElementById('fixtureModeSelect');
    modeSelect.innerHTML = modes.map(mode => {
        const m = fixture.modes[mode];
        return `<option value="${mode}">${mode} (${m.channels}ch)</option>`;
    }).join('');
    
    modeSelect.addEventListener('change', (e) => {
        selectedMode = e.target.value;
    });
    
    // Start Channel vorschlagen
    document.getElementById('fixtureStartChannel').value = getNextFreeChannel();
}

/**
 * Findet den nächsten freien DMX-Kanal
 */
function getNextFreeChannel() {
    if (dmxState.fixtures.length === 0) return 1;
    
    let maxChannel = 0;
    for (const f of dmxState.fixtures) {
        const endChannel = f.startChannel + f.channels - 1;
        if (endChannel > maxChannel) maxChannel = endChannel;
    }
    
    return Math.min(maxChannel + 1, 512);
}

/**
 * Gibt ein Icon für eine Kategorie zurück
 */
function getCategoryIcon(categoryId) {
    const icons = {
        'par': '💡',
        'movinghead': '🔦',
        'strobe': '⚡',
        'dimmer': '🔅',
        'bar': '📊',
        'laser': '✨',
        'fog': '🌫️',
        'blinder': '☀️',
        'pixel': '🟦'
    };
    return icons[categoryId] || '💡';
}

/**
 * Öffnet das Fixture Modal
 */
export function openFixtureModal() {
    createFixtureModal();
    const modal = document.getElementById('fixtureLibraryModal');
    modal.style.display = 'flex';
    fixtureModalOpen = true;
}

/**
 * Schließt das Fixture Modal
 */
export function closeFixtureModal() {
    const modal = document.getElementById('fixtureLibraryModal');
    if (modal) modal.style.display = 'none';
    fixtureModalOpen = false;
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
    
    // Add Fixture Button -> Opens Library Modal
    const addFixtureBtn = document.getElementById('dmxAddFixture');
    if (addFixtureBtn) {
        addFixtureBtn.addEventListener('click', openFixtureModal);
    }
    
    // Initial render
    renderFixtureList();
    
    console.log('[DMX] UI initialized with Fixture Library');
}

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
 * Rendert die Fixture-Liste im Panel
 */
export function renderFixtureList() {
    const listEl = document.getElementById('dmxFixtureList');
    if (!listEl) return;
    
    if (dmxState.fixtures.length === 0) {
        listEl.innerHTML = '<div style="color:#666; font-size:9px;">No fixtures added</div>';
        return;
    }
    
    listEl.innerHTML = dmxState.fixtures.map(f => `
        <div class="dmx-fixture-item" data-id="${f.id}">
            <div style="display: flex; align-items: center; gap: 4px;">
                <span class="fixture-enabled ${f.enabled ? 'active' : ''}" data-id="${f.id}" title="Toggle">●</span>
                <span class="fixture-name" style="flex: 1; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <span class="fixture-channel" style="font-size: 8px; color: #666;">Ch ${f.startChannel}-${f.startChannel + f.channels - 1}</span>
                <button class="fixture-remove" data-id="${f.id}" style="background: none; border: none; color: #f44; cursor: pointer; font-size: 10px;">✕</button>
            </div>
        </div>
    `).join('');
    
    // Toggle enabled
    listEl.querySelectorAll('.fixture-enabled').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.target.dataset.id);
            const fixture = dmxState.fixtures.find(f => f.id === id);
            if (fixture) {
                fixture.enabled = !fixture.enabled;
                renderFixtureList();
            }
        });
    });
    
    // Remove
    listEl.querySelectorAll('.fixture-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.target.dataset.id);
            removeFixture(id);
        });
    });
}

// ============================================
// EXPORTS
// ============================================

export { createArtNetPacket, fixtureLibrary };
