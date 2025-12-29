/**
 * CAMERA CONTROLS
 * 
 * Kamera-Steuerung und Auto-Orbit
 * - Lock/Unlock
 * - Reset
 * - Auto-Orbit Funktion
 * - FOV Audio-Modulation
 */

import { camera, controls, defaultCameraPosition, defaultCameraTarget, defaultFov } from '../core/three-setup.js';

// ============================================
// STATE
// ============================================

export const cameraState = {
    locked: false,
    autoOrbitEnabled: false,
    autoOrbitSpeed: 0.005,
    autoOrbitAngle: 0,
    autoOrbitRadius: 5,
    autoOrbitHeight: 2,
    fovAudioLinked: false,
    fovAudioAmount: 0.3,
    baseFov: 50
};

// ============================================
// CAMERA FUNCTIONS
// ============================================

/**
 * Setzt Kamera auf Ausgangsposition zurück
 */
export function resetCamera() {
    camera.position.set(defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z);
    camera.fov = defaultFov;
    camera.updateProjectionMatrix();
    controls.target.set(defaultCameraTarget.x, defaultCameraTarget.y, defaultCameraTarget.z);
    controls.update();
    
    // UI aktualisieren
    const fovSlider = document.getElementById('cameraFov');
    const fovValue = document.getElementById('cameraFovValue');
    if (fovSlider) fovSlider.value = defaultFov;
    if (fovValue) fovValue.textContent = defaultFov + '°';
    
    cameraState.baseFov = defaultFov;
    cameraState.autoOrbitAngle = 0;
    cameraState.autoOrbitRadius = Math.sqrt(
        defaultCameraPosition.x * defaultCameraPosition.x + 
        defaultCameraPosition.z * defaultCameraPosition.z
    );
}

/**
 * Toggled Auto-Orbit Modus
 */
export function toggleAutoOrbit() {
    cameraState.autoOrbitEnabled = !cameraState.autoOrbitEnabled;
    const btn = document.getElementById('cameraOrbitBtn');
    
    if (cameraState.autoOrbitEnabled) {
        if (btn) {
            btn.style.background = 'linear-gradient(135deg, #44aaff, #4488ff)';
            btn.style.color = '#fff';
        }
        
        // Aktuelle Position als Startpunkt
        cameraState.autoOrbitRadius = Math.sqrt(
            camera.position.x * camera.position.x + 
            camera.position.z * camera.position.z
        );
        cameraState.autoOrbitHeight = camera.position.y;
        cameraState.autoOrbitAngle = Math.atan2(camera.position.x, camera.position.z);
        
        controls.enabled = false;
    } else {
        if (btn) {
            btn.style.background = '';
            btn.style.color = '';
        }
        controls.enabled = !cameraState.locked;
    }
}

/**
 * Update Auto-Orbit (im Animation Loop aufrufen)
 */
export function updateAutoOrbit() {
    if (!cameraState.autoOrbitEnabled) return;
    
    cameraState.autoOrbitAngle += cameraState.autoOrbitSpeed;
    
    // Kreisbahn um Zentrum
    camera.position.x = Math.sin(cameraState.autoOrbitAngle) * cameraState.autoOrbitRadius;
    camera.position.z = Math.cos(cameraState.autoOrbitAngle) * cameraState.autoOrbitRadius;
    camera.position.y = cameraState.autoOrbitHeight;
    
    camera.lookAt(0, 0, 0);
}

/**
 * FOV mit Audio-Level modulieren
 * @param {number} audioLevel - Audio-Level (0-1)
 */
export function updateFovWithAudio(audioLevel) {
    if (!cameraState.fovAudioLinked) return;
    
    // Bei hohem Audio: FOV wird kleiner (Zoom-In Effekt)
    const fovModulation = audioLevel * cameraState.fovAudioAmount * 30;
    const newFov = cameraState.baseFov - fovModulation;
    
    camera.fov = Math.max(20, Math.min(120, newFov));
    camera.updateProjectionMatrix();
}

// ============================================
// SETTERS
// ============================================

export function setCameraLocked(locked) {
    cameraState.locked = locked;
    controls.enabled = !locked && !cameraState.autoOrbitEnabled;
}

export function setAutoOrbitSpeed(speed) {
    cameraState.autoOrbitSpeed = speed;
}

export function setFovAudioLinked(linked) {
    cameraState.fovAudioLinked = linked;
    if (!linked) {
        camera.fov = cameraState.baseFov;
        camera.updateProjectionMatrix();
    }
}

export function setFovAudioAmount(amount) {
    cameraState.fovAudioAmount = amount;
}

export function setBaseFov(fov) {
    cameraState.baseFov = fov;
    if (!cameraState.fovAudioLinked) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }
}

// ============================================
// UI INITIALIZATION
// ============================================

export function initCameraUI() {
    // Kamera Lock
    const lockCheckbox = document.getElementById('cameraLocked');
    if (lockCheckbox) {
        lockCheckbox.addEventListener('change', (e) => {
            setCameraLocked(e.target.checked);
        });
    }
    
    // Kamera Reset
    const resetBtn = document.getElementById('cameraResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (cameraState.autoOrbitEnabled) {
                toggleAutoOrbit();
            }
            resetCamera();
        });
    }
    
    // Auto-Orbit Toggle
    const orbitBtn = document.getElementById('cameraOrbitBtn');
    if (orbitBtn) {
        orbitBtn.addEventListener('click', toggleAutoOrbit);
    }
    
    // FOV Slider
    const fovSlider = document.getElementById('cameraFov');
    if (fovSlider) {
        fovSlider.addEventListener('input', (e) => {
            const fov = parseInt(e.target.value);
            const display = document.getElementById('cameraFovValue');
            if (display) display.textContent = fov + '°';
            setBaseFov(fov);
        });
    }
    
    // FOV Audio Link
    const fovLinkCheckbox = document.getElementById('fovAudioLinked');
    if (fovLinkCheckbox) {
        fovLinkCheckbox.addEventListener('change', (e) => {
            setFovAudioLinked(e.target.checked);
            
            const slider = document.getElementById('fovAudioAmount');
            const control = document.getElementById('fovAudioControl');
            if (slider) slider.disabled = !e.target.checked;
            if (control) control.style.opacity = e.target.checked ? '1' : '0.5';
        });
    }
    
    // FOV Audio Amount
    const fovAmountSlider = document.getElementById('fovAudioAmount');
    if (fovAmountSlider) {
        fovAmountSlider.addEventListener('input', (e) => {
            setFovAudioAmount(parseInt(e.target.value) / 100);
            const display = document.getElementById('fovAudioAmountValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // NOTE: rotationSpeed Handler ist in beat-detector.js definiert
}

// ============================================
// GETTERS
// ============================================

export function isAutoOrbitEnabled() {
    return cameraState.autoOrbitEnabled;
}

export function isCameraLocked() {
    return cameraState.locked;
}
