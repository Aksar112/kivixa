const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const toolbar = {
    addPageBtn: document.getElementById('add-page-btn'),
    pageSizeSelect: document.getElementById('page-size-select'),
    customSizeInputs: document.getElementById('custom-size-inputs'),
    customWidthInput: document.getElementById('custom-width-input'),
    customHeightInput: document.getElementById('custom-height-input'),
    pageTypeSelect: document.getElementById('page-type-select'),
    pageColorPicker: document.getElementById('page-color-picker'),
};

let pages = [];
let panX = 0;
let panY = 0;
let zoom = 1;

const PAGE_SIZES = {
    a4: { width: 794, height: 1123 },
    a3: { width: 1123, height: 1587 },
    letter: { width: 816, height: 1056 },
};

function getPageSize() {
    const selectedSize = toolbar.pageSizeSelect.value;
    if (selectedSize === 'custom') {
        const width = parseInt(toolbar.customWidthInput.value) || 800;
        const height = parseInt(toolbar.customHeightInput.value) || 600;
        return { width, height };
    } else {
        return PAGE_SIZES[selectedSize];
    }
}

function addPage() {
    const { width, height } = getPageSize();
    const newPage = {
        width,
        height,
        color: toolbar.pageColorPicker.value,
        type: toolbar.pageTypeSelect.value,
        x: 0,
        y: pages.length > 0 ? pages[pages.length - 1].y + pages[pages.length - 1].height + 20 : 0,
    };
    pages.push(newPage);
    render();
}

function drawPage(page) {
    ctx.fillStyle = page.color;
    ctx.fillRect(page.x, page.y, page.width, page.height);

    switch (page.type) {
        case 'lined':
            drawLined(page);
            break;
        case 'dotted':
            drawDotted(page);
            break;
        case 'grid':
            drawGrid(page);
            break;
        case 'graph':
            drawGraph(page);
            break;
    }
}

function drawLined(page) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    for (let y = 30; y < page.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(page.x, page.y + y);
        ctx.lineTo(page.x + page.width, page.y + y);
        ctx.stroke();
    }
}

function drawDotted(page) {
    ctx.fillStyle = '#ccc';
    for (let y = 30; y < page.height; y += 30) {
        for (let x = 30; x < page.width; x += 30) {
            ctx.beginPath();
            ctx.arc(page.x + x, page.y + y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawGrid(page) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    for (let y = 30; y < page.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(page.x, page.y + y);
        ctx.lineTo(page.x + page.width, page.y + y);
        ctx.stroke();
    }
    for (let x = 30; x < page.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(page.x + x, page.y);
        ctx.lineTo(page.x + x, page.y + page.height);
        ctx.stroke();
    }
}

function drawGraph(page) {
    // Minor grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let y = 10; y < page.height; y += 10) {
        ctx.beginPath();
        ctx.moveTo(page.x, page.y + y);
        ctx.lineTo(page.x + page.width, page.y + y);
        ctx.stroke();
    }
    for (let x = 10; x < page.width; x += 10) {
        ctx.beginPath();
        ctx.moveTo(page.x + x, page.y);
        ctx.lineTo(page.x + x, page.y + page.height);
        ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    for (let y = 50; y < page.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(page.x, page.y + y);
        ctx.lineTo(page.x + page.width, page.y + y);
        ctx.stroke();
    }
    for (let x = 50; x < page.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(page.x + x, page.y);
        ctx.lineTo(page.x + x, page.y + page.height);
        ctx.stroke();
    }
}

function render() {
    canvas.width = window.innerWidth - 200;
    canvas.height = window.innerHeight;

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    pages.forEach(drawPage);

    ctx.restore();
}

let isPanning = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('mousedown', (e) => {
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        panX += dx;
        panY += dy;
        lastX = e.clientX;
        lastY = e.clientY;
        render();
    }
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
        const scaleAmount = 1.1;
        const mouseX = e.clientX - canvas.offsetLeft;
        const mouseY = e.clientY - canvas.offsetTop;
        const worldX = (mouseX - panX) / zoom;
        const worldY = (mouseY - panY) / zoom;

        if (e.deltaY < 0) {
            zoom *= scaleAmount;
        } else {
            zoom /= scaleAmount;
        }

        panX = mouseX - worldX * zoom;
        panY = mouseY - worldY * zoom;
    } else {
        panY -= e.deltaY;

        // Infinite scroll
        const lastPage = pages[pages.length - 1];
        if (lastPage) {
            const lastPageBottom = (lastPage.y + lastPage.height) * zoom + panY;
            if (lastPageBottom < canvas.height + 200) {
                addPage();
            }
        }
    }
    render();
});

toolbar.addPageBtn.addEventListener('click', addPage);

toolbar.pageSizeSelect.addEventListener('change', () => {
    if (toolbar.pageSizeSelect.value === 'custom') {
        toolbar.customSizeInputs.style.display = 'block';
    } else {
        toolbar.customSizeInputs.style.display = 'none';
    }
});

window.addEventListener('resize', render);

// Initial setup
addPage();