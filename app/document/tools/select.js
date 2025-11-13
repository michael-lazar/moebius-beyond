const { on, send, open_box, save_box } = require("../../senders");
const doc = require("../doc");
const cursor = require("./cursor");
const keyboard = require("../input/keyboard");
const mouse = require("../input/mouse");
const { tools, statusbar, toolbar } = require("../ui/ui");
const libtextmode = require("../../libtextmode/libtextmode");
const palette = require("../palette");

let enabled = false;
let auto_place_on_release = false;
let pending_move_start = false;
let pending_move_x = 0;
let pending_move_y = 0;
let drag_offset_x = 0;
let drag_offset_y = 0;

tools.on("start", (mode) => {
    enabled = mode == tools.modes.SELECT;
    if (enabled) {
        statusbar.show_cursor_position();
        send("enable_editing_shortcuts");
        cursor.start_editing_mode();
        cursor.show();
        toolbar.show_select();
    } else {
        statusbar.hide_cursor_position();
        statusbar.use_canvas_size_for_status_bar();
        send("disable_editing_shortcuts");
        cursor.hide();
    }
});

function select_all() {
    if (tools.mode != tools.modes.SELECT) tools.start(tools.modes.SELECT);
    if (cursor.mode != tools.modes.SELECT) cursor.start_editing_mode();
    cursor.move_to(0, 0, false);
    cursor.start_selection_mode();
    cursor.move_to(doc.columns - 1, doc.rows - 1, false);
}

on("select_all", (event) => select_all());
keyboard.on("select_all", () => select_all());

/**
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function is_click_within_selection(x, y) {
    const { sx, sy, dx, dy } = cursor.reorientate_selection();
    return x >= sx && x <= dx && y >= sy && y <= dy;
}

function mouse_down(x, y, half_y, is_legal) {
    if (!enabled || !is_legal) return;

    auto_place_on_release = false;
    pending_move_start = false;

    switch (cursor.mode) {
        case cursor.modes.EDITING:
            mouse.record_start();
            cursor.move_to(x, y, false);
            break;
        case cursor.modes.SELECTION:
            // Check if clicking within existing selection
            if (is_click_within_selection(x, y)) {
                // Calculate offset from click position to top-left of selection
                const { sx, sy } = cursor.reorientate_selection();
                drag_offset_x = x - sx;
                drag_offset_y = y - sy;

                // Mark as pending move - will start move mode only if user drags
                pending_move_start = true;
                pending_move_x = x;
                pending_move_y = y;
                mouse.record_start();
            } else {
                // Start new selection
                cursor.start_editing_mode();
                mouse.record_start();
                cursor.move_to(x, y, false);
            }
            break;
        case cursor.modes.OPERATION:
            cursor.move_to(x, y, false);
            cursor.place();
            break;
    }
}

function mouse_to(x, y) {
    if (!enabled) return;
    x = Math.max(Math.min(doc.columns - 1, x), 0);
    y = Math.max(Math.min(doc.rows - 1, y), 0);

    // If we have a pending move, start it now (user is dragging)
    if (pending_move_start) {
        pending_move_start = false;
        cursor.start_move();
        // Move to position that maintains the offset from the original click
        const target_x = Math.max(0, pending_move_x - drag_offset_x);
        const target_y = Math.max(0, pending_move_y - drag_offset_y);
        cursor.move_to(target_x, target_y, false);
        auto_place_on_release = true;
    }

    switch (cursor.mode) {
        case cursor.modes.EDITING:
            cursor.start_selection_mode();
            cursor.move_to(x, y, false);
            break;
        case cursor.modes.SELECTION:
            cursor.move_to(x, y, false);
            break;
        case cursor.modes.OPERATION: {
            // Apply offset during drag to keep selection under cursor
            const target_x = Math.max(0, x - drag_offset_x);
            const target_y = Math.max(0, y - drag_offset_y);
            cursor.move_to(target_x, target_y, false);
            break;
        }
    }
}

function mouse_move(x, y) {
    if (!enabled) return;
    x = Math.max(Math.min(doc.columns - 1, x), 0);
    y = Math.max(Math.min(doc.rows - 1, y), 0);
    if (cursor.mode == cursor.modes.OPERATION) cursor.move_to(x, y, false);
}

function mouse_up() {
    if (!enabled) return;

    // If pending move was never started (user clicked without dragging),
    // use original behavior: exit selection mode and move cursor to click position
    if (pending_move_start) {
        pending_move_start = false;
        cursor.start_editing_mode();
        cursor.move_to(pending_move_x, pending_move_y, false);
        return;
    }

    // Auto-place selection if we started move via click-and-drag
    if (auto_place_on_release && cursor.mode == cursor.modes.OPERATION) {
        cursor.place();
        auto_place_on_release = false;
    }
}

mouse.on("down", mouse_down);
mouse.on("to", mouse_to);
mouse.on("move", mouse_move);
mouse.on("up", mouse_up);

keyboard.on("escape", () => {
    if (!enabled) return;
    if (cursor.mode != cursor.modes.EDITING) {
        cursor.deselect();
    } else {
        palette.select_attribute();
    }
});

on("select_attribute", (event) => {
    if (!enabled) return;
    if (cursor.mode == cursor.modes.EDITING) palette.select_attribute();
});

on("import_selection", async (event) => {
    const file = open_box({
        filters: [
            {
                name: "TextArt",
                extensions: ["ans", "xb", "bin", "diz", "asc", "txt", "nfo"],
            },
            { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
    });
    if (file) {
        if (!enabled) tools.start(tools.modes.SELECT);
        const blocks = await libtextmode.read_file(file[0]);
        cursor.set_operation_mode(blocks, false);
    }
});

on("export_selection", async (event) => {
    if (!enabled || cursor.mode == cursor.modes.EDITING) return;
    const file = save_box(doc.file, "ans", {
        filters: [
            {
                name: "ANSI Art",
                extensions: ["ans", "asc", "diz", "nfo", "txt"],
            },
            { name: "XBin", extensions: ["xb"] },
            { name: "Binary Text", extensions: ["bin"] },
        ],
    });
    if (file) {
        const { sx, sy, dx, dy } = cursor.reorientate_selection();
        await doc.export_selection(sx, sy, dx, dy, file);
    }
});
