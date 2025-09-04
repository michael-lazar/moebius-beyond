const { on, send } = require("../../senders");
const doc = require("../doc");
const libtextmode = require("../../libtextmode/libtextmode");
const palette = require("../palette");
const keyboard = require("../input/keyboard");
const { statusbar, toolbar } = require("../ui/ui");
const clipboard = require("./clipboard");

/** @type {{ EDITING: 0, SELECTION: 1, OPERATION: 2 }} */
const modes = { EDITING: 0, SELECTION: 1, OPERATION: 2 };

/** @type {{ OVER: 0, UNDER: 1, TRANSPARENT: 2 }} */
const overlay_modes = { OVER: 0, UNDER: 1, TRANSPARENT: 2 };

class Cursor {
    /** @type {{ EDITING: 0, SELECTION: 1, OPERATION: 2 }} */
    modes;
    /** @type {0 | 1 | 2} */
    mode;
    /** @type {HTMLCanvasElement} */
    canvas;
    /** @type {CanvasRenderingContext2D} */
    ctx;
    /** @type {number} */
    x;
    /** @type {number} */
    y;
    /** @type {boolean} */
    hidden;
    /** @type {boolean} */
    flashing;
    /** @type {App.Selection} */
    selection;
    /** @type {boolean} */
    scroll_document_with_cursor;
    /** @type {number} */
    canvas_zoom;
    /** @type {App.Blocks} */
    operation_blocks;
    /** @type {boolean} */
    operation_is_move;
    /** @type {0 | 1 | 2} */
    overlay_mode;

