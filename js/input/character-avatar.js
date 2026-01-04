/**
 * CHARACTER AVATAR
 * 
 * 3D Character auf Skeleton Tracking mappen
 * - Lädt rigged 3D Modelle (GLB mit Skeleton)
 * - Mappt MediaPipe Pose Landmarks auf Bones
 * - Real-time Animation
 * - Mehrere Character-Presets
 */

import { THREE, scene, camera } from '../core/three-setup.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { skeletonState, getLandmarks, getAllLandmarks, getHandLandmarks, getFaceLandmarks } from './skeleton-tracker.js';

// ============================================
// STATE
// ============================================

export const avatarState = {
    enabled: false,
    model: null,
    skeleton: null,
    bones: {},
    mixer: null,
    
    // Welches Tracking-Modell nutzen
    trackingSource: 'mediapipe', // 'mediapipe', 'movenet-lightning', 'movenet-thunder'
    
    // Position & Scale
    position: { x: 0, y: -3, z: 0 },
    scale: 3.0,
    
    // Rotation offset (für Kamera-Ausrichtung)
    rotationOffset: { x: 0, y: Math.PI, z: 0 },
    
    // Mirror (wenn Kamera gespiegelt)
    mirror: true,
    
    // Smoothing
    smoothing: 0.3,
    smoothedBones: {},
    
    // Visibility
    showAvatar: true,
    showDebugSkeleton: false,
    
    // Character Preset
    currentPreset: 'cc0-male',
    
    // Tracking Quality
    minConfidence: 0.5,
    
    // Features
    enableArms: true,
    enableLegs: true,
    enableSpine: true,
    enableHead: true,
    enableFingers: false, // Benötigt Hand-Tracking
    
    // Animation blending
    idleAnimation: null,
    blendWeight: 0.5 // Blend zwischen Tracking und Idle
};

// ============================================
// MULTI-RIG BONE MAPPINGS
// ============================================

// Universal bone names that we map TO
const BONE_NAMES = {
    hips: 'hips',
    spine: 'spine',
    spine1: 'spine1',
    spine2: 'spine2',
    neck: 'neck',
    head: 'head',
    leftShoulder: 'leftShoulder',
    leftArm: 'leftArm',
    leftForeArm: 'leftForeArm',
    leftHand: 'leftHand',
    rightShoulder: 'rightShoulder',
    rightArm: 'rightArm',
    rightForeArm: 'rightForeArm',
    rightHand: 'rightHand',
    leftUpLeg: 'leftUpLeg',
    leftLeg: 'leftLeg',
    leftFoot: 'leftFoot',
    rightUpLeg: 'rightUpLeg',
    rightLeg: 'rightLeg',
    rightFoot: 'rightFoot'
};

