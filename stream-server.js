// Stream Server - WebSocket + MJPEG Video-Stream für OBS
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

let server = null;
let wss = null;
let clients = new Set();
let mjpegClients = new Set();
let isRunning = false;
let currentPort = 9876;
let frameCount = 0;
let lastFrameBuffer = null;

// Server starten
function startServer(port = 9876) {
    if (isRunning) {
        return { success: false, error: 'Server läuft bereits', port: currentPort };
    }
    
    currentPort = port;
    
    const app = express();
    
    // Stream-Client HTML ausliefern
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'stream-client.html'));
    });
    
    // ============================================
    // MJPEG STREAM - Für OBS Media Source
    // ============================================
    app.get('/stream', (req, res) => {
        console.log('MJPEG Client verbunden:', req.socket.remoteAddress);
        
        // MJPEG Multipart Header
        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        // Client zur Liste hinzufügen
        mjpegClients.add(res);
        
        // Cleanup bei Disconnect
        req.on('close', () => {
            console.log('MJPEG Client getrennt');
            mjpegClients.delete(res);
        });
        
        req.on('error', () => {
            mjpegClients.delete(res);
        });
        
        // Initiales Frame senden falls vorhanden
        if (lastFrameBuffer) {
            sendMjpegFrame(res, lastFrameBuffer);
        }
    });
    
    // Einzelbild (Snapshot)
    app.get('/snapshot', (req, res) => {
        if (lastFrameBuffer) {
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': lastFrameBuffer.length,
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(lastFrameBuffer);
        } else {
            res.status(503).send('No frame available');
        }
    });
    
    // Status-Endpoint
    app.get('/status', (req, res) => {
        res.json({
            running: isRunning,
            clients: clients.size,
            mjpegClients: mjpegClients.size,
            frames: frameCount,
            urls: {
                websocket: `ws://localhost:${currentPort}`,
                mjpeg: `http://localhost:${currentPort}/stream`,
                snapshot: `http://localhost:${currentPort}/snapshot`,
                viewer: `http://localhost:${currentPort}/`
            }
        });
    });
    
    // Info-Seite für OBS Setup
    app.get('/obs', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Synästhesie - OBS Setup</title>
    <style>
        body { 
            font-family: system-ui, sans-serif; 
            background: #1a1a2e; 
            color: #fff; 
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 { color: #4af; }
        h2 { color: #4f4; margin-top: 30px; }
        .url-box {
            background: #2a2a4e;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 16px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .url-box button {
            background: #4af;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            color: #000;
            font-weight: bold;
        }
        .url-box button:hover { background: #6cf; }
        .status { 
            padding: 10px 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .status.active { background: rgba(68,255,68,0.2); border: 1px solid #4f4; }
        .status.inactive { background: rgba(255,68,68,0.2); border: 1px solid #f44; }
        ol li { margin: 10px 0; line-height: 1.6; }
        code { 
            background: #333; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-family: monospace;
        }
        .preview {
            margin: 20px 0;
            text-align: center;
        }
        .preview img {
            max-width: 100%;
            border-radius: 8px;
            border: 2px solid #333;
        }
    </style>
</head>
<body>
    <h1>🎨 Synästhesie Stream</h1>
    
    <div class="status active">
        ✅ Stream Server läuft auf Port ${currentPort}
    </div>
    
    <h2>📺 Für OBS Studio</h2>
    <p>Verwende eine dieser URLs als <strong>Media Source</strong> oder <strong>VLC Video Source</strong>:</p>
    
    <div class="url-box">
        <span>http://localhost:${currentPort}/stream</span>
        <button onclick="copyUrl('http://localhost:${currentPort}/stream')">📋 Kopieren</button>
    </div>
    
    <h3>OBS Setup:</h3>
    <ol>
        <li>In OBS: <strong>Quellen → + → Medienquelle</strong></li>
        <li>Haken bei <code>Lokale Datei</code> <strong>entfernen</strong></li>
        <li>Bei "Eingabe" die URL einfügen: <code>http://localhost:${currentPort}/stream</code></li>
        <li>Optional: "Eingabeformat" auf <code>mjpeg</code> setzen</li>
        <li>Auf OK klicken - fertig!</li>
    </ol>
    
    <h2>🖼️ Einzelbild (Snapshot)</h2>
    <div class="url-box">
        <span>http://localhost:${currentPort}/snapshot</span>
        <button onclick="copyUrl('http://localhost:${currentPort}/snapshot')">📋 Kopieren</button>
    </div>
    
    <h2>🌐 Browser Source</h2>
    <div class="url-box">
        <span>http://localhost:${currentPort}/</span>
        <button onclick="copyUrl('http://localhost:${currentPort}/')">📋 Kopieren</button>
    </div>
    
    <h2>📡 Live Preview</h2>
    <div class="preview">
        <img src="/snapshot" id="preview" onerror="this.style.display='none'">
        <p style="color:#888; font-size:12px;">Wird alle 2 Sekunden aktualisiert</p>
    </div>
    
    <script>
        function copyUrl(url) {
            navigator.clipboard.writeText(url);
            event.target.textContent = '✅ Kopiert!';
            setTimeout(() => event.target.textContent = '📋 Kopieren', 1500);
        }
        
        // Preview aktualisieren
        setInterval(() => {
            const img = document.getElementById('preview');
            img.src = '/snapshot?' + Date.now();
        }, 2000);
    </script>
</body>
</html>
        `);
    });
    
    server = http.createServer(app);
    
    // WebSocket Server (für Browser-Clients)
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws, req) => {
        console.log('WebSocket Client verbunden:', req.socket.remoteAddress);
        clients.add(ws);
        
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        
        ws.on('close', () => {
            console.log('WebSocket Client getrennt');
            clients.delete(ws);
        });
        
        ws.on('error', (err) => {
            console.error('WebSocket Fehler:', err.message);
            clients.delete(ws);
        });
    });
    
    // Heartbeat
    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                clients.delete(ws);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    
    wss.on('close', () => {
        clearInterval(heartbeat);
    });
    
    server.listen(port, '0.0.0.0', () => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎨 Synästhesie Stream Server gestartet!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📺 MJPEG Stream: http://localhost:${port}/stream`);
        console.log(`🖼️ Snapshot:     http://localhost:${port}/snapshot`);
        console.log(`🌐 Browser:      http://localhost:${port}/`);
        console.log(`📖 OBS Setup:    http://localhost:${port}/obs`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        isRunning = true;
    });
    
    server.on('error', (err) => {
        console.error('Server Fehler:', err);
        isRunning = false;
    });
    
    return { 
        success: true, 
        port: currentPort, 
        url: `http://localhost:${port}`,
        mjpegUrl: `http://localhost:${port}/stream`,
        obsSetup: `http://localhost:${port}/obs`
    };
}

// Server stoppen
function stopServer() {
    if (!isRunning) {
        return { success: false, error: 'Server läuft nicht' };
    }
    
    // WebSocket Clients schließen
    clients.forEach(client => {
        try { client.close(); } catch (e) {}
    });
    clients.clear();
    
    // MJPEG Clients schließen
    mjpegClients.forEach(client => {
        try { client.end(); } catch (e) {}
    });
    mjpegClients.clear();
    
    if (wss) {
        wss.close();
        wss = null;
    }
    
    if (server) {
        server.close();
        server = null;
    }
    
    isRunning = false;
    frameCount = 0;
    lastFrameBuffer = null;
    
    console.log('Stream Server gestoppt');
    return { success: true };
}

// MJPEG Frame an einzelnen Client senden
function sendMjpegFrame(res, jpegBuffer) {
    try {
        res.write('--frame\r\n');
        res.write('Content-Type: image/jpeg\r\n');
        res.write(`Content-Length: ${jpegBuffer.length}\r\n`);
        res.write('\r\n');
        res.write(jpegBuffer);
        res.write('\r\n');
    } catch (e) {
        // Client wahrscheinlich disconnected
    }
}

// Frame an alle Clients senden (als Data-URL String)
function sendFrame(dataUrl) {
    if (!isRunning) return false;
    
    frameCount++;
    
    // Data URL zu Buffer konvertieren für MJPEG
    if (dataUrl && dataUrl.startsWith('data:image/jpeg;base64,')) {
        const base64Data = dataUrl.replace('data:image/jpeg;base64,', '');
        lastFrameBuffer = Buffer.from(base64Data, 'base64');
        
        // An MJPEG Clients senden
        mjpegClients.forEach(client => {
            sendMjpegFrame(client, lastFrameBuffer);
        });
    }
    
    // An WebSocket Clients senden
    let sent = 0;
    clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            try {
                client.send(dataUrl);
                sent++;
            } catch (e) {
                console.error('Frame senden fehlgeschlagen:', e.message);
            }
        }
    });
    
    return sent > 0 || mjpegClients.size > 0;
}

// Status abfragen
function getStatus() {
    return {
        running: isRunning,
        port: currentPort,
        url: isRunning ? `http://localhost:${currentPort}` : null,
        mjpegUrl: isRunning ? `http://localhost:${currentPort}/stream` : null,
        clients: clients.size,
        mjpegClients: mjpegClients.size,
        totalClients: clients.size + mjpegClients.size,
        frames: frameCount
    };
}

module.exports = {
    startServer,
    stopServer,
    sendFrame,
    getStatus
};
