// Spectrum Analyzer & Top Bar Controls
// Visualizes the full audio spectrum and syncs top bar controls

export class SpectrumAnalyzer {
    constructor() {
        this.canvas = document.getElementById('spectrumCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.analyser = null;
        this.dataArray = null;
        this.isRunning = false;
        this.animationId = null;
        
        // Colors
        this.gradientColors = [
            { pos: 0, color: '#4f4' },    // Green (low)
            { pos: 0.3, color: '#ff0' },  // Yellow
            { pos: 0.6, color: '#f80' },  // Orange
            { pos: 1, color: '#f44' }     // Red (high)
        ];
        
        this.init();
    }
    
    init() {
        if (!this.canvas) {
            console.warn('Spectrum canvas not found');
            return;
        }
        
        // Setup canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Sync top bar controls with existing controls
        this.setupControlSync();
        
        console.log('📊 Spectrum Analyzer initialized');
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    setAnalyser(analyser) {
        this.analyser = analyser;
        if (analyser) {
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.start();
        }
    }
    
    start() {
        if (this.isRunning || !this.analyser) return;
        this.isRunning = true;
        this.draw();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    draw() {
        if (!this.isRunning || !this.ctx || !this.analyser) return;
        
        this.animationId = requestAnimationFrame(() => this.draw());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, width, height);
        
        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
        this.gradientColors.forEach(c => gradient.addColorStop(c.pos, c.color));
        
        // Draw bars - use full buffer for better resolution
        const bufferLength = this.dataArray.length;
        const barCount = Math.min(256, bufferLength);
        const barWidth = width / barCount;
        const gap = 0.5;
        
        for (let i = 0; i < barCount; i++) {
            // Linear mapping for now (covers ~0-22kHz depending on sample rate)
            const index = Math.floor((i / barCount) * bufferLength * 0.8);
            const value = this.dataArray[index] / 255;
            const barHeight = value * height * 0.95;
            
            const x = i * barWidth;
            
            // Bar with gradient
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x + gap/2, height - barHeight, barWidth - gap, barHeight);
        }
    }
    
    setupControlSync() {
        // === Master Gain Sync ===
        const masterGainTop = document.getElementById('masterGainTop');
        const masterGain = document.getElementById('masterGain');
        const gainValueTop = document.getElementById('gainValueTop');
        const gainValue = document.getElementById('gainValue');
        const levelMeterTop = document.getElementById('levelMeterTop');
        const levelMeter = document.getElementById('levelMeter');
        
        if (masterGainTop && masterGain) {
            // Sync top -> right
            masterGainTop.addEventListener('input', () => {
                masterGain.value = masterGainTop.value;
                masterGain.dispatchEvent(new Event('input'));
                if (gainValueTop) gainValueTop.textContent = `${masterGainTop.value} dB`;
            });
            
            // Sync right -> top
            masterGain.addEventListener('input', () => {
                masterGainTop.value = masterGain.value;
                if (gainValueTop) gainValueTop.textContent = `${masterGain.value} dB`;
            });
            
            // Sync level meters via interval (faster than MutationObserver for style changes)
            if (levelMeterTop && levelMeter) {
                setInterval(() => {
                    levelMeterTop.style.width = levelMeter.style.width;
                }, 50);
            }
        }
        
        // === EQ Sync ===
        const eqPairs = [
            { top: 'eqLowTop', side: 'eqLow' },
            { top: 'eqMidTop', side: 'eqMid' },
            { top: 'eqHighTop', side: 'eqHigh' }
        ];
        
        eqPairs.forEach(pair => {
            const topEl = document.getElementById(pair.top);
            const sideEl = document.getElementById(pair.side);
            
            if (topEl && sideEl) {
                topEl.addEventListener('input', () => {
                    sideEl.value = topEl.value;
                    sideEl.dispatchEvent(new Event('input'));
                });
                
                sideEl.addEventListener('input', () => {
                    topEl.value = sideEl.value;
                });
            }
        });
        
        // EQ Reset button
        const eqResetTop = document.getElementById('eqResetTop');
        const eqReset = document.getElementById('eqReset');
        
        if (eqResetTop) {
            eqResetTop.addEventListener('click', () => {
                eqPairs.forEach(pair => {
                    const topEl = document.getElementById(pair.top);
                    const sideEl = document.getElementById(pair.side);
                    if (topEl) topEl.value = 0;
                    if (sideEl) {
                        sideEl.value = 0;
                        sideEl.dispatchEvent(new Event('input'));
                    }
                });
            });
        }
        
        // === Beat Sync ===
        const beatPairs = [
            { top: 'beatFlashTop', side: 'beatFlashEnabled' },
            { top: 'beatPulseTop', side: 'beatPulseEnabled' },
            { top: 'beatRotateTop', side: 'beatRotationEnabled' }
        ];
        
        beatPairs.forEach(pair => {
            const topEl = document.getElementById(pair.top);
            const sideEl = document.getElementById(pair.side);
            
            if (topEl && sideEl) {
                // Initial sync
                topEl.checked = sideEl.checked;
                
                topEl.addEventListener('change', () => {
                    sideEl.checked = topEl.checked;
                    sideEl.dispatchEvent(new Event('change'));
                });
                
                sideEl.addEventListener('change', () => {
                    topEl.checked = sideEl.checked;
                });
            }
        });
        
        // BPM and beat indicator sync
        const bpmValueTop = document.getElementById('bpmValueTop');
        const bpmValue = document.getElementById('bpmValue');
        const beatIndicatorTop = document.getElementById('beatIndicatorTop');
        const beatIndicator = document.getElementById('beatIndicator');
        
        // Sync BPM and beat indicator via interval
        if (bpmValueTop && bpmValue && beatIndicatorTop && beatIndicator) {
            setInterval(() => {
                // Sync BPM text
                if (bpmValueTop.textContent !== bpmValue.textContent) {
                    bpmValueTop.textContent = bpmValue.textContent;
                }
                // Sync beat flash class
                if (beatIndicator.classList.contains('flash')) {
                    beatIndicatorTop.classList.add('flash');
                } else {
                    beatIndicatorTop.classList.remove('flash');
                }
            }, 16); // ~60fps
        }
    }
}

// Export singleton
export const spectrumAnalyzer = new SpectrumAnalyzer();
