import { jsPDF } from "jspdf";

document.addEventListener('DOMContentLoaded', () => {
    // -- Canvas and Context Setup --
    const canvases = { /* ... */ };
    const ctx = { /* ... */ };

    // -- Toolbar UI References --
    const toolbar = {
        exportPdfBtn: document.getElementById('export-pdf-btn'),
        // ... other buttons
    };

    // -- State Management --
    const state = { /* ... */ };
    const CURRENT_NOTE_ID = 1; // Placeholder for the active note

    // -- Debounce utility for autosaving --
    function debounce(func, timeout = 1000) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    // -- Data Persistence --
    const saveNotebook = debounce(() => {
        console.log("Autosaving...");
        const notebookData = {
            pages: state.pages.map(p => ({ ...p, drawingCache: null })), // Don't save canvas elements
        };
        const content = JSON.stringify(notebookData);
        window.electron.updateNoteContent({ id: CURRENT_NOTE_ID, content });
    });

    function markDirty() {
        saveNotebook();
    }

    async function loadNotebook() {
        const note = await window.electron.getNote(CURRENT_NOTE_ID);
        if (note && note.content) {
            const notebookData = JSON.parse(note.content);
            state.pages = notebookData.pages || [];
            // Recreate drawing caches
            state.pages.forEach(page => {
                page.drawingCache = document.createElement('canvas');
                redrawPageCache(page);
            });
            recalculatePagePositions();
            requestRedraw();
        } else {
            // If no content, start with a fresh page
            addPageToEnd();
        }
    }

    // -- PDF Export --
    async function exportToPDF() {
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: 'a4'
        });

        for (let i = 0; i < state.pages.length; i++) {
            const page = state.pages[i];
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = page.width;
            tempCanvas.height = page.height;

            // Draw background
            tempCtx.fillStyle = page.color || '#FFFFFF';
            tempCtx.fillRect(0, 0, page.width, page.height);

            // Draw content
            const c = page.drawingCache;
            tempCtx.drawImage(c, 0, 0);

            const imgData = tempCanvas.toDataURL('image/png');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        doc.save('notebook.pdf');
    }

    // -- Core Logic --
    function commit(item) { /* ... */ markDirty(); }
    function commitStroke(stroke) { /* ... */ markDirty(); }
    function addPageToEnd() { /* ... */ markDirty(); }

    // -- Event Handlers --
    function setupEventListeners() {
        toolbar.exportPdfBtn.addEventListener('click', exportToPDF);
        // ... other listeners
    }

    // -- Init --
    function init() {
        resizeCanvases();
        setupEventListeners();
        loadNotebook(); // Load data on startup
        render();
    }

    init();
});