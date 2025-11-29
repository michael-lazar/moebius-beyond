const electron = require("electron");

let imageElement = null;
let containerElement = null;
let zoomSlider = null;
let grayscaleButton = null;
let gridCanvas = null;
let gridCtx = null;
let gridToggleButton = null;
let gridSizeSlider = null;
let gridVerticalOffsetSlider = null;
let gridHorizontalOffsetSlider = null;

let baseScale = 1;
let zoomMultiplier = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;
let isGrayscale = false;
let isGridVisible = false;
let gridMultiplier = 5;
let gridVerticalOffset = 0;
let gridHorizontalOffset = 0;

const MAX_ZOOM_MULTIPLIER = 10;

document.addEventListener("DOMContentLoaded", () => {
    imageElement = document.getElementById("reference-image");
    containerElement = document.getElementById("image-container");
    zoomSlider = document.getElementById("zoom-slider");
    grayscaleButton = document.getElementById("grayscale-button");
    gridCanvas = document.getElementById("grid-canvas");
    gridCtx = gridCanvas.getContext("2d");
    gridToggleButton = document.getElementById("grid-toggle-button");
    gridSizeSlider = document.getElementById("grid-size-slider");
    gridVerticalOffsetSlider = document.getElementById("grid-vertical-offset-slider");
    gridHorizontalOffsetSlider = document.getElementById("grid-horizontal-offset-slider");

    resizeGridCanvas();

    containerElement.addEventListener("mousedown", handleMouseDown);
    containerElement.addEventListener("mousemove", handleMouseMove);
    containerElement.addEventListener("mouseup", handleMouseUp);
    containerElement.addEventListener("mouseleave", handleMouseUp);
    zoomSlider.addEventListener("input", handleZoomSliderChange);
    gridSizeSlider.addEventListener("input", handleGridSizeChange);
    gridVerticalOffsetSlider.addEventListener("input", handleGridVerticalOffsetChange);
    gridHorizontalOffsetSlider.addEventListener("input", handleGridHorizontalOffsetChange);
    window.addEventListener("resize", handleResize);
});

electron.ipcRenderer.on("image-path", (event, imagePath) => {
    imageElement.src = imagePath;
    imageElement.onload = () => {
        calculateBaseScale();
        reset();
    };
});

function calculateBaseScale() {
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    const imageWidth = imageElement.naturalWidth;
    const imageHeight = imageElement.naturalHeight;

    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    baseScale = Math.min(scaleX, scaleY, 1);
}

function getCurrentScale() {
    return baseScale * zoomMultiplier;
}

function getGridSize() {
    if (!imageElement || !imageElement.naturalWidth) return 0;
    const smallerDimension = Math.min(imageElement.naturalWidth, imageElement.naturalHeight);
    return smallerDimension / gridMultiplier;
}

