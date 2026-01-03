/**
 * TRON GRID FLOOR
 * 
 * Klassischer 80er Synthwave/Tron Grid:
 * - Perspektivisches Grid zum Horizont
 * - Neon-Glow Linien
 * - Scroll-Animation (Grid fließt auf Betrachter zu)
 * - Audio-reaktive Helligkeit
 */

import { THREE, scene } from '../core/three-setup.js';
import { colorState } from '../config/colors.js';

// ============================================
// STATE
// ============================================

export const gridState = {
    enabled: false,
    
    // Grid Einstellungen
    gridX: 30,          // Anzahl vertikaler Linien
    gridY: 50,          // Anzahl horizontaler Linien (Tiefe)
    spacing: 1.0,       // Abstand zwischen Linien
    lineWidth: 2.0,     // Liniendicke
    
    // Position
    positionY: -5,      // Höhe des Grids
    
    // Glow
    glowEnabled: true,
    glowIntensity: 1.5,
    
    // Scroll Animation
    scrollSpeed: 2.0,   // Grid-Bewegung zum Betrachter
    scrollOffset: 0,
    
    // Audio-Reaktivität
    audioEnabled: true,
    audioIntensity: 1.0,
    audioPulse: 0,      // Bass-Puls für Glow
    
    // Frequenzbänder (für Wellen)
    lowFreq: 0,
    midFreq: 0,
    highFreq: 0,
    
    // Animation
    time: 0,
    
    // Farbe
    baseColor: new THREE.Color(0x00ffff),  // Cyan Neon
    useSchemaColor: false,
    
    // Horizon Glow
    horizonEnabled: true,
    horizonColor: new THREE.Color(0xff00ff) // Magenta
};

// Three.js Objekte
let gridMesh = null;
let gridGeometry = null;
let gridMaterial = null;
let horizonMesh = null;
let horizonMaterial = null;

// ============================================
// TRON GRID SHADER
// ============================================

const gridVertexShader = `
    uniform float lowFreq;
    uniform float midFreq;
    uniform float highFreq;
    uniform float waveHeight;
    uniform float scrollOffset;
    uniform float time;
    
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying float vWaveIntensity;
    
    void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        
        // Frequenz-basierte Wellen
        float z = worldPos.z + scrollOffset;
        float x = worldPos.x;
        
        // Verschiedene Wellen für verschiedene Frequenzbänder
        // Low = langsame breite Welle
        float lowWave = sin(z * 0.15 + time * 0.5) * lowFreq;
        
        // Mid = mittlere Welle
        float midWave = sin(z * 0.3 + x * 0.2 + time * 1.0) * midFreq;
        
        // High = schnelle schmale Welle
        float highWave = sin(z * 0.6 + x * 0.4 + time * 2.0) * highFreq;
        
        // Kombinierte Wellenhöhe
        float wave = (lowWave * 2.0 + midWave * 1.5 + highWave * 1.0) * waveHeight;
        
        // Distanz-Fade (Wellen werden zum Horizont kleiner)
        float distFade = 1.0 - smoothstep(10.0, 50.0, -worldPos.z);
        wave *= distFade;
        
        // Y-Position modulieren
        worldPos.y += wave;
        
        vWorldPos = worldPos.xyz;
        vWaveIntensity = abs(wave) / (waveHeight + 0.001);
        
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const gridFragmentShader = `
    uniform vec3 baseColor;
    uniform float glowIntensity;
    uniform float lineWidth;
    uniform float scrollOffset;
    uniform float time;
    uniform float audioPulse;
    uniform float spacing;
    uniform float lowFreq;
    uniform float midFreq;
    uniform float highFreq;
    
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying float vWaveIntensity;
    
    void main() {
        // Grid-Koordinaten
        float x = vWorldPos.x;
        float z = vWorldPos.z + scrollOffset;
        
        // Einfache Grid-Linien
        float cellSize = spacing;
        
        // Modulo für Grid-Pattern
        float gridX = abs(fract(x / cellSize + 0.5) - 0.5) * cellSize;
        float gridZ = abs(fract(z / cellSize + 0.5) - 0.5) * cellSize;
        
        // Liniendicke
        float thickness = lineWidth * 0.03;
        
        // Linien-Alpha (1 = auf Linie, 0 = daneben)
        float lineX = 1.0 - smoothstep(0.0, thickness, gridX);
        float lineZ = 1.0 - smoothstep(0.0, thickness, gridZ);
        float line = max(lineX, lineZ);
        
        // Hauptlinien alle 5 Zellen
        float majorX = abs(fract(x / (cellSize * 5.0) + 0.5) - 0.5) * cellSize * 5.0;
        float majorZ = abs(fract(z / (cellSize * 5.0) + 0.5) - 0.5) * cellSize * 5.0;
        float majorLineX = 1.0 - smoothstep(0.0, thickness * 1.5, majorX);
        float majorLineZ = 1.0 - smoothstep(0.0, thickness * 1.5, majorZ);
        float majorLine = max(majorLineX, majorLineZ);
        
        // Kombiniere
        line = max(line * 0.5, majorLine);
        
        // Distanz-Fade zum Horizont
        float dist = -vWorldPos.z;
        float horizonFade = 1.0 - smoothstep(20.0, 70.0, dist);
        
        // Seiten-Fade
        float sideFade = 1.0 - smoothstep(20.0, 30.0, abs(vWorldPos.x));
        
        // Nah-Fade
        float nearFade = smoothstep(-5.0, 5.0, dist);
        
        // Glow basierend auf Audio + Wellen-Intensität
        float audioBoost = 1.0 + audioPulse * 0.5 + vWaveIntensity * 2.0;
        float glow = line * glowIntensity * audioBoost;
        
        // Halo um Linien
        float haloX = exp(-gridX * 8.0) * 0.4;
        float haloZ = exp(-gridZ * 8.0) * 0.4;
        float halo = max(haloX, haloZ) * glowIntensity;
        
        // Farbe basierend auf Frequenzbändern mischen
        vec3 lowColor = vec3(1.0, 0.2, 0.2);   // Rot für Bass
        vec3 midColor = vec3(0.2, 1.0, 0.2);   // Grün für Mitten
        vec3 highColor = vec3(0.2, 0.2, 1.0);  // Blau für Höhen
        
        // Farbmischung basierend auf Frequenzen
        float totalFreq = lowFreq + midFreq + highFreq + 0.001;
        vec3 freqColor = (lowColor * lowFreq + midColor * midFreq + highColor * highFreq) / totalFreq;
        
        // Mit Basisfarbe mischen (mehr Frequenzfarbe bei höherer Intensität)
        float freqMix = min(1.0, totalFreq * 0.5);
        vec3 finalColor = mix(baseColor, freqColor, freqMix * 0.7);
        
        // Finale Farbe
        vec3 color = finalColor * (glow + halo);
        
        // Alpha
        float alpha = (line + halo * 0.3) * horizonFade * sideFade * nearFade;
        
        if (alpha < 0.005) discard;
        
        gl_FragColor = vec4(color, min(alpha, 1.0));
    }
