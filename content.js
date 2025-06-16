// Content script for Lichess Board Size Extractor
// This script runs on all Lichess pages to detect game pages and extract board data dynamically

(function() {
  'use strict';

  let previous_tree = null;
  let current_tree = null;
  let pollingInterval = null;
  let currentBoardData = null;
  
  // Track FEN and Last Move changes
  let fen_last = null;
  let fen_current = null;
  let last_move_last = null;
  let last_move_current = null;
  
  // Track castling rights and en passant
  let white_king_moved = false;
  let white_king_rook_moved = false;
  let white_queen_rook_moved = false;
  let black_king_moved = false;
  let black_king_rook_moved = false;
  let black_queen_rook_moved = false;
  let en_passant = '';
  let move_number = 1;
  let current_player = 'w'; // w for white, b for black

  // Check if current page is a Lichess game page
  function isLichessGamePage() {
    const url = window.location.href;
    const lichessGamePattern = /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}(?:\/.*)?$/;
    return lichessGamePattern.test(url);
  }

  // Create a virtual DOM representation of the cg-board
  function captureCurrentTree() {
    const cgBoard = document.querySelector('cg-board');
    if (!cgBoard) {
      return null;
    }

    // Create a simplified representation of the board state
    const tree = {
      pieces: [],
      squares: []
    };

    // Capture all piece elements
    const pieceElements = cgBoard.querySelectorAll('piece');
    pieceElements.forEach(piece => {
      const classAttr = piece.getAttribute('class');
      const styleAttr = piece.getAttribute('style');
      if (classAttr && styleAttr) {
        tree.pieces.push({
          class: classAttr,
          style: styleAttr
        });
      }
    });

    // Capture all square elements (for highlighting)
    const squareElements = cgBoard.querySelectorAll('square');
    squareElements.forEach(square => {
      const classAttr = square.getAttribute('class');
      const styleAttr = square.getAttribute('style');
      if (classAttr && styleAttr) {
        tree.squares.push({
          class: classAttr,
          style: styleAttr
        });
      }
    });

    return tree;
  }

  // Compare two trees to see if they're different
  function treesAreDifferent(tree1, tree2) {
    if (!tree1 && !tree2) return false;
    if (!tree1 || !tree2) return true;

    // Compare pieces
    if (tree1.pieces.length !== tree2.pieces.length) return true;
    for (let i = 0; i < tree1.pieces.length; i++) {
      if (tree1.pieces[i].class !== tree2.pieces[i].class ||
          tree1.pieces[i].style !== tree2.pieces[i].style) {
        return true;
      }
    }

    // Compare squares
    if (tree1.squares.length !== tree2.squares.length) return true;
    for (let i = 0; i < tree1.squares.length; i++) {
      if (tree1.squares[i].class !== tree2.squares[i].class ||
          tree1.squares[i].style !== tree2.squares[i].style) {
        return true;
      }
    }

    return false;
  }

  // Deep copy a tree
  function copyTree(tree) {
    if (!tree) return null;
    return {
      pieces: tree.pieces.map(p => ({ class: p.class, style: p.style })),
      squares: tree.squares.map(s => ({ class: s.class, style: s.style }))
    };
  }

  // Event triggered when a new move is detected
  function new_move_event() {
    console.log("Hello, I found a new move.");
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
    
    return color === 'white' ? pieceType.toUpperCase() : pieceType;
  }

  // Convert piece positions to FEN notation
  function convertToFEN(pieces) {
    const board = Array(8).fill(null).map(() => Array(8).fill(''));
    
    pieces.forEach(pieceStr => {
      const parts = pieceStr.split(' ');
      if (parts.length === 3) {
        const piece = parts[0];
        const x = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        
        if (x >= 0 && x <= 7 && y >= 0 && y <= 7) {
          // MIRROR HORIZONTALLY: a->h, b->g, c->f, d->e for ALL pieces
          const mirroredX = 7 - x;
          console.log(`Lichess Board Size Extractor: Mirroring piece ${piece} from (${x},${y}) to (${mirroredX},${y})`);
          board[y][mirroredX] = piece;
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

  // Convert pixel coordinates to board coordinates
  function convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, boardColor) {
    let boardX = Math.round(pixelX / blockSize);
    let boardY = Math.round(pixelY / blockSize);
    
    console.log(`Lichess Board Size Extractor: Converting pixel(${pixelX},${pixelY}) for ${boardColor} player`);
    console.log(`Lichess Board Size Extractor: Initial board coordinates: (${boardX},${boardY})`);
    
    if (boardColor === 'white') {
      // For white: top-left = a8, bottom-right = h1
      // pixelY=0 is rank 8, pixelY=7 is rank 1
      boardY = 7 - boardY;
      console.log(`Lichess Board Size Extractor: WHITE - Applied Y flip: (${boardX},${boardY})`);
    } else if (boardColor === 'black') {
      // For black: Remove horizontal inversion - use coordinates as-is
      // Keep both X and Y coordinates as they are for black
      console.log(`Lichess Board Size Extractor: BLACK - No inversion applied: (${boardX},${boardY})`);
    } else {
      console.log(`Lichess Board Size Extractor: UNKNOWN board color: ${boardColor}`);
    }
    
    return { boardX, boardY };
  }

  // Convert board coordinates to chess notation
  function boardCoordinatesToChessNotation(boardX, boardY) {
    const file = String.fromCharCode(97 + boardX);
    const rank = boardY + 1;
    return `${file}${rank}`;
  }

  // Generate castling rights string for FEN
  function generateCastlingRights() {
    let castling = '';
    
    // White castling rights
    if (!white_king_moved && !white_king_rook_moved) {
      castling += 'K'; // White kingside
    }
    if (!white_king_moved && !white_queen_rook_moved) {
      castling += 'Q'; // White queenside
    }
    
    // Black castling rights
    if (!black_king_moved && !black_king_rook_moved) {
      castling += 'k'; // Black kingside
    }
    if (!black_king_moved && !black_queen_rook_moved) {
      castling += 'q'; // Black queenside
    }
    
    return castling || '-'; // Return '-' if no castling rights available
  }

  // Generate full FEN string
  function generateFullFEN(fenPieces) {
    const playerCode = current_player;
    const castlingRights = generateCastlingRights();
    const enPassantSquare = en_passant || '-';
    const halfmoveClock = '0'; // Always 0 as requested
    const fullmoveNumber = move_number;
    
    return `${fenPieces} ${playerCode} ${castlingRights} ${enPassantSquare} ${halfmoveClock} ${fullmoveNumber}`;
  }

  // Update castling rights and en passant based on last move
  function updateCastlingRights(lastMove) {
    if (!lastMove) return;
    
    console.log('Lichess Board Size Extractor: Checking castling rights and en passant for move:', lastMove);
    
    // Clear en passant first (it's only valid for one move)
    en_passant = '';
    
    // Handle castling moves first
    if (lastMove === 'O-O') {
      // Kingside castling - determine color by checking which king still has rights
      if (!white_king_moved) {
        // White kingside castling
        white_king_moved = true;
        white_king_rook_moved = true;
        console.log('Lichess Board Size Extractor: White kingside castling - all white castling rights lost');
      } else if (!black_king_moved) {
        // Black kingside castling
        black_king_moved = true;
        black_king_rook_moved = true;
        console.log('Lichess Board Size Extractor: Black kingside castling - all black castling rights lost');
      }
      return;
    }
    
    if (lastMove === 'O-O-O') {
      // Queenside castling - determine color by checking which king still has rights
      if (!white_king_moved) {
        // White queenside castling
        white_king_moved = true;
        white_queen_rook_moved = true;
        console.log('Lichess Board Size Extractor: White queenside castling - all white castling rights lost');
      } else if (!black_king_moved) {
        // Black queenside castling
        black_king_moved = true;
        black_queen_rook_moved = true;
        console.log('Lichess Board Size Extractor: Black queenside castling - all black castling rights lost');
      }
      return;
    }
    
    // Parse the move format: "piece fromSquare toSquare" (e.g., "K e1 g1")
    const parts = lastMove.split(' ');
    if (parts.length !== 3) return;
    
    const piece = parts[0];
    const fromSquare = parts[1];
    const toSquare = parts[2];
    
    // Check for en passant conditions - any pawn jumping two squares
    if (piece === 'P' || piece === 'p') {
      const fromRank = parseInt(fromSquare[1]);
      const toRank = parseInt(toSquare[1]);
      
      // Check for any two-square pawn jump: 2->4 (white) or 7->5 (black)
      if ((fromRank === 2 && toRank === 4) || (fromRank === 7 && toRank === 5)) {
        en_passant = toSquare; // Current square where the pawn is now located
        console.log(`Lichess Board Size Extractor: Pawn ${piece} jumped ${fromRank}->${toRank}, subject to en passant at:`, en_passant);
      }
    }
    
    // Track white king moves
    if (piece === 'K') {
      if (!white_king_moved) {
        white_king_moved = true;
        console.log('Lichess Board Size Extractor: White king moved - castling rights lost');
      }
    }
    
    // Track white rook moves
    if (piece === 'R') {
      if (fromSquare === 'a1' && !white_queen_rook_moved) {
        white_queen_rook_moved = true;
        console.log('Lichess Board Size Extractor: White queen rook moved from a1 - queenside castling lost');
      }
      if (fromSquare === 'h1' && !white_king_rook_moved) {
        white_king_rook_moved = true;
        console.log('Lichess Board Size Extractor: White king rook moved from h1 - kingside castling lost');
      }
    }
    
    // Track black king moves
    if (piece === 'k') {
      if (!black_king_moved) {
        black_king_moved = true;
        console.log('Lichess Board Size Extractor: Black king moved - castling rights lost');
      }
    }
    
    // Track black rook moves
    if (piece === 'r') {
      if (fromSquare === 'a8' && !black_queen_rook_moved) {
        black_queen_rook_moved = true;
        console.log('Lichess Board Size Extractor: Black queen rook moved from a8 - queenside castling lost');
      }
      if (fromSquare === 'h8' && !black_king_rook_moved) {
        black_king_rook_moved = true;
        console.log('Lichess Board Size Extractor: Black queen rook moved from h8 - kingside castling lost');
      }
    }
  }

  // Process board data and track FEN/LastMove changes
  function processBoardData(virtualTree = null) {
    // Use current_tree if no tree provided
    const tree = virtualTree || current_tree;
    if (!tree) {
      console.log('Lichess Board Size Extractor: No virtual tree available for parsing');
      return;
    }

    // Still need dimensions from actual DOM since it's not in virtual tree
    const cgContainer = document.querySelector('cg-container');
    if (!cgContainer) return;

    const style = cgContainer.getAttribute('style');
    if (!style) return;

    const dimensions = extractDimensions(style);
    if (!dimensions) return;

    console.log('Lichess Board Size Extractor: Processing virtual DOM tree - pieces:', tree.pieces.length, 'squares:', tree.squares.length);

    const pieces = [];
    const lastMoveSquares = [];
    
    // Extract pieces from virtual tree
    tree.pieces.forEach(piece => {
      const classAttr = piece.class;
      const styleAttr = piece.style;
      
      if (classAttr && styleAttr) {
        const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
        if (translateMatch) {
          const x = translateMatch[1];
          const y = translateMatch[2];
          pieces.push(`${classAttr} ${x} ${y}`);
        }
      }
    });

    // Extract last-move squares from virtual tree
    tree.squares.forEach(square => {
      const classAttr = square.class;
      const styleAttr = square.style;
      
      // Check if this square is a last-move indicator
      if (classAttr && styleAttr && 
          (classAttr.includes('last-move') || 
           classAttr.includes('last') || 
           classAttr.includes('move') || 
           classAttr.includes('highlight'))) {
        
        const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
        if (translateMatch) {
          const x = parseInt(translateMatch[1]);
          const y = parseInt(translateMatch[2]);
          lastMoveSquares.push({
            class: classAttr,
            x: x,
            y: y
          });
        }
      }
    });

    // Determine board orientation
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
    
    // Convert pieces
    const convertedPieces = pieces.map(piece => {
      const parts = piece.split(' ');
      if (parts.length >= 4) {
        const className = parts.slice(0, -2).join(' ');
        const pixelX = parseInt(parts[parts.length - 2]);
        const pixelY = parseInt(parts[parts.length - 1]);
        
        const { boardX, boardY } = convertPixelToBoardCoordinates(pixelX, pixelY, blockSize, color);
        const pieceNotation = convertPieceNotation(className);
        
        return `${pieceNotation} ${boardX} ${boardY}`;
      }
      return piece;
    });

    // Process last move
    let lastMoveInfo = null;
    if (lastMoveSquares.length >= 2) {
      const convertedSquares = lastMoveSquares.map(square => {
        const { boardX, boardY } = convertPixelToBoardCoordinates(square.x, square.y, blockSize, color);
        return { notation: boardCoordinatesToChessNotation(boardX, boardY), boardX, boardY };
      });
      
      if (convertedSquares.length >= 2) {
        const square1 = convertedSquares[0];
        const square2 = convertedSquares[1];
        
        let piece1 = null;
        let piece2 = null;
        
        for (const pieceStr of convertedPieces) {
          const parts = pieceStr.split(' ');
          if (parts.length === 3) {
            const piece = parts[0];
            const pieceX = parseInt(parts[1]);
            const pieceY = parseInt(parts[2]);
            
            if (pieceX === square1.boardX && pieceY === square1.boardY) {
              piece1 = piece;
            }
            if (pieceX === square2.boardX && pieceY === square2.boardY) {
              piece2 = piece;
            }
          }
        }
        
        let movedPiece = null;
        let fromSquare = null;
        let toSquare = null;
        
        if (piece1 && !piece2) {
          movedPiece = piece1;
          fromSquare = square2.notation;
          toSquare = square1.notation;
        } else if (piece2 && !piece1) {
          movedPiece = piece2;
          fromSquare = square1.notation;
          toSquare = square2.notation;
        } else if (piece1 && piece2) {
          movedPiece = piece2;
          fromSquare = square1.notation;
          toSquare = square2.notation;
        } else if (!piece1 && !piece2) {
          // No piece found on either square - this could be castling
          const sq1 = square1.notation;
          const sq2 = square2.notation;
          
          // Check for castling patterns
          if ((sq1 === 'e1' && sq2 === 'g1') || (sq2 === 'e1' && sq1 === 'g1') ||
              (sq1 === 'e1' && sq2 === 'h1') || (sq2 === 'e1' && sq1 === 'h1')) {
            // White kingside castling
            lastMoveInfo = 'O-O';
            console.log('Lichess Board Size Extractor: Detected white kingside castling');
          } else if ((sq1 === 'e1' && sq2 === 'c1') || (sq2 === 'e1' && sq1 === 'c1')) {
            // White queenside castling
            lastMoveInfo = 'O-O-O';
            console.log('Lichess Board Size Extractor: Detected white queenside castling');
          } else if ((sq1 === 'e8' && sq2 === 'g8') || (sq2 === 'e8' && sq1 === 'g8') ||
                     (sq1 === 'e8' && sq2 === 'h8') || (sq2 === 'e8' && sq1 === 'h8')) {
            // Black kingside castling
            lastMoveInfo = 'O-O';
            console.log('Lichess Board Size Extractor: Detected black kingside castling');
          } else if ((sq1 === 'e8' && sq2 === 'c8') || (sq2 === 'e8' && sq1 === 'c8')) {
            // Black queenside castling
            lastMoveInfo = 'O-O-O';
            console.log('Lichess Board Size Extractor: Detected black queenside castling');
          }
        }
        
        if (movedPiece) {
          lastMoveInfo = `${movedPiece} ${fromSquare} ${toSquare}`;
        }
      }
    }

    const fenNotation = convertToFEN(convertedPieces);

    // Update current FEN and Last Move
    fen_current = fenNotation;
    last_move_current = lastMoveInfo;

    // Only update frontend if FEN changed
    if (fen_current !== fen_last) {
      console.log('Lichess Board Size Extractor: FEN CHANGED - Updating frontend');
      console.log('FEN changed from:', fen_last, 'to:', fen_current);
      console.log('Last Move changed from:', last_move_last, 'to:', last_move_current);

      // Update castling rights based on the new move
      updateCastlingRights(lastMoveInfo);

      // Toggle current player and update move number
      if (current_player === 'w') {
        current_player = 'b';
      } else {
        current_player = 'w';
        move_number++; // Increment full move number after black's move
      }

      // Generate full FEN string
      const fullFEN = generateFullFEN(fenNotation);

      // Update stored values
      fen_last = fen_current;
      last_move_last = last_move_current;

      // Update current board data
      currentBoardData = {
        width: dimensions.width,
        height: dimensions.height,
        blockSize: Math.round(blockSize),
        color: color,
        pieces: convertedPieces,
        last_move: lastMoveInfo,
        fen: fenNotation,
        full_fen: fullFEN,
        timestamp: Date.now(),
        // Castling rights and en passant
        white_king_moved: white_king_moved,
        white_king_rook_moved: white_king_rook_moved,
        white_queen_rook_moved: white_queen_rook_moved,
        black_king_moved: black_king_moved,
        black_king_rook_moved: black_king_rook_moved,
        black_queen_rook_moved: black_queen_rook_moved,
        en_passant: en_passant,
        current_player: current_player,
        move_number: move_number
      };

      // Notify popup of changes
      try {
        chrome.runtime.sendMessage({
          type: 'BOARD_DATA_UPDATED',
          data: currentBoardData
        }).catch(() => {
          // Popup might not be open, ignore error
        });
      } catch (error) {
        // Extension context might be invalid, ignore
      }
    } else {
      console.log('Lichess Board Size Extractor: FEN unchanged - No frontend update needed');
    }
  }

  // Main polling function that only processes when virtual DOM changes
  function poll() {
    // Capture current state
    current_tree = captureCurrentTree();
    
    // Only process board data when virtual DOM changes
    if (treesAreDifferent(current_tree, previous_tree)) {
      console.log('Lichess Board Size Extractor: Trees are different - Processing board data!');
      
      // Process board data only when changes detected
      if (current_tree) {
        processBoardData(current_tree);
        console.log('Lichess Board Size Extractor: Processed board data due to virtual DOM change');
      }
      
      // Copy current to previous
      previous_tree = copyTree(current_tree);
      
      // Trigger new move event
      new_move_event();
    }
  }

  // Start polling
  function startPolling() {
    console.log('Lichess Board Size Extractor: Starting 250ms polling...');
    
    // Initialize trees
    previous_tree = null;
    current_tree = null;
    
    // Start polling every 250ms
    pollingInterval = setInterval(poll, 250);
    
    // Do initial poll
    poll();
  }

  // Stop polling
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('Lichess Board Size Extractor: Polling stopped');
    }
  }

  // Detect whose turn it is from Lichess interface
  function detectCurrentPlayer() {
    // Try to find turn indicator in Lichess interface
    const turnElement = document.querySelector('.rclock-turn, .clock-turn, .turn, [class*="turn"]');
    if (turnElement) {
      const turnClass = turnElement.getAttribute('class');
      if (turnClass && turnClass.includes('white')) {
        return 'w';
      } else if (turnClass && turnClass.includes('black')) {
        return 'b';
      }
    }
    
    // Try alternative selectors for turn indicators
    const clockElements = document.querySelectorAll('[class*="clock"]');
    for (const clock of clockElements) {
      const clockClass = clock.getAttribute('class');
      if (clockClass && clockClass.includes('active')) {
        if (clockClass.includes('white')) {
          return 'w';
        } else if (clockClass.includes('black')) {
          return 'b';
        }
      }
    }
    
    // Try to find move indicator in the move list
    const moveList = document.querySelector('.moves, .pgn-moves, [class*="moves"]');
    if (moveList) {
      const moves = moveList.querySelectorAll('[class*="move"], .move');
      // If odd number of moves, it's black's turn; if even, it's white's turn
      // (assuming white moves first)
      if (moves.length % 2 === 0) {
        return 'w'; // Even number of moves = white's turn
      } else {
        return 'b'; // Odd number of moves = black's turn
      }
    }
    
    // Default to white's turn if we can't detect
    console.log('Lichess Board Size Extractor: Could not detect current player, defaulting to white');
    return 'w';
  }

  // Initialize castling rights and en passant variables
  function initializeGameVariables() {
    console.log('Lichess Board Size Extractor: Initializing game variables');
    white_king_moved = false;
    white_king_rook_moved = false;
    white_queen_rook_moved = false;
    black_king_moved = false;
    black_king_rook_moved = false;
    black_queen_rook_moved = false;
    en_passant = '';
    move_number = 1;
    
    // Detect whose actual turn it is from the game interface
    current_player = detectCurrentPlayer();
    console.log('Lichess Board Size Extractor: Detected current player:', current_player);
    
    // Reset tracking variables
    fen_last = null;
    fen_current = null;
    last_move_last = null;
    last_move_current = null;
  }

  // Initialize
  function initialize() {
    console.log('Lichess Board Size Extractor: ========== INITIALIZE CALLED ==========');
    console.log('Current URL:', window.location.href);
    console.log('Is Lichess game page:', isLichessGamePage());
    
    if (isLichessGamePage()) {
      console.log('Lichess Board Size Extractor: Game page detected - STARTING POLLING');
      
      // Initialize game variables for new page
      initializeGameVariables();
      
      // Wait a bit for the board to load, then start polling
      setTimeout(() => {
        const cgBoard = document.querySelector('cg-board');
        if (cgBoard) {
          console.log('Lichess Board Size Extractor: Board found, starting polling');
          startPolling();
        } else {
          console.log('Lichess Board Size Extractor: Board not found, will retry');
          setTimeout(initialize, 1000);
        }
      }, 1000);
    } else {
      console.log('Lichess Board Size Extractor: NOT a game page - no polling');
      stopPolling();
    }
  }

  // Handle messages from popup
  function handleMessage(request, sender, sendResponse) {
    console.log('Lichess Board Size Extractor: Received message', request);
    if (request.type === 'GET_BOARD_DATA') {
      console.log('Lichess Board Size Extractor: Sending current data', currentBoardData);
      sendResponse({ data: currentBoardData });
    } else if (request.type === 'TRIGGER_ANIMATION') {
      console.log('ANIMATION: Received animation trigger for:', request.sourceSquare, 'to', request.destinationSquare);
      animateMove(request.sourceSquare, request.destinationSquare);
      sendResponse({ success: true });
    }
  }

  // Add message listener
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

  // Handle navigation changes
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('Lichess Board Size Extractor: URL changed, reinitializing...');
      stopPolling();
      setTimeout(initialize, 500);
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // ANIMATION: Standalone function - completely separate from main algorithm
  function animateMove(sourceSquare, destinationSquare) {
    const cgBoard = document.querySelector('cg-board');
    if (!cgBoard) return;

    const cgContainer = document.querySelector('cg-container');
    if (!cgContainer) return;

    // Get board dimensions
    const style = cgContainer.getAttribute('style');
    const widthMatch = style?.match(/width:\s*(\d+)px/);
    if (!widthMatch) return;

    const boardWidth = parseInt(widthMatch[1]);
    const blockSize = boardWidth / 8;

    // Get board orientation
    let boardColor = 'white';
    const coordsElement = document.querySelector('coords');
    if (coordsElement?.getAttribute('class') === 'files black') {
      boardColor = 'black';
    }

    // Convert chess notation to pixel coordinates
    function toPixel(square) {
      if (!square || square.length !== 2) return null;
      
      const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
      const rank = parseInt(square[1]) - 1;   // 1=0, 2=1, etc.
      
      if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
      
      let pixelX, pixelY;
      
      if (boardColor === 'white') {
        pixelX = file * blockSize;
        pixelY = (7 - rank) * blockSize;
      } else {
        pixelX = (7 - file) * blockSize;
        pixelY = rank * blockSize;
      }
      
      return { pixelX, pixelY };
    }

    // Find piece at square
    function findPiece(square) {
      const expectedPixels = toPixel(square);
      if (!expectedPixels) return null;
      
      const pieceElements = cgBoard.querySelectorAll('piece');
      for (const piece of pieceElements) {
        const styleAttr = piece.getAttribute('style');
        const translateMatch = styleAttr?.match(/translate\((\d+)px,\s*(\d+)px\)/);
        
        if (translateMatch) {
          const pieceX = parseInt(translateMatch[1]);
          const pieceY = parseInt(translateMatch[2]);
          
          if (Math.abs(pieceX - expectedPixels.pixelX) < 5 && Math.abs(pieceY - expectedPixels.pixelY) < 5) {
            return piece.getAttribute('class');
          }
        }
      }
      return null;
    }

    const sourcePixels = toPixel(sourceSquare);
    const destPixels = toPixel(destinationSquare);
    
    if (!sourcePixels || !destPixels) return;

    const movingPieceClass = findPiece(sourceSquare);
    if (!movingPieceClass) return;

    // Create source square highlight (60% green)
    const sourceHighlight = document.createElement('div');
    sourceHighlight.style.cssText = `position:absolute;width:${blockSize}px;height:${blockSize}px;background-color:rgba(0,255,0,0.6);transform:translate(${sourcePixels.pixelX}px,${sourcePixels.pixelY}px);pointer-events:none;z-index:100;transition:opacity 300ms`;
    cgBoard.appendChild(sourceHighlight);
    
    // Create destination square highlight (30% green)  
    const destHighlight = document.createElement('div');
    destHighlight.style.cssText = `position:absolute;width:${blockSize}px;height:${blockSize}px;background-color:rgba(0,255,0,0.3);transform:translate(${destPixels.pixelX}px,${destPixels.pixelY}px);pointer-events:none;z-index:100;transition:opacity 300ms`;
    cgBoard.appendChild(destHighlight);
    
    // Create moving piece
    const tempPiece = document.createElement('piece');
    tempPiece.className = movingPieceClass;
    tempPiece.style.cssText = `transform:translate(${sourcePixels.pixelX}px,${sourcePixels.pixelY}px);transition:transform 300ms ease-out;z-index:200;pointer-events:none`;
    cgBoard.appendChild(tempPiece);
    
    // Start animation
    setTimeout(() => {
      tempPiece.style.transform = `translate(${destPixels.pixelX}px,${destPixels.pixelY}px)`;
    }, 10);
    
    // Cleanup after 300ms
    setTimeout(() => {
      [sourceHighlight, destHighlight, tempPiece].forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }, 320);
  }

})();
