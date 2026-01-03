/**
 * SKELETON TRACKER
 * 
 * Pose Estimation für Kamera-Input
 * - Body Tracking (MediaPipe Pose, MoveNet)
 * - Face Tracking (MediaPipe Face Mesh)
 * - Hand Tracking (MediaPipe Hands)
 * - 3D Model Mapping auf Landmarks
 */

// ============================================
// STATE
// ============================================

export const skeletonState = {
    // Aktive Modelle (können mehrere gleichzeitig sein)
    activeModels: new Set(),  // 'mediapipe', 'movenet-lightning', 'movenet-thunder', 'face', 'hands', 'objects'
    loading: new Set(),
    ready: new Set(),
    
    // Detection Results pro Modell
    results: {
        'mediapipe': { landmarks: null, worldLandmarks: null },
        'movenet-lightning': { landmarks: null },
        'movenet-thunder': { landmarks: null },
        'face': { landmarks: null, faceCount: 0 },
        'hands': { left: null, right: null, handCount: 0 },
        'objects': { detections: [], objectCount: 0 }  // NEU: Object Detection
    },
    
    // Visualization Settings pro Modell
    modelStyles: {
        'mediapipe': {
            color: '#00ff00',
            pointColor: '#00ff00',
            lineWidth: 3,
            pointRadius: 5
        },
        'movenet-lightning': {
            color: '#ff00ff',
            pointColor: '#ff00ff',
            lineWidth: 3,
            pointRadius: 5
        },
        'movenet-thunder': {
            color: '#00ffff',
            pointColor: '#00ffff',
            lineWidth: 3,
            pointRadius: 5
        },
        'face': {
            color: '#ffff00',
            pointColor: '#ffff00',
            lineWidth: 1,
            pointRadius: 2
        },
        'hands': {
            color: '#ff8800',
            pointColor: '#ff8800',
            lineWidth: 2,
            pointRadius: 4
        },
        'objects': {
            color: '#ff0066',
            pointColor: '#ff0066',
            lineWidth: 2,
            pointRadius: 4
        }
    },
    
    // Global Settings
    showSkeleton: true,
    showPoints: true,
    showLabels: false,
    opacity: 1.0,
    
    // 3D Model Mapping
    modelMapping: {
        enabled: false,
        target: 'none',  // 'none', 'nose', 'left_hand', 'right_hand', 'between_hands', 'face_center'
        smoothing: 0.3,
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
    },
    
    // Smoothed position for mapping
    smoothedPosition: { x: 0.5, y: 0.5, z: 0 },
    
    // Performance
    fps: {}
};

// Detector instances
let mediapipePose = null;
let mediapipeFace = null;
let mediapipeHands = null;
let mediapipeObjects = null;  // NEU: Object Detection
let movenetLightning = null;
let movenetThunder = null;

// ============================================
// CONNECTIONS
// ============================================

// MediaPipe Pose Connections (33 Landmarks)
const POSE_CONNECTIONS_MEDIAPIPE = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [15, 17], [15, 19], [15, 21], [17, 19],
    [16, 18], [16, 20], [16, 22], [18, 20],
    [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]
];

// MoveNet Connections (17 Keypoints)
const POSE_CONNECTIONS_MOVENET = [
    [0, 1], [0, 2], [1, 3], [2, 4],
    [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 11], [6, 12], [11, 12],
    [11, 13], [13, 15], [12, 14], [14, 16]
];

// Hand Connections (21 Landmarks pro Hand)
const HAND_CONNECTIONS = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm
    [5, 9], [9, 13], [13, 17]
];

