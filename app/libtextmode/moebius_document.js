const { TextModeData } = require("./textmode");
const remote = require("@electron/remote");
const zlib = require("zlib");

const dev = !remote.app.isPackaged;

/**
 * @param {TextModeData} tmdata
 * @returns {Buffer}
 */
function encode_as_mbd(tmdata) {
    const now = new Date().toISOString();

    const appVersion = dev ? process.env.npm_package_version : remote.app.getVersion();

    const mbd_doc = {
        format: "moebius-beyond-document",
        version: "1",
        metadata: {
            created: now,
            modified: now,
            application: "MoebiusBeyond",
            applicationVersion: appVersion,
        },
        document: {
            columns: tmdata.columns,
            rows: tmdata.rows,
            title: tmdata.title.trim(),
            author: tmdata.author.trim(),
            group: tmdata.group.trim(),
            date: tmdata.date,
            comments: tmdata.comments,
            filesize: tmdata.filesize,
            palette: tmdata.palette.map((color) => ({
                r: color.r,
                g: color.g,
                b: color.b,
            })),
            font_name: tmdata.font_name,
            font_bytes: tmdata.font_bytes
                ? Buffer.from(tmdata.font_bytes).toString("base64")
                : null,
            font_height: tmdata.font_height,
            use_9px_font: tmdata.use_9px_font,
            ice_colors: tmdata.ice_colors,
            data: tmdata.data.map((block) => ({
                code: block.code,
                fg: block.fg,
                bg: block.bg,
            })),
        },
    };

    const jsonString = JSON.stringify(mbd_doc, null, 2);
    return zlib.gzipSync(Buffer.from(jsonString, "utf8"));
}

/**
 * @param {Buffer} bytes
 * @returns {TextModeData}
 */
function fromMBD(bytes) {
    const decompressed = zlib.gunzipSync(bytes);
    const json_string = decompressed.toString("utf8");
    const mbd_doc = JSON.parse(json_string);

    if (mbd_doc.format !== "moebius-beyond-document") {
        throw new Error("Invalid MBD file: incorrect format identifier");
    }

    if (!mbd_doc.version || !mbd_doc.version.startsWith("1")) {
        throw new Error(`Unsupported MBD version: ${mbd_doc.version}`);
    }

    if (!mbd_doc.document) {
        throw new Error("Invalid MBD file: missing document section");
    }

    const document = mbd_doc.document;

    const font_bytes = document.font_bytes ? Buffer.from(document.font_bytes, "base64") : null;

    const data = document.data.map((block) => ({
        code: block.code || 32,
        fg: block.fg || 7,
        bg: block.bg || 0,
    }));

    return new TextModeData({
        columns: document.columns,
        rows: document.rows,
        title: document.title,
        author: document.author,
        group: document.group,
        date: document.date,
        comments: document.comments,
        filesize: document.filesize,
        palette: document.palette,
        font_name: document.font_name,
        use_9px_font: document.use_9px_font,
        ice_colors: document.ice_colors,
        font_height: document.font_height,
        font_bytes,
        data,
    });
}

module.exports = {
    encode_as_mbd,
    fromMBD,
};
