/**
 * PARTIKEL-SYSTEM
 * 
 * GPU-basiertes Partikelsystem mit Shader-Material
 * Reagiert auf Audio und Notenfarben
 */

import { THREE, scene } from './three-setup.js';

// ============================================
// KONSTANTEN & STATE
// ============================================

const PARTICLE_COUNT = 2000;

export const particleState = {
    enabled: false,
    intensity: 0.5,
    size: 0.3
};

// Interne Variablen
let particleSystem = null;
let particlePositions = null;
let particleVelocities = null;
let particleColors = null;
let particleSizes = null;
let particleLifetimes = null;

// ============================================
// PARTIKEL-SHADER
// ============================================

const particleVertexShader = `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    uniform float pointMultiplier;
    void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pointMultiplier / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const particleFragmentShader = `
    varying vec3 vColor;
    void main() {
        // Weicher Kreis
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.3, 0.5, r);
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// ============================================
// INITIALISIERUNG
// ============================================

/**
 * Setzt ein einzelnes Partikel auf Startposition zurück
 */
function resetParticle(i) {
    const i3 = i * 3;
    
    // Zufällige Position um das Zentrum (Kugelverteilung)
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 1 + Math.random() * 2;
    
    particlePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    particlePositions[i3 + 2] = radius * Math.cos(phi);
    
    // Geschwindigkeit nach außen
    const speed = 0.02 + Math.random() * 0.03;
    particleVelocities[i3] = particlePositions[i3] * speed;
    particleVelocities[i3 + 1] = particlePositions[i3 + 1] * speed;
    particleVelocities[i3 + 2] = particlePositions[i3 + 2] * speed;
    
    // Standard-Farbe (weiß, wird von Notenfarbe überschrieben)
    particleColors[i3] = 1;
    particleColors[i3 + 1] = 1;
    particleColors[i3 + 2] = 1;
    
    // Größe und Lifetime
    particleSizes[i] = 0.02 + Math.random() * 0.05;
    particleLifetimes[i] = Math.random(); // 0-1 Lifecycle
}

/**
 * Initialisiert das Partikel-System
 */
export function initParticleSystem() {
    const geometry = new THREE.BufferGeometry();
    
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    particleColors = new Float32Array(PARTICLE_COUNT * 3);
    particleSizes = new Float32Array(PARTICLE_COUNT);
    particleLifetimes = new Float32Array(PARTICLE_COUNT);
    
    // Initialisiere alle Partikel
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        resetParticle(i);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Shader-Material für Partikel
    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointMultiplier: { value: window.innerHeight / 2 }
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    particleSystem = new THREE.Points(geometry, material);
    particleSystem.visible = false;
    scene.add(particleSystem);
    
    return particleSystem;
}

// ============================================
// UPDATE & CONTROL
// ============================================

/**
 * Aktualisiert alle Partikel
 * @param {number} deltaTime - Zeit seit letztem Frame
 * @param {number} audioLevel - Audio-Pegel 0-1
 */
export function updateParticles(deltaTime, audioLevel) {
    if (!particleSystem || !particleState.enabled) return;
    
    const positions = particleSystem.geometry.attributes.position.array;
    const sizes = particleSystem.geometry.attributes.size.array;
    
    // Wie viele Partikel aktiv sind (basierend auf Intensität)
    const activeCount = Math.floor(PARTICLE_COUNT * particleState.intensity);
    
    // Audio-Boost
    const audioBoost = 1 + audioLevel * 2;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        if (i < activeCount) {
            // Lifetime erhöhen
            particleLifetimes[i] += deltaTime * (0.3 + audioLevel * 0.5);
            
            // Wenn Lifetime abgelaufen, reset
            if (particleLifetimes[i] > 1) {
                resetParticle(i);
            }
            
            // Position updaten
            positions[i3] += particleVelocities[i3] * audioBoost;
            positions[i3 + 1] += particleVelocities[i3 + 1] * audioBoost;
            positions[i3 + 2] += particleVelocities[i3 + 2] * audioBoost;
            
            // Größe basierend auf Lifecycle und Audio (fade out)
            const lifeFactor = 1 - particleLifetimes[i];
            sizes[i] = particleSizes[i] * particleState.size * 3 * lifeFactor * audioBoost;
        } else {
            // Inaktive Partikel unsichtbar machen
            sizes[i] = 0;
        }
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.size.needsUpdate = true;
}

/**
 * Setzt die Farbe aller Partikel basierend auf Notenfarbe
 * @param {number} color - Hex-Farbe (z.B. 0xff0000)
 */
export function setParticleColor(color) {
    if (!particleSystem) return;
    
    const threeColor = new THREE.Color(color);
    const colors = particleSystem.geometry.attributes.color.array;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Leichte Farbvariation für natürlicheren Look
        const variation = 0.8 + Math.random() * 0.4;
        colors[i3] = threeColor.r * variation;
        colors[i3 + 1] = threeColor.g * variation;
        colors[i3 + 2] = threeColor.b * variation;
    }
    
    particleSystem.geometry.attributes.color.needsUpdate = true;
}

/**
 * Aktiviert/Deaktiviert das Partikel-System
 */
export function setParticlesEnabled(enabled) {
    particleState.enabled = enabled;
    if (particleSystem) {
        particleSystem.visible = enabled;
    }
}

/**
 * Setzt Intensität (Anzahl aktiver Partikel)
 */
export function setParticlesIntensity(intensity) {
    particleState.intensity = intensity;
}

/**
 * Setzt Partikelgröße
 */
export function setParticlesSize(size) {
    particleState.size = size;
}

/**
 * Aktualisiert Uniforms bei Resize
 */
export function updateParticleUniforms(height) {
    if (particleSystem && particleSystem.material.uniforms) {
        particleSystem.material.uniforms.pointMultiplier.value = height / 2;
    }
}

// Getter für das Partikel-System (falls extern benötigt)
export function getParticleSystem() {
    return particleSystem;
}
