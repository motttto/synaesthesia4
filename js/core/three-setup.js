/**
 * THREE.JS CORE SETUP
 * 
 * Zentrale Initialisierung von Scene, Camera, Renderer, Lights
 * Exportiert alle Kern-Objekte für andere Module
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

// ============================================
// CANVAS & CONTEXT
// ============================================

export const canvas = document.getElementById('canvas');
export const aiOverlayCanvas = document.getElementById('aiOverlayCanvas');
export const aiOverlayCtx = aiOverlayCanvas.getContext('2d');

// Overlay Canvas Größe setzen
aiOverlayCanvas.width = window.innerWidth;
aiOverlayCanvas.height = window.innerHeight;

// ============================================
// SCENE, CAMERA, RENDERER
// ============================================

export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(
    50, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
);
camera.position.set(0, 2, 5);

export const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    preserveDrawingBuffer: true  // Wichtig für Stream/Screenshot!
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000); // Reines Schwarz RGB(0,0,0)

// WebGL Context Lost Handler
canvas.addEventListener('webglcontextlost', (event) => {
    console.error('❌ WebGL Context Lost!', event);
    event.preventDefault();
});
canvas.addEventListener('webglcontextrestored', () => {
    console.log('✅ WebGL Context Restored');
});

// ============================================
// LIGHTS
// ============================================

export const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

export const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

export const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, 3, -5);
scene.add(backLight);

// ============================================
// CONTROLS
// ============================================

export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Standard-Kameraposition
export const defaultCameraPosition = { x: 0, y: 2, z: 5 };
export const defaultCameraTarget = { x: 0, y: 0, z: 0 };
export const defaultFov = 50;

// ============================================
// EFFECT COMPOSER (Base Setup)
// ============================================

export const composer = new EffectComposer(renderer);
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// ============================================
// RESIZE HANDLER
// ============================================

export function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    composer.setSize(width, height);
    
    aiOverlayCanvas.width = width;
    aiOverlayCanvas.height = height;
}

// Auto-Resize bei Window-Änderung
window.addEventListener('resize', handleResize);

// ============================================
// CAMERA UTILITIES
// ============================================

export function resetCamera() {
    camera.position.set(defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z);
    camera.fov = defaultFov;
    camera.updateProjectionMatrix();
    controls.target.set(defaultCameraTarget.x, defaultCameraTarget.y, defaultCameraTarget.z);
    controls.update();
}

// Export THREE für Module die es brauchen
export { THREE };