// Rig type definitions - maps actual bone names to universal names
const RIG_MAPPINGS = {
    // Mixamo standard naming
    mixamo: {
        detect: ['mixamorigHips', 'mixamorigSpine'],
        bones: {
            hips: 'mixamorigHips',
            spine: 'mixamorigSpine',
            spine1: 'mixamorigSpine1',
            spine2: 'mixamorigSpine2',
            neck: 'mixamorigNeck',
            head: 'mixamorigHead',
            leftShoulder: 'mixamorigLeftShoulder',
            leftArm: 'mixamorigLeftArm',
            leftForeArm: 'mixamorigLeftForeArm',
            leftHand: 'mixamorigLeftHand',
            rightShoulder: 'mixamorigRightShoulder',
            rightArm: 'mixamorigRightArm',
            rightForeArm: 'mixamorigRightForeArm',
            rightHand: 'mixamorigRightHand',
            leftUpLeg: 'mixamorigLeftUpLeg',
            leftLeg: 'mixamorigLeftLeg',
            leftFoot: 'mixamorigLeftFoot',
            rightUpLeg: 'mixamorigRightUpLeg',
            rightLeg: 'mixamorigRightLeg',
            rightFoot: 'mixamorigRightFoot'
        }
    },
    
    // Quaternius / Blender standard
    quaternius: {
        detect: ['Hips', 'Spine', 'UpperArm'],
        bones: {
            hips: 'Hips',
            spine: 'Spine',
            spine1: 'Spine1',
            spine2: 'Spine2',
            neck: 'Neck',
            head: 'Head',
            leftShoulder: 'LeftShoulder',
            leftArm: 'LeftUpperArm',
            leftForeArm: 'LeftLowerArm',
            leftHand: 'LeftHand',
            rightShoulder: 'RightShoulder',
            rightArm: 'RightUpperArm',
            rightForeArm: 'RightLowerArm',
            rightHand: 'RightHand',
            leftUpLeg: 'LeftUpperLeg',
            leftLeg: 'LeftLowerLeg',
            leftFoot: 'LeftFoot',
            rightUpLeg: 'RightUpperLeg',
            rightLeg: 'RightLowerLeg',
            rightFoot: 'RightFoot'
        }
    },
    
    // Unity Humanoid / Generic
    unity: {
        detect: ['Hips', 'Spine', 'UpperArm_L'],
        bones: {
            hips: 'Hips',
            spine: 'Spine',
            spine1: 'Chest',
            spine2: 'UpperChest',
            neck: 'Neck',
            head: 'Head',
            leftShoulder: 'Shoulder_L',
            leftArm: 'UpperArm_L',
            leftForeArm: 'LowerArm_L',
            leftHand: 'Hand_L',
            rightShoulder: 'Shoulder_R',
            rightArm: 'UpperArm_R',
            rightForeArm: 'LowerArm_R',
            rightHand: 'Hand_R',
            leftUpLeg: 'UpperLeg_L',
            leftLeg: 'LowerLeg_L',
            leftFoot: 'Foot_L',
            rightUpLeg: 'UpperLeg_R',
            rightLeg: 'LowerLeg_R',
            rightFoot: 'Foot_R'
        }
    },
    
    // Ready Player Me / VRM style
    vrm: {
        detect: ['hips', 'spine', 'leftUpperArm'],
        bones: {
            hips: 'hips',
            spine: 'spine',
            spine1: 'chest',
            spine2: 'upperChest',
            neck: 'neck',
            head: 'head',
            leftShoulder: 'leftShoulder',
            leftArm: 'leftUpperArm',
            leftForeArm: 'leftLowerArm',
            leftHand: 'leftHand',
            rightShoulder: 'rightShoulder',
            rightArm: 'rightUpperArm',
            rightForeArm: 'rightLowerArm',
            rightHand: 'rightHand',
            leftUpLeg: 'leftUpperLeg',
            leftLeg: 'leftLowerLeg',
            leftFoot: 'leftFoot',
            rightUpLeg: 'rightUpperLeg',
            rightLeg: 'rightLowerLeg',
            rightFoot: 'rightFoot'
        }
    },
    
    // Blender Rigify
    rigify: {
        detect: ['spine', 'spine.001', 'upper_arm'],
        bones: {
            hips: 'spine',
            spine: 'spine.001',
            spine1: 'spine.002',
            spine2: 'spine.003',
            neck: 'spine.004',
            head: 'spine.005',
            leftShoulder: 'shoulder.L',
            leftArm: 'upper_arm.L',
            leftForeArm: 'forearm.L',
            leftHand: 'hand.L',
            rightShoulder: 'shoulder.R',
            rightArm: 'upper_arm.R',
            rightForeArm: 'forearm.R',
            rightHand: 'hand.R',
            leftUpLeg: 'thigh.L',
            leftLeg: 'shin.L',
            leftFoot: 'foot.L',
            rightUpLeg: 'thigh.R',
            rightLeg: 'shin.R',
            rightFoot: 'foot.R'
        }
    }
};

// Current detected rig type
let currentRigType = 'mixamo';
let boneMapping = {}; // Maps universal names to actual bone objects

/**
 * Auto-detect rig type from bone names
 */
function detectRigType(boneNames) {
    for (const [rigType, config] of Object.entries(RIG_MAPPINGS)) {
        const matches = config.detect.filter(name => 
            boneNames.some(bn => bn.includes(name) || bn === name)
        );
        if (matches.length >= 2) {
            console.log(`[Avatar] Detected rig type: ${rigType} (matched: ${matches.join(', ')})`);
            return rigType;
        }
    }
    console.log('[Avatar] Could not detect rig type, trying fuzzy match...');
    return fuzzyDetectRig(boneNames);
}

/**
 * Fuzzy rig detection for non-standard naming
 */
function fuzzyDetectRig(boneNames) {
    const lower = boneNames.map(n => n.toLowerCase());
    
    // Check for common patterns
    if (lower.some(n => n.includes('mixamo'))) return 'mixamo';
    if (lower.some(n => n.includes('upperarm') && n.includes('left'))) return 'quaternius';
    if (lower.some(n => n.includes('_l') || n.includes('_r'))) return 'unity';
    if (lower.some(n => n.includes('thigh') && n.includes('.l'))) return 'rigify';
    
    // Default fallback
    return 'vrm';
}

