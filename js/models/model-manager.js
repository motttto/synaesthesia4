/**
 * MODEL MANAGER
 * 
 * Zentrales Management für 3D-Modelle:
 * - Model Set Erkennung und Laden
 * - GLTF Loading mit Cache
 * - Morphing-Transitionen
 * - Scene Cleanup
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, scene } from '../core/three-setup.js';

// ============================================
// LOADER & STATE
// ============================================

const loader = new GLTFLoader();

export const modelState = {
    currentModel: null,
    modelMaterials: [],
    modelCache: {},
    currentScale: 1,
    modelVisible: true,
    lastLoadedPath: '',
    
    // Model Sets
    currentModelSet: '',  // '' = Legacy, 'set_01', etc.
    availableModelSets: [],
    currentSetModels: {},  // Mapping: Halbtöne (0-24) -> Dateiname
    
    // Morphing
    morphingEnabled: true,
    morphDuration: 500,
    morphingInProgress: false,
    morphStartTime: 0,
    morphIncomingModel: null,
    morphOutgoingModel: null
};

// Maps für Effekte
export const originalGeometries = new Map();
export const originalMaterialColors = new Map();

// UI-Element Referenzen (werden bei Init gesetzt)
let modelSetSelect = null;
let scanModelSetsBtn = null;
let modelSetStatus = null;

// Callback für Visuals-Refresh (wird von außen gesetzt)
let refreshVisualsCallback = null;

// ============================================
// INITIALISIERUNG
// ============================================

/**
 * Initialisiert UI-Referenzen
 */
export function initModelUI() {
    modelSetSelect = document.getElementById('modelSetSelect');
    scanModelSetsBtn = document.getElementById('scanModelSetsBtn');
    modelSetStatus = document.getElementById('modelSetStatus');
    
    // Scan-Button Event Handler
    if (scanModelSetsBtn) {
        scanModelSetsBtn.addEventListener('click', () => {
            detectModelSets(true);
        });
    }
    
    // Dropdown Event Handler
    if (modelSetSelect) {
        modelSetSelect.addEventListener('change', handleModelSetChange);
    }
}

/**
 * Setzt Callback für Visual-Refresh nach Modelländerungen
 */
export function setRefreshVisualsCallback(callback) {
    refreshVisualsCallback = callback;
}

// ============================================
// MODEL SET DETECTION
// ============================================

/**
 * Scannt nach verfügbaren Model Sets
 */
export async function detectModelSets(showStatus = false) {
    modelState.availableModelSets = [];
    
    if (showStatus && scanModelSetsBtn && modelSetStatus) {
        scanModelSetsBtn.classList.add('scanning');
        modelSetStatus.textContent = 'Scanne...';
        modelSetStatus.style.color = '#ff0';
    }
    
    // Dropdown neu aufbauen
    if (modelSetSelect) {
        modelSetSelect.innerHTML = '';
    }
    
    // Versuche zuerst über Electron IPC
    if (window.electronAPI?.listModelSets) {
        try {
            const sets = await window.electronAPI.listModelSets();
            sets.forEach(setName => {
                modelState.availableModelSets.push(setName);
                if (modelSetSelect) {
                    const option = document.createElement('option');
                    option.value = setName;
                    option.textContent = setName.replace('set_', 'Set ').replace('_', ' ');
                    modelSetSelect.appendChild(option);
                }
            });
            console.log(`${sets.length} Model Sets via Electron gefunden:`, sets);
            
            if (showStatus && scanModelSetsBtn && modelSetStatus) {
                scanModelSetsBtn.classList.remove('scanning');
                modelSetStatus.textContent = `${sets.length} Sets gefunden`;
                modelSetStatus.style.color = sets.length > 0 ? '#4f4' : '#666';
                setTimeout(() => { modelSetStatus.textContent = ''; }, 3000);
            }
            return;
        } catch (e) {
            console.warn('Electron listModelSets fehlgeschlagen:', e);
        }
    }
    
    // Fallback: HTTP HEAD requests (für Browser)
    let consecutiveNotFound = 0;
    const MAX_CONSECUTIVE_NOT_FOUND = 2;
    
    for (let setNum = 1; setNum <= 20 && consecutiveNotFound < MAX_CONSECUTIVE_NOT_FOUND; setNum++) {
        const setName = `set_${setNum.toString().padStart(2, '0')}`;
        
        if (showStatus && modelSetStatus) {
            modelSetStatus.textContent = `Prüfe ${setName}...`;
        }
        
        const testPath = `./3d-models/${setName}/00_prime.glb`;
        let found = false;
        
        try {
            // Versuche HEAD, falls das nicht geht, GET mit Range
            let response = await fetch(testPath, { method: 'HEAD' });
            if (!response.ok && response.status === 405) {
                // HEAD nicht unterstützt, versuche GET
                response = await fetch(testPath);
            }
            // Prüfe Content-Length (GLB sollte > 100 Bytes sein)
            const contentLength = response.headers.get('content-length');
            found = response.ok && (!contentLength || parseInt(contentLength) > 100);
        } catch (e) {
            found = false;
        }
        
        if (found) {
            modelState.availableModelSets.push(setName);
            if (modelSetSelect) {
                const option = document.createElement('option');
                option.value = setName;
                option.textContent = setName.replace('set_', 'Set ').replace('_', ' ');
                modelSetSelect.appendChild(option);
            }
            console.log(`Model Set gefunden: ${setName}`);
            consecutiveNotFound = 0;
        } else {
            consecutiveNotFound++;
        }
    }
    
    console.log(`${modelState.availableModelSets.length} Model Sets gefunden`);
    
    if (showStatus && scanModelSetsBtn && modelSetStatus) {
        scanModelSetsBtn.classList.remove('scanning');
        modelSetStatus.textContent = `${modelState.availableModelSets.length} Sets gefunden`;
        modelSetStatus.style.color = modelState.availableModelSets.length > 0 ? '#4f4' : '#666';
        setTimeout(() => { modelSetStatus.textContent = ''; }, 3000);
    }
}

