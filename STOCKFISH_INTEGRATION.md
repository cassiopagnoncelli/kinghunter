# Stockfish WASM Integration

This Chrome extension now includes Stockfish WASM for chess position analysis.

## What's Added

### Files Added:
- `stockfish.js` - Main Stockfish engine
- `stockfish.wasm` - WebAssembly binary
- `stockfish.worker.js` - Web worker for Stockfish
- `stockfish-engine.js` - JavaScript wrapper for easy integration

### Features Added:
- **Analyze Button**: Click to analyze any Lichess position
- **Position Evaluation**: Shows numerical evaluation (e.g., +1.25 for White advantage)
- **Best Move**: Displays the best move according to Stockfish
- **Principal Variation**: Shows the best line of play
- **Mate Detection**: Identifies forced mate sequences

## How to Use

1. Navigate to any Lichess game page
2. Open the extension popup
3. The extension will automatically extract the current board position
4. Click the **🧠 Analyze** button
5. Wait for Stockfish to analyze the position (2-3 seconds)
6. View the analysis results:
   - **Evaluation**: Position assessment from White's perspective
   - **Best Move**: Recommended move in algebraic notation
   - **Principal Variation**: Best continuation sequence
   - **Depth/Nodes**: Analysis depth and nodes searched

## Technical Details

### Analysis Settings:
- **Depth**: 12 ply (default)
- **Time Limit**: 3 seconds maximum
- **Engine**: Stockfish 15+ (WASM version)

### Supported Formats:
- Input: Full FEN notation with castling rights and en passant
- Output: UCI move notation (e.g., e2e4, g1f3)

## Architecture

The Stockfish integration uses:
1. **stockfish-engine.js**: High-level wrapper class
2. **Chrome Extension APIs**: For resource loading and WASM support
3. **WebAssembly**: For native-speed chess engine performance
4. **UCI Protocol**: Standard chess engine communication

## Performance Notes

- First analysis may take longer (engine initialization)
- Subsequent analyses are faster (engine stays loaded)
- Analysis runs in the browser without external dependencies
- No network requests - everything runs locally

## Troubleshooting

If analysis fails:
1. Check browser console for error messages
2. Ensure you're on a valid Lichess game page
3. Try refreshing the page and reopening the extension
4. The engine may need a moment to initialize on first use

## Future Enhancements

Potential improvements:
- Adjustable analysis depth
- Multiple line analysis
- Opening book integration
- Game evaluation graphs
- Move annotations