/**
 * Build bone mapping from detected rig type
 */
function buildBoneMapping(bones, rigType) {
    const mapping = {};
    const rigConfig = RIG_MAPPINGS[rigType];
    
    if (!rigConfig) {
        console.warn(`[Avatar] Unknown rig type: ${rigType}`);
        return mapping;
    }
    
    for (const [universal, actual] of Object.entries(rigConfig.bones)) {
        // Direct match
        if (bones[actual]) {
            mapping[universal] = bones[actual];
        } else {
            // Try case-insensitive match
            const found = Object.entries(bones).find(([name]) => 
                name.toLowerCase() === actual.toLowerCase()
            );
            if (found) {
                mapping[universal] = found[1];
            }
        }
    }
    
    console.log(`[Avatar] Bone mapping built: ${Object.keys(mapping).length}/${Object.keys(rigConfig.bones).length} bones mapped`);
    return mapping;
}

/**
 * Get mapped bone by universal name
 */
function getBone(universalName) {
    return boneMapping[universalName] || null;
}

// Bone Chains für IK-ähnliche Rotation (using universal names now)
const BONE_CHAINS = {
    leftArm: {
        joints: [11, 13, 15],
        bones: ['leftShoulder', 'leftArm', 'leftForeArm']
    },
    rightArm: {
        joints: [12, 14, 16],
        bones: ['rightShoulder', 'rightArm', 'rightForeArm']
    },
    leftLeg: {
        joints: [23, 25, 27],
        bones: ['leftUpLeg', 'leftLeg', 'leftFoot']
    },
    rightLeg: {
        joints: [24, 26, 28],
        bones: ['rightUpLeg', 'rightLeg', 'rightFoot']
    },
    spine: {
        joints: [23, 24, 11, 12, 0], // hips -> shoulders -> nose
        bones: ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head']
    }
};

// Character Presets (URLs zu GLB Dateien)
const CHARACTER_PRESETS = {
    'cc0-male': {
        name: '👤 Male Base (CC0)',
        url: 'models/characters/male_base_mesh.glb',
        bonePrefix: '',
        scale: 1.0,
        license: 'CC0 - Public Domain'
    },
    'mixamo-ybot': {
        name: 'Y-Bot (Mixamo)',
        url: 'models/characters/ybot.glb',
        bonePrefix: 'mixamorig',
        scale: 0.01,
        license: 'Mixamo ToS - not for redistribution'
    },
    'mixamo-xbot': {
        name: 'X-Bot (Mixamo)',
        url: 'models/characters/xbot.glb',
        bonePrefix: 'mixamorig',
        scale: 0.01,
        license: 'Mixamo ToS - not for redistribution'
    },
    'readyplayerme': {
        name: 'Ready Player Me',
        url: 'models/characters/rpm-avatar.glb',
        bonePrefix: '',
        scale: 1.0,
        license: 'RPM ToS - not for redistribution'
    },
    'custom': {
        name: 'Custom Model',
        url: '',
        bonePrefix: '',
        scale: 1.0
    }
};

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Debug Skeleton Helper
let skeletonHelper = null;

// ============================================
// MODEL LOADING
// ============================================

/**
 * Lädt einen Character aus Preset oder URL
 */