/**
 * Lädt Modell-Mapping für ein Set
 */
export async function loadSetModels(setName) {
    modelState.currentSetModels = {};
    
    if (!setName) return;
    
    // Versuche zuerst über Electron IPC
    if (window.electronAPI?.scanModelSet) {
        try {
            const files = await window.electronAPI.scanModelSet(setName);
            files.forEach(filename => {
                const match = filename.match(/^(\d+)[_\-.]/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num >= 0 && num <= 24) {
                        modelState.currentSetModels[num] = filename;
                    }
                }
            });
            console.log(`Set ${setName} geladen: ${Object.keys(modelState.currentSetModels).length} Modelle`);
            return;
        } catch (e) {
            console.warn('Electron scanModelSet fehlgeschlagen:', e);
        }
    }
    
    // Fallback: HTTP HEAD requests
    const intervalNames = {
        0: ['prime'], 1: ['sekunde_klein', 'kleine_sekunde', 'sekunde'],
        2: ['sekunde_gross', 'grosse_sekunde', 'sekunde'],
        3: ['terz_klein', 'kleine_terz', 'terz'],
        4: ['terz_gross', 'grosse_terz', 'terz'],
        5: ['quarte', 'reine_quarte'], 6: ['tritonus', 'tritone'],
        7: ['quinte', 'reine_quinte'],
        8: ['sexte_klein', 'kleine_sexte', 'sexte'],
        9: ['sexte_gross', 'grosse_sexte', 'sexte'],
        10: ['septime_klein', 'kleine_septime', 'septime'],
        11: ['septime_gross', 'grosse_septime', 'septime'],
        12: ['oktave'],
        13: ['none_klein', 'kleine_none', 'none'],
        14: ['none_gross', 'grosse_none', 'none'],
        15: ['dezime_klein', 'kleine_dezime', 'dezime'],
        16: ['dezime_gross', 'grosse_dezime', 'dezime'],
        17: ['undezime'],
        18: ['undezime_ueberm', 'ueberm_undezime', 'tritonus_oktave'],
        19: ['duodezime'],
        20: ['tredezime_klein', 'kleine_tredezime', 'tredezime'],
        21: ['tredezime_gross', 'grosse_tredezime', 'tredezime'],
        22: ['quartdezime_klein', 'kleine_quartdezime', 'quartdezime'],
        23: ['quartdezime_gross', 'grosse_quartdezime', 'quartdezime'],
        24: ['doppeloktave', 'doppel_oktave']
    };
    
    for (let i = 0; i <= 24; i++) {
        const prefix = i.toString().padStart(2, '0');
        const possibleNames = intervalNames[i] || ['model'];
        
        for (const name of possibleNames) {
            const filename = `${prefix}_${name}.glb`;
            const testPath = `./3d-models/${setName}/${filename}`;
            
            try {
                const response = await fetch(testPath, { method: 'HEAD' });
                if (response.ok) {
                    modelState.currentSetModels[i] = filename;
                    break;
                }
            } catch (e) {
                // Ignorieren
            }
        }
    }
    
    console.log(`Set ${setName} geladen:`, modelState.currentSetModels);
}

