/**
 * DMX FIXTURE LIBRARY
 * 
 * Umfassende Sammlung von DMX Fixture-Definitionen
 * - Kategorisiert nach Typ
 * - Herstellerspezifische Profile
 * - Mehrere Modi pro Fixture
 */

// ============================================
// FIXTURE LIBRARY
// ============================================

export const fixtureLibrary = {
    
    // ========================================
    // LED PAR / WASH
    // ========================================
    'par': {
        name: 'LED Par / Wash',
        fixtures: {
            // Generic
            'generic-rgb-3ch': {
                manufacturer: 'Generic',
                name: 'RGB Par 3ch',
                type: 'par',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    }
                }
            },
            'generic-rgbw-4ch': {
                manufacturer: 'Generic',
                name: 'RGBW Par 4ch',
                type: 'par',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, w: 4 }
                    }
                }
            },
            'generic-rgbw-8ch': {
                manufacturer: 'Generic',
                name: 'RGBW Par 8ch',
                type: 'par',
                modes: {
                    '8ch': {
                        channels: 8,
                        mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5, strobe: 6, mode: 7, speed: 8 }
                    }
                }
            },
            'generic-rgba-5ch': {
                manufacturer: 'Generic',
                name: 'RGBA Par 5ch',
                type: 'par',
                modes: {
                    '5ch': {
                        channels: 5,
                        mapping: { r: 1, g: 2, b: 3, a: 4, dimmer: 5 }
                    }
                }
            },
            'generic-rgbwa-6ch': {
                manufacturer: 'Generic',
                name: 'RGBWA Par 6ch',
                type: 'par',
                modes: {
                    '6ch': {
                        channels: 6,
                        mapping: { r: 1, g: 2, b: 3, w: 4, a: 5, dimmer: 6 }
                    }
                }
            },
            'generic-rgbwauv-7ch': {
                manufacturer: 'Generic',
                name: 'RGBWA+UV Par 7ch',
                type: 'par',
                modes: {
                    '7ch': {
                        channels: 7,
                        mapping: { r: 1, g: 2, b: 3, w: 4, a: 5, uv: 6, dimmer: 7 }
                    }
                }
            },
            
            // Stairville
            'stairville-led-par-56': {
                manufacturer: 'Stairville',
                name: 'LED PAR 56 10mm RGB',
                type: 'par',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, macro: 4 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { r: 1, g: 2, b: 3, macro: 4, strobe: 5, mode: 6, dimmer: 7 }
                    }
                }
            },
            'stairville-led-par-64-rgbw': {
                manufacturer: 'Stairville',
                name: 'LED PAR 64 CX-6 RGBW',
                type: 'par',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, w: 4 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5, strobe: 6 }
                    },
                    '9ch': {
                        channels: 9,
                        mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5, strobe: 6, macro: 7, speed: 8, sound: 9 }
                    }
                }
            },
            
            // Eurolite
            'eurolite-led-par-56-rgb': {
                manufacturer: 'Eurolite',
                name: 'LED PAR-56 RGB',
                type: 'par',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '5ch': {
                        channels: 5,
                        mapping: { r: 1, g: 2, b: 3, dimmer: 4, strobe: 5 }
                    }
                }
            },
            'eurolite-led-sls-183': {
                manufacturer: 'Eurolite',
                name: 'LED SLS-183 RGB',
                type: 'par',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { dimmer: 1, strobe: 2, r: 3, g: 4, b: 5, macro: 6, speed: 7 }
                    }
                }
            },
            
            // Chauvet
            'chauvet-slimpar-64': {
                manufacturer: 'Chauvet',
                name: 'SlimPAR 64 RGBA',
                type: 'par',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, a: 4 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { r: 1, g: 2, b: 3, a: 4, strobe: 5, mode: 6, dimmer: 7 }
                    }
                }
            },
            'chauvet-colorado-1-solo': {
                manufacturer: 'Chauvet',
                name: 'Colorado 1 Solo',
                type: 'par',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, w: 4 }
                    },
                    '8ch': {
                        channels: 8,
                        mapping: { dimmer: 1, r: 2, g: 3, b: 4, w: 5, strobe: 6, zoom: 7, control: 8 }
                    }
                }
            },
            
            // ADJ
            'adj-mega-par-profile': {
                manufacturer: 'ADJ',
                name: 'Mega Par Profile',
                type: 'par',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { r: 1, g: 2, b: 3, macro: 4, strobe: 5, mode: 6 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { r: 1, g: 2, b: 3, macro: 4, strobe: 5, mode: 6, dimmer: 7 }
                    }
                }
            },
            
            // Cameo
            'cameo-flat-par-1-rgbw': {
                manufacturer: 'Cameo',
                name: 'FLAT PAR 1 RGBW',
                type: 'par',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { dimmer: 1, macro: 2 }
                    },
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, w: 4 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { dimmer: 1, strobe: 2, r: 3, g: 4, b: 5, w: 6 }
                    },
                    '9ch': {
                        channels: 9,
                        mapping: { dimmer: 1, strobe: 2, r: 3, g: 4, b: 5, w: 6, macro: 7, sound: 8, speed: 9 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // MOVING HEAD
    // ========================================
    'movinghead': {
        name: 'Moving Head',
        fixtures: {
            // Generic
            'generic-movinghead-9ch': {
                manufacturer: 'Generic',
                name: 'Moving Head 9ch',
                type: 'movinghead',
                modes: {
                    '9ch': {
                        channels: 9,
                        mapping: { pan: 1, tilt: 2, dimmer: 3, r: 4, g: 5, b: 6, strobe: 7, speed: 8, mode: 9 }
                    }
                }
            },
            'generic-movinghead-16ch': {
                manufacturer: 'Generic',
                name: 'Moving Head 16ch',
                type: 'movinghead',
                modes: {
                    '16ch': {
                        channels: 16,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, strobe: 7, 
                            r: 8, g: 9, b: 10, w: 11, 
                            gobo: 12, goboRot: 13, prism: 14, focus: 15, control: 16 
                        }
                    }
                }
            },
            
            // Stairville
            'stairville-mh-x25': {
                manufacturer: 'Stairville',
                name: 'MH-X25 LED Spot',
                type: 'movinghead',
                modes: {
                    '11ch': {
                        channels: 11,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, strobe: 7, 
                            color: 8, gobo: 9, goboRot: 10, focus: 11 
                        }
                    },
                    '14ch': {
                        channels: 14,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, strobe: 7, 
                            color: 8, gobo: 9, goboRot: 10, focus: 11, 
                            prism: 12, prismRot: 13, control: 14 
                        }
                    }
                }
            },
            'stairville-mh-x50plus': {
                manufacturer: 'Stairville',
                name: 'MH-X50+ LED Spot',
                type: 'movinghead',
                modes: {
                    '13ch': {
                        channels: 13,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, strobe: 7, 
                            color: 8, gobo: 9, goboRot: 10, prism: 11, focus: 12, control: 13 
                        }
                    }
                }
            },
            
            // Eurolite
            'eurolite-led-tmh-x4': {
                manufacturer: 'Eurolite',
                name: 'LED TMH-X4 Moving Head Wash',
                type: 'movinghead',
                modes: {
                    '16ch': {
                        channels: 16,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, strobe: 7, 
                            r: 8, g: 9, b: 10, w: 11, 
                            zoom: 12, macro: 13, sound: 14, reset: 15, control: 16 
                        }
                    }
                }
            },
            
            // Chauvet
            'chauvet-intimidator-spot-160': {
                manufacturer: 'Chauvet',
                name: 'Intimidator Spot 160',
                type: 'movinghead',
                modes: {
                    '11ch': {
                        channels: 11,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, color: 6, gobo: 7, 
                            dimmer: 8, shutter: 9, control: 10, movement: 11 
                        }
                    }
                }
            },
            'chauvet-intimidator-wash-zoom-350': {
                manufacturer: 'Chauvet',
                name: 'Intimidator Wash Zoom 350',
                type: 'movinghead',
                modes: {
                    '16ch': {
                        channels: 16,
                        mapping: { 
                            pan: 1, panFine: 2, tilt: 3, tiltFine: 4, 
                            speed: 5, dimmer: 6, shutter: 7, 
                            r: 8, g: 9, b: 10, w: 11, 
                            color: 12, zoom: 13, control: 14, movement: 15, dimmerSpeed: 16 
                        }
                    }
                }
            },
            
            // ADJ
            'adj-inno-pocket-spot': {
                manufacturer: 'ADJ',
                name: 'Inno Pocket Spot',
                type: 'movinghead',
                modes: {
                    '8ch': {
                        channels: 8,
                        mapping: { 
                            pan: 1, tilt: 2, color: 3, gobo: 4, 
                            dimmer: 5, shutter: 6, speed: 7, control: 8 
                        }
                    }
                }
            }
        }
    },
    
    // ========================================
    // STROBE
    // ========================================
    'strobe': {
        name: 'Strobe',
        fixtures: {
            'generic-strobe-1ch': {
                manufacturer: 'Generic',
                name: 'Strobe 1ch',
                type: 'strobe',
                modes: {
                    '1ch': {
                        channels: 1,
                        mapping: { speed: 1 }
                    }
                }
            },
            'generic-strobe-2ch': {
                manufacturer: 'Generic',
                name: 'Strobe 2ch',
                type: 'strobe',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { dimmer: 1, speed: 2 }
                    }
                }
            },
            'eurolite-led-strobe-cob': {
                manufacturer: 'Eurolite',
                name: 'LED Strobe COB PRO',
                type: 'strobe',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { dimmer: 1, strobe: 2 }
                    },
                    '4ch': {
                        channels: 4,
                        mapping: { dimmer: 1, strobe: 2, duration: 3, mode: 4 }
                    }
                }
            },
            'chauvet-shocker-2': {
                manufacturer: 'Chauvet',
                name: 'Shocker 2',
                type: 'strobe',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { zone1: 1, zone2: 2, strobe: 3 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { zone1: 1, zone2: 2, strobe: 3, mode: 4, speed: 5, sound: 6 }
                    }
                }
            },
            'adj-mega-flash-dmx': {
                manufacturer: 'ADJ',
                name: 'Mega Flash DMX',
                type: 'strobe',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { dimmer: 1, speed: 2 }
                    }
                }
            },
            'atomic-3000-led': {
                manufacturer: 'Martin',
                name: 'Atomic 3000 LED',
                type: 'strobe',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { intensity: 1, duration: 2, rate: 3, effect: 4 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { intensity: 1, duration: 2, rate: 3, effect: 4, r: 5, g: 6, b: 7 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // DIMMER
    // ========================================
    'dimmer': {
        name: 'Dimmer',
        fixtures: {
            'generic-dimmer-1ch': {
                manufacturer: 'Generic',
                name: 'Dimmer 1ch',
                type: 'dimmer',
                modes: {
                    '1ch': {
                        channels: 1,
                        mapping: { dimmer: 1 }
                    }
                }
            },
            'generic-dimmer-4ch': {
                manufacturer: 'Generic',
                name: 'Dimmer Pack 4ch',
                type: 'dimmer',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { ch1: 1, ch2: 2, ch3: 3, ch4: 4 }
                    }
                }
            },
            'eurolite-dpx-610': {
                manufacturer: 'Eurolite',
                name: 'DPX-610 Dimmer Pack',
                type: 'dimmer',
                modes: {
                    '6ch': {
                        channels: 6,
                        mapping: { ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5, ch6: 6 }
                    }
                }
            },
            'showtec-multidim-4': {
                manufacturer: 'Showtec',
                name: 'MultiDim MKII 4ch',
                type: 'dimmer',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { ch1: 1, ch2: 2, ch3: 3, ch4: 4 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // LED BAR / STRIP
    // ========================================
    'bar': {
        name: 'LED Bar / Strip',
        fixtures: {
            'generic-ledbar-rgb-3ch': {
                manufacturer: 'Generic',
                name: 'LED Bar RGB 3ch',
                type: 'bar',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    }
                }
            },
            'generic-ledbar-segments-24ch': {
                manufacturer: 'Generic',
                name: 'LED Bar 8 Segments RGB',
                type: 'bar',
                modes: {
                    '24ch': {
                        channels: 24,
                        mapping: { 
                            seg1r: 1, seg1g: 2, seg1b: 3,
                            seg2r: 4, seg2g: 5, seg2b: 6,
                            seg3r: 7, seg3g: 8, seg3b: 9,
                            seg4r: 10, seg4g: 11, seg4b: 12,
                            seg5r: 13, seg5g: 14, seg5b: 15,
                            seg6r: 16, seg6g: 17, seg6b: 18,
                            seg7r: 19, seg7g: 20, seg7b: 21,
                            seg8r: 22, seg8g: 23, seg8b: 24
                        }
                    }
                }
            },
            'stairville-led-bar-252': {
                manufacturer: 'Stairville',
                name: 'LED Bar 252 RGB',
                type: 'bar',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { r: 1, g: 2, b: 3, dimmer: 4, strobe: 5, mode: 6 }
                    },
                    '18ch': {
                        channels: 18,
                        mapping: { 
                            seg1r: 1, seg1g: 2, seg1b: 3,
                            seg2r: 4, seg2g: 5, seg2b: 6,
                            seg3r: 7, seg3g: 8, seg3b: 9,
                            seg4r: 10, seg4g: 11, seg4b: 12,
                            seg5r: 13, seg5g: 14, seg5b: 15,
                            seg6r: 16, seg6g: 17, seg6b: 18
                        }
                    }
                }
            },
            'chauvet-colorband-pix': {
                manufacturer: 'Chauvet',
                name: 'COLORband PIX',
                type: 'bar',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    },
                    '6ch': {
                        channels: 6,
                        mapping: { r: 1, g: 2, b: 3, strobe: 4, mode: 5, dimmer: 6 }
                    },
                    '36ch': {
                        channels: 36,
                        mapping: { /* 12 segments x RGB */ }
                    }
                }
            }
        }
    },
    
    // ========================================
    // LASER
    // ========================================
    'laser': {
        name: 'Laser',
        fixtures: {
            'generic-laser-ilda': {
                manufacturer: 'Generic',
                name: 'ILDA Laser (DMX)',
                type: 'laser',
                modes: {
                    '8ch': {
                        channels: 8,
                        mapping: { mode: 1, pattern: 2, size: 3, xpos: 4, ypos: 5, rot: 6, color: 7, speed: 8 }
                    }
                }
            },
            'stairville-dj-lase-140rgy': {
                manufacturer: 'Stairville',
                name: 'DJ Lase 140-RGY MKII',
                type: 'laser',
                modes: {
                    '10ch': {
                        channels: 10,
                        mapping: { control: 1, pattern: 2, zoom: 3, rotX: 4, rotY: 5, rotZ: 6, xpos: 7, ypos: 8, color: 9, speed: 10 }
                    }
                }
            },
            'cameo-luke-700-rgb': {
                manufacturer: 'Cameo',
                name: 'LUKE 700 RGB',
                type: 'laser',
                modes: {
                    '7ch': {
                        channels: 7,
                        mapping: { mode: 1, pattern: 2, xpos: 3, ypos: 4, size: 5, rotation: 6, color: 7 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // FOG / HAZE
    // ========================================
    'fog': {
        name: 'Fog / Haze',
        fixtures: {
            'generic-fogger-1ch': {
                manufacturer: 'Generic',
                name: 'Fog Machine 1ch',
                type: 'fog',
                modes: {
                    '1ch': {
                        channels: 1,
                        mapping: { output: 1 }
                    }
                }
            },
            'generic-fogger-2ch': {
                manufacturer: 'Generic',
                name: 'Fog Machine 2ch',
                type: 'fog',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { output: 1, fan: 2 }
                    }
                }
            },
            'antari-z-1500': {
                manufacturer: 'Antari',
                name: 'Z-1500 II',
                type: 'fog',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { output: 1, fan: 2 }
                    },
                    '3ch': {
                        channels: 3,
                        mapping: { output: 1, fan: 2, heat: 3 }
                    }
                }
            },
            'antari-hz-350': {
                manufacturer: 'Antari',
                name: 'HZ-350 Hazer',
                type: 'fog',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { output: 1, fan: 2 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // BLINDER
    // ========================================
    'blinder': {
        name: 'Blinder',
        fixtures: {
            'generic-blinder-2ch': {
                manufacturer: 'Generic',
                name: 'Blinder 2ch',
                type: 'blinder',
                modes: {
                    '2ch': {
                        channels: 2,
                        mapping: { lamp1: 1, lamp2: 2 }
                    }
                }
            },
            'generic-blinder-4ch': {
                manufacturer: 'Generic',
                name: 'Blinder 4ch',
                type: 'blinder',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { lamp1: 1, lamp2: 2, lamp3: 3, lamp4: 4 }
                    }
                }
            },
            'chauvet-shocker-90': {
                manufacturer: 'Chauvet',
                name: 'Shocker 90 IRC',
                type: 'blinder',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { zone1: 1, zone2: 2, zone3: 3, zone4: 4 }
                    },
                    '7ch': {
                        channels: 7,
                        mapping: { zone1: 1, zone2: 2, zone3: 3, zone4: 4, strobe: 5, mode: 6, dimmer: 7 }
                    }
                }
            }
        }
    },
    
    // ========================================
    // PIXEL / MATRIX
    // ========================================
    'pixel': {
        name: 'Pixel / Matrix',
        fixtures: {
            'generic-pixel-rgb': {
                manufacturer: 'Generic',
                name: 'RGB Pixel',
                type: 'pixel',
                modes: {
                    '3ch': {
                        channels: 3,
                        mapping: { r: 1, g: 2, b: 3 }
                    }
                }
            },
            'generic-pixel-rgbw': {
                manufacturer: 'Generic',
                name: 'RGBW Pixel',
                type: 'pixel',
                modes: {
                    '4ch': {
                        channels: 4,
                        mapping: { r: 1, g: 2, b: 3, w: 4 }
                    }
                }
            }
        }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Gibt alle Kategorien zurück
 */
export function getCategories() {
    return Object.keys(fixtureLibrary).map(key => ({
        id: key,
        name: fixtureLibrary[key].name
    }));
}

/**
 * Gibt alle Fixtures einer Kategorie zurück
 */
export function getFixturesByCategory(categoryId) {
    const category = fixtureLibrary[categoryId];
    if (!category) return [];
    
    return Object.keys(category.fixtures).map(key => ({
        id: key,
        ...category.fixtures[key]
    }));
}

/**
 * Gibt alle Fixtures eines Herstellers zurück
 */
export function getFixturesByManufacturer(manufacturer) {
    const results = [];
    
    for (const categoryId of Object.keys(fixtureLibrary)) {
        const category = fixtureLibrary[categoryId];
        for (const fixtureId of Object.keys(category.fixtures)) {
            const fixture = category.fixtures[fixtureId];
            if (fixture.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
                results.push({
                    id: fixtureId,
                    category: categoryId,
                    ...fixture
                });
            }
        }
    }
    
    return results;
}

/**
 * Gibt alle verfügbaren Hersteller zurück
 */
export function getManufacturers() {
    const manufacturers = new Set();
    
    for (const categoryId of Object.keys(fixtureLibrary)) {
        const category = fixtureLibrary[categoryId];
        for (const fixtureId of Object.keys(category.fixtures)) {
            manufacturers.add(category.fixtures[fixtureId].manufacturer);
        }
    }
    
    return Array.from(manufacturers).sort();
}

/**
 * Sucht nach Fixtures
 */
export function searchFixtures(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const categoryId of Object.keys(fixtureLibrary)) {
        const category = fixtureLibrary[categoryId];
        for (const fixtureId of Object.keys(category.fixtures)) {
            const fixture = category.fixtures[fixtureId];
            if (
                fixture.name.toLowerCase().includes(lowerQuery) ||
                fixture.manufacturer.toLowerCase().includes(lowerQuery) ||
                fixtureId.toLowerCase().includes(lowerQuery)
            ) {
                results.push({
                    id: fixtureId,
                    category: categoryId,
                    ...fixture
                });
            }
        }
    }
    
    return results;
}

/**
 * Gibt ein spezifisches Fixture zurück
 */
export function getFixture(fixtureId) {
    for (const categoryId of Object.keys(fixtureLibrary)) {
        const category = fixtureLibrary[categoryId];
        if (category.fixtures[fixtureId]) {
            return {
                id: fixtureId,
                category: categoryId,
                ...category.fixtures[fixtureId]
            };
        }
    }
    return null;
}

/**
 * Erstellt ein Fixture-Objekt für DMX State
 */
export function createFixtureFromLibrary(fixtureId, modeName, startChannel, customName = '') {
    const fixture = getFixture(fixtureId);
    if (!fixture) return null;
    
    const mode = fixture.modes[modeName];
    if (!mode) return null;
    
    return {
        id: Date.now(),
        libraryId: fixtureId,
        name: customName || `${fixture.manufacturer} ${fixture.name} @ ${startChannel}`,
        manufacturer: fixture.manufacturer,
        model: fixture.name,
        type: fixture.type,
        startChannel,
        mode: modeName,
        channels: mode.channels,
        mapping: { ...mode.mapping },
        enabled: true
    };
}

/**
 * Fixture-Statistiken
 */
export function getLibraryStats() {
    let totalFixtures = 0;
    let totalModes = 0;
    const categories = {};
    
    for (const categoryId of Object.keys(fixtureLibrary)) {
        const category = fixtureLibrary[categoryId];
        const fixtureCount = Object.keys(category.fixtures).length;
        totalFixtures += fixtureCount;
        categories[categoryId] = fixtureCount;
        
        for (const fixtureId of Object.keys(category.fixtures)) {
            totalModes += Object.keys(category.fixtures[fixtureId].modes).length;
        }
    }
    
    return {
        totalFixtures,
        totalModes,
        totalCategories: Object.keys(fixtureLibrary).length,
        totalManufacturers: getManufacturers().length,
        categories
    };
}
