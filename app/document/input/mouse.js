const events = require("events");
const doc = require("../doc");
const buttons = { NONE: 0, LEFT: 1, RIGHT: 2 };
const { toolbar, zoom_in, zoom_out, actual_size, decrease_reference_image_opacity, increase_reference_image_opacity} = require("../ui/ui");
const palette = require("../palette");
const { on } = require("../../senders");

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
        const x = Math.floor(canvasX / (this.font.width * (this.canvas_zoom_toggled ? 2 : 1)));
        const y = Math.floor(canvasY / (this.font.height * (this.canvas_zoom_toggled ? 2 : 1)));
        const half_y = Math.floor(canvasY / (this.font.height / 2 * (this.canvas_zoom_toggled ? 2 : 1)));
        return { x, y, half_y };
    }

    canvas_zoom_toggle() {
        this.canvas_zoom_toggled = !this.canvas_zoom_toggled;
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
            actual_size();
            return;
        }
        const { x, y, half_y } = this.get_xy(event);
        const is_legal = (x >= 0 && x < doc.columns && y >= 0 && y < doc.rows);
        if (event.altKey) {
            if (!is_legal) return;
            const block = doc.get_half_block(x, half_y);
            if (block.is_blocky) {
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
        const { x, y, half_y } = this.get_xy(event);
        if (this.drawing || this.started) {
            this.emit("up", x, y, half_y, this.button, this.start.x == x && this.start.y == y && this.start.half_y == half_y, event.shiftKey);
            this.end();
        }
    }

    escape() {
        if (this.drawing || this.started) {
            this.end();
            this.emit("out");
        }
    }

    mouse_out(event) {
        if (event.relatedTarget) return;
        this.escape();
    }

    wheel(event) {
        if (event.ctrlKey) { // zooming
            event.preventDefault();
            if (this.listening_to_wheel) {
                if (event.deltaY > 0) {
                    zoom_out();
                } else if (event.deltaY < 0) {
                    zoom_in();
                }
                this.listening_to_wheel = false;
                setTimeout(() => {
                    this.listening_to_wheel = true;
                }, 100);
            }
        } else if (event.shiftKey) { // reference image opacity
            if (this.listening_to_wheel) {
                if (event.deltaX > 0 || event.deltaY > 0) {
                    decrease_reference_image_opacity();
                } else if (event.deltaX < 0 || event.deltaY < 0) {
                    increase_reference_image_opacity();
                }
                this.listening_to_wheel = false;
                setTimeout(() => {
                    this.listening_to_wheel = true;
                }, 100);
            }
        } else if (event.altKey) { // grid opacity
            if (this.listening_to_wheel) {
                let e = document.getElementById("drawing_grid");
                let o = parseFloat(e.style.opacity);
                let a = 0.2;
                if (event.deltaY > 0) {
                    if (o >= a) o = o - a;
                } else if (event.deltaY < 0) {
                    if (o <= (1.0 - a)) o = o + a;
                }
                if (o > 0) e.style.opacity = parseFloat(o);
                this.listening_to_wheel = false;
                setTimeout(() => {
                    this.listening_to_wheel = true;
                }, 100);
            }
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
        this.canvas_zoom_toggled = false;
        on("canvas_zoom_toggle", (event) => this.canvas_zoom_toggle());
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
