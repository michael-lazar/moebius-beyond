const libtextmode = require("../libtextmode/libtextmode");
const { on, send, send_sync, open_box } = require("../senders");
const events = require("events");
const path = require("path");
const SIXTEEN_COLORS_API_KEY = "mirebitqv2ualog65ifv2p1a5076soh9";
let retention = "8035200";

const undo_types = {
    INDIVIDUAL: 0,
    RESIZE: 1,
    INSERT_ROW: 2,
    DELETE_ROW: 3,
    INSERT_COLUMN: 4,
    DELETE_COLUMN: 5,
    SCROLL_CANVAS_UP: 6,
    SCROLL_CANVAS_DOWN: 7,
    SCROLL_CANVAS_LEFT: 8,
    SCROLL_CANVAS_RIGHT: 9,
};

on("retention", (event, value) => (retention = value));

class UndoHistory extends events.EventEmitter {
    reset_redos() {
        this.redo_buffer = [];
        send("disable_redo");
    }

    reset_undos() {
        this.undo_buffer = [];
        send("disable_undo");
        this.reset_redos();
    }

    /**
     * @param {number} [type]
     * @param {any} [data]
     */
    start_chunk(type = undo_types.INDIVIDUAL, data = []) {
        this.reset_redos();
        this.undo_buffer.push({ type, data });
        send("enable_undo");
        send("document_changed");
    }

    push_resize() {
        this.start_chunk(undo_types.RESIZE, libtextmode.get_all_blocks(this.tmdata));
    }

    undo_individual(undos) {
        const redos = [];
        for (let undo_i = undos.length - 1; undo_i >= 0; undo_i--) {
            const undo = undos[undo_i];
            const block = this.tmdata.data[this.tmdata.columns * undo.y + undo.x];
            if (undo.cursor) {
                redos.push({
                    ...Object.assign(block),
                    x: undo.x,
                    y: undo.y,
                    cursor: Object.assign(undo.cursor),
                });
            } else {
                redos.push({ ...Object.assign(block), x: undo.x, y: undo.y });
            }
            block.code = undo.code;
            block.fg = undo.fg;
            block.bg = undo.bg;
            libtextmode.render_at(this.render, undo.x, undo.y, block);
            if (undo.cursor) this.emit("move_to", undo.cursor.prev_x, undo.cursor.prev_y);
        }
        this.redo_buffer.push({ type: undo_types.INDIVIDUAL, data: redos });
    }

    redo_individual(redos) {
        const undos = [];
        for (let redo_i = redos.length - 1; redo_i >= 0; redo_i--) {
            const redo = redos[redo_i];
            const block = this.tmdata.data[this.tmdata.columns * redo.y + redo.x];
            if (redo.cursor) {
                undos.push({
                    ...Object.assign(block),
                    x: redo.x,
                    y: redo.y,
                    cursor: Object.assign(redo.cursor),
                });
            } else {
                undos.push({ ...Object.assign(block), x: redo.x, y: redo.y });
            }
            block.code = redo.code;
            block.fg = redo.fg;
            block.bg = redo.bg;
            libtextmode.render_at(this.render, redo.x, redo.y, block);
            if (redo.cursor) this.emit("move_to", redo.cursor.post_x, redo.cursor.post_y);
        }
        this.undo_buffer.push({ type: undo_types.INDIVIDUAL, data: undos });
    }

    copy_blocks(blocks) {
        this.tmdata.columns = blocks.columns;
        this.tmdata.rows = blocks.rows;
        this.tmdata.data = new Array(this.tmdata.columns * this.tmdata.rows);
        for (let i = 0; i < this.tmdata.data.length; i++)
            this.tmdata.data[i] = Object.assign(blocks.data[i]);
    }

    undo_resize(blocks) {
        this.redo_buffer.push({
            type: undo_types.RESIZE,
            data: libtextmode.get_all_blocks(this.tmdata),
        });
        this.copy_blocks(blocks);
        this.emit("resize");
    }

    redo_resize(blocks) {
        this.undo_buffer.push({
            type: undo_types.RESIZE,
            data: libtextmode.get_all_blocks(this.tmdata),
        });
        this.copy_blocks(blocks);
        this.emit("resize");
    }

    push_insert_row(y, blocks) {
        this.start_chunk(undo_types.INSERT_ROW, { y, blocks });
    }

    push_delete_row(y, blocks) {
        this.start_chunk(undo_types.DELETE_ROW, { y, blocks });
    }

    push_insert_column(x, blocks) {
        this.start_chunk(undo_types.INSERT_COLUMN, { x, blocks });
    }

    push_delete_column(x, blocks) {
        this.start_chunk(undo_types.DELETE_COLUMN, { x, blocks });
    }