    constructor() {
        this.modes = modes;
        this.mode = modes.EDITING;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.x = 0;
        this.y = 0;
        this.hidden = true;
        this.flashing = false;
        this.selection = { sx: 0, sy: 0, dx: 0, dy: 0 };
        this.scroll_document_with_cursor = false;
        this.canvas_zoom = 1.0;
        this.operation_is_move = false;
        this.overlay_mode = overlay_modes.OVER;

        on("deselect", (event) => this.deselect());
        on("use_flashing_cursor", (event, value) => this.set_flashing(value));
        on("fill", (event) => this.fill());
        on("copy_block", (event) => this.start_copy());
        on("move_block", (event) => this.start_move());
        on("scroll_document_with_cursor", (event, value) => this.set_scroll_with_cursor(value));
        on("use_attribute_under_cursor", (event) => this.attribute_under_cursor());
        on("rotate", (event) => this.rotate());
        on("flip_x", (event) => this.flip_x());
        on("flip_y", (event) => this.flip_y());
        on("center", (event) => this.center());
        on("transparent", (event, value) => this.transparent(value));
        on("underneath", (event, value) => this.underneath(value));
        on("over", (event, value) => this.over(value));
        on("left_justify_line", (event, value) => this.left_justify_line());
        on("right_justify_line", (event, value) => this.right_justify_line());
        on("center_line", (event, value) => this.center_line());
        on("erase_line", (event, value) => this.erase_line());
        on("erase_to_start_of_line", (event, value) => this.erase_to_start_of_line());
        on("erase_to_end_of_line", (event, value) => this.erase_to_end_of_line());
        on("erase_column", (event, value) => this.erase_column());
        on("erase_to_start_of_column", (event, value) => this.erase_to_start_of_column());
        on("erase_to_end_of_column", (event, value) => this.erase_to_end_of_column());
        on("insert_row", (event) => this.insert_row(this.y));
        on("delete_row", (event) => this.delete_row(this.y));
        on("insert_column", (event) => this.insert_column(this.x));
        on("delete_column", (event) => this.delete_column(this.x));
        on("scroll_canvas_up", (event) => this.scroll_canvas_up());
        on("scroll_canvas_down", (event) => this.scroll_canvas_down());
        on("scroll_canvas_left", (event) => this.scroll_canvas_left());
        on("scroll_canvas_right", (event) => this.scroll_canvas_right());
        on("stamp", (event, value) => this.stamp());
        on("erase", (event, value) => this.erase());
        on("place", (event, value) => this.place());
        on("crop", (event, value) => this.crop());
        on("start_selection", (event) => this.start_selection_hotkey());
        on("cut", (event) => this.cut());
        on("copy", (event) => this.copy());
        on("paste", (event) => this.paste());
        on("paste_as_selection", (event) => this.paste_as_selection());
        on("scroll_margin", (event, value) => this.use_scroll_margin(value));
        on("undo", (event) => this.draw());
        on("redo", (event) => this.draw());
        on("set_canvas_zoom", (event, level) => this.set_canvas_zoom(level));

        keyboard.on("insert_row", () => this.insert_row(this.y));
        keyboard.on("delete_row", () => this.delete_row(this.y));
        keyboard.on("insert_column", () => this.insert_column(this.x));
        keyboard.on("delete_column", () => this.delete_column(this.x));
        keyboard.on("left", () => {
            if (!this.hidden) this.left();
        });
        keyboard.on("right", () => {
            if (!this.hidden) this.right();
        });
        keyboard.on("up", () => {
            if (!this.hidden) this.up();
        });
        keyboard.on("down", () => {
            if (!this.hidden) this.down();
        });
        keyboard.on("page_up", () => {
            if (!this.hidden) this.page_up();
        });
        keyboard.on("page_down", () => {
            if (!this.hidden) this.page_down();
        });
        keyboard.on("start_of_row", () => {
            if (!this.hidden) this.start_of_row();
        });
        keyboard.on("end_of_row", () => {
            if (!this.hidden) this.end_of_row();
        });
        keyboard.on("tab", () => {
            if (!this.hidden) this.tab();
        });
        keyboard.on("reverse_tab", () => {
            if (!this.hidden) this.reverse_tab();
        });
        keyboard.on("key_typed", (code) => this.key_typed(code));
        keyboard.on("backspace", () => this.backspace());
        keyboard.on("delete_key", () => this.delete_key());
        keyboard.on("f_key", (num) => this.f_key(num));
        keyboard.on("start_selection", () => this.start_selection());
        keyboard.on("new_line", () => this.new_line());
        keyboard.on("cut", () => this.cut());
        keyboard.on("copy", () => this.copy());
        keyboard.on("paste", () => this.paste());

        toolbar.on("key_typed", (code) => this.key_typed(code));

        doc.undo_history.on("move_to", (x, y) => this.undo_move_to(x, y));
        doc.on("render", () => this.new_render());
    }

    /**
     * @returns {void}
     */
    draw() {
        switch (this.mode) {
            case modes.EDITING: {
                if (this.flashing) return;
                const { font, render } = doc;
                this.ctx.globalCompositeOperation = "source-over";
                this.ctx.drawImage(
                    render.ice_color_collection[Math.floor(this.y / render.maximum_rows)],
                    this.x * font.width,
                    (this.y % render.maximum_rows) * font.height,
                    font.width,
                    font.height,
                    0,
                    0,
                    font.width,
                    font.height
                );
                this.ctx.globalCompositeOperation = "difference";
                font.draw_cursor(this.ctx, 0, font.height - 2);
                this.ctx.clearRect(0, 0, this.canvas.width, font.height - 2);
                break;
            }
            case modes.SELECTION:
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                break;
            case modes.OPERATION:
                if (this.overlay_mode == overlay_modes.UNDER) {
                    const canvas = libtextmode.render_blocks(
                        libtextmode.merge_blocks(
                            this.operation_blocks,
                            this.get_blocks_in_operation()
                        ),
                        doc.font
                    );
                    this.ctx.drawImage(
                        canvas,
                        2,
                        2,
                        canvas.width - 4,
                        canvas.height - 4,
                        0,
                        0,
                        canvas.width - 4,
                        canvas.height - 4
                    );
                }
                break;
        }
    }

    /**
     * @param {number} level
     * @returns {void}
     */
    set_canvas_zoom(level) {
        this.canvas_zoom = level;
        this.new_render(false); // Don't scroll during zoom operations
    }

