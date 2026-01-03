/**
 * AI IMAGE GENERATION
 * 
 * Verbindet mit ComfyUI für lokale Stable Diffusion Bildgenerierung
 * - Overlay Opacity: Stufenlose Transparenz 0-100%
 * - Provider: Local (ComfyUI), Mix
 * - Models: SD 1.5, SDXL, Turbo
 * - Auto-Generation basierend auf Speech/Prompts
 * - Buffer Mode für smoothe Übergänge
 * - 3D Texture Mode: AI Bilder als Textur auf 3D Modelle
 */

import * as THREE from 'three';
import { getInstrumentForPrompt } from '../audio/instrument-detector.js';

// ============================================
// STATE
// ============================================

export const aiState = {
    // Display
    overlayOpacity: 0, // 0-100 (0 = off, 100 = full overlay)
    
    // Provider & Model
    provider: 'local',  // 'local', 'mix'
    model: 'local-sd15', // 'local-sd15', 'local-sdxl', 'local-turbo'
    
    // Resolution (WxH)
    resolution: '1920x1080', // Fixed pixel sizes or 'custom'
    customWidth: 1920,
    customHeight: 1080,
    
    // Upscale Settings
    upscaleEnabled: false,      // Generiere klein, skaliere hoch
    generateResolution: '768x432', // Kleine Generierungsauflösung (16:9)
    upscaleMethod: 'lanczos',   // 'nearest-exact', 'bilinear', 'bicubic', 'lanczos'
    
    // Advanced Generation Settings
    steps: 4,                   // Sampling steps (1-30)
    cfg: 1,                     // CFG scale (1-15)
    sampler: 'euler',           // Sampler name (euler = fastest)
    
    // Save Settings
    saveImages: true,           // true = SaveImage (dauerhaft), false = PreviewImage (temporär)
    
    // ComfyUI Connection
    comfyPort: 8188,
    comfyUrl: 'http://localhost:8188',
    connected: false,
    generating: false,
    customCheckpoint: null, // Manuell gewähltes Checkpoint
    
    // Settings
    autoGenerate: false,
    bufferMode: false,
    crossfadeEnabled: false,
    
    // Buffer Settings
    bufferSize: 24,
    bufferLoop: false,
    bufferShuffle: false,
    bufferImages: [],
    bufferIndex: 0,
    
    // Continuous Generation
    continuousGen: false,      // Generiert bis Buffer voll
    
    // Stream Mode (continuous output without storing)
    streamMode: false,         // Kontinuierlicher Output ohne Speichern
    streamPause: 0,            // Pause zwischen Generierungen (ms), 0 = sofort weiter
    
    // Playback Settings
    playbackActive: false,     // Spielt Buffer ab
    playbackSpeed: 2000,       // ms pro Bild (2 Sekunden default)
    
    // BPM Sync
    bpmSyncEnabled: false,     // Sync Playback to BPM
    bpmSyncBeats: 1,           // Bildwechsel alle X Beats (1, 2, 4, 8, 16)
    beatCounter: 0,            // Zählt Beats seit letztem Bildwechsel
    
    // Visibility
    enabled: true,             // AI Panel an/aus
    
    // 3D Texture
    useAsTexture: false,       // AI Bild als 3D-Modell-Textur
    textureApplyToAll: true,   // Auf alle Modelle anwenden

    // Prompt
    currentPrompt: '',
    lastGeneratedPrompt: '',
    
    // Images
    currentImage: null,
    bufferImage: null,
    
    // Filter (synced with speech.js)
    filterNouns: true,
    filterVerbs: false,
    filterAdj: false,
    
    // Prompt Modifiers
    promptModifiers: {
        cinematic: false,
        anatomy: false,
        highDetail: false,
        artistic: false
    },
    
    // Post-Processing Upscale (lokal in App)
    postUpscaleEnabled: false,    // Nachträgliches Upscaling aktiviert
    postUpscaleMethod: 'lanczos', // 'nearest', 'bilinear', 'bicubic', 'lanczos'
    postUpscaleTarget: '1920x1080', // Zielauflösung
    postUpscaleSharpen: 0,        // Schärfung 0-100
    
    // Prompt Modifier Texts
    modifierTexts: {
        cinematic: 'cinematic lighting, dramatic atmosphere, film grain, anamorphic lens, depth of field, volumetric lighting, color grading',
        anatomy: 'anatomically correct, proper human proportions, correct number of fingers, realistic body structure, natural pose',
        highDetail: '8k uhd, highly detailed, sharp focus, intricate details, professional photography',
        artistic: 'masterpiece, best quality, trending on artstation, award winning'
    }
};

// Playback Timer
let playbackTimer = null;
// Continuous Generation aktiv
let continuousGenActive = false;
// Stream Mode aktiv
let streamModeActive = false;
let streamImageCount = 0;
let streamStartTime = 0;

// UI Elements
let previewEl = null;
let statusEl = null;
let bufferStatusEl = null;
let bufferSettingsEl = null;
let bufferThumbsEl = null;
let currentInputEl = null;
let promptInputEl = null;
let overlayCanvas = null;
let overlayCtx = null;

// Auto-generation Timer
let autoGenTimer = null;
const AUTO_GEN_DELAY = 3000; // 3 Sekunden nach letztem Input

// Speech Buffer System
let speechBuffer = [];           // Array von erkannten Wörtern
let speechBufferTimer = null;    // Timer für Auto-Clear
let speechBufferTimeout = 3000;  // Clear nach X ms Stille (einstellbar)
let speechLastUpdate = 0;        // Timestamp des letzten Updates

// ============================================
// COMFYUI CONNECTION
// ============================================

/**
 * Prüft Verbindung zu ComfyUI
 */
export async function checkComfyConnection() {
    console.log(`🔌 Checking ComfyUI connection at ${aiState.comfyUrl}...`);
    
    if (statusEl) {
        statusEl.textContent = '🔄 Connecting...';
        statusEl.style.color = '#ff0';
    }
    
    // Versuche beide Adressen
    const urlsToTry = [
        `http://127.0.0.1:${aiState.comfyPort}`,
        `http://localhost:${aiState.comfyPort}`
    ];
    
    for (const baseUrl of urlsToTry) {
        try {
            console.log(`🔌 Trying ${baseUrl}/system_stats...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${baseUrl}/system_stats`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`🔌 ${baseUrl} response status:`, response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ ComfyUI connected! System stats:', data);
                
                // Speichere funktionierende URL
                aiState.comfyUrl = baseUrl;
                aiState.connected = true;
                
                if (statusEl) {
                    statusEl.textContent = `✅ ComfyUI connected (${baseUrl.includes('127.0.0.1') ? '127.0.0.1' : 'localhost'})`;
                    statusEl.style.color = '#4f4';
                }
                
                // Lade verfügbare Checkpoints
                await loadAvailableCheckpoints();
                
                return true;
            }
        } catch (e) {
            console.warn(`⚠️ ${baseUrl} failed:`, e.name, e.message);
        }
    }
    
    // Beide fehlgeschlagen
    console.error('❌ ComfyUI connection failed on all addresses');
    
    aiState.connected = false;
    if (statusEl) {
        statusEl.textContent = `❌ ComfyUI not reachable on port ${aiState.comfyPort}`;
        statusEl.style.color = '#f66';
    }
    return false;
}

/**
 * Generiert ein Bild mit ComfyUI
 */
