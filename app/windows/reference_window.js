const electron = require("electron");

let imageElement = null;
let containerElement = null;

// Zoom state
let currentScale = 1;
let fitScale = 1;
let isAtFitScale = true;

// Pan state
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

// Constants
const ZOOM_STEP = 0.1;
const MAX_SCALE = 10;

document.addEventListener("DOMContentLoaded", () => {
    imageElement = document.getElementById("reference-image");
    containerElement = document.getElementById("image-container");

    // Event listeners
    containerElement.addEventListener("mousedown", handleMouseDown);
    containerElement.addEventListener("mousemove", handleMouseMove);
    containerElement.addEventListener("mouseup", handleMouseUp);
    containerElement.addEventListener("mouseleave", handleMouseUp);
});

electron.ipcRenderer.on("image-path", (event, imagePath) => {
    imageElement.src = imagePath;
    imageElement.onload = () => {
        calculateFitScale();
        applyFitScale();
        updateTransform();
    };
});

function calculateFitScale() {
    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight - 40; // Account for toolbar
    const imageWidth = imageElement.naturalWidth;
    const imageHeight = imageElement.naturalHeight;

    // Calculate scale to fit within window
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
}

function applyFitScale() {
    currentScale = fitScale;
    panX = 0;
    panY = 0;
    isAtFitScale = true;
    containerElement.classList.remove("panning");
}

function updateTransform() {
    imageElement.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
}

function zoomIn() {
    const newScale = Math.min(MAX_SCALE, currentScale + ZOOM_STEP);
    if (newScale !== currentScale) {
        currentScale = newScale;
        isAtFitScale = false;
        containerElement.classList.add("panning");
        updateTransform();
    }
}

function zoomOut() {
    const newScale = Math.max(fitScale, currentScale - ZOOM_STEP);
    if (newScale !== currentScale) {
        currentScale = newScale;
        isAtFitScale = Math.abs(currentScale - fitScale) < 0.001;
        if (isAtFitScale) {
            containerElement.classList.remove("panning");
        }
        updateTransform();
    }
}

function resetZoom() {
    applyFitScale();
    updateTransform();
}

function handleMouseDown(e) {
    // Only allow dragging when not at fit scale
    if (isAtFitScale) return;

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

function handleMouseUp(e) {
    if (isDragging) {
        isDragging = false;
        containerElement.classList.remove("dragging");
    }
}

// Expose functions to global scope for button onclick handlers
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