export async function loadCharacter(presetOrUrl) {
    // Alten Character entfernen
    if (avatarState.model) {
        scene.remove(avatarState.model);
        avatarState.model = null;
        avatarState.skeleton = null;
        avatarState.bones = {};
    }
    
    if (skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper = null;
    }
    
    let url, preset;
    
    if (CHARACTER_PRESETS[presetOrUrl]) {
        preset = CHARACTER_PRESETS[presetOrUrl];
        url = preset.url;
        avatarState.currentPreset = presetOrUrl;
    } else {
        url = presetOrUrl;
        preset = CHARACTER_PRESETS['custom'];
        preset.url = url;
        avatarState.currentPreset = 'custom';
    }
    
    if (!url) {
        console.warn('[Avatar] No URL provided');
        updateAvatarStatus('error', 'No URL');
        return false;
    }
    
    updateAvatarStatus('loading');
    
    try {
        const gltf = await loadGLTF(url);
        
        avatarState.model = gltf.scene;
        avatarState.model.name = 'CharacterAvatar';
        
        // Scale anwenden
        const baseScale = preset.scale * avatarState.scale;
        avatarState.model.scale.set(baseScale, baseScale, baseScale);
        
        // Position
        avatarState.model.position.set(
            avatarState.position.x,
            avatarState.position.y,
            avatarState.position.z
        );
        
        // Rotation Offset
        avatarState.model.rotation.set(
            avatarState.rotationOffset.x,
            avatarState.rotationOffset.y,
            avatarState.rotationOffset.z
        );
        
        // Bones finden
        findBones(avatarState.model, preset.bonePrefix);
        
        // Skeleton Helper für Debug
        avatarState.model.traverse((child) => {
            if (child.isSkinnedMesh) {
                avatarState.skeleton = child.skeleton;
                
                if (avatarState.showDebugSkeleton) {
                    skeletonHelper = new THREE.SkeletonHelper(child);
                    skeletonHelper.material.linewidth = 3;
                    scene.add(skeletonHelper);
                }
            }
        });
        
        // Animation Mixer
        if (gltf.animations && gltf.animations.length > 0) {
            avatarState.mixer = new THREE.AnimationMixer(avatarState.model);
            avatarState.idleAnimation = avatarState.mixer.clipAction(gltf.animations[0]);
            avatarState.idleAnimation.play();
        }
        
        scene.add(avatarState.model);
        
        avatarState.enabled = true;
        updateAvatarStatus('ready');
        
        console.log(`[Avatar] Character loaded: ${preset.name}, Bones found: ${Object.keys(avatarState.bones).length}`);
        return true;
        
    } catch (err) {
        console.error('[Avatar] Load failed:', err);
        
        // Check if it's a preset model that needs to be downloaded
        if (err.message?.includes('fetch') || err.message?.includes('Failed')) {
            const isPreset = ['mixamo-ybot', 'mixamo-xbot', 'readyplayerme'].includes(avatarState.currentPreset);
            if (isPreset) {
                const presetName = CHARACTER_PRESETS[avatarState.currentPreset]?.name || avatarState.currentPreset;
                updateAvatarStatus('error', `${presetName} not found`);
                
                // Show alert with download instructions
                alert(`⚠️ Character model not found!\n\n` +
                    `"${presetName}" needs to be downloaded and placed in:\n` +
                    `models/characters/\n\n` +
                    `Download from:\n` +
                    `• Mixamo: mixamo.com (Y-Bot, X-Bot)\n` +
                    `• Ready Player Me: readyplayer.me\n\n` +
                    `Or use "Custom" and paste a GLB URL.`);
            } else {
                updateAvatarStatus('error', 'File not found');
            }
        } else {
            updateAvatarStatus('error', err.message);
        }
        return false;
    }
}

function loadGLTF(url) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, resolve, undefined, reject);
    });
}

/**
 * Findet alle Bones im Modell und baut universelles Mapping
 */
function findBones(model, prefix = '') {
    avatarState.bones = {};
    const boneNames = [];
    
    // Erst alle Bones sammeln
    model.traverse((child) => {
        if (child.isBone) {
            avatarState.bones[child.name] = child;
            boneNames.push(child.name);
            
            // Initial Rotation speichern für Smoothing
            avatarState.smoothedBones[child.name] = {
                quaternion: child.quaternion.clone(),
                position: child.position.clone()
            };
        }
    });
    
    console.log('[Avatar] Found bones:', boneNames);
    
    // Rig-Typ erkennen
    currentRigType = detectRigType(boneNames);
    
    // Universelles Bone-Mapping aufbauen
    boneMapping = buildBoneMapping(avatarState.bones, currentRigType);
    
    // Smoothed bones für universelle Namen initialisieren
    for (const [universal, bone] of Object.entries(boneMapping)) {
        if (!avatarState.smoothedBones[universal]) {
            avatarState.smoothedBones[universal] = {
                quaternion: bone.quaternion.clone(),
                position: bone.position.clone()
            };
        }
    }
    
    console.log(`[Avatar] Rig type: ${currentRigType}, Mapped bones: ${Object.keys(boneMapping).join(', ')}`);
}

/**
 * Character entfernen
 */
export function unloadCharacter() {
    if (avatarState.model) {
        scene.remove(avatarState.model);
        avatarState.model.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        avatarState.model = null;
    }
    
    if (skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper = null;
    }
    
    avatarState.skeleton = null;
    avatarState.bones = {};
    avatarState.mixer = null;
    avatarState.enabled = false;
    
    updateAvatarStatus('disabled');
}

// ============================================
// POSE UPDATE
// ============================================

/**
 * Aktualisiert die Avatar-Pose basierend auf Tracking-Daten
 * Im Animation Loop aufrufen
 */
