/**
 * @param {string} line
 * @returns {{ x: number, y: number }[]}
 */
function parse_brush_shape(line) {
    const rows = line.split("\n");
    const num_rows = rows.length;
    const num_cols = rows[0].length;
    const center_col = Math.floor(num_cols / 2);
    const center_row = Math.floor(num_rows / 2);
    const offsets = [];
    for (let row = 0; row < num_rows; row++) {
        for (let col = 0; col < num_cols; col++) {
            if (rows[row][col] === "#") {
                offsets.push({ x: col - center_col, y: row - center_row });
            }
        }
    }
    return offsets;
}

/**
 * @param {{ x: number, y: number }[]} offsets
 * @param {number} half
 * @returns {[number, number, number, number][]}
 */
function compute_outline_segments(offsets, half) {
    const active = new Set(offsets.map(({ x, y }) => `${x},${y}`));
    /** @type {[number, number, number, number][]} */
    const segments = [];
    for (const { x, y } of offsets) {
        const bx = x + half; // bounding-box cell coordinates
        const by = y + half;
        if (!active.has(`${x},${y - 1}`)) segments.push([bx, by, bx + 1, by]); // top
        if (!active.has(`${x},${y + 1}`)) segments.push([bx, by + 1, bx + 1, by + 1]); // bottom
        if (!active.has(`${x - 1},${y}`)) segments.push([bx, by, bx, by + 1]); // left
        if (!active.has(`${x + 1},${y}`)) segments.push([bx + 1, by, bx + 1, by + 1]); // right
    }
    return segments;
}

// prettier-ignore
const BRUSH_SHAPES = {
    square: [
        "#",
        "##\n##",
        "###\n###\n###",
        "####\n####\n####\n####",
        "#####\n#####\n#####\n#####\n#####",
        "######\n######\n######\n######\n######\n######",
        "#######\n#######\n#######\n#######\n#######\n#######\n#######",
        "########\n########\n########\n########\n########\n########\n########\n########",
        "#########\n#########\n#########\n#########\n#########\n#########\n#########\n#########\n#########",
    ],
    circle: [
        "#",
        "##\n##",
        " # \n###\n # ",
        " ## \n####\n####\n ## ",
        " ### \n#####\n#####\n#####\n ### ",
        " #### \n######\n######\n######\n######\n #### ",
        "  ###  \n #####\n#######\n#######\n#######\n #####\n  ###  ",
        "  ####  \n ######\n########\n########\n########\n########\n ######\n  ####  ",
        "  #####  \n #######\n#########\n#########\n#########\n#########\n#########\n #######\n  #####  ",
    ],
};

module.exports = { BRUSH_SHAPES, parse_brush_shape, compute_outline_segments };
