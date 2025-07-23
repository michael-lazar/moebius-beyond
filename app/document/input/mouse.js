const events = require("events");
const doc = require("../doc");
const buttons = { NONE: 0, LEFT: 1, RIGHT: 2 };
const { toolbar, actual_size, zoom_with_anchor, current_zoom_factor, decrease_reference_image_opacity, increase_reference_image_opacity} = require("../ui/ui");
const palette = require("../palette");
const { on } = require("../../senders");

// Mouse input configuration constants
// Adjust these values to fine-tune zoom and pan behavior across different devices
const zoomConfig = {
    // Zoom level bounds
    minZoom: 0.2,
    maxZoom: 5.0,
    
    // Zoom delta calculation
    minStep: 0.02,      // Minimum zoom change per wheel event (2%)
    maxStep: 0.2,       // Maximum zoom change per wheel event (20%)
    sensitivity: 0.005, // How much each pixel of delta affects zoom
    
    // Panning
    panThreshold: 5,    // Minimum pixels moved before middle-mouse panning activates
    
    // Throttling
    throttleMs: 16      // Throttle wheel events to ~60fps
};

class MouseListener extends events.EventEmitter {
    set_dimensions(columns, rows, font) {
        this.columns = columns;
        this.rows = rows;
        this.font = font;
    }

    get_xy(event) {
        let canvas_width;
        const canvas_container = document.getElementById("canvas_container");
        const canvas_container_rect = canvas_container.getBoundingClientRect();
        if (doc.use_9px_font) {
            canvas_width = doc.columns * 9;
        } else {
            canvas_width = doc.columns * 8;
        }
        const canvas_height = doc.rows * doc.font_height;
        let mouseX = event.clientX - canvas_container_rect.left;
        let mouseY = event.clientY - canvas_container_rect.top;
        let canvasX = mouseX * canvas_width / canvas_container.clientWidth;
        let canvasY = mouseY * canvas_height / canvas_container.clientHeight;
        const x = Math.floor(canvasX / (this.font.width * this.canvas_zoom));
        const y = Math.floor(canvasY / (this.font.height * this.canvas_zoom));
        const half_y = Math.floor(canvasY / (this.font.height / 2 * this.canvas_zoom));
        return { x, y, half_y };
    }

    set_canvas_zoom(level) {
        this.canvas_zoom = level;
    }

    record_start() {
        [this.start.x, this.start.y, this.start.half_y] = [this.x, this.y, this.half_y];
        this.started = true;
    }

    start_drawing() {
        this.drawing = true;
    }

    end() {
        this.button = buttons.NONE;
        this.started = false;
        this.drawing = false;
        this.x = null;
        this.y = null;
        this.half_y = null;
    }

    store(x, y, half_y) {
        [this.x, this.y, this.half_y] = [x, y, half_y];
    }

    mouse_down(event) {
        if (!this.font || this.started || this.drawing) return;
        if (event.button == 1) {
            const now = Date.now();
            const double_click_threshold = 400; // milliseconds
            
            // Check for double-click
            if ((now - this.middle_click_time) < double_click_threshold) {
                // Double-click detected - cancel panning and reset zoom
                if (this.panning || this.pan_potential) {
                    this.panning = false;
                    this.pan_potential = false;
                    const viewport = document.getElementById("viewport");
                    viewport.style.cursor = '';
                }
                actual_size();
                this.middle_click_time = 0; // Reset to prevent triple-click issues
                return;
            }
            
            // Single click - prepare for potential panning (but don't activate yet)
            this.middle_click_time = now;
            this.pan_potential = true;
            this.panning = false;
            this.pan_start_x = event.clientX;
            this.pan_start_y = event.clientY;
            const viewport = document.getElementById("viewport");
            this.pan_start_scroll_left = viewport.scrollLeft;
            this.pan_start_scroll_top = viewport.scrollTop;
            return;
        }
        const { x, y, half_y } = this.get_xy(event);
        const is_legal = (x >= 0 && x < doc.columns && y >= 0 && y < doc.rows);
        if (event.altKey) {
            if (!is_legal) return;
            const block = doc.get_half_block(x, half_y);
            if (event.shiftKey) {
                toolbar.update_charlist_cursor(doc.at(x, y).code);
            }
            else if (block.is_blocky) {
                palette[(event.button == 0) ? "fg" : "bg"] = block.is_top ? block.upper_block_color : block.lower_block_color;
            } else {
                palette[(event.button == 0) ? "fg" : "bg"] = block.fg;
            }
            return;
        }
        this.store(x, y, half_y);
        this.start = { x, y, half_y };
        if (event.button == 2 || event.ctrlKey) {
            this.button = buttons.RIGHT;
        } else if (event.button == 0) {
            this.button = buttons.LEFT;
        }
        this.emit("down", x, y, half_y, is_legal, this.button, event.shiftKey);
        this.last = { x, y, half_y };
    }

