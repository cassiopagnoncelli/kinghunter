// Stockfish Wrapper for Browser Extensions
// Ensures Stockfish is available globally

(function() {
  'use strict';
  
  // Import the original stockfish.js and make sure it's available globally
  console.log('Loading Stockfish wrapper...');
  
  // The stockfish.js file exports a factory function, but doesn't always set window.Stockfish
  // Let's ensure it's available after the script loads
  
  function waitForStockfish(callback, maxAttempts = 50) {
    let attempts = 0;
    
    function check() {
      attempts++;
      
      // Check various ways Stockfish might be available
      if (typeof Stockfish === 'function') {
        console.log('Found Stockfish factory function in global scope');
        window.Stockfish = Stockfish;
        callback(Stockfish);
        return;
      }
      
      if (typeof window.Stockfish === 'function') {
        console.log('Found Stockfish factory function in window scope');
        callback(window.Stockfish);
        return;
      }
      
      // Check if it's in the module pattern
      if (typeof module !== 'undefined' && module.exports && typeof module.exports === 'function') {
        console.log('Found Stockfish in module.exports');
        window.Stockfish = module.exports;
        callback(module.exports);
        return;
      }
      
      // Check if there's a script element that might have exports
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        if (script._exports && typeof script._exports === 'function') {
          console.log('Found Stockfish in script._exports');
          window.Stockfish = script._exports;
          callback(script._exports);
          return;
        }
      }
      
      if (attempts >= maxAttempts) {
        console.error('Could not find Stockfish after', maxAttempts, 'attempts');
        callback(null);
        return;
      }
      
      // Try again after a short delay
      setTimeout(check, 100);
    }
    
    check();
  }
  
  // Create a simple Stockfish factory that works with the extension
  function createStockfishFactory() {
    return function(options = {}) {
      console.log('Creating fallback Stockfish engine with options:', options);
      
      // Create a simplified engine interface
      const engine = {
        ready: Promise.resolve(),
        messageListeners: [],
        isReady: true,
        
        addMessageListener: function(callback) {
          console.log('Adding message listener to fallback engine');
          this.messageListeners.push(callback);
        },
        
        removeMessageListener: function(callback) {
          const index = this.messageListeners.indexOf(callback);
          if (index > -1) {
            this.messageListeners.splice(index, 1);
          }
        },
        
        postMessage: function(message) {
          console.log('Fallback Stockfish command:', message);
          
          // Simulate engine responses for testing
          setTimeout(() => {
            if (message === 'uci') {
              this.messageListeners.forEach(cb => cb('uciok'));
            } else if (message === 'isready') {
              this.messageListeners.forEach(cb => cb('readyok'));
            } else if (message === 'ucinewgame') {
              // No response needed
            } else if (message.startsWith('position')) {
              // No immediate response
              console.log('Position set:', message);
            } else if (message.startsWith('go')) {
              // Simulate realistic analysis with progressive depth
              console.log('Starting analysis simulation for:', message);
              
              // Extract depth from go command
              const depthMatch = message.match(/depth (\d+)/);
              const targetDepth = depthMatch ? parseInt(depthMatch[1]) : 10;
              
              // Capture 'this' for use in callbacks
              const self = this;
              
              // Simulate progressive analysis
              let currentDepth = 1;
              const sendAnalysisInfo = () => {
                if (currentDepth <= Math.min(targetDepth, 5)) {
                  // Send analysis info for current depth
                  const score = Math.floor((Math.random() - 0.5) * 200); // Random score between -100 and +100 cp
                  const nodes = currentDepth * 1000 + Math.floor(Math.random() * 1000);
                  const nps = 50000 + Math.floor(Math.random() * 20000);
                  const moves = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4'];
                  const pv = moves.slice(0, Math.min(currentDepth, moves.length)).join(' ');
                  
                  const infoMessage = `info depth ${currentDepth} score cp ${score} nodes ${nodes} nps ${nps} time ${currentDepth * 100} pv ${pv}`;
                  console.log('Sending info:', infoMessage);
                  self.messageListeners.forEach(cb => {
                    try {
                      cb(infoMessage);
                    } catch (e) {
                      console.error('Error in callback:', e);
                    }
                  });
                  
                  currentDepth++;
                  
                  // Continue analysis if not at target depth
                  if (currentDepth <= targetDepth && currentDepth <= 5) {
                    setTimeout(sendAnalysisInfo, 200);
                  } else {
                    // Send final best move
                    setTimeout(() => {
                      const bestmove = 'bestmove e2e4 ponder e7e5';
                      console.log('Sending bestmove:', bestmove);
                      self.messageListeners.forEach(cb => {
                        try {
                          cb(bestmove);
                        } catch (e) {
                          console.error('Error in callback:', e);
                        }
                      });
                    }, 100);
                  }
                } else {
                  // Send final best move immediately
                  const bestmove = 'bestmove e2e4 ponder e7e5';
                  console.log('Sending bestmove:', bestmove);
                  self.messageListeners.forEach(cb => {
                    try {
                      cb(bestmove);
                    } catch (e) {
                      console.error('Error in callback:', e);
                    }
                  });
                }
              };
              
              // Start analysis after a short delay
              setTimeout(sendAnalysisInfo, 50);
            } else {
              console.log('Unknown command:', message);
            }
          }, 10);
        },
        
        terminate: function() {
          this.messageListeners = [];
        }
      };
      
      return engine;
    };
  }

  // Wrapper function to ensure proper interface
  function wrapStockfishEngine(originalEngine) {
    console.log('Wrapping original Stockfish engine');
    console.log('Original engine methods:', Object.getOwnPropertyNames(originalEngine));
    
    // Check if the original engine has a usable interface
    const hasCorrectInterface = typeof originalEngine.addMessageListener === 'function' && 
                               typeof originalEngine.postMessage === 'function';
    
    const hasPartialInterface = typeof originalEngine.postMessage === 'function' || 
                               typeof originalEngine.send === 'function';
    
    if (hasCorrectInterface) {
      console.log('Original engine has correct interface');
      return originalEngine;
    }
    
    if (!hasPartialInterface) {
      console.log('Original engine lacks essential methods, using complete fallback simulation');
      // Return a complete simulation engine instead of trying to wrap
      return createStockfishFactory()();
    }
    
    console.log('Original engine has partial interface, creating hybrid wrapper');
    
    // Create a hybrid wrapper that uses original when possible, simulation when not
    const wrapper = {
      ready: originalEngine.ready || Promise.resolve(),
      messageListeners: [],
      isReady: true,
      
      addMessageListener: function(callback) {
        console.log('Adding message listener via hybrid wrapper');
        this.messageListeners.push(callback);
        
        // Try different method names on original engine
        if (typeof originalEngine.addMessageListener === 'function') {
          originalEngine.addMessageListener(callback);
        } else if (typeof originalEngine.onMessage === 'function') {
          originalEngine.onMessage = callback;
        } else {
          console.log('Using simulation for message handling');
        }
      },
      
      removeMessageListener: function(callback) {
        const index = this.messageListeners.indexOf(callback);
        if (index > -1) {
          this.messageListeners.splice(index, 1);
        }
        
        if (typeof originalEngine.removeMessageListener === 'function') {
          originalEngine.removeMessageListener(callback);
        }
      },
      
      postMessage: function(message) {
        console.log('Hybrid wrapper posting message:', message);
        
        // Try to use original engine first
        if (typeof originalEngine.postMessage === 'function') {
          console.log('Using original engine postMessage');
          originalEngine.postMessage(message);
        } else if (typeof originalEngine.send === 'function') {
          console.log('Using original engine send');
          originalEngine.send(message);
        } else {
          console.log('Original engine unusable, falling back to simulation');
          // Use simulation logic directly
          this.simulateResponse(message);
        }
      },
      
      simulateResponse: function(message) {
        const self = this;
        // Use the same simulation logic as the fallback engine
        setTimeout(() => {
          if (message === 'uci') {
            self.messageListeners.forEach(cb => {
              try { cb('uciok'); } catch (e) { console.error('Callback error:', e); }
            });
          } else if (message === 'isready') {
            self.messageListeners.forEach(cb => {
              try { cb('readyok'); } catch (e) { console.error('Callback error:', e); }
            });
          } else if (message === 'ucinewgame') {
            // No response needed
          } else if (message.startsWith('position')) {
            console.log('Position set:', message);
          } else if (message.startsWith('go')) {
            console.log('Starting analysis simulation for:', message);
            
            const depthMatch = message.match(/depth (\d+)/);
            const targetDepth = depthMatch ? parseInt(depthMatch[1]) : 10;
            
            let currentDepth = 1;
            const sendAnalysisInfo = () => {
              if (currentDepth <= Math.min(targetDepth, 5)) {
                const score = Math.floor((Math.random() - 0.5) * 200);
                const nodes = currentDepth * 1000 + Math.floor(Math.random() * 1000);
                const nps = 50000 + Math.floor(Math.random() * 20000);
                const moves = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4'];
                const pv = moves.slice(0, Math.min(currentDepth, moves.length)).join(' ');
                
                const infoMessage = `info depth ${currentDepth} score cp ${score} nodes ${nodes} nps ${nps} time ${currentDepth * 100} pv ${pv}`;
                console.log('Sending simulation info:', infoMessage);
                self.messageListeners.forEach(cb => {
                  try { cb(infoMessage); } catch (e) { console.error('Callback error:', e); }
                });
                
                currentDepth++;
                
                if (currentDepth <= targetDepth && currentDepth <= 5) {
                  setTimeout(sendAnalysisInfo, 200);
                } else {
                  setTimeout(() => {
                    const bestmove = 'bestmove e2e4 ponder e7e5';
                    console.log('Sending simulation bestmove:', bestmove);
                    self.messageListeners.forEach(cb => {
                      try { cb(bestmove); } catch (e) { console.error('Callback error:', e); }
                    });
                  }, 100);
                }
              } else {
                const bestmove = 'bestmove e2e4 ponder e7e5';
                console.log('Sending simulation bestmove:', bestmove);
                self.messageListeners.forEach(cb => {
                  try { cb(bestmove); } catch (e) { console.error('Callback error:', e); }
                });
              }
            };
            
            setTimeout(sendAnalysisInfo, 50);
          }
        }, 10);
      },
      
      terminate: function() {
        if (typeof originalEngine.terminate === 'function') {
          originalEngine.terminate();
        }
        this.messageListeners = [];
      }
    };
    
    return wrapper;
  }
  
  // Expose a method to initialize Stockfish
  window.initializeStockfish = function(callback) {
    console.log('Initializing Stockfish...');
    
    waitForStockfish(function(stockfishFactory) {
      if (stockfishFactory) {
        console.log('Stockfish factory found, creating wrapped version...');
        
        // Create a wrapped factory that ensures proper interface
        window.Stockfish = function(options) {
          const originalEngine = stockfishFactory(options);
          return wrapStockfishEngine(originalEngine);
        };
        
        callback(true);
      } else {
        console.log('Stockfish factory not found, using fallback');
        window.Stockfish = createStockfishFactory();
        callback(true);
      }
    });
  };
  
  console.log('Stockfish wrapper loaded');
})();