export function updateAvatarPose(deltaTime = 0.016) {
    if (!avatarState.enabled || !avatarState.model) return;
    if (!skeletonState.activeModels.has(avatarState.trackingSource)) return;
    
    const landmarks = getLandmarks(avatarState.trackingSource);
    if (!landmarks || landmarks.length < 33) return;
    
    // World Landmarks verwenden falls verfügbar (bessere 3D Daten)
    const worldLandmarks = skeletonState.results[avatarState.trackingSource]?.worldLandmarks;
    const useLandmarks = worldLandmarks || landmarks;
    
    // Animation Mixer Update
    if (avatarState.mixer) {
        avatarState.mixer.update(deltaTime);
    }
    
    // Hips Position (Körpermitte)
    updateHipsPosition(useLandmarks);
    
    // Spine/Torso Rotation
    if (avatarState.enableSpine) {
        updateSpineRotation(useLandmarks);
    }
    
    // Head Rotation
    if (avatarState.enableHead) {
        updateHeadRotation(useLandmarks);
    }
    
    // Arms
    if (avatarState.enableArms) {
        updateArmChain('left', useLandmarks);
        updateArmChain('right', useLandmarks);
    }
    
    // Legs
    if (avatarState.enableLegs) {
        updateLegChain('left', useLandmarks);
        updateLegChain('right', useLandmarks);
    }
    
    // Fingers (wenn Hand-Tracking aktiv)
    if (avatarState.enableFingers && skeletonState.activeModels.has('hands')) {
        updateFingers('left');
        updateFingers('right');
    }
    
    // Skeleton Helper aktualisieren
    if (skeletonHelper) {
        skeletonHelper.update();
    }
}

/**
 * Hips Position aus Tracking
 */
function updateHipsPosition(landmarks) {
    const hipsBone = getBone('hips');
    if (!hipsBone) return;
    
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!leftHip || !rightHip) return;
    if ((leftHip.visibility || 1) < avatarState.minConfidence) return;
    if ((rightHip.visibility || 1) < avatarState.minConfidence) return;
    
    // Mittelpunkt der Hüften
    let hipX = (leftHip.x + rightHip.x) / 2;
    let hipY = (leftHip.y + rightHip.y) / 2;
    let hipZ = ((leftHip.z || 0) + (rightHip.z || 0)) / 2;
    
    // Normalisierte Koordinaten (0-1) in 3D-Raum umrechnen
    const range = 5;
    
    // Mirror wenn aktiviert
    if (avatarState.mirror) {
        hipX = 1 - hipX;
    }
    
    const targetX = (hipX - 0.5) * 2 * range;
    const targetY = avatarState.position.y + (0.5 - hipY) * range;
    const targetZ = hipZ * range;
    
    // Smoothing
    const s = avatarState.smoothing;
    avatarState.model.position.x = avatarState.model.position.x * s + targetX * (1 - s);
    avatarState.model.position.y = avatarState.model.position.y * s + targetY * (1 - s);
    avatarState.model.position.z = avatarState.model.position.z * s + targetZ * (1 - s);
}

/**
 * Spine Rotation basierend auf Schulter-Hüft Ausrichtung
 */
function updateSpineRotation(landmarks) {
    const hipsBone = getBone('hips');
    const spineBone = getBone('spine');
    const spine1Bone = getBone('spine1');
    const spine2Bone = getBone('spine2');
    
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;
    
    // Schulter-Rotation (Y-Achse)
    let shoulderDx = rightShoulder.x - leftShoulder.x;
    if (avatarState.mirror) shoulderDx = -shoulderDx;
    const shoulderAngle = Math.atan2(shoulderDx, 0.3);
    
    // Hüft-Rotation
    let hipDx = rightHip.x - leftHip.x;
    if (avatarState.mirror) hipDx = -hipDx;
    const hipAngle = Math.atan2(hipDx, 0.3);
    
    // Torso Neigung (Z-Achse) - seitliche Neigung
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipMidY = (leftHip.y + rightHip.y) / 2;
    const leanAngle = (shoulderMidY - hipMidY - 0.3) * 2;
    
    // Auf Bones anwenden mit Smoothing
    if (hipsBone) {
        applySmoothedRotation(hipsBone, 0, hipAngle, 0);
    }
    
    if (spineBone) {
        applySmoothedRotation(spineBone, leanAngle * 0.3, (shoulderAngle - hipAngle) * 0.5, 0);
    }
    
    if (spine2Bone) {
        applySmoothedRotation(spine2Bone, leanAngle * 0.3, (shoulderAngle - hipAngle) * 0.5, 0);
    }
}