export async function generateImage(prompt) {
    if (!aiState.connected || aiState.generating) {
        console.log('Cannot generate: not connected or already generating');
        return null;
    }
    
    if (!prompt || prompt.trim() === '') {
        console.log('Cannot generate: empty prompt');
        return null;
    }
    
    aiState.generating = true;
    aiState.lastGeneratedPrompt = prompt;
    
    if (statusEl) {
        statusEl.textContent = '🎨 Generating...';
        statusEl.style.color = '#ff0';
    }
    
    // Workflow basierend auf Model
    const workflow = createWorkflow(prompt, aiState.model);
    
    try {
        // Queue prompt
        const queueResponse = await fetch(`${aiState.comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (!queueResponse.ok) {
            const errorText = await queueResponse.text();
            console.error('ComfyUI Error Response:', errorText);
            
            // Parse error for better message
            let errorMsg = 'Failed to queue prompt';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMsg = errorJson.error.message;
                } else if (errorJson.node_errors) {
                    // Checkpoint not found error
                    const nodeErrors = Object.values(errorJson.node_errors);
                    if (nodeErrors.length > 0 && nodeErrors[0].errors) {
                        errorMsg = nodeErrors[0].errors.map(e => e.message).join(', ');
                    }
                }
            } catch (e) {
                errorMsg = errorText.substring(0, 100);
            }
            
            if (statusEl) {
                statusEl.textContent = `❌ ${errorMsg}`;
                statusEl.style.color = '#f66';
            }
            throw new Error(errorMsg);
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        // Poll for completion
        const imageUrl = await pollForCompletion(promptId);
        
        if (imageUrl) {
            console.log('✅ Image generated successfully!');
            console.log('🖼️ Image URL:', imageUrl);
            
            aiState.generating = false;
            if (statusEl) {
                statusEl.textContent = '✅ Image ready';
                statusEl.style.color = '#4f4';
            }
            
            // Buffer handling
            if (aiState.bufferMode && aiState.currentImage) {
                aiState.bufferImage = aiState.currentImage;
            }
            aiState.currentImage = imageUrl;
            
            displayImage(imageUrl);
            addToBuffer(imageUrl);
            return imageUrl;
        } else {
            console.warn('⚠️ pollForCompletion returned null - no image found');
        }
        
    } catch (e) {
        console.error('Generation error:', e);
        if (statusEl) {
            statusEl.textContent = '❌ Generation failed';
            statusEl.style.color = '#f66';
        }
    }
    
    aiState.generating = false;
    return null;
}

/**
 * Erstellt ComfyUI Workflow
 */
function createWorkflow(prompt, model) {
    // Prompt mit aktiven Modifiern erweitern
    const enhancedPrompt = buildEnhancedPrompt(prompt);
    
    // Verwende manuelle Settings aus aiState
    const steps = aiState.steps;
    const cfg = aiState.cfg;
    const sampler = aiState.sampler;
    const scheduler = (sampler.includes('euler') || sampler === 'ddim') ? 'normal' : 'karras';
    
    console.log(`🎨 Workflow: ${steps} steps, CFG ${cfg}, ${sampler}, ${scheduler}`);
    
    // Negative Prompt mit Anatomy-Erweiterung wenn aktiv
    let negativePrompt = 'ugly, blurry, bad quality, distorted';
    if (aiState.promptModifiers.anatomy) {
        negativePrompt += ', extra fingers, missing fingers, extra limbs, missing limbs, deformed hands, bad anatomy, disfigured, mutated';
    }
    
    // Dimensionen bestimmen
    let genDims, outputDims;
    if (aiState.upscaleEnabled) {
        // Kleine Generierungsauflösung
        genDims = getImageDimensions(aiState.generateResolution, model);
        outputDims = getImageDimensions(aiState.resolution, model);
        console.log(`🔍 Upscale: Generate ${genDims.width}x${genDims.height} → ${outputDims.width}x${outputDims.height}`);
    } else {
        genDims = getImageDimensions(aiState.resolution, model);
        outputDims = genDims;
    }
    
    // Basis-Workflow
    const workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": Math.floor(Math.random() * 1000000000),
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler,
                "scheduler": scheduler,
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": getCheckpointName(model)
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": genDims.width,
                "height": genDims.height,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": enhancedPrompt,
                "clip": ["4", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negativePrompt,
                "clip": ["4", 1]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            }
        }
    };
    
    // Upscale Node hinzufügen wenn aktiviert
    if (aiState.upscaleEnabled && (outputDims.width !== genDims.width || outputDims.height !== genDims.height)) {
        workflow["10"] = {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["8", 0],
                "upscale_method": aiState.upscaleMethod,
                "width": outputDims.width,
                "height": outputDims.height,
                "crop": "disabled"
            }
        };
        // SaveImage oder PreviewImage je nach Einstellung
        if (aiState.saveImages) {
            workflow["9"] = {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "synaesthesie",
                    "images": ["10", 0]
                }
            };
        } else {
            workflow["9"] = {
                "class_type": "PreviewImage",
                "inputs": {
                    "images": ["10", 0]
                }
            };
        }
    } else {
        // SaveImage oder PreviewImage je nach Einstellung
        if (aiState.saveImages) {
            workflow["9"] = {
                "class_type": "SaveImage",
                "inputs": {
                    "filename_prefix": "synaesthesie",
                    "images": ["8", 0]
                }
            };
        } else {
            workflow["9"] = {
                "class_type": "PreviewImage",
                "inputs": {
                    "images": ["8", 0]
                }
            };
        }
    }
    
    return workflow;
}

/**
 * Baut den erweiterten Prompt mit aktiven Modifiern und Instrument
 */
function buildEnhancedPrompt(basePrompt) {
    const parts = [basePrompt];
    
    // Instrument hinzufügen wenn aktiviert
    const instrument = getInstrumentForPrompt();
    if (instrument) {
        parts.push(instrument);
        console.log('🎸 Added instrument to prompt:', instrument);
    }
    
    // Sammle aktive Modifier
    const activeModifiers = [];
    for (const [key, isActive] of Object.entries(aiState.promptModifiers)) {
        if (isActive && aiState.modifierTexts[key]) {
            parts.push(aiState.modifierTexts[key]);
            activeModifiers.push(aiState.modifierTexts[key]);
        }
    }
    
    const enhanced = parts.join(', ');
    
    // Zeige erweiterten Prompt in Console
    if (parts.length > 1) {
        console.log('📝 Enhanced prompt:', enhanced);
    }
    
    // Debug UI aktualisieren
    updatePromptDebug(basePrompt, instrument, activeModifiers, enhanced);
    
    return enhanced;
}

/**
 * Aktualisiert die Prompt-Debug-Anzeige
 */
function updatePromptDebug(basePrompt, instrument, modifiers, finalPrompt) {
    const baseEl = document.getElementById('aiDebugBasePrompt');
    const instrumentEl = document.getElementById('aiDebugInstrument');
    const modifiersEl = document.getElementById('aiDebugModifiers');
    const finalEl = document.getElementById('aiDebugFinalPrompt');
    const timestampEl = document.getElementById('aiDebugTimestamp');
    
    if (baseEl) baseEl.textContent = basePrompt || '-';
    if (instrumentEl) instrumentEl.textContent = instrument || '(none)';
    if (modifiersEl) modifiersEl.textContent = modifiers.length > 0 ? modifiers.join(' | ') : '(none)';
    if (finalEl) finalEl.textContent = finalPrompt || '-';
    if (timestampEl) timestampEl.textContent = new Date().toLocaleTimeString();
}

/**
 * Exportierte Funktion zum manuellen Refresh der Debug-Anzeige
 */
export function refreshPromptDebug() {
    const basePrompt = promptInputEl?.value.trim() || aiState.currentPrompt || '';
    const instrument = getInstrumentForPrompt();
    
    const activeModifiers = [];
    for (const [key, isActive] of Object.entries(aiState.promptModifiers)) {
        if (isActive && aiState.modifierTexts[key]) {
            activeModifiers.push(aiState.modifierTexts[key]);
        }
    }
    
    const parts = [basePrompt];
    if (instrument) parts.push(instrument);
    parts.push(...activeModifiers);
    const finalPrompt = parts.filter(p => p).join(', ');
    
    updatePromptDebug(basePrompt, instrument, activeModifiers, finalPrompt);
    
    return finalPrompt;
}

/**
 * Berechnet Bilddimensionen basierend auf Resolution
 * Resolution ist jetzt im Format "WxH" (z.B. "1920x1080") oder "custom"
 */
function getImageDimensions(resolution, model) {
    let width, height;
    
    // Custom Resolution
    if (resolution === 'custom') {
        width = aiState.customWidth;
        height = aiState.customHeight;
    } else {
        // Parse "WxH" Format
        const parts = resolution.split('x');
        if (parts.length === 2) {
            width = parseInt(parts[0]);
            height = parseInt(parts[1]);
        } else {
            // Fallback auf 1920x1080
            width = 1920;
            height = 1080;
        }
    }
    
    // Auf 64er-Grid runden (wichtig für Stable Diffusion)
    width = Math.round(width / 64) * 64;
    height = Math.round(height / 64) * 64;
    
    // Mindestgröße 64x64
    return {
        width: Math.max(64, width),
        height: Math.max(64, height)
    };
}

// Verfügbare Checkpoints (wird von ComfyUI geladen)
let availableCheckpoints = [];

/**
 * Lädt verfügbare Checkpoints von ComfyUI
 */
export async function loadAvailableCheckpoints() {
    try {
        const response = await fetch(`${aiState.comfyUrl}/object_info/CheckpointLoaderSimple`);
        if (response.ok) {
            const data = await response.json();
            const ckptInput = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name;
            if (ckptInput && Array.isArray(ckptInput[0])) {
                availableCheckpoints = ckptInput[0];
                console.log('Available checkpoints:', availableCheckpoints);
                updateCheckpointUI();
                return availableCheckpoints;
            }
        }
    } catch (e) {
        console.warn('Could not load checkpoints:', e);
    }
    return [];
}

/**
 * Aktualisiert Checkpoint-UI mit verfügbaren Modellen
 */
function updateCheckpointUI() {
    const selectEl = document.getElementById('comfyCheckpoint');
    if (!selectEl || availableCheckpoints.length === 0) return;
    
    selectEl.innerHTML = '';
    availableCheckpoints.forEach(ckpt => {
        const option = document.createElement('option');
        option.value = ckpt;
        option.textContent = ckpt.replace('.safetensors', '').replace('.ckpt', '');
        selectEl.appendChild(option);
    });
    
    // Setze aktuelles Modell
    const currentCkpt = getCheckpointName(aiState.model);
    if (availableCheckpoints.includes(currentCkpt)) {
        selectEl.value = currentCkpt;
    } else if (availableCheckpoints.length > 0) {
        selectEl.value = availableCheckpoints[0];
        aiState.customCheckpoint = availableCheckpoints[0];
    }
}

/**
 * Gibt Checkpoint-Name basierend auf Model zurück
 */
function getCheckpointName(model) {
    // Custom checkpoint hat Vorrang
    if (aiState.customCheckpoint) {
        return aiState.customCheckpoint;
    }
    
    // Defaults
    const defaults = {
        'local-sdxl': 'sd_xl_base_1.0.safetensors',
        'local-turbo': 'sd_turbo.safetensors',
        'local-sd15': 'v1-5-pruned-emaonly.safetensors'
    };
    
    const defaultCkpt = defaults[model] || defaults['local-sd15'];
    
    // Prüfe ob default verfügbar ist
    if (availableCheckpoints.length > 0 && !availableCheckpoints.includes(defaultCkpt)) {
        // Suche nach ähnlichem Namen
        const similar = availableCheckpoints.find(c => 
            c.toLowerCase().includes('sd15') || 
            c.toLowerCase().includes('v1-5') ||
            c.toLowerCase().includes('1.5')
        );
        if (similar) return similar;
        
        // Fallback: erstes verfügbares
        return availableCheckpoints[0];
    }
    
    return defaultCkpt;
}

/**
 * Pollt ComfyUI für Completion
 */
async function pollForCompletion(promptId, maxAttempts = 180) {
    console.log(`⏳ Polling for completion, promptId: ${promptId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 500));
        
        try {
            const historyResponse = await fetch(`${aiState.comfyUrl}/history/${promptId}`);
            if (!historyResponse.ok) continue;
            
            const history = await historyResponse.json();
            
            if (history[promptId] && history[promptId].outputs) {
                const outputs = history[promptId].outputs;
                
                // Finde SaveImage Output
                for (const nodeId of Object.keys(outputs)) {
                    if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                        const image = outputs[nodeId].images[0];
                        console.log('🖼️ Found image in outputs:', image);
                        
                        // URL zusammenbauen - subfolder kann leer sein
                        let imageUrl = `${aiState.comfyUrl}/view?filename=${encodeURIComponent(image.filename)}`;
                        if (image.subfolder) {
                            imageUrl += `&subfolder=${encodeURIComponent(image.subfolder)}`;
                        }
                        imageUrl += `&type=${image.type || 'output'}`;
                        
                        console.log('🖼️ Constructed image URL:', imageUrl);
                        return imageUrl;
                    }
                }
            }
        } catch (e) {
            console.warn(`Polling attempt ${i + 1} failed:`, e.message);
        }
        
        // Update status
        if (statusEl) {
            statusEl.textContent = `🎨 Generating... ${Math.round(((i + 1) / maxAttempts) * 100)}%`;
        }
    }
    
    console.warn('⚠️ Polling timed out after', maxAttempts, 'attempts');
    return null;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Zeigt Bild im Preview und/oder Overlay an
 */
