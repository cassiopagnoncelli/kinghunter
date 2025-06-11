document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const dimensionsEl = document.getElementById('dimensions');

  function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function showResults(boardData) {
    if (!boardData) {
      dimensionsEl.style.display = 'none';
      return;
    }

    dimensionsEl.innerHTML = `
      <div><strong>FEN:</strong></div>
      <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 3px;">
        ${boardData.fen}
      </div>
      <div><strong>Pieces (${boardData.pieces.length}):</strong></div>
      <div style="max-height: 150px; overflow-y: auto; font-size: 12px; margin-top: 5px;">
        ${boardData.pieces.map(piece => `<div>${piece}</div>`).join('')}
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

  async function requestBoardData() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url) {
        updateStatus('Cannot access current page', 'error');
        return;
      }

      // Check if it's a Lichess game page
      if (!isLichessGamePage(tab.url)) {
        updateStatus('Not on a Lichess game page', 'error');
        return;
      }

      updateStatus('Getting board data...', 'info');

      // Request board data from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_BOARD_DATA' });
        
        if (response && response.data) {
          updateStatus('Ready', 'success');
          showResults(response.data);
        } else {
          updateStatus('Loading...', 'info');
          // Try to force extraction using script injection as fallback
          tryFallbackExtraction();
        }
      } catch (messageError) {
        console.log('Popup: Message failed, trying fallback extraction...', messageError);
        updateStatus('Loading...', 'info');
        tryFallbackExtraction();
      }

    } catch (error) {
      updateStatus('Error', 'error');
      console.error('Popup: Error in requestBoardData:', error);
    }
  }

  // Fallback method using script injection (like the old button method)
  async function tryFallbackExtraction() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Inject script to extract data directly
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // This function runs in the page context
          const cgContainer = document.querySelector('cg-container');
          if (!cgContainer) {
            return { error: 'cg-container not found' };
          }

          const style = cgContainer.getAttribute('style');
          if (!style) {
            return { error: 'No style attribute found on cg-container' };
          }

          // Extract dimensions
          const widthMatch = style.match(/width:\s*(\d+)px/);
          const heightMatch = style.match(/height:\s*(\d+)px/);
          
          if (!widthMatch || !heightMatch) {
            return { error: 'Could not extract dimensions from style: ' + style };
          }

          const width = parseInt(widthMatch[1]);
          const height = parseInt(heightMatch[1]);

          // Find pieces
          const cgBoard = document.querySelector('cg-board');
          const pieces = [];
          
          if (cgBoard) {
            const pieceElements = cgBoard.querySelectorAll('piece');
            pieceElements.forEach(piece => {
              const classAttr = piece.getAttribute('class');
              const styleAttr = piece.getAttribute('style');
              
              if (classAttr && styleAttr) {
                const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
                if (translateMatch) {
                  const x = translateMatch[1];
                  const y = translateMatch[2];
                  pieces.push(`${classAttr} ${x} ${y}`);
                }
              }
            });
          }

          // Get board orientation
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
            width: width,
            height: height,
            pieces: pieces,
            color: color,
            timestamp: Date.now(),
            method: 'fallback'
          };
        }
      });

      const result = results[0].result;

      if (result.error) {
        updateStatus('No board found', 'error');
        return;
      }

      // Process the data (similar to the content script)
      const boardData = processBoardData(result);
      updateStatus('Ready', 'success');
      showResults(boardData);

    } catch (error) {
      updateStatus('Error', 'error');
      console.error('Popup: Fallback extraction error:', error);
    }
  }

  // Process raw board data (similar to content script)
  function processBoardData(rawData) {
    const blockSize = rawData.width / 8;
    
    // Convert pieces
    const convertedPieces = rawData.pieces.map(piece => {
      const parts = piece.split(' ');
      if (parts.length >= 4) {
        const className = parts.slice(0, -2).join(' ');
        const pixelX = parseInt(parts[parts.length - 2]);
        const pixelY = parseInt(parts[parts.length - 1]);
        
        let boardX = Math.round(pixelX / blockSize);
        let boardY = Math.round(pixelY / blockSize);
        
        boardX = 7 - boardX; // Fix horizontal mirroring
        
        if (rawData.color === 'black') {
          boardY = 7 - boardY; // Fix vertical mirroring for black
        }
        
        const pieceNotation = convertPieceNotation(className);
        
        return `${pieceNotation} ${boardX} ${boardY}`;
      }
      return piece;
    });

    // Generate FEN
    const fen = convertToFEN(convertedPieces);

    return {
      width: rawData.width,
      height: rawData.height,
      blockSize: Math.round(blockSize),
      color: rawData.color,
      pieces: convertedPieces,
      fen: fen,
      timestamp: rawData.timestamp
    };
  }

  function convertPieceNotation(className) {
    const pieceMap = {
      'knight': 'n', 'pawn': 'p', 'king': 'k',
      'queen': 'q', 'rook': 'r', 'bishop': 'b'
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
    
    return color === 'white' ? pieceType.toUpperCase() : pieceType;
  }

  function convertToFEN(pieces) {
    const board = Array(8).fill(null).map(() => Array(8).fill(''));
    
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

  // Listen for board data updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BOARD_DATA_UPDATED') {
      console.log('Popup: Received board data update', request.data);
      updateStatus('Ready', 'success');
      showResults(request.data);
    }
  });

  // Auto-check when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && isLichessGamePage(tabs[0].url)) {
      updateStatus('Lichess game page detected', 'success');
      requestBoardData();
    } else {
      updateStatus('Not on a Lichess game page', 'error');
    }
  });
});
