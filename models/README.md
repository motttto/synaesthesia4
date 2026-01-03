# YAMNet Model für Instrument Detection

## Automatischer Download

```bash
cd /Users/mo/Documents/Claude_Files/synaesthesia_4
node download-yamnet.js
```

## Manueller Download

Falls der automatische Download fehlschlägt:

1. **Google Storage** (direkt):
   - https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/model.json
   - https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/group1-shard1of1.bin

2. **Kaggle** (Backup):
   - https://www.kaggle.com/models/google/yamnet/tfJs/tfjs/1
   - Download und entpacken nach `models/yamnet/`

## Erwartete Dateistruktur

```
synaesthesia_4/
└── models/
    └── yamnet/
        ├── model.json           (~15 KB)
        ├── group1-shard1of1.bin (~3.5 MB)
        └── yamnet_class_map.csv (optional, ~20 KB)
```

## Fallback

Falls das YAMNet-Modell nicht geladen werden kann, verwendet die App automatisch eine **frequenzbasierte Analyse**. Diese ist weniger präzise aber funktioniert offline ohne ML-Modell.

## Status in der App

- ✅ **"YAMNet bereit"** - YAMNet Modell geladen
- ✅ **"Audio-Analyse bereit (Frequenz)"** - Frequenz-basierte Fallback
- ⚠️ **"Nur Frequenz-Analyse"** - YAMNet fehlgeschlagen, Fallback aktiv
