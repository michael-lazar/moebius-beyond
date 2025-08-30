const { TextModeData } = require("./textmode");
const remote = require("@electron/remote");
const zlib = require("zlib");

const dev = !remote.app.isPackaged;

function encode_as_mbd(doc) {
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
            columns: doc.columns,
            rows: doc.rows,
            title: doc.title.trim(),
            author: doc.author.trim(),
            group: doc.group.trim(),
            date: doc.date,
            comments: doc.comments,
            filesize: doc.filesize,
            palette: doc.palette.map((color) => ({
                r: color.r,
                g: color.g,
                b: color.b,
            })),
            font_name: doc.font_name,
            font_bytes: doc.font_bytes ? Buffer.from(doc.font_bytes).toString("base64") : null,
            font_height: doc.font_height,
            use_9px_font: doc.use_9px_font,
            ice_colors: doc.ice_colors,
            data: doc.data.map((block) => ({
                code: block.code,
                fg: block.fg,
                bg: block.bg,
            })),
        },
    };

    const jsonString = JSON.stringify(mbd_doc, null, 2);
    return zlib.gzipSync(Buffer.from(jsonString, "utf8"));
}

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
