const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Statische Dateien servieren
app.use(express.static(__dirname));

// 3D-Modelle mit korrektem MIME-Type
app.use('/3d-models', express.static(path.join(__dirname, '3d-models'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.glb')) {
            res.setHeader('Content-Type', 'model/gltf-binary');
        }
    }
}));

app.listen(PORT, () => {
    console.log(`\n🎹 Synästhesie Web-App läuft auf:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n💡 MIDI funktioniert in Chrome, Edge oder Opera`);
    console.log(`   Strg+C zum Beenden\n`);
});