`;

// Horizon Glow Shader
const horizonVertexShader = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const horizonFragmentShader = `
    uniform vec3 horizonColor;
    uniform vec3 baseColor;
    uniform float glowIntensity;
    uniform float audioPulse;
    uniform float time;
    
    varying vec2 vUv;
    
    void main() {
        // Vertikaler Gradient für Horizont-Glow
        float y = vUv.y;
        
        // Haupt-Glow am Horizont (oben)
        float horizonGlow = exp(-pow((1.0 - y) * 3.0, 2.0)) * 2.0;
        
        // Pulsierender Glow
        horizonGlow *= 1.0 + sin(time * 2.0) * 0.1 + audioPulse * 0.5;
        
        // Farb-Gradient von Cyan unten zu Magenta oben
        vec3 color = mix(baseColor, horizonColor, y * 0.7);
        color *= horizonGlow * glowIntensity;
        
        // Seiten-Fade
        float sideFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 4.0);
        
        float alpha = horizonGlow * sideFade * 0.6;
        
        if (alpha < 0.01) discard;
        
        gl_FragColor = vec4(color, alpha);
    }
`;

// ============================================
// GRID CREATION
// ============================================

function createGrid() {
    // Cleanup
    if (gridMesh) {
        scene.remove(gridMesh);
        gridGeometry?.dispose();
        gridMaterial?.dispose();
        gridMesh = null;
        gridGeometry = null;
        gridMaterial = null;
    }
    if (horizonMesh) {
        scene.remove(horizonMesh);
        horizonMaterial?.dispose();
        horizonMesh = null;
        horizonMaterial = null;
    }
    
    // Grid-Plane (horizontal, nach hinten gestreckt)
    const width = 60;  // Breite
    const depth = 80;  // Tiefe zum Horizont
    
    // VIELE Segmente für Welleneffekt!
    const segmentsX = 60;
    const segmentsZ = 80;
    
    gridGeometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    gridGeometry.rotateX(-Math.PI / 2);
    // Grid startet vor Kamera und geht nach hinten
    gridGeometry.translate(0, 0, -depth * 0.4);
    
    gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: gridState.baseColor.clone() },
            glowIntensity: { value: gridState.glowIntensity },
            lineWidth: { value: gridState.lineWidth },
            spacing: { value: gridState.spacing },
            scrollOffset: { value: 0 },
            time: { value: 0 },
            audioPulse: { value: 0 },
            waveHeight: { value: gridState.audioIntensity },
            lowFreq: { value: 0 },
            midFreq: { value: 0 },
            highFreq: { value: 0 }
        },
        vertexShader: gridVertexShader,
        fragmentShader: gridFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.position.y = gridState.positionY;
    gridMesh.renderOrder = -1;
    gridMesh.frustumCulled = false; // Verhindert dass Grid verschwindet
    
    // Horizon Glow Plane
    if (gridState.horizonEnabled) {
        const horizonGeometry = new THREE.PlaneGeometry(width * 2, 20, 1, 1);
        // Positioniere am Ende des Grids, aufrecht
        horizonGeometry.translate(0, 10, -depth * 0.9);
        
        horizonMaterial = new THREE.ShaderMaterial({
            uniforms: {
                horizonColor: { value: gridState.horizonColor.clone() },
                baseColor: { value: gridState.baseColor.clone() },
                glowIntensity: { value: gridState.glowIntensity },
                audioPulse: { value: 0 },
                time: { value: 0 }
            },
            vertexShader: horizonVertexShader,
            fragmentShader: horizonFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        horizonMesh = new THREE.Mesh(horizonGeometry, horizonMaterial);
        horizonMesh.position.y = gridState.positionY;
        horizonMesh.renderOrder = -2;
        horizonMesh.frustumCulled = false;
    }
    
    // Add to scene
    if (gridState.enabled) {
        scene.add(gridMesh);
        if (horizonMesh) scene.add(horizonMesh);
    }
    
    console.log('🌆 Tron Grid erstellt (with frequency waves)');
}

// ============================================
// UPDATE
// ============================================

export function updateGrid(deltaTime, audioData) {
    // Sicherheits-Check
    if (!gridState.enabled) return;
    
    // Defensive: deltaTime begrenzen (verhindert Sprünge nach Tab-Wechsel)
    deltaTime = Math.min(deltaTime, 0.1);
    
    try {
        // Prüfen ob Mesh existiert UND in der Szene ist
        if (!gridMesh || !gridMaterial) {
            console.warn('⚠️ Grid mesh or material missing, recreating...');
            createGrid();
            return;
        }
        
        // WICHTIG: Prüfen ob Mesh noch in der Szene ist!
        if (!gridMesh.parent) {
            console.warn('⚠️ Grid mesh not in scene, re-adding...');
            scene.add(gridMesh);
            if (horizonMesh && !horizonMesh.parent) {
                scene.add(horizonMesh);
            }
        }
        
        if (!gridMaterial.uniforms) {
            console.warn('⚠️ Grid uniforms missing!');
            return;
        }
        
        // Zeit - nur für Horizon-Puls, klein halten
        gridState.time += deltaTime;
        if (gridState.time > 6.28) gridState.time -= 6.28; // 2*PI cycle
        
        // Scroll - WICHTIG: direkt modulo anwenden um Float-Overflow zu vermeiden
        gridState.scrollOffset += deltaTime * gridState.scrollSpeed;
        // Modulo mit spacing damit es nahtlos loopt
        const maxOffset = gridState.spacing * 10; // 10 Zellen dann reset
        if (gridState.scrollOffset > maxOffset) {
            gridState.scrollOffset -= maxOffset;
        }
        
        // Uniforms setzen
        gridMaterial.uniforms.time.value = gridState.time;
        gridMaterial.uniforms.scrollOffset.value = gridState.scrollOffset;
        gridMaterial.uniforms.waveHeight.value = gridState.audioIntensity;
        
        if (horizonMaterial && horizonMaterial.uniforms) {
            horizonMaterial.uniforms.time.value = gridState.time;
        }
        
        // Frequenzbänder an Shader übergeben
        if (audioData && gridState.audioEnabled) {
            const low = audioData.low || 0;
            const mid = audioData.mid || 0;
            const high = audioData.high || 0;
            
            // Smoothing für flüssige Animation
            const smoothing = 0.85;
            gridState.lowFreq = (gridState.lowFreq || 0) * smoothing + low * (1 - smoothing);
            gridState.midFreq = (gridState.midFreq || 0) * smoothing + mid * (1 - smoothing);
            gridState.highFreq = (gridState.highFreq || 0) * smoothing + high * (1 - smoothing);
            
            // An Shader übergeben
            gridMaterial.uniforms.lowFreq.value = gridState.lowFreq;
            gridMaterial.uniforms.midFreq.value = gridState.midFreq;
            gridMaterial.uniforms.highFreq.value = gridState.highFreq;
            
            // Audio Pulse (für Glow)
            const targetPulse = low * gridState.audioIntensity;
            gridState.audioPulse = gridState.audioPulse * 0.85 + targetPulse * 0.15;
            gridMaterial.uniforms.audioPulse.value = gridState.audioPulse;
            
            if (horizonMaterial && horizonMaterial.uniforms) {
                horizonMaterial.uniforms.audioPulse.value = gridState.audioPulse;
            }
        }
        
        // Farbe aus Schema
        if (gridState.useSchemaColor && colorState.currentVignetteColor) {
            const vc = colorState.currentVignetteColor;
            const schemaColor = new THREE.Color(vc.r, vc.g, vc.b);
            gridMaterial.uniforms.baseColor.value.lerp(schemaColor, 0.05);
            if (horizonMaterial && horizonMaterial.uniforms) {
                horizonMaterial.uniforms.baseColor.value.lerp(schemaColor, 0.05);
            }
        }
    } catch (err) {
        console.error('Grid update error:', err);
    }
}

export function setGridEQ(low, mid, high) {
    // Für Kompatibilität - verwendet jetzt audioPulse
    if (gridMaterial) {
        gridState.audioPulse = low * gridState.audioIntensity;
        gridMaterial.uniforms.audioPulse.value = gridState.audioPulse;
    }
}

// ============================================
// SETTERS
// ============================================

export function setGridEnabled(enabled) {
    gridState.enabled = enabled;
    
    if (enabled) {
        // Immer neu erstellen wenn aktiviert
        createGrid();
        console.log('Tron Grid: ON (created)');
    } else {
        if (gridMesh) scene.remove(gridMesh);
        if (horizonMesh) scene.remove(horizonMesh);
        console.log('Tron Grid: OFF');
    }
}

export function setGridSize(x, y) {
    gridState.gridX = x;
    gridState.gridY = y;
    if (gridState.enabled) createGrid();
}

export function setGridSpacing(spacing) {
    gridState.spacing = spacing;
    if (gridMaterial) gridMaterial.uniforms.spacing.value = spacing;
    if (gridState.enabled) createGrid();
}

export function setGridPosition(y) {
    gridState.positionY = y;
    if (gridMesh) gridMesh.position.y = y;
    if (horizonMesh) horizonMesh.position.y = y;
}

export function setGlowEnabled(enabled) {
    gridState.glowEnabled = enabled;
}

export function setGlowIntensity(intensity) {
    gridState.glowIntensity = intensity;
    if (gridMaterial) gridMaterial.uniforms.glowIntensity.value = intensity;
    if (horizonMaterial) horizonMaterial.uniforms.glowIntensity.value = intensity;
}

export function setAudioEnabled(enabled) {
    gridState.audioEnabled = enabled;
}

export function setAudioIntensity(intensity) {
    gridState.audioIntensity = intensity;
}

export function setWaveHeight(height) {
    // Nicht mehr verwendet - für Kompatibilität
    gridState.scrollSpeed = height * 4; // Mappt auf Scroll-Speed
}

export function setWaveSpeed(speed) {
    gridState.scrollSpeed = speed;
}

export function setLineWidth(width) {
    gridState.lineWidth = width;
    if (gridMaterial) gridMaterial.uniforms.lineWidth.value = width;
}

export function setGridColor(color) {
    gridState.baseColor = new THREE.Color(color);
    if (gridMaterial) gridMaterial.uniforms.baseColor.value = gridState.baseColor;
    if (horizonMaterial) horizonMaterial.uniforms.baseColor.value = gridState.baseColor;
}

export function setUseSchemaColor(use) {
    gridState.useSchemaColor = use;
}

export function setHorizonColor(color) {
    gridState.horizonColor = new THREE.Color(color);
    if (horizonMaterial) horizonMaterial.uniforms.horizonColor.value = gridState.horizonColor;
}

// ============================================
// INIT & CLEANUP
// ============================================

export function initGridFloor() {
    console.log('🌆 Tron Grid Floor initialized');
}

export function disposeGrid() {
    if (gridMesh) {
        scene.remove(gridMesh);
        gridGeometry?.dispose();
        gridMaterial?.dispose();
        gridMesh = null;
    }
    if (horizonMesh) {
        scene.remove(horizonMesh);
        horizonMaterial?.dispose();
        horizonMesh = null;
    }
}