/**
 * Head Rotation basierend auf Nose Position
 */
function updateHeadRotation(landmarks) {
    const headBone = getBone('head');
    const neckBone = getBone('neck');
    if (!headBone) return;
    
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    if (!nose || !leftShoulder || !rightShoulder) return;
    
    // Kopfdrehung (Y-Achse)
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    let headTurn = (nose.x - shoulderMidX) * 3;
    if (avatarState.mirror) headTurn = -headTurn;
    
    // Kopfneigung (X-Achse)
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const headTilt = (nose.y - shoulderMidY - 0.15) * 2;
    
    // Kopfneigung seitlich (Z-Achse) basierend auf Ohren
    let headRoll = 0;
    if (leftEar && rightEar) {
        headRoll = (leftEar.y - rightEar.y) * 2;
        if (avatarState.mirror) headRoll = -headRoll;
    }
    
    if (neckBone) {
        applySmoothedRotation(neckBone, headTilt * 0.3, headTurn * 0.3, headRoll * 0.3);
    }
    
    applySmoothedRotation(headBone, headTilt * 0.7, headTurn * 0.7, headRoll * 0.7);
}

/**
 * Arm Chain Update (Shoulder -> Elbow -> Wrist)
 */
function updateArmChain(side, landmarks) {
    const isLeft = side === 'left';
    
    const shoulderIdx = isLeft ? 11 : 12;
    const elbowIdx = isLeft ? 13 : 14;
    const wristIdx = isLeft ? 15 : 16;
    
    const shoulder = landmarks[shoulderIdx];
    const elbow = landmarks[elbowIdx];
    const wrist = landmarks[wristIdx];
    
    if (!shoulder || !elbow || !wrist) return;
    if ((shoulder.visibility || 1) < avatarState.minConfidence) return;
    
    const shoulderBone = getBone(isLeft ? 'leftShoulder' : 'rightShoulder');
    const armBone = getBone(isLeft ? 'leftArm' : 'rightArm');
    const foreArmBone = getBone(isLeft ? 'leftForeArm' : 'rightForeArm');
    
    // Oberarm Rotation (Shoulder -> Elbow)
    if (armBone) {
        let dx = elbow.x - shoulder.x;
        let dy = elbow.y - shoulder.y;
        let dz = (elbow.z || 0) - (shoulder.z || 0);
        
        if (avatarState.mirror) dx = -dx;
        
        // Winkel berechnen
        const angleZ = Math.atan2(dy, Math.abs(dx)) + Math.PI / 2;
        const angleY = Math.atan2(dz, dx);
        
        // Seiten-spezifische Anpassung
        const sideMultiplier = isLeft ? 1 : -1;
        
        applySmoothedRotation(armBone, 0, angleY * sideMultiplier, angleZ * sideMultiplier);
    }
    
    // Unterarm Rotation (Elbow -> Wrist)
    if (foreArmBone) {
        let dx = wrist.x - elbow.x;
        let dy = wrist.y - elbow.y;
        let dz = (wrist.z || 0) - (elbow.z || 0);
        
        if (avatarState.mirror) dx = -dx;
        
        const angleZ = Math.atan2(dy, Math.abs(dx));
        const bendAngle = Math.atan2(Math.sqrt(dx*dx + dy*dy), dz);
        
        applySmoothedRotation(foreArmBone, bendAngle * 0.5, 0, angleZ * 0.5);
    }
}

/**
 * Leg Chain Update (Hip -> Knee -> Ankle)
 */
function updateLegChain(side, landmarks) {
    const isLeft = side === 'left';
    
    const hipIdx = isLeft ? 23 : 24;
    const kneeIdx = isLeft ? 25 : 26;
    const ankleIdx = isLeft ? 27 : 28;
    
    const hip = landmarks[hipIdx];
    const knee = landmarks[kneeIdx];
    const ankle = landmarks[ankleIdx];
    
    if (!hip || !knee || !ankle) return;
    if ((hip.visibility || 1) < avatarState.minConfidence) return;
    
    const upLegBone = getBone(isLeft ? 'leftUpLeg' : 'rightUpLeg');
    const legBone = getBone(isLeft ? 'leftLeg' : 'rightLeg');
    const footBone = getBone(isLeft ? 'leftFoot' : 'rightFoot');
    
    // Oberschenkel Rotation
    if (upLegBone) {
        let dx = knee.x - hip.x;
        let dy = knee.y - hip.y;
        let dz = (knee.z || 0) - (hip.z || 0);
        
        if (avatarState.mirror) dx = -dx;
        
        const angleZ = Math.atan2(dx, dy);
        const angleX = Math.atan2(dz, dy);
        
        applySmoothedRotation(upLegBone, angleX, 0, angleZ);
    }
    
    // Unterschenkel Rotation (Knie-Beugung)
    if (legBone) {
        let dx = ankle.x - knee.x;
        let dy = ankle.y - knee.y;
        let dz = (ankle.z || 0) - (knee.z || 0);
        
        if (avatarState.mirror) dx = -dx;
        
        // Kniebeugung hauptsächlich auf X-Achse
        const bendAngle = Math.atan2(dz, dy);
        
        applySmoothedRotation(legBone, bendAngle, 0, 0);
    }
}

