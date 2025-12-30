/**
 * INTERVAL OVERVIEW MODAL
 * 
 * Shows all 25 intervals with synesthetic shape mapping
 * based on Clara's system:
 * - Unison: Point
 * - Second: Small/compact
 * - Third: Oval
 * - Larger intervals: Lines
 * 
 * Features:
 * - Set selection (set_01, set_02, etc.)
 * - 3D model preview in modal
 * - Static 3D thumbnails for each interval card (single renderer)
 */

import { THREE } from '../core/three-setup.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { modelState, loadSetModels, detectModelSets, loadModel } from '../models/model-manager.js';

// Interval definitions with synesthetic shapes (English)
export const intervalData = [
    { id: 0,  name: 'Unison',              semitones: 0,  shape: 'Point',   file: '00_prime.glb' },
    { id: 1,  name: 'Minor 2nd',           semitones: 1,  shape: 'Small',   file: '01_sekunde_klein.glb' },
    { id: 2,  name: 'Major 2nd',           semitones: 2,  shape: 'Small',   file: '02_sekunde_gross.glb' },
    { id: 3,  name: 'Minor 3rd',           semitones: 3,  shape: 'Oval',    file: '03_terz_klein.glb' },
    { id: 4,  name: 'Major 3rd',           semitones: 4,  shape: 'Oval',    file: '04_terz_gross.glb' },
    { id: 5,  name: 'Perfect 4th',         semitones: 5,  shape: 'Line',    file: '05_quarte.glb' },
    { id: 6,  name: 'Tritone',             semitones: 6,  shape: 'Line',    file: '06_tritonus.glb' },
    { id: 7,  name: 'Perfect 5th',         semitones: 7,  shape: 'Line',    file: '07_quinte.glb' },
    { id: 8,  name: 'Minor 6th',           semitones: 8,  shape: 'Line',    file: '08_sexte_klein.glb' },
    { id: 9,  name: 'Major 6th',           semitones: 9,  shape: 'Line',    file: '09_sexte_gross.glb' },
    { id: 10, name: 'Minor 7th',           semitones: 10, shape: 'Line',    file: '10_septime_klein.glb' },
    { id: 11, name: 'Major 7th',           semitones: 11, shape: 'Line',    file: '11_septime_gross.glb' },
    { id: 12, name: 'Octave',              semitones: 12, shape: 'Frame',   file: '12_oktave.glb' },
    { id: 13, name: 'Minor 9th',           semitones: 13, shape: 'Line+',   file: '13_none_klein.glb' },
    { id: 14, name: 'Major 9th',           semitones: 14, shape: 'Line+',   file: '14_none_gross.glb' },
    { id: 15, name: 'Minor 10th',          semitones: 15, shape: 'Oval+',   file: '15_dezime_klein.glb' },
    { id: 16, name: 'Major 10th',          semitones: 16, shape: 'Oval+',   file: '16_dezime_gross.glb' },
    { id: 17, name: 'Perfect 11th',        semitones: 17, shape: 'Line+',   file: '17_undezime.glb' },
    { id: 18, name: 'Aug. 11th',           semitones: 18, shape: 'Line+',   file: '18_undezime_ueberm.glb' },
    { id: 19, name: 'Perfect 12th',        semitones: 19, shape: 'Line+',   file: '19_duodezime.glb' },
    { id: 20, name: 'Minor 13th',          semitones: 20, shape: 'Line+',   file: '20_tredezime_klein.glb' },
    { id: 21, name: 'Major 13th',          semitones: 21, shape: 'Line+',   file: '21_tredezime_gross.glb' },
    { id: 22, name: 'Minor 14th',          semitones: 22, shape: 'Line+',   file: '22_quartdezime_klein.glb' },
    { id: 23, name: 'Major 14th',          semitones: 23, shape: 'Line+',   file: '23_quartdezime_gross.glb' },
    { id: 24, name: 'Double Octave',       semitones: 24, shape: 'Frame+',  file: '24_doppeloktave.glb' }
];

// ============================================
// STATE
// ============================================

let modalEl = null;
let gridEl = null;
let setSelectEl = null;
let previewContainerEl = null;
let previewTitleEl = null;
let onSelectCallback = null;

// Preview Renderer State (large preview)
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewControls = null;
let previewModel = null;
let previewAnimationId = null;

// Thumbnail Renderer (single offscreen renderer for all thumbnails)
let thumbRenderer = null;
let thumbScene = null;
let thumbCamera = null;

// Thumbnail image cache
const thumbCache = new Map(); // intervalId -> dataURL

// Current selection
let selectedInterval = null;
let currentPreviewSet = 'set_01';

