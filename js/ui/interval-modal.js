/**
 * INTERVAL OVERVIEW MODAL
 * 
 * Zeigt alle 25 Intervalle mit synästhetischer Form-Zuordnung
 * basierend auf Clara's System:
 * - Prime: Punkt
 * - Sekunde: klein/kompakt
 * - Terz: oval
 * - Größere Intervalle: Linien
 */

// Intervall-Definitionen mit synästhetischen Formen
export const intervalData = [
    { id: 0,  name: 'Prime',              semitones: 0,  shape: 'Punkt',    symbol: '●',  file: '00_prime.glb' },
    { id: 1,  name: 'Kleine Sekunde',     semitones: 1,  shape: 'Klein',    symbol: '▬',  file: '01_sekunde_klein.glb' },
    { id: 2,  name: 'Große Sekunde',      semitones: 2,  shape: 'Klein',    symbol: '▬',  file: '02_sekunde_gross.glb' },
    { id: 3,  name: 'Kleine Terz',        semitones: 3,  shape: 'Oval',     symbol: '⬭',  file: '03_terz_klein.glb' },
    { id: 4,  name: 'Große Terz',         semitones: 4,  shape: 'Oval',     symbol: '⬭',  file: '04_terz_gross.glb' },
    { id: 5,  name: 'Quarte',             semitones: 5,  shape: 'Linie',    symbol: '╱',  file: '05_quarte.glb' },
    { id: 6,  name: 'Tritonus',           semitones: 6,  shape: 'Linie',    symbol: '╳',  file: '06_tritonus.glb' },
    { id: 7,  name: 'Quinte',             semitones: 7,  shape: 'Linie',    symbol: '╱',  file: '07_quinte.glb' },
    { id: 8,  name: 'Kleine Sexte',       semitones: 8,  shape: 'Linie',    symbol: '╲',  file: '08_sexte_klein.glb' },
    { id: 9,  name: 'Große Sexte',        semitones: 9,  shape: 'Linie',    symbol: '╲',  file: '09_sexte_gross.glb' },
    { id: 10, name: 'Kleine Septime',     semitones: 10, shape: 'Linie',    symbol: '║',  file: '10_septime_klein.glb' },
    { id: 11, name: 'Große Septime',      semitones: 11, shape: 'Linie',    symbol: '║',  file: '11_septime_gross.glb' },
    { id: 12, name: 'Oktave',             semitones: 12, shape: 'Rahmen',   symbol: '□',  file: '12_oktave.glb' },
    { id: 13, name: 'Kleine None',        semitones: 13, shape: 'Linie+',   symbol: '╱·', file: '13_none_klein.glb' },
    { id: 14, name: 'Große None',         semitones: 14, shape: 'Linie+',   symbol: '╱·', file: '14_none_gross.glb' },
    { id: 15, name: 'Kleine Dezime',      semitones: 15, shape: 'Oval+',    symbol: '⬭·', file: '15_dezime_klein.glb' },
    { id: 16, name: 'Große Dezime',       semitones: 16, shape: 'Oval+',    symbol: '⬭·', file: '16_dezime_gross.glb' },
    { id: 17, name: 'Undezime',           semitones: 17, shape: 'Linie+',   symbol: '╱·', file: '17_undezime.glb' },
    { id: 18, name: 'Überm. Undezime',    semitones: 18, shape: 'Linie+',   symbol: '╳·', file: '18_undezime_ueberm.glb' },
    { id: 19, name: 'Duodezime',          semitones: 19, shape: 'Linie+',   symbol: '╱·', file: '19_duodezime.glb' },
    { id: 20, name: 'Kleine Tredezime',   semitones: 20, shape: 'Linie+',   symbol: '╲·', file: '20_tredezime_klein.glb' },
    { id: 21, name: 'Große Tredezime',    semitones: 21, shape: 'Linie+',   symbol: '╲·', file: '21_tredezime_gross.glb' },
    { id: 22, name: 'Kleine Quartdezime', semitones: 22, shape: 'Linie+',   symbol: '║·', file: '22_quartdezime_klein.glb' },
    { id: 23, name: 'Große Quartdezime',  semitones: 23, shape: 'Linie+',   symbol: '║·', file: '23_quartdezime_gross.glb' },
    { id: 24, name: 'Doppeloktave',       semitones: 24, shape: 'Rahmen+',  symbol: '□□', file: '24_doppeloktave.glb' }
];

// State
let modalEl = null;
let gridEl = null;
let currentModelSet = '';
let onSelectCallback = null;

/**
 * Initialisiert das Interval Modal
 */
export function initIntervalModal(modelSetPath = '3d-models/set_01') {
    modalEl = document.getElementById('intervalModal');
    gridEl = document.getElementById('intervalGrid');
    currentModelSet = modelSetPath;
    
    // Info Button Click Handler
    const infoBtn = document.getElementById('intervalInfoBtn');
    if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal();
        });
    }
    
    // Close Button
    const closeBtn = document.getElementById('intervalModalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Click outside to close
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                closeModal();
            }
        });
    }
    
    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl?.classList.contains('active')) {
            closeModal();
        }
    });
    
    console.log('Interval Modal initialized');
}

/**
 * Öffnet das Modal und rendert die Intervall-Grid
 */
export function openModal() {
    if (!modalEl || !gridEl) return;
    
    renderIntervalGrid();
    modalEl.classList.add('active');
}

/**
 * Schließt das Modal
 */
export function closeModal() {
    if (modalEl) {
        modalEl.classList.remove('active');
    }
}

/**
 * Rendert das Intervall-Grid
 */
function renderIntervalGrid() {
    if (!gridEl) return;
    
    gridEl.innerHTML = '';
    
    intervalData.forEach((interval, index) => {
        const card = document.createElement('div');
        card.className = 'interval-card';
        card.dataset.intervalId = interval.id;
        
        card.innerHTML = `
            <div class="interval-preview">
                <span>${interval.symbol}</span>
            </div>
            <div class="interval-name">${interval.name}</div>
            <div class="interval-semitones">${interval.semitones} Halbtöne</div>
            <div class="interval-shape">${interval.shape}</div>
        `;
        
        card.addEventListener('click', () => {
            // Alle deaktivieren
            gridEl.querySelectorAll('.interval-card').forEach(c => c.classList.remove('active'));
            // Diese aktivieren
            card.classList.add('active');
            
            // Callback wenn gesetzt
            if (onSelectCallback) {
                onSelectCallback(interval);
            }
        });
        
        gridEl.appendChild(card);
    });
}

/**
 * Setzt den aktuellen Model-Set Pfad
 */
export function setModelSet(path) {
    currentModelSet = path;
}

/**
 * Setzt Callback für Intervall-Auswahl
 */
export function setOnSelectCallback(callback) {
    onSelectCallback = callback;
}

/**
 * Markiert ein bestimmtes Intervall als aktiv
 */
export function setActiveInterval(semitones) {
    if (!gridEl) return;
    
    gridEl.querySelectorAll('.interval-card').forEach(card => {
        const interval = intervalData.find(i => i.id === parseInt(card.dataset.intervalId));
        if (interval && interval.semitones === semitones) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

/**
 * Gibt Intervall-Daten zurück
 */
export function getIntervalData() {
    return intervalData;
}
