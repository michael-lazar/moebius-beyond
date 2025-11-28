const electron = require("electron");

let imageElement = null;
let containerElement = null;
let zoomSlider = null;
let grayscaleButton = null;

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

const MAX_ZOOM_MULTIPLIER = 10;

document.addEventListener("DOMContentLoaded", () => {
    imageElement = document.getElementById("reference-image");
    containerElement = document.getElementById("image-container");
    zoomSlider = document.getElementById("zoom-slider");
    grayscaleButton = document.getElementById("grayscale-button");

    containerElement.addEventListener("mousedown", handleMouseDown);
    containerElement.addEventListener("mousemove", handleMouseMove);
    containerElement.addEventListener("mouseup", handleMouseUp);
    containerElement.addEventListener("mouseleave", handleMouseUp);
    zoomSlider.addEventListener("input", handleSliderChange);
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
}

function updateSlider() {
    if (!zoomSlider) return;
    const sliderValue = ((zoomMultiplier - 1) / (MAX_ZOOM_MULTIPLIER - 1)) * 100;
    zoomSlider.value = Math.max(0, Math.min(100, sliderValue));
}

function handleSliderChange(e) {
    const sliderValue = parseFloat(e.target.value);
    zoomMultiplier = 1 + (sliderValue / 100) * (MAX_ZOOM_MULTIPLIER - 1);

    if (zoomMultiplier <= 1.001) {
        containerElement.classList.remove("panning");
    } else {
        containerElement.classList.add("panning");
    }

    updateTransform();
}

function handleResize() {
    calculateBaseScale();
    updateTransform();
}

function toggleGrayscale() {
    isGrayscale = !isGrayscale;
    if (isGrayscale) {
        imageElement.classList.add("grayscale");
        grayscaleButton.classList.add("toggled");
    } else {
        imageElement.classList.remove("grayscale");
        grayscaleButton.classList.remove("toggled");
    }
}

function reset() {
    zoomMultiplier = 1;
    panX = 0;
    panY = 0;
    isGrayscale = false;
    containerElement.classList.remove("panning");
    imageElement.classList.remove("grayscale");
    grayscaleButton.classList.remove("toggled");
    updateSlider();
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