    /**
     * @returns {App.Blocks}
     */
    get_blocks_in_operation() {
        return doc.get_blocks(
            this.x,
            this.y,
            Math.min(doc.columns - 1, this.x + this.operation_blocks.columns - 1),
            Math.min(doc.rows - 1, this.y + this.operation_blocks.rows - 1)
        );
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    scroll(x, y) {
        document.getElementById("viewport").scrollLeft += x * this.width * this.canvas_zoom;
        document.getElementById("viewport").scrollTop += y * this.height * this.canvas_zoom;
    }

    /**
     * @returns {void}
     */
    left() {
        this.move_to(Math.max(this.x - 1, 0), this.y);
        if (this.scroll_document_with_cursor) this.scroll(-1, 0);
    }

    /**
     * @returns {void}
     */
    up() {
        this.move_to(this.x, Math.max(this.y - 1, 0));
        if (this.scroll_document_with_cursor) this.scroll(0, -1);
    }

    /**
     * @returns {void}
     */
    right() {
        this.move_to(Math.min(this.x + 1, doc.columns - 1), this.y);
        if (this.scroll_document_with_cursor) this.scroll(1, 0);
    }

    /**
     * @returns {void}
     */
    down() {
        this.move_to(this.x, Math.min(this.y + 1, doc.rows - 1));
        if (this.scroll_document_with_cursor) this.scroll(0, 1);
    }

    /**
     * @returns {void}
     */
    page_up() {
        const viewport = document.getElementById("viewport");
        const viewport_rect = viewport.getBoundingClientRect();
        const characters_in_screen_height = Math.floor(
            viewport_rect.height / this.height / this.canvas_zoom
        );

        this.move_to(this.x, Math.max(this.y - characters_in_screen_height, 0));
        if (this.scroll_document_with_cursor) this.scroll(0, -characters_in_screen_height);
    }

    /**
     * @returns {void}
     */
    page_down() {
        const viewport = document.getElementById("viewport");
        const viewport_rect = viewport.getBoundingClientRect();
        const characters_in_screen_height = Math.floor(
            viewport_rect.height / this.height / this.canvas_zoom
        );

        this.move_to(this.x, Math.min(this.y + characters_in_screen_height, doc.rows - 1));
        if (this.scroll_document_with_cursor) this.scroll(0, characters_in_screen_height);
    }

    /**
     * @returns {void}
     */
    tab() {
        this.move_to(Math.min(doc.columns - 1, this.x + 8), this.y);
        if (this.scroll_document_with_cursor) this.scroll(8, 0);
    }

    /**
     * @returns {void}
     */
    reverse_tab() {
        this.move_to(Math.max(0, this.x - 8), this.y);
        if (this.scroll_document_with_cursor) this.scroll(-8, 0);
    }

    /**
     * @returns {void}
     */
    start_of_row() {
        this.move_to(0, this.y);
    }

    /**
     * @returns {void}
     */
    end_of_row() {
        if (this.mode == modes.OPERATION) {
            const { sx, dx } = this.reorientate_selection();
            const right_justified_x = doc.columns - (dx - sx + 1);
            if (this.x == right_justified_x) {
                this.move_to(doc.columns - 1, this.y);
            } else {
                this.move_to(right_justified_x, this.y);
            }
        } else {
            this.move_to(doc.columns - 1, this.y);
        }
    }

    /**
     * @returns {void}
     */
    scroll_to_cursor() {
        const viewport = document.getElementById("viewport");
        const viewport_rect = viewport.getBoundingClientRect();

        const cursor_top = this.height * (this.y - this.scroll_margin) * this.canvas_zoom;
        const cursor_left = this.width * (this.x - this.scroll_margin) * this.canvas_zoom;
        const cursor_bottom =
            this.height * (this.y + this.scroll_margin + 1) * this.canvas_zoom + 1;
        const cursor_right = this.width * (this.x + this.scroll_margin + 1) * this.canvas_zoom + 1;

        const viewport_bottom = viewport.scrollTop + viewport_rect.height;
        const viewport_right = viewport.scrollLeft + viewport_rect.width;

        if (viewport.scrollTop > cursor_top) {
            viewport.scrollTop = cursor_top;
        }
        if (viewport_bottom < cursor_bottom) {
            viewport.scrollTop = cursor_bottom - viewport_rect.height;
        }
        if (viewport.scrollLeft > cursor_left) {
            viewport.scrollLeft = cursor_left;
        }
        if (viewport_right < cursor_right) {
            viewport.scrollLeft = cursor_right - viewport_rect.width;
        }
    }

    /**
     * @returns {void}
     */
    new_line() {
        if (this.mode != modes.EDITING) return;
        if (keyboard.insert_mode && this.y < doc.rows - 1) {
            this.insert_row(this.y + 1);
        }
        const old_x = this.x;
        this.move_to(0, Math.min(doc.rows - 1, this.y + 1));
        if (this.scroll_document_with_cursor) this.scroll(-old_x, 1);
    }

    /**
     * @returns {App.Selection}
     */
    reorientate_selection() {
        const [sx, dx] =
            this.selection.dx < this.selection.sx
                ? [this.selection.dx, this.selection.sx]
                : [this.selection.sx, this.selection.dx];
        const [sy, dy] =
            this.selection.dy < this.selection.sy
                ? [this.selection.dy, this.selection.sy]
                : [this.selection.sy, this.selection.dy];
        return { sx, sy, dx, dy };
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {boolean} [scroll=true]
     * @returns {void}
     */
    move_to(x, y, scroll = true) {
        this.x = x;
        this.y = y;
        switch (this.mode) {
            case modes.EDITING:
                this.canvas.style.left = `${x * this.width}px`;
                this.canvas.style.top = `${y * this.height}px`;
                this.canvas.style.width = `${this.width}px`;
                this.canvas.style.height = `${this.height}px`;
                break;
            case modes.SELECTION: {
                this.selection.dx = x;
                this.selection.dy = y;
                const { sx, sy, dx, dy } = this.reorientate_selection();
                this.canvas.style.left = `${sx * this.width}px`;
                this.canvas.style.top = `${sy * this.height}px`;
                this.canvas.style.width = `${(dx - sx + 1) * this.width - 4}px`;
                this.canvas.style.height = `${(dy - sy + 1) * this.height - 4}px`;
                statusbar.status_bar_info(dx - sx + 1, dy - sy + 1);
                break;
            }
            case modes.OPERATION:
                this.canvas.style.left = `${x * this.width}px`;
                this.canvas.style.top = `${y * this.height}px`;
                break;
        }
        this.draw();
        statusbar.set_cursor_position(this.x, this.y);
        if (scroll) this.scroll_to_cursor();
    }

    /**
     * @returns {void}
     */
    show() {
        if (this.hidden) {
            document.getElementById("editing_layer").appendChild(this.canvas);
            this.hidden = false;
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    hide() {
        if (!this.hidden) {
            document.getElementById("editing_layer").removeChild(this.canvas);
            this.hidden = true;
        }
    }

    /**
     * @returns {void}
     */
    resize_to_font() {
        const font = doc.font;
        this.width = font.width;
        this.height = font.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.move_to(this.x, this.y, false);
    }

    /**
     * @param {boolean} [should_scroll=true]
     * @returns {void}
     */
    new_render(should_scroll = true) {
        this.move_to(
            Math.min(this.x, doc.columns - 1),
            Math.min(this.y, doc.rows - 1),
            should_scroll
        );
        this.resize_to_font();
        if (this.mode == modes.OPERATION) this.redraw_operation_blocks();
    }

    /**
     * @returns {void}
     */
    start_selection_mode() {
        this.selection = { sx: this.x, sy: this.y, dx: 0, dy: 0 };
        this.canvas.classList.add("selection");
        this.mode = modes.SELECTION;
        this.draw();
        send("enable_selection_menu_items");
    }

    /**
     * @returns {void}
     */
    start_editing_mode() {
        if (this.mode == modes.SELECTION) {
            this.x = this.selection.sx;
            this.y = this.selection.sy;
        }
        send("enable_editing_shortcuts");
        this.mode = modes.EDITING;
        if (this.canvas.classList.contains("selection")) this.canvas.classList.remove("selection");
        if (this.canvas.classList.contains("operation")) this.canvas.classList.remove("operation");
        this.resize_to_font();
        statusbar.use_canvas_size_for_status_bar();
    }

    /**
     * @returns {void}
     */
    deselect() {
        if (this.mode == modes.OPERATION && this.operation_is_move) doc.undo();
        this.start_editing_mode();
    }

    /**
     * @returns {void}
     */
    redraw_operation_blocks() {
        const font = doc.font;
        this.canvas.width = this.operation_blocks.columns * font.width - 4;
        this.canvas.height = this.operation_blocks.rows * font.height - 4;
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
        const transparent = this.overlay_mode == overlay_modes.TRANSPARENT;
        const canvas = libtextmode.render_blocks(this.operation_blocks, doc.font, transparent);
        this.ctx.drawImage(
            canvas,
            2,
            2,
            canvas.width - 4,
            canvas.height - 4,
            0,
            0,
            canvas.width - 4,
            canvas.height - 4
        );
    }

    /**
     * @param {App.Blocks} blocks
     * @param {boolean} is_move
     * @returns {void}
     */
    set_operation_mode(blocks, is_move) {
        if (this.mode == modes.EDITING) this.start_selection_mode();

        this.mode = modes.OPERATION;
        this.operation_blocks = blocks;
        this.operation_is_move = is_move;
        this.overlay_mode = overlay_modes.OVER;

        this.redraw_operation_blocks();
        send("disable_selection_menu_items_except_deselect_and_crop");
        send("enable_operation_menu_items");
        statusbar.use_canvas_size_for_status_bar();
        this.canvas.classList.add("operation");
    }

    /**
     * @returns {void}
     */
    start_copy() {
        const { sx, sy, dx, dy } = this.reorientate_selection();
        this.set_operation_mode({ ...doc.get_blocks(sx, sy, dx, dy) }, false);
        this.move_to(sx, sy);
    }

    /**
     * @returns {void}
     */
    start_move() {
        const { sx, sy, dx, dy } = this.reorientate_selection();
        this.set_operation_mode({ ...doc.get_blocks(sx, sy, dx, dy) }, true);
        doc.erase(sx, sy, dx, dy);
        this.move_to(sx, sy);
    }

    /**
     * @returns {void}
     */
    erase() {
        const { sx, sy, dx, dy } = this.reorientate_selection();
        doc.erase(sx, sy, dx, dy);
        this.start_editing_mode();
    }

    /**
     * @returns {void}
     */
    fill() {
        const { sx, sy, dx, dy } = this.reorientate_selection();
        doc.fill(sx, sy, dx, dy, palette.fg);
        this.start_editing_mode();
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    set_flashing(value) {
        if (this.flashing != value) {
            this.flashing = value;
            if (this.flashing) {
                this.canvas.getContext("2d").clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.canvas.classList.add("flashing");
            } else {
                this.canvas.classList.remove("flashing");
            }
            this.draw();
        }
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    set_scroll_with_cursor(value) {
        this.scroll_document_with_cursor = value;
    }

    /**
     * @returns {void}
     */
    attribute_under_cursor() {
        const block = doc.at(this.x, this.y);
        palette.fg = block.fg;
        palette.bg = block.bg;
    }

    /**
     * @returns {void}
     */
    rotate() {
        libtextmode.rotate(this.operation_blocks);
        this.redraw_operation_blocks();
    }

    /**
     * @returns {void}
     */
    flip_x() {
        libtextmode.flip_x(this.operation_blocks);
        this.redraw_operation_blocks();
    }

    /**
     * @returns {void}
     */
    flip_y() {
        libtextmode.flip_y(this.operation_blocks);
        this.redraw_operation_blocks();
    }

    /**
     * @returns {void}
     */
    center() {
        this.move_to(
            Math.max(Math.floor((doc.columns - this.operation_blocks.columns) / 2), 0),
            this.y
        );
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    transparent(value) {
        if (value) {
            this.overlay_mode = overlay_modes.TRANSPARENT;
            send("check_transparent");
            send("uncheck_underneath");
            send("uncheck_over");
        } else {
            this.overlay_mode = overlay_modes.OVER;
            send("uncheck_transparent");
            send("uncheck_underneath");
            send("check_over");
        }
        this.redraw_operation_blocks();
        this.draw();
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    over(value) {
        if (value) {
            this.overlay_mode = overlay_modes.OVER;
            send("uncheck_transparent");
            send("uncheck_underneath");
            send("check_over");
        } else {
            this.overlay_mode = overlay_modes.UNDER;
            send("uncheck_transparent");
            send("check_underneath");
            send("uncheck_over");
        }
        this.redraw_operation_blocks();
        this.draw();
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    underneath(value) {
        if (value) {
            this.overlay_mode = overlay_modes.UNDER;
            send("uncheck_transparent");
            send("check_underneath");
            send("uncheck_over");
        } else {
            this.overlay_mode = overlay_modes.OVER;
            send("uncheck_transparent");
            send("uncheck_underneath");
            send("check_over");
        }
        this.redraw_operation_blocks();
        this.draw();
    }

    /**
     * @param {number} code
     * @returns {void}
     */
    key_typed(code) {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.start_undo();
        if (keyboard.insert_mode) {
            for (let x = doc.columns - 1; x > this.x; x--) {
                const block = doc.at(x - 1, this.y);
                doc.change_data(x, this.y, block.code, block.fg, block.bg);
            }
        }
        const x = this.x;
        if (!keyboard.overwrite_mode) this.right();
        doc.change_data(
            x,
            this.y,
            code,
            palette.fg,
            palette.bg,
            { prev_x: x, prev_y: this.y },
            this
        );
        this.draw();
    }

    /**
     * @param {number} num
     * @returns {void}
     */
    f_key(num) {
        this.key_typed(toolbar.f_key(num));
    }

    /**
     * @returns {void}
     */
    backspace() {
        if (this.hidden || this.mode != modes.EDITING) return;
        if (this.x > 0) {
            doc.start_undo();
            const x = this.x;
            this.left();
            doc.clear_at(x - 1, this.y, { prev_x: x, prev_y: this.y }, this);
        }
    }

    /**
     * @returns {void}
     */
    delete_key() {
        if (this.hidden || this.mode == modes.OPERATION) return;
        if (this.mode == this.modes.SELECTION) {
            this.erase();
            return;
        }
        doc.start_undo();
        for (let x = this.x; x < doc.columns - 1; x++) {
            const block = doc.at(x + 1, this.y);
            doc.change_data(x, this.y, block.code, block.fg, block.bg);
        }
        doc.clear_at(doc.columns - 1, this.y, { prev_x: this.x, prev_y: this.y }, this);
    }

    /**
     * @returns {void}
     */
    start_selection() {
        if (this.mode == modes.EDITING) this.start_selection_mode();
    }

    /**
     * @returns {void}
     */
    start_selection_hotkey() {
        if (this.mode == modes.EDITING) {
            this.start_selection_mode();
            this.move_to(this.x, this.y);
        }
    }

    /**
     * @returns {void}
     */
    left_justify_line() {
        if (this.mode == modes.EDITING) doc.left_justify_line(this.y);
    }

    /**
     * @returns {void}
     */
    right_justify_line() {
        if (this.mode == modes.EDITING) doc.right_justify_line(this.y);
    }

    /**
     * @returns {void}
     */
    center_line() {
        if (this.mode == modes.EDITING) doc.center_line(this.y);
    }

    /**
     * @returns {void}
     */
    erase_line() {
        if (this.mode == modes.EDITING) {
            doc.erase_line(this.y);
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    erase_to_start_of_line() {
        if (this.mode == modes.EDITING) {
            doc.erase_to_start_of_line(this.x, this.y);
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    erase_to_end_of_line() {
        if (this.mode == modes.EDITING) {
            doc.erase_to_end_of_line(this.x, this.y);
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    erase_column() {
        if (this.mode == modes.EDITING) {
            doc.erase_column(this.x);
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    erase_to_start_of_column() {
        if (this.mode == modes.EDITING) {
            doc.erase_to_start_of_column(this.x, this.y);
            this.draw();
        }
    }

    /**
     * @returns {void}
     */
    erase_to_end_of_column() {
        if (this.mode == modes.EDITING) {
            doc.erase_to_end_of_column(this.x, this.y);
            this.draw();
        }
    }

    /**
     * @param {number} y
     * @returns {void}
     */
    insert_row(y) {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.insert_row(y);
        this.draw();
    }

    /**
     * @param {number} y
     * @returns {void}
     */
    delete_row(y) {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.delete_row(y);
        this.draw();
    }

    /**
     * @param {number} x
     * @returns {void}
     */
    insert_column(x) {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.insert_column(x);
        this.draw();
    }

    /**
     * @param {number} x
     * @returns {void}
     */
    delete_column(x) {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.delete_column(x);
        this.draw();
    }

    /**
     * @returns {void}
     */
    scroll_canvas_up() {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.scroll_canvas_up();
        this.draw();
    }

    /**
     * @returns {void}
     */
    scroll_canvas_down() {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.scroll_canvas_down();
        this.draw();
    }

    /**
     * @returns {void}
     */
    scroll_canvas_left() {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.scroll_canvas_left();
        this.draw();
    }

    /**
     * @returns {void}
     */
    scroll_canvas_right() {
        if (this.hidden || this.mode != modes.EDITING) return;
        doc.scroll_canvas_right();
        this.draw();
    }

    /**
     * @returns {void}
     */
    stamp() {
        const blocks =
            this.overlay_mode == overlay_modes.UNDER
                ? libtextmode.merge_blocks(this.operation_blocks, this.get_blocks_in_operation())
                : this.operation_blocks;

        const single_undo = this.operation_is_move;
        const transparent = this.overlay_mode == overlay_modes.TRANSPARENT;
        doc.place(blocks, this.x, this.y, single_undo, transparent);
        this.operation_is_move = false;
    }

    /**
     * @returns {void}
     */
    place() {
        this.stamp();
        this.start_editing_mode();
    }

    /**
     * @returns {void}
     */
    crop() {
        if (this.mode == modes.SELECTION) this.start_copy();
        doc.crop(this.operation_blocks);
        this.deselect();
    }

    /**
     * @returns {void}
     */
    copy() {
        if (this.mode == modes.EDITING) return;
        if (this.mode == modes.SELECTION) this.start_copy();
        clipboard.copy(this.operation_blocks);
        this.start_editing_mode();
    }

    /**
     * @returns {void}
     */
    cut() {
        const { sx, sy, dx, dy } = this.reorientate_selection();
        this.copy();
        doc.erase(sx, sy, dx, dy);
        this.start_editing_mode();
    }

    /**
     * @returns {void}
     */
    paste() {
        clipboard.paste(this.x, this.y);
    }

    /**
     * @returns {void}
     */
    paste_as_selection() {
        const blocks = clipboard.paste_blocks();
        if (blocks) {
            const is_move = false;
            this.set_operation_mode(blocks, is_move);
        }
    }

    /**
     * @param {string} value
     * @returns {void}
     */
    use_scroll_margin(value) {
        const num = Number.parseInt(value);
        if (num >= 0 && num <= 16) this.scroll_margin = num;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    undo_move_to(x, y) {
        if (!this.hidden && this.mode == modes.EDITING) this.move_to(x, y);
    }
}

module.exports = new Cursor();