    push_scroll_canvas_up() {
        this.start_chunk(undo_types.SCROLL_CANVAS_UP);
    }

    push_scroll_canvas_down() {
        this.start_chunk(undo_types.SCROLL_CANVAS_DOWN);
    }

    push_scroll_canvas_left() {
        this.start_chunk(undo_types.SCROLL_CANVAS_LEFT);
    }

    push_scroll_canvas_right() {
        this.start_chunk(undo_types.SCROLL_CANVAS_RIGHT);
    }

    undo_insert_row(data) {
        this.redo_buffer.push({
            type: undo_types.DELETE_ROW,
            data: {
                y: data.y,
                blocks: libtextmode.delete_row(this.tmdata, data.y, data.blocks),
            },
        });
        libtextmode.render_delete_row(this.tmdata, data.y, this.render);
    }

    undo_delete_row(data) {
        this.redo_buffer.push({
            type: undo_types.INSERT_ROW,
            data: {
                y: data.y,
                blocks: libtextmode.insert_row(this.tmdata, data.y, data.blocks),
            },
        });
        libtextmode.render_insert_row(this.tmdata, data.y, this.render);
    }

    undo_insert_column(data) {
        this.redo_buffer.push({
            type: undo_types.DELETE_COLUMN,
            data: {
                x: data.x,
                blocks: libtextmode.delete_column(this.tmdata, data.x, data.blocks),
            },
        });
        libtextmode.render_delete_column(this.tmdata, data.x, this.render);
    }

    undo_delete_column(data) {
        this.redo_buffer.push({
            type: undo_types.INSERT_COLUMN,
            data: {
                x: data.x,
                blocks: libtextmode.insert_column(this.tmdata, data.x, data.blocks),
            },
        });
        libtextmode.render_insert_column(this.tmdata, data.x, this.render);
    }

    undo_scroll_canvas_up() {
        libtextmode.scroll_canvas_down(this.tmdata);
        this.redo_buffer.push({
            type: undo_types.SCROLL_CANVAS_DOWN,
            data: [],
        });
        libtextmode.render_scroll_canvas_down(this.tmdata, this.render);
    }

    undo_scroll_canvas_down() {
        libtextmode.scroll_canvas_up(this.tmdata);
        this.redo_buffer.push({ type: undo_types.SCROLL_CANVAS_UP, data: [] });
        libtextmode.render_scroll_canvas_up(this.tmdata, this.render);
    }

    undo_scroll_canvas_left() {
        libtextmode.scroll_canvas_right(this.tmdata);
        this.redo_buffer.push({
            type: undo_types.SCROLL_CANVAS_RIGHT,
            data: [],
        });
        libtextmode.render_scroll_canvas_right(this.tmdata, this.render);
    }

    undo_scroll_canvas_right() {
        libtextmode.scroll_canvas_left(this.tmdata);
        this.redo_buffer.push({
            type: undo_types.SCROLL_CANVAS_LEFT,
            data: [],
        });
        libtextmode.render_scroll_canvas_left(this.tmdata, this.render);
    }

    redo_scroll_canvas_up() {
        libtextmode.scroll_canvas_down(this.tmdata);
        this.undo_buffer.push({
            type: undo_types.SCROLL_CANVAS_DOWN,
            data: [],
        });
        libtextmode.render_scroll_canvas_down(this.tmdata, this.render);
    }

    redo_scroll_canvas_down() {
        libtextmode.scroll_canvas_up(this.tmdata);
        this.undo_buffer.push({ type: undo_types.SCROLL_CANVAS_UP, data: [] });
        libtextmode.render_scroll_canvas_up(this.tmdata, this.render);
    }

    redo_scroll_canvas_left() {
        libtextmode.scroll_canvas_right(this.tmdata);
        this.undo_buffer.push({
            type: undo_types.SCROLL_CANVAS_RIGHT,
            data: [],
        });
        libtextmode.render_scroll_canvas_right(this.tmdata, this.render);
    }

    redo_scroll_canvas_right() {
        libtextmode.scroll_canvas_left(this.tmdata);
        this.undo_buffer.push({
            type: undo_types.SCROLL_CANVAS_LEFT,
            data: [],
        });
        libtextmode.render_scroll_canvas_left(this.tmdata, this.render);
    }

    redo_insert_row(data) {
        this.undo_buffer.push({
            type: undo_types.DELETE_ROW,
            data: {
                y: data.y,
                blocks: libtextmode.delete_row(this.tmdata, data.y, data.blocks),
            },
        });
        libtextmode.render_delete_row(this.tmdata, data.y, this.render);
    }

