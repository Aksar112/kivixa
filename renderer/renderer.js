document.addEventListener('DOMContentLoaded', () => {
    // -- Canvas Setup --
    const pagesCanvas = document.getElementById('pages-canvas');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const liveCanvas = document.getElementById('live-canvas');
    const pctx = pagesCanvas.getContext('2d');
    const dctx = drawingCanvas.getContext('2d');
    const lctx = liveCanvas.getContext('2d');

    // -- Toolbar UI --
    const toolbar = {
        // Page Controls
        addPageBtn: document.getElementById('add-page-btn'),
        insertPageBtn: document.getElementById('insert-page-btn'),
        tearPageBtn: document.getElementById('tear-page-btn'),
        pageSizeSelect: document.getElementById('page-size-select'),
        customSizeInputs: document.getElementById('custom-size-inputs'),
        customWidthInput: document.getElementById('custom-width-input'),
        customHeightInput: document.getElementById('custom-height-input'),
        pageTypeSelect: document.getElementById('page-type-select'),
        pageColorPicker: document.getElementById('page-color-picker'),
        // Tool Selection
        penToolBtn: document.getElementById('pen-tool-btn'),
        eraserToolBtn: document.getElementById('eraser-tool-btn'),
        laserToolBtn: document.getElementById('laser-tool-btn'),
        // Pen Options
        penOptions: document.getElementById('pen-options'),
        penColorPicker: document.getElementById('pen-color-picker'),
        penStyleSelect: document.getElementById('pen-style-select'),
        penThicknessSlider: document.getElementById('pen-thickness-slider'),
        penOpacitySlider: document.getElementById('pen-opacity-slider'),
        // Eraser Options
        eraserOptions: document.getElementById('eraser-options'),
        eraserSizeSlider: document.getElementById('eraser-size-slider'),
        eraserStyleSelect: document.getElementById('eraser-style-select'),
    };

    // -- State Management --
    const state = {
        pages: [],
        panX: 0,
        panY: 0,
        zoom: 1,
        hoveredPage: null,
        isDrawing: false,
        isPanning: false,
        lastX: 0,
        lastY: 0,
        currentStroke: [],
        activeTool: 'pen',
        pen: {
            color: '#000000',
            style: 'fine-liner',
            thickness: 5,
            opacity: 1,
        },
        eraser: {
            size: 20,
            style: 'pixel',
        },
        laser: {
            x: 0,
            y: 0,
        }
    };

    const PAGE_SIZES = {
        a4: { width: 794, height: 1123 },
        a3: { width: 1123, height: 1587 },
        letter: { width: 816, height: 1056 },
    };

    // -- Page Management --
    function createNewPage() {
        const { width, height } = getPageSize();
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = width;
        pageCanvas.height = height;

        return {
            width,
            height,
            color: toolbar.pageColorPicker.value,
            type: toolbar.pageTypeSelect.value,
            x: 0, y: 0, // Recalculated later
            strokes: [],
            drawingCache: pageCanvas, // Off-screen canvas for committed drawings
        };
    }

    function addPageToEnd() {
        const newPage = createNewPage();
        state.pages.push(newPage);
        recalculatePagePositions();
        requestRedraw();
    }

    function insertPageAfter(targetPage) {
        if (!targetPage) return;
        const newPage = createNewPage();
        const targetIndex = state.pages.findIndex(p => p === targetPage);
        if (targetIndex > -1) {
            state.pages.splice(targetIndex + 1, 0, newPage);
            recalculatePagePositions();
            requestRedraw();
        }
    }

    function tearPage(pageToTear) {
        if (!pageToTear) return;
        const index = state.pages.findIndex(p => p === pageToTear);
        if (index > -1) {
            state.pages.splice(index, 1);
            recalculatePagePositions();
            requestRedraw();
        }
    }

    function recalculatePagePositions() {
        let currentY = 20;
        const centerX = (pagesCanvas.width / (2 * state.zoom)) - (state.pages[0]?.width / 2 || 0);
        state.pages.forEach(page => {
            page.y = currentY;
            page.x = centerX;
            currentY += page.height + 20; // 20px gap
        });
    }

    function getPageSize() {
        const selectedSize = toolbar.pageSizeSelect.value;
        if (selectedSize === 'custom') {
            return { 
                width: parseInt(toolbar.customWidthInput.value) || 800, 
                height: parseInt(toolbar.customHeightInput.value) || 600 
            };
        }
        return PAGE_SIZES[selectedSize];
    }

    // -- Drawing Engine --
    function startDrawing(e) {
        if (state.activeTool === 'laser') return;
        state.isDrawing = true;
        const pos = getMousePos(e);
        state.currentStroke = [{ 
            x: pos.x, 
            y: pos.y, 
            pressure: e.pressure || 0.5 
        }];
    }

    function draw(e) {
        if (!state.isDrawing) return;
        const pos = getMousePos(e);
        state.currentStroke.push({ 
            x: pos.x, 
            y: pos.y, 
            pressure: e.pressure || 0.5 
        });
        // Live drawing is handled by the render loop
    }

    function endDrawing() {
        if (!state.isDrawing) return;
        state.isDrawing = false;
        commitStroke(state.currentStroke);
        state.currentStroke = [];
    }

    function commitStroke(stroke) {
        if (stroke.length < 2) return;
        const page = findPageAt(stroke[0].x, stroke[0].y);
        if (page) {
            const pageStroke = {
                points: stroke.map(p => ({ x: p.x - page.x, y: p.y - page.y, pressure: p.pressure })),
                tool: { ...state[state.activeTool], tool: state.activeTool }
            };
            page.strokes.push(pageStroke);
            // Redraw the drawing cache for that page
            redrawPageCache(page);
            requestRedraw();
        }
    }

    function redrawPageCache(page) {
        const ctx = page.drawingCache.getContext('2d');
        ctx.clearRect(0, 0, page.width, page.height);
        page.strokes.forEach(stroke => {
            renderStroke(ctx, stroke.points, stroke.tool, false);
        });
    }

    // -- Render Logic --
    let redrawRequested = true;
    function requestRedraw() { redrawRequested = true; }

    function render() {
        lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);

        if (state.isDrawing && state.currentStroke.length > 0) {
            renderStroke(lctx, state.currentStroke, { ...state[state.activeTool], tool: state.activeTool }, true);
        }

        if (state.activeTool === 'laser') {
            lctx.fillStyle = 'red';
            lctx.beginPath();
            lctx.arc(state.laser.x, state.laser.y, 10, 0, 2 * Math.PI);
            lctx.fill();
        }

        if (redrawRequested) {
            pctx.clearRect(0, 0, pagesCanvas.width, pagesCanvas.height);
            dctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

            pctx.save();
            dctx.save();
            pctx.translate(state.panX, state.panY);
            dctx.translate(state.panX, state.panY);
            pctx.scale(state.zoom, state.zoom);
            dctx.scale(state.zoom, state.zoom);

            state.pages.forEach(page => {
                // Draw page background
                pctx.fillStyle = page.color;
                pctx.fillRect(page.x, page.y, page.width, page.height);
                // Draw committed drawings
                dctx.drawImage(page.drawingCache, page.x, page.y);
            });

            pctx.restore();
            dctx.restore();
            redrawRequested = false;
        }
        requestAnimationFrame(render);
    }

    function renderStroke(ctx, points, tool, isLive) {
        if (points.length < 2) return;

        ctx.save();
        if (isLive) {
            ctx.translate(state.panX, state.panY);
            ctx.scale(state.zoom, state.zoom);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = tool.color || '#000';
        ctx.globalAlpha = tool.opacity || 1;

        if (tool.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = tool.size;
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            if (tool.style === 'brush' || tool.style === 'marker') {
                ctx.lineWidth = tool.thickness * points[i].pressure;
            }
            else {
                ctx.lineWidth = tool.thickness;
            }
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // -- Event Listeners --
    function setupEventListeners() {
        // Tool selection
        toolbar.penToolBtn.addEventListener('click', () => switchTool('pen'));
        toolbar.eraserToolBtn.addEventListener('click', () => switchTool('eraser'));
        toolbar.laserToolBtn.addEventListener('click', () => switchTool('laser'));

        // Page controls
        toolbar.addPageBtn.addEventListener('click', addPageToEnd);
        toolbar.insertPageBtn.addEventListener('click', () => insertPageAfter(state.hoveredPage));
        toolbar.tearPageBtn.addEventListener('click', () => tearPage(state.hoveredPage));

        // Tool options
        toolbar.penColorPicker.onchange = (e) => state.pen.color = e.target.value;
        toolbar.penStyleSelect.onchange = (e) => state.pen.style = e.target.value;
        toolbar.penThicknessSlider.oninput = (e) => state.pen.thickness = e.target.value;
        toolbar.penOpacitySlider.oninput = (e) => state.pen.opacity = e.target.value;
        toolbar.eraserSizeSlider.oninput = (e) => state.eraser.size = e.target.value;

        // Canvas events
        liveCanvas.addEventListener('pointerdown', handlePointerDown);
        liveCanvas.addEventListener('pointermove', handlePointerMove);
        liveCanvas.addEventListener('pointerup', handlePointerUp);
        liveCanvas.addEventListener('pointerleave', handlePointerUp); // End drawing if pointer leaves
        window.addEventListener('resize', resizeCanvases);
    }

    function handlePointerDown(e) {
        if (e.button === 1) { // Middle mouse button for panning
            state.isPanning = true;
            state.lastX = e.clientX;
            state.lastY = e.clientY;
        } else {
            startDrawing(e);
        }
    }

    function handlePointerMove(e) {
        if (state.isPanning) {
            const dx = e.clientX - state.lastX;
            const dy = e.clientY - state.lastY;
            state.panX += dx;
            state.panY += dy;
            state.lastX = e.clientX;
            state.lastY = e.clientY;
            requestRedraw();
        } else if (state.isDrawing) {
            draw(e);
        } else if (state.activeTool === 'laser') {
            const pos = getMousePos(e, true);
            state.laser.x = pos.x;
            state.laser.y = pos.y;
        }
    }

    function handlePointerUp(e) {
        if (state.isPanning) {
            state.isPanning = false;
        } else if (state.isDrawing) {
            endDrawing(e);
        }
    }

    function switchTool(tool) {
        state.activeTool = tool;
        toolbar.penToolBtn.classList.toggle('active', tool === 'pen');
        toolbar.eraserToolBtn.classList.toggle('active', tool === 'eraser');
        toolbar.laserToolBtn.classList.toggle('active', tool === 'laser');
        toolbar.penOptions.classList.toggle('active', tool === 'pen');
        toolbar.eraserOptions.classList.toggle('active', tool === 'eraser');
    }

    // -- Utility Functions --
    function getMousePos(evt, onLiveCanvas = false) {
        const rect = liveCanvas.getBoundingClientRect();
        if (onLiveCanvas) {
            return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        }
        return {
            x: (evt.clientX - rect.left - state.panX) / state.zoom,
            y: (evt.clientY - rect.top - state.panY) / state.zoom
        };
    }

    function findPageAt(worldX, worldY) {
        return state.pages.find(p => 
            worldX >= p.x && worldX <= p.x + p.width &&
            worldY >= p.y && worldY <= p.y + p.height
        );
    }

    function resizeCanvases() {
        const container = document.getElementById('canvas-container');
        const { width, height } = container.getBoundingClientRect();
        pagesCanvas.width = drawingCanvas.width = liveCanvas.width = width;
        pagesCanvas.height = drawingCanvas.height = liveCanvas.height = height;
        recalculatePagePositions();
        requestRedraw();
    }

    // -- Initialization --
    function init() {
        resizeCanvases();
        setupEventListeners();
        addPageToEnd();
        render();
    }

    init();
});