const { Textmode } = require("./textmode");
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

    // Validate format
    if (mbd_doc.format !== "moebius-beyond-document") {
        throw new Error("Invalid MBD file: incorrect format identifier");
    }

    // Check version compatibility
    if (!mbd_doc.version || !mbd_doc.version.startsWith("1")) {
        throw new Error(`Unsupported MBD version: ${mbd_doc.version}`);
    }

    if (!mbd_doc.document) {
        throw new Error("Invalid MBD file: missing document section");
    }

    const doc_data = mbd_doc.document;

    // Create Textmode document
    const doc = new Textmode({
        columns: doc_data.columns,
        rows: doc_data.rows,
        title: doc_data.title,
        author: doc_data.author,
        group: doc_data.group,
        date: doc_data.date,
        comments: doc_data.comments,
        filesize: doc_data.filesize,
        palette: doc_data.palette,
        font_name: doc_data.font_name,
        use_9px_font: doc_data.use_9px_font,
        ice_colors: doc_data.ice_colors,
    });

    // Handle font bytes
    if (doc_data.font_bytes) {
        doc.font_bytes = Buffer.from(doc_data.font_bytes, "base64");
    }

    // Set font height
    if (doc_data.font_height) {
        doc.font_height = doc_data.font_height;
    }

    // Set character data
    doc.data = doc_data.data.map((block) => ({
        code: block.code || 32,
        fg: block.fg || 7,
        bg: block.bg || 0,
    }));

    return doc;
}

module.exports = {
    encode_as_mbd,
    fromMBD,
};
