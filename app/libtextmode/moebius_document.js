const { Textmode } = require("./textmode");
const electron = require("electron");
const remote = require("@electron/remote");

const dev = !electron.app || !electron.app.isPackaged;

function encode_as_mbxd(doc) {
    const now = new Date().toISOString();

    const appVersion = dev ? process.env.npm_package_version : remote.app.getVersion();

    const mbxd_doc = {
        format: "moebius-xbin-ultimate-document",
        version: "1-alpha1",
        metadata: {
            created: now,
            modified: now,
            application: "MoebiusXBINUltimate",
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

    return Buffer.from(JSON.stringify(mbxd_doc, null, 2), "utf8");
}

function fromMBXD(bytes) {
    const json_string = bytes.toString("utf8");
    const mbxd_doc = JSON.parse(json_string);

    // Validate format
    if (mbxd_doc.format !== "moebius-xbin-ultimate-document") {
        throw new Error("Invalid MBXD file: incorrect format identifier");
    }

    // Check version compatibility
    if (!mbxd_doc.version || !mbxd_doc.version.startsWith("1")) {
        throw new Error(`Unsupported MBXD version: ${mbxd_doc.version}`);
    }

    if (!mbxd_doc.document) {
        throw new Error("Invalid MBXD file: missing document section");
    }

    const doc_data = mbxd_doc.document;

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
    encode_as_mbxd,
    fromMBXD,
};
