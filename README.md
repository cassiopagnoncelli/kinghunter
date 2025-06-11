# Lichess Board Size Extractor

A Chrome extension that extracts chessboard dimensions and piece positions from Lichess game pages.

## Features

- **Page Detection**: Automatically detects if you're on a Lichess game page (format: `https://lichess.org/[game_id]`)
- **Board Dimensions**: Searches the live DOM for `<cg-container>` elements and extracts width/height
- **Piece Extraction**: Finds all `<piece>` elements within `<cg-board>` and extracts their positions
- **Clean Output**: Displays board size and piece data in an organized format
- **Real-time Data**: Works with the dynamic/live DOM as pieces move

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to any Lichess game page (e.g., `https://lichess.org/8bEV4PmYxIhw`)
2. Click on the extension icon in your browser toolbar
3. Click the "Extract Board Data" button
4. The extension will:
   - Verify you're on a valid Lichess game page
   - Search for the `<cg-container>` element and extract board dimensions
   - Find all `<piece>` elements in `<cg-board>` and extract their positions
   - Display both board size and piece information

## How It Works

The extension consists of:

- **Manifest**: Defines permissions and scripts
- **Popup**: User interface for interaction
- **Content Script**: Monitors Lichess pages for the chessboard container
- **Background Logic**: Extracts board and piece data using Chrome's scripting API

The extension specifically looks for:
```html
<cg-container style="width: 512px; height: 512px; ...">
  <cg-board>
    <piece class="black rook" style="transform: translate(420px, 420px);"></piece>
    <piece class="white king" style="transform: translate(280px, 140px);"></piece>
    <!-- ... more pieces -->
  </cg-board>
</cg-container>
```

And extracts:
- Board dimensions: `512 × 512`
- Piece data: `["black rook 420 420", "white king 280 140", ...]`

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
