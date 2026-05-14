# App Icon Specification

## Purpose

Defines the Tauri desktop application icon set. All icon files in `src-tauri/icons/` MUST use the new Vibe Studio 4-module viseme symbol, replacing the MVP "OV" placeholder icons.

## Requirements

### Requirement: Icon File Replacement

All icon files in `src-tauri/icons/` MUST be replaced with Vibe Studio brand PNGs. Icons SHALL use the dark variant (indigo symbol on `#0b0b0c` background). The old "OV" placeholder icons MUST NOT remain.

#### Scenario: Main app icon is brand symbol

- GIVEN `src-tauri/icons/icon.png` exists
- WHEN the file is inspected
- THEN it renders the 4-module Vibe Studio viseme symbol
- AND it is NOT the "OV" text placeholder

#### Scenario: Windows tile icons are brand symbol

- GIVEN the app is installed on Windows
- WHEN the app tile appears in the Start Menu
- THEN the tile icon renders the Vibe Studio symbol

### Requirement: Tauri Icon Naming Convention

Icon filenames MUST follow Tauri v2 convention. Required files: `icon.png` (512px), `32x32.png`, `128x128.png`, `128x128@2x.png`, `64x64.png`, `icon.ico`, `icon.icns`, `Square30x30Logo.png`, `Square44x44Logo.png`, `Square71x71Logo.png`, `Square89x89Logo.png`, `Square107x107Logo.png`, `Square142x142Logo.png`, `Square150x150Logo.png`, `Square284x284Logo.png`, `Square310x310Logo.png`, `StoreLogo.png`. All 19 files MUST contain the brand symbol.

#### Scenario: tauri build succeeds with new icons

- GIVEN all icon files exist at correct paths with correct names
- WHEN `cargo tauri build` is executed
- THEN the build completes without icon-related errors
- AND the Windows executable displays the Vibe Studio symbol as its icon

### Requirement: Dark Variant Icons

All icons MUST use the dark variant (indigo symbol on dark background). Light-variant icons (transparent background) SHALL NOT be used as the app runs in dark-first theme.

#### Scenario: Icon visible on dark desktop

- GIVEN the Windows desktop uses a dark background
- WHEN the app shortcut icon is displayed
- THEN the icon is clearly visible with sufficient contrast
- AND the symbol is recognizable, not washed out


## Vibe Studio Override

New Vibe Studio icon: glowing 'V' with soundwaves/brackets.
