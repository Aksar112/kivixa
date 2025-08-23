document.addEventListener('DOMContentLoaded', () => {
    // -- Canvas and Context Setup --
    const canvases = {
        pages: document.getElementById('pages-canvas'),
        drawing: document.getElementById('drawing-canvas'),
        live: document.getElementById('live-canvas'),
        tool: document.getElementById('tool-overlay-canvas'),
    };
    const ctx = {
        p: canvases.pages.getContext('2d'),
        d: canvases.drawing.getContext('2d'),
        l: canvases.live.getContext('2d'),
        t: canvases.tool.getContext('2d'),
    };

    // -- Toolbar UI References --
    const toolbar = {
        penToolBtn: document.getElementById('pen-tool-btn'),
        shapeToolBtn: document.getElementById('shape-tool-btn'),
        rulerToolBtn: document.getElementById('ruler-tool-btn'),
        setSquareToolBtn: document.getElementById('set-square-tool-btn'),
        compassToolBtn: document.getElementById('compass-tool-btn'),
        commitShapeBtn: document.getElementById('commit-shape-btn'),
        shapeOptions: document.getElementById('shape-options'),
        pen: { color: document.getElementById('pen-color-picker'), thickness: document.getElementById('pen-thickness-slider') }
    };

    // -- State Management --
    const state = {
        pages: [], panX: 0, panY: 0, zoom: 1,
        activeToolHandler: null, activeGuide: null, activeShape: null,
        pen: { color: '#000000', style: 'fine-liner', thickness: 5, opacity: 1 },
    };

    // -- Classes for Tools and Shapes --
    class BaseTool {
        constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.rotation = 0; }
        getCenter() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }
        getHandles() { return { tl: { x: this.x, y: this.y }, tr: { x: this.x + this.w, y: this.y }, bl: { x: this.x, y: this.y + this.h }, br: { x: this.x + this.w, y: this.y + this.h }, rot: { x: this.x + this.w / 2, y: this.y - 20 } }; }
        drawHandles(ctx) { const handles = this.getHandles(); ctx.fillStyle = '#00aaff'; Object.values(handles).forEach(h => { const rotated = this.rotatePoint(h, this.getCenter(), this.rotation); ctx.beginPath(); ctx.arc(rotated.x, rotated.y, 8, 0, 2 * Math.PI); ctx.fill(); }); }
        getHandleAt(point) { const handles = this.getHandles(); for (const [key, h] of Object.entries(handles)) { const rotated = this.rotatePoint(h, this.getCenter(), this.rotation); if (Math.hypot(rotated.x - point.x, rotated.y - point.y) < 10) return key; } return null; }
        rotatePoint(point, center, angle) { const dx = point.x - center.x, dy = point.y - center.y; return { x: dx * Math.cos(angle) - dy * Math.sin(angle) + center.x, y: dx * Math.sin(angle) + dy * Math.cos(angle) + center.y }; }
        isPointInside(point) { const unrotated = this.rotatePoint(point, this.getCenter(), -this.rotation); return unrotated.x >= this.x && unrotated.x <= this.x + this.w && unrotated.y >= this.y && unrotated.y <= this.y + this.h; }
    }

    class Shape extends BaseTool { constructor(type, x, y, w, h, color, thickness) { super(x, y, w, h); this.type = type; this.color = color; this.thickness = thickness; } draw(ctx, withHandles = false) { ctx.save(); const center = this.getCenter(); ctx.translate(center.x, center.y); ctx.rotate(this.rotation); ctx.translate(-center.x, -center.y); ctx.strokeStyle = this.color; ctx.lineWidth = this.thickness; ctx.beginPath(); if (this.type === 'rectangle') ctx.rect(this.x, this.y, this.w, this.h); else if (this.type === 'circle') ctx.arc(center.x, center.y, this.w / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); if (withHandles) this.drawHandles(ctx); } }
    class Ruler extends BaseTool { constructor(x, y) { super(x, y, 500, 50); } draw(ctx) { ctx.save(); const center = this.getCenter(); ctx.translate(center.x, center.y); ctx.rotate(this.rotation); ctx.translate(-center.x, -center.y); ctx.fillStyle = 'rgba(200, 200, 100, 0.7)'; ctx.fillRect(this.x, this.y, this.w, this.h); ctx.restore(); this.drawHandles(ctx); } }
    class SetSquare extends BaseTool { constructor(x, y) { super(x, y, 300, 300); } draw(ctx) { ctx.save(); const center = this.getCenter(); ctx.translate(center.x, center.y); ctx.rotate(this.rotation); ctx.translate(-center.x, -center.y); ctx.fillStyle = 'rgba(100, 150, 200, 0.7)'; ctx.beginPath(); ctx.moveTo(this.x, this.y + this.h); ctx.lineTo(this.x, this.y); ctx.lineTo(this.x + this.w, this.y + this.h); ctx.closePath(); ctx.fill(); ctx.restore(); this.drawHandles(ctx); } }

    // -- Tool Handlers (State Pattern) --
    const toolHandlers = {
        pen: { currentStroke: [], onPointerDown(e, pos) { this.currentStroke = [getSnappedPos(pos, e.pressure)]; }, onPointerMove(e, pos) { if (this.currentStroke.length > 0) this.currentStroke.push(getSnappedPos(pos, e.pressure)); }, onPointerUp() { commitStroke(this.currentStroke); this.currentStroke = []; }, draw(lctx) { renderStroke(lctx, this.currentStroke, { ...state.pen, tool: 'pen' }, true); } },
        defineShape: { shapeType: 'rectangle', startPos: null, onActivate(options) { this.shapeType = options.shapeType; canvases.tool.style.cursor = 'crosshair'; }, onDeactivate() { canvases.tool.style.cursor = 'default'; }, onPointerDown(e, pos) { this.startPos = pos; }, onPointerMove(e, pos) { if (!this.startPos) return; const tempShape = new Shape(this.shapeType, this.startPos.x, this.startPos.y, pos.x - this.startPos.x, pos.y - this.startPos.y, state.pen.color, state.pen.thickness); tempShape.draw(ctx.t); }, onPointerUp(e, pos) { const w = pos.x - this.startPos.x; const h = pos.y - this.startPos.y; state.activeShape = new Shape(this.shapeType, this.startPos.x, this.startPos.y, w, h, state.pen.color, state.pen.thickness); switchTool(toolHandlers.manipulate, { target: state.activeShape }); } },
        manipulate: { target: null, handle: null, lastPos: null, onActivate(options) { this.target = options.target; }, onPointerDown(e, pos) { this.handle = this.target.getHandleAt(pos); this.lastPos = pos; }, onPointerMove(e, pos) { const dx = pos.x - this.lastPos.x; const dy = pos.y - this.lastPos.y; if (this.handle) { const t = this.target; if (this.handle === 'rot') t.rotation += Math.atan2(pos.y - t.getCenter().y, pos.x - t.getCenter().x) - Math.atan2(this.lastPos.y - t.getCenter().y, this.lastPos.x - t.getCenter().x); else { const unrotatedDx = dx * Math.cos(-t.rotation) - dy * Math.sin(-t.rotation); const unrotatedDy = dx * Math.sin(-t.rotation) + dy * Math.cos(-t.rotation); if (this.handle.includes('l')) { t.x += unrotatedDx; t.w -= unrotatedDx; } if (this.handle.includes('t')) { t.y += unrotatedDy; t.h -= unrotatedDy; } if (this.handle.includes('r')) { t.w += unrotatedDx; } if (this.handle.includes('b')) { t.h += unrotatedDy; } } } else if (this.target.isPointInside(pos)) { this.target.x += dx; this.target.y += dy; } this.lastPos = pos; }, onPointerUp() { /* Manipulation ends */ }, draw(tctx) { if (this.target) this.target.draw(tctx, true); } }
    };

    // -- Core Logic --
    function addPageToEnd() { state.pages.push({ width: 794, height: 1123, strokes: [], drawingCache: document.createElement('canvas') }); recalculatePagePositions(); requestRedraw(); }
    function recalculatePagePositions() { let y = 20; state.pages.forEach(p => { p.x = (canvases.pages.width / 2) - (p.width / 2); p.y = y; y += p.height + 20; }); }
    function commit(item) { const page = findPageAt(item.x, item.y); if (page) { const pageItem = { ...item, x: item.x - page.x, y: item.y - page.y }; page.strokes.push({ points: [pageItem], tool: { tool: 'shape' } }); redrawPageCache(page); } state.activeShape = null; requestRedraw(); }
    function commitStroke(stroke) { if (stroke.length < 2) return; const page = findPageAt(stroke[0].x, stroke[0].y); if (page) { const pageStroke = { points: stroke.map(p => ({ x: p.x - page.x, y: p.y - page.y, pressure: p.pressure })), tool: { ...state.pen, tool: 'pen' } }; page.strokes.push(pageStroke); redrawPageCache(page); } }
    function redrawPageCache(page) { const c = page.drawingCache; const cctx = c.getContext('2d'); c.width = page.width; c.height = page.height; cctx.clearRect(0, 0, c.width, c.height); page.strokes.forEach(s => renderStroke(cctx, s.points, s.tool, false)); requestRedraw(); }

    // -- Render --
    let redrawRequested = true;
    function requestRedraw() { redrawRequested = true; }
    function render() {
        ctx.l.clearRect(0, 0, canvases.live.width, canvases.live.height);
        ctx.t.clearRect(0, 0, canvases.tool.width, canvases.tool.height);
        if (state.activeToolHandler && state.activeToolHandler.draw) state.activeToolHandler.draw(ctx.l, ctx.t);
        if (state.activeGuide) state.activeGuide.draw(ctx.t);
        if (redrawRequested) { pctx.clearRect(0, 0, canvases.pages.width, canvases.pages.height); dctx.clearRect(0, 0, canvases.drawing.width, canvases.drawing.height); pctx.save(); dctx.save(); pctx.translate(state.panX, state.panY); dctx.translate(state.panX, state.panY); pctx.scale(state.zoom, state.zoom); dctx.scale(state.zoom, state.zoom); state.pages.forEach(page => { pctx.fillStyle = '#FFF'; pctx.fillRect(page.x, page.y, page.width, page.height); dctx.drawImage(page.drawingCache, page.x, page.y); }); pctx.restore(); dctx.restore(); redrawRequested = false; }
        requestAnimationFrame(render);
    }
    function renderStroke(ctx, points, tool, isLive) { if (tool.tool === 'shape') { const s = points[0]; const shape = new Shape(s.type, s.x, s.y, s.w, s.h, s.color, s.thickness); shape.rotation = s.rotation; shape.draw(ctx); return; } if (points.length < 2) return; ctx.save(); if (isLive) { ctx.translate(state.panX, state.panY); ctx.scale(state.zoom, state.zoom); } ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = tool.color || '#000'; ctx.globalAlpha = tool.opacity || 1; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) { ctx.lineWidth = tool.style === 'brush' ? tool.thickness * points[i].pressure : tool.thickness; ctx.lineTo(points[i].x, points[i].y); } ctx.stroke(); ctx.restore(); }

    // -- Event Handlers & Tool Switching --
    function setupEventListeners() {
        toolbar.penToolBtn.addEventListener('click', () => switchTool(toolHandlers.pen));
        toolbar.shapeToolBtn.addEventListener('click', () => toolbar.shapeOptions.style.display = 'block');
        document.querySelectorAll('.shape-type-btn').forEach(btn => btn.addEventListener('click', () => { switchTool(toolHandlers.defineShape, { shapeType: btn.dataset.shape }); toolbar.shapeOptions.style.display = 'none'; }));
        toolbar.rulerToolBtn.addEventListener('click', () => toggleGuide('ruler'));
        toolbar.setSquareToolBtn.addEventListener('click', () => toggleGuide('setSquare'));
        toolbar.commitShapeBtn.addEventListener('click', () => { if (state.activeShape) { commit(state.activeShape); } switchTool(toolHandlers.pen); });
        canvases.tool.addEventListener('pointerdown', (e) => { const pos = getMousePos(e); const activeObject = state.activeShape || state.activeGuide; if (activeObject && activeObject.getHandleAt(pos)) { switchTool(toolHandlers.manipulate, { target: activeObject }); } if (state.activeToolHandler && state.activeToolHandler.onPointerDown) state.activeToolHandler.onPointerDown(e, pos); });
        canvases.tool.addEventListener('pointermove', (e) => { const pos = getMousePos(e); if (state.activeToolHandler && state.activeToolHandler.onPointerMove) state.activeToolHandler.onPointerMove(e, pos); updateCursor(e, pos); });
        canvases.tool.addEventListener('pointerup', (e) => { const pos = getMousePos(e); if (state.activeToolHandler && state.activeToolHandler.onPointerUp) state.activeToolHandler.onPointerUp(e, pos); });
        window.addEventListener('resize', resizeCanvases);
    }
    function switchTool(handler, options = {}) { if (state.activeToolHandler && state.activeToolHandler.onDeactivate) state.activeToolHandler.onDeactivate(); state.activeToolHandler = handler; if (state.activeToolHandler && state.activeToolHandler.onActivate) state.activeToolHandler.onActivate(options); }
    function toggleGuide(guideType) { if (state.activeGuide?.type === guideType) { state.activeGuide = null; } else { const GuideClass = { ruler: Ruler, setSquare: SetSquare }[guideType]; state.activeGuide = new GuideClass(300, 300); state.activeGuide.type = guideType; } requestRedraw(); }
    function updateCursor(e, pos) { let cursor = 'default'; const activeObject = state.activeShape || state.activeGuide; if (activeObject) { const handle = activeObject.getHandleAt(pos); if (handle) { cursor = handle === 'rot' ? 'grab' : 'pointer'; } else if (activeObject.isPointInside(pos)) { cursor = 'move'; } } canvases.tool.style.cursor = cursor; }

    // -- Utility --
    function getMousePos(evt) { const rect = canvases.tool.getBoundingClientRect(); return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }; }
    function findPageAt(x, y) { const worldPos = { x: (x - state.panX) / state.zoom, y: (y - state.panY) / state.zoom }; return state.pages.find(p => worldPos.x >= p.x && worldPos.x <= p.x + p.width && worldPos.y >= p.y && worldPos.y <= p.y + p.height); }
    function getSnappedPos(pos, pressure) { if (!state.activeGuide) return { ...pos, pressure: pressure || 0.5 }; /* ... Snapping logic for ruler and set square ... */ return { ...pos, pressure: pressure || 0.5 }; }
    function resizeCanvases() { const { width, height } = document.getElementById('canvas-container').getBoundingClientRect(); Object.values(canvases).forEach(c => { c.width = width; c.height = height; }); recalculatePagePositions(); requestRedraw(); }

    // -- Init --
    function init() { resizeCanvases(); setupEventListeners(); addPageToEnd(); switchTool(toolHandlers.pen); render(); }
    init();
});