function displayImage(imageUrl) {
    console.log('🖼️ displayImage called with URL:', imageUrl);
    console.log('🖼️ previewEl exists:', !!previewEl);
    console.log('🖼️ displayMode:', aiState.displayMode);
    
    // Preview - IMMER anzeigen wenn previewEl existiert
    if (previewEl) {
        previewEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            console.log('✅ Preview image loaded successfully');
        };
        img.onerror = (e) => {
            console.error('❌ Preview image failed to load:', e);
            // Fallback: Zeige URL als Text
            previewEl.innerHTML = `<div style="color:#f66;font-size:8px;word-break:break-all;">Error loading: ${imageUrl}</div>`;
        };
        
        previewEl.appendChild(img);
        console.log('🖼️ Image element added to preview');
    } else {
        console.warn('⚠️ previewEl not found!');
    }
    
    // Overlay Canvas (wenn opacity > 0)
    if (aiState.overlayOpacity > 0 && overlayCanvas && overlayCtx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            console.log('✅ Overlay image loaded');
            if (aiState.crossfadeEnabled && aiState.bufferImage) {
                crossfadeToImage(img);
            } else {
                drawImageToOverlay(img);
            }
        };
        img.onerror = (e) => {
            console.error('❌ Overlay image failed to load:', e);
        };
        img.src = imageUrl;
    }
}

/**
 * Zeichnet Bild auf Overlay Canvas
 */
function drawImageToOverlay(img) {
    if (!overlayCanvas || !overlayCtx) return;
    
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Aspect-ratio erhaltend skalieren
    const scale = Math.min(
        overlayCanvas.width / img.width,
        overlayCanvas.height / img.height
    );
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (overlayCanvas.width - w) / 2;
    const y = (overlayCanvas.height - h) / 2;
    
    // Opacity aus State verwenden
    overlayCtx.globalAlpha = aiState.overlayOpacity / 100;
    overlayCtx.drawImage(img, x, y, w, h);
    overlayCtx.globalAlpha = 1;
}

/**
 * Crossfade zwischen zwei Bildern
 */
function crossfadeToImage(newImg, duration = 1000) {
    if (!overlayCanvas || !overlayCtx) return;
    
    const oldImg = new Image();
    oldImg.crossOrigin = 'anonymous';
    oldImg.src = aiState.bufferImage;
    
    const startTime = performance.now();
    
    function animate() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Altes Bild (fading out)
        if (oldImg.complete) {
            overlayCtx.globalAlpha = 0.7 * (1 - progress);
            drawImageToOverlay(oldImg);
        }
        
        // Neues Bild (fading in)
        overlayCtx.globalAlpha = 0.7 * progress;
        drawImageToOverlay(newImg);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    oldImg.onload = animate;
    if (oldImg.complete) animate();
}

/**
 * Aktualisiert Resolution-Anzeige
 */
function updateResolutionDisplay() {
    const displayEl = document.getElementById('aiResolutionDisplay');
    if (displayEl) {
        const dims = getImageDimensions(aiState.resolution, aiState.model);
        // Zeige auch gerundete Werte wenn sie sich unterscheiden
        const originalRes = aiState.resolution === 'custom' 
            ? `${aiState.customWidth}×${aiState.customHeight}` 
            : aiState.resolution.replace('x', '×');
        
        if (dims.width !== parseInt(originalRes.split('×')[0]) || 
            dims.height !== parseInt(originalRes.split('×')[1])) {
            displayEl.textContent = `${dims.width}×${dims.height}px (rounded)`;
            displayEl.style.color = '#ff8';
        } else {
            displayEl.textContent = `${dims.width}×${dims.height}px`;
            displayEl.style.color = '#888';
        }
    }
}

/**
 * Aktualisiert Buffer-Status Anzeige
 */
function updateBufferStatus() {
    const statusEl = document.getElementById('aiBufferStatus');
    if (statusEl) {
        statusEl.textContent = `Buffer: ${aiState.bufferImages.length}/${aiState.bufferSize}`;
    }
    updateBufferThumbnails();
}

/**
 * Aktualisiert Buffer-Thumbnails
 */
