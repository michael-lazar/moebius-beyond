# MBXD File Format

The MBXD (Moebius XBIN Document) format is the internal file format for the Moebius XBIN Ultimate ASCII art editor.

## File Extension

`.mbxd`

## Format

JSON-based text file, UTF-8 encoded.

## Structure

### Version 1-alpha1

```json
{
    "format": "moebius-xbin-ultimate-document",
    "version": "1-alpha1",
    "metadata": {
        "created": "2025-01-01T12:00:00.000Z",
        "modified": "2025-01-01T12:00:00.000Z",
        "application": "MoebiusXBINUltimate",
        "applicationVersion": "3.2.1"
    },
    "document": {
        "columns": 80,
        "rows": 25,
        "title": "",
        "author": "",
        "group": "",
        "date": "",
        "comments": "",
        "filesize": 0,
        "palette": [
            { "r": 0, "g": 0, "b": 0 },
            { "r": 0, "g": 0, "b": 170 },
            { "r": 0, "g": 170, "b": 0 },
            { "r": 0, "g": 170, "b": 170 },
            { "r": 170, "g": 0, "b": 0 },
            { "r": 170, "g": 0, "b": 170 },
            { "r": 170, "g": 85, "b": 0 },
            { "r": 170, "g": 170, "b": 170 },
            { "r": 85, "g": 85, "b": 85 },
            { "r": 85, "g": 85, "b": 255 },
            { "r": 85, "g": 255, "b": 85 },
            { "r": 85, "g": 255, "b": 255 },
            { "r": 255, "g": 85, "b": 85 },
            { "r": 255, "g": 85, "b": 255 },
            { "r": 255, "g": 255, "b": 85 },
            { "r": 255, "g": 255, "b": 255 }
        ],
        "font_name": "IBM VGA",
        "font_bytes": null,
        "font_height": 16,
        "use_9px_font": false,
        "ice_colors": true,
        "data": [
            { "code": 32, "fg": 7, "bg": 0 },
            { "code": 65, "fg": 15, "bg": 1 }
        ]
    }
}
```

## Field Descriptions

### Root Level

- `format`: Always "moebius-xbin-ultimate-document"
- `version`: Format version string
- `metadata`: File creation and modification info
- `document`: All document data

### Metadata Fields

- `created`: ISO 8601 timestamp when file was first created
- `modified`: ISO 8601 timestamp when file was last modified
- `application`: Application name that created the file
- `applicationVersion`: Version of the application that created the file

### Document Fields

- `columns`, `rows`: Canvas dimensions (integers)
- `title`, `author`, `group`, `date`, `comments`: SAUCE metadata (strings)
- `filesize`: Original file size in bytes (integer, for SAUCE compatibility)
- `palette`: Array of RGB color objects with r, g, b properties (0-255)
- `font_name`: Font identifier string
- `font_bytes`: Binary font data (base64 encoded string) or null for built-in fonts
- `font_height`: Font height in pixels (integer, e.g., 8, 14, 16)
- `use_9px_font`: Boolean flag for 9-pixel font height
- `ice_colors`: Boolean flag for ice color support
- `data`: Array of character objects, each with:
    - `code`: Character code (integer 0-255)
    - `fg`: Foreground color index (integer 0-15 or higher for extended palettes)
    - `bg`: Background color index (integer 0-15 or higher for extended palettes)

## Future Versions

Future versions will add new fields while maintaining backward compatibility. The version field allows parsers to handle different format versions appropriately.
