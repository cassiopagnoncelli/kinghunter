document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const dimensionsEl = document.getElementById('dimensions');
  let currentBoardData = null;
  let stockfishInitialized = false;
  let debug = false; // Set to true to show detailed board information
  let savedDepth = 22; // Default depth

  function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  // Load saved depth from storage
  async function loadSavedDepth() {
    try {
      const result = await chrome.storage.sync.get(['analysisDepth']);
      if (result.analysisDepth && result.analysisDepth >= 15 && result.analysisDepth <= 23) {
        savedDepth = result.analysisDepth;
        console.log('Loaded saved depth:', savedDepth);
      }
    } catch (error) {
      console.error('Error loading saved depth:', error);
    }
  }

  // Save depth to storage
  async function saveDepth(depth) {
    try {
      await chrome.storage.sync.set({ analysisDepth: depth });
      console.log('Saved depth:', depth);
    } catch (error) {
      console.error('Error saving depth:', error);
    }
  }

  // Initialize Stockfish engine
  async function initializeStockfish() {
    if (stockfishInitialized) return;
    
    try {
      console.log('=== STOCKFISH INITIALIZATION DEBUG ===');
      console.log('window:', typeof window);
      console.log('window.Stockfish:', typeof window.Stockfish);
      console.log('window.stockfishEngine:', typeof window.stockfishEngine);
      
      // Check if scripts loaded
      const scripts = document.querySelectorAll('script');
      console.log('Loaded scripts:', Array.from(scripts).map(s => s.src));
      
      if (typeof window.stockfishEngine === 'undefined') {
        console.error('StockfishEngine wrapper not available - checking script loading...');
        
        // Try to see if any of our scripts failed to load
        const stockfishScript = Array.from(scripts).find(s => s.src.includes('stockfish.js'));
        const engineScript = Array.from(scripts).find(s => s.src.includes('stockfish-engine.js'));
        
        console.log('Stockfish script found:', !!stockfishScript);
        console.log('Engine script found:', !!engineScript);
        
        throw new Error('StockfishEngine wrapper not available - scripts may have failed to load');
      }
      
      console.log('Calling stockfishEngine.initialize()...');
      await window.stockfishEngine.initialize();
      stockfishInitialized = true;
      console.log('Stockfish engine ready for analysis');
      
      // Verify engine status
      const status = window.stockfishEngine.getStatus();
      console.log('Engine status after initialization:', status);
      
      if (!status.isReady) {
        throw new Error('Engine initialized but not ready');
      }
      
    } catch (error) {
      console.error('=== STOCKFISH INITIALIZATION FAILED ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Current window globals:', Object.keys(window).filter(k => k.toLowerCase().includes('stock')));
      throw error; // Re-throw to be handled by calling code
    }
  }

  // Analyze current position with Stockfish
  async function analyzePosition(fen) {
    if (!stockfishInitialized) {
      await initializeStockfish();
    }

    if (!window.stockfishEngine.isEngineReady()) {
      console.log('Engine not ready for analysis');
      return null;
    }

    try {
      console.log('Analyzing position with depth 22:', fen);
      const analysis = await window.stockfishEngine.analyzePosition(fen, { depth: 22, time: 5000 });
      console.log('Analysis result:', analysis);
      return analysis;
    } catch (error) {
      console.error('Analysis failed:', error);
      return null;
    }
  }

  // Test engine with simple FEN first
  async function testEngine() {
    try {
      console.log('=== TESTING ENGINE WITH SIMPLE FEN ===');
      const testFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Starting position
      console.log('Test FEN:', testFEN);
      
      const testAnalysis = await window.stockfishEngine.analyzePosition(testFEN, { depth: 10, time: 2000 });
      console.log('Test analysis result:', testAnalysis);
      return testAnalysis;
    } catch (error) {
      console.error('Engine test failed:', error);
      return null;
    }
  }

  // Auto-analyze position when data is available
  async function autoAnalyze(boardData) {
    if (!boardData || !boardData.full_fen) return;

    // Hide status when auto-analyzing
    statusEl.style.display = 'none';

    // Automatically trigger analysis
    const analysisResultDiv = document.getElementById('analysisResult');
    const analysisContentDiv = document.getElementById('analysisContent');
    
    if (analysisResultDiv && analysisContentDiv) {
      try {
        analysisResultDiv.style.display = 'block';
        analysisContentDiv.innerHTML = '<div style="color: #666;">Initializing Stockfish engine...</div>';

        // Initialize Stockfish if needed
        console.log('=== AUTO-ANALYZE START ===');
        console.log('Board FEN:', boardData.full_fen);
        
        await initializeStockfish();
        console.log('Engine initialized, testing with simple position first...');
        
        analysisContentDiv.innerHTML = '<div style="color: #666;">Testing engine...</div>';
        
        // Test engine first
        const testResult = await testEngine();
        if (!testResult) {
          throw new Error('Engine test failed');
        }
        
        console.log('Engine test passed, analyzing actual position...');
        analysisContentDiv.innerHTML = '<div style="color: #666;">Analyzing position...</div>';

        // Get depth from slider or use default (very conservative)
        const depthSlider = document.getElementById('depthSlider');
        const selectedDepth = Math.min(depthSlider ? parseInt(depthSlider.value) : 12, 12); // Very conservative depth

        console.log('Using depth:', selectedDepth);
        console.log('Analyzing FEN:', boardData.full_fen);

        // Analyze the position using full FEN with very conservative settings
        const analysis = await window.stockfishEngine.analyzePosition(boardData.full_fen, { 
          depth: selectedDepth, 
          time: 3000 
        });

        console.log('Analysis complete:', analysis);

        if (analysis && analysis.analysis) {
          const result = analysis.analysis;
          
          // Format evaluation
          let evalText = '';
          if (result.mate !== null) {
            evalText = `Mate in ${Math.abs(result.mate)}`;
            if (result.mate > 0) {
              evalText += ' for White';
            } else {
              evalText += ' for Black';
            }
          } else if (result.score !== null) {
            const score = result.score;
            if (score > 0) {
              evalText = `+${score.toFixed(2)} (White advantage)`;
            } else if (score < 0) {
              evalText = `${score.toFixed(2)} (Black advantage)`;
            } else {
              evalText = '0.00 (Equal position)';
            }
          }

          // Format best move
          let bestMoveText = analysis.bestMove || 'None';
          if (analysis.ponder) {
            bestMoveText += ` (ponder: ${analysis.ponder})`;
          }

          // Format principal variation
          let pvText = 'None';
          if (result.pv && result.pv.length > 0) {
            pvText = result.pv.slice(0, 5).join(' '); // Show first 5 moves
            if (result.pv.length > 5) {
              pvText += '...';
            }
          }

          analysisContentDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
              <strong>Evaluation:</strong> <span style="font-family: monospace; font-weight: bold;">${evalText}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Best Move:</strong> <span style="font-family: monospace;">${bestMoveText}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Principal Variation:</strong> <span style="font-family: monospace; font-size: 11px;">${pvText}</span>
            </div>
            <div style="font-size: 11px; color: #666;">
              Depth: ${result.depth || 'N/A'} | Nodes: ${result.nodes ? result.nodes.toLocaleString() : 'N/A'}
            </div>
          `;

          // ANIMATION: Trigger animation for best move
          if (analysis.bestMove && analysis.bestMove !== 'None' && analysis.bestMove.length >= 4) {
            triggerMoveAnimation(analysis.bestMove);
          }
        } else {
          console.error('Analysis returned no results');
          analysisContentDiv.innerHTML = '<div style="color: #dc3545;">Analysis failed. No results returned.</div>';
        }

      } catch (error) {
        console.error('=== AUTO-ANALYSIS ERROR ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Board data:', boardData);
        
        let errorMessage = 'Analysis failed. ';
        if (error.message.includes('Invalid FEN')) {
          errorMessage += 'Invalid board position detected.';
        } else if (error.message.includes('memory access')) {
          errorMessage += 'Engine memory error - try refreshing the page.';
        } else if (error.message.includes('timeout')) {
          errorMessage += 'Analysis timed out.';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
        
        analysisContentDiv.innerHTML = `<div style="color: #dc3545;">${errorMessage}</div>`;
      }
    }
  }

  function showResults(boardData) {
    if (!boardData) {
      dimensionsEl.style.display = 'none';
      return;
    }

    // FEN display at the top (always visible if FEN exists)
    let fenSection = '';
    if (boardData.full_fen) {
      fenSection = `
        <div style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef; display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; font-family: monospace; font-size: 10px; word-break: break-all; color: #495057; line-height: 1.2;">
            ${boardData.full_fen}
          </div>
          <button id="copyFenButton" style="
            background: #6c757d; 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 10px;
            white-space: nowrap;
            flex-shrink: 0;
          ">📋 Copy</button>
        </div>
      `;
    }

    // Depth slider and analyze button (always visible)
    let analyzeSection = '';
    if (boardData.full_fen) {
      analyzeSection = `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef;">
          <div style="margin-bottom: 10px; text-align: center;">
            <label for="depthSlider" style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px; color: #495057;">
              Analysis Depth: <span id="depthValue">${savedDepth}</span>
            </label>
            <input type="range" id="depthSlider" min="15" max="23" value="${savedDepth}" style="
              width: 100%; 
              height: 6px; 
              border-radius: 3px; 
              background: #dee2e6; 
              outline: none; 
              cursor: pointer;
            ">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6c757d; margin-top: 2px;">
              <span>15</span>
              <span>23</span>
            </div>
          </div>
          <div style="text-align: center;">
            <button id="analyzeButton" style="
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 14px;
              font-weight: bold;
            ">🧠 Analyze Position</button>
          </div>
        </div>
        <div id="analysisResult" style="display: none; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #007bff;">
          <div id="analysisContent"></div>
        </div>
      `;
    }

    // Debug sections (only visible if debug is true)
    let debugSections = '';
    if (debug) {
      let copyButton = '';
      if (boardData.full_fen) {
        copyButton = `
          <div style="margin-bottom: 10px; text-align: center;">
            <button id="copyFenButton" style="
              background: #4CAF50; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 12px;
              font-weight: bold;
            ">📋 Copy Full FEN</button>
          </div>
        `;
      }

      let lastMoveSection = `
        <div><strong>Last Move:</strong></div>
        <div style="font-family: monospace; font-size: 12px; margin: 5px 0; padding: 5px; background: #e8f4fd; border-radius: 3px;">
          ${boardData.last_move || 'No last move detected'}
        </div>
      `;

      let castlingSection = `
        <div><strong>Castling Rights:</strong></div>
        <div style="font-family: monospace; font-size: 11px; margin: 5px 0; padding: 5px; background: #f0f8ff; border-radius: 3px;">
          <div>White King Moved: ${boardData.white_king_moved || false}</div>
          <div>White King Rook Moved: ${boardData.white_king_rook_moved || false}</div>
          <div>White Queen Rook Moved: ${boardData.white_queen_rook_moved || false}</div>
          <div>Black King Moved: ${boardData.black_king_moved || false}</div>
          <div>Black King Rook Moved: ${boardData.black_king_rook_moved || false}</div>
          <div>Black Queen Rook Moved: ${boardData.black_queen_rook_moved || false}</div>
        </div>
      `;

      let enPassantSection = `
        <div><strong>En Passant:</strong></div>
        <div style="font-family: monospace; font-size: 12px; margin: 5px 0; padding: 5px; background: #fff8dc; border-radius: 3px;">
          ${boardData.en_passant || 'None'}
        </div>
      `;

      let fullFenSection = '';
      if (boardData.full_fen) {
        fullFenSection = `
          <div><strong>Full FEN:</strong></div>
          <div style="font-family: monospace; font-size: 10px; word-break: break-all; margin: 5px 0; padding: 5px; background: #f0f8ff; border-radius: 3px;">
            ${boardData.full_fen}
          </div>
        `;
      }

      debugSections = `
        ${copyButton}
        <div><strong>FEN (Pieces Only):</strong></div>
        <div style="font-family: monospace; font-size: 11px; word-break: break-all; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 3px;">
          ${boardData.fen}
        </div>
        ${fullFenSection}
        ${lastMoveSection}
        ${castlingSection}
        ${enPassantSection}
      `;
    }

    dimensionsEl.innerHTML = `
      ${fenSection}
      ${analyzeSection}
      ${debugSections}
    `;
    dimensionsEl.style.display = 'block';

    // Store current board data for analysis
    currentBoardData = boardData;

    // Add FEN copy button functionality (main FEN display)
    if (boardData.full_fen) {
      const copyFenButton = document.getElementById('copyFenButton');
      if (copyFenButton) {
        copyFenButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(boardData.full_fen);
            copyFenButton.textContent = '✅';
            copyFenButton.style.background = '#28a745';
            setTimeout(() => {
              copyFenButton.textContent = '📋 Copy';
              copyFenButton.style.background = '#6c757d';
            }, 1500);
          } catch (err) {
            copyFenButton.textContent = '❌';
            copyFenButton.style.background = '#dc3545';
            setTimeout(() => {
              copyFenButton.textContent = '📋 Copy';
              copyFenButton.style.background = '#6c757d';
            }, 1500);
            console.error('Failed to copy FEN:', err);
          }
        });
      }
    }

    // Add copy button functionality (only if debug mode)
    if (debug && boardData.full_fen) {
      const copyButton = document.getElementById('copyFenButton');
      if (copyButton) {
        copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(boardData.full_fen);
            copyButton.textContent = '✅ Copied!';
            copyButton.style.background = '#28a745';
            setTimeout(() => {
              copyButton.textContent = '📋 Copy Full FEN';
              copyButton.style.background = '#4CAF50';
            }, 1500);
          } catch (err) {
            copyButton.textContent = '❌ Failed';
            copyButton.style.background = '#dc3545';
            setTimeout(() => {
              copyButton.textContent = '📋 Copy Full FEN';
              copyButton.style.background = '#4CAF50';
            }, 1500);
            console.error('Failed to copy FEN:', err);
          }
        });
      }
    }

    // Add depth slider functionality
    const depthSlider = document.getElementById('depthSlider');
    const depthValue = document.getElementById('depthValue');
    if (depthSlider && depthValue) {
      depthSlider.addEventListener('input', (e) => {
        const newDepth = parseInt(e.target.value);
        depthValue.textContent = newDepth;
        savedDepth = newDepth;
        saveDepth(newDepth); // Save to storage
      });
    }

    // Add analyze button functionality
    if (boardData.full_fen) {
      const analyzeButton = document.getElementById('analyzeButton');
      if (analyzeButton) {
        analyzeButton.addEventListener('click', async () => {
          const analysisResultDiv = document.getElementById('analysisResult');
          const analysisContentDiv = document.getElementById('analysisContent');
          
          if (!analysisResultDiv || !analysisContentDiv) return;

          try {
            // Show loading state
            analyzeButton.textContent = '🔄 Analyzing...';
            analyzeButton.disabled = true;
            analysisResultDiv.style.display = 'block';
            analysisContentDiv.innerHTML = '<div style="color: #666;">Initializing Stockfish engine...</div>';

            // Initialize Stockfish if needed
            await initializeStockfish();
            analysisContentDiv.innerHTML = '<div style="color: #666;">Analyzing position...</div>';

            // Get depth from slider
            const selectedDepth = depthSlider ? parseInt(depthSlider.value) : 22;
            console.log('Using analysis depth:', selectedDepth);

            // Analyze the position using full FEN with selected depth
            const analysis = await window.stockfishEngine.analyzePosition(boardData.full_fen, { depth: selectedDepth, time: 5000 });

            if (analysis && analysis.analysis) {
              const result = analysis.analysis;
              
              // Format evaluation
              let evalText = '';
              if (result.mate !== null) {
                evalText = `Mate in ${Math.abs(result.mate)}`;
                if (result.mate > 0) {
                  evalText += ' for White';
                } else {
                  evalText += ' for Black';
                }
              } else if (result.score !== null) {
                const score = result.score;
                if (score > 0) {
                  evalText = `+${score.toFixed(2)} (White advantage)`;
                } else if (score < 0) {
                  evalText = `${score.toFixed(2)} (Black advantage)`;
                } else {
                  evalText = '0.00 (Equal position)';
                }
              }

              // Format best move
              let bestMoveText = analysis.bestMove || 'None';
              if (analysis.ponder) {
                bestMoveText += ` (ponder: ${analysis.ponder})`;
              }

              // Format principal variation
              let pvText = 'None';
              if (result.pv && result.pv.length > 0) {
                pvText = result.pv.slice(0, 5).join(' '); // Show first 5 moves
                if (result.pv.length > 5) {
                  pvText += '...';
                }
              }

              analysisContentDiv.innerHTML = `
                <div style="margin-bottom: 8px;">
                  <strong>Evaluation:</strong> <span style="font-family: monospace; font-weight: bold;">${evalText}</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Best Move:</strong> <span style="font-family: monospace;">${bestMoveText}</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Principal Variation:</strong> <span style="font-family: monospace; font-size: 11px;">${pvText}</span>
                </div>
                <div style="font-size: 11px; color: #666;">
                  Depth: ${result.depth || 'N/A'} | Nodes: ${result.nodes ? result.nodes.toLocaleString() : 'N/A'}
                </div>
              `;

              // ANIMATION: Trigger animation for best move (manual analysis)
              if (analysis.bestMove && analysis.bestMove !== 'None' && analysis.bestMove.length >= 4) {
                triggerMoveAnimation(analysis.bestMove);
              }
            } else {
              analysisContentDiv.innerHTML = '<div style="color: #dc3545;">Analysis failed. Please try again.</div>';
            }

          } catch (error) {
            console.error('Analysis error:', error);
            analysisContentDiv.innerHTML = '<div style="color: #dc3545;">Analysis failed. Engine may not be ready.</div>';
          } finally {
            // Restore button state
            analyzeButton.textContent = '🧠 Analyze Position';
            analyzeButton.disabled = false;
          }
        });
      }
    }

    // Auto-analyze the position
    autoAnalyze(boardData);
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
    
    console.log(`Popup: Converting pixel(${pixelX},${pixelY}) for ${boardColor} player`);
    console.log(`Popup: Initial board coordinates: (${boardX},${boardY})`);
    
    if (boardColor === 'white') {
      // For white: top-left = a8, bottom-right = h1
      // pixelY=0 is rank 8, pixelY=7 is rank 1
      boardY = 7 - boardY;
      console.log(`Popup: WHITE - Applied Y flip: (${boardX},${boardY})`);
    } else if (boardColor === 'black') {
      // For black: Remove horizontal inversion - use coordinates as-is
      // Keep both X and Y coordinates as they are for black
      console.log(`Popup: BLACK - No inversion applied: (${boardX},${boardY})`);
    } else {
      console.log(`Popup: UNKNOWN board color: ${boardColor}`);
    }
    
    return { boardX, boardY };
  }

  // Convert board coordinates to chess notation
  function boardCoordinatesToChessNotation(boardX, boardY) {
    const file = String.fromCharCode(97 + boardX);
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
          // MIRROR HORIZONTALLY: a->h, b->g, c->f, d->e for ALL pieces
          const mirroredX = 7 - x;
          console.log(`Popup: Mirroring piece ${piece} from (${x},${y}) to (${mirroredX},${y})`);
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

  // ANIMATION: Trigger move animation in content script
  async function triggerMoveAnimation(bestMove) {
    console.log('ANIMATION: Triggering move animation for best move:', bestMove);
    
    if (!bestMove || bestMove.length !== 4) {
      console.log('ANIMATION: Invalid best move format:', bestMove);
      return;
    }
    
    const sourceSquare = bestMove.substring(0, 2);
    const destinationSquare = bestMove.substring(2, 4);
    
    console.log(`ANIMATION: Parsed move - from: ${sourceSquare}, to: ${destinationSquare}`);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to trigger animation
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_ANIMATION',
        sourceSquare: sourceSquare,
        destinationSquare: destinationSquare
      });
      
      console.log('ANIMATION: Animation message sent successfully');
      
    } catch (error) {
      console.error('ANIMATION: Failed to send animation message:', error);
    }
  }

  // Listen for board data updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BOARD_DATA_UPDATED') {
      console.log('Popup: Received board data update', request.data);
      showResults(request.data);
    }
  });

  // Load saved depth first, then auto-check when popup opens
  loadSavedDepth().then(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url && isLichessGamePage(tabs[0].url)) {
        updateStatus('Lichess game page detected', 'success');
        requestBoardData();
      } else {
        updateStatus('Not on a Lichess game page', 'error');
      }
    });
  });
});
