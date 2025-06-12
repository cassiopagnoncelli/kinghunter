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
        // Get the extension URL for the stockfish.js file
        const stockfishUrl = chrome.runtime.getURL('stockfish.js');
        
        // Create a script element to load Stockfish
        const script = document.createElement('script');
        script.src = stockfishUrl;
        script.onload = () => {
          // Initialize Stockfish with the correct path to WASM
          const wasmPath = chrome.runtime.getURL('stockfish.wasm');
          
          window.Stockfish({
            locateFile: (path, prefix) => {
              if (path.endsWith('.wasm')) {
                return wasmPath;
              }
              return prefix + path;
            }
          }).then((sf) => {
            this.engine = sf;
            this.setupEventHandlers();
            this.isReady = true;
            console.log('Stockfish engine initialized successfully');
            resolve();
          }).catch((error) => {
            console.error('Failed to initialize Stockfish:', error);
            reject(error);
          });
        };
        script.onerror = () => {
          reject(new Error('Failed to load Stockfish script'));
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error initializing Stockfish:', error);
        reject(error);
      }
    });
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

  // Analyze a position
  analyzePosition(fen, options = {}) {
    if (!this.isReady) {
      return Promise.reject(new Error('Engine not ready'));
    }

    return new Promise((resolve, reject) => {
      try {
        const depth = options.depth || 22; // Default depth of 22
        const timeLimit = options.time || 5000; // 5 seconds default for deeper analysis

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
          
          resolve({
            bestMove: result.bestMove,
            ponder: result.ponder,
            analysis: finalResult || analysisData[analysisData.length - 1],
            allAnalysis: analysisData
          });
        };

        // Set timeout
        timeoutId = setTimeout(() => {
          this.sendCommand('stop');
        }, timeLimit);

        // Start analysis with full FEN
        console.log(`Analyzing position with FEN: ${fen}`);
        this.sendCommand(`position fen ${fen}`);
        this.sendCommand(`go depth ${depth}`);

      } catch (error) {
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
