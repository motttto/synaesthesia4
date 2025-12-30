/**
 * AI IMAGE GENERATION
 * 
 * Verbindet mit ComfyUI für lokale Stable Diffusion Bildgenerierung
 * - Display Modes: Off, On, Overlay
 * - Provider: Local (ComfyUI), Mix
 * - Models: SD 1.5, SDXL, Turbo
 * - Auto-Generation basierend auf Speech/Prompts
 * - Buffer Mode für smoothe Übergänge
 */

// ============================================
// STATE
// ============================================

export const aiState = {
    // Display
    displayMode: 'off', // 'off', 'on', 'overlay'
    
    // Provider & Model
    provider: 'local',  // 'local', 'mix'
    model: 'local-sd15', // 'local-sd15', 'local-sdxl', 'local-turbo'
    
    // Resolution
    resolution: '1:1', // 'fit', '16:9', '4:3', '3:2', '1:1', '9:16', '3:4'
    
    // ComfyUI Connection
    comfyUrl: 'http://localhost:8188',
    connected: false,
    generating: false,
    
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
    
    // Prompt
    currentPrompt: '',
    lastGeneratedPrompt: '',
    
    // Images
    currentImage: null,
    bufferImage: null,
    
    // Filter (synced with speech.js)
    filterNouns: true,
    filterVerbs: false,
    filterAdj: false
};

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

// ============================================
// COMFYUI CONNECTION
// ============================================

/**
 * Prüft Verbindung zu ComfyUI
 */
export async function checkComfyConnection() {
    if (statusEl) {
        statusEl.textContent = '🔄 Connecting...';
        statusEl.style.color = '#ff0';
    }
    
    try {
        const response = await fetch(`${aiState.comfyUrl}/system_stats`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
            aiState.connected = true;
            if (statusEl) {
                statusEl.textContent = '✅ ComfyUI connected';
                statusEl.style.color = '#4f4';
            }
            return true;
        }
    } catch (e) {
        // Connection failed
    }
    
    aiState.connected = false;
    if (statusEl) {
        statusEl.textContent = '❌ ComfyUI not running';
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
            throw new Error('Failed to queue prompt');
        }
        
        const queueData = await queueResponse.json();
        const promptId = queueData.prompt_id;
        
        // Poll for completion
        const imageUrl = await pollForCompletion(promptId);
        
        if (imageUrl) {
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
    // Einfacher txt2img Workflow
    // TODO: Model-spezifische Workflows
    
    const steps = model === 'local-turbo' ? 4 : (model === 'local-sdxl' ? 25 : 20);
    const cfg = model === 'local-turbo' ? 1 : 7;
    const sampler = model === 'local-turbo' ? 'euler_ancestral' : 'dpmpp_2m';
    const scheduler = model === 'local-turbo' ? 'normal' : 'karras';
    
    return {
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
                "width": getImageDimensions(aiState.resolution, model).width,
                "height": getImageDimensions(aiState.resolution, model).height,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["4", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "ugly, blurry, bad quality, distorted",
                "clip": ["4", 1]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "synaesthesie",
                "images": ["8", 0]
            }
        }
    };
}

/**
 * Berechnet Bilddimensionen basierend auf Resolution und Model
 */
function getImageDimensions(resolution, model) {
    // Basis-Größe abhängig vom Model
    const isXL = model === 'local-sdxl';
    const base = isXL ? 1024 : 512;
    const baseSmall = isXL ? 768 : 384;
    const baseLarge = isXL ? 1280 : 640;
    
    // Aspekt-Ratio Mappings
    const ratios = {
        '1:1': { width: base, height: base },
        '16:9': { width: baseLarge, height: Math.round(baseLarge * 9 / 16) },
        '4:3': { width: base, height: Math.round(base * 3 / 4) },
        '3:2': { width: baseLarge, height: Math.round(baseLarge * 2 / 3) },
        '9:16': { width: Math.round(baseLarge * 9 / 16), height: baseLarge },
        '3:4': { width: Math.round(base * 3 / 4), height: base },
        '2:3': { width: Math.round(baseLarge * 2 / 3), height: baseLarge },
        '21:9': { width: baseLarge, height: Math.round(baseLarge * 9 / 21) }
    };
    
    // Fit Screen: berechne aus aktueller Fenstergröße
    if (resolution === 'fit') {
        const screenRatio = window.innerWidth / window.innerHeight;
        let width, height;
        
        if (screenRatio >= 1) {
            // Landscape
            width = base;
            height = Math.round(base / screenRatio);
        } else {
            // Portrait
            height = base;
            width = Math.round(base * screenRatio);
        }
        
        // Auf 64er-Grid runden (wichtig für SD)
        width = Math.round(width / 64) * 64;
        height = Math.round(height / 64) * 64;
        
        return { width: Math.max(256, width), height: Math.max(256, height) };
    }
    
    const dims = ratios[resolution] || ratios['1:1'];
    
    // Auf 64er-Grid runden
    return {
        width: Math.round(dims.width / 64) * 64,
        height: Math.round(dims.height / 64) * 64
    };
}

/**
 * Gibt Checkpoint-Name basierend auf Model zurück
 */
