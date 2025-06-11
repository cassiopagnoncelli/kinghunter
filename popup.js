document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const dimensionsEl = document.getElementById('dimensions');
  const extractBtn = document.getElementById('extractBtn');

  function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function showDimensions(width, height) {
    dimensionsEl.textContent = `${width} × ${height}`;
    dimensionsEl.style.display = 'block';
  }

  function convertPieceNotation(className) {
    const pieceMap = {
      'knight': 'n',
      'pawn': 'p', 
      'king': 'k',
      'queen': 'q',
      'rook': 'r',
      'bishop': 'b'
    };
    
    const parts = className.toLowerCase().split(' ');
    const color = parts.includes('white') ? 'white' : 'black';
    
    let pieceType = '';
    for (const part of parts) {
      if (pieceMap[part]) {
        pieceType = pieceMap[part];
        break;
      }
    }
    
    // Uppercase for white, lowercase for black
    return color === 'white' ? pieceType.toUpperCase() : pieceType;
  }

  function convertToFEN(pieces) {
    // Initialize 8x8 board with empty squares
    const board = Array(8).fill(null).map(() => Array(8).fill(''));
    
    // Place pieces on the board
    pieces.forEach(pieceStr => {
      const parts = pieceStr.split(' ');
      if (parts.length === 3) {
        const piece = parts[0];
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        
        if (x >= 0 && x <= 7 && y >= 0 && y <= 7) {
          board[y][x] = piece;
        }
      }
    });
    
    // Convert to FEN notation (rank 8 to rank 1, which is y=7 to y=0)
    const fenRanks = [];
    for (let y = 7; y >= 0; y--) {
      let rankStr = '';
      let emptyCount = 0;
      
      for (let x = 0; x <= 7; x++) {
        if (board[y][x] === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rankStr += emptyCount;
            emptyCount = 0;
          }
          rankStr += board[y][x];
        }
      }
      
      if (emptyCount > 0) {
        rankStr += emptyCount;
      }
      
      fenRanks.push(rankStr);
    }
    
    return fenRanks.join('/');
  }

  function showResults(width, height, pieces, color) {
    const blockSize = width / 8;
    
    // Convert pixel coordinates to board coordinates (0-7) and piece notation
    const convertedPieces = pieces.map(piece => {
      const parts = piece.split(' ');
      if (parts.length >= 4) {
        const className = parts.slice(0, -2).join(' '); // Everything except last 2 numbers
        const pixelX = parseInt(parts[parts.length - 2]);
        const pixelY = parseInt(parts[parts.length - 1]);
        
        let boardX = Math.round(pixelX / blockSize);
        let boardY = Math.round(pixelY / blockSize);
        
        // Fix horizontal mirroring - Lichess coordinates are horizontally flipped
        boardX = 7 - boardX;
        
        // Adjust coordinates based on board orientation
        if (color === 'black') {
          // When playing as black, the board is also vertically flipped
          boardY = 7 - boardY;
        }
        
        const pieceNotation = convertPieceNotation(className);
        
        return `${pieceNotation} ${boardX} ${boardY}`;
      }
      return piece;
    });

    // Generate FEN notation
    const fenNotation = convertToFEN(convertedPieces);

    dimensionsEl.innerHTML = `
      <div><strong>Board Size:</strong> ${width} × ${height} (Block Size: ${Math.round(blockSize)})</div>
      <div><strong>Board Orientation:</strong> ${color}</div>
      <div><strong>FEN:</strong></div>
      <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 3px;">
        ${fenNotation}
      </div>
      <div><strong>Pieces (${convertedPieces.length}):</strong></div>
      <div style="max-height: 150px; overflow-y: auto; font-size: 12px; margin-top: 5px;">
        ${convertedPieces.map(piece => `<div>${piece}</div>`).join('')}
      </div>
    `;
    dimensionsEl.style.display = 'block';
  }


  function isLichessGamePage(url) {
    // Check if URL matches https://lichess.org/[game_id] format
    // Handles fragments (#) and query parameters (?) after game ID
    const lichessGamePattern = /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}(?:[\/\?\#].*)?$/;
    return lichessGamePattern.test(url);
  }

  function extractDimensions(styleStr) {
    if (!styleStr) return null;
    
    const widthMatch = styleStr.match(/width:\s*(\d+)px/);
    const heightMatch = styleStr.match(/height:\s*(\d+)px/);
    
    if (widthMatch && heightMatch) {
      return {
        width: parseInt(widthMatch[1]),
        height: parseInt(heightMatch[1])
      };
    }
    return null;
  }

  extractBtn.addEventListener('click', async function() {
    try {
      extractBtn.disabled = true;
      updateStatus('Checking page...', 'info');

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url) {
        updateStatus('Cannot access current page', 'error');
        return;
      }

      // Check if it's a Lichess game page
      if (!isLichessGamePage(tab.url)) {
        updateStatus('Not a Lichess game page', 'error');
        return;
      }

      updateStatus('Extracting board data...', 'info');

      // Inject script to find cg-container, pieces, and board orientation
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const cgContainer = document.querySelector('cg-container');
          if (!cgContainer) {
            return { error: 'cg-container not found' };
          }

          const style = cgContainer.getAttribute('style');
          if (!style) {
            return { error: 'No style attribute found' };
          }

          // Find cg-board and extract pieces
          const cgBoard = document.querySelector('cg-board');
          const pieces = [];
          
          if (cgBoard) {
            const pieceElements = cgBoard.querySelectorAll('piece');
            pieceElements.forEach(piece => {
              const classAttr = piece.getAttribute('class');
              const styleAttr = piece.getAttribute('style');
              
              if (classAttr && styleAttr) {
                // Extract translate values from transform
                const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
                if (translateMatch) {
                  const x = translateMatch[1];
                  const y = translateMatch[2];
                  pieces.push(`${classAttr} ${x} ${y}`);
                }
              }
            });
          }

          // Determine board orientation by checking coords element
          let color = 'unknown';
          const coordsElement = document.querySelector('coords');
          if (coordsElement) {
            const coordsClass = coordsElement.getAttribute('class');
            if (coordsClass === 'files') {
              color = 'white';
            } else if (coordsClass === 'files black') {
              color = 'black';
            }
          }

          return { 
            style: style,
            pieces: pieces,
            color: color
          };
        }
      });

      const result = results[0].result;

      if (result.error) {
        updateStatus(result.error, 'error');
        return;
      }

      const dimensions = extractDimensions(result.style);
      
      if (!dimensions) {
        updateStatus('Could not extract width/height from style', 'error');
        return;
      }

      updateStatus('Board data extracted!', 'success');
      showResults(dimensions.width, dimensions.height, result.pieces, result.color);

    } catch (error) {
      updateStatus(`Error: ${error.message}`, 'error');
    } finally {
      extractBtn.disabled = false;
    }
  });

  // Auto-check when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && isLichessGamePage(tabs[0].url)) {
      updateStatus('Lichess game page detected', 'success');
    } else {
      updateStatus('Not on a Lichess game page', 'error');
    }
  });
});