    redo_delete_row(data) {
        this.undo_buffer.push({
            type: undo_types.INSERT_ROW,
            data: {
                y: data.y,
                blocks: libtextmode.insert_row(this.tmdata, data.y, data.blocks),
            },
        });
        libtextmode.render_insert_row(this.tmdata, data.y, this.render);
    }

    redo_insert_column(data) {
        this.undo_buffer.push({
            type: undo_types.DELETE_COLUMN,
            data: {
                x: data.x,
                blocks: libtextmode.delete_column(this.tmdata, data.x, data.blocks),
            },
        });
        libtextmode.render_delete_column(this.tmdata, data.x, this.render);
    }

    redo_delete_column(data) {
        this.undo_buffer.push({
            type: undo_types.INSERT_COLUMN,
            data: {
                x: data.x,
                blocks: libtextmode.insert_column(this.tmdata, data.x, data.blocks),
            },
        });
        libtextmode.render_insert_column(this.tmdata, data.x, this.render);
    }

    undo() {
        if (this.undo_buffer.length) {
            const undo = this.undo_buffer.pop();
            switch (undo.type) {
                case undo_types.INDIVIDUAL:
                    this.undo_individual(undo.data);
                    break;
                case undo_types.RESIZE:
                    this.undo_resize(undo.data);
                    break;
                case undo_types.INSERT_ROW:
                    this.undo_insert_row(undo.data);
                    break;
                case undo_types.DELETE_ROW:
                    this.undo_delete_row(undo.data);
                    break;
                case undo_types.INSERT_COLUMN:
                    this.undo_insert_column(undo.data);
                    break;
                case undo_types.DELETE_COLUMN:
                    this.undo_delete_column(undo.data);
                    break;
                case undo_types.SCROLL_CANVAS_UP:
                    this.undo_scroll_canvas_up();
                    break;
                case undo_types.SCROLL_CANVAS_DOWN:
                    this.undo_scroll_canvas_down();
                    break;
                case undo_types.SCROLL_CANVAS_LEFT:
                    this.undo_scroll_canvas_left();
                    break;
                case undo_types.SCROLL_CANVAS_RIGHT:
                    this.undo_scroll_canvas_right();
                    break;
            }
            send("enable_redo");
            if (this.undo_buffer.length == 0) send("disable_undo");
        }
    }

    redo() {
        if (this.redo_buffer.length) {
            const redo = this.redo_buffer.pop();
            switch (redo.type) {
                case undo_types.INDIVIDUAL:
                    this.redo_individual(redo.data);
                    break;
                case undo_types.RESIZE:
                    this.redo_resize(redo.data);
                    break;
                case undo_types.INSERT_ROW:
                    this.redo_insert_row(redo.data);
                    break;
                case undo_types.DELETE_ROW:
                    this.redo_delete_row(redo.data);
                    break;
                case undo_types.INSERT_COLUMN:
                    this.redo_insert_column(redo.data);
                    break;
                case undo_types.DELETE_COLUMN:
                    this.redo_delete_column(redo.data);
                    break;
                case undo_types.SCROLL_CANVAS_UP:
                    this.redo_scroll_canvas_up();
                    break;
                case undo_types.SCROLL_CANVAS_DOWN:
                    this.redo_scroll_canvas_down();
                    break;
                case undo_types.SCROLL_CANVAS_LEFT:
                    this.redo_scroll_canvas_left();
                    break;
                case undo_types.SCROLL_CANVAS_RIGHT:
                    this.redo_scroll_canvas_right();
                    break;
            }
            send("enable_undo");
            if (this.redo_buffer.length == 0) send("disable_redo");
        }
    }

    push(x, y, block, cursor) {
        if (cursor) {
            this.undo_buffer[this.undo_buffer.length - 1].data.push({
                x,
                y,
                ...Object.assign(block),
                cursor: Object.assign(cursor),
            });
        } else {
            this.undo_buffer[this.undo_buffer.length - 1].data.push({
                x,
                y,
                ...Object.assign(block),
            });
        }
    }

    get render() {
        return this.doc._render;
    }

    get tmdata() {
        return this.doc._tmdata;
    }

    /**
     * @param {TextModeDoc} doc
     */
    constructor(doc) {
        super();
        this.doc = doc;

        on("undo", (event) => this.undo());
        on("redo", (event) => this.redo());
        this.undo_buffer = [];
        this.redo_buffer = [];
    }
}

