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

    let lastMoveSection = `
      <div><strong>Last Move:</strong></div>
      <div style="font-family: monospace; font-size: 12px; margin: 5px 0; padding: 5px; background: #e8f4fd; border-radius: 3px;">
        ${boardData.last_move || 'No last move detected'}
      </div>
    `;

    dimensionsEl.innerHTML = `
      <div><strong>FEN:</strong></div>
      <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 3px;">
        ${boardData.fen}
      </div>
      ${lastMoveSection}
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

          // Find pieces and last-move squares
          const cgBoard = document.querySelector('cg-board');
          const pieces = [];
          const lastMoveSquares = [];
          
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
            
            // Extract last-move squares - try multiple selectors
            let lastMoveElements = cgBoard.querySelectorAll('square.last-move');
            
            // If no elements found with .last-move, try other selectors
            if (lastMoveElements.length === 0) {
              lastMoveElements = cgBoard.querySelectorAll('square[class*="last"]');
            }
            if (lastMoveElements.length === 0) {
              lastMoveElements = cgBoard.querySelectorAll('square[class*="move"]');
            }
            if (lastMoveElements.length === 0) {
              lastMoveElements = cgBoard.querySelectorAll('square[class*="highlight"]');
            }
            
            lastMoveElements.forEach((square, index) => {
              const classAttr = square.getAttribute('class');
              const styleAttr = square.getAttribute('style');
              
              if (classAttr && styleAttr) {
                const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
                if (translateMatch) {
                  const x = parseInt(translateMatch[1]);
                  const y = parseInt(translateMatch[2]);
                  lastMoveSquares.push({
                    class: classAttr,
                    x: x,
                    y: y,
                    raw: `${classAttr} ${x} ${y}`
                  });
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
            lastMoveSquares: lastMoveSquares,
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

  // Convert pixel coordinates to board coordinates using the same logic for both pieces and squares
  function convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, boardColor) {
    let boardX = Math.round(pixelX / blockSize);
    let boardY = Math.round(pixelY / blockSize);
    
    // Files (columns) are already correct, no horizontal flip needed
    
    // Ranks (rows): Lichess uses Y=0 at top, but chess notation has rank 1 at bottom
    // So we need to flip Y coordinates to get correct ranks
    boardY = 7 - boardY;
    
    // Additional adjustment for board orientation
    if (boardColor === 'black') {
      // When playing as black, flip again to correct orientation
      boardY = 7 - boardY;
    }
    
    return { boardX, boardY };
  }

  // Convert board coordinates to chess notation
  function boardCoordinatesToChessNotation(boardX, boardY) {
    const file = String.fromCharCode(97 + boardX); // 97 is 'a'
    const rank = boardY + 1;
    return `${file}${rank}`;
  }

  // Process raw board data (similar to content script)
  function processBoardData(rawData) {
    const blockSize = rawData.width / 8;
    
    // Convert pieces using shared coordinate conversion logic
    const convertedPieces = rawData.pieces.map(piece => {
      const parts = piece.split(' ');
      if (parts.length >= 4) {
        const className = parts.slice(0, -2).join(' ');
        const pixelX = parseInt(parts[parts.length - 2]);
        const pixelY = parseInt(parts[parts.length - 1]);
        
        const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, rawData.color);
        const pieceNotation = convertPieceNotation(className);
        
        return `${pieceNotation} ${boardX} ${boardY}`;
      }
      return piece;
    });

    // Convert last-move squares using the exact same logic as pieces
    let lastMoveInfo = null;
    if (rawData.lastMoveSquares && rawData.lastMoveSquares.length >= 2) {
      console.log('Popup: Processing last move squares:', rawData.lastMoveSquares);
      
      // Convert squares to chess notation using identical coordinate conversion as pieces
      const convertedSquares = rawData.lastMoveSquares.map(square => {
        const pixelX = square.x;
        const pixelY = square.y;
        
        const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, rawData.color);
        const chessNotation = boardCoordinatesToChessNotation(boardX, boardY);
        
        console.log(`Popup: Square pixel(${pixelX},${pixelY}) -> board(${boardX},${boardY}) -> ${chessNotation}`);
        
        return { notation: chessNotation, boardX, boardY };
      });
      
      // Find piece on highlighted squares and format as [piece] [source] [destination]
      if (convertedSquares.length >= 2) {
        const square1 = convertedSquares[0];
        const square2 = convertedSquares[1];
        
        console.log('Popup: Checking squares:', square1, square2);
        console.log('Popup: All pieces:', convertedPieces);
        
        // Look for pieces on both squares to determine which is origin and which is destination
        let piece1 = null;
        let piece2 = null;
        
        for (const pieceStr of convertedPieces) {
          const parts = pieceStr.split(' ');
          if (parts.length === 3) {
            const piece = parts[0];
            const pieceX = parseInt(parts[1]);
            const pieceY = parseInt(parts[2]);
            
            // Check if piece is on square1
            if (pieceX === square1.boardX && pieceY === square1.boardY) {
              piece1 = piece;
              console.log(`Popup: Found piece ${piece} on square1 ${square1.notation}`);
            }
            // Check if piece is on square2
            if (pieceX === square2.boardX && pieceY === square2.boardY) {
              piece2 = piece;
              console.log(`Popup: Found piece ${piece} on square2 ${square2.notation}`);
            }
          }
        }
        
        // Determine move based on which square has the piece (destination has piece after move)
        let movedPiece = null;
        let fromSquare = null;
        let toSquare = null;
        
        if (piece1 && !piece2) {
          // Piece is on square1, so square2 -> square1
          movedPiece = piece1;
          fromSquare = square2.notation;
          toSquare = square1.notation;
        } else if (piece2 && !piece1) {
          // Piece is on square2, so square1 -> square2
          movedPiece = piece2;
          fromSquare = square1.notation;
          toSquare = square2.notation;
        } else if (piece1 && piece2) {
          // Both squares have pieces - use the piece that's different or first one found
          movedPiece = piece2; // Assume square2 is destination
          fromSquare = square1.notation;
          toSquare = square2.notation;
        } else {
          // No pieces found - try using any piece as fallback
          console.log('Popup: No pieces found on highlighted squares, using any available piece');
          if (convertedPieces.length > 0) {
            const firstPiece = convertedPieces[0].split(' ')[0];
            movedPiece = firstPiece;
            fromSquare = square1.notation;
            toSquare = square2.notation;
          }
        }
        
        if (movedPiece) {
          lastMoveInfo = `${movedPiece} ${fromSquare} ${toSquare}`;
        } else {
          lastMoveInfo = `? ${square1.notation} ${square2.notation}`;
        }
        console.log('Popup: Last move detected:', lastMoveInfo);
      }
    } else if (rawData.lastMoveSquares && rawData.lastMoveSquares.length === 1) {
      // Handle case with only one highlighted square
      const square = rawData.lastMoveSquares[0];
      const pixelX = square.x;
      const pixelY = square.y;
      
      const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, rawData.color);
      const chessNotation = boardCoordinatesToChessNotation(boardX, boardY);
      
      lastMoveInfo = chessNotation;
      console.log('Popup: Single square highlighted:', lastMoveInfo);
    } else {
      console.log('Popup: No last move squares found');
    }

    // Generate FEN
    const fen = convertToFEN(convertedPieces);

    return {
      width: rawData.width,
      height: rawData.height,
      blockSize: Math.round(blockSize),
      color: rawData.color,
      pieces: convertedPieces,
      last_move: lastMoveInfo,
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