// Face Mesh - nur Kontur für Performance (nicht alle 468 Verbindungen)
const FACE_CONNECTIONS_SIMPLE = [
    // Gesichtskontur
    [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
    [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
    [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
    [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
    [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
    [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
    // Augen
    [33, 133], [133, 173], [173, 157], [157, 158], [158, 159], [159, 160], [160, 161], [161, 246], [246, 33],
    [263, 362], [362, 398], [398, 384], [384, 385], [385, 386], [386, 387], [387, 388], [388, 466], [466, 263],
    // Lippen
    [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291], [291, 61]
];

// Landmark Namen
const LANDMARK_NAMES_MEDIAPIPE = [
    'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
    'right_eye_inner', 'right_eye', 'right_eye_outer',
    'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
    'left_index', 'right_index', 'left_thumb', 'right_thumb',
    'left_hip', 'right_hip', 'left_knee', 'right_knee',
    'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index'
];

const LANDMARK_NAMES_MOVENET = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

const HAND_LANDMARK_NAMES = [
    'wrist',
    'thumb_cmc', 'thumb_mcp', 'thumb_ip', 'thumb_tip',
    'index_mcp', 'index_pip', 'index_dip', 'index_tip',
    'middle_mcp', 'middle_pip', 'middle_dip', 'middle_tip',
    'ring_mcp', 'ring_pip', 'ring_dip', 'ring_tip',
    'pinky_mcp', 'pinky_pip', 'pinky_dip', 'pinky_tip'
];

// ============================================
// MODEL LOADING
// ============================================

export async function loadSkeletonModel(modelName) {
    if (skeletonState.loading.has(modelName)) return;
    if (skeletonState.ready.has(modelName)) return;
    
    skeletonState.loading.add(modelName);
    updateModelStatus(modelName, 'loading');
    
    try {
        if (modelName === 'mediapipe') {
            await loadMediaPipePose();
        } else if (modelName === 'movenet-lightning') {
            await loadMoveNet('lightning');
        } else if (modelName === 'movenet-thunder') {
            await loadMoveNet('thunder');
        } else if (modelName === 'face') {
            await loadMediaPipeFace();
        } else if (modelName === 'hands') {
            await loadMediaPipeHands();
        } else if (modelName === 'objects') {
            await loadMediaPipeObjects();
        }
        
        skeletonState.ready.add(modelName);
        skeletonState.activeModels.add(modelName);
        updateModelStatus(modelName, 'ready');
        console.log(`Skeleton model loaded: ${modelName}`);
        
    } catch (err) {
        console.error(`Failed to load skeleton model ${modelName}:`, err);
        updateModelStatus(modelName, 'error', err.message);
    }
    
    skeletonState.loading.delete(modelName);
}

export async function unloadSkeletonModel(modelName) {
    try {
        if (modelName === 'mediapipe' && mediapipePose) {
            mediapipePose.close();
            mediapipePose = null;
        } else if (modelName === 'movenet-lightning' && movenetLightning) {
            movenetLightning.dispose();
            movenetLightning = null;
        } else if (modelName === 'movenet-thunder' && movenetThunder) {
            movenetThunder.dispose();
            movenetThunder = null;
        } else if (modelName === 'face' && mediapipeFace) {
            mediapipeFace.close();
            mediapipeFace = null;
        } else if (modelName === 'hands' && mediapipeHands) {
            mediapipeHands.close();
            mediapipeHands = null;
        } else if (modelName === 'objects' && mediapipeObjects) {
            // COCO-SSD uses dispose(), not close()
            if (mediapipeObjects.dispose) {
                mediapipeObjects.dispose();
            }
            mediapipeObjects = null;
        }
    } catch (err) {
        console.warn(`Error unloading model ${modelName}:`, err);
    }
    
    skeletonState.ready.delete(modelName);
    skeletonState.activeModels.delete(modelName);
    skeletonState.results[modelName] = { landmarks: null };
    updateModelStatus(modelName, 'disabled');
}

export async function toggleSkeletonModel(modelName, enabled) {
    if (enabled) {
        await loadSkeletonModel(modelName);
    } else {
        await unloadSkeletonModel(modelName);
    }
}

// ============================================
// MEDIAPIPE LOADERS
// ============================================

async function loadMediaPipePose() {
    if (typeof Pose === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    }
    
    mediapipePose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    
    mediapipePose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    mediapipePose.onResults(onPoseResults);
    await mediapipePose.initialize();
}

async function loadMediaPipeFace() {
    if (typeof FaceMesh === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    }
    
    mediapipeFace = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    
    mediapipeFace.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    mediapipeFace.onResults(onFaceResults);
    await mediapipeFace.initialize();
}

async function loadMediaPipeHands() {
    if (typeof Hands === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
    }
    
    mediapipeHands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    
    mediapipeHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    mediapipeHands.onResults(onHandsResults);
    await mediapipeHands.initialize();
}

// NEU: Object Detection Loader
async function loadMediaPipeObjects() {
    // MediaPipe Object Detection via TensorFlow.js
    if (typeof tf === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
    }
    if (typeof cocoSsd === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
    }
    
    mediapipeObjects = await cocoSsd.load();
    console.log('📦 COCO-SSD Object Detection loaded');
}

async function loadMoveNet(variant) {
    if (typeof tf === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
    }
    if (typeof poseDetection === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
    }
    
    const modelType = variant === 'thunder' 
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
    
    const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType }
    );
    
    if (variant === 'thunder') {
        movenetThunder = detector;
    } else {
        movenetLightning = detector;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// RESULT CALLBACKS
// ============================================

function onPoseResults(results) {
    if (results.poseLandmarks) {
        skeletonState.results['mediapipe'].landmarks = results.poseLandmarks;
        skeletonState.results['mediapipe'].worldLandmarks = results.poseWorldLandmarks || null;
    } else {
        skeletonState.results['mediapipe'].landmarks = null;
    }
}

function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        skeletonState.results['face'].landmarks = results.multiFaceLandmarks[0];
        skeletonState.results['face'].faceCount = results.multiFaceLandmarks.length;
    } else {
        skeletonState.results['face'].landmarks = null;
        skeletonState.results['face'].faceCount = 0;
    }
}

function onHandsResults(results) {
    skeletonState.results['hands'].left = null;
    skeletonState.results['hands'].right = null;
    skeletonState.results['hands'].handCount = 0;
    
    if (results.multiHandLandmarks && results.multiHandedness) {
        skeletonState.results['hands'].handCount = results.multiHandLandmarks.length;
        
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            // MediaPipe gibt "Left" für rechte Hand (gespiegelt) zurück
            if (handedness === 'Right') {
                skeletonState.results['hands'].left = results.multiHandLandmarks[i];
            } else {
                skeletonState.results['hands'].right = results.multiHandLandmarks[i];
            }
        }
    }
}

// ============================================
// DETECTION
// ============================================

export async function detectAllPoses(videoElement) {
    if (skeletonState.activeModels.size === 0) return;
    if (!videoElement || videoElement.readyState < 2) return;
    
    const promises = [];
    
    for (const modelName of skeletonState.activeModels) {
        if (!skeletonState.ready.has(modelName)) continue;
        promises.push(detectWithModel(modelName, videoElement));
    }
    
    await Promise.all(promises);
    
    // Model Mapping Update
    updateModelMapping();
}

async function detectWithModel(modelName, videoElement) {
    const startTime = performance.now();
    
    try {
        if (modelName === 'mediapipe' && mediapipePose) {
            await mediapipePose.send({ image: videoElement });
        } else if (modelName === 'face' && mediapipeFace) {
            await mediapipeFace.send({ image: videoElement });
        } else if (modelName === 'hands' && mediapipeHands) {
            await mediapipeHands.send({ image: videoElement });
        } else if (modelName === 'movenet-lightning' && movenetLightning) {
            const poses = await movenetLightning.estimatePoses(videoElement);
            if (poses.length > 0) {
                skeletonState.results['movenet-lightning'].landmarks = poses[0].keypoints.map(kp => ({
                    x: kp.x / videoElement.videoWidth,
                    y: kp.y / videoElement.videoHeight,
                    z: 0,
                    visibility: kp.score
                }));
            } else {
                skeletonState.results['movenet-lightning'].landmarks = null;
            }
        } else if (modelName === 'movenet-thunder' && movenetThunder) {
            const poses = await movenetThunder.estimatePoses(videoElement);
            if (poses.length > 0) {
                skeletonState.results['movenet-thunder'].landmarks = poses[0].keypoints.map(kp => ({
                    x: kp.x / videoElement.videoWidth,
                    y: kp.y / videoElement.videoHeight,
                    z: 0,
                    visibility: kp.score
                }));
            } else {
                skeletonState.results['movenet-thunder'].landmarks = null;
            }
        } else if (modelName === 'objects' && mediapipeObjects) {
            // COCO-SSD Object Detection
            const predictions = await mediapipeObjects.detect(videoElement);
            skeletonState.results['objects'].detections = predictions.map(p => ({
                class: p.class,
                score: p.score,
                bbox: {
                    x: p.bbox[0] / videoElement.videoWidth,
                    y: p.bbox[1] / videoElement.videoHeight,
                    width: p.bbox[2] / videoElement.videoWidth,
                    height: p.bbox[3] / videoElement.videoHeight
                }
            }));
            skeletonState.results['objects'].objectCount = predictions.length;
        }
        
        const elapsed = performance.now() - startTime;
        skeletonState.fps[modelName] = Math.round(1000 / elapsed);
        
    } catch (err) {
        console.warn(`Detection error (${modelName}):`, err);
    }
}

// ============================================
// 3D MODEL MAPPING
// ============================================

function updateModelMapping() {
    if (!skeletonState.modelMapping.enabled) return;
    
    const target = skeletonState.modelMapping.target;
    let position = null;
    
    switch (target) {
        case 'nose':
            position = getNosePosition();
            break;
        case 'left_hand':
            position = getHandCenter('left');
            break;
        case 'right_hand':
            position = getHandCenter('right');
            break;
        case 'between_hands':
            position = getBetweenHands();
            break;
        case 'face_center':
            position = getFaceCenter();
            break;
    }
    
    if (position) {
        // Smoothing
        const s = skeletonState.modelMapping.smoothing;
        skeletonState.smoothedPosition.x = skeletonState.smoothedPosition.x * s + position.x * (1 - s);
        skeletonState.smoothedPosition.y = skeletonState.smoothedPosition.y * s + position.y * (1 - s);
        skeletonState.smoothedPosition.z = skeletonState.smoothedPosition.z * s + (position.z || 0) * (1 - s);
    }
}

function getNosePosition() {
    // Versuche zuerst MediaPipe Pose
    const pose = skeletonState.results['mediapipe']?.landmarks;
    if (pose && pose[0]) {
        return { x: pose[0].x, y: pose[0].y, z: pose[0].z || 0 };
    }
    
    // Dann MoveNet
    const movenet = skeletonState.results['movenet-lightning']?.landmarks || 
                    skeletonState.results['movenet-thunder']?.landmarks;
    if (movenet && movenet[0]) {
        return { x: movenet[0].x, y: movenet[0].y, z: 0 };
    }
    
    // Dann Face Mesh (Nasenspitze ist Landmark 1)
    const face = skeletonState.results['face']?.landmarks;
    if (face && face[1]) {
        return { x: face[1].x, y: face[1].y, z: face[1].z || 0 };
    }
    
    return null;
}

function getHandCenter(which) {
    const hand = skeletonState.results['hands']?.[which];
    if (!hand || hand.length === 0) return null;
    
    // Handgelenk (index 0) als Zentrum
    return { x: hand[0].x, y: hand[0].y, z: hand[0].z || 0 };
}

function getBetweenHands() {
    const left = getHandCenter('left');
    const right = getHandCenter('right');
    
    if (left && right) {
        return {
            x: (left.x + right.x) / 2,
            y: (left.y + right.y) / 2,
            z: ((left.z || 0) + (right.z || 0)) / 2
        };
    }
    
    return left || right || null;
}

function getFaceCenter() {
    const face = skeletonState.results['face']?.landmarks;
    if (!face || face.length === 0) return null;
    
    // Mittelpunkt aus mehreren Gesichtspunkten
    // Nasenspitze (1), zwischen den Augen (168), Kinn (152)
    const nose = face[1];
    const forehead = face[10];
    const chin = face[152];
    
    if (nose && forehead && chin) {
        return {
            x: (nose.x + forehead.x + chin.x) / 3,
            y: (nose.y + forehead.y + chin.y) / 3,
            z: ((nose.z || 0) + (forehead.z || 0) + (chin.z || 0)) / 3
        };
    }
    
    return nose ? { x: nose.x, y: nose.y, z: nose.z || 0 } : null;
}

/**
 * Gibt die aktuelle Mapping-Position zurück (für 3D Model Positionierung)
 * Koordinaten sind normalisiert (0-1), müssen in 3D-Koordinaten umgerechnet werden
 */
export function getMappedPosition() {
    if (!skeletonState.modelMapping.enabled) return null;
    
    const offset = skeletonState.modelMapping.offset;
    return {
        x: skeletonState.smoothedPosition.x + offset.x,
        y: skeletonState.smoothedPosition.y + offset.y,
        z: skeletonState.smoothedPosition.z + offset.z,
        scale: skeletonState.modelMapping.scale
    };
}

// ============================================
// VISUALIZATION
// ============================================

export function drawAllSkeletons(ctx, canvasWidth, canvasHeight, mirror = false) {
    if (skeletonState.opacity <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = skeletonState.opacity;
    
    // Body Tracking
    for (const modelName of ['mediapipe', 'movenet-lightning', 'movenet-thunder']) {
        if (!skeletonState.activeModels.has(modelName)) continue;
        const result = skeletonState.results[modelName];
        if (!result || !result.landmarks) continue;
        
        const style = skeletonState.modelStyles[modelName];
        const connections = modelName === 'mediapipe' ? POSE_CONNECTIONS_MEDIAPIPE : POSE_CONNECTIONS_MOVENET;
        drawSkeletonSingle(ctx, canvasWidth, canvasHeight, result.landmarks, connections, style, mirror, modelName);
    }
    
    // Face Tracking
    if (skeletonState.activeModels.has('face')) {
        const face = skeletonState.results['face']?.landmarks;
        if (face) {
            const style = skeletonState.modelStyles['face'];
            drawSkeletonSingle(ctx, canvasWidth, canvasHeight, face, FACE_CONNECTIONS_SIMPLE, style, mirror, 'face');
        }
    }
    
    // Hand Tracking
    if (skeletonState.activeModels.has('hands')) {
        const style = skeletonState.modelStyles['hands'];
        const leftHand = skeletonState.results['hands']?.left;
        const rightHand = skeletonState.results['hands']?.right;
        
        if (leftHand) {
            drawSkeletonSingle(ctx, canvasWidth, canvasHeight, leftHand, HAND_CONNECTIONS, style, mirror, 'L');
        }
        if (rightHand) {
            drawSkeletonSingle(ctx, canvasWidth, canvasHeight, rightHand, HAND_CONNECTIONS, style, mirror, 'R');
        }
    }
    
    // Object Detection
    if (skeletonState.activeModels.has('objects')) {
        const detections = skeletonState.results['objects']?.detections || [];
        const style = skeletonState.modelStyles['objects'];
        drawObjectDetections(ctx, canvasWidth, canvasHeight, detections, style, mirror);
    }
    
    // Mapping Target Visualisierung
    if (skeletonState.modelMapping.enabled && skeletonState.modelMapping.target !== 'none') {
        drawMappingTarget(ctx, canvasWidth, canvasHeight, mirror);
    }
    
    ctx.restore();
}

// NEU: Object Detection Bounding Boxes zeichnen
function drawObjectDetections(ctx, canvasWidth, canvasHeight, detections, style, mirror) {
    if (!detections || detections.length === 0) return;
    
    ctx.save();
    
    if (mirror) {
        ctx.translate(canvasWidth, 0);
        ctx.scale(-1, 1);
    }
    
    for (const det of detections) {
        const x = det.bbox.x * canvasWidth;
        const y = det.bbox.y * canvasHeight;
        const w = det.bbox.width * canvasWidth;
        const h = det.bbox.height * canvasHeight;
        
        // Bounding Box
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.strokeRect(x, y, w, h);
        
        // Label Background
        const label = `${det.class} ${Math.round(det.score * 100)}%`;
        ctx.font = '14px monospace';
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillStyle = style.color;
        ctx.fillRect(x, y - 20, textWidth + 8, 20);
        
        // Label Text
        ctx.fillStyle = '#000';
        ctx.fillText(label, x + 4, y - 5);
    }
    
    ctx.restore();
}

function drawSkeletonSingle(ctx, canvasWidth, canvasHeight, landmarks, connections, style, mirror, label) {
    if (!landmarks || landmarks.length === 0) return;
    
    ctx.save();
    
    if (mirror) {
        ctx.translate(canvasWidth, 0);
        ctx.scale(-1, 1);
    }
    
    // Verbindungen
    if (skeletonState.showSkeleton) {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.lineCap = 'round';
        
        for (const [startIdx, endIdx] of connections) {
            if (startIdx >= landmarks.length || endIdx >= landmarks.length) continue;
            
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];
            
            if ((start.visibility || 1) < 0.5 || (end.visibility || 1) < 0.5) continue;
            
            ctx.beginPath();
            ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
            ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);
            ctx.stroke();
        }
    }
    
    // Punkte
    if (skeletonState.showPoints) {
        ctx.fillStyle = style.pointColor;
        
        for (const landmark of landmarks) {
            if ((landmark.visibility || 1) < 0.5) continue;
            
            ctx.beginPath();
            ctx.arc(
                landmark.x * canvasWidth,
                landmark.y * canvasHeight,
                style.pointRadius,
                0,
                2 * Math.PI
            );
            ctx.fill();
        }
    }
    
    // Label
    if (skeletonState.showLabels && landmarks[0]) {
        ctx.restore();
        ctx.save();
        
        const x = mirror ? canvasWidth - landmarks[0].x * canvasWidth : landmarks[0].x * canvasWidth;
        const y = landmarks[0].y * canvasHeight - 20;
        
        ctx.font = '12px monospace';
        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y);
    }
    
    ctx.restore();
}

function drawMappingTarget(ctx, canvasWidth, canvasHeight, mirror) {
    const pos = skeletonState.smoothedPosition;
    
    let x = pos.x * canvasWidth;
    let y = pos.y * canvasHeight;
    
    if (mirror) {
        x = canvasWidth - x;
    }
    
    // Fadenkreuz
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const size = 30;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
    
    // Kreis
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('3D MODEL', x, y + 35);
}

// ============================================
// GETTERS
// ============================================

export function getLandmarks(modelName = 'mediapipe') {
    return skeletonState.results[modelName]?.landmarks || null;
}

export function getLandmark(name, modelName = 'mediapipe') {
    const landmarks = skeletonState.results[modelName]?.landmarks;
    if (!landmarks) return null;
    
    const names = modelName === 'mediapipe' ? LANDMARK_NAMES_MEDIAPIPE : 
                  modelName.startsWith('movenet') ? LANDMARK_NAMES_MOVENET :
                  modelName === 'hands' ? HAND_LANDMARK_NAMES : [];
    
    const index = names.indexOf(name);
    if (index === -1 || index >= landmarks.length) return null;
    return landmarks[index];
}

export function getAllLandmarks(modelName = 'mediapipe') {
    const landmarks = skeletonState.results[modelName]?.landmarks;
    if (!landmarks) return null;
    
    const names = modelName === 'mediapipe' ? LANDMARK_NAMES_MEDIAPIPE : 
                  modelName.startsWith('movenet') ? LANDMARK_NAMES_MOVENET : [];
    
    const result = {};
    names.forEach((name, index) => {
        if (index < landmarks.length) {
            result[name] = landmarks[index];
        }
    });
    return result;
}

export function getActiveModels() {
    return Array.from(skeletonState.activeModels);
}

export function getHandLandmarks(which = 'left') {
    return skeletonState.results['hands']?.[which] || null;
}

export function getFaceLandmarks() {
    return skeletonState.results['face']?.landmarks || null;
}

// NEU: Object Detection Getter
export function getObjectDetections() {
    return skeletonState.results['objects']?.detections || [];
}

export function getDetectedObjects() {
    return skeletonState.results['objects']?.detections?.map(d => d.class) || [];
}

// ============================================
// SETTERS
// ============================================

export function setShowSkeleton(show) {
    skeletonState.showSkeleton = show;
}

export function setShowPoints(show) {
    skeletonState.showPoints = show;
}

export function setShowLabels(show) {
    skeletonState.showLabels = show;
}

export function setSkeletonOpacity(opacity) {
    skeletonState.opacity = Math.max(0, Math.min(1, opacity));
}

export function setModelColor(modelName, color) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].color = color;
        skeletonState.modelStyles[modelName].pointColor = color;
    }
}