// ============================================
// MODEL PATH RESOLUTION
// ============================================

/**
 * Ermittelt den Pfad für ein Intervall-Modell
 */
export function getModelPathForInterval(semitones) {
    const clampedSemitones = Math.max(0, Math.min(24, semitones));
    
    if (modelState.currentModelSet && Object.keys(modelState.currentSetModels).length > 0) {
        if (modelState.currentSetModels[clampedSemitones]) {
            return `${modelState.currentModelSet}/${modelState.currentSetModels[clampedSemitones]}`;
        }
        // Fallback auf Oktav-Äquivalent
        if (clampedSemitones > 12) {
            const reduced = clampedSemitones % 12 || 12;
            if (modelState.currentSetModels[reduced]) {
                return `${modelState.currentModelSet}/${modelState.currentSetModels[reduced]}`;
            }
        }
        // Fallback auf Prime
        if (modelState.currentSetModels[0]) {
            return `${modelState.currentModelSet}/${modelState.currentSetModels[0]}`;
        }
    }
    
    // Legacy-Fallback
    const defaultSetName = 'set_01';
    const intervalNames = {
        0: '00_prime', 1: '01_sekunde_klein', 2: '02_sekunde_gross',
        3: '03_terz_klein', 4: '04_terz_gross', 5: '05_quarte',
        6: '06_tritonus', 7: '07_quinte', 8: '08_sexte_klein',
        9: '09_sexte_gross', 10: '10_septime_klein', 11: '11_septime_gross',
        12: '12_oktave', 13: '13_none_klein', 14: '14_none_gross',
        15: '15_dezime_klein', 16: '16_dezime_gross', 17: '17_undezime',
        18: '18_undezime_ueberm', 19: '19_duodezime', 20: '20_tredezime_klein',
        21: '21_tredezime_gross', 22: '22_quartdezime_klein', 23: '23_quartdezime_gross',
        24: '24_doppeloktave'
    };
    const fallbackName = intervalNames[clampedSemitones] || intervalNames[0];
    return `${defaultSetName}/${fallbackName}.glb`;
}

// ============================================
// SCENE CLEANUP
// ============================================

/**
 * Bereinigt Maps für ein Modell
 */
export function cleanupModelMaps(model) {
    if (!model) return;
    const uuidsToRemove = [];
    model.traverse((child) => {
        if (child.isMesh) {
            uuidsToRemove.push(child.uuid);
        }
    });
    uuidsToRemove.forEach(uuid => {
        originalGeometries.delete(uuid);
        originalMaterialColors.delete(uuid);
    });
}

/**
 * Vollständige Scene-Bereinigung
 */
export function cleanupScene() {
    scene.children.forEach(child => {
        if (!child.isLight && !child.isCamera && child !== modelState.currentModel) {
            if (child.isGroup || child.isMesh) {
                scene.remove(child);
                console.log('Cleanup: Entferne verwaistes Objekt', child.uuid);
            }
        }
    });
    
    originalGeometries.clear();
    originalMaterialColors.clear();
    
    if (modelState.currentModel) {
        storeOriginalGeometry(modelState.currentModel);
    }
    
    console.log('Scene cleanup abgeschlossen. Objekte in Scene:', scene.children.length);
}

/**
 * Speichert Original-Geometrien für Effekte
 */
export function storeOriginalGeometry(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) {
                const posAttr = child.geometry.getAttribute('position');
                if (posAttr) {
                    originalGeometries.set(child.uuid, posAttr.array.slice());
                }
            }
            if (child.material) {
                originalMaterialColors.set(child.uuid, {
                    color: child.material.color.getHex(),
                    emissive: child.material.emissive ? child.material.emissive.getHex() : 0x000000
                });
            }
        }
    });
}

// Auto-Cleanup Timer (alle 30 Sekunden)
setInterval(() => {
    let orphanCount = 0;
    scene.children.forEach(child => {
        if (!child.isLight && !child.isCamera && 
            child !== modelState.currentModel && 
            child !== modelState.morphOutgoingModel && 
            child !== modelState.morphIncomingModel) {
            if (child.isGroup || child.isMesh) {
                scene.remove(child);
                orphanCount++;
            }
        }
    });
    if (orphanCount > 0) {
        console.log(`Auto-Cleanup: ${orphanCount} verwaiste Objekte entfernt`);
    }
}, 30000);

// ============================================
// MODEL LOADING
// ============================================

/**
 * Bereitet ein Modell vor (Material-Setup)
 */
