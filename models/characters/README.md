# Character Models for Avatar System

This directory contains rigged 3D character models for the Character Avatar feature.

## Included Models (CC0 - Public Domain)

### male_base_mesh.glb ✅
- **License:** CC0 1.0 Universal (Public Domain)
- **Source:** [orange-juice-games](https://orange-juice-games.itch.io/male-base-mesh) via [GitHub](https://github.com/BoQsc/Godot-3D-Male-Base-Mesh)
- **Description:** Low-poly male base mesh, fully rigged, T-Pose
- **Triangles:** ~4,000
- **Can redistribute:** ✅ Yes - included in repository

## Optional Models (Download Required)

The following models are NOT included due to licensing restrictions. Download them manually if desired:

### Y-Bot / X-Bot (Mixamo)
- **License:** Adobe Mixamo ToS (free for use, NOT for redistribution)
- **Source:** [mixamo.com](https://www.mixamo.com/)
- **Download:** Log in → Characters → Select Y-Bot or X-Bot → Download as FBX → Convert to GLB
- **Save as:** `ybot.glb` or `xbot.glb`

### Ready Player Me Avatar
- **License:** Ready Player Me ToS (personal avatars, NOT for redistribution)
- **Source:** [readyplayer.me](https://readyplayer.me/)
- **Download:** Create avatar → Download GLB
- **Save as:** `rpm-avatar.glb`

## Converting FBX to GLB

If you download FBX models, convert them using Blender:

```bash
# Using Blender CLI
/Applications/Blender.app/Contents/MacOS/Blender --background --python-expr "
import bpy
bpy.ops.import_scene.fbx(filepath='input.fbx')
bpy.ops.export_scene.gltf(filepath='output.glb', export_format='GLB')
"
```

## Bone Naming Conventions

Different model sources use different bone naming:

| Source | Bone Prefix | Example |
|--------|-------------|---------|
| Mixamo | `mixamorig` | `mixamorigHips`, `mixamorigSpine` |
| Generic | (none) | `Hips`, `Spine` |

The avatar system auto-detects bone names when loading models.

## Adding Custom Models

1. Place your `.glb` file in this directory
2. In the app: Select "Custom Model" from dropdown
3. Enter the filename or full path
4. Or use the "Custom GLB URL" field for remote models

## Requirements for Avatar Models

- Must be rigged (have bones/armature)
- Humanoid bone structure recommended
- T-Pose or A-Pose preferred
- GLB/GLTF format (binary GLB preferred)