/**
 * High-level document manager for text-mode art files (ANSI, XBin, etc.)
 *
 * Structure:
 * - this._tmdata: TextModeData instance containing raw document data (columns, rows,
 *   character grid, metadata)
 * - this._render: Rendering context with HTML5 canvases and font rendering engine
 * - this.undo_history: UndoHistory instance for tracking document changes
 * - this.mirror_mode: Boolean for symmetric editing mode
 *
 * The TextModeDoc acts as a facade around the core TextModeData structure, providing:
 * - Document editing operations (change_data, fill, erase, etc.)
 * - Canvas rendering management via libtextmode.render_split()
 * - Undo/redo functionality
 * - File I/O operations (open, save, export)
 * - Event emission for UI updates
 *
 * A singleton instance is exported and used throughout the application.
 */
class TextModeDoc extends events.EventEmitter {
    constructor() {
        super();

        this._tmdata = null;
        this._render = null;
        this.init = false;
        this.mirror_mode = false;
        this.edited = false;

        this.undo_history = new UndoHistory(this);
        this.undo_history.on("resize", () => this.start_rendering());

        on("ice_colors", (event, value) => (this.ice_colors = value));
        on("use_9px_font", (event, value) => (this.use_9px_font = value));
        on("load_custom_font", (event) => this.load_custom_font());
        on("import_font", (event) => this.import_font());
        on("change_font", (event, font_name) => (this.font_name = font_name));
        on("change_palette", (event, lospec_palette_name) =>
            this.set_lospec_palette(lospec_palette_name)
        );
        on("get_sauce_info", (event) =>
            send_sync("get_sauce_info", {
                title: this.title,
                author: this.author,
                group: this.group,
                comments: this.comments,
            })
        );
        on("get_canvas_size", (event) =>
            send_sync("get_canvas_size", {
                columns: this.columns,
                rows: this.rows,
            })
        );
        on("set_canvas_size", (event, { columns, rows }) => this.resize(columns, rows));
        on("set_sauce_info", (event, { title, author, group, comments }) =>
            this.set_sauce(title, author, group, comments)
        );
        on("mirror_mode", (event, value) => (this.mirror_mode = value));
    }

    async new_document(options = {}) {
        this._tmdata = libtextmode.new_tmdata(options);
        await this.start_rendering();
        this.emit("new_document");
        this.ready();
    }

    async start_rendering() {
        const big_data = this.data.length > 80 * 1000;
        if (big_data) this.emit("start_rendering");
        this._render = await libtextmode.render_split(this._tmdata);
        if (big_data) this.emit("end_rendering");
        this.emit("render");
    }

    ready() {
        if (!this.init) {
            this.emit("ready");
            this.init = true;
        }
    }

    get render() {
        return this._render;
    }
    get font() {
        return this._render.font;
    }
    get font_height() {
        return this._render.font.height;
    }
    get columns() {
        return this._tmdata.columns;
    }
    get rows() {
        return this._tmdata.rows;
    }
    get title() {
        return this._tmdata.title;
    }
    get date() {
        return this._tmdata.date;
    }
    get author() {
        return this._tmdata.author;
    }
    get group() {
        return this._tmdata.group;
    }
    get comments() {
        return this._tmdata.comments;
    }
    get palette() {
        return this._tmdata.palette;
    }
    get font_name() {
        return this._tmdata.font_name;
    }
    set font_name(font_name) {
        this._tmdata.font_name = font_name;
        this._tmdata.font_bytes = null;
        this.start_rendering().then(() => this.emit("change_font", this.font_name));
    }
    get font_bytes() {
        return this._tmdata.font_bytes;
    }
    get ice_colors() {
        return this._tmdata.ice_colors;
    }
    set ice_colors(value) {
        this._tmdata.ice_colors = value;
        this.emit("ice_colors", this.ice_colors);
    }
    get use_9px_font() {
        return this._tmdata.use_9px_font;
    }
    set use_9px_font(value) {
        this._tmdata.use_9px_font = value;
        this.start_rendering().then(() => this.emit("use_9px_font", this.use_9px_font));
    }
    get data() {
        return this._tmdata.data;
    }

    set_sauce(title, author, group, comments) {
        this._tmdata.title = title;
        this._tmdata.author = author;
        this._tmdata.group = group;
        this._tmdata.comments = comments;
        send("update_sauce", { title, author, group, comments });
    }

    set_lospec_palette(lospec_palette_name) {
        this.start_rendering().then(() => this.emit("change_palette", lospec_palette_name));
    }

    at(x, y) {
        if (x < 0 || x >= this.columns || y < 0 || y >= this.rows) return;
        return this.data[y * this.columns + x];
    }

    get_blocks(sx, sy, dx, dy) {
        return libtextmode.get_blocks(this._tmdata, sx, sy, dx, dy);
    }

