// Content script for Lichess Board Size Extractor
// This script runs on all Lichess pages to detect game pages and extract board data dynamically

(function() {
  'use strict';

  let boardObserver = null;
  let currentBoardData = null;
  let previousPiecePositions = new Map();

  // Check if current page is a Lichess game page
  function isLichessGamePage() {
    const url = window.location.href;
    const lichessGamePattern = /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}(?:\/.*)?$/;
    return lichessGamePattern.test(url);
  }

  // Convert piece class names to chess notation
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

  // Convert piece positions to FEN notation
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

  // Extract board dimensions from cg-container style
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

  // Detect move by comparing piece positions
  function detectMoveFromPiecePositions(currentPieces) {
    // Create position maps for comparison
    const currentPositions = new Map();
    const currentPiecesByPosition = new Map();
    
    // Process current pieces
    currentPieces.forEach(pieceStr => {
      const parts = pieceStr.split(' ');
      if (parts.length === 3) {
        const piece = parts[0];
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        const position = `${x},${y}`;
        const notation = boardCoordinatesToChessNotation(x, y);
        
        currentPositions.set(piece + position, { piece, x, y, notation });
        currentPiecesByPosition.set(position, { piece, x, y, notation });
      }
    });

    // If no previous positions, store current and return
    if (previousPiecePositions.size === 0) {
      previousPiecePositions.clear();
      currentPositions.forEach((value, key) => {
        previousPiecePositions.set(key, value);
      });
      return null;
    }

    // Find differences
    let movedPiece = null;
    let fromSquare = null;
    let toSquare = null;

    // Look for pieces that changed position
    for (const [piecePos, current] of currentPositions) {
      if (!previousPiecePositions.has(piecePos)) {
        // This piece-position combination is new
        // Find where this piece was before
        const piece = current.piece;
        let foundPrevious = false;
        
        for (const [prevPiecePos, previous] of previousPiecePositions) {
          if (previous.piece === piece && !currentPositions.has(prevPiecePos)) {
            // Found the piece's previous position
            movedPiece = piece;
            fromSquare = previous.notation;
            toSquare = current.notation;
            foundPrevious = true;
            break;
          }
        }
        
        if (foundPrevious) break;
      }
    }

    // Update previous positions for next comparison
    previousPiecePositions.clear();
    currentPositions.forEach((value, key) => {
      previousPiecePositions.set(key, value);
    });

    // Return move information in format: [piece] [source] [destination]
    if (movedPiece && fromSquare && toSquare && fromSquare !== toSquare) {
      return `${movedPiece} ${fromSquare} ${toSquare}`;
    }

    return null;
  }

  // Extract complete board data
  function extractBoardData() {
    const cgContainer = document.querySelector('cg-container');
    if (!cgContainer) {
      console.log('Lichess Board Size Extractor: cg-container not found');
      return null;
    }

    const style = cgContainer.getAttribute('style');
    if (!style) {
      console.log('Lichess Board Size Extractor: No style attribute found');
      return null;
    }

    const dimensions = extractDimensions(style);
    if (!dimensions) {
      console.log('Lichess Board Size Extractor: Could not extract dimensions');
      return null;
    }

    // Find cg-board and extract pieces and last-move squares
    const cgBoard = document.querySelector('cg-board');
    const pieces = [];
    const lastMoveSquares = [];
    
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
      
      console.log('Lichess Board Size Extractor: Found last-move squares:', lastMoveElements.length);
      
      lastMoveElements.forEach((square, index) => {
        const classAttr = square.getAttribute('class');
        const styleAttr = square.getAttribute('style');
        console.log(`Lichess Board Size Extractor: Last-move square ${index}:`, classAttr, styleAttr);
        
        if (classAttr && styleAttr) {
          // Extract translate values from transform
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
      
      // Debug: log all squares to understand the structure
      const allSquares = cgBoard.querySelectorAll('square');
      console.log('Lichess Board Size Extractor: Total squares found:', allSquares.length);
      const squareClasses = Array.from(allSquares).map(sq => sq.getAttribute('class')).filter(Boolean);
      console.log('Lichess Board Size Extractor: All square classes:', [...new Set(squareClasses)]);
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

    const blockSize = dimensions.width / 8;
    
    // Convert pixel coordinates to board coordinates (0-7) and piece notation
    const convertedPieces = pieces.map(piece => {
      const parts = piece.split(' ');
      if (parts.length >= 4) {
        const className = parts.slice(0, -2).join(' '); // Everything except last 2 numbers
        const pixelX = parseInt(parts[parts.length - 2]);
        const pixelY = parseInt(parts[parts.length - 1]);
        
        const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, color);
        const pieceNotation = convertPieceNotation(className);
        
        return `${pieceNotation} ${boardX} ${boardY}`;
      }
      return piece;
    });

    // Detect last move - try highlighted squares first, then piece position comparison
    let lastMoveInfo = null;
    
    if (lastMoveSquares.length >= 2) {
      console.log('Lichess Board Size Extractor: Processing last move squares:', lastMoveSquares);
      
      // Convert squares to chess notation using identical coordinate conversion as pieces
      const convertedSquares = lastMoveSquares.map(square => {
        const pixelX = square.x;
        const pixelY = square.y;
        
        const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, color);
        const chessNotation = boardCoordinatesToChessNotation(boardX, boardY);
        
        console.log(`Lichess Board Size Extractor: Square pixel(${pixelX},${pixelY}) -> board(${boardX},${boardY}) -> ${chessNotation}`);
        
        return { notation: chessNotation, boardX, boardY };
      });
      
      // Find piece on highlighted squares and format as [piece] [source] [destination]
      if (convertedSquares.length >= 2) {
        const square1 = convertedSquares[0];
        const square2 = convertedSquares[1];
        
        console.log('Lichess Board Size Extractor: Checking squares:', square1, square2);
        console.log('Lichess Board Size Extractor: All pieces:', convertedPieces);
        
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
              console.log(`Lichess Board Size Extractor: Found piece ${piece} on square1 ${square1.notation}`);
            }
            // Check if piece is on square2
            if (pieceX === square2.boardX && pieceY === square2.boardY) {
              piece2 = piece;
              console.log(`Lichess Board Size Extractor: Found piece ${piece} on square2 ${square2.notation}`);
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
          console.log('Lichess Board Size Extractor: No pieces found on highlighted squares, using any available piece');
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
        console.log('Lichess Board Size Extractor: Last move detected from squares:', lastMoveInfo);
      }
    } else if (lastMoveSquares.length === 1) {
      // Handle case with only one highlighted square
      const square = lastMoveSquares[0];
      const pixelX = square.x;
      const pixelY = square.y;
      
      const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, color);
      const chessNotation = boardCoordinatesToChessNotation(boardX, boardY);
      
      lastMoveInfo = chessNotation;
      console.log('Lichess Board Size Extractor: Single square highlighted:', lastMoveInfo);
    }
    
    // If no move detected from highlighted squares, try piece position comparison
    if (!lastMoveInfo) {
      console.log('Lichess Board Size Extractor: No highlighted squares found, trying piece position comparison');
      lastMoveInfo = detectMoveFromPiecePositions(convertedPieces);
      if (lastMoveInfo) {
        console.log('Lichess Board Size Extractor: Last move detected from piece positions:', lastMoveInfo);
      } else {
        console.log('Lichess Board Size Extractor: No move detected from piece positions either');
      }
    }

    // Generate FEN notation
    const fenNotation = convertToFEN(convertedPieces);

    const boardData = {
      width: dimensions.width,
      height: dimensions.height,
      blockSize: Math.round(blockSize),
      color: color,
      pieces: convertedPieces,
      last_move: lastMoveInfo,
      fen: fenNotation,
      timestamp: Date.now()
    };

    console.log('Lichess Board Size Extractor: Board data extracted', boardData);
    return boardData;
  }

  // Handle board changes
  function onBoardChange() {
    const newBoardData = extractBoardData();
    if (newBoardData) {
      currentBoardData = newBoardData;
      
      // Notify popup if it's open - handle extension context invalidation
      try {
        chrome.runtime.sendMessage({
          type: 'BOARD_DATA_UPDATED',
          data: currentBoardData
        }).catch((error) => {
          // Check if it's extension context invalidated error
          if (error.message && error.message.includes('Extension context invalidated')) {
            console.log('Lichess Board Size Extractor: Extension context invalidated, stopping observers');
            // Clean up observers when extension context is invalidated
            if (boardObserver) {
              boardObserver.disconnect();
              boardObserver = null;
            }
            if (periodicCheck) {
              clearInterval(periodicCheck);
              periodicCheck = null;
            }
            return;
          }
          // For other errors (like popup not open), just ignore
          console.log('Lichess Board Size Extractor: Message send failed (likely popup not open)');
        });
      } catch (error) {
        // Handle synchronous errors (like when chrome.runtime is undefined)
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('Lichess Board Size Extractor: Extension context invalidated, stopping observers');
          // Clean up observers
          if (boardObserver) {
            boardObserver.disconnect();
            boardObserver = null;
          }
          if (periodicCheck) {
            clearInterval(periodicCheck);
            periodicCheck = null;
          }
        }
      }
    }
  }

  // Set up observer for cg-board changes
  function setupBoardObserver() {
    const cgBoard = document.querySelector('cg-board');
    if (!cgBoard) {
      console.log('Lichess Board Size Extractor: cg-board not found, retrying...', document.querySelectorAll('*[class*="cg"]'));
      setTimeout(setupBoardObserver, 500);
      return;
    }

    console.log('Lichess Board Size Extractor: Setting up cg-board observer', cgBoard);

    // Disconnect previous observer if exists
    if (boardObserver) {
      boardObserver.disconnect();
    }

    // Create new observer
    boardObserver = new MutationObserver(function(mutations) {
      let shouldUpdate = false;
      
      mutations.forEach(function(mutation) {
        // Check for added/removed piece or square elements
        if (mutation.type === 'childList') {
          const addedPieces = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'PIECE' || node.tagName === 'SQUARE')
          );
          const removedPieces = Array.from(mutation.removedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'PIECE' || node.tagName === 'SQUARE')
          );
          
          if (addedPieces || removedPieces) {
            shouldUpdate = true;
            console.log('Lichess Board Size Extractor: Pieces/squares added/removed detected');
          }
        }
        
        // Check for style changes on piece or square elements (movement)
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'style' &&
            (mutation.target.tagName === 'PIECE' || mutation.target.tagName === 'SQUARE')) {
          shouldUpdate = true;
          console.log('Lichess Board Size Extractor: Piece/square movement detected');
        }
        
        // Check for class changes on square elements (last-move highlighting)
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'class' &&
            mutation.target.tagName === 'SQUARE') {
          shouldUpdate = true;
          console.log('Lichess Board Size Extractor: Square class change detected');
        }
      });
      
      if (shouldUpdate) {
        console.log('Lichess Board Size Extractor: Board change detected, updating...');
        // Debounce rapid changes
        clearTimeout(onBoardChange.timeout);
        onBoardChange.timeout = setTimeout(onBoardChange, 100);
      }
    });

    // Start observing
    boardObserver.observe(cgBoard, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    console.log('Lichess Board Size Extractor: Observer started, doing initial extraction...');
    // Initial extraction
    onBoardChange();
  }

  // Periodic backup check to ensure we have data
  let periodicCheck = null;
  
  function startPeriodicCheck() {
    if (periodicCheck) clearInterval(periodicCheck);
    
    periodicCheck = setInterval(() => {
      if (!currentBoardData && isLichessGamePage()) {
        console.log('Lichess Board Size Extractor: Periodic check - trying to extract data...');
        onBoardChange();
      }
    }, 2000); // Check every 2 seconds
  }

  // Initialize when DOM is ready
  function initialize() {
    if (isLichessGamePage()) {
      console.log('Lichess Board Size Extractor: Game page detected');
      setupBoardObserver();
      startPeriodicCheck();
      
      // Also try immediate extraction
      setTimeout(() => {
        if (!currentBoardData) {
          console.log('Lichess Board Size Extractor: No data yet, forcing extraction...');
          onBoardChange();
        }
      }, 1000);
    }
  }

  // Handle messages from popup with error handling
  function handleMessage(request, sender, sendResponse) {
    try {
      console.log('Lichess Board Size Extractor: Received message', request);
      if (request.type === 'GET_BOARD_DATA') {
        console.log('Lichess Board Size Extractor: Sending current data', currentBoardData);
        sendResponse({ data: currentBoardData });
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('Lichess Board Size Extractor: Extension context invalidated in message handler');
        // Clean up observers
        if (boardObserver) {
          boardObserver.disconnect();
          boardObserver = null;
        }
        if (periodicCheck) {
          clearInterval(periodicCheck);
          periodicCheck = null;
        }
      }
    }
  }

  // Add message listener with error protection
  try {
    chrome.runtime.onMessage.addListener(handleMessage);
  } catch (error) {
    console.log('Lichess Board Size Extractor: Could not add message listener:', error);
  }

  // Run when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Also try initialization after a short delay in case elements aren't ready
  setTimeout(() => {
    if (!currentBoardData && isLichessGamePage()) {
      console.log('Lichess Board Size Extractor: Delayed initialization attempt...');
      initialize();
    }
  }, 2000);

  // Handle navigation changes (for single-page applications)
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(initialize, 500); // Delay to allow page to load
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
