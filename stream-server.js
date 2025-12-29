// Stream Server - WebSocket-basierter Video-Stream für OBS
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

let server = null;
let wss = null;
let clients = new Set();
let isRunning = false;
let currentPort = 9876;
let frameCount = 0;

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
    
    // Status-Endpoint
    app.get('/status', (req, res) => {
        res.json({
            running: isRunning,
            clients: clients.size,
            frames: frameCount
        });
    });
    
    server = http.createServer(app);
    
    // WebSocket Server
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws, req) => {
        console.log('Stream Client verbunden:', req.socket.remoteAddress);
        clients.add(ws);
        
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        
        ws.on('close', () => {
            console.log('Stream Client getrennt');
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
        console.log(`Stream Server gestartet auf http://localhost:${port}`);
        isRunning = true;
    });
    
    server.on('error', (err) => {
        console.error('Server Fehler:', err);
        isRunning = false;
    });
    
    return { success: true, port: currentPort, url: `http://localhost:${port}` };
}

// Server stoppen
function stopServer() {
    if (!isRunning) {
        return { success: false, error: 'Server läuft nicht' };
    }
    
    clients.forEach(client => {
        try { client.close(); } catch (e) {}
    });
    clients.clear();
    
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
    
    console.log('Stream Server gestoppt');
    return { success: true };
}

// Frame an alle Clients senden (als Data-URL String)
function sendFrame(dataUrl) {
    if (!isRunning || clients.size === 0) return false;
    
    frameCount++;
    
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
    
    return sent > 0;
}

// Status abfragen
function getStatus() {
    return {
        running: isRunning,
        port: currentPort,
        url: isRunning ? `http://localhost:${currentPort}` : null,
        clients: clients.size,
        frames: frameCount
    };
}

module.exports = {
    startServer,
    stopServer,
    sendFrame,
    getStatus
};