function constrainPan() {
    const currentScale = getCurrentScale();
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    const imageWidth = imageElement.naturalWidth * currentScale;
    const imageHeight = imageElement.naturalHeight * currentScale;

    const maxPanX = Math.max(0, (imageWidth - containerWidth) / 2);
    const maxPanY = Math.max(0, (imageHeight - containerHeight) / 2);

    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function updateTransform() {
    constrainPan();
    const currentScale = getCurrentScale();
    imageElement.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
    drawGrid();
}

function updateZoomSlider() {
    if (!zoomSlider) return;
    const sliderValue = ((zoomMultiplier - 1) / (MAX_ZOOM_MULTIPLIER - 1)) * 100;
    zoomSlider.value = Math.max(0, Math.min(100, sliderValue));
}

function enablePanning() {
    containerElement.classList.add("panning");
}

function disablePanning() {
    containerElement.classList.remove("panning");
}

function handleZoomSliderChange(e) {
    const sliderValue = parseFloat(e.target.value);
    zoomMultiplier = 1 + (sliderValue / 100) * (MAX_ZOOM_MULTIPLIER - 1);

    if (zoomMultiplier <= 1.001) {
        disablePanning();
    } else {
        enablePanning();
    }

    updateTransform();
}

function handleResize() {
    calculateBaseScale();
    updateTransform();
    resizeGridCanvas();
    drawGrid();
}

function resizeGridCanvas() {
    if (!gridCanvas) return;
    gridCanvas.width = containerElement.clientWidth;
    gridCanvas.height = containerElement.clientHeight;
}

function drawGrid() {
    if (!gridCanvas || !gridCtx || !isGridVisible || !imageElement.naturalWidth) {
        if (gridCanvas && gridCtx) {
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        }
        return;
    }

    const canvasWidth = gridCanvas.width;
    const canvasHeight = gridCanvas.height;
    gridCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    gridCtx.save();
    gridCtx.globalAlpha = 0.8;
    gridCtx.strokeStyle = "white";
    gridCtx.lineWidth = 1 / getCurrentScale();

    gridCtx.translate(canvasWidth / 2 + panX, canvasHeight / 2 + panY);
    gridCtx.scale(getCurrentScale(), getCurrentScale());
    gridCtx.translate(-imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);

    const gridSize = getGridSize();
    const offsetX = (gridHorizontalOffset / 100) * gridSize;
    const offsetY = (gridVerticalOffset / 100) * gridSize;

    gridCtx.beginPath();

    for (let x = offsetX; x < imageElement.naturalWidth; x += gridSize) {
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, imageElement.naturalHeight);
    }

    for (let y = offsetY; y < imageElement.naturalHeight; y += gridSize) {
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(imageElement.naturalWidth, y);
    }

    gridCtx.stroke();
    gridCtx.restore();
}

function enableGrid() {
    gridToggleButton.classList.add("toggled");
    gridCanvas.style.display = "block";
    gridSizeSlider.disabled = false;
    gridVerticalOffsetSlider.disabled = false;
    gridHorizontalOffsetSlider.disabled = false;
}

function disableGrid() {
    gridToggleButton.classList.remove("toggled");
    gridCanvas.style.display = "none";
    gridSizeSlider.disabled = true;
    gridVerticalOffsetSlider.disabled = true;
    gridHorizontalOffsetSlider.disabled = true;
}

function toggleGrid() {
    isGridVisible = !isGridVisible;
    if (isGridVisible) {
        enableGrid();
        drawGrid();
    } else {
        disableGrid();
    }
}

function enableGrayscale() {
    imageElement.classList.add("grayscale");
    grayscaleButton.classList.add("toggled");
}

function disableGrayscale() {
    imageElement.classList.remove("grayscale");
    grayscaleButton.classList.remove("toggled");
}

function toggleGrayscale() {
    isGrayscale = !isGrayscale;
    if (isGrayscale) {
        enableGrayscale();
    } else {
        disableGrayscale();
    }
}

function handleGridSizeChange(e) {
    gridMultiplier = parseFloat(e.target.value);
    drawGrid();
}

function handleGridVerticalOffsetChange(e) {
    gridVerticalOffset = parseFloat(e.target.value);
    drawGrid();
}

function handleGridHorizontalOffsetChange(e) {
    gridHorizontalOffset = parseFloat(e.target.value);
    drawGrid();
}

function reset() {
    zoomMultiplier = 1;
    panX = 0;
    panY = 0;
    isGrayscale = false;
    isGridVisible = false;
    gridMultiplier = 5;
    gridVerticalOffset = 0;
    gridHorizontalOffset = 0;
    disablePanning();
    disableGrayscale();
    disableGrid();
    gridSizeSlider.value = "5";
    gridVerticalOffsetSlider.value = "0";
    gridHorizontalOffsetSlider.value = "0";
    updateZoomSlider();
    updateTransform();
}

function handleMouseDown(e) {
    if (zoomMultiplier <= 1.001) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    containerElement.classList.add("dragging");
}

function handleMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    panX = dragStartPanX + deltaX;
    panY = dragStartPanY + deltaY;

    updateTransform();
}

function handleMouseUp() {
    if (isDragging) {
        isDragging = false;
        containerElement.classList.remove("dragging");
    }
}

// @ts-ignore
window.reset = reset;
// @ts-ignore
window.toggleGrayscale = toggleGrayscale;
// @ts-ignore
window.toggleGrid = toggleGrid;