// Shared loader
const sharedLoader = new GLTFLoader();

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the Interval Modal
 */
export function initIntervalModal(modelSetPath = '3d-models/set_01') {
    modalEl = document.getElementById('intervalModal');
    gridEl = document.getElementById('intervalGrid');
    setSelectEl = document.getElementById('intervalSetSelect');
    previewContainerEl = document.getElementById('intervalPreviewContainer');
    previewTitleEl = document.getElementById('intervalPreviewTitle');
    
    // Info Button Click Handler
    const infoBtn = document.getElementById('intervalInfoBtn');
    if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal();
        });
    }
    
    // Close Button
    const closeBtn = document.getElementById('intervalModalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Click outside to close
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                closeModal();
            }
        });
    }
    
    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl?.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Set Select Handler
    if (setSelectEl) {
        setSelectEl.addEventListener('change', handleSetChange);
    }
    
    // Initialize Renderers
    initPreviewRenderer();
    initThumbRenderer();
    
    console.log('Interval Modal initialized');
}

/**
 * Initialize the large 3D Preview Renderer
 */
function initPreviewRenderer() {
    if (!previewContainerEl) return;
    
    // Scene
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x1a1a2e);
    
    // Camera
    previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    previewCamera.position.set(0, 0, 3);
    
    // Renderer
    previewRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    previewRenderer.setSize(200, 200);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewContainerEl.appendChild(previewRenderer.domElement);
    
    // Controls
    previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
    previewControls.enableDamping = true;
    previewControls.dampingFactor = 0.05;
    previewControls.enableZoom = true;
    previewControls.autoRotate = true;
    previewControls.autoRotateSpeed = 2;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    previewScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    previewScene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, -5, -5);
    previewScene.add(backLight);
}

/**
 * Initialize the single offscreen thumbnail renderer
 */
function initThumbRenderer() {
    // Scene
    thumbScene = new THREE.Scene();
    thumbScene.background = new THREE.Color(0x111111);
    
    // Camera
    thumbCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    thumbCamera.position.set(0, 0, 3);
    
    // Offscreen Renderer (not attached to DOM)
    thumbRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true // Needed for toDataURL
    });
    thumbRenderer.setSize(100, 100); // Render at 2x for quality
    thumbRenderer.setPixelRatio(1);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    thumbScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(3, 3, 3);
    thumbScene.add(directionalLight);
}

/**
 * Render a thumbnail for an interval and return dataURL
 */
async function renderThumbnail(intervalId) {
    const interval = intervalData.find(i => i.id === intervalId);
    if (!interval || !thumbRenderer || !thumbScene) return null;
    
    // Clear scene (remove old models)
    const toRemove = [];
    thumbScene.traverse((child) => {
        if (child.isMesh || child.isGroup) {
            if (!child.isLight) toRemove.push(child);
        }
    });
    toRemove.forEach(obj => {
        if (obj.parent === thumbScene) thumbScene.remove(obj);
    });
    
    // Get model path
    const setPath = currentPreviewSet || 'set_01';
    let filename = interval.file;
    if (modelState.currentSetModels && modelState.currentSetModels[intervalId]) {
        filename = modelState.currentSetModels[intervalId];
    }
    
    const modelPath = `./3d-models/${setPath}/${filename}`;
    
    let model = null;
    
    try {
        const gltf = await new Promise((resolve, reject) => {
            sharedLoader.load(modelPath, resolve, undefined, reject);
        });
        
        model = gltf.scene.clone();
        
        // Material Setup - Clara's colors (red for C as default)
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color = new THREE.Color(0xff4444);
                child.material.emissive = new THREE.Color(0x661111);
            }
        });
        
    } catch (err) {
        // Create fallback geometry
        const geometry = new THREE.SphereGeometry(0.4, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0x444444,
            emissive: 0x222222
        });
        model = new THREE.Mesh(geometry, material);
    }
    
    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    
    model.position.sub(center);
    model.scale.setScalar(scale);
    
    // Add slight rotation for visual interest
    model.rotation.y = Math.PI * 0.25;
    model.rotation.x = Math.PI * 0.1;
    
    thumbScene.add(model);
    
    // Render
    thumbRenderer.render(thumbScene, thumbCamera);
    
    // Get dataURL
    const dataURL = thumbRenderer.domElement.toDataURL('image/png');
    
    // Cleanup
    thumbScene.remove(model);
    
    return dataURL;
}

/**
 * Generate all thumbnails for current set
 */
async function generateAllThumbnails() {
    thumbCache.clear();
    
    for (const interval of intervalData) {
        const dataURL = await renderThumbnail(interval.id);
        if (dataURL) {
            thumbCache.set(interval.id, dataURL);
            
            // Update the card image if it exists
            const imgEl = document.getElementById(`thumb-img-${interval.id}`);
            if (imgEl) {
                imgEl.src = dataURL;
                imgEl.style.display = 'block';
            }
        }
    }
}

