#!/usr/bin/env node
// Download YAMNet model for local use
// Run with: node download-yamnet.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_DIR = path.join(__dirname, 'models', 'yamnet');
const BASE_URL = 'https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1';

// Files to download
const FILES = [
    'model.json',
    'group1-shard1of1.bin'
];

// Alternative: Kaggle hosted version
const KAGGLE_BASE = 'https://storage.googleapis.com/kagglesdsdata/models/1077/1279/1';
const KAGGLE_FILES = [
    'model.json',
    'group1-shard1of1.bin'
];

// Create directory if it doesn't exist
if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log('Created directory:', MODEL_DIR);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);
        
        const file = fs.createWriteStream(dest);
        
        https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                console.log(`Redirecting to: ${response.headers.location}`);
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize) {
                    const percent = Math.round((downloadedSize / totalSize) * 100);
                    process.stdout.write(`\r  Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`\n  Saved: ${dest}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Delete incomplete file
            reject(err);
        });
    });
}

async function downloadModel() {
    console.log('=== YAMNet Model Downloader ===\n');
    console.log('Target directory:', MODEL_DIR);
    console.log('');
    
    // Try Google Storage first
    console.log('Trying Google Storage...');
    let success = true;
    
    for (const file of FILES) {
        const url = `${BASE_URL}/${file}`;
        const dest = path.join(MODEL_DIR, file);
        
        try {
            await downloadFile(url, dest);
        } catch (err) {
            console.error(`\nFailed to download ${file}:`, err.message);
            success = false;
            break;
        }
    }
    
    if (!success) {
        console.log('\nGoogle Storage failed, trying alternative sources...\n');
        
        // Try alternative: download from a mirror or create placeholder
        console.log('Creating placeholder model info...');
        
        // Create a model info file to indicate download failed
        fs.writeFileSync(
            path.join(MODEL_DIR, 'DOWNLOAD_FAILED.txt'),
            `YAMNet model download failed at ${new Date().toISOString()}\n\n` +
            `Please manually download the model from:\n` +
            `1. https://www.kaggle.com/models/google/yamnet/tfJs/tfjs/1\n` +
            `2. Or use: pip install tensorflow-hub and convert\n\n` +
            `Expected files:\n` +
            `- model.json\n` +
            `- group1-shard1of1.bin (or multiple shards)\n`
        );
        
        console.log('See DOWNLOAD_FAILED.txt for manual download instructions');
        return false;
    }
    
    console.log('\n=== Download Complete ===');
    console.log('Model saved to:', MODEL_DIR);
    
    // Verify files
    console.log('\nVerifying files:');
    for (const file of FILES) {
        const filePath = path.join(MODEL_DIR, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`  ✓ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            console.log(`  ✗ ${file} (missing)`);
        }
    }
    
    return true;
}

// Also download the class map CSV
async function downloadClassMap() {
    const classMapUrl = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';
    const dest = path.join(MODEL_DIR, 'yamnet_class_map.csv');
    
    console.log('\nDownloading class map...');
    
    try {
        await downloadFile(classMapUrl, dest);
        console.log('Class map downloaded successfully');
    } catch (err) {
        console.error('Failed to download class map:', err.message);
    }
}

// Run
downloadModel()
    .then(success => {
        if (success) {
            return downloadClassMap();
        }
    })
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