export function setModelLineWidth(modelName, width) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].lineWidth = width;
    }
}

export function setModelPointRadius(modelName, radius) {
    if (skeletonState.modelStyles[modelName]) {
        skeletonState.modelStyles[modelName].pointRadius = radius;
    }
}

// Mapping Setters
export function setModelMappingEnabled(enabled) {
    skeletonState.modelMapping.enabled = enabled;
}

export function setModelMappingTarget(target) {
    skeletonState.modelMapping.target = target;
}

export function setModelMappingSmoothing(smoothing) {
    skeletonState.modelMapping.smoothing = Math.max(0, Math.min(0.99, smoothing));
}

export function setModelMappingScale(scale) {
    skeletonState.modelMapping.scale = scale;
}

export function setModelMappingOffset(x, y, z) {
    skeletonState.modelMapping.offset = { x, y, z };
}

// ============================================
// UI
// ============================================

function updateModelStatus(modelName, status, detail = '') {
    const statusEl = document.getElementById(`skeleton-status-${modelName}`);
    if (!statusEl) return;
    
    switch (status) {
        case 'loading':
            statusEl.textContent = '⏳';
            statusEl.title = 'Loading...';
            break;
        case 'ready':
            statusEl.textContent = '✅';
            statusEl.title = 'Ready';
            break;
        case 'disabled':
            statusEl.textContent = '';
            statusEl.title = '';
            break;
        case 'error':
            statusEl.textContent = '❌';
            statusEl.title = detail;
            break;
    }
    
    updateGlobalStatus();
}