/**
 * Finger Update (benötigt Hand-Tracking)
 */
function updateFingers(side) {
    const handLandmarks = getHandLandmarks(side);
    if (!handLandmarks) return;
    
    // TODO: Finger-Bone Mapping implementieren
    // Mixamo Finger Bones: mixamorigLeftHandThumb1, mixamorigLeftHandIndex1, etc.
}

/**
 * Smoothed Rotation auf Bone anwenden
 */
function applySmoothedRotation(bone, x, y, z) {
    if (!bone) return;
    
    const smoothed = avatarState.smoothedBones[bone.name];
    if (!smoothed) {
        avatarState.smoothedBones[bone.name] = {
            quaternion: bone.quaternion.clone(),
            position: bone.position.clone()
        };
        return;
    }
    
    // Ziel-Quaternion erstellen
    const targetQuat = new THREE.Quaternion();
    const euler = new THREE.Euler(x, y, z, 'XYZ');
    targetQuat.setFromEuler(euler);
    
    // Smoothed Interpolation
    smoothed.quaternion.slerp(targetQuat, 1 - avatarState.smoothing);
    
    // Auf Bone anwenden
    bone.quaternion.copy(smoothed.quaternion);
}

// ============================================
// SETTERS
// ============================================

export function setAvatarEnabled(enabled) {
    avatarState.enabled = enabled;
    if (avatarState.model) {
        avatarState.model.visible = enabled && avatarState.showAvatar;
    }
}

export function setAvatarVisible(visible) {
    avatarState.showAvatar = visible;
    if (avatarState.model) {
        avatarState.model.visible = visible && avatarState.enabled;
    }
}

export function setAvatarScale(scale) {
    avatarState.scale = scale;
    if (avatarState.model) {
        const preset = CHARACTER_PRESETS[avatarState.currentPreset] || { scale: 1 };
        const finalScale = preset.scale * scale;
        avatarState.model.scale.set(finalScale, finalScale, finalScale);
    }
}

export function setAvatarPosition(x, y, z) {
    avatarState.position = { x, y, z };
    // Position wird in updateAvatarPose angewendet
}

export function setAvatarMirror(mirror) {
    avatarState.mirror = mirror;
}

export function setAvatarSmoothing(smoothing) {
    avatarState.smoothing = Math.max(0, Math.min(0.99, smoothing));
}

export function setAvatarTrackingSource(source) {
    avatarState.trackingSource = source;
}

export function setAvatarDebugSkeleton(show) {
    avatarState.showDebugSkeleton = show;
    
    if (show && avatarState.model && !skeletonHelper) {
        avatarState.model.traverse((child) => {
            if (child.isSkinnedMesh) {
                skeletonHelper = new THREE.SkeletonHelper(child);
                scene.add(skeletonHelper);
            }
        });
    } else if (!show && skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper = null;
    }
}

export function setAvatarFeature(feature, enabled) {
    switch (feature) {
        case 'arms': avatarState.enableArms = enabled; break;
        case 'legs': avatarState.enableLegs = enabled; break;
        case 'spine': avatarState.enableSpine = enabled; break;
        case 'head': avatarState.enableHead = enabled; break;
        case 'fingers': avatarState.enableFingers = enabled; break;
    }
}

// ============================================
// UI
// ============================================

function updateAvatarStatus(status, detail = '') {
    const statusEl = document.getElementById('avatarStatus');
    if (!statusEl) return;
    
    switch (status) {
        case 'loading':
            statusEl.textContent = '⏳ Loading...';
            statusEl.style.color = '#ff0';
            break;
        case 'ready':
            statusEl.textContent = '✅ Ready';
            statusEl.style.color = '#4f4';
            break;
        case 'disabled':
            statusEl.textContent = '⚫ Disabled';
            statusEl.style.color = '#666';
            break;
        case 'error':
            statusEl.textContent = '❌ ' + detail;
            statusEl.style.color = '#f44';
            break;
    }
}

