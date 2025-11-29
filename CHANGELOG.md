# Moebius Beyond Ultimate Edition Changelog

## Unreleased

### Changed

- Improved the range slider for the reference window drawing grid.

## v3.6.0 (2025-11-28)

### Added

- Improved the cropping tool to preserve undo/redo history.
- Added a preference to override the default font for new documents.
- Added click-and-drag UX for moving selections without keyboard
  shortcuts.
- Added support for WebP, GIF, and SVG reference images.
- Improved the reference image window to support zooming and drawing
  grids.

### Fixed

- Fixed shift+mouse wheel to only adjust the reference image opacity
  without scrolling horizontally.
- Fixed reference image dragging to respect the current zoom level.

## v3.5.0 (2025-10-21)

This release includes significant internal code refactoring to lay
the groundwork for future changes. As such, there is a higher than
usual risk of regressions across the entire application. Please be
aware and report any issues you see.

### Changed

- The canvas is now centered horizontally/vertically in the UI when
  there is enough space available.
- Removed the "zoom snapping" feature, after trying it out for a
  while I found it more annoying than helpful.

### Fixed

- Fixed the animated border when selecting and dragging content.

## v3.4.1 (2025-08-29)

### Fixed

- Fixed a regression that broke the color picker when electron was
  updated. The color picker is now part of the app rather than
  opening the operating system's color utility.
- Fixed a regression in the default file extension when performing
  "save as...".

## v3.4.0 (2025-08-20)

### Added

- The character palette is now a floating window that can be dragged
  and repositioned within the application.
- Added a new sidebar with buttons to show/hide various UI elements.

### Changed

- The rectangle and ellipse tools now toggle between outline and
  filled modes when clicked repeatedly, replacing the previous
  split-button behavior.
- Clicking inside of the character palette now automatically activates
  the custom block brush tool with the given character selected.

### Removed

- Removed double click on the custom block tool to set the character.

## v3.3.0 (2025-08-07)

The project/installer has been renamed to "MoebiusBeyond" to
distinguish from the upstream project and allow installing both
versions of the fork side-by-side

This release also adds a native file format for saving ASCII/ANSI
art files. The "Moebius Beyond Document" (.mbd) stores all of the
document data as a gzip-compressed JSON structure that mirrors the
internal format used by Moebius. See the reference document for more
information:

[MBD - Moebius Beyond Doument Format.md](reference/MBD%20-%20Moebius%20Beyond%20Doument%20Format.md)

### Added

- Added a preference to skip the slash screen at startup.
- Clicking the canvas size display in the bottom status bar now
  opens the dialog to resize the canvas.
- Added "Open Reference in Window" option to the drag-and-drop dialog
  for image files.

### Changed

- Updated Electron to 37.2.5 (latest stable version).
- Lots of internal project maintenance including setting up a unit
  testing framework with playrwight and linting/code formatting.

### Removed

- Removed support for the touchbar on macOS. I don't have any
  way to test this feature, and Apple has discontinued it on
  new models.

## v3.2.1 (2025-07-23)

### Fixed

- Fixed the new zoom system to better support trackpads.
    - Two-finger pinch on trackpad will zoom the canvas.
    - Two-finger touch on trackpad will pan the canvas.
    - Added magnetic snapping at 10% zoom intervals.
    - Added sensitivity threshold to prevent accidental panning.
    - Added a velocity curve to the zooming to make it more
      consistent at different scales.

## v3.2.0 (2025-07-22)

### Added

- Added a hotkey SHIFT+ALT+Left Click to grab the character under the
  cursor and load it into the custom block.

### Changed

- Overhauled the zooming system for the main canvas.
    - The canvas now zooms independently from other elements in the UI.
    - Mousewheel zooming is smoother and more responsive.
    - Mousewheel zooming is anchored to the mouse pointer position.
    - Added more zoom menu items with preset levels from 10% to 500%.
    - Added middle mouse button click-and-drag to pan the canvas.
    - Added middle mouse button double-click to reset zoom to 100%.
    - Fixed window scrolling when moving the cursor while zoomed in.

### Fixed

- Fixed X-flipping for characters 184 (╕) and 213 (╒).
- Fixed "Save as..." resetting the editor state and clearing the
  undo/redo history for the current document.

## v3.2.0 (2025-04-05)

### Added

- Added a new menu option "Reset to Default Palette" to reset the
  color palette to standard ANSI.

### Fixed

- Fixed broken links in the Help menu and removed outdated URLs.
- Fixed GSJCI fonts not loading correctly.
- Fixed "Share Online" menu option to upload .ans files to 16colors.
- Fixed "Load Custom Font" menu option to work again.
- Fixed "Open Reference Image" menu option & hotkey to work again.
- Fixed the debug menu showing even if it had not been enabled.
- Fixed "Open In Current Window" causing every subsequent file to
  be opened in the current window.

### Removed

- Removed miscellaneous server/client code. The server feature of
  moebius does not work with this fork, and I have no intention of
  supporting it going forward.
- Removed the discord rich presence feature.
- Removed several unused dependencies.

## v3.0.1 (2025-04-04)

### Fixed

- Fixed a bug preventing Shift+Mouse Wheel Up from changing the reference image
  opacity.
- Right-justifying a line will no longer reset the background color.
- Remapped the hotkeys for Insert/Delete Row/Column to avoid conflicting with
  the hotkeys for moving the cursor inside the character palette.

## v3.0.0 (2025-03-11)

This is the initial release for this fork.

### Added

- Added a new sidebar tool for fine-tuning the size/position of the reference image.
- Added the ability to open a reference image in a separate, always-on-top window.
- Added support for drag-and-drop files from the desktop.
- Added an outline to the cursor when using the brush tool.
- Added a visual grid to the character palette.
- Added a toggle for zooming the character palette to 200%.

### Fixed

- Misc bug fixes.