function updateBufferThumbnails() {
    if (!bufferThumbsEl) return;
    
    bufferThumbsEl.innerHTML = '';
    bufferThumbsEl.style.display = aiState.bufferMode ? 'flex' : 'none';
    bufferThumbsEl.style.flexWrap = 'wrap';
    bufferThumbsEl.style.gap = '2px';
    
    aiState.bufferImages.forEach((imgUrl, index) => {
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            width: 24px;
            height: 24px;
            background-image: url(${imgUrl});
            background-size: cover;
            background-position: center;
            border-radius: 2px;
            cursor: pointer;
            border: 1px solid ${index === aiState.bufferIndex ? '#4af' : '#333'};
        `;
        thumb.title = `Image ${index + 1}`;
        thumb.addEventListener('click', () => {
            aiState.bufferIndex = index;
            displayImage(imgUrl);
            updateBufferThumbnails();
        });
        bufferThumbsEl.appendChild(thumb);
    });
}

/**
 * Fügt Bild zum Buffer hinzu
 */
function addToBuffer(imageUrl) {
    if (!aiState.bufferMode) return;
    
    aiState.bufferImages.push(imageUrl);
    
    // Buffer-Größe begrenzen
    while (aiState.bufferImages.length > aiState.bufferSize) {
        aiState.bufferImages.shift();
    }
    
    aiState.bufferIndex = aiState.bufferImages.length - 1;
    updateBufferStatus();
}

/**
 * Aktualisiert Overlay-Sichtbarkeit basierend auf Opacity
 */
function updateOverlayVisibility() {
    if (!overlayCanvas) return;
    
    if (aiState.overlayOpacity > 0) {
        overlayCanvas.style.display = 'block';
        overlayCanvas.style.pointerEvents = 'none';
        
        // Aktuelles Bild neu zeichnen wenn vorhanden
        if (aiState.currentImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => drawImageToOverlay(img);
            img.src = aiState.currentImage;
        }
    } else {
        overlayCanvas.style.display = 'none';
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    }
}

// ============================================
// POST-PROCESSING UPSCALE (Lokal in App)
// ============================================

// Offscreen Canvas für Upscaling
let upscaleCanvas = null;
let upscaleCtx = null;

/**
 * Initialisiert das Upscale-Canvas
 */
function initUpscaleCanvas() {
    if (!upscaleCanvas) {
        upscaleCanvas = document.createElement('canvas');
        upscaleCtx = upscaleCanvas.getContext('2d');
    }
}

/**
 * Skaliert ein Bild lokal mit verschiedenen Methoden
 * @param {string} imageUrl - URL des Quellbilds
 * @param {number} targetWidth - Zielbreite
 * @param {number} targetHeight - Zielhöhe
 * @param {string} method - 'nearest', 'bilinear', 'bicubic', 'lanczos'
 * @param {number} sharpen - Schärfung 0-100
 * @returns {Promise<string>} - Data URL des skalierten Bilds
 */
export async function upscaleImage(imageUrl, targetWidth, targetHeight, method = 'lanczos', sharpen = 0) {
    initUpscaleCanvas();
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            console.log(`🔍 Upscaling ${img.width}x${img.height} → ${targetWidth}x${targetHeight} (${method})`);
            
            upscaleCanvas.width = targetWidth;
            upscaleCanvas.height = targetHeight;
            
            // Interpolations-Methode setzen
            switch (method) {
                case 'nearest':
                    upscaleCtx.imageSmoothingEnabled = false;
                    break;
                case 'bilinear':
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'low';
                    break;
                case 'bicubic':
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'medium';
                    break;
                case 'lanczos':
                default:
                    upscaleCtx.imageSmoothingEnabled = true;
                    upscaleCtx.imageSmoothingQuality = 'high';
                    break;
            }
            
            // Bild zeichnen
            upscaleCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
            
            // Schärfung anwenden wenn gewünscht
            if (sharpen > 0) {
                applySharpen(upscaleCtx, targetWidth, targetHeight, sharpen / 100);
            }
            
            // Als Data URL zurückgeben
            const dataUrl = upscaleCanvas.toDataURL('image/png');
            console.log(`✅ Upscale complete`);
            resolve(dataUrl);
        };
        
        img.onerror = (e) => {
            console.error('❌ Failed to load image for upscaling:', e);
            reject(e);
        };
        
        img.src = imageUrl;
    });
}

/**
 * Wendet Schärfung auf das Canvas an (Unsharp Mask)
 */
function applySharpen(ctx, width, height, amount) {
    if (amount <= 0) return;
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    
    // Schärfungskernel (Laplace)
    const strength = amount * 0.5; // 0-0.5 Bereich
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            for (let c = 0; c < 3; c++) { // RGB, nicht Alpha
                const center = copy[idx + c];
                const neighbors = (
                    copy[((y - 1) * width + x) * 4 + c] +
                    copy[((y + 1) * width + x) * 4 + c] +
                    copy[(y * width + x - 1) * 4 + c] +
                    copy[(y * width + x + 1) * 4 + c]
                ) / 4;
                
                const sharpened = center + (center - neighbors) * strength;
                data[idx + c] = Math.max(0, Math.min(255, sharpened));
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

/**
 * Skaliert das aktuelle Bild und zeigt es an
 */
export async function upscaleCurrentImage() {
    if (!aiState.currentImage) {
        console.warn('No image to upscale');
        return null;
    }
    
    const [targetW, targetH] = aiState.postUpscaleTarget.split('x').map(Number);
    
    if (statusEl) {
        statusEl.textContent = '🔍 Upscaling...';
        statusEl.style.color = '#ff0';
    }
    
    try {
        const upscaledUrl = await upscaleImage(
            aiState.currentImage,
            targetW,
            targetH,
            aiState.postUpscaleMethod,
            aiState.postUpscaleSharpen
        );
        
        // Upscaled Bild anzeigen
        displayImage(upscaledUrl);
        
        // Optional: Im Buffer ersetzen
        if (aiState.bufferMode && aiState.bufferImages.length > 0) {
            aiState.bufferImages[aiState.bufferIndex] = upscaledUrl;
            updateBufferThumbnails();
        }
        
        aiState.currentImage = upscaledUrl;
        
        if (statusEl) {
            statusEl.textContent = `✅ Upscaled to ${targetW}×${targetH}`;
            statusEl.style.color = '#4f4';
        }
        
        return upscaledUrl;
        
    } catch (e) {
        console.error('Upscale failed:', e);
        if (statusEl) {
            statusEl.textContent = '❌ Upscale failed';
            statusEl.style.color = '#f66';
        }
        return null;
    }
}

/**
 * Skaliert alle Bilder im Buffer
 */
export async function upscaleBuffer() {
    if (aiState.bufferImages.length === 0) {
        console.warn('Buffer is empty');
        return;
    }
    
    const [targetW, targetH] = aiState.postUpscaleTarget.split('x').map(Number);
    const total = aiState.bufferImages.length;
    
    console.log(`🔍 Upscaling ${total} images in buffer...`);
    
    for (let i = 0; i < total; i++) {
        if (statusEl) {
            statusEl.textContent = `🔍 Upscaling ${i + 1}/${total}...`;
            statusEl.style.color = '#ff0';
        }
        
        try {
            const upscaledUrl = await upscaleImage(
                aiState.bufferImages[i],
                targetW,
                targetH,
                aiState.postUpscaleMethod,
                aiState.postUpscaleSharpen
            );
            
            aiState.bufferImages[i] = upscaledUrl;
            
        } catch (e) {
            console.error(`Failed to upscale image ${i + 1}:`, e);
        }
    }
    
    // Aktuelles Bild aktualisieren
    aiState.currentImage = aiState.bufferImages[aiState.bufferIndex];
    displayImage(aiState.currentImage);
    updateBufferThumbnails();
    
    if (statusEl) {
        statusEl.textContent = `✅ Upscaled ${total} images`;
        statusEl.style.color = '#4f4';
    }
    
    console.log(`✅ Buffer upscale complete`);
}

// ============================================
// CONTINUOUS GENERATION
// ============================================

/**
 * Startet kontinuierliche Bildgenerierung bis Buffer voll
 */
export async function startContinuousGeneration(prompt) {
    if (!prompt || prompt.trim() === '') {
        console.warn('Cannot start continuous generation: no prompt');
        return;
    }
    
    if (!aiState.connected) {
        console.warn('Cannot start continuous generation: not connected');
        return;
    }
    
    aiState.continuousGen = true;
    continuousGenActive = true;
    console.log(`🔄 Starting continuous generation for ${aiState.bufferSize} images`);
    
    updateContinuousGenUI();
    
    while (continuousGenActive && aiState.bufferImages.length < aiState.bufferSize) {
        if (aiState.generating) {
            await new Promise(r => setTimeout(r, 500));
            continue;
        }
        
        const result = await generateImage(prompt);
        
        if (!result) {
            console.warn('Generation failed, stopping continuous gen');
            break;
        }
        
        // Status Update
        updateBufferStatus();
        
        // Kleine Pause zwischen Generierungen
        await new Promise(r => setTimeout(r, 100));
    }
    
    continuousGenActive = false;
    aiState.continuousGen = false;
    console.log(`✅ Continuous generation complete: ${aiState.bufferImages.length} images`);
    updateContinuousGenUI();
}

/**
 * Stoppt kontinuierliche Generierung
 */
export function stopContinuousGeneration() {
    continuousGenActive = false;
    aiState.continuousGen = false;
    console.log('⏹ Continuous generation stopped');
    updateContinuousGenUI();
}

/**
 * Aktualisiert UI für Continuous Gen
 */
function updateContinuousGenUI() {
    const btn = document.getElementById('aiContinuousGenBtn');
    if (btn) {
        if (aiState.continuousGen) {
            btn.textContent = '⏹ Stop';
            btn.style.background = '#a33';
        } else {
            btn.textContent = '🔄 Fill Buffer';
            btn.style.background = '';
        }
    }
}

// ============================================
// STREAM MODE (Continuous Output without Storage)
// ============================================

/**
 * Startet Stream Mode - generiert endlos ohne zu speichern
 * Jedes Bild wird sofort angezeigt und dann verworfen
 * @param {string} prompt - Der zu verwendende Prompt
 */
export async function startStreamMode(prompt) {
    if (!prompt || prompt.trim() === '') {
        console.warn('Cannot start stream mode: no prompt');
        return;
    }
    
    if (!aiState.connected) {
        console.warn('Cannot start stream mode: not connected');
        return;
    }
    
    // Stop andere Modi
    stopPlayback();
    stopContinuousGeneration();
    
    aiState.streamMode = true;
    streamModeActive = true;
    streamImageCount = 0;
    streamStartTime = Date.now();
    
    console.log(`📡 Starting Stream Mode (no buffer)`);
    updateStreamModeUI();
    
    while (streamModeActive) {
        if (aiState.generating) {
            await new Promise(r => setTimeout(r, 200));
            continue;
        }
        
        // Generiere Bild direkt ohne Buffer
        const result = await generateImageStream(prompt);
        
        if (!result) {
            console.warn('Stream generation failed, retrying...');
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }
        
        streamImageCount++;
        updateStreamStatus();
        
        // Optionale Pause zwischen Generierungen
        if (aiState.streamPause > 0) {
            await new Promise(r => setTimeout(r, aiState.streamPause));
        }
    }
    
    aiState.streamMode = false;
    console.log(`⏹ Stream Mode stopped. Generated ${streamImageCount} images.`);
    updateStreamModeUI();
}

/**
 * Generiert ein Bild für Stream Mode (ohne Buffer-Speicherung)
 */
async function generateImageStream(prompt) {
    if (!aiState.connected || aiState.generating) {
        return null;
    }
    
    aiState.generating = true;
    aiState.lastGeneratedPrompt = prompt;
    
    if (statusEl) {
        statusEl.textContent = `📡 Streaming #${streamImageCount + 1}...`;
        statusEl.style.color = '#4af';
    }
    
    const workflow = createWorkflow(prompt, aiState.model);
    
    try {
        const queueResponse = await fetch(`${aiState.comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        
        if (!queueResponse.ok) {
            throw new Error('Failed to queue prompt');
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        const imageUrl = await pollForCompletion(promptId);
        
        if (imageUrl) {
            aiState.generating = false;
            
            // Nur anzeigen, NICHT in Buffer speichern
            // Vorheriges Bild für Crossfade merken
            if (aiState.crossfadeEnabled) {
                aiState.bufferImage = aiState.currentImage;
            }
            aiState.currentImage = imageUrl;
            
            displayImage(imageUrl);
            return imageUrl;
        }
        
    } catch (e) {
        console.error('Stream generation error:', e);
    }
    
    aiState.generating = false;
    return null;
}

/**
 * Stoppt Stream Mode
 */
export function stopStreamMode() {
    streamModeActive = false;
    aiState.streamMode = false;
    console.log('⏹ Stream Mode stopped');
    updateStreamModeUI();
}

/**
 * Toggle Stream Mode
 */
export function toggleStreamMode() {
    if (aiState.streamMode) {
        stopStreamMode();
    } else {
        const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
        if (prompt) {
            startStreamMode(prompt);
        } else {
            alert('Bitte gib zuerst einen Prompt ein!');
        }
    }
}

/**
 * Aktualisiert Stream Mode UI
 */
function updateStreamModeUI() {
    const btn = document.getElementById('aiStreamModeBtn');
    if (btn) {
        if (aiState.streamMode) {
            btn.textContent = '⏹ Stop Stream';
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg, #f44, #a22)';
        } else {
            btn.textContent = '📡 Stream';
            btn.classList.remove('active');
            btn.style.background = '';
        }
    }
}

/**
 * Aktualisiert Stream Status Anzeige
 */
function updateStreamStatus() {
    const elapsed = (Date.now() - streamStartTime) / 1000;
    const fps = streamImageCount / elapsed;
    const avgTime = elapsed / streamImageCount;
    
    const streamStatusEl = document.getElementById('aiStreamStatus');
    if (streamStatusEl) {
        streamStatusEl.textContent = `#${streamImageCount} | ${avgTime.toFixed(1)}s/img | ${fps.toFixed(2)} fps`;
        streamStatusEl.style.color = '#4af';
    }
    
    if (statusEl) {
        statusEl.textContent = `📡 Stream: #${streamImageCount}`;
        statusEl.style.color = '#4af';
    }
}

/**
 * Setzt Stream Pause
 */
export function setStreamPause(ms) {
    aiState.streamPause = Math.max(0, ms);
    console.log(`Stream pause set to ${ms}ms`);
}

// ============================================
// BUFFER PLAYBACK
// ============================================

/**
 * Startet Buffer-Wiedergabe
 */
export function startPlayback() {
    if (aiState.bufferImages.length === 0) {
        console.warn('Cannot start playback: buffer empty');
        return;
    }
    
    aiState.playbackActive = true;
    console.log(`▶ Starting playback at ${aiState.playbackSpeed}ms interval`);
    
    // Erstes Bild sofort zeigen
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    
    // Timer starten
    playbackTimer = setInterval(() => {
        nextBufferImage();
    }, aiState.playbackSpeed);
    
    updatePlaybackUI();
}

/**
 * Stoppt Buffer-Wiedergabe
 */
export function stopPlayback() {
    aiState.playbackActive = false;
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
    console.log('⏸ Playback stopped');
    updatePlaybackUI();
}

/**
 * Toggle Playback
 */
export function togglePlayback() {
    if (aiState.playbackActive) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

/**
 * Nächstes Bild im Buffer
 */
export function nextBufferImage() {
    if (aiState.bufferImages.length === 0) return;
    
    if (aiState.bufferShuffle) {
        // Random
        aiState.bufferIndex = Math.floor(Math.random() * aiState.bufferImages.length);
    } else {
        // Sequential
        aiState.bufferIndex++;
        if (aiState.bufferIndex >= aiState.bufferImages.length) {
            if (aiState.bufferLoop) {
                aiState.bufferIndex = 0;
            } else {
                aiState.bufferIndex = aiState.bufferImages.length - 1;
                stopPlayback();
                return;
            }
        }
    }
    
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    updateBufferThumbnails();
}

/**
 * Vorheriges Bild im Buffer
 */
export function prevBufferImage() {
    if (aiState.bufferImages.length === 0) return;
    
    aiState.bufferIndex--;
    if (aiState.bufferIndex < 0) {
        if (aiState.bufferLoop) {
            aiState.bufferIndex = aiState.bufferImages.length - 1;
        } else {
            aiState.bufferIndex = 0;
        }
    }
    
    displayImage(aiState.bufferImages[aiState.bufferIndex]);
    updateBufferThumbnails();
}

/**
 * Setzt Playback-Geschwindigkeit
 */
export function setPlaybackSpeed(ms) {
    aiState.playbackSpeed = ms;
    console.log(`Playback speed set to ${ms}ms`);
    
    // Timer neu starten wenn aktiv
    if (aiState.playbackActive) {
        clearInterval(playbackTimer);
        playbackTimer = setInterval(() => {
            nextBufferImage();
        }, aiState.playbackSpeed);
    }
}

/**
 * Aktualisiert Playback-UI
 */
function updatePlaybackUI() {
    const playBtn = document.getElementById('aiPlaybackBtn');
    if (playBtn) {
        if (aiState.playbackActive) {
            playBtn.textContent = '⏸';
            playBtn.title = 'Pause';
        } else {
            playBtn.textContent = '▶';
            playBtn.title = 'Play';
        }
    }
}

/**
 * Löscht alle Bilder im Buffer
 */
export function clearBuffer() {
    stopPlayback();
    aiState.bufferImages = [];
    aiState.bufferIndex = 0;
    aiState.currentImage = null;
    aiState.bufferImage = null;
    updateBufferStatus();
    
    // Preview leeren
    if (previewEl) {
        previewEl.innerHTML = '<span class="placeholder">No Image</span>';
    }
    
    // Overlay leeren
    if (overlayCtx && overlayCanvas) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    
    console.log('🗑 Buffer cleared');
}

// ============================================
// AUTO-GENERATION & SPEECH BUFFER
// ============================================

/**
 * Aktualisiert Prompt von Speech Input mit Buffer-System
 * - Akkumuliert erkannte Wörter über Zeit
 * - Cleared automatisch nach X Sekunden Stille
 * - Vermeidet Duplikate
 */
export function updateFromSpeech(rawText, filteredText) {
    const textToUse = filteredText || rawText;
    
    if (!textToUse || textToUse.trim() === '') {
        return;
    }
    
    // Neue Wörter extrahieren
    const newWords = textToUse.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (newWords.length === 0) {
        return;
    }
    
    // Timestamp aktualisieren
    speechLastUpdate = Date.now();
    
    // Neue Wörter zum Buffer hinzufügen (Duplikate vermeiden)
    for (const word of newWords) {
        const wordLower = word.toLowerCase();
        // Nur hinzufügen wenn nicht bereits vorhanden (letzte 10 Wörter)
        const recentWords = speechBuffer.slice(-10).map(w => w.toLowerCase());
        if (!recentWords.includes(wordLower)) {
            speechBuffer.push(word);
        }
    }
    
    // Buffer-Größe begrenzen (max 20 Wörter)
    while (speechBuffer.length > 20) {
        speechBuffer.shift();
    }
    
    // Aktuellen Prompt aus Buffer erstellen
    const bufferedPrompt = speechBuffer.join(' ');
    aiState.currentPrompt = bufferedPrompt;
    
    // UI aktualisieren
    if (currentInputEl) {
        const displayText = speechBuffer.length > 0 
            ? `🎙️ [${speechBuffer.length}] ${bufferedPrompt}`
            : '🎙️ -';
        currentInputEl.textContent = displayText;
        currentInputEl.style.color = '#4f4'; // Grün = aktiv
    }
    
    if (promptInputEl && bufferedPrompt) {
        promptInputEl.value = bufferedPrompt;
    }
    
    // Debug Panel aktualisieren
    refreshPromptDebug();
    
    // Auto-Clear Timer zurücksetzen
    clearTimeout(speechBufferTimer);
    speechBufferTimer = setTimeout(() => {
        clearSpeechBuffer();
    }, speechBufferTimeout);
    
    // Auto-Generate Timer reset (nur wenn Buffer gefüllt)
    if (aiState.autoGenerate && bufferedPrompt.length > 3) {
        clearTimeout(autoGenTimer);
        autoGenTimer = setTimeout(() => {
            if (aiState.autoGenerate && aiState.connected && !aiState.generating) {
                // Generiere mit aktuellem Buffer-Inhalt
                const promptToGenerate = aiState.currentPrompt;
                if (promptToGenerate && promptToGenerate.length > 3) {
                    generateImage(promptToGenerate);
                }
            }
        }, AUTO_GEN_DELAY);
    }
    
    console.log(`🗣️ Speech Buffer [${speechBuffer.length}]: "${bufferedPrompt}"`);
}

/**
 * Leert den Speech-Buffer
 */
export function clearSpeechBuffer() {
    speechBuffer = [];
    speechLastUpdate = 0;
    
    // UI zurücksetzen
    if (currentInputEl) {
        currentInputEl.textContent = '🎙️ -';
        currentInputEl.style.color = '#888'; // Grau = leer
    }
    
    // Prompt Input NICHT leeren - nur den Live-Feed
    // aiState.currentPrompt bleibt erhalten für manuelles Generieren
    
    console.log('🗑️ Speech Buffer cleared');
}

/**
 * Setzt die Speech-Buffer Timeout-Zeit
 */
export function setSpeechBufferTimeout(ms) {
    speechBufferTimeout = Math.max(1000, Math.min(10000, ms));
    console.log(`⏱️ Speech Buffer Timeout: ${speechBufferTimeout}ms`);
}

/**
 * Gibt den aktuellen Speech-Buffer zurück
 */
export function getSpeechBuffer() {
    return [...speechBuffer];
}

// ============================================
// SETTERS
// ============================================

export function setOverlayOpacity(opacity) {
    aiState.overlayOpacity = Math.max(0, Math.min(100, opacity));
    updateOverlayVisibility();
}

export function setProvider(provider) {
    aiState.provider = provider;
}

export function setModel(model) {
    aiState.model = model;
}

export function setResolution(resolution) {
    aiState.resolution = resolution;
    console.log(`AI Resolution set to: ${resolution}`);
}

/**
 * Setzt den ComfyUI Port und aktualisiert die URL
 */
export function setComfyPort(port) {
    aiState.comfyPort = port;
    aiState.comfyUrl = `http://localhost:${port}`;
    console.log(`ComfyUI Port set to: ${port}`);
    
    // Status aktualisieren
    if (statusEl) {
        statusEl.textContent = `🖥️ Connecting to localhost:${port}`;
        statusEl.style.color = '#888';
    }
    
    // Verbindung prüfen
    checkComfyConnection();
}

export function setAutoGenerate(enabled) {
    aiState.autoGenerate = enabled;
    if (!enabled) {
        clearTimeout(autoGenTimer);
    }
}

export function setBufferMode(enabled) {
    aiState.bufferMode = enabled;
}

export function setCrossfadeEnabled(enabled) {
    aiState.crossfadeEnabled = enabled;
}

export function setFilterNouns(enabled) {
    aiState.filterNouns = enabled;
}

export function setFilterVerbs(enabled) {
    aiState.filterVerbs = enabled;
}

export function setFilterAdj(enabled) {
    aiState.filterAdj = enabled;
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initAiUI() {
    // Get Elements
    previewEl = document.getElementById('aiImagePreview');
    statusEl = document.getElementById('localSdStatus');
    bufferStatusEl = document.getElementById('aiModelBufferStatus');
    bufferSettingsEl = document.getElementById('aiBufferSettings');
    bufferThumbsEl = document.getElementById('aiBufferThumbs');
    currentInputEl = document.getElementById('aiCurrentInput');
    promptInputEl = document.getElementById('aiPromptInput');
    overlayCanvas = document.getElementById('aiOverlayCanvas');
    
    if (overlayCanvas) {
        overlayCtx = overlayCanvas.getContext('2d');
        // Resize to match window
        overlayCanvas.width = window.innerWidth;
        overlayCanvas.height = window.innerHeight;
        overlayCanvas.style.display = 'none';
    }
    
    // Overlay Opacity Slider
    const overlayOpacitySlider = document.getElementById('aiOverlayOpacity');
    const overlayOpacityValue = document.getElementById('aiOverlayOpacityValue');
    if (overlayOpacitySlider) {
        overlayOpacitySlider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value);
            setOverlayOpacity(opacity);
            if (overlayOpacityValue) overlayOpacityValue.textContent = opacity + '%';
        });
    }
    
    // Provider Tabs (falls vorhanden)
    document.querySelectorAll('.ai-provider-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ai-provider-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            setProvider(tab.dataset.provider);
            
            // Show/hide model groups
            document.querySelectorAll('.ai-model-group').forEach(g => {
                g.style.display = g.dataset.provider === tab.dataset.provider ? 'block' : 'none';
            });
        });
    });
    
    // Resolution Select
    const resolutionSelect = document.getElementById('aiResolutionSelect');
    const customResolutionDiv = document.getElementById('aiCustomResolution');
    const customWidthInput = document.getElementById('aiCustomWidth');
    const customHeightInput = document.getElementById('aiCustomHeight');
    
    if (resolutionSelect) {
        resolutionSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            setResolution(value);
            
            // Show/hide custom inputs
            if (customResolutionDiv) {
                customResolutionDiv.style.display = value === 'custom' ? 'block' : 'none';
            }
            
            updateResolutionDisplay();
        });
    }
    
    // Custom Resolution Inputs
    if (customWidthInput) {
        customWidthInput.addEventListener('change', (e) => {
            aiState.customWidth = parseInt(e.target.value) || 1920;
            updateResolutionDisplay();
        });
    }
    
    if (customHeightInput) {
        customHeightInput.addEventListener('change', (e) => {
            aiState.customHeight = parseInt(e.target.value) || 1080;
            updateResolutionDisplay();
        });
    }
    
    // ComfyUI Port Input
    const comfyPortInput = document.getElementById('comfyPort');
    if (comfyPortInput) {
        // Initial port aus State setzen
        comfyPortInput.value = aiState.comfyPort;
        
        // Port ändern bei Enter
        comfyPortInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const port = parseInt(comfyPortInput.value);
                if (port >= 1 && port <= 65535) {
                    setComfyPort(port);
                }
            }
        });
        
        // Port ändern bei Blur (Fokus verlieren)
        comfyPortInput.addEventListener('blur', () => {
            const port = parseInt(comfyPortInput.value);
            if (port >= 1 && port <= 65535 && port !== aiState.comfyPort) {
                setComfyPort(port);
            }
        });
    }
    
    // ComfyUI Connect Button
    const comfyConnectBtn = document.getElementById('comfyConnectBtn');
    if (comfyConnectBtn) {
        comfyConnectBtn.addEventListener('click', () => {
            const port = parseInt(comfyPortInput?.value || aiState.comfyPort);
            if (port >= 1 && port <= 65535) {
                setComfyPort(port);
            } else {
                checkComfyConnection();
            }
        });
    }
    
    // Checkpoint Select
    const checkpointSelect = document.getElementById('comfyCheckpoint');
    if (checkpointSelect) {
        checkpointSelect.addEventListener('change', (e) => {
            aiState.customCheckpoint = e.target.value;
            console.log('Checkpoint selected:', aiState.customCheckpoint);
        });
    }
    
    // Test ComfyUI in Browser Link
    const testComfyLink = document.getElementById('testComfyLink');
    if (testComfyLink) {
        testComfyLink.addEventListener('click', (e) => {
            e.preventDefault();
            const url = `http://127.0.0.1:${aiState.comfyPort}`;
            console.log('Opening ComfyUI in browser:', url);
            window.open(url, '_blank');
        });
    }
    
    // Start ComfyUI Button
    const startComfyBtn = document.getElementById('startComfyBtn');
    if (startComfyBtn) {
        startComfyBtn.addEventListener('click', async () => {
            // Terminal-Befehl zum Starten von ComfyUI MIT CORS
            const comfyCommand = 'cd ~/ComfyUI && python main.py --enable-cors-header';
            
            try {
                await navigator.clipboard.writeText(comfyCommand);
                console.log('ComfyUI command copied:', comfyCommand);
                // Visuelles Feedback
                const originalText = startComfyBtn.textContent;
                startComfyBtn.textContent = '✅ Kopiert!';
                startComfyBtn.style.background = '#2a5';
                setTimeout(() => {
                    startComfyBtn.textContent = originalText;
                    startComfyBtn.style.background = '';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy command:', err);
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = comfyCommand;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                startComfyBtn.textContent = '✅ Kopiert!';
                setTimeout(() => {
                    startComfyBtn.textContent = 'Start ComfyUI';
                }, 1500);
            }
            
            // Versuche über Electron ComfyUI zu starten
            if (window.electronAPI?.startComfyUI) {
                window.electronAPI.startComfyUI();
                if (statusEl) {
                    statusEl.textContent = '🚀 Starting ComfyUI...';
                    statusEl.style.color = '#ff0';
                }
                setTimeout(checkComfyConnection, 5000);
            }
        });
    }
    
    // Auto Generate Checkbox
    const autoGenCheckbox = document.getElementById('aiAutoGenerate');
    if (autoGenCheckbox) {
        autoGenCheckbox.addEventListener('change', (e) => {
            setAutoGenerate(e.target.checked);
        });
    }
    
    // Buffer Mode Checkbox
    const bufferCheckbox = document.getElementById('aiBufferMode');
    if (bufferCheckbox) {
        bufferCheckbox.addEventListener('change', (e) => {
            setBufferMode(e.target.checked);
            // Show/hide buffer settings panel
            if (bufferSettingsEl) {
                bufferSettingsEl.style.display = e.target.checked ? 'block' : 'none';
            }
            if (bufferThumbsEl) {
                bufferThumbsEl.style.display = e.target.checked ? 'flex' : 'none';
            }
            updateBufferStatus();
        });
    }
    
    // Buffer Size Slider
    const bufferSizeSlider = document.getElementById('aiBufferSize');
    const bufferSizeValue = document.getElementById('aiBufferSizeValue');
    if (bufferSizeSlider) {
        bufferSizeSlider.addEventListener('input', (e) => {
            aiState.bufferSize = parseInt(e.target.value);
            if (bufferSizeValue) bufferSizeValue.textContent = aiState.bufferSize;
            updateBufferStatus();
        });
    }
    
    // Buffer Loop Checkbox
    const bufferLoopCheckbox = document.getElementById('aiBufferLoop');
    if (bufferLoopCheckbox) {
        bufferLoopCheckbox.addEventListener('change', (e) => {
            aiState.bufferLoop = e.target.checked;
        });
    }
    
    // Buffer Shuffle Checkbox
    const bufferShuffleCheckbox = document.getElementById('aiBufferShuffle');
    if (bufferShuffleCheckbox) {
        bufferShuffleCheckbox.addEventListener('change', (e) => {
            aiState.bufferShuffle = e.target.checked;
        });
    }
    
    // Crossfade Checkbox
    const crossfadeCheckbox = document.getElementById('aiCrossfadeEnabled');
    if (crossfadeCheckbox) {
        crossfadeCheckbox.addEventListener('change', (e) => {
            setCrossfadeEnabled(e.target.checked);
        });
    }
    
    // Prompt Input
    if (promptInputEl) {
        promptInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const prompt = promptInputEl.value.trim();
                if (prompt) {
                    generateImage(prompt);
                }
            }
        });
    }
    
    // Generate Button
    const generateBtn = document.getElementById('aiGenerateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
            if (prompt) {
                generateImage(prompt);
            }
        });
    }
    
    // Clear Prompt Button
    const clearBtn = document.getElementById('aiClearPrompt');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (promptInputEl) promptInputEl.value = '';
            aiState.currentPrompt = '';
            if (currentInputEl) currentInputEl.textContent = '🎤 -';
        });
    }
    
    // Filter Checkboxes - NOTE: Diese werden von speech.js gehandled!
    // Die ai-image.js Handler sind nur für lokalen State (z.B. wenn AI ohne Speech verwendet wird)
    // Synchronisiere mit speechState für konsistentes Verhalten
    const nounsCheckbox = document.getElementById('aiFilterNouns');
    const verbsCheckbox = document.getElementById('aiFilterVerbs');
    const adjCheckbox = document.getElementById('aiFilterAdj');
    
    // Importiere speechState Setter wenn verfügbar
    const syncWithSpeech = (type, value) => {
        // Versuche speechState zu synchronisieren
        if (window.Synaesthesia?.speechState) {
            window.Synaesthesia.speechState[type] = value;
        }
    };
    
    if (nounsCheckbox) {
        nounsCheckbox.addEventListener('change', (e) => {
            setFilterNouns(e.target.checked);
            syncWithSpeech('filterNouns', e.target.checked);
            console.log('🏷️ Filter Nouns:', e.target.checked);
        });
    }
    if (verbsCheckbox) {
        verbsCheckbox.addEventListener('change', (e) => {
            setFilterVerbs(e.target.checked);
            syncWithSpeech('filterVerbs', e.target.checked);
            console.log('🏷️ Filter Verbs:', e.target.checked);
        });
    }
    if (adjCheckbox) {
        adjCheckbox.addEventListener('change', (e) => {
            setFilterAdj(e.target.checked);
            syncWithSpeech('filterAdj', e.target.checked);
            console.log('🏷️ Filter Adj:', e.target.checked);
        });
    }
    
    // Window resize handler for overlay
    window.addEventListener('resize', () => {
        if (overlayCanvas) {
            overlayCanvas.width = window.innerWidth;
            overlayCanvas.height = window.innerHeight;
        }
    });
    
    // ============================================
    // PLAYBACK & CONTINUOUS GEN CONTROLS
    // ============================================
    
    // Playback Button (Play/Pause)
    const playbackBtn = document.getElementById('aiPlaybackBtn');
    if (playbackBtn) {
        playbackBtn.addEventListener('click', togglePlayback);
    }
    
    // Previous Button
    const prevBtn = document.getElementById('aiPrevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', prevBufferImage);
    }
    
    // Next Button
    const nextBtn = document.getElementById('aiNextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextBufferImage);
    }
    
    // Clear Buffer Button
    const clearBufferBtn = document.getElementById('aiClearBufferBtn');
    if (clearBufferBtn) {
        clearBufferBtn.addEventListener('click', clearBuffer);
    }
    
    // Playback Speed Slider
    const playbackSpeedSlider = document.getElementById('aiPlaybackSpeed');
    const playbackSpeedValue = document.getElementById('aiPlaybackSpeedValue');
    if (playbackSpeedSlider) {
        playbackSpeedSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setPlaybackSpeed(ms);
            if (playbackSpeedValue) {
                playbackSpeedValue.textContent = (ms / 1000).toFixed(1) + 's';
            }
        });
    }
    
    // Continuous Generation Button
    const continuousGenBtn = document.getElementById('aiContinuousGenBtn');
    if (continuousGenBtn) {
        continuousGenBtn.addEventListener('click', () => {
            if (aiState.continuousGen) {
                stopContinuousGeneration();
            } else {
                const prompt = promptInputEl?.value.trim() || aiState.currentPrompt;
                if (prompt) {
                    startContinuousGeneration(prompt);
                } else {
                    console.warn('No prompt for continuous generation');
                    alert('Bitte gib zuerst einen Prompt ein!');
                }
            }
        });
    }
    
    // Buffer Loop initial state
    const bufferLoopInit = document.getElementById('aiBufferLoop');
    if (bufferLoopInit) {
        aiState.bufferLoop = bufferLoopInit.checked;
    }
    
    // ============================================
    // AI VISIBILITY BUTTON
    // ============================================
    
    const aiVisibilityBtn = document.getElementById('aiVisibilityBtn');
    if (aiVisibilityBtn) {
        aiVisibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isEnabled = aiVisibilityBtn.classList.toggle('active');
            setAiEnabled(isEnabled);
        });
    }
    
    // ============================================
    // BPM SYNC CONTROLS
    // ============================================
    
    const bpmSyncCheckbox = document.getElementById('aiBpmSync');
    const bpmSyncOptions = document.getElementById('aiBpmSyncOptions');
    const speedControl = document.getElementById('aiSpeedControl');
    
    if (bpmSyncCheckbox) {
        bpmSyncCheckbox.addEventListener('change', (e) => {
            aiState.bpmSyncEnabled = e.target.checked;
            
            // Show/hide BPM options
            if (bpmSyncOptions) {
                bpmSyncOptions.style.display = e.target.checked ? 'block' : 'none';
            }
            
            // Disable manual speed when BPM sync is on
            if (speedControl) {
                speedControl.style.opacity = e.target.checked ? '0.5' : '1';
                const slider = speedControl.querySelector('input');
                if (slider) slider.disabled = e.target.checked;
            }
            
            // Stop regular timer wenn BPM sync an
            if (e.target.checked && playbackTimer) {
                clearInterval(playbackTimer);
                playbackTimer = null;
            }
            
            console.log('BPM Sync:', e.target.checked ? 'enabled' : 'disabled');
        });
    }
    
    // BPM Beat Buttons (1, 2, 4, 8, 16)
    document.querySelectorAll('.ai-bpm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-bpm-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            aiState.bpmSyncBeats = parseInt(btn.dataset.beats);
            aiState.beatCounter = 0; // Reset counter
            console.log('BPM Sync Beats:', aiState.bpmSyncBeats);
        });
    });
    
    // ============================================
    // STREAM MODE CONTROLS
    // ============================================
    
    const streamModeBtn = document.getElementById('aiStreamModeBtn');
    if (streamModeBtn) {
        streamModeBtn.addEventListener('click', toggleStreamMode);
    }
    
    const streamPauseSlider = document.getElementById('aiStreamPause');
    const streamPauseValue = document.getElementById('aiStreamPauseValue');
    if (streamPauseSlider) {
        streamPauseSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setStreamPause(ms);
            if (streamPauseValue) {
                if (ms === 0) {
                    streamPauseValue.textContent = '0ms (max speed)';
                } else if (ms >= 1000) {
                    streamPauseValue.textContent = (ms / 1000).toFixed(1) + 's';
                } else {
                    streamPauseValue.textContent = ms + 'ms';
                }
            }
        });
    }
    
    // Save Images Checkbox
    const saveImagesCheckbox = document.getElementById('aiSaveImages');
    if (saveImagesCheckbox) {
        saveImagesCheckbox.addEventListener('change', (e) => {
            aiState.saveImages = e.target.checked;
            console.log('Save images:', e.target.checked ? 'ON (permanent)' : 'OFF (temp only)');
        });
    }
    
    // ============================================
    // PROMPT MODIFIER CONTROLS
    // ============================================
    
    const modifierCinematic = document.getElementById('modifierCinematic');
    const modifierAnatomy = document.getElementById('modifierAnatomy');
    const modifierHighDetail = document.getElementById('modifierHighDetail');
    const modifierArtistic = document.getElementById('modifierArtistic');
    
    if (modifierCinematic) {
        modifierCinematic.addEventListener('change', (e) => {
            aiState.promptModifiers.cinematic = e.target.checked;
            console.log('Cinematic modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierAnatomy) {
        modifierAnatomy.addEventListener('change', (e) => {
            aiState.promptModifiers.anatomy = e.target.checked;
            console.log('Anatomy modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierHighDetail) {
        modifierHighDetail.addEventListener('change', (e) => {
            aiState.promptModifiers.highDetail = e.target.checked;
            console.log('High Detail modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (modifierArtistic) {
        modifierArtistic.addEventListener('change', (e) => {
            aiState.promptModifiers.artistic = e.target.checked;
            console.log('Artistic modifier:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    // ============================================
    // UPSCALE CONTROLS
    // ============================================
    
    const upscaleCheckbox = document.getElementById('aiUpscaleEnabled');
    const upscaleSettings = document.getElementById('aiUpscaleSettings');
    const generateResSelect = document.getElementById('aiGenerateResolution');
    const upscaleMethodSelect = document.getElementById('aiUpscaleMethod');
    const upscaleInfo = document.getElementById('aiUpscaleInfo');
    
    function updateUpscaleInfo() {
        if (!upscaleInfo) return;
        const genRes = aiState.generateResolution.split('x');
        const outRes = aiState.resolution.split('x');
        const genPixels = parseInt(genRes[0]) * parseInt(genRes[1]);
        const outPixels = parseInt(outRes[0]) * parseInt(outRes[1]);
        const speedup = (outPixels / genPixels).toFixed(1);
        upscaleInfo.textContent = `${aiState.generateResolution.replace('x', '×')} → ${aiState.resolution.replace('x', '×')} (~${speedup}x faster)`;
    }
    
    if (upscaleCheckbox) {
        upscaleCheckbox.addEventListener('change', (e) => {
            aiState.upscaleEnabled = e.target.checked;
            if (upscaleSettings) {
                upscaleSettings.style.display = e.target.checked ? 'block' : 'none';
            }
            console.log('Upscale:', e.target.checked ? 'ON' : 'OFF');
            updateUpscaleInfo();
        });
    }
    
    if (generateResSelect) {
        generateResSelect.addEventListener('change', (e) => {
            aiState.generateResolution = e.target.value;
            console.log('Generate resolution:', e.target.value);
            updateUpscaleInfo();
        });
    }
    
    if (upscaleMethodSelect) {
        upscaleMethodSelect.addEventListener('change', (e) => {
            aiState.upscaleMethod = e.target.value;
            console.log('Upscale method:', e.target.value);
        });
    }
    
    // Update upscale info when output resolution changes
    if (resolutionSelect) {
        const originalHandler = resolutionSelect.onchange;
        resolutionSelect.addEventListener('change', updateUpscaleInfo);
    }
    
    // ============================================
    // ADVANCED SETTINGS CONTROLS
    // ============================================
    
    const stepsSlider = document.getElementById('aiSteps');
    const stepsValue = document.getElementById('aiStepsValue');
    const cfgSlider = document.getElementById('aiCfg');
    const cfgValue = document.getElementById('aiCfgValue');
    const samplerSelect = document.getElementById('aiSampler');
    const presetStatus = document.getElementById('presetStatus');
    
    function updateSettingsUI() {
        if (stepsSlider) stepsSlider.value = aiState.steps;
        if (stepsValue) stepsValue.textContent = aiState.steps;
        if (cfgSlider) cfgSlider.value = aiState.cfg;
        if (cfgValue) cfgValue.textContent = aiState.cfg;
        if (samplerSelect) samplerSelect.value = aiState.sampler;
        if (upscaleCheckbox) upscaleCheckbox.checked = aiState.upscaleEnabled;
        if (upscaleSettings) upscaleSettings.style.display = aiState.upscaleEnabled ? 'block' : 'none';
        if (generateResSelect) generateResSelect.value = aiState.generateResolution;
        if (upscaleMethodSelect) upscaleMethodSelect.value = aiState.upscaleMethod;
        if (saveImagesCheckbox) saveImagesCheckbox.checked = aiState.saveImages;
        // Resolution Dropdown aktualisieren
        if (resolutionSelect) resolutionSelect.value = aiState.resolution;
        updateUpscaleInfo();
        updateResolutionDisplay();
    }
    
    if (stepsSlider) {
        stepsSlider.addEventListener('input', (e) => {
            aiState.steps = parseInt(e.target.value);
            if (stepsValue) stepsValue.textContent = aiState.steps;
        });
    }
    
    if (cfgSlider) {
        cfgSlider.addEventListener('input', (e) => {
            aiState.cfg = parseFloat(e.target.value);
            if (cfgValue) cfgValue.textContent = aiState.cfg;
        });
    }
    
    if (samplerSelect) {
        samplerSelect.addEventListener('change', (e) => {
            aiState.sampler = e.target.value;
            console.log('Sampler:', aiState.sampler);
        });
    }
    
    // ============================================
    // SPEED PRESETS
    // ============================================
    
    // Aktualisiert visuelle Hervorhebung der Preset-Buttons
    function updatePresetButtons(activePresetId) {
        const presetBtns = ['presetMaxFps', 'presetFast', 'presetBalanced', 'presetQuality'];
        presetBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (id === activePresetId) {
                    btn.classList.add('active');
                    btn.style.boxShadow = '0 0 8px #4af';
                    btn.style.borderColor = '#4af';
                } else {
                    btn.classList.remove('active');
                    btn.style.boxShadow = '';
                    btn.style.borderColor = '';
                }
            }
        });
    }
    
    function applyPreset(name, settings, presetId) {
        Object.assign(aiState, settings);
        updateSettingsUI();
        updatePresetButtons(presetId);
        if (presetStatus) {
            // Zeige die tatsächliche Generierungs-Resolution
            const genRes = settings.upscaleEnabled ? settings.generateResolution : (settings.resolution || aiState.resolution);
            presetStatus.textContent = `✅ ${name}: ${settings.steps} steps, ${genRes}`;
            presetStatus.style.color = '#4a4';
        }
        console.log(`Preset '${name}' applied:`, settings);
    }
    
    // MAX FPS - Absolute maximum speed
    const presetMaxFps = document.getElementById('presetMaxFps');
    if (presetMaxFps) {
        presetMaxFps.addEventListener('click', () => {
            applyPreset('🚀 MAX FPS', {
                steps: 1,
                cfg: 1,
                sampler: 'euler',
                upscaleEnabled: true,
                generateResolution: '512x288',
                upscaleMethod: 'nearest-exact',
                saveImages: false
            }, 'presetMaxFps');
        });
    }
    
    // Fast - Good speed, decent quality
    const presetFast = document.getElementById('presetFast');
    if (presetFast) {
        presetFast.addEventListener('click', () => {
            applyPreset('Fast', {
                steps: 4,
                cfg: 1,
                sampler: 'euler',
                upscaleEnabled: true,
                generateResolution: '768x432',
                upscaleMethod: 'bilinear',
                saveImages: false
            }, 'presetFast');
        });
    }
    
    // Balanced - Balance of speed and quality
    const presetBalanced = document.getElementById('presetBalanced');
    if (presetBalanced) {
        presetBalanced.addEventListener('click', () => {
            applyPreset('Balanced', {
                steps: 4,
                cfg: 1,
                sampler: 'euler_ancestral',
                upscaleEnabled: true,
                generateResolution: '896x512',
                upscaleMethod: 'lanczos',
                saveImages: true
            }, 'presetBalanced');
        });
    }
    
    // Quality - Best quality, slower (generates natively at 1280x720)
    const presetQuality = document.getElementById('presetQuality');
    if (presetQuality) {
        presetQuality.addEventListener('click', () => {
            applyPreset('Quality', {
                steps: 8,
                cfg: 2,
                sampler: 'euler_ancestral',
                upscaleEnabled: false,
                resolution: '1280x720',
                saveImages: true
            }, 'presetQuality');
        });
    }
    
    // ============================================
    // POST-UPSCALE CONTROLS (Client-Side)
    // ============================================
    
    const postUpscaleCheckbox = document.getElementById('aiPostUpscaleEnabled');
    const postUpscaleSettings = document.getElementById('aiPostUpscaleSettings');
    const postUpscaleTargetSelect = document.getElementById('aiPostUpscaleTarget');
    const postUpscaleMethodSelect = document.getElementById('aiPostUpscaleMethod');
    const postUpscaleSharpenSlider = document.getElementById('aiPostUpscaleSharpen');
    const postUpscaleSharpenValue = document.getElementById('aiPostUpscaleSharpenValue');
    const upscaleCurrentBtn = document.getElementById('aiUpscaleCurrentBtn');
    const upscaleBufferBtn = document.getElementById('aiUpscaleBufferBtn');
    
    if (postUpscaleCheckbox) {
        postUpscaleCheckbox.addEventListener('change', (e) => {
            aiState.postUpscaleEnabled = e.target.checked;
            if (postUpscaleSettings) {
                postUpscaleSettings.style.display = e.target.checked ? 'block' : 'none';
            }
            console.log('Post-Upscale:', e.target.checked ? 'ON' : 'OFF');
        });
    }
    
    if (postUpscaleTargetSelect) {
        postUpscaleTargetSelect.addEventListener('change', (e) => {
            aiState.postUpscaleTarget = e.target.value;
            console.log('Post-Upscale target:', e.target.value);
        });
    }
    
    if (postUpscaleMethodSelect) {
        postUpscaleMethodSelect.addEventListener('change', (e) => {
            aiState.postUpscaleMethod = e.target.value;
            console.log('Post-Upscale method:', e.target.value);
        });
    }
    
    if (postUpscaleSharpenSlider) {
        postUpscaleSharpenSlider.addEventListener('input', (e) => {
            aiState.postUpscaleSharpen = parseInt(e.target.value);
            if (postUpscaleSharpenValue) {
                postUpscaleSharpenValue.textContent = e.target.value + '%';
            }
        });
    }
    
    if (upscaleCurrentBtn) {
        upscaleCurrentBtn.addEventListener('click', () => {
            upscaleCurrentImage();
        });
    }
    
    if (upscaleBufferBtn) {
        upscaleBufferBtn.addEventListener('click', () => {
            upscaleBuffer();
        });
    }
    
    // Initial connection check
    setTimeout(checkComfyConnection, 1000);
    
    // Initial resolution display
    updateResolutionDisplay();
    
    // ============================================
    // PROMPT DEBUG CONTROLS
    // ============================================
    
    const debugCopyBtn = document.getElementById('aiDebugCopyPrompt');
    const debugRefreshBtn = document.getElementById('aiDebugRefresh');
    
    if (debugCopyBtn) {
        debugCopyBtn.addEventListener('click', async () => {
            const finalPrompt = document.getElementById('aiDebugFinalPrompt')?.textContent || '';
            if (finalPrompt && finalPrompt !== '-') {
                try {
                    await navigator.clipboard.writeText(finalPrompt);
                    debugCopyBtn.textContent = '✅ Copied!';
                    debugCopyBtn.style.background = '#2a5';
                    setTimeout(() => {
                        debugCopyBtn.textContent = '📋 Copy Final Prompt';
                        debugCopyBtn.style.background = '';
                    }, 1500);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
            }
        });
    }
    
    if (debugRefreshBtn) {
        debugRefreshBtn.addEventListener('click', () => {
            refreshPromptDebug();
            debugRefreshBtn.textContent = '✅ Updated!';
            debugRefreshBtn.style.background = '#2a5';
            setTimeout(() => {
                debugRefreshBtn.textContent = '🔄 Refresh';
                debugRefreshBtn.style.background = '';
            }, 1000);
        });
    }
    
    // Auto-update debug on prompt input change
    if (promptInputEl) {
        promptInputEl.addEventListener('input', () => {
            // Debounced refresh
            clearTimeout(window._promptDebugTimer);
            window._promptDebugTimer = setTimeout(refreshPromptDebug, 300);
        });
    }
    
    // Auto-update debug on modifier changes
    [modifierCinematic, modifierAnatomy, modifierHighDetail, modifierArtistic].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                setTimeout(refreshPromptDebug, 100);
            });
        }
    });
    
    // ============================================
    // SPEECH BUFFER TIMEOUT SLIDER
    // ============================================
    
    const speechBufferTimeoutSlider = document.getElementById('speechBufferTimeout');
    const speechBufferTimeoutValue = document.getElementById('speechBufferTimeoutValue');
    
    if (speechBufferTimeoutSlider) {
        speechBufferTimeoutSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            setSpeechBufferTimeout(ms);
            if (speechBufferTimeoutValue) {
                speechBufferTimeoutValue.textContent = (ms / 1000).toFixed(1) + 's';
            }
        });
    }
    
    console.log('AI Image UI initialized');
}

// ============================================
// BPM SYNC FUNCTIONS
// ============================================

/**
 * Wird bei jedem erkannten Beat aufgerufen (von beat-detector.js)
 * @param {number} bpm - Aktuelle BPM
 */
export function onBeat(bpm) {
    if (!aiState.enabled || !aiState.bpmSyncEnabled || !aiState.playbackActive) {
        return;
    }
    
    if (aiState.bufferImages.length === 0) {
        return;
    }
    
    // Beat counter erhöhen
    aiState.beatCounter++;
    
    // BPM Status aktualisieren
    const statusEl = document.getElementById('aiBpmStatus');
    if (statusEl) {
        statusEl.textContent = `${Math.round(bpm)} BPM | Beat ${aiState.beatCounter}/${aiState.bpmSyncBeats}`;
        statusEl.style.color = '#4f4';
    }
    
    // Bildwechsel wenn genug Beats
    if (aiState.beatCounter >= aiState.bpmSyncBeats) {
        aiState.beatCounter = 0;
        nextBufferImage();
    }
}

/**
 * Aktualisiert BPM Status (aufgerufen wenn BPM sich ändert)
 */
export function updateBpmDisplay(bpm) {
    if (!aiState.bpmSyncEnabled) return;
    
    const statusEl = document.getElementById('aiBpmStatus');
    if (statusEl && bpm > 0) {
        statusEl.textContent = `${Math.round(bpm)} BPM`;
        statusEl.style.color = '#888';
    }
}

// ============================================
// AI ENABLE/DISABLE
// ============================================

/**
 * Aktiviert/Deaktiviert AI komplett
 */
export function setAiEnabled(enabled) {
    aiState.enabled = enabled;
    
    if (!enabled) {
        // Alles stoppen
        stopPlayback();
        stopContinuousGeneration();
        stopStreamMode();
        
        // Overlay verstecken
        aiState.overlayOpacity = 0;
        if (overlayCanvas) {
            overlayCanvas.style.display = 'none';
        }
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
        
        // Slider zurücksetzen
        const opacitySlider = document.getElementById('aiOverlayOpacity');
        const opacityValue = document.getElementById('aiOverlayOpacityValue');
        if (opacitySlider) opacitySlider.value = 0;
        if (opacityValue) opacityValue.textContent = '0%';
    }
    
    console.log('AI:', enabled ? 'enabled' : 'disabled');
}

// ============================================
// GETTERS
// ============================================

export function isConnected() {
    return aiState.connected;
}

export function isGenerating() {
    return aiState.generating;
}

export function getCurrentImage() {
    return aiState.currentImage;
}

export function getOverlayOpacity() {
    return aiState.overlayOpacity;
}

export function getResolution() {
    return aiState.resolution;
}

export function isEnabled() {
    return aiState.enabled;
}

export function isBpmSyncEnabled() {
    return aiState.bpmSyncEnabled;
}
