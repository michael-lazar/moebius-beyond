const { bytes_to_utf8, bytes_to_blocks, TextModeData, add_sauce_for_xbin } = require("./textmode");
const { palette_4bit, xbin_to_rgb, rgb_to_xbin } = require("./palette");
const repeating = {
    NONE: 0,
    CHARACTERS: 1,
    ATTRIBUTES: 2,
    BOTH_CHARACTERS_AND_ATTRIBUTES: 3,
};
const { encode_as_bin } = require("./binary_text");

function uncompress({ bytes, columns, rows }) {
    const data = new Array(columns * rows);
    for (let i = 0, j = 0; i < bytes.length; ) {
        const value = bytes[i++];
        const count = value & 63;
        switch (value >> 6) {
            case repeating.NONE:
                for (let k = 0; k <= count; i += 2, j++, k++) {
                    data[j] = {
                        code: bytes[i],
                        bg: bytes[i + 1] >> 4,
                        fg: bytes[i + 1] & 0xf,
                    };
                }
                break;
            case repeating.CHARACTERS:
                for (let k = 0, code = bytes[i++]; k <= count; i++, k++, j++) {
                    data[j] = { code, bg: bytes[i] >> 4, fg: bytes[i] & 0xf };
                }
                break;
            case repeating.ATTRIBUTES:
                for (
                    let k = 0, bg = bytes[i] >> 4, fg = bytes[i++] & 0xf;
                    k <= count;
                    i++, j++, k++
                ) {
                    data[j] = { code: bytes[i], bg, fg };
                }
                break;
            case repeating.BOTH_CHARACTERS_AND_ATTRIBUTES:
                for (
                    let k = 0, code = bytes[i++], bg = bytes[i] >> 4, fg = bytes[i++] & 0xf;
                    k <= count;
                    j++, k++
                ) {
                    data[j] = { code, bg, fg };
                }
                break;
        }
    }
    return data;
}

function fromXBin(bytes) {
    const { get_sauce } = require("./textmode");
    const sauce = get_sauce(bytes);
    const fileBytes = bytes.subarray(0, sauce.filesize);

    if (bytes_to_utf8(fileBytes, 0, 4) != "XBIN" || fileBytes[4] != 0x1a) {
        throw "Error whilst attempting to load XBin file: Unexpected header.";
    }
    const columns = (fileBytes[6] << 8) + fileBytes[5];
    const rows = (fileBytes[8] << 8) + fileBytes[7];
    const font_height = fileBytes[9] || 16;
    const flags = fileBytes[10];
    const palette_flag = (flags & 1) == 1;
    const font_flag = ((flags >> 1) & 1) == 1;
    const compress_flag = ((flags >> 2) & 1) == 1;
    const ice_colors = ((flags >> 3) & 1) == 1;
    const font_512_flag = ((flags >> 4) & 1) == 1;
    if (font_512_flag) {
        throw "Error whilst attempting to load XBin file: Unsupported font size.";
    }
    let i = 11;
    let palette;
    let font_name = sauce.font_name;
    let font_bytes;
    if (palette_flag) {
        const palette_bytes = fileBytes.subarray(11, 11 + 48);
        palette = new Array(16);
        for (let i = 0, j = 0; i < 16; i++, j += 3) {
            palette[i] = xbin_to_rgb(palette_bytes[j], palette_bytes[j + 1], palette_bytes[j + 2]);
        }
        i += 48;
    } else {
        palette = palette_4bit;
    }
    if (font_flag) {
        font_name = "Custom";
        font_bytes = fileBytes.subarray(i, i + 256 * font_height);
        i += 256 * font_height;
    }
    let data;
    if (compress_flag) {
        data = uncompress({
            columns: columns,
            rows: rows,
            bytes: fileBytes.subarray(i, i + sauce.filesize),
        });
    } else {
        data = bytes_to_blocks({
            columns: columns,
            rows: rows,
            bytes: fileBytes.subarray(i, i + sauce.filesize),
        });
    }

    return new TextModeData({
        columns,
        rows,
        title: sauce.title,
        author: sauce.author,
        group: sauce.group,
        date: sauce.date,
        filesize: sauce.filesize,
        ice_colors,
        use_9px_font: sauce.use_9px_font,
        font_name,
        comments: sauce.comments,
        data,
        palette,
        font_bytes,
        font_height,
    });
}

function encode_as_xbin(doc, save_without_sauce) {
    let bin_bytes = encode_as_bin(doc, true, true);
    let header = [
        88,
        66,
        73,
        78,
        26,
        doc.columns & 255,
        doc.columns >> 8,
        doc.rows & 255,
        doc.rows >> 8,
        doc.font_height,
        0,
    ];
    if (doc.palette) {
        header[10] += 1;
        const palette_bytes = [];
        for (const rgb of doc.palette) {
            palette_bytes.push(...rgb_to_xbin(rgb));
        }
        header = header.concat(palette_bytes);
    }
    //if using custom font loaded to program
    if (doc.font != null) {
        header[10] += 1 << 1;
        const font_bytes = [];
        for (const value of doc.font.bitmask) {
            font_bytes.push(value);
        }
        header = header.concat(font_bytes);
    }
    //else use font from xbin file
    else {
        header[10] += 1 << 1;
        const font_bytes = [];
        for (const value of doc.font_bytes) {
            font_bytes.push(value);
        }
        header = header.concat(font_bytes);
    }
    if (doc.ice_colors) {
        header[10] += 1 << 3;
    }
    let bytes = new Uint8Array(header.length + bin_bytes.length);
    bytes.set(header, 0);
    bytes.set(bin_bytes, header.length);
    if (!save_without_sauce) {
        return add_sauce_for_xbin({ doc, bytes });
    }
    return bytes;
}

module.exports = { fromXBin, encode_as_xbin };