    same_as_last(x, y, half_y) {
        if (this.last.x == x && this.last.y == y && (toolbar.mode != toolbar.modes.HALF_BLOCK || this.last.half_y == half_y)) return true;
        this.last = { x, y, half_y };
        return false;
    }

    mouse_move(event) {
        if (!this.font) return;
        
        // Handle panning with middle mouse button
        if (this.panning) {
            const viewport = document.getElementById("viewport");
            const deltaX = event.clientX - this.pan_start_x;
            const deltaY = event.clientY - this.pan_start_y;
            viewport.scrollLeft = this.pan_start_scroll_left - deltaX;
            viewport.scrollTop = this.pan_start_scroll_top - deltaY;
            return;
        }
        
        // Check if we should activate panning (threshold exceeded)
        if (this.pan_potential) {
            const deltaX = event.clientX - this.pan_start_x;
            const deltaY = event.clientY - this.pan_start_y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > zoomConfig.panThreshold) {
                // Activate panning
                this.pan_potential = false;
                this.panning = true;
                const viewport = document.getElementById("viewport");
                viewport.style.cursor = 'grabbing';
                // Immediately apply the current movement
                viewport.scrollLeft = this.pan_start_scroll_left - deltaX;
                viewport.scrollTop = this.pan_start_scroll_top - deltaY;
                return;
            }
        }
        