/**
 * Animation Loop for preview
 */
function animatePreview() {
    if (!previewRenderer || !modalEl?.classList.contains('active')) {
        previewAnimationId = null;
        return;
    }
    
    previewAnimationId = requestAnimationFrame(animatePreview);
    
    if (previewControls) {
        previewControls.update();
    }
    
    previewRenderer.render(previewScene, previewCamera);
}

// ============================================
// SET HANDLING
// ============================================

/**
 * Populate the Set dropdown with available sets
 */
async function populateSetSelect() {
    if (!setSelectEl) return;
    
    setSelectEl.innerHTML = '';
    
    // Get available sets from Model Manager
    if (modelState.availableModelSets.length === 0) {
        await detectModelSets(false);
    }
    
    modelState.availableModelSets.forEach(setName => {
        const option = document.createElement('option');
        option.value = setName;
        option.textContent = setName.replace('set_', 'Set ').replace('_', ' ');
        setSelectEl.appendChild(option);
    });
    
    // Select current set
    if (modelState.currentModelSet) {
        setSelectEl.value = modelState.currentModelSet;
        currentPreviewSet = modelState.currentModelSet;
    } else if (modelState.availableModelSets.length > 0) {
        currentPreviewSet = modelState.availableModelSets[0];
        setSelectEl.value = currentPreviewSet;
    }
}

/**
 * Handler for Set change
 */
async function handleSetChange(e) {
    currentPreviewSet = e.target.value;
    
    // Load set models mapping
    await loadSetModels(currentPreviewSet);
    
    // Regenerate all thumbnails
    await generateAllThumbnails();
    
    // Update preview if an interval is selected
    if (selectedInterval !== null) {
        await loadPreviewModel(selectedInterval);
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open the modal and render the interval grid
 */
export async function openModal() {
    if (!modalEl || !gridEl) return;
    
    await populateSetSelect();
    renderIntervalGrid();
    modalEl.classList.add('active');
    
    // Generate thumbnails
    await generateAllThumbnails();
    
    // Start animation loop
    if (!previewAnimationId) {
        animatePreview();
    }
    
    // Select first interval if none selected
    if (selectedInterval === null) {
        selectInterval(0);
    }
}

/**
 * Close the modal
 */
export function closeModal() {
    if (modalEl) {
        modalEl.classList.remove('active');
    }
    
    // Stop animation loop
    if (previewAnimationId) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }
}

/**
 * Render the interval grid with thumbnail images
 */
function renderIntervalGrid() {
    if (!gridEl) return;
    
    gridEl.innerHTML = '';
    
    intervalData.forEach((interval) => {
        const card = document.createElement('div');
        card.className = 'interval-card';
        card.dataset.intervalId = interval.id;
        
        if (selectedInterval === interval.id) {
            card.classList.add('active');
        }
        
        // Thumbnail container with image
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'interval-preview';
        
        const thumbImg = document.createElement('img');
        thumbImg.id = `thumb-img-${interval.id}`;
        thumbImg.className = 'interval-thumb-img';
        thumbImg.alt = interval.name;
        thumbImg.style.display = 'none'; // Hidden until loaded
        
        // Show cached thumbnail if available
        if (thumbCache.has(interval.id)) {
            thumbImg.src = thumbCache.get(interval.id);
            thumbImg.style.display = 'block';
        }
        
        // Loading placeholder
        const placeholder = document.createElement('span');
        placeholder.className = 'interval-thumb-placeholder';
        placeholder.textContent = '⏳';
        
        thumbContainer.appendChild(thumbImg);
        thumbContainer.appendChild(placeholder);
        
        // Hide placeholder when image loads
        thumbImg.onload = () => {
            placeholder.style.display = 'none';
        };
        
        card.appendChild(thumbContainer);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'interval-name';
        nameDiv.textContent = interval.name;
        card.appendChild(nameDiv);
        
        const semitonesDiv = document.createElement('div');
        semitonesDiv.className = 'interval-semitones';
        semitonesDiv.textContent = `${interval.semitones} st`;
        card.appendChild(semitonesDiv);
        
        card.addEventListener('click', () => {
            selectInterval(interval.id);
        });
        
        card.addEventListener('dblclick', () => {
            loadModelToMainScene(interval.id);
        });
        
        gridEl.appendChild(card);
    });
}

/**
 * Select an interval and show preview
 */
async function selectInterval(intervalId) {
    selectedInterval = intervalId;
    const interval = intervalData.find(i => i.id === intervalId);
    
    // UI Update
    if (gridEl) {
        gridEl.querySelectorAll('.interval-card').forEach(card => {
            card.classList.toggle('active', parseInt(card.dataset.intervalId) === intervalId);
        });
    }
    
    // Title Update
    if (previewTitleEl && interval) {
        previewTitleEl.textContent = `${interval.name} (${interval.semitones} st)`;
    }
    
    // Load 3D model preview
    await loadPreviewModel(intervalId);
    
    // Callback if set
    if (onSelectCallback && interval) {
        onSelectCallback(interval);
    }
}

/**
 * Load a 3D model into the large preview
 */
async function loadPreviewModel(intervalId) {
    if (!previewScene) return;
    
    // Remove old model
    if (previewModel) {
        previewScene.remove(previewModel);
        previewModel = null;
    }
    
    const interval = intervalData.find(i => i.id === intervalId);
    if (!interval) return;
    
    // Get model path
    const setPath = currentPreviewSet || 'set_01';
    let filename = interval.file;
    if (modelState.currentSetModels && modelState.currentSetModels[intervalId]) {
        filename = modelState.currentSetModels[intervalId];
    }
    
    const modelPath = `./3d-models/${setPath}/${filename}`;
    
    try {
        const gltf = await new Promise((resolve, reject) => {
            sharedLoader.load(modelPath, resolve, undefined, reject);
        });
        
        previewModel = gltf.scene;
        
        // Material Setup - Clara's colors (red for C as default)
        previewModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color = new THREE.Color(0xff4444);
                child.material.emissive = new THREE.Color(0x661111);
            }
        });
        
        // Center and scale model
        const box = new THREE.Box3().setFromObject(previewModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        
        previewModel.position.sub(center);
        previewModel.scale.setScalar(scale);
        
        previewScene.add(previewModel);
        
        // Camera Reset
        previewCamera.position.set(0, 0, 3);
        if (previewControls) {
            previewControls.reset();
        }
        
    } catch (err) {
        console.warn(`Could not load model: ${modelPath}`, err);
        showFallbackGeometry(interval);
    }
}