function updateGlobalStatus() {
    const statusEl = document.getElementById('skeletonStatus');
    if (!statusEl) return;
    
    const activeCount = skeletonState.activeModels.size;
    const loadingCount = skeletonState.loading.size;
    
    if (loadingCount > 0) {
        statusEl.textContent = `⏳ Loading ${loadingCount} model(s)...`;
        statusEl.style.color = '#ff0';
    } else if (activeCount > 0) {
        const fps = Object.entries(skeletonState.fps)
            .filter(([k]) => skeletonState.activeModels.has(k))
            .map(([k, v]) => `${k.split('-')[0].substring(0,4)}:${v}`)
            .join(' ');
        statusEl.textContent = `✅ ${activeCount} active ${fps ? `(${fps})` : ''}`;
        statusEl.style.color = '#4f4';
    } else {
        statusEl.textContent = '⚫ No models active';
        statusEl.style.color = '#666';
    }
}

export function initSkeletonUI() {
    // Model Checkboxen (Body)
    const bodyModels = ['mediapipe', 'movenet-lightning', 'movenet-thunder'];
    for (const modelName of bodyModels) {
        const checkbox = document.getElementById(`skeleton-${modelName}`);
        if (checkbox) {
            checkbox.addEventListener('change', async (e) => {
                await toggleSkeletonModel(modelName, e.target.checked);
            });
        }
        
        const colorInput = document.getElementById(`skeleton-color-${modelName}`);
        if (colorInput) {
            colorInput.value = skeletonState.modelStyles[modelName].color;
            colorInput.addEventListener('input', (e) => {
                setModelColor(modelName, e.target.value);
            });
        }
    }
    
    // Face Checkbox
    const faceCheckbox = document.getElementById('skeleton-face');
    if (faceCheckbox) {
        faceCheckbox.addEventListener('change', async (e) => {
            await toggleSkeletonModel('face', e.target.checked);
        });
    }
    const faceColor = document.getElementById('skeleton-color-face');
    if (faceColor) {
        faceColor.value = skeletonState.modelStyles['face'].color;
        faceColor.addEventListener('input', (e) => setModelColor('face', e.target.value));
    }
    
    // Hands Checkbox
    const handsCheckbox = document.getElementById('skeleton-hands');
    if (handsCheckbox) {
        handsCheckbox.addEventListener('change', async (e) => {
            await toggleSkeletonModel('hands', e.target.checked);
        });
    }
    const handsColor = document.getElementById('skeleton-color-hands');
    if (handsColor) {
        handsColor.value = skeletonState.modelStyles['hands'].color;
        handsColor.addEventListener('input', (e) => setModelColor('hands', e.target.value));
    }
    
    // Objects Checkbox (NEU)
    const objectsCheckbox = document.getElementById('skeleton-objects');
    if (objectsCheckbox) {
        objectsCheckbox.addEventListener('change', async (e) => {
            await toggleSkeletonModel('objects', e.target.checked);
        });
    }
    const objectsColor = document.getElementById('skeleton-color-objects');
    if (objectsColor) {
        objectsColor.value = skeletonState.modelStyles['objects'].color;
        objectsColor.addEventListener('input', (e) => setModelColor('objects', e.target.value));
    }
    
    // Global Show Skeleton
    const showSkeletonCheckbox = document.getElementById('skeletonShowLines');
    if (showSkeletonCheckbox) {
        showSkeletonCheckbox.checked = skeletonState.showSkeleton;
        showSkeletonCheckbox.addEventListener('change', (e) => setShowSkeleton(e.target.checked));
    }
    
    // Global Show Points
    const showPointsCheckbox = document.getElementById('skeletonShowPoints');
    if (showPointsCheckbox) {
        showPointsCheckbox.checked = skeletonState.showPoints;
        showPointsCheckbox.addEventListener('change', (e) => setShowPoints(e.target.checked));
    }
    
    // Show Labels
    const showLabelsCheckbox = document.getElementById('skeletonShowLabels');
    if (showLabelsCheckbox) {
        showLabelsCheckbox.checked = skeletonState.showLabels;
        showLabelsCheckbox.addEventListener('change', (e) => setShowLabels(e.target.checked));
    }
    
    // Line Width
    const lineWidthSlider = document.getElementById('skeletonLineWidth');
    if (lineWidthSlider) {
        lineWidthSlider.addEventListener('input', (e) => {
            const width = parseInt(e.target.value);
            for (const modelName of Object.keys(skeletonState.modelStyles)) {
                setModelLineWidth(modelName, width);
            }
            const display = document.getElementById('skeletonLineWidthValue');
            if (display) display.textContent = e.target.value + 'px';
        });
    }
    
    // Skeleton Opacity
    const skeletonOpacitySlider = document.getElementById('skeletonOpacity');
    if (skeletonOpacitySlider) {
        skeletonOpacitySlider.value = skeletonState.opacity * 100;
        skeletonOpacitySlider.addEventListener('input', (e) => {
            setSkeletonOpacity(parseInt(e.target.value) / 100);
            const display = document.getElementById('skeletonOpacityValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // Model Mapping
    const mappingCheckbox = document.getElementById('modelMappingEnabled');
    if (mappingCheckbox) {
        mappingCheckbox.addEventListener('change', (e) => {
            setModelMappingEnabled(e.target.checked);
            const controls = document.getElementById('modelMappingControls');
            if (controls) controls.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    const mappingTarget = document.getElementById('modelMappingTarget');
    if (mappingTarget) {
        mappingTarget.addEventListener('change', (e) => setModelMappingTarget(e.target.value));
    }
    
    const mappingSmoothing = document.getElementById('modelMappingSmoothing');
    if (mappingSmoothing) {
        mappingSmoothing.addEventListener('input', (e) => {
            setModelMappingSmoothing(parseInt(e.target.value) / 100);
            const display = document.getElementById('modelMappingSmoothingValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    const mappingScale = document.getElementById('modelMappingScale');
    if (mappingScale) {
        mappingScale.addEventListener('input', (e) => {
            setModelMappingScale(parseInt(e.target.value) / 100);
            const display = document.getElementById('modelMappingScaleValue');
            if (display) display.textContent = e.target.value + '%';
        });
    }
    
    // FPS Update
    setInterval(updateGlobalStatus, 500);
    
    updateGlobalStatus();
    console.log('Skeleton UI initialized (with face, hands, mapping)');
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupSkeleton() {
    for (const modelName of [...skeletonState.activeModels]) {
        await unloadSkeletonModel(modelName);
    }
}

// Legacy exports
export const detectPose = detectAllPoses;
export const drawSkeleton = drawAllSkeletons;
