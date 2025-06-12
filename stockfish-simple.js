// Simple Stockfish wrapper for browser extensions
// Uses Web Worker approach for better compatibility

class SimpleStockfish {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.callbacks = new Map();
    this.messageId = 0;
  }

  async initialize() {
    if (this.isReady) return Promise.resolve();

    return new Promise((resolve, reject) => {
      try {
        // Create a blob URL for the worker
        const workerCode = `
          // Import Stockfish in the worker
          importScripts('https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js');
          
          let stockfish = null;
          
          self.onmessage = function(e) {
            const { id, command } = e.data;
            
            if (command === 'init') {
              try {
                stockfish = Stockfish();
                stockfish.addMessageListener(function(message) {
                  self.postMessage({ id, type: 'message', data: message });
                });
                self.postMessage({ id, type: 'ready' });
              } catch (error) {
                self.postMessage({ id, type: 'error', data: error.message });
              }
            } else if (command === 'send') {
              if (stockfish) {
                stockfish.postMessage(e.data.message);
              } else {
                self.postMessage({ id, type: 'error', data: 'Engine not initialized' });
              }
            }
          };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        this.worker = new Worker(workerUrl);
        
        this.worker.onmessage = (e) => {
          const { id, type, data } = e.data;
          
          if (type === 'ready') {
            this.isReady = true;
            resolve();
          } else if (type === 'error') {
            reject(new Error(data));
          } else if (type === 'message') {
            this.handleMessage(data);
          }
        };

        this.worker.onerror = (error) => {
          reject(error);
        };

        // Initialize the worker
        this.postMessage('init');
        
      } catch (error) {
        reject(error);
      }
    });
  }

  postMessage(command, message = null) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = ++this.messageId;
    this.worker.postMessage({ id, command, message });
  }

  handleMessage(message) {
    console.log('Stockfish:', message);
    // Handle engine messages here
    if (this.onMessage) {
      this.onMessage(message);
    }
  }

  send(command) {
    this.postMessage('send', command);
  }

  addMessageListener(callback) {
    this.onMessage = callback;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Make it available globally
window.SimpleStockfish = SimpleStockfish;
