# Lichess Board Size Extractor

A Chrome extension that extracts chessboard dimensions from Lichess game pages.

## Features

- **Page Detection**: Automatically detects if you're on a Lichess game page (format: `https://lichess.org/[game_id]`)
- **Dynamic Extraction**: Searches the live DOM for `<cg-container>` elements
- **Dimension Parsing**: Extracts width and height values from the style attribute in pixels
- **Clean Output**: Displays just the numerical values (e.g., "512 × 512")

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to any Lichess game page (e.g., `https://lichess.org/8bEV4PmYxIhw`)
2. Click on the extension icon in your browser toolbar
3. Click the "Extract Board Size" button
4. The extension will:
   - Verify you're on a valid Lichess game page
   - Search for the `<cg-container>` element
   - Extract width and height from its style attribute
   - Display the dimensions (e.g., "512 × 512")

## How It Works

The extension consists of:

- **Manifest**: Defines permissions and scripts
- **Popup**: User interface for interaction
- **Content Script**: Monitors Lichess pages for the chessboard container
- **Background Logic**: Extracts dimensions using Chrome's scripting API

The extension specifically looks for:
```html
<cg-container style="width: 512px; height: 512px; ...">
```

And extracts just the numerical values: `512 × 512`

## Supported URLs

The extension works on Lichess game URLs matching this pattern:
- `https://lichess.org/[8-12 character game ID]`
- Examples:
  - `https://lichess.org/8bEV4PmYxIhw`
  - `https://lichess.org/xA9b2CdE3fGh`
  - `https://lichess.org/12345678/white`

## Troubleshooting

- **"Not a Lichess game page"**: Make sure you're on a game URL, not the homepage or other Lichess pages
- **"cg-container not found"**: The chessboard may not have loaded yet, try waiting a moment and clicking again
- **"No style attribute found"**: The container exists but doesn't have inline styles with dimensions

## Development

The extension uses Chrome Extension Manifest V3 with:
- Active tab permissions for the current page
- Scripting permissions to inject code
- Host permissions specifically for lichess.org
