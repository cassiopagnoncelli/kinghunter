// Stockfish WASM Engine Wrapper for Chrome Extension
// Provides an easy interface for chess position analysis

class StockfishEngine {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.isAnalyzing = false;
    this.callbacks = new Map();
    this.messageId = 0;
    this.analysisCallback = null;
    this.bestMoveCallback = null;
  }

  // Initialize the Stockfish engine
  async initialize() {
    if (this.isReady) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('=== STOCKFISH ENGINE INITIALIZATION DEBUG ===');
        
        // Check if initializeStockfish wrapper is available
        if (typeof window.initializeStockfish === 'function') {
          console.log('Found Stockfish wrapper, using it...');
          window.initializeStockfish((success) => {
            if (success) {
              this.initializeStockfishEngine(resolve, reject);
            } else {
              reject(new Error('Stockfish wrapper initialization failed'));
            }
          });
        } else if (typeof window.Stockfish !== 'undefined') {
          console.log('Stockfish already loaded, initializing directly...');
          this.initializeStockfishEngine(resolve, reject);
        } else {
          console.log('Loading Stockfish scripts...');
          
          // Load the wrapper first, then the main stockfish script
          this.loadScripts([
            chrome.runtime.getURL('stockfish-wrapper.js'),
            chrome.runtime.getURL('stockfish.js')
          ]).then(() => {
            console.log('Scripts loaded, initializing...');
            if (typeof window.initializeStockfish === 'function') {
              window.initializeStockfish((success) => {
                if (success) {
                  this.initializeStockfishEngine(resolve, reject);
                } else {
                  reject(new Error('Stockfish wrapper initialization failed'));
                }
              });
            } else {
              this.initializeStockfishEngine(resolve, reject);
            }
          }).catch(reject);
        }
      } catch (error) {
        console.error('Error initializing Stockfish:', error);
        reject(error);
      }
    });
  }

  // Helper to load multiple scripts sequentially
  loadScripts(urls) {
    return urls.reduce((promise, url) => {
      return promise.then(() => this.loadScript(url));
    }, Promise.resolve());
  }

  // Helper to load a single script
  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        console.log('Script loaded:', url);
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load script:', url, error);
        reject(new Error(`Failed to load script: ${url}`));
      };
      document.head.appendChild(script);
    });
  }

  // Helper method to initialize the Stockfish engine
  initializeStockfishEngine(resolve, reject) {
    try {
      console.log('Checking for Stockfish in global scope...');
      console.log('typeof Stockfish:', typeof Stockfish);
      console.log('typeof window.Stockfish:', typeof window.Stockfish);
      
      // The new single-threaded Stockfish should be available as a factory function
      let stockfishFactory = null;
      
      if (typeof Stockfish === 'function') {
        stockfishFactory = Stockfish;
        console.log('Found Stockfish factory function in global scope');
      } else if (typeof window.Stockfish === 'function') {
        stockfishFactory = window.Stockfish;
        console.log('Found Stockfish factory function in window scope');
      } else {
        console.error('Stockfish factory function not found');
        reject(new Error('Stockfish not available'));
        return;
      }

      // Initialize the Stockfish engine
      console.log('Calling Stockfish factory...');
      const wasmPath = chrome.runtime.getURL('stockfish-nnue-16-single.wasm');
      
      const engine = stockfishFactory({
        locateFile: (path, prefix) => {
          console.log('Stockfish locateFile called with:', path, prefix);
          if (path.endsWith('.wasm')) {
            return wasmPath;
          }
          return prefix + path;
        }
      });

      // Wait for the engine to be ready
      if (engine && engine.ready) {
        engine.ready.then(() => {
          console.log('Stockfish engine is ready');
          this.engine = engine;
          this.setupEventHandlers();
          this.isReady = true;
          console.log('Stockfish engine initialized successfully');
          resolve();
        }).catch((error) => {
          console.error('Stockfish engine ready promise failed:', error);
          reject(error);
        });
      } else {
        // Try direct initialization for older API
        console.log('No ready promise, trying direct initialization');
        this.engine = engine;
        this.setupEventHandlers();
        this.isReady = true;
        console.log('Stockfish engine initialized successfully (direct)');
        resolve();
      }
      
    } catch (error) {
      console.error('Error in initializeStockfishEngine:', error);
      reject(error);
    }
  }

  // Set up event handlers for engine communication
  setupEventHandlers() {
    if (!this.engine) return;

    this.engine.addMessageListener((message) => {
      console.log('Stockfish message:', message);
      this.handleEngineMessage(message);
    });

    // Send initial UCI commands
    this.sendCommand('uci');
    this.sendCommand('isready');
    this.sendCommand('ucinewgame');
  }

  // Handle messages from the engine
  handleEngineMessage(message) {
    const trimmedMessage = message.trim();

    if (trimmedMessage === 'uciok') {
      console.log('UCI protocol initialized');
    } else if (trimmedMessage === 'readyok') {
      console.log('Engine is ready');
    } else if (trimmedMessage.startsWith('bestmove')) {
      this.handleBestMove(trimmedMessage);
    } else if (trimmedMessage.startsWith('info')) {
      this.handleAnalysisInfo(trimmedMessage);
    }
  }

  // Handle best move response
  handleBestMove(message) {
    const parts = message.split(' ');
    const bestMove = parts[1];
    const ponder = parts.length > 3 ? parts[3] : null;

    if (this.bestMoveCallback) {
      this.bestMoveCallback({
        bestMove: bestMove,
        ponder: ponder,
        raw: message
      });
    }

    this.isAnalyzing = false;
  }

  // Handle analysis information
  handleAnalysisInfo(message) {
    if (this.analysisCallback) {
      const info = this.parseAnalysisInfo(message);
      this.analysisCallback(info);
    }
  }

  // Parse analysis info line
  parseAnalysisInfo(message) {
    const info = {
      depth: null,
      score: null,
      mate: null,
      nodes: null,
      nps: null,
      time: null,
      pv: [],
      raw: message
    };

    const parts = message.split(' ');
    
    for (let i = 0; i < parts.length; i++) {
      switch (parts[i]) {
        case 'depth':
          info.depth = parseInt(parts[i + 1]);
          break;
        case 'score':
          if (parts[i + 1] === 'cp') {
            info.score = parseInt(parts[i + 2]) / 100; // Convert centipawns to pawns
          } else if (parts[i + 1] === 'mate') {
            info.mate = parseInt(parts[i + 2]);
          }
          break;
        case 'nodes':
          info.nodes = parseInt(parts[i + 1]);
          break;
        case 'nps':
          info.nps = parseInt(parts[i + 1]);
          break;
        case 'time':
          info.time = parseInt(parts[i + 1]);
          break;
        case 'pv':
          info.pv = parts.slice(i + 1);
          break;
      }
    }

    return info;
  }

  // Send command to engine
  sendCommand(command) {
    if (!this.engine) {
      console.error('Engine not initialized');
      return;
    }

    console.log('Sending command:', command);
    this.engine.postMessage(command);
  }

  // Validate FEN string
  validateFEN(fen) {
    if (!fen || typeof fen !== 'string') {
      return false;
    }

    const parts = fen.trim().split(' ');
    if (parts.length !== 6) {
      return false;
    }

    // Basic validation of piece placement
    const piecePlacement = parts[0];
    const ranks = piecePlacement.split('/');
    if (ranks.length !== 8) {
      return false;
    }

    // Validate each rank
    for (const rank of ranks) {
      let squares = 0;
      for (const char of rank) {
        if ('12345678'.includes(char)) {
          squares += parseInt(char);
        } else if ('pnbrqkPNBRQK'.includes(char)) {
          squares += 1;
        } else {
          return false;
        }
      }
      if (squares !== 8) {
        return false;
      }
    }

    // Validate active color
    if (!['w', 'b'].includes(parts[1])) {
      return false;
    }

    return true;
  }

  // Analyze a position
  analyzePosition(fen, options = {}) {
    if (!this.isReady) {
      return Promise.reject(new Error('Engine not ready'));
    }

    // Validate FEN first
    if (!this.validateFEN(fen)) {
      return Promise.reject(new Error(`Invalid FEN string: ${fen}`));
    }

    return new Promise((resolve, reject) => {
      try {
        const depth = Math.min(options.depth || 15, 20); // Limit depth to prevent memory issues
        const timeLimit = Math.min(options.time || 3000, 8000); // Limit time to 8 seconds max

        // Check if already analyzing
        if (this.isAnalyzing) {
          this.sendCommand('stop');
          this.isAnalyzing = false;
        }

        this.isAnalyzing = true;
        
        // Set up callbacks
        let analysisData = [];
        let finalResult = null;
        let timeoutId = null;

        this.analysisCallback = (info) => {
          analysisData.push(info);
          if (info.depth >= depth) {
            finalResult = info;
          }
        };

        this.bestMoveCallback = (result) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.analysisCallback = null;
          this.bestMoveCallback = null;
          this.isAnalyzing = false;
          
          resolve({
            bestMove: result.bestMove,
            ponder: result.ponder,
            analysis: finalResult || analysisData[analysisData.length - 1],
            allAnalysis: analysisData
          });
        };

        // Set timeout with cleanup
        timeoutId = setTimeout(() => {
          console.log('Analysis timeout reached, stopping...');
          this.sendCommand('stop');
          this.analysisCallback = null;
          this.bestMoveCallback = null;
          this.isAnalyzing = false;
          reject(new Error('Analysis timeout'));
        }, timeLimit);

        // Start analysis with full FEN
        console.log(`Analyzing position with FEN: ${fen}`);
        console.log(`Analysis parameters: depth=${depth}, time=${timeLimit}ms`);
        
        // Use shorter FEN validation and send commands with small delays
        setTimeout(() => {
          if (this.engine && this.isReady) {
            this.sendCommand(`position fen ${fen}`);
            setTimeout(() => {
              if (this.engine && this.isReady && this.isAnalyzing) {
                this.sendCommand(`go depth ${depth}`);
              }
            }, 50);
          } else {
            reject(new Error('Engine became unavailable'));
          }
        }, 10);

      } catch (error) {
        console.error('Error in analyzePosition:', error);
        this.isAnalyzing = false;
        reject(error);
      }
    });
  }

  // Get best move for a position
  getBestMove(fen, depth = 22) {
    return this.analyzePosition(fen, { depth: depth, time: 5000 });
  }

  // Quick evaluation of a position
  quickEval(fen, depth = 15) {
    return this.analyzePosition(fen, { depth: depth, time: 3000 });
  }

  // Stop current analysis
  stopAnalysis() {
    if (this.isAnalyzing) {
      this.sendCommand('stop');
      this.isAnalyzing = false;
    }
  }

  // Set engine options
  setOption(name, value) {
    this.sendCommand(`setoption name ${name} value ${value}`);
  }

  // Check if engine is ready
  isEngineReady() {
    return this.isReady && !this.isAnalyzing;
  }

  // Get engine status
  getStatus() {
    return {
      isReady: this.isReady,
      isAnalyzing: this.isAnalyzing,
      hasEngine: this.engine !== null
    };
  }

  // Destroy engine
  destroy() {
    if (this.engine) {
      this.sendCommand('quit');
      this.engine = null;
    }
    this.isReady = false;
    this.isAnalyzing = false;
    this.callbacks.clear();
  }
}

// Create global instance
window.stockfishEngine = new StockfishEngine();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StockfishEngine;
}