    change_data(x, y, code, fg, bg, prev_cursor, cursor, mirrored = true) {
        if (x < 0 || x >= this.columns || y < 0 || y >= this.rows) return;
        const i = this.columns * y + x;
        if (prev_cursor) {
            this.undo_history.push(x, y, this.data[i], {
                prev_x: prev_cursor.prev_x,
                prev_y: prev_cursor.prev_y,
                post_x: cursor.x,
                post_y: cursor.y,
            });
        } else {
            this.undo_history.push(x, y, this.data[i]);
        }
        this.data[i] = { code, fg, bg };
        libtextmode.render_at(this.render, x, y, this.data[i]);
        if (this.mirror_mode && mirrored) {
            const opposing_x = Math.floor(this.columns / 2) - (x - Math.ceil(this.columns / 2)) - 1;
            this.change_data(
                opposing_x,
                y,
                libtextmode.flip_code_x(code),
                fg,
                bg,
                undefined,
                undefined,
                false
            );
        }
    }

    update_palette(index, rgb) {
        this.palette[index] = rgb;
        this.render.font.replace_cache_at(index, rgb);

        // TODO: should this be undoable? it doesn't fit in nicely, but I think it should be.
        for (let y = 0; y <= this.rows - 1; y++) {
            for (let x = 0; x <= this.columns - 1; x++) {
                const block = this.data[this.columns * y + x];
                if (block.bg === index || block.fg === index) {
                    libtextmode.render_at(this.render, x, y, block);
                }
            }
        }
    }

    clear_at(x, y, prev_cursor, cursor) {
        this.change_data(x, y, 32, 7, 0, prev_cursor, cursor);
    }

    start_undo() {
        this.undo_history.start_chunk();
    }

    get_half_block(x, y) {
        const text_y = Math.floor(y / 2);
        const is_top = y % 2 == 0;
        const block = this.data[this.columns * text_y + x];
        let upper_block_color = 0;
        let lower_block_color = 0;
        let left_block_color = 0;
        let right_block_color = 0;
        let is_blocky = false;
        let is_vertically_blocky = false;
        switch (block.code) {
            case 0:
            case 32:
            case 255:
                upper_block_color = block.bg;
                lower_block_color = block.bg;
                is_blocky = true;
                break;
            case 220:
                upper_block_color = block.bg;
                lower_block_color = block.fg;
                is_blocky = true;
                break;
            case 223:
                upper_block_color = block.fg;
                lower_block_color = block.bg;
                is_blocky = true;
                break;
            case 219:
                upper_block_color = block.fg;
                lower_block_color = block.fg;
                is_blocky = true;
                break;
            case 221:
                left_block_color = block.fg;
                right_block_color = block.bg;
                is_vertically_blocky = true;
                break;
            case 222:
                left_block_color = block.bg;
                right_block_color = block.fg;
                is_vertically_blocky = true;
                break;
            default:
                if (block.fg == block.bg) {
                    is_blocky = true;
                    upper_block_color = block.fg;
                    lower_block_color = block.fg;
                } else {
                    is_blocky = false;
                }
        }
        return {
            x,
            y,
            text_y,
            is_blocky,
            is_vertically_blocky,
            upper_block_color,
            lower_block_color,
            left_block_color,
            right_block_color,
            is_top,
            fg: block.fg,
            bg: block.bg,
        };
    }

    optimize_block(x, y) {
        const block = this.at(x, y);
        if (block.fg == 0) {
            if (block.bg == 0 || block.code == 219) {
                this.change_data(x, y, 32, 7, 0);
            } else {
                switch (block.code) {
                    case 220:
                        this.change_data(x, y, 223, block.bg, block.fg);
                        break;
                    case 223:
                        this.change_data(x, y, 220, block.bg, block.fg);
                        break;
                }
            }
        } else if (block.fg < 8 && block.bg >= 8) {
            const half_block = this.get_half_block(x, y);
            if (half_block.is_blocky) {
                switch (block.code) {
                    case 220:
                        this.change_data(x, y, 223, block.bg, block.fg);
                        break;
                    case 223:
                        this.change_data(x, y, 220, block.bg, block.fg);
                        break;
                }
            } else if (half_block.is_vertically_blocky) {
                switch (block.code) {
                    case 221:
                        this.change_data(x, y, 222, block.bg, block.fg);
                        break;
                    case 222:
                        this.change_data(x, y, 221, block.bg, block.fg);
                        break;
                }
            }
        }
    }

