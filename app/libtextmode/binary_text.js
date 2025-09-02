const { palette_4bit } = require("./palette");
const { bytes_to_blocks, TextModeData, add_sauce_for_bin } = require("./textmode");
const { send } = require("../senders");

/**
 * @param {Buffer} bytes
 * @returns {TextModeData}
 */
function fromBinaryText(bytes) {
    const { get_sauce } = require("./textmode");
    const sauce = get_sauce(bytes);
    const fileBytes = bytes.subarray(0, sauce.filesize);

    let columns = sauce.columns;
    if (columns == null) {
        columns = 80;
    }
    const rows = Math.ceil(sauce.filesize / columns / 2);
    const palette = [...palette_4bit];
    const data = bytes_to_blocks({
        columns: columns,
        rows: rows,
        bytes: fileBytes,
    });

    return new TextModeData({
        columns,
        rows,
        title: sauce.title,
        author: sauce.author,
        group: sauce.group,
        date: sauce.date,
        filesize: sauce.filesize,
        ice_colors: sauce.ice_colors,
        use_9px_font: sauce.use_9px_font,
        font_name: sauce.font_name,
        comments: sauce.comments,
        data,
        palette,
    });
}

/**
 * @param {TextModeData} tmdata
 * @param {boolean} save_without_sauce
 * @param {boolean} allow_odd_columns
 * @returns {Uint8Array}
 */
function encode_as_bin(tmdata, save_without_sauce, allow_odd_columns = false) {
    if (!allow_odd_columns && tmdata.columns % 2 != 0) {
        send("show_warning", {
            title: "Error saving binary file",
            content:
                "The file cannot be saved in the BIN format because it has an uneven number of columns. " +
                "To resolve this issue, you can either resize the canvas, or save the file as XBIN.",
        });
        throw "Cannot save in Binary Text format with an odd number of columns.";
    }
    const bytes = new Uint8Array(tmdata.data.length * 2);
    for (let i = 0, j = 0; i < tmdata.data.length; i++, j += 2) {
        bytes[j] = tmdata.data[i].code;
        bytes[j + 1] = (tmdata.data[i].bg << 4) + tmdata.data[i].fg;
    }
    if (!save_without_sauce) {
        return add_sauce_for_bin({ tmdata, bytes });
    }
    return bytes;
}

module.exports = { fromBinaryText, encode_as_bin };
