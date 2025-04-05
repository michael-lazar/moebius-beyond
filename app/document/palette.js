const { EventEmitter } = require("events");

const doc = require("./doc");
const keyboard = require("./input/keyboard");
const senders = require("../senders");
const { white, rgb_to_hex, hex_to_rbg, lospec_palette } = require("../libtextmode/palette");



class PaletteChooser extends EventEmitter {
    select_attribute() {
        senders.send_sync("select_attribute", { fg: this.fg, bg: this.bg, palette: doc.palette });
    }

    constructor() {
        super();

        this.fg_index = 7;
        this.bg_index = 0;

        doc.on("new_document", () => this.new_document());
        doc.on("update_swatches", () => this.update_swatches());
        doc.on("set_bg", (index) => this.bg = index);
        doc.on("change_palette", (lospec_palette_name) => this.change_palette(lospec_palette_name));


        keyboard.on("previous_foreground_color", () => this.previous_foreground_color());
        keyboard.on("next_foreground_color", () => this.next_foreground_color());
        keyboard.on("previous_background_color", () => this.previous_background_color());
        keyboard.on("next_background_color", () => this.next_background_color());
        keyboard.on("toggle_fg", (index) => this.toggle_fg(index));
        keyboard.on("toggle_bg", (index) => this.toggle_bg(index));

        senders.on("previous_foreground_color", () => this.previous_foreground_color());
        senders.on("next_foreground_color", () => this.next_foreground_color());
        senders.on("previous_background_color", () => this.previous_background_color());
        senders.on("next_background_color", () => this.next_background_color());
        senders.on("default_color", () => this.default_color());
        senders.on("switch_foreground_background", () => this.switch_foreground_background());
        senders.on("set_fg", (e, new_fg) => this.fg = new_fg);
        senders.on("set_bg", (e, new_bg) => this.bg = new_bg);
    }

    new_document() {
        this.color_picker_el = document.getElementById("color_picker")
        this.swatch_container_el = document.getElementById("swatches");

        this.bind_events();
        this.update_swatches();
        this.default_color();
    }

    bind_events() {
        this.swatch_container_el.addEventListener("mousedown", (e) => {
            if (!e.target.dataset.id) return;

            clearTimeout(this.click_timer);
            this.click_timer = setTimeout(() => {
                if (e.button === 2 || e.ctrlKey) {
                    this.bg_internal = e.target.dataset.id;
                } else {
                    this.fg = e.target.dataset.id;
                }
            }, 175);
        });

        this.swatch_container_el.addEventListener("dblclick", (e) => {
            clearTimeout(this.click_timer);

            this.color_picker_spawner = e.target;
            this.color_picker_el.value = rgb_to_hex(doc.palette[e.target.dataset.id]);

            this.color_picker_el.click();
        });

        // this.color_picker_el.addEventListener("input", (e) => this.color_picked(e.target.value));
        this.color_picker_el.addEventListener("change", (e) => this.color_picked(e.target.value));
    }

    color_picked(hex) {
        if (!hex || this.color_picker_spawner.style.backgroundColor === hex) return;

        clearTimeout(this.paint_timer);
        this.paint_timer = setTimeout(() => {
            this.color_picker_spawner.style.backgroundColor = hex;
            const id = parseInt(this.color_picker_spawner.dataset.id, 10)

            if (this.bg_index === id) document.getElementById('bg').style.backgroundColor = hex;
            if (this.fg_index === id) document.getElementById('fg').style.backgroundColor = hex;

            doc.update_palette(parseInt(this.color_picker_spawner.dataset.id, 10), hex_to_rbg(hex));
        }, 150);
    }

    update_swatches() {
        this.swatch_container_el.innerHTML = "";

        let container = document.createElement("section");
        container.classList.add("base")
        this.swatch_container_el.appendChild(container)

        doc.palette.map((rgb, i) => {
            const div = document.createElement("div");
            div.style.backgroundColor = rgb_to_hex(rgb);
            div.dataset.id = i;
            container.appendChild(div);
        });

        this.update_selected("bg")
        this.update_selected("fg")
    }

    add_color(button, rgb) {
        doc.update_palette(null, rgb);
        const hex = rgb_to_hex(rgb)

        const div = document.createElement("div");
        div.style.backgroundColor = hex;
        div.dataset.id = doc.palette.length - 1;

        button.before(div);

        this.color_picker_spawner = div;
        this.color_picker_el.value = hex;

        this.color_picker_el.click();
    }

    update_selected(level) {
        const class_name = `selected_${level}`;
        let selected_el = this.swatch_container_el.querySelector(`.selected_${level}`);
        if (selected_el) selected_el.classList.remove(class_name);

        selected_el = this.swatch_container_el.querySelector(`[data-id="${this[level]}"`);
        if (selected_el) selected_el.classList.add(class_name);
        else {
        } // we don't know about this color!

        document.getElementById(level).style.backgroundColor = rgb_to_hex(doc.palette[this[level]]);
    }

    set fg(value) {
        this.emit("set_fg", this.fg_index = parseInt(value, 10));
        this.update_selected("fg")
    }

    get fg() {
        return this.fg_index;
    }

    set bg(value) {
        this.emit("set_bg", this.bg_index = parseInt(value, 10));
        this.update_selected("bg")
    }

    set bg_internal(value) {
        this.bg = value
    }

    get bg() {
        return this.bg_index;
    }

    previous_foreground_color() {
        this.fg = (this.fg === 0) ? 15 : this.fg - 1;
    }

    next_foreground_color() {
        this.fg = (this.fg === 15) ? 0 : this.fg + 1;
    }

    previous_background_color() {
        this.bg_internal = (this.bg === 0) ? 15 : this.bg - 1;
    }

    next_background_color() {
        this.bg_internal = (this.bg === 15) ? 0 : this.bg + 1;
    }

    async change_palette(lospec_palette_name) {
        senders.send("update_menu_checkboxes", { lospec_palette_name });
        await this.load_lospec_palette(lospec_palette_name);
        this.update_swatches();
    }

    async load_lospec_palette(palette_name) {
        const loaded_palette = lospec_palette(palette_name)
        for (let i = 0; i < 16; i++) {
            doc.update_palette(i, hex_to_rbg(loaded_palette[i]));
        }
        this.update_swatches()
        //stupid way of forcing redraw on ui elements
        this.fg = this.fg;
    }


    default_color() {
        this.fg = 7;
        this.bg_internal = 0;
    }

    switch_foreground_background() {
        const fg_index = this.fg;
        this.fg = this.bg;
        this.bg_internal = fg_index;
    }

    toggle_fg(index) {
        // TODO: ??
        if (this.fg === index || (this.fg >= 8 && this.fg !== index + 8)) index += 8
        this.fg = index;
    }

    toggle_bg(index) {
        // TODO: ??
        if (this.bg === index || (this.bg >= 8 && this.bg !== index + 8)) index += 8
        this.bg_internal = index;
    }
}

module.exports = new PaletteChooser();