    set_half_block(x, y, col) {
        if (x < 0 || x >= this.columns || y < 0 || y >= this.rows * 2) return;
        const block = this.get_half_block(x, y);
        if (block.is_blocky) {
            if (
                (block.is_top && block.lower_block_color == col) ||
                (!block.is_top && block.upper_block_color == col)
            ) {
                this.change_data(x, block.text_y, 219, col, 0);
            } else if (block.is_top) {
                this.change_data(x, block.text_y, 223, col, block.lower_block_color);
            } else {
                this.change_data(x, block.text_y, 220, col, block.upper_block_color);
            }
        } else {
            if (block.is_top) {
                this.change_data(x, block.text_y, 223, col, block.bg);
            } else {
                this.change_data(x, block.text_y, 220, col, block.bg);
            }
        }
        this.optimize_block(block.x, block.text_y);
    }

    resize(columns, rows) {
        this.undo_history.push_resize();

        const min_rows = Math.min(this.rows, rows);
        const min_columns = Math.min(this.columns, columns);
        const new_data = new Array(columns * rows);
        for (let i = 0; i < new_data.length; i++) {
            new_data[i] = { code: 32, fg: 7, bg: 0 };
        }
        for (let y = 0; y < min_rows; y++) {
            for (let x = 0; x < min_columns; x++) {
                new_data[y * columns + x] = this.data[y * this.columns + x];
            }
        }
        this._tmdata.data = new_data;
        this._tmdata.columns = columns;
        this._tmdata.rows = rows;

        const { toggle_off_guide } = require("./ui/ui");
        toggle_off_guide();

        this.start_rendering();
    }

    count_left(y) {
        for (let x = 0; x < this.columns; x++) {
            const half_block = this.get_half_block(x, y * 2);
            if (
                !half_block.is_blocky ||
                half_block.lower_block_color != 0 ||
                half_block.lower_block_color != 0
            )
                return x;
        }
        return 0;
    }

    count_right(y) {
        for (let x = 0; x < this.columns; x++) {
            const half_block = this.get_half_block(this.columns - 1 - x, y * 2);
            if (
                !half_block.is_blocky ||
                half_block.lower_block_color != 0 ||
                half_block.lower_block_color != 0
            )
                return x;
        }
        return 0;
    }

    left_justify_line(y) {
        const count = this.count_left(y);
        if (count) {
            this.undo_history.start_chunk();
            for (let x = 0; x < this.columns - count; x++) {
                const block = this.data[y * this.columns + x + count];
                this.change_data(x, y, block.code, block.fg, block.bg);
            }
            for (let x = this.columns - count; x < this.columns; x++)
                this.change_data(x, y, 32, 7, 0);
        }
    }

    right_justify_line(y) {
        const count = this.count_right(y);
        if (count) {
            this.undo_history.start_chunk();
            for (let x = this.columns - 1; x > count - 1; x--) {
                const block = this.data[y * this.columns + x - count];
                this.change_data(x, y, block.code, block.fg, block.bg);
            }
            for (let x = count - 1; x >= 0; x--) this.change_data(x, y, 32, 7, 0);
        }
    }

    center_line(y) {
        const left = this.count_left(y);
        const right = this.count_right(y);
        if (left || right) {
            this.undo_history.start_chunk();
            const blocks = new Array(this.columns - right - left);
            for (let i = 0; i < blocks.length; i++)
                blocks[i] = Object.assign(this.data[y * this.columns + left + i]);
            const new_left = Math.floor((left + right) / 2);
            for (let x = 0; x < new_left; x++) this.change_data(x, y, 32, 7, 0);
            for (let x = 0; x < blocks.length; x++)
                this.change_data(new_left + x, y, blocks[x].code, blocks[x].fg, blocks[x].bg);
            for (let x = 0; x < this.columns - new_left - blocks.length; x++)
                this.change_data(new_left + blocks.length + x, y, 32, 7, 0);
        }
    }

    erase_line(y) {
        this.undo_history.start_chunk();
        for (let x = 0; x < this.columns; x++) this.change_data(x, y, 32, 7, 0);
    }

    erase_to_start_of_line(x, y) {
        this.undo_history.start_chunk();
        for (let dx = 0; dx <= x; dx++) this.change_data(dx, y, 32, 7, 0);
    }

    erase_to_end_of_line(x, y) {
        this.undo_history.start_chunk();
        for (let dx = x; dx < this.columns; dx++) this.change_data(dx, y, 32, 7, 0);
    }

    erase_column(x) {
        this.undo_history.start_chunk();
        for (let y = 0; y < this.rows; y++) this.change_data(x, y, 32, 7, 0);
    }

    erase_to_start_of_column(x, y) {
        this.undo_history.start_chunk();
        for (let dy = 0; dy <= y; dy++) this.change_data(x, dy, 32, 7, 0);
    }

    erase_to_end_of_column(x, y) {
        this.undo_history.start_chunk();
        for (let dy = y; dy < this.rows; dy++) this.change_data(x, dy, 32, 7, 0);
    }

