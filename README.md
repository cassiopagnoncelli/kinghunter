# King Hunter Chrome Extension

A Chrome extension that helps you find and highlight chess kings on web pages. Perfect for chess enthusiasts who want to quickly identify king pieces and positions while browsing chess content online.

## Features

- 🏹 **King Detection**: Automatically scans web pages for chess kings in various formats
- 👑 **Visual Highlighting**: Highlights found kings with golden borders and crown icons
- 📊 **Statistics Tracking**: Keeps track of kings found and games analyzed
- 🎯 **Smart Recognition**: Detects Unicode chess pieces, text mentions, and chess notation
- ⚡ **Real-time Scanning**: Monitors dynamic content changes on chess websites
- 🔔 **Notifications**: Shows milestone achievements and activity status

## Installation

### From Source (Development)

1. **Clone or download** this repository to your local machine
2. **Add Extension Icons** (see Icons section below)
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable Developer Mode** by toggling the switch in the top right
5. **Click "Load unpacked"** and select the extension directory
6. **Pin the extension** to your toolbar for easy access

### Icons Required

The extension requires the following icon files in the `icons/` directory:

- `icon16.png` - 16x16 pixels
- `icon32.png` - 32x32 pixels  
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

**Icon Design Suggestions:**
- Use a chess king piece or crown symbol
- Colors: Gold (#FFD700) or royal blue theme
- Style: Clean, recognizable at small sizes
- Format: PNG with transparency

You can create these icons using:
- Online icon generators
- Image editing software (Photoshop, GIMP, etc.)
- Icon design tools (Figma, Sketch, etc.)

## Usage

1. **Click the King Hunter icon** in your Chrome toolbar
2. **Click "Activate Hunter"** to start scanning for kings
3. **Visit chess websites** or pages with chess content
4. **Kings will be highlighted** with golden borders and crown icons
5. **View statistics** in the popup to see your progress

### Supported Detection Types

- **Unicode Chess Pieces**: ♔ ♚ (white and black kings)
- **Text Mentions**: Words containing "king" or "King"
- **Chess Notation**: King moves like "Kh4", "Kg8", etc.
- **CSS Classes**: Elements with "king" in their class names
- **Chess Sites**: Enhanced detection on Chess.com, Lichess, etc.

## File Structure

```
kinghunter/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Content script (runs on web pages)
├── background.js         # Background service worker
├── icons/                # Extension icons directory
│   ├── icon16.png       # 16x16 icon
│   ├── icon32.png       # 32x32 icon
│   ├── icon48.png       # 48x48 icon
│   └── icon128.png      # 128x128 icon
└── README.md            # This file
```

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension format
- **Service Worker**: Background script for state management
- **Content Script**: Injected into web pages for king detection
- **Storage API**: Persists settings and statistics
- **Message Passing**: Communication between components

### Permissions

- `activeTab` - Access to current tab for content injection
- `storage` - Save extension settings and statistics

### Browser Compatibility

- Chrome 88+
- Chromium-based browsers (Edge, Brave, etc.)
- Manifest V3 compatible browsers

## Development

### Local Development

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the King Hunter extension
4. Test your changes

### Debugging

- **Popup**: Right-click extension icon → Inspect popup
- **Content Script**: Use browser DevTools on any webpage
- **Background**: Go to `chrome://extensions/` → Click "background page"

### Code Structure

#### manifest.json
Defines extension permissions, scripts, and metadata.

#### popup.html/css/js
The user interface shown when clicking the extension icon.

#### content.js
Runs on web pages to scan for and highlight kings.

#### background.js
Service worker handling extension lifecycle and messaging.

## Customization

### Adding New Detection Patterns

Edit the `CHESS_PATTERNS` object in `content.js`:

```javascript
const CHESS_PATTERNS = {
    // Add your custom patterns here
    customPattern: /your-regex-here/g,
};
```

### Changing Highlight Style

Modify the `HIGHLIGHT_STYLE` CSS in `content.js`:

```css
.king-hunter-highlight {
    background-color: rgba(255, 215, 0, 0.6) !important;
    /* Customize colors, borders, etc. */
}
```

## Troubleshooting

### Extension Not Working
- Check if Developer Mode is enabled
- Verify all files are in the correct directory
- Add the required icon files
- Check browser console for errors

### Kings Not Being Detected
- Make sure the extension is activated (green status)
- Check if the page has loaded completely
- Some sites may use non-standard chess piece representations

### Statistics Not Updating
- Check Chrome storage permissions
- Verify popup and content script communication
- Try refreshing the extension

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Changelog

### Version 1.0.0
- Initial release
- Basic king detection and highlighting
- Statistics tracking
- Chrome Manifest V3 support
- Real-time content monitoring

## Support

For issues, suggestions, or contributions, please create an issue in the project repository.

---

**Happy King Hunting! 👑🏹**
