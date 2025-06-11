// Content script for Lichess Board Size Extractor
// This script runs on all Lichess pages to detect game pages and extract board data dynamically

(function() {
  'use strict';

  let boardObserver = null;
  let currentBoardData = null;

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

    const blockSize = dimensions.width / 8;
    
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

    const boardData = {
      width: dimensions.width,
      height: dimensions.height,
      blockSize: Math.round(blockSize),
      color: color,
      pieces: convertedPieces,
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
      
      // Notify popup if it's open
      chrome.runtime.sendMessage({
        type: 'BOARD_DATA_UPDATED',
        data: currentBoardData
      }).catch(() => {
        // Popup might not be open, ignore error
      });
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
        // Check for added/removed piece elements
        if (mutation.type === 'childList') {
          const addedPieces = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && node.tagName === 'PIECE'
          );
          const removedPieces = Array.from(mutation.removedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && node.tagName === 'PIECE'
          );
          
          if (addedPieces || removedPieces) {
            shouldUpdate = true;
            console.log('Lichess Board Size Extractor: Pieces added/removed detected');
          }
        }
        
        // Check for style changes on piece elements (movement)
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'style' &&
            mutation.target.tagName === 'PIECE') {
          shouldUpdate = true;
          console.log('Lichess Board Size Extractor: Piece movement detected');
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
      attributeFilter: ['style']
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

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Lichess Board Size Extractor: Received message', request);
    if (request.type === 'GET_BOARD_DATA') {
      console.log('Lichess Board Size Extractor: Sending current data', currentBoardData);
      sendResponse({ data: currentBoardData });
    }
  });

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
