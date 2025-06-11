# Lichess Board Size Extractor

A Chrome extension that extracts chessboard dimensions and piece positions from Lichess game pages.

## Features

- **Page Detection**: Automatically detects if you're on a Lichess game page (format: `https://lichess.org/[game_id]`)
- **Board Dimensions**: Searches the live DOM for `<cg-container>` elements and extracts width/height
- **Piece Extraction**: Finds all `<piece>` elements within `<cg-board>` and extracts their positions
- **FEN Conversion**: Automatically converts the board position to FEN (Forsyth-Edwards Notation)
- **Clean Output**: Displays board size, FEN notation, and piece data in an organized format
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
- Board dimensions: `512 × 512` (with calculated block size: 64)
- FEN notation: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR` (board position in standard format)
- Piece data in standard chess notation: `["r 0 7", "K 1 6", "p 3 4", ...]`

**Coordinate & Notation Conversion:**
The extension automatically converts pixel coordinates to chess board coordinates (0-7) and uses standard chess piece notation:
- Calculates `block_size = width / 8`
- Converts each piece position: `board_x = round(pixel_x / block_size)`
- **Board Orientation Adjustment**: 
  - **Horizontal Correction**: All X coordinates are horizontally flipped (`x = 7-x`) to correct Lichess's coordinate system
  - **White player view**: Only horizontal correction applied (top-left = a8 = 7,7, bottom-right = h1 = 0,0)
  - **Black player view**: Additional vertical flip applied (`y = 7-y`) to maintain standard chess notation
- **Piece Notation**: 
  - **White pieces** (uppercase): K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, P=Pawn
  - **Black pieces** (lowercase): k=king, q=queen, r=rook, b=bishop, n=knight, p=pawn
- Results in standard chess coordinates from 0-7 for both x and y axes

**FEN (Forsyth-Edwards Notation) Conversion:**
The extension converts the board position to standard FEN notation:
- Creates an 8×8 board representation from piece coordinates
- Converts to FEN format: ranks from 8 to 1 (top to bottom), files from a to h (left to right)
- Empty squares are represented by numbers (1-8), pieces by their notation letters
- Example: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR` (starting position)

## Supported URLs

The extension works on Lichess game URLs matching this pattern:
- `https://lichess.org/[8-12 character game ID]` with optional fragments and parameters
- Examples:
  - `https://lichess.org/8bEV4PmYxIhw`
  - `https://lichess.org/xA9b2CdE3fGh`
  - `https://lichess.org/12345678/white`
  - `https://lichess.org/58kEmJre#33` (with URL fragment)
  - `https://lichess.org/AbCdEfGh?param=value` (with query parameters)

## Troubleshooting

- **"Not a Lichess game page"**: Make sure you're on a game URL, not the homepage or other Lichess pages
- **"cg-container not found"**: The chessboard may not have loaded yet, try waiting a moment and clicking again
- **"No style attribute found"**: The container exists but doesn't have inline styles with dimensions

## Development

The extension uses Chrome Extension Manifest V3 with:
- Active tab permissions for the current page
- Scripting permissions to inject code
- Host permissions specifically for lichess.org
