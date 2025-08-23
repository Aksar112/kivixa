document.addEventListener('DOMContentLoaded', () => {
    // -- Canvas and Context Setup --
    const canvases = { pages: document.getElementById('pages-canvas'), drawing: document.getElementById('drawing-canvas'), live: document.getElementById('live-canvas'), tool: document.getElementById('tool-overlay-canvas') };
    const ctx = { p: canvases.pages.getContext('2d'), d: canvases.drawing.getContext('2d'), l: canvases.live.getContext('2d'), t: canvases.tool.getContext('2d') };

    // -- Toolbar UI References --
    const toolbar = {
        addImageBtn: document.getElementById('add-image-btn'),
        imageUploadInput: document.getElementById('image-upload-input'),
        penToolBtn: document.getElementById('pen-tool-btn'),
        shapeToolBtn: document.getElementById('shape-tool-btn'),
        commitShapeBtn: document.getElementById('commit-shape-btn'),
        // ... other buttons
    };

    // -- State Management --
    const state = { pages: [], panX: 0, panY: 0, zoom: 1, activeToolHandler: null, activeGuide: null, activeObject: null, pen: { color: '#000000', thickness: 5 } };

    // -- Classes --
    class BaseTool { /* ... (Same as before) ... */ }
    class Shape extends BaseTool { /* ... (Same as before) ... */ }
    class ImageObject extends BaseTool {
        constructor(x, y, w, h, imageElement) {
            super(x, y, w, h);
            this.image = imageElement;
            this.type = 'image';
        }
        draw(ctx, withHandles = false) {
            ctx.save();
            const center = this.getCenter();
            ctx.translate(center.x, center.y); ctx.rotate(this.rotation); ctx.translate(-center.x, -center.y);
            ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
            ctx.restore();
            if (withHandles) this.drawHandles(ctx);
        }
    }

    // -- Tool Handlers (State Pattern) --
    const toolHandlers = { /* ... (pen, defineShape, manipulate) ... */ };

    // -- Core Logic --
    function commit(item) {
        const page = findPageAt(item.x, item.y);
        if (page) {
            const pageItem = { ...item, x: item.x - page.x, y: item.y - page.y };
            // For images, we need to store the image data URL, not the element
            if (item.type === 'image') pageItem.image = item.image.src;
            page.strokes.push({ points: [pageItem], tool: { tool: item.type } });
            redrawPageCache(page);
        }
        state.activeObject = null;
        requestRedraw();
    }
    function redrawPageCache(page) {
        const c = page.drawingCache; const cctx = c.getContext('2d');
        c.width = page.width; c.height = page.height;
        cctx.clearRect(0, 0, c.width, c.height);
        page.strokes.forEach(s => {
            // When rendering from cache, if it's an image, create an Image element
            if (s.tool.tool === 'image') {
                const img = new Image();
                img.src = s.points[0].image;
                img.onload = () => { renderStroke(cctx, s.points, s.tool, false); requestRedraw(); };
            } else {
                renderStroke(cctx, s.points, s.tool, false);
            }
        });
        requestRedraw();
    }

    // -- Render --
    function render() {
        // ... (clear canvases)
        if (state.activeToolHandler && state.activeToolHandler.draw) state.activeToolHandler.draw(ctx.l, ctx.t);
        if (state.activeObject) state.activeObject.draw(ctx.t, true);
        // ... (redraw persistent canvases)
        requestAnimationFrame(render);
    }
    function renderStroke(ctx, points, tool, isLive) {
        if (tool.tool === 'shape' || tool.tool === 'image') {
            const s = points[0];
            let item;
            if (tool.tool === 'image') {
                const img = new Image(); img.src = s.image;
                item = new ImageObject(s.x, s.y, s.w, s.h, img);
            } else {
                item = new Shape(s.type, s.x, s.y, s.w, s.h, s.color, s.thickness);
            }
            item.rotation = s.rotation;
            item.draw(ctx);
            return;
        }
        // ... (rest of stroke rendering)
    }

    // -- Image Loading --
    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const { width, height } = canvases.tool.getBoundingClientRect();
                const aspectRatio = img.width / img.height;
                const newWidth = 300;
                const newHeight = newWidth / aspectRatio;
                state.activeObject = new ImageObject(width / 2 - newWidth / 2, height / 2 - newHeight / 2, newWidth, newHeight, img);
                switchTool(toolHandlers.manipulate, { target: state.activeObject });
                requestRedraw();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // -- Event Handlers & Tool Switching --
    function setupEventListeners() {
        toolbar.addImageBtn.addEventListener('click', () => toolbar.imageUploadInput.click());
        toolbar.imageUploadInput.addEventListener('change', (e) => { if (e.target.files.length > 0) loadImage(e.target.files[0]); });
        canvases.tool.addEventListener('dragover', (e) => e.preventDefault());
        canvases.tool.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) loadImage(e.dataTransfer.files[0]); });
        toolbar.commitShapeBtn.addEventListener('click', () => { if (state.activeObject) { commit(state.activeObject); } switchTool(toolHandlers.pen); });
        // ... (other listeners)
    }

    function switchTool(handler, options = {}) {
        state.activeObject = null; // Clear active object when switching tools
        // ... (rest of switchTool)
    }

    // -- Init --
    function init() {
        // ... (Full implementation of all classes and handlers)
        console.log("Application initialized with Image Upload capabilities.");
        resizeCanvases();
        setupEventListeners();
        addPageToEnd();
        switchTool(toolHandlers.pen);
        render();
    }

    init();
});