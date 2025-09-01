const electron = require("electron");
const { on, send, send_sync, open_box } = require("../../senders");
const doc = require("../doc");
const palette = require("../palette");
const keyboard = require("../input/keyboard");
const events = require("events");

let interval, guide_columns, guide_rows, grid_columns;

let canvas_zoom = 1.0;
let charlist_zoom_toggled = false;
let preview_visible = true;
let toolbar_visible = true;
let statusbar_visible = true;
let charlist_visible = true;

function $(name) {
    return document.getElementById(name);
}

function set_var(name, value) {
    document.documentElement.style.setProperty(`--${name}`, value);
}

function get_var(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

function open_reference_image({ file } = { file: undefined }) {
    if (!file) {
        const files = open_box({
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
        });
        if (files === undefined || files.length === 0) return;
        file = files[0];
    }

    $("reference_image").src = electron.nativeImage.createFromPath(file).toDataURL();
    $("reference_image").classList.remove("closed");
    set_var("reference-control-opacity", 1.0);

    reset_reference_image();
    show_reference_image();

    send("enable_reference_image");
}

function clear_reference_image() {
    $("reference_image").src = "";
    $("reference_image").classList.add("closed");
    set_var("reference-control-opacity", 0.4);

    $("reference_hide").classList.remove("brush_mode_selected");
    $("reference_show").classList.remove("brush_mode_selected");

    send("disable_clear_reference_image");
}

function reset_reference_image() {
    $("reference_image").style.top = "0";
    $("reference_image").style.left = "0";

    $("reference_opacity_value").value = 40;
    $("reference_opacity_value").dispatchEvent(new Event("input", { bubbles: true }));

    $("reference_size_value").value = doc.columns;
    $("reference_size_value").dispatchEvent(new Event("input", { bubbles: true }));

    $("reference_angle_value").value = 0;
    $("reference_angle_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function toggle_reference_image(visible) {
    if (visible) {
        show_reference_image();
    } else {
        hide_reference_image();
    }
}

function show_reference_image() {
    if ($("reference_image").classList.contains("closed")) return;

    $("reference_hide").classList.remove("brush_mode_selected");
    $("reference_show").classList.add("brush_mode_selected");
    $("reference_image").classList.remove("hidden");
    send("show_reference_image");
}

function hide_reference_image() {
    if ($("reference_image").classList.contains("closed")) return;

    $("reference_hide").classList.add("brush_mode_selected");
    $("reference_show").classList.remove("brush_mode_selected");
    $("reference_image").classList.add("hidden");
    send("hide_reference_image");
}

function increase_reference_image_opacity() {
    $("reference_opacity_value").stepUp(1);
    $("reference_opacity_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function decrease_reference_image_opacity() {
    $("reference_opacity_value").stepDown(1);
    $("reference_opacity_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function on_update_reference_opacity_value(event) {
    if (Number.isNaN(event.target.value)) return;
    $("reference_image").style.opacity = `${event.target.value / 100}`;
}

function increase_reference_image_size() {
    $("reference_size_value").stepUp(1);
    $("reference_size_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function decrease_reference_image_size() {
    $("reference_size_value").stepDown(1);
    $("reference_size_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function on_update_reference_size_value(event) {
    if (Number.isNaN(event.target.value)) return;
    let width = doc.use_9px_font ? event.target.value * 9 : event.target.value * 8;
    $("reference_image").style.width = `${width}px`;
}

function increase_reference_image_angle() {
    $("reference_angle_value").stepUp(1);
    $("reference_angle_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function decrease_reference_image_angle() {
    $("reference_angle_value").stepDown(1);
    $("reference_angle_value").dispatchEvent(new Event("input", { bubbles: true }));
}

function on_update_reference_angle_value(event) {
    if (Number.isNaN(event.target.value)) return;
    $("reference_image").style.transform = `rotate(${event.target.value}deg)`;
}

on("open_reference_image", (event) => open_reference_image());
on("toggle_reference_image", (event, visible) => toggle_reference_image(visible));
on("clear_reference_image", (event) => clear_reference_image());

function set_text(name, text) {
    $(name).textContent = text;
}

function toggle_off_guide() {
    send("uncheck_all_guides");
    $("drawing_grid").classList.add("hidden");
}

function toggle_smallscale_guide(visible) {
    send("uncheck_all_guides");
    if (visible) {
        guide_columns = 80;
        guide_rows = 25;
        rescale_guide();
        $("guide").classList.remove("hidden");
        $("drawing_grid").classList.add("hidden");
        send("check_smallscale_guide");
    } else {
        $("guide").classList.add("hidden");
    }
}

function toggle_square_guide(visible) {
    send("uncheck_all_guides");
    if (visible) {
        guide_columns = 80;
        guide_rows = 40;
        rescale_guide();
        $("guide").classList.remove("hidden");
        $("drawing_grid").classList.add("hidden");
        send("check_square_guide");
    } else {
        $("guide").classList.add("hidden");
    }
}

function toggle_instagram_guide(visible) {
    send("uncheck_all_guides");
    if (visible) {
        guide_columns = 80;
        guide_rows = 50;
        rescale_guide();
        $("guide").classList.remove("hidden");
        $("drawing_grid").classList.add("hidden");
        send("check_instagram_guide");
    } else {
        $("guide").classList.add("hidden");
    }
}

function toggle_file_id_guide(visible) {
    send("uncheck_all_guides");
    if (visible) {
        guide_columns = 44;
        guide_rows = 22;
        rescale_guide();
        $("guide").classList.remove("hidden");
        $("drawing_grid").classList.add("hidden");
        send("check_file_id_guide");
    } else {
        $("guide").classList.add("hidden");
    }
}

function toggle_petscii_guide(visible) {
    send("uncheck_all_guides");
    if (visible) {
        guide_columns = 40;
        guide_rows = 25;
        rescale_guide();
        $("guide").classList.remove("hidden");
        $("drawing_grid").classList.add("hidden");
        send("check_petscii_guide");
    } else {
        $("guide").classList.add("hidden");
    }
}

function rescale_guide() {
    $("guide").style.width = `${doc.render.font.width * Math.min(doc.columns, guide_columns)}px`;
    $("guide").style.height = `${doc.render.font.height * Math.min(doc.rows, guide_rows)}px`;
    if (doc.columns >= guide_columns) {
        $("guide").classList.add("guide_column");
    } else {
        $("guide").classList.remove("guide_column");
    }
    if (doc.rows >= guide_rows) {
        $("guide").classList.add("guide_row");
    } else {
        $("guide").classList.remove("guide_row");
    }
}

function toggle_drawinggrid(visible, columns) {
    $("guide").classList.add("hidden");
    send("uncheck_all_guides");
    if (visible) {
        grid_columns = columns;
        rescale_drawinggrid();
        $("drawing_grid").classList.remove("hidden");
        if (columns == 1) {
            send("check_drawinggrid_1x1");
        } else {
            send("check_drawinggrid_" + columns + "x" + columns / 2);
        }
    } else {
        $("drawing_grid").classList.add("hidden");
    }
}

function rescale_drawinggrid() {
    let rows;
    if (grid_columns > 1) {
        rows = Math.floor(grid_columns / 2);
    } else {
        rows = 1;
    }
    const width = doc.render.font.width * doc.columns;
    const height = doc.render.font.height * doc.rows;
    $("drawing_grid").innerHTML = "";
    let c = doc.render.font.width * grid_columns;
    while (c < width) {
        const div = document.createElement("div");
        div.style.width = c + "px";
        div.classList.add("column");
        $("drawing_grid").appendChild(div);
        c += doc.render.font.width * grid_columns;
    }
    let r = doc.render.font.height * rows;
    while (r < height) {
        const rowDiv = document.createElement("div");
        rowDiv.style.height = r + "px";
        rowDiv.classList.add("row");
        $("drawing_grid").appendChild(rowDiv);
        r += doc.render.font.height * rows;
    }
}

on("toggle_smallscale_guide", (event, visible) => toggle_smallscale_guide(visible));
on("toggle_square_guide", (event, visible) => toggle_square_guide(visible));
on("toggle_instagram_guide", (event, visible) => toggle_instagram_guide(visible));
on("toggle_file_id_guide", (event, visible) => toggle_file_id_guide(visible));
on("toggle_petscii_guide", (event, visible) => toggle_petscii_guide(visible));
on("toggle_drawinggrid", (event, visible, columns) => toggle_drawinggrid(visible, columns));

doc.on("render", () => rescale_guide());
doc.on("render", () => rescale_drawinggrid());

class StatusBar {
    status_bar_info(columns, rows, code = "") {
        set_text("columns", `${columns}`);
        set_text("rows", `${rows}`);
        set_text("columns_s", columns > 1 ? "s" : "");
        set_text("rows_s", rows > 1 ? "s" : "");
        set_text("ascii_value", code.code);
    }

    use_canvas_size_for_status_bar() {
        this.status_bar_info(doc.columns, doc.rows);
    }

    set_cursor_position(x, y) {
        set_text("cursor_x", `${x + 1}`);
        set_text("cursor_y", `${y + 1}`);
        set_text("ascii_value", doc.at(x, y).code);
    }

    hide_cursor_position() {
        $("cursor_position").style.opacity = "0";
    }

    show_cursor_position() {
        $("cursor_position").style.opacity = "1";
    }

    constructor() {
        doc.on("render", () => this.use_canvas_size_for_status_bar());
    }
}

function show_statusbar(visible) {
    statusbar_visible = visible;
    set_var("statusbar-height", visible ? "22px" : "0px");

    // Update the status bar toggle button visual state
    const statusbarToggle = $("statusbar_toggle_button");
    if (visible) {
        statusbarToggle.classList.add("active");
    } else {
        statusbarToggle.classList.remove("active");
    }
}

function show_preview(visible) {
    preview_visible = visible;
    set_var("preview-width", visible ? "300px" : "1px");

    // Update the preview toggle button visual state
    const previewToggle = $("preview_toggle_button");
    if (visible) {
        previewToggle.classList.add("active");
    } else {
        previewToggle.classList.remove("active");
    }
}

function show_toolbar(visible) {
    toolbar_visible = visible;
    set_var("toolbar-height", visible ? "48px" : "0px");

    // Update the toolbar toggle button visual state
    const toolbarToggle = $("toolbar_toggle_button");
    if (visible) {
        toolbarToggle.classList.add("active");
    } else {
        toolbarToggle.classList.remove("active");
    }
}

function use_pixel_aliasing(value) {
    set_var("scaling-type", value ? "high-quality" : "pixelated");
}

function hide_scrollbars(value) {
    set_var("scrollbar-width", value ? "0px" : "8px");
    set_var("scrollbar-height", value ? "0px" : "8px");
}

function get_charlist_bounds() {
    const charlistWindow = $("charlist_window");
    const windowRect = charlistWindow.getBoundingClientRect();

    // Get viewport boundaries accounting for sidebar and statusbar
    const sidebarWidth = parseInt(get_var("sidebar-width"));
    const rightSidebarWidth = parseInt(get_var("right-sidebar-width"));
    const statusbarHeight = parseInt(get_var("statusbar-height"));
    const minX = sidebarWidth;
    const minY = 0;
    const maxX = window.innerWidth - windowRect.width - rightSidebarWidth;
    const maxY = window.innerHeight - windowRect.height - statusbarHeight;

    return { minX, minY, maxX, maxY };
}

function constrain_charlist_bounds(x = null, y = null) {
    const charlistWindow = $("charlist_window");
    if (charlistWindow.style.display === "none") return;

    const bounds = get_charlist_bounds();

    // Use provided coordinates or get current position
    let currentX = x !== null ? x : charlistWindow.getBoundingClientRect().left;
    let currentY = y !== null ? y : charlistWindow.getBoundingClientRect().top;

    // Constrain to viewport boundaries
    const newX = Math.max(bounds.minX, Math.min(currentX, bounds.maxX));
    const newY = Math.max(bounds.minY, Math.min(currentY, bounds.maxY));

    // Always update when called with specific coordinates, or only when position needs to change
    if (x !== null || y !== null || newX !== currentX || newY !== currentY) {
        charlistWindow.style.left = newX + "px";
        charlistWindow.style.top = newY + "px";
        charlistWindow.style.right = "auto";
    }

    return { x: newX, y: newY };
}

function show_charlist(visible) {
    charlist_visible = visible;
    const charlist_window = $("charlist_window");
    charlist_window.style.display = visible ? "flex" : "none";

    // Update the statusbar toggle button state
    const toggleButton = $("charlist_visibility_toggle");
    if (toggleButton) {
        toggleButton.classList.toggle("off", !visible);
    }

    // Update the character palette toggle button visual state
    const charlistToggle = $("charlist_toggle_button");
    if (visible) {
        charlistToggle.classList.add("active");
    } else {
        charlistToggle.classList.remove("active");
    }
}

function current_zoom_factor() {
    return canvas_zoom;
}

function set_canvas_zoom_without_frame_update(factor) {
    // Clamp factor to valid range (0.1 to 5.0) with finer precision for smooth wheel zoom
    canvas_zoom = Math.max(0.1, Math.min(5.0, Math.round(factor * 100) / 100));

    const cursor = require("../tools/cursor");
    const mouse = require("../input/mouse");

    const container = $("canvas_container");

    // Set continuous zoom using CSS transform
    container.style.transform = `scale(${canvas_zoom})`;
    container.style.transformOrigin = "top left";
    container.style.margin = "0";

    cursor.set_canvas_zoom(canvas_zoom);
    mouse.set_canvas_zoom(canvas_zoom);

    // Update zoom display element
    const zoom_element = $("zoom");
    if (zoom_element) {
        zoom_element.textContent = `${Math.round(canvas_zoom * 100)}%`;
        zoom_element.classList.remove("fade");
        document.body.removeChild(zoom_element);
        document.body.appendChild(zoom_element);
        zoom_element.classList.add("fade");
    }

    send("update_menu_checkboxes", { actual_size: canvas_zoom === 1.0 });
}

function set_canvas_zoom(factor) {
    set_canvas_zoom_without_frame_update(factor);

    // Call require() inside the function to avoid circular dependency
    const { update_frame } = require("./canvas");
    update_frame();
}

function zoom_in(mouseX, mouseY) {
    zoom_with_anchor(Math.min(current_zoom_factor() + 0.2, 5.0), mouseX, mouseY);
}

function zoom_out(mouseX, mouseY) {
    zoom_with_anchor(Math.max(current_zoom_factor() - 0.2, 0.2), mouseX, mouseY);
}

function zoom_with_anchor(newZoom, mouseX, mouseY) {
    if (mouseX !== undefined && mouseY !== undefined) {
        // Get viewport element and current scroll position
        const viewport = document.getElementById("viewport");
        const oldZoom = current_zoom_factor();

        // Calculate the content position under the mouse before zoom
        const contentX = (viewport.scrollLeft + mouseX) / oldZoom;
        const contentY = (viewport.scrollTop + mouseY) / oldZoom;

        // Apply the zoom without updating preview frame yet
        set_canvas_zoom_without_frame_update(newZoom);

        // Calculate new scroll position to keep content under mouse
        const newScrollLeft = contentX * newZoom - mouseX;
        const newScrollTop = contentY * newZoom - mouseY;

        // Apply the new scroll position with bounds checking
        viewport.scrollLeft = Math.max(0, newScrollLeft);
        viewport.scrollTop = Math.max(0, newScrollTop);

        // Update preview frame immediately
        const { update_frame } = require("./canvas");
        update_frame();
    } else {
        // Fallback to regular zoom if no mouse position provided
        set_canvas_zoom(newZoom);
    }
}

function actual_size() {
    set_canvas_zoom(1.0);
}

function charlist_zoom_toggle() {
    charlist_zoom_toggled = !charlist_zoom_toggled;

    toolbar.redraw_charlist();
    toolbar.draw_charlist_cursor();

    $("charlist_zoom_button").textContent = charlist_zoom_toggled ? "2x" : "1x";

    // Check bounds after zoom change (window size changed)
    constrain_charlist_bounds();

    send("update_menu_checkboxes", {
        charlist_zoom_toggle: charlist_zoom_toggled,
    });
}

function ice_colors(value) {
    if (!value) {
        let vis_toggle = false;
        $("ice_color_container").style.display = "none";
        $("blink_off_container").style.removeProperty("display");
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
            if (vis_toggle) {
                $("blink_on_container").style.display = "none";
                $("blink_off_container").style.removeProperty("display");
            } else {
                $("blink_off_container").style.display = "none";
                $("blink_on_container").style.removeProperty("display");
            }
            vis_toggle = !vis_toggle;
        }, 300);
        set_text("ice_colors", "Off");
    } else {
        if (interval) clearInterval(interval);
        $("ice_color_container").style.removeProperty("display");
        $("blink_off_container").style.display = "none";
        $("blink_on_container").style.display = "none";
        set_text("ice_colors", "On");
    }
    send("update_menu_checkboxes", { ice_colors: value });
}

function use_9px_font(value) {
    set_text("use_9px_font", value ? "On" : "Off");
    send("update_menu_checkboxes", { use_9px_font: value });
}

function change_font(font_name) {
    set_text("font_name", font_name);
    set_text("charlist_font_name", font_name);
    send("update_menu_checkboxes", { font_name });
}

function insert_mode(value) {
    set_text("insert_mode", value ? "Ins" : "");
    keyboard.overwrite_mode = false;
    send("update_menu_checkboxes", {
        insert_mode: value,
        overwrite_mode: false,
    });
}

function overwrite_mode(value) {
    set_text("insert_mode", value ? "Over" : "");
    keyboard.insert_mode = false;
    send("update_menu_checkboxes", {
        overwrite_mode: value,
        insert_mode: false,
    });
}

doc.on("new_document", () => {
    ice_colors(doc.ice_colors);
    use_9px_font(doc.use_9px_font);
    change_font(doc.font_name);
});
doc.on("ice_colors", (value) => ice_colors(value));
doc.on("use_9px_font", (value) => use_9px_font(value));
doc.on("change_font", (font_name) => change_font(font_name));
keyboard.on("insert", (value) => insert_mode(value));
on("insert_mode", (event, value) => insert_mode(value));
on("overwrite_mode", (event, value) => overwrite_mode(value));

on("show_statusbar", (event, visible) => show_statusbar(visible));
on("show_preview", (event, visible) => show_preview(visible));
on("show_charlist", (event, visible) => show_charlist(visible));
on("use_pixel_aliasing", (event, value) => use_pixel_aliasing(value));
on("hide_scrollbars", (event, value) => hide_scrollbars(value));
on("zoom_in", (event) => zoom_in());
on("set_canvas_zoom", (event, level) => set_canvas_zoom(level));
on("zoom_out", (event) => zoom_out());
on("actual_size", (event) => actual_size());
on("charlist_zoom_toggle", (event) => charlist_zoom_toggle());

document.addEventListener(
    "DOMContentLoaded",
    (event) => {
        $("use_9px_font_toggle").addEventListener(
            "mousedown",
            (event) => (doc.use_9px_font = !doc.use_9px_font),
            true
        );
        $("ice_colors_toggle").addEventListener(
            "mousedown",
            (event) => (doc.ice_colors = !doc.ice_colors),
            true
        );
        $("dimensions").addEventListener(
            "mousedown",
            (event) =>
                send_sync("get_canvas_size", {
                    columns: doc.columns,
                    rows: doc.rows,
                }),
            true
        );
        $("charlist_zoom_button").addEventListener(
            "click",
            (event) => charlist_zoom_toggle(),
            true
        );

        $("charlist_reset_button").addEventListener(
            "click",
            (event) => {
                // Hide charlist window
                show_charlist(false);

                // Update menu item state
                send("update_menu_checkboxes", { show_charlist: false });
            },
            true
        );

        // Charlist window drag functionality
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        $("charlist_titlebar").addEventListener(
            "mousedown",
            (event) => {
                // Don't start dragging if clicking on buttons
                const target = /** @type {HTMLElement} */ (event.target);
                if (target.id === "charlist_zoom_button" || target.id === "charlist_reset_button")
                    return;

                isDragging = true;
                const rect = $("charlist_window").getBoundingClientRect();
                dragOffsetX = event.clientX - rect.left;
                dragOffsetY = event.clientY - rect.top;

                event.preventDefault();
                document.body.classList.add("grabbing");
            },
            true
        );

        document.addEventListener(
            "mousemove",
            (event) => {
                if (!isDragging) return;

                // Calculate new position
                let newX = event.clientX - dragOffsetX;
                let newY = event.clientY - dragOffsetY;

                // Apply boundary constraints using shared logic
                constrain_charlist_bounds(newX, newY);

                event.preventDefault();
            },
            true
        );

        document.addEventListener(
            "mouseup",
            (event) => {
                if (isDragging) {
                    isDragging = false;
                    document.body.classList.remove("grabbing");
                }
            },
            true
        );

        // Charlist visibility toggle button
        $("charlist_visibility_toggle").addEventListener(
            "click",
            (event) => {
                // Toggle character palette visibility
                const newVisibility = !charlist_visible;
                show_charlist(newVisibility);

                // Update menu item state
                send("update_menu_checkboxes", { show_charlist: newVisibility });
            },
            true
        );

        // Preview toggle button
        $("preview_toggle_button").addEventListener(
            "click",
            (event) => {
                // Toggle preview visibility
                const newVisibility = !preview_visible;
                show_preview(newVisibility);

                // Update menu item state
                send("update_menu_checkboxes", { show_preview: newVisibility });
            },
            true
        );

        // Toolbar toggle button
        $("toolbar_toggle_button").addEventListener(
            "click",
            (event) => {
                // Toggle toolbar visibility
                const newVisibility = !toolbar_visible;
                show_toolbar(newVisibility);

                // Update menu item state
                send("update_menu_checkboxes", { show_toolbar: newVisibility });
            },
            true
        );

        // Status bar toggle button
        $("statusbar_toggle_button").addEventListener(
            "click",
            (event) => {
                // Toggle status bar visibility
                const newVisibility = !statusbar_visible;
                show_statusbar(newVisibility);

                // Update menu item state
                send("update_menu_checkboxes", { show_statusbar: newVisibility });
            },
            true
        );

        // Character palette toggle button
        $("charlist_toggle_button").addEventListener(
            "click",
            (event) => {
                // Toggle character palette visibility
                const newVisibility = !charlist_visible;
                show_charlist(newVisibility);

                // Update menu item state
                send("update_menu_checkboxes", { show_charlist: newVisibility });
            },
            true
        );

        // Window resize handler to keep charlist window in bounds
        window.addEventListener("resize", () => {
            constrain_charlist_bounds();
        });
    },
    true
);

class Tools extends events.EventEmitter {
    get_tool_div(mode) {
        switch (mode) {
            case this.modes.SELECT:
                return $("select_mode");
            case this.modes.BRUSH:
                return $("brush_mode");
            case this.modes.SHIFTER:
                return $("shifter_mode");
            case this.modes.LINE:
                return $("line_mode");
            case this.modes.RECTANGLE_OUTLINE:
                return $("rectangle_mode");
            case this.modes.RECTANGLE_FILLED:
                return $("rectangle_mode");
            case this.modes.ELLIPSE_OUTLINE:
                return $("ellipse_mode");
            case this.modes.ELLIPSE_FILLED:
                return $("ellipse_mode");
            case this.modes.FILL:
                return $("fill_mode");
            case this.modes.SAMPLE:
                return $("sample_mode");
            case this.modes.REFERENCE:
                return $("reference_mode");
        }
    }

    start(new_mode) {
        if (new_mode == this.mode) return;
        if (this.mode != undefined) {
            $("brush_size_chooser").classList.remove("hidden");
            const div = this.get_tool_div(this.mode);
            div.classList.remove("selected");
            switch (this.mode) {
                case this.modes.RECTANGLE_OUTLINE:
                case this.modes.ELLIPSE_OUTLINE:
                    div.classList.remove("outline");
                    break;
                case this.modes.RECTANGLE_FILLED:
                case this.modes.ELLIPSE_FILLED:
                    div.classList.remove("filled");
                    break;
            }
        }
        this.previous_mode = this.mode;
        this.mode = new_mode;
        const div = this.get_tool_div(this.mode);
        div.classList.add("selected");
        switch (this.mode) {
            case this.modes.RECTANGLE_OUTLINE:
            case this.modes.ELLIPSE_OUTLINE:
                div.classList.add("outline");
                $("brush_size_chooser").classList.add("hidden");
                break;
            case this.modes.RECTANGLE_FILLED:
            case this.modes.ELLIPSE_FILLED:
                div.classList.add("filled");
                $("brush_size_chooser").classList.add("hidden");
                break;
            case this.modes.LINE:
                $("brush_size_chooser").classList.add("hidden");
                break;
        }
        this.emit("start", this.mode);
    }

    change_to_previous_mode() {
        if (this.previous_mode != undefined) this.start(this.previous_mode);
    }

    constructor() {
        super();
        this.modes = {
            SELECT: 0,
            BRUSH: 1,
            SHIFTER: 2,
            LINE: 3,
            RECTANGLE_OUTLINE: 4,
            RECTANGLE_FILLED: 5,
            ELLIPSE_OUTLINE: 6,
            ELLIPSE_FILLED: 7,
            FILL: 8,
            SAMPLE: 9,
            REFERENCE: 10,
        };
        on("change_to_select_mode", (event) => this.start(this.modes.SELECT));
        on("change_to_brush_mode", (event) => this.start(this.modes.BRUSH));
        on("change_to_shifter_mode", (event) => this.start(this.modes.SHIFTER));
        on("change_to_fill_mode", (event) => this.start(this.modes.FILL));
        document.addEventListener("DOMContentLoaded", (event) => {
            $("select_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.SELECT),
                true
            );
            $("brush_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.BRUSH),
                true
            );
            $("shifter_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.SHIFTER),
                true
            );
            $("line_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.LINE),
                true
            );
            $("rectangle_mode").addEventListener(
                "mousedown",
                (event) => {
                    if (this.mode === this.modes.RECTANGLE_OUTLINE) {
                        this.start(this.modes.RECTANGLE_FILLED);
                    } else if (this.mode === this.modes.RECTANGLE_FILLED) {
                        this.start(this.modes.RECTANGLE_OUTLINE);
                    } else {
                        this.start(this.modes.RECTANGLE_OUTLINE);
                    }
                },
                true
            );
            $("ellipse_mode").addEventListener(
                "mousedown",
                (event) => {
                    if (this.mode === this.modes.ELLIPSE_OUTLINE) {
                        this.start(this.modes.ELLIPSE_FILLED);
                    } else if (this.mode === this.modes.ELLIPSE_FILLED) {
                        this.start(this.modes.ELLIPSE_OUTLINE);
                    } else {
                        this.start(this.modes.ELLIPSE_OUTLINE);
                    }
                },
                true
            );
            $("fill_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.FILL),
                true
            );
            $("sample_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.SAMPLE),
                true
            );
            $("reference_mode").addEventListener(
                "mousedown",
                (event) => this.start(this.modes.REFERENCE),
                true
            );
        });
    }
}

class Toolbar extends events.EventEmitter {
    set_color(name, index, font) {
        const canvas = document.getElementById(name);
        const ctx = canvas.getContext("2d");
        const rgb = font.get_rgb(index);
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    draw_charlist() {
        const font = doc.font;
        const { fg, bg } = palette;
        const scale = charlist_zoom_toggled ? 2 : 1;
        const canvas = document.createElement("canvas");
        const charlist = document.getElementById("charlist");
        const cell_width = font.width + 1;
        const cell_height = font.height + 1;

        canvas.width = cell_width * 16;
        canvas.height = cell_height * 16;
        canvas.style.width = `${canvas.width * scale}px`;
        canvas.style.height = `${canvas.height * scale}px`;
        if (charlist.contains(charlist.getElementsByTagName("canvas")[0])) {
            charlist.removeChild(charlist.getElementsByTagName("canvas")[0]);
        }
        charlist.appendChild(canvas);
        canvas.addEventListener(
            "mousedown",
            (event) => {
                const target = /** @type {HTMLElement} */ (event.target);
                const rect = target.getBoundingClientRect();
                this.charlist_x = event.clientX - rect.left;
                this.charlist_y = event.clientY - rect.top;
                this.char_index =
                    Math.floor(this.charlist_y / cell_height / scale) * 16 +
                    Math.floor(this.charlist_x / cell_width / scale);
                this.draw_charlist_cursor();
                this.change_mode(this.modes.CUSTOM_BLOCK);
            },
            true
        );
        const ctx = canvas.getContext("2d");
        for (let y = 0, code = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++, code++) {
                font.draw(ctx, { code, fg, bg }, x * cell_width, y * cell_height);
            }
        }
    }

    update_charlist_cursor(char_index) {
        this.char_index = char_index;
        this.draw_charlist_cursor();
    }

    draw_charlist_cursor() {
        const font = doc.font;
        const scale = charlist_zoom_toggled ? 2 : 1;
        const cell_width = font.width + 1;
        const cell_height = font.height + 1;

        let selector = document.getElementById("charlist_selector");
        const top = Math.floor(this.char_index / 16) * cell_height * scale;
        const left = (this.char_index % 16) * cell_width * scale;

        // Add 2px offset to prevent box-shadow clipping at edges
        const offsetTop = Math.max(2, top);
        const offsetLeft = Math.max(2, left);
        selector.style.top = `${offsetTop}px`;
        selector.style.left = `${offsetLeft}px`;

        // Reduce dimensions by 2px when offset is applied to maintain visual alignment
        const heightReduction = offsetTop > top ? 2 : 0;
        const widthReduction = offsetLeft > left ? 2 : 0;
        selector.style.height = `${font.height * scale - heightReduction}px`;
        selector.style.width = `${font.width * scale - widthReduction}px`;
        this.custom_block_index = this.char_index;
        this.draw_custom_block();
    }

    redraw_charlist() {
        if (!doc.render) return;
        this.draw_charlist();
    }

    move_charlist(direction) {
        if (direction == "up") {
            if (this.char_index > 15) {
                this.char_index -= 16;
            }
        } else if (direction == "right") {
            if ((this.char_index + 1) % 16 != 0 && this.char_index < 256) {
                this.char_index += 1;
            }
        } else if (direction == "down") {
            if (this.char_index < 240) {
                this.char_index += 16;
            }
        } else if (direction == "left") {
            if (this.char_index % 16 != 0 && this.char_index > 0) {
                this.char_index -= 1;
            }
        } else {
            this.char_index = 0;
        }
        this.draw_charlist_cursor();
    }

    draw_fkey(name, code) {
        const font = doc.font;
        const { fg, bg } = palette;
        const canvas = $(name);
        canvas.width = font.width;
        canvas.height = font.height;
        canvas.style.width = `${font.width * 2}px`;
        canvas.style.height = `${font.height * 2}px`;
        canvas.style.margin = `${(48 - font.height * 2 - 2) / 2}px`;
        const ctx = canvas.getContext("2d");
        font.draw(ctx, { code, fg, bg }, 0, 0);
    }

    redraw_fkeys() {
        if (!doc.render) return;
        for (let i = 0; i < 12; i++) this.draw_fkey(`f${i + 1}`, this.fkeys[this.fkey_index][i]);
        $("fkey_chooser_num").textContent = `${this.fkey_index + 1}`;
    }

    draw_custom_block() {
        const font = doc.font;
        const { fg, bg } = palette;
        const canvas = $("custom_block_canvas");
        canvas.width = font.width;
        canvas.height = font.height;
        const ctx = canvas.getContext("2d");
        font.draw(ctx, { code: this.custom_block_index, fg, bg }, 0, 0);
    }

    change_fkeys(num) {
        this.fkey_index = num;
        this.redraw_fkeys();
    }

    previous_character_set() {
        this.change_fkeys(this.fkey_index == 0 ? this.fkeys.length - 1 : this.fkey_index - 1);
    }

    next_character_set() {
        this.change_fkeys(this.fkey_index + 1 == this.fkeys.length ? 0 : this.fkey_index + 1);
    }

    increase_brush_size() {
        this.brush_size = Math.min(this.brush_size + 1, 9);
        $("brush_size_num").innerText = String(this.brush_size);
    }

    decrease_brush_size() {
        this.brush_size = Math.max(this.brush_size - 1, 1);
        $("brush_size_num").innerText = String(this.brush_size);
    }

    reset_brush_size() {
        this.brush_size = 1;
        $("brush_size_num").innerText = String(this.brush_size);
    }

    default_character_set() {
        this.change_fkeys(this.default_fkeys);
    }

    f_key(num) {
        return this.fkeys[this.fkey_index][num];
    }

    show_select() {
        send("disable_brush_size_shortcuts");
        $("select_panel").classList.remove("hidden");
        $("brush_panel").classList.add("hidden");
        $("sample_panel").classList.add("hidden");
        $("reference_panel").classList.add("hidden");
    }

    show_brush() {
        send("enable_brush_size_shortcuts");
        $("select_panel").classList.add("hidden");
        $("brush_panel").classList.remove("hidden");
        $("sample_panel").classList.add("hidden");
        $("reference_panel").classList.add("hidden");
    }

    show_sample() {
        send("disable_brush_size_shortcuts");
        $("select_panel").classList.add("hidden");
        $("brush_panel").classList.add("hidden");
        $("sample_panel").classList.remove("hidden");
        $("reference_panel").classList.add("hidden");
    }

    show_reference() {
        send("disable_brush_size_shortcuts");
        $("select_panel").classList.add("hidden");
        $("brush_panel").classList.add("hidden");
        $("sample_panel").classList.add("hidden");
        $("reference_panel").classList.remove("hidden");
    }

    fkey_clicker(i) {
        return (event) => this.emit("key_typed", this.fkeys[this.fkey_index][i]);
    }

    fkey_pref_clicker(num) {
        return (event) =>
            send_sync("fkey_prefs", {
                num,
                fkey_index: this.fkey_index,
                current: this.fkeys[this.fkey_index][num],
                bitmask: doc.font.bitmask,
                use_9px_font: doc.font.use_9px_font,
                font_height: doc.font.height,
            });
    }

    change_mode(new_mode) {
        this.mode = new_mode;
        $("half_block").classList.remove("brush_mode_selected");
        $("custom_block").classList.remove("brush_mode_selected");
        $("colorize").classList.remove("brush_mode_selected");
        $("shading_block").classList.remove("brush_mode_selected");
        $("replace_color").classList.remove("brush_mode_selected");
        $("blink").classList.remove("brush_mode_selected");
        $("colorize_fg").classList.add("brush_mode_ghosted");
        $("colorize_fg").classList.remove("brush_mode_selected");
        $("colorize_bg").classList.add("brush_mode_ghosted");
        $("colorize_bg").classList.remove("brush_mode_selected");
        switch (this.mode) {
            case this.modes.HALF_BLOCK:
                $("half_block").classList.add("brush_mode_selected");
                break;
            case this.modes.CUSTOM_BLOCK:
                $("custom_block").classList.add("brush_mode_selected");
                break;
            case this.modes.SHADING_BLOCK:
                $("shading_block").classList.add("brush_mode_selected");
                break;
            case this.modes.REPLACE_COLOR:
                $("replace_color").classList.add("brush_mode_selected");
                break;
            case this.modes.BLINK:
                $("blink").classList.add("brush_mode_selected");
                break;
            case this.modes.COLORIZE:
                $("colorize").classList.add("brush_mode_selected");
                $("colorize_fg").classList.remove("brush_mode_ghosted");
                $("colorize_bg").classList.remove("brush_mode_ghosted");
                break;
        }
        if (this.colorize_fg) $("colorize_fg").classList.add("brush_mode_selected");
        if (this.colorize_bg) $("colorize_bg").classList.add("brush_mode_selected");
    }

    set_sample(x, y) {
        const font = doc.font;
        const block = doc.at(x, y);
        const canvas = document.getElementById("sample_block");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        font.draw_raw(ctx, block, 0, 0);
        this.set_color("sample_fg", block.fg, font);
        this.set_color("sample_bg", block.bg, font);
        $("code_value").textContent = `${block.code}`;
        $("fg_value").textContent = `${block.fg}`;
        $("bg_value").textContent = `${block.bg}`;
    }

    change_custom_brush(num) {
        if (this.mode != this.modes.CUSTOM_BLOCK) this.change_mode(this.modes.CUSTOM_BLOCK);
        this.custom_block_index = this.fkeys[this.fkey_index][num];
        this.draw_custom_block();
    }

    constructor() {
        super();
        this.fkey_index = 0;
        this.charlist_x = 0;
        this.charlist_y = 0;
        this.char_index = 0;
        on("fkeys", (event, value) => {
            this.fkeys = value;
            this.redraw_fkeys();
        });
        on("default_fkeys", (event, value) => {
            this.default_fkeys = value;
            this.fkey_index = value;
        });
        on("set_custom_block", (event, value) => {
            this.custom_block_index = value;
            this.draw_custom_block();
        });
        on("next_character_set", () => this.next_character_set());
        on("previous_character_set", () => this.previous_character_set());
        on("default_character_set", () => this.default_character_set());
        on("increase_brush_size", () => this.increase_brush_size());
        on("decrease_brush_size", () => this.decrease_brush_size());
        on("reset_brush_size", () => this.reset_brush_size());
        keyboard.on("change_fkeys", (num) => this.change_fkeys(num));
        this.modes = {
            HALF_BLOCK: 0,
            CUSTOM_BLOCK: 1,
            SHADING_BLOCK: 2,
            REPLACE_COLOR: 3,
            BLINK: 4,
            COLORIZE: 5,
        };
        this.colorize_fg = true;
        this.colorize_bg = false;
        this.brush_size = 1;
        this.custom_block_index = 176;
        on("show_toolbar", (event, visible) => show_toolbar(visible));
        palette.on("set_fg", () => {
            this.redraw_fkeys();
            this.draw_custom_block();
            this.redraw_charlist();
        });
        palette.on("set_bg", () => {
            this.redraw_fkeys();
            this.draw_custom_block();
            this.redraw_charlist();
        });
        doc.on("render", () => {
            this.redraw_fkeys();
            this.draw_custom_block();
            this.redraw_charlist();
            this.draw_charlist_cursor();
            const font = doc.font;
            const sample_block = document.getElementById("sample_block");
            sample_block.width = font.width;
            sample_block.height = font.height;
            sample_block.style.width = `${font.width * 2}px`;
            sample_block.style.height = `${font.height * 2}px`;
            sample_block.style.margin = `${(48 - font.height * 2 - 2) / 2}px`;
        });
        document.addEventListener(
            "DOMContentLoaded",
            (event) => {
                for (let i = 0; i < 12; i++)
                    $(`f${i + 1}`).addEventListener("mousedown", this.fkey_clicker(i), true);
                for (let i = 0; i < 12; i++)
                    $(`f${i + 1}_pref`).addEventListener(
                        "mousedown",
                        this.fkey_pref_clicker(i),
                        true
                    );
                $("fkey_chooser_left").addEventListener(
                    "mousedown",
                    (event) => this.previous_character_set(),
                    true
                );
                $("fkey_chooser_right").addEventListener(
                    "mousedown",
                    (event) => this.next_character_set(),
                    true
                );
                $("brush_size_left").addEventListener(
                    "mousedown",
                    (event) => this.decrease_brush_size(),
                    true
                );
                $("brush_size_right").addEventListener(
                    "mousedown",
                    (event) => this.increase_brush_size(),
                    true
                );
                $("brush_size_num").innerText = String(this.brush_size);
                $("half_block").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.HALF_BLOCK)
                );
                $("custom_block").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.CUSTOM_BLOCK)
                );
                $("shading_block").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.SHADING_BLOCK)
                );
                $("replace_color").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.REPLACE_COLOR)
                );
                $("blink").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.BLINK)
                );
                $("colorize").addEventListener("mousedown", (event) =>
                    this.change_mode(this.modes.COLORIZE)
                );
                $("colorize_fg").addEventListener("mousedown", (event) => {
                    this.colorize_fg = !this.colorize_fg;
                    this.change_mode(this.modes.COLORIZE);
                });
                $("colorize_bg").addEventListener("mousedown", (event) => {
                    this.colorize_bg = !this.colorize_bg;
                    this.change_mode(this.modes.COLORIZE);
                });
                this.change_mode(this.modes.HALF_BLOCK);
                $("reference_open").addEventListener("click", () => open_reference_image());
                $("reference_show").addEventListener("click", show_reference_image);
                $("reference_hide").addEventListener("click", hide_reference_image);
                $("reference_reset").addEventListener("click", reset_reference_image);
                $("reference_opacity_minus").addEventListener(
                    "click",
                    decrease_reference_image_opacity
                );
                $("reference_opacity_plus").addEventListener(
                    "click",
                    increase_reference_image_opacity
                );
                $("reference_opacity_value").addEventListener(
                    "input",
                    on_update_reference_opacity_value
                );
                $("reference_size_minus").addEventListener("click", decrease_reference_image_size);
                $("reference_size_plus").addEventListener("click", increase_reference_image_size);
                $("reference_size_value").addEventListener("input", on_update_reference_size_value);
                $("reference_angle_minus").addEventListener(
                    "click",
                    decrease_reference_image_angle
                );
                $("reference_angle_plus").addEventListener("click", increase_reference_image_angle);
                $("reference_angle_value").addEventListener(
                    "input",
                    on_update_reference_angle_value
                );
            },
            true
        );

        keyboard.on("move_charlist", (direction) => this.move_charlist(direction));
    }
}

const toolbar = new Toolbar();

module.exports = {
    statusbar: new StatusBar(),
    tools: new Tools(),
    toolbar,
    zoom_in,
    zoom_out,
    actual_size,
    current_zoom_factor,
    zoom_with_anchor,
    charlist_zoom_toggle,
    increase_reference_image_opacity,
    decrease_reference_image_opacity,
    open_reference_image,
    toggle_off_guide,
};
