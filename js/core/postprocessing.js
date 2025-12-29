/**
 * POST-PROCESSING EFFEKTE
 * 
 * Edge Detection, Blur, Trails/Afterimage
 * Alle Shader und deren Steuerung
 */

import { THREE, composer } from './three-setup.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

// ============================================
// EDGE DETECTION SHADER (Sobel)
// ============================================

export const EdgeDetectionShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        'edgeStrength': { value: 1.0 },
        'edgeGlow': { value: 0.0 },
        'edgeColor': { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        'backgroundColor': { value: new THREE.Vector3(0.0, 0.0, 0.0) },
        'useOriginalColor': { value: true }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float edgeStrength;
        uniform float edgeGlow;
        uniform vec3 edgeColor;
        uniform vec3 backgroundColor;
        uniform bool useOriginalColor;
        
        varying vec2 vUv;
        
        void main() {
            vec2 texel = vec2(1.0 / resolution.x, 1.0 / resolution.y);
            
            // Sample 3x3 neighborhood
            vec4 n[9];
            n[0] = texture2D(tDiffuse, vUv + texel * vec2(-1, -1));
            n[1] = texture2D(tDiffuse, vUv + texel * vec2( 0, -1));
            n[2] = texture2D(tDiffuse, vUv + texel * vec2( 1, -1));
            n[3] = texture2D(tDiffuse, vUv + texel * vec2(-1,  0));
            n[4] = texture2D(tDiffuse, vUv);
            n[5] = texture2D(tDiffuse, vUv + texel * vec2( 1,  0));
            n[6] = texture2D(tDiffuse, vUv + texel * vec2(-1,  1));
            n[7] = texture2D(tDiffuse, vUv + texel * vec2( 0,  1));
            n[8] = texture2D(tDiffuse, vUv + texel * vec2( 1,  1));
            
            // Sobel operator
            vec4 sobelH = n[2] + (2.0 * n[5]) + n[8] - (n[0] + (2.0 * n[3]) + n[6]);
            vec4 sobelV = n[0] + (2.0 * n[1]) + n[2] - (n[6] + (2.0 * n[7]) + n[8]);
            
            // Edge magnitude
            vec4 sobel = sqrt(sobelH * sobelH + sobelV * sobelV);
            float edge = (sobel.r + sobel.g + sobel.b) / 3.0;
            
            // Apply strength
            edge = clamp(edge * edgeStrength * 3.0, 0.0, 1.0);
            
            // Output
            vec3 originalColor = n[4].rgb;
            vec3 lineColor = useOriginalColor ? originalColor : edgeColor;
            
            // Glow effect - add original color influence
            vec3 glowColor = originalColor * edgeGlow * edge;
            
            // Final color: edge lines + optional glow
            vec3 finalColor = mix(backgroundColor, lineColor, edge) + glowColor;
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

// Edge Pass erstellen und zum Composer hinzufügen
export const edgePass = new ShaderPass(EdgeDetectionShader);
edgePass.enabled = false;
composer.addPass(edgePass);

// Edge-Effekt State
export const edgeState = {
    enabled: false,
    strength: 1.0,
    glow: 0.3
};

export function setEdgeEffect(enabled, strength = 1.0, glow = 0.3) {
    edgeState.enabled = enabled;
    edgeState.strength = strength;
    edgeState.glow = glow;
    
    edgePass.enabled = enabled;
    edgePass.uniforms.edgeStrength.value = strength;
    edgePass.uniforms.edgeGlow.value = glow;
}

// ============================================
// BLUR SHADER (Multi-Pass Gaussian)
// ============================================

export const BlurShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        'direction': { value: new THREE.Vector2(1.0, 0.0) },
        'radius': { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform vec2 direction;
        uniform float radius;
        
        varying vec2 vUv;
        
        void main() {
            vec2 texel = direction / resolution * radius;
            
            // 9-tap Gaussian blur (sigma ~2)
            vec4 sum = vec4(0.0);
            sum += texture2D(tDiffuse, vUv - 4.0 * texel) * 0.0162162162;
            sum += texture2D(tDiffuse, vUv - 3.0 * texel) * 0.0540540541;
            sum += texture2D(tDiffuse, vUv - 2.0 * texel) * 0.1216216216;
            sum += texture2D(tDiffuse, vUv - 1.0 * texel) * 0.1945945946;
            sum += texture2D(tDiffuse, vUv) * 0.2270270270;
            sum += texture2D(tDiffuse, vUv + 1.0 * texel) * 0.1945945946;
            sum += texture2D(tDiffuse, vUv + 2.0 * texel) * 0.1216216216;
            sum += texture2D(tDiffuse, vUv + 3.0 * texel) * 0.0540540541;
            sum += texture2D(tDiffuse, vUv + 4.0 * texel) * 0.0162162162;
            
            gl_FragColor = sum;
        }
    `
};

// Blur Passes (8 Iterationen = H+V Paare)
export const blurPasses = [];
export const MAX_BLUR_ITERATIONS = 8;

for (let i = 0; i < MAX_BLUR_ITERATIONS; i++) {
    const passH = new ShaderPass(BlurShader);
    passH.uniforms.direction.value.set(1.0, 0.0);
    passH.enabled = false;
    composer.addPass(passH);
    
    const passV = new ShaderPass(BlurShader);
    passV.uniforms.direction.value.set(0.0, 1.0);
    passV.enabled = false;
    composer.addPass(passV);
    
    blurPasses.push({ h: passH, v: passV });
}

// Blur State
export let blurAmount = 0;

/**
 * Setzt die Blur-Intensität
 * @param {number} intensity - 0-1 (0 = aus, 1 = maximal)
 */
export function setBlurIntensity(intensity) {
    blurAmount = intensity;
    
    // Anzahl aktiver Iterationen basierend auf Intensität
    const activeIterations = Math.ceil(intensity * MAX_BLUR_ITERATIONS);
    
    // Radius skalieren: 1 bei 0%, 100 bei 100%
    const radius = 1 + intensity * 99;
    
    blurPasses.forEach((pair, index) => {
        const isActive = index < activeIterations && intensity > 0;
        pair.h.enabled = isActive;
        pair.v.enabled = isActive;
        pair.h.uniforms.radius.value = radius;
        pair.v.uniforms.radius.value = radius;
    });
}

// ============================================
// TRAILS / AFTERIMAGE
// ============================================

export const afterimagePass = new AfterimagePass();
afterimagePass.uniforms['damp'].value = 0.9;
afterimagePass.enabled = false;
composer.addPass(afterimagePass);

// Trails State
export const trailsState = {
    enabled: false,
    intensity: 0.7
};

/**
 * Setzt die Trail/Afterimage Intensität
 * @param {number} intensity - 0-1
 */
export function setTrailsIntensity(intensity) {
    trailsState.intensity = intensity;
    // damp: 0.8 (wenig Trail) bis 0.97 (starker Trail)
    afterimagePass.uniforms['damp'].value = 0.8 + intensity * 0.17;
}

export function setTrailsEnabled(enabled) {
    trailsState.enabled = enabled;
    afterimagePass.enabled = enabled;
}

// ============================================
// UPDATE RESOLUTION (bei Resize)
// ============================================

export function updatePostProcessingResolution(width, height) {
    edgePass.uniforms.resolution.value.set(width, height);
    blurPasses.forEach(pair => {
        pair.h.uniforms.resolution.value.set(width, height);
        pair.v.uniforms.resolution.value.set(width, height);
    });
}