function getCheckpointName(model) {
    switch(model) {
        case 'local-sdxl': return 'sd_xl_base_1.0.safetensors';
        case 'local-turbo': return 'sd_turbo.safetensors';
        case 'local-sd15': 
        default: return 'v1-5-pruned-emaonly.safetensors';
    }
}

/**
 * Pollt ComfyUI für Completion
 */
async function pollForCompletion(promptId, maxAttempts = 60) {
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
                        return `${aiState.comfyUrl}/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=${image.type || 'output'}`;
                    }
                }
            }
        } catch (e) {
            // Continue polling
        }
        
        // Update buffer status
        if (bufferStatusEl) {
            bufferStatusEl.textContent = `Generating... ${Math.round((i / maxAttempts) * 100)}%`;
        }
    }
    
    return null;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Zeigt Bild im Preview und/oder Overlay an
 */
function displayImage(imageUrl) {
    // Preview
    if (previewEl) {
        previewEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        previewEl.appendChild(img);
    }
    
    // Overlay Canvas (wenn mode = 'overlay')
    if (aiState.displayMode === 'overlay' && overlayCanvas && overlayCtx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (aiState.crossfadeEnabled && aiState.bufferImage) {
                crossfadeToImage(img);
            } else {
                drawImageToOverlay(img);
            }
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
    
    overlayCtx.globalAlpha = 0.7; // Semi-transparent overlay
    overlayCtx.drawImage(img, x, y, w, h);
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
        displayEl.textContent = `${dims.width}×${dims.height}px`;
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
 * Aktualisiert Overlay-Sichtbarkeit
 */
function updateOverlayVisibility() {
    if (!overlayCanvas) return;
    
    if (aiState.displayMode === 'overlay') {
        overlayCanvas.style.display = 'block';
        overlayCanvas.style.pointerEvents = 'none';
    } else {
        overlayCanvas.style.display = 'none';
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    }
}

// ============================================
// AUTO-GENERATION
// ============================================

/**
 * Aktualisiert Prompt von Speech Input
 */
export function updateFromSpeech(rawText, filteredText) {
    const textToUse = filteredText || rawText;
    
    aiState.currentPrompt = textToUse;
    
    if (currentInputEl) {
        currentInputEl.textContent = '🎤 ' + (textToUse || '-');
    }
    
    if (promptInputEl && textToUse) {
        promptInputEl.value = textToUse;
    }
    
    // Auto-Generate Timer reset
    if (aiState.autoGenerate && textToUse && textToUse.length > 3) {
        clearTimeout(autoGenTimer);
        autoGenTimer = setTimeout(() => {
            if (aiState.autoGenerate && aiState.connected && !aiState.generating) {
                generateImage(textToUse);
            }
        }, AUTO_GEN_DELAY);
    }
}

// ============================================
// SETTERS
// ============================================

export function setDisplayMode(mode) {
    aiState.displayMode = mode;
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
    
    // Display Mode Buttons
    document.querySelectorAll('.ai-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setDisplayMode(btn.dataset.aimode);
        });
    });
    
    // Provider Tabs
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
    
    // Model Tabs
    document.querySelectorAll('.ai-model-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const group = tab.closest('.ai-model-group');
            if (group) {
                group.querySelectorAll('.ai-model-tab').forEach(t => t.classList.remove('active'));
            }
            tab.classList.add('active');
            setModel(tab.dataset.model);
            updateResolutionDisplay(); // Update da Dimensionen model-abhängig sind
        });
    });
    
    // Resolution Buttons
    document.querySelectorAll('.ai-resolution-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-resolution-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setResolution(btn.dataset.resolution);
            updateResolutionDisplay();
        });
    });
    
    // Start ComfyUI Button
    const startComfyBtn = document.getElementById('startComfyBtn');
    if (startComfyBtn) {
        startComfyBtn.addEventListener('click', async () => {
            // Terminal-Befehl zum Starten von ComfyUI
            const comfyCommand = 'cd ~/ComfyUI && python main.py';
            
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
    
    // Filter Checkboxes (sync with speech.js state)
    const nounsCheckbox = document.getElementById('aiFilterNouns');
    const verbsCheckbox = document.getElementById('aiFilterVerbs');
    const adjCheckbox = document.getElementById('aiFilterAdj');
    
    if (nounsCheckbox) {
        nounsCheckbox.addEventListener('change', (e) => {
            setFilterNouns(e.target.checked);
        });
    }
    if (verbsCheckbox) {
        verbsCheckbox.addEventListener('change', (e) => {
            setFilterVerbs(e.target.checked);
        });
    }
    if (adjCheckbox) {
        adjCheckbox.addEventListener('change', (e) => {
            setFilterAdj(e.target.checked);
        });
    }
    
    // Window resize handler for overlay
    window.addEventListener('resize', () => {
        if (overlayCanvas) {
            overlayCanvas.width = window.innerWidth;
            overlayCanvas.height = window.innerHeight;
        }
    });
    
    // Initial connection check
    setTimeout(checkComfyConnection, 1000);
    
    // Initial resolution display
    updateResolutionDisplay();
    
    console.log('AI Image UI initialized');
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

export function getDisplayMode() {
    return aiState.displayMode;
}

export function getResolution() {
    return aiState.resolution;
}