function prepareModel(model) {
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 1;
            child.material.color = new THREE.Color(0xff3333);
            child.material.emissive = new THREE.Color(0x661111);
        }
    });
    model.scale.set(modelState.currentScale, modelState.currentScale, modelState.currentScale);
    
    // Geometrien für Effekte speichern
    model.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const posAttr = child.geometry.getAttribute('position');
            if (posAttr) {
                originalGeometries.set(child.uuid, posAttr.array.slice());
            }
        }
    });
    
    // Farben anwenden wenn Callback gesetzt
    setTimeout(() => {
        if (refreshVisualsCallback) {
            refreshVisualsCallback();
        }
    }, 100);
}

/**
 * Lädt ein Modell (per Intervall oder Dateiname)
 */
export async function loadModel(filenameOrSemitones) {
    let path;
    
    if (typeof filenameOrSemitones === 'number') {
        const modelPath = getModelPathForInterval(filenameOrSemitones);
        path = `./3d-models/${modelPath}`;
    } else {
        path = `./3d-models/${filenameOrSemitones}`;
    }
    
    // Bereits dasselbe Modell geladen? Skip
    if (modelState.lastLoadedPath === path && modelState.currentModel) {
        return;
    }
    
    // Laufendes Morphing abbrechen
    if (modelState.morphingInProgress) {
        if (modelState.morphOutgoingModel) {
            cleanupModelMaps(modelState.morphOutgoingModel);
            scene.remove(modelState.morphOutgoingModel);
        }
        if (modelState.morphIncomingModel) {
            modelState.currentModel = modelState.morphIncomingModel;
            modelState.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = 1;
                }
            });
            modelState.currentModel.scale.set(modelState.currentScale, modelState.currentScale, modelState.currentScale);
        }
        modelState.morphingInProgress = false;
        modelState.morphOutgoingModel = null;
        modelState.morphIncomingModel = null;
    }
    
    let newModel;
    const cacheKey = path;
    
    if (modelState.modelCache[cacheKey]) {
        newModel = modelState.modelCache[cacheKey].clone();
    } else {
        // Erst prüfen ob Datei existiert und valid ist
        try {
            const response = await fetch(path);
            if (!response.ok) {
                console.warn(`Model not found: ${path} (${response.status})`);
                return;
            }
            // Prüfen ob Antwort groß genug für ein GLB ist (min 100 Bytes)
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) < 100) {
                console.warn(`Model file too small (probably 404): ${path}`);
                return;
            }
        } catch (fetchErr) {
            console.warn(`Cannot fetch model: ${path}`, fetchErr);
            return;
        }
        
        try {
            newModel = await new Promise((resolve, reject) => {
                loader.load(path, (gltf) => {
                    modelState.modelCache[cacheKey] = gltf.scene;
                    resolve(gltf.scene.clone());
                }, undefined, (error) => {
                    console.warn(`Model load error: ${path}`, error);
                    reject(error);
                });
            });
        } catch (loadErr) {
            console.warn(`Failed to load model: ${path}`);
            return;
        }
    }
    
    modelState.lastLoadedPath = path;
    prepareModel(newModel);
    
    if (modelState.morphingEnabled && modelState.currentModel) {
        startMorphTransition(modelState.currentModel, newModel);
    } else {
        if (modelState.currentModel) {
            cleanupModelMaps(modelState.currentModel);
            scene.remove(modelState.currentModel);
        }
        modelState.currentModel = newModel;
        modelState.modelMaterials = [];
        modelState.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                modelState.modelMaterials.push(child.material);
            }
        });
        storeOriginalGeometry(modelState.currentModel);
        scene.add(modelState.currentModel);
    }
}

// ============================================
// MORPHING
// ============================================

function startMorphTransition(oldModel, newModel) {
    modelState.morphingInProgress = true;
    modelState.morphStartTime = performance.now();
    modelState.morphOutgoingModel = oldModel;
    modelState.morphIncomingModel = newModel;
    
    modelState.morphIncomingModel.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.opacity = 0;
        }
    });
    modelState.morphIncomingModel.scale.set(0.01, 0.01, 0.01);
    scene.add(modelState.morphIncomingModel);
}

/**
 * Update Morphing (im Animation Loop aufrufen)
 */