export function initAvatarUI() {
    // Character Select
    const characterSelect = document.getElementById('avatarCharacterSelect');
    if (characterSelect) {
        // Presets einfügen
        for (const [key, preset] of Object.entries(CHARACTER_PRESETS)) {
            if (key === 'custom') continue;
            const option = document.createElement('option');
            option.value = key;
            option.textContent = preset.name;
            characterSelect.appendChild(option);
        }
        
        characterSelect.addEventListener('change', async (e) => {
            if (e.target.value) {
                await loadCharacter(e.target.value);
            }
        });
    }
    
    // Custom URL Input
    const customUrlInput = document.getElementById('avatarCustomUrl');
    const loadCustomBtn = document.getElementById('avatarLoadCustom');
    if (loadCustomBtn && customUrlInput) {
        loadCustomBtn.addEventListener('click', async () => {
            const url = customUrlInput.value.trim();
            if (url) {
                await loadCharacter(url);
            }
        });
    }
    
    // Enable Toggle
    const enableCheckbox = document.getElementById('avatarEnabled');
    if (enableCheckbox) {
        enableCheckbox.addEventListener('change', (e) => {
            setAvatarEnabled(e.target.checked);
        });
    }
    
    // Visibility Toggle
    const visibilityBtn = document.getElementById('avatarVisibilityBtn');
    if (visibilityBtn) {
        visibilityBtn.addEventListener('click', () => {
            const newState = !avatarState.showAvatar;
            setAvatarVisible(newState);
            visibilityBtn.classList.toggle('active', newState);
        });
    }
    
    // Scale Slider
    const scaleSlider = document.getElementById('avatarScale');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            setAvatarScale(scale);
            const display = document.getElementById('avatarScaleValue');
            if (display) display.textContent = scale.toFixed(1);
        });
    }
    
    // Smoothing Slider
    const smoothingSlider = document.getElementById('avatarSmoothing');
    if (smoothingSlider) {
        smoothingSlider.value = avatarState.smoothing * 100;
        smoothingSlider.addEventListener('input', (e) => {
            setAvatarSmoothing(parseInt(e.target.value) / 100);
            const display = document.getElementById('avatarSmoothingValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // Mirror Checkbox
    const mirrorCheckbox = document.getElementById('avatarMirror');
    if (mirrorCheckbox) {
        mirrorCheckbox.checked = avatarState.mirror;
        mirrorCheckbox.addEventListener('change', (e) => {
            setAvatarMirror(e.target.checked);
        });
    }
    
    // Tracking Source
    const trackingSourceSelect = document.getElementById('avatarTrackingSource');
    if (trackingSourceSelect) {
        trackingSourceSelect.addEventListener('change', (e) => {
            setAvatarTrackingSource(e.target.value);
        });
    }
    
    // Debug Skeleton
    const debugSkeletonCheckbox = document.getElementById('avatarDebugSkeleton');
    if (debugSkeletonCheckbox) {
        debugSkeletonCheckbox.addEventListener('change', (e) => {
            setAvatarDebugSkeleton(e.target.checked);
        });
    }
    
    // Feature Toggles
    const features = ['arms', 'legs', 'spine', 'head', 'fingers'];
    for (const feature of features) {
        const checkbox = document.getElementById(`avatar${feature.charAt(0).toUpperCase() + feature.slice(1)}`);
        if (checkbox) {
            checkbox.checked = avatarState[`enable${feature.charAt(0).toUpperCase() + feature.slice(1)}`];
            checkbox.addEventListener('change', (e) => {
                setAvatarFeature(feature, e.target.checked);
            });
        }
    }
    
    // Position Y Slider
    const posYSlider = document.getElementById('avatarPositionY');
    if (posYSlider) {
        posYSlider.value = avatarState.position.y;
        posYSlider.addEventListener('input', (e) => {
            const y = parseFloat(e.target.value);
            setAvatarPosition(avatarState.position.x, y, avatarState.position.z);
            const display = document.getElementById('avatarPositionYValue');
            if (display) display.textContent = y.toFixed(1);
        });
    }
    
    updateAvatarStatus('disabled');
    console.log('[Avatar] UI initialized');
}

// ============================================
// EXPORTS
// ============================================

export { CHARACTER_PRESETS };