        const { x, y, half_y } = this.get_xy(event);
        const is_legal = (x >= 0 && x < doc.columns && y >= 0 && y < doc.rows);
        if (this.x == x && this.y == y && this.half_y == half_y) return;
        if (this.drawing) {
            if (!this.same_as_last(x, y, half_y)) {
                this.emit("draw", x, y, half_y, is_legal, this.button, event.shiftKey);
                this.store(x, y, half_y);
            }
        } else if (this.started) {
            if (!this.same_as_last(x, y, half_y)) this.emit("to", x, y, half_y, this.button);
        } else {
            this.emit("move", x, y, half_y, is_legal);
        }
    }

    mouse_up(event) {
        if (!this.font) return;
        
        // Handle end of panning with middle mouse button
        if (this.panning || this.pan_potential) {
            this.panning = false;
            this.pan_potential = false;
            const viewport = document.getElementById("viewport");
            viewport.style.cursor = '';
            return;
        }
        
        const { x, y, half_y } = this.get_xy(event);
        if (this.drawing || this.started) {
            this.emit("up", x, y, half_y, this.button, this.start.x == x && this.start.y == y && this.start.half_y == half_y, event.shiftKey);
            this.end();
        }
    }

    escape() {
        if (this.panning || this.pan_potential) {
            this.panning = false;
            this.pan_potential = false;
            const viewport = document.getElementById("viewport");
            viewport.style.cursor = '';
        }
        if (this.drawing || this.started) {
            this.end();
            this.emit("out");
        }
    }

    mouse_out(event) {
        if (event.relatedTarget) return;
        this.escape();
    }

    // Get wheel deltas (already in pixels in Electron/Chromium)
    normalizeWheel(event) {
        // Electron/Chromium always uses DOM_DELTA_PIXEL mode (deltaMode = 0)
        // so deltaX and deltaY are already in pixel units
        return { 
            pixelX: event.deltaX || 0, 
            pixelY: event.deltaY || 0 
        };
    }
    
    
    // Calculate proportional zoom delta from normalized wheel input
    calculateZoomDelta(pixelDelta, currentZoom) {
        const absDelta = Math.abs(pixelDelta);
        
        // Calculate base zoom change
        const baseChange = Math.min(
            Math.max(absDelta * zoomConfig.sensitivity, zoomConfig.minStep),
            zoomConfig.maxStep
        );
        
        // Apply proportional scaling based on current zoom level
        // Higher zoom levels get larger absolute changes to maintain consistent relative feel
        const proportionalChange = baseChange * currentZoom;
        
        return Math.sign(pixelDelta) * proportionalChange;
    }
    
    handleZoom(event) {
        event.preventDefault();
        
        if (!this.listening_to_wheel) return;
        
        const normalized = this.normalizeWheel(event);
        const currentZoom = current_zoom_factor();
        const zoomDelta = this.calculateZoomDelta(normalized.pixelY, currentZoom);
        
        // Calculate new zoom level with bounds
        const newZoom = Math.max(zoomConfig.minZoom, 
            Math.min(zoomConfig.maxZoom, currentZoom - zoomDelta));
        
        if (newZoom !== currentZoom) {
            // Get mouse position relative to viewport for anchored zooming
            const viewport = document.getElementById("viewport");
            const viewportRect = viewport.getBoundingClientRect();
            const mouseX = event.clientX - viewportRect.left;
            const mouseY = event.clientY - viewportRect.top;
            
            zoom_with_anchor(newZoom, mouseX, mouseY);
        }
        
        this.listening_to_wheel = false;
        setTimeout(() => {
            this.listening_to_wheel = true;
        }, zoomConfig.throttleMs);
    }
    
    handleRefImageOpacity(event) {
        if (!this.listening_to_wheel) return;
        
        const normalized = this.normalizeWheel(event);
        // Use both X and Y deltas for opacity
        const delta = normalized.pixelX + normalized.pixelY;
        
        if (delta > 0) {
            decrease_reference_image_opacity();
        } else if (delta < 0) {
            increase_reference_image_opacity();
        }
        
        this.listening_to_wheel = false;
        setTimeout(() => {
            this.listening_to_wheel = true;
        }, zoomConfig.throttleMs);
    }
    
    handleGridOpacity(event) {
        if (!this.listening_to_wheel) return;
        
        const gridElement = document.getElementById("drawing_grid");
        const currentOpacity = parseFloat(gridElement.style.opacity) || 1.0;
        const normalized = this.normalizeWheel(event);
        
        // Scale opacity change based on normalized delta
        const opacityStep = 0.2;
        const scaledStep = Math.sign(normalized.pixelY) * opacityStep;
        
        let newOpacity = currentOpacity - scaledStep;
        newOpacity = Math.max(0, Math.min(1.0, newOpacity));
        
        if (newOpacity > 0) {
            gridElement.style.opacity = newOpacity.toString();
        }
        
        this.listening_to_wheel = false;
        setTimeout(() => {
            this.listening_to_wheel = true;
        }, zoomConfig.throttleMs);
    }
    
    handleTrackpadPan(event) {
        const viewport = document.getElementById("viewport");
        const normalized = this.normalizeWheel(event);
        
        // Apply trackpad panning directly to viewport scroll
        // Note: We add the delta (not subtract) because trackpad scroll is inverted
        viewport.scrollLeft += normalized.pixelX;
        viewport.scrollTop += normalized.pixelY;
        
        event.preventDefault();
    }
    
    wheel(event) {
        if (event.ctrlKey) {
            this.handleZoom(event);
        } else if (event.shiftKey) {
            this.handleRefImageOpacity(event);
        } else if (event.altKey) {
            this.handleGridOpacity(event);
        } else {
            // Handle trackpad two-finger panning
            this.handleTrackpadPan(event);
        }
    }

    constructor() {
        super();
        this.buttons = buttons;
        this.button = buttons.NONE;
        this.start = { x: 0, y: 0, half_y: 0 };
        this.started = false;
        this.drawing = false;
        this.listening_to_wheel = true;
        this.canvas_zoom = 1.0;
        this.panning = false;
        this.pan_potential = false;
        this.middle_click_time = 0;
        on("set_canvas_zoom", (event, level) => this.set_canvas_zoom(level));
        doc.on("render", () => this.set_dimensions(doc.columns, doc.rows, doc.font));
        document.addEventListener("DOMContentLoaded", (event) => {
            document.getElementById("viewport").addEventListener("pointerdown", (event) => this.mouse_down(event), true);
            document.body.addEventListener("pointermove", (event) => this.mouse_move(event), true);
            document.body.addEventListener("pointerup", (event) => this.mouse_up(event), true);
            document.body.addEventListener("pointerout", (event) => this.mouse_out(event), true);
            document.body.addEventListener("wheel", (event) => this.wheel(event), { passive: false });
        });
    }
}


module.exports = new MouseListener();
