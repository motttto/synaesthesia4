# AI IMAGE PANEL - VOLLSTÄNDIGE FUNKTIONSPRÜFUNG

## HTML Element IDs → JS Handler Zuordnung

### Display Mode Buttons
| HTML ID / Class | JS Handler | Status |
|-----------------|------------|--------|
| `.ai-mode-btn[data-aimode="off"]` | `setDisplayMode('off')` | ✅ |
| `.ai-mode-btn[data-aimode="on"]` | `setDisplayMode('on')` | ✅ |
| `.ai-mode-btn[data-aimode="overlay"]` | `setDisplayMode('overlay')` | ✅ |

### Provider Tabs
| HTML ID / Class | JS Handler | Status |
|-----------------|------------|--------|
| `.ai-provider-tab[data-provider="local"]` | `setProvider('local')` | ✅ |
| `.ai-provider-tab[data-provider="mix"]` | `setProvider('mix')` | ✅ |
| `.ai-provider-tab[data-provider="settings"]` | `setProvider('settings')` | ✅ |

### Model Selection (Local)
| HTML ID / Class | JS Handler | Status |
|-----------------|------------|--------|
| `.ai-model-tab[data-model="local-sd15"]` | `setModel('local-sd15')` | ✅ |
| `.ai-model-tab[data-model="local-sdxl"]` | `setModel('local-sdxl')` | ✅ |
| `.ai-model-tab[data-model="local-turbo"]` | `setModel('local-turbo')` | ✅ |

### Status Displays
| HTML ID | Verwendung | Status |
|---------|------------|--------|
| `localSdStatus` | ComfyUI Verbindungsstatus | ✅ |
| `aiModelBufferStatus` | Generation Progress | ✅ |
| `aiCurrentInput` | Speech Input Display | ✅ |
| `aiImagePreview` | Generiertes Bild Vorschau | ✅ |

### Buttons
| HTML ID | JS Handler | Status |
|---------|------------|--------|
| `startComfyBtn` | Startet ComfyUI (Electron API) | ✅ |
| `aiGenerateBtn` | `generateImage(prompt)` | ✅ |
| `aiClearPrompt` | Löscht Prompt Input | ✅ |

### Checkboxes
| HTML ID | JS Handler | Status |
|---------|------------|--------|
| `aiAutoGenerate` | `setAutoGenerate(checked)` | ✅ |
| `aiBufferMode` | `setBufferMode(checked)` | ✅ |
| `aiCrossfadeEnabled` | `setCrossfadeEnabled(checked)` | ✅ |

### Text Filter Checkboxes (Speech → AI)
| HTML ID | JS Handler | Status |
|---------|------------|--------|
| `aiFilterNouns` | `setFilterNouns(checked)` | ✅ |
| `aiFilterVerbs` | `setFilterVerbs(checked)` | ✅ |
| `aiFilterAdj` | `setFilterAdj(checked)` | ✅ |

### Input
| HTML ID | JS Handler | Status |
|---------|------------|--------|
| `aiPromptInput` | Enter → `generateImage()` | ✅ |

### Canvas
| HTML ID | Verwendung | Status |
|---------|------------|--------|
| `aiOverlayCanvas` | Overlay Display für AI Bilder | ✅ |

---

## Funktions-Flow

### 1. ComfyUI Verbindung
```
App Start → checkComfyConnection() → Status Update (localSdStatus)
         ↓
startComfyBtn Click → Electron API / Manual Hinweis → checkComfyConnection()
```

### 2. Bild-Generierung (Manuell)
```
Prompt eingeben (aiPromptInput) → Enter / aiGenerateBtn Click
                                       ↓
                              generateImage(prompt)
                                       ↓
                              ComfyUI Workflow erstellen
                                       ↓
                              pollForCompletion()
                                       ↓
                              displayImage() → Preview + Overlay
```

### 3. Bild-Generierung (Auto via Speech)
```
Speech erkannt → setOnSpeechResultCallback() in main.js
                       ↓
              updateAiFromSpeech(rawText, filteredText)
                       ↓
              aiCurrentInput Display aktualisieren
                       ↓
              Auto-Timer (3s) → generateImage() wenn autoGenerate=true
```

### 4. Display Modes
```
displayMode = 'off'     → Keine Anzeige
displayMode = 'on'      → Nur Preview im Panel
displayMode = 'overlay' → Preview + aiOverlayCanvas über 3D-Szene
```

---

## ComfyUI Workflow-Konfiguration

| Model | Checkpoint | Steps | CFG | Sampler |
|-------|------------|-------|-----|---------|
| SD 1.5 | v1-5-pruned-emaonly.safetensors | 20 | 7 | dpmpp_2m |
| SDXL | sd_xl_base_1.0.safetensors | 25 | 7 | dpmpp_2m |
| Turbo | sd_turbo.safetensors | 4 | 1 | euler_ancestral |

---

## Dateien

- **Modul:** `/js/ai/ai-image.js`
- **Import in:** `/js/main.js`
- **HTML:** `/index-modular.html` (Zeilen 330-405)

---

## Bekannte Limitierungen

1. **ComfyUI muss separat laufen** - Electron API `startComfyUI` muss implementiert sein
2. **Checkpoint-Namen hardcoded** - User muss passende Modelle in ComfyUI haben
3. **Mix-Provider** - Placeholder, nicht implementiert
4. **Settings-Tab** - Placeholder, keine UI dahinter

---

## Test-Checkliste

- [ ] ComfyUI Status wird korrekt angezeigt (connected/disconnected)
- [ ] Display Mode Buttons wechseln korrekt
- [ ] Provider Tabs wechseln korrekt  
- [ ] Model Tabs wechseln korrekt
- [ ] Prompt eingeben + Enter → Generation startet (wenn ComfyUI läuft)
- [ ] Generate Button funktioniert
- [ ] Clear Button löscht Input
- [ ] Auto-Generate Checkbox funktioniert
- [ ] Buffer Mode Checkbox funktioniert
- [ ] Crossfade Checkbox funktioniert
- [ ] Filter Checkboxes aktualisieren State
- [ ] Speech Recognition → aiCurrentInput wird aktualisiert
- [ ] Generiertes Bild erscheint in Preview
- [ ] Overlay Mode zeigt Bild über 3D-Szene