    place(blocks, dx, dy, single_undo) {
        const mid_point = Math.floor(this.columns / 2);
        const dont_mirror = dx < mid_point && dx + blocks.columns > mid_point;
        if (!single_undo) this.undo_history.start_chunk();
        for (let y = 0; y + dy < this.rows && y < blocks.rows; y++) {
            for (let x = 0; x + dx < this.columns && x < blocks.columns; x++) {
                const block = blocks.data[y * blocks.columns + x];
                if (!blocks.transparent || block.code != 32 || block.bg != 0)
                    this.change_data(
                        dx + x,
                        dy + y,
                        block.code,
                        block.fg,
                        block.bg,
                        undefined,
                        undefined,
                        !dont_mirror
                    );
            }
        }
    }

    fill_with_code(sx, sy, dx, dy, code, fg, bg) {
        this.undo_history.start_chunk();
        for (let y = sy; y <= dy; y++) {
            for (let x = sx; x <= dx; x++) {
                this.change_data(x, y, code, fg, bg);
            }
        }
    }

    erase(sx, sy, dx, dy) {
        this.fill_with_code(sx, sy, dx, dy, 32, 7, 0);
    }

    fill(sx, sy, dx, dy, col) {
        if (col == 0) {
            this.erase(sx, sy, dx, dy);
        } else {
            this.fill_with_code(sx, sy, dx, dy, 219, col, 0);
        }
    }

    undo() {
        this.undo_history.undo();
    }

    redo() {
        this.undo_history.redo();
    }

    insert_row(y) {
        this.undo_history.push_insert_row(y, libtextmode.insert_row(this._tmdata, y));
        libtextmode.render_insert_row(this._tmdata, y, this.render);
    }

    delete_row(y) {
        this.undo_history.push_delete_row(y, libtextmode.delete_row(this._tmdata, y));
        libtextmode.render_delete_row(this._tmdata, y, this.render);
    }

    insert_column(x) {
        this.undo_history.push_insert_column(x, libtextmode.insert_column(this._tmdata, x));
        libtextmode.render_insert_column(this._tmdata, x, this.render);
    }

    delete_column(x) {
        this.undo_history.push_delete_column(x, libtextmode.delete_column(this._tmdata, x));
        libtextmode.render_delete_column(this._tmdata, x, this.render);
    }

    scroll_canvas_up() {
        libtextmode.scroll_canvas_up(this._tmdata);
        libtextmode.render_scroll_canvas_up(this._tmdata, this.render);
        this.undo_history.push_scroll_canvas_up();
    }

    scroll_canvas_down() {
        libtextmode.scroll_canvas_down(this._tmdata);
        libtextmode.render_scroll_canvas_down(this._tmdata, this.render);
        this.undo_history.push_scroll_canvas_down();
    }

    scroll_canvas_left() {
        libtextmode.scroll_canvas_left(this._tmdata);
        libtextmode.render_scroll_canvas_left(this._tmdata, this.render);
        this.undo_history.push_scroll_canvas_left();
    }

    scroll_canvas_right() {
        libtextmode.scroll_canvas_right(this._tmdata);
        libtextmode.render_scroll_canvas_right(this._tmdata, this.render);
        this.undo_history.push_scroll_canvas_right();
    }

    async open(file) {
        this._tmdata = await libtextmode.read_file(file);
        this.undo_history.reset_undos();
        this.file = file;
        await this.start_rendering();
        this.emit("new_document");
        this.ready();
        send("set_file", { file: this.file });
    }

    async save(save_without_sauce) {
        if (!this.file) return;
        await libtextmode.write_file(this, this.file, { save_without_sauce });
        send("set_file", { file: this.file });
    }

    async export_selection(sx, sy, dx, dy, file) {
        const blocks = this.get_blocks(sx, sy, dx, dy);
        const tmdata = libtextmode.new_tmdata({ ...blocks });
        await libtextmode.write_file(tmdata, file);
    }