export function updateMorphTransition() {
    if (!modelState.morphingInProgress) return;
    
    const elapsed = performance.now() - modelState.morphStartTime;
    const progress = Math.min(1, elapsed / modelState.morphDuration);
    
    // Ease-in-out
    const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    // Outgoing: fade out + shrink
    if (modelState.morphOutgoingModel) {
        const outScale = modelState.currentScale * (1 - eased * 0.3);
        modelState.morphOutgoingModel.scale.set(outScale, outScale, outScale);
        modelState.morphOutgoingModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = 1 - eased;
            }
        });
    }
    
    // Incoming: fade in + grow
    if (modelState.morphIncomingModel) {
        const inScale = modelState.currentScale * (0.7 + eased * 0.3);
        modelState.morphIncomingModel.scale.set(inScale, inScale, inScale);
        modelState.morphIncomingModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = eased;
            }
        });
    }
    
    // Transition complete
    if (progress >= 1) {
        if (modelState.morphOutgoingModel) {
            cleanupModelMaps(modelState.morphOutgoingModel);
            scene.remove(modelState.morphOutgoingModel);
        }
        
        modelState.currentModel = modelState.morphIncomingModel;
        modelState.modelMaterials = [];
        modelState.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = 1;
                modelState.modelMaterials.push(child.material);
            }
        });
        modelState.currentModel.scale.set(modelState.currentScale, modelState.currentScale, modelState.currentScale);
        
        storeOriginalGeometry(modelState.currentModel);
        
        modelState.morphOutgoingModel = null;
        modelState.morphIncomingModel = null;
        modelState.morphingInProgress = false;
        
        // Refresh-Callback nach Morphing-Abschluss aufrufen (Texturen übertragen)
        if (refreshVisualsCallback) {
            setTimeout(() => refreshVisualsCallback(), 50);
        }
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleModelSetChange(e) {
    const newSet = e.target.value;
    
    if (modelSetStatus) {
        modelSetStatus.textContent = newSet ? `Lade ${newSet}...` : 'Lade Legacy...';
        modelSetStatus.style.color = '#ff0';
    }
    
    modelState.currentModelSet = newSet;
    modelState.modelCache = {};
    modelState.currentSetModels = {};
    modelState.lastLoadedPath = '';  // Reset, damit neues Modell geladen wird
    
    if (newSet) {
        await loadSetModels(newSet);
        const modelCount = Object.keys(modelState.currentSetModels).length;
        if (modelSetStatus) {
            modelSetStatus.textContent = `${modelCount} Modelle geladen`;
            modelSetStatus.style.color = modelCount > 0 ? '#4f4' : '#f66';
        }
    } else {
        if (modelSetStatus) {
            modelSetStatus.textContent = 'Legacy-Modus';
            modelSetStatus.style.color = '#666';
        }
    }
    
    // Aktuelles Intervall neu laden (ohne Morphing für sauberen Set-Wechsel)
    const wasMorphing = modelState.morphingEnabled;
    modelState.morphingEnabled = false;
    
    try {
        await loadModel(0);
        if (modelSetStatus) {
            setTimeout(() => { modelSetStatus.textContent = ''; }, 2000);
        }
    } catch (err) {
        console.error('Fehler beim Laden:', err);
        if (modelSetStatus) {
            modelSetStatus.textContent = 'Ladefehler!';
            modelSetStatus.style.color = '#f66';
        }
    }
    
    modelState.morphingEnabled = wasMorphing;
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialisiert das Model-System
 */
export async function initializeModels() {
    initModelUI();
    await detectModelSets(false);
    
    if (modelState.availableModelSets.length > 0) {
        const preferredSet = modelState.availableModelSets.includes('set_01') 
            ? 'set_01' 
            : modelState.availableModelSets[0];
        modelState.currentModelSet = preferredSet;
        if (modelSetSelect) {
            modelSetSelect.value = preferredSet;
        }
        await loadSetModels(preferredSet);
        console.log(`Automatisch Set gewählt: ${preferredSet}`);
        
        try {
            await loadModel(0);
            console.log('Erstes Modell geladen');
        } catch (err) {
            console.log('Konnte erstes Modell aus Set nicht laden:', err);
        }
    } else {
        console.log('Keine Sets gefunden, versuche set_01 als Fallback');
        loadModel('set_01/00_prime.glb').catch(() => {
            console.log('Starte ohne Modell');
        });
    }
}

// ============================================
// SETTERS
// ============================================

export function setModelScale(scale) {
    modelState.currentScale = scale;
    if (modelState.currentModel) {
        modelState.currentModel.scale.set(scale, scale, scale);
    }
}

export function setMorphingEnabled(enabled) {
    modelState.morphingEnabled = enabled;
}

export function setMorphDuration(duration) {
    modelState.morphDuration = duration;
}

export function setModelVisibility(visible) {
    modelState.modelVisible = visible;
    if (modelState.currentModel) {
        modelState.currentModel.visible = visible;
    }
}

// Getter
export function getCurrentModel() {
    return modelState.currentModel;
}

export function getModelMaterials() {
    return modelState.modelMaterials;
}
