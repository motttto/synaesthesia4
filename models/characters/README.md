# Character Models

This folder contains rigged 3D character models for the Character Avatar feature.

## Supported Formats

- **GLB** (recommended) - Binary glTF format
- **GLTF** - Standard glTF format

## Requirements

Characters must be:
1. **Rigged with a skeleton** (bones/armature)
2. **Using standard bone naming** (Mixamo naming convention preferred)

## How to Get Characters

### Option 1: Mixamo (Free, Best Option)
1. Go to [mixamo.com](https://www.mixamo.com/)
2. Create a free Adobe account
3. Browse characters (Y-Bot, X-Bot are the defaults)
4. Download as **FBX for Unity** or **GLB**
5. Place the `.glb` file here

### Option 2: Ready Player Me
1. Go to [readyplayer.me](https://readyplayer.me/)
2. Create your avatar
3. Download as GLB
4. Place the `.glb` file here

### Option 3: Sketchfab
1. Search for "rigged character" on [sketchfab.com](https://sketchfab.com/)
2. Filter by downloadable
3. Download as GLB
4. Place the `.glb` file here

## Bone Naming Convention (Mixamo)

The Character Avatar system expects bones named like:
- `mixamorigHips`
- `mixamorigSpine`, `mixamorigSpine1`, `mixamorigSpine2`
- `mixamorigNeck`, `mixamorigHead`
- `mixamorigLeftShoulder`, `mixamorigLeftArm`, `mixamorigLeftForeArm`
- `mixamorigRightShoulder`, `mixamorigRightArm`, `mixamorigRightForeArm`
- `mixamorigLeftUpLeg`, `mixamorigLeftLeg`, `mixamorigLeftFoot`
- `mixamorigRightUpLeg`, `mixamorigRightLeg`, `mixamorigRightFoot`

## Default Characters (Download Links)

Place these in this folder:

1. **ybot.glb** - Mixamo Y-Bot (male)
2. **xbot.glb** - Mixamo X-Bot (female)

## Custom Characters

You can also paste a direct URL to a GLB file in the UI - it will be loaded dynamically.

## Tips

- Characters with T-pose work best
- Keep file sizes reasonable (<50MB)
- Test with simpler characters first
- Use "Debug Skeleton" option to see bone structure