/**
 * Show fallback geometry if model cannot be loaded
 */
function showFallbackGeometry(interval) {
    if (!previewScene) return;
    
    if (previewModel) {
        previewScene.remove(previewModel);
    }
    
    let geometry;
    switch(interval.shape) {
        case 'Point':
            geometry = new THREE.SphereGeometry(0.3, 32, 32);
            break;
        case 'Small':
            geometry = new THREE.BoxGeometry(0.6, 0.2, 0.2);
            break;
        case 'Oval':
        case 'Oval+':
            geometry = new THREE.SphereGeometry(0.4, 32, 16);
            break;
        case 'Frame':
        case 'Frame+':
            geometry = new THREE.TorusGeometry(0.4, 0.1, 16, 32);
            break;
        default:
            geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    }
    
    const material = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0x661111,
        roughness: 0.5,
        metalness: 0.3
    });
    
    previewModel = new THREE.Mesh(geometry, material);
    previewScene.add(previewModel);
}

/**
 * Load a model into the main scene
 */
async function loadModelToMainScene(intervalId) {
    const interval = intervalData.find(i => i.id === intervalId);
    if (!interval) return;
    
    // Switch set if needed
    if (currentPreviewSet !== modelState.currentModelSet) {
        modelState.currentModelSet = currentPreviewSet;
        await loadSetModels(currentPreviewSet);
        
        // Update Model Set dropdown in main window
        const mainSetSelect = document.getElementById('modelSetSelect');
        if (mainSetSelect) {
            mainSetSelect.value = currentPreviewSet;
        }
    }
    
    // Load model
    await loadModel(intervalId);
    
    // Close modal
    closeModal();
    
    console.log(`Model loaded: ${interval.name} from ${currentPreviewSet}`);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Set callback for interval selection
 */
export function setOnSelectCallback(callback) {
    onSelectCallback = callback;
}

/**
 * Mark a specific interval as active
 */
export function setActiveInterval(semitones) {
    const interval = intervalData.find(i => i.semitones === semitones);
    if (interval) {
        selectedInterval = interval.id;
        
        if (gridEl) {
            gridEl.querySelectorAll('.interval-card').forEach(card => {
                card.classList.toggle('active', parseInt(card.dataset.intervalId) === interval.id);
            });
        }
    }
}

/**
 * Get interval data
 */
export function getIntervalData() {
    return intervalData;
}

/**
 * Set the current model set path
 */
export function setModelSet(setName) {
    currentPreviewSet = setName;
    if (setSelectEl) {
        setSelectEl.value = setName;
    }
}