    async share_online() {
        const bytes = libtextmode.encode_as_ansi(this, false);
        const filename = this.file ? path.basename(this.file) : "unknown" + "." + "ans";
        const req = await fetch(
            `https://api.16colo.rs/v1/paste?key=${SIXTEEN_COLORS_API_KEY}&extension=ans&retention=${retention}&filename=${filename}`,
            {
                body: `file=${Buffer.from(bytes).toString("base64")}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method: "POST",
            }
        );
        const resp = await req.json();
        if (resp.results) return resp.results.gallery;
    }

    async export_font(file) {
        await libtextmode.export_font(this, this.render, file);
    }

    async share_online_xbin() {
        const bytes = libtextmode.encode_as_xbin(this);
        const filename = this.file ? path.basename(this.file) : "unknown" + "." + "xb";
        const req = await fetch(
            `https://api.16colo.rs/v1/paste?key=${SIXTEEN_COLORS_API_KEY}&extension=xb&retention=${retention}&filename=${filename}`,
            {
                body: `file=${Buffer.from(bytes).toString("base64")}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method: "POST",
            }
        );
        const resp = await req.json();
        if (resp.results) return resp.results.gallery;
    }

    async save_backup(file) {
        await libtextmode.write_file(this, file);
    }

    async export_as_utf8(file) {
        await libtextmode.write_file(this, file, { utf8: true });
    }

    export_as_png(file) {
        libtextmode.export_as_png(this, this.render, file);
    }

    export_as_apng(file) {
        libtextmode.export_as_apng(this.render, file);
    }

    has_control_characters() {
        var ctrl = false;
        this.data.forEach((block, index) => {
            if (block.code == 9 || block.code == 10 || block.code == 13 || block.code == 26)
                ctrl = true;
        });
        return ctrl;
    }

    duplicate() {
        this.new_document({
            columns: this.columns,
            rows: this.rows,
            data: this.data,
            palette: this.palette,
            font_name: this.font_name,
            use_9px_font: this.use_9px_font,
            ice_colors: this.ice_colors,
            font_bytes: this.font_bytes,
        });
    }

    crop(blocks) {
        this.new_document({
            title: this.title,
            author: this.author,
            group: this.group,
            date: this.date,
            palette: this.palette,
            font_bytes: this.font_bytes,
            font_name: this.font_name,
            use_9px_font: this.use_9px_font,
            ice_colors: this.ice_colors,
            columns: blocks.columns,
            rows: blocks.rows,
            data: blocks.data,
        });
    }

    remove_ice_colors() {
        const data = new Array(this.data.length);

        this.data.forEach((block, index) => {
            if (block.bg > 7 && block.bg < 16) {
                data[index] = libtextmode.remove_ice_color_for_block(block);
            } else {
                data[index] = Object.assign(block);
            }
        });

        this.new_document({
            columns: this.columns,
            rows: this.rows,
            data,
            palette: this.palette,
            font_name: this.font_name,
            use_9px_font: this.use_9px_font,
            ice_colors: false,
        });
    }

    async import_font() {
        const possibleHeights = new Set([
            128, 144, 160, 176, 192, 208, 224, 240, 256, 272, 288, 304, 320, 336, 352, 368, 384,
            400, 416, 432, 448, 464, 480, 496, 512,
        ]);
        const { bytes, filename } = await libtextmode.importFontFromImage();
        const { data, width, height } = await libtextmode.getImageData(bytes);
        if (width !== 128) {
            alert("Wrong image size! Image width should be 128 px");
            return;
        }
        if (!possibleHeights.has(height)) {
            alert(
                "Wrong image size! Image height should be one these: 128, 144, 160, 176, 192, 208, 224, 240, 256, 272, 288, 304, 320, 336, 352, 368, 384, 400, 416, 432, 448, 464, 480, 496, 512 px"
            );
            return;
        }
        const bit_array = await libtextmode.processImageDataTo1bit(data);
        const chunkedBitArray = await libtextmode.rearrangeBitArray(bit_array, height);
        this._tmdata.font_name = path.parse(filename).name;
        this._tmdata.font_bytes = Buffer.from(chunkedBitArray, "hex");
        this.start_rendering().then(() => this.emit("change_font", this.font_name));
    }

    async load_custom_font({ file } = { file: undefined }) {
        if (!file) {
            const files = open_box({
                filters: [
                    {
                        name: "Custom Font",
                        extensions: [
                            "f06",
                            "f07",
                            "f08",
                            "f09",
                            "f10",
                            "f11",
                            "f12",
                            "f13",
                            "f14",
                            "f15",
                            "f16",
                            "f17",
                            "f18",
                            "f19",
                            "f20",
                            "f21",
                            "f22",
                            "f23",
                            "f24",
                            "f25",
                            "f26",
                            "f27",
                            "f28",
                            "f29",
                            "f30",
                            "f31",
                            "f32",
                        ],
                    },
                ],
            });
            if (files === undefined || files.length === 0) return;
            file = files[0];
        }

        const { bytes, filename } = await libtextmode.load_custom_font(file);
        this._tmdata.font_name = path.parse(filename).name;
        this._tmdata.font_bytes = bytes;
        this.start_rendering().then(() => this.emit("change_font", this.font_name));
    }
}

const instance = new TextModeDoc();
module.exports = instance;
module.exports.TextModeDoc = TextModeDoc;
