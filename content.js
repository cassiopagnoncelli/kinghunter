// King Hunter Content Script
// This script runs on all web pages and provides the core king hunting functionality

(function() {
    'use strict';

    // Extension state
    let isActive = false;
    let kingsFound = 0;
    let gamesAnalyzed = 0;
    let currentlyHighlighted = [];

    // Chess piece detection patterns
    const CHESS_PATTERNS = {
        // Unicode chess pieces
        whiteKing: /♔|♚/g,
        blackKing: /♚|♔/g,
        // Text representations
        textKing: /\b[Kk]ing\b/g,
        // Chess notation
        chessNotation: /\bK[a-h][1-8]\b/g,
        // Chess.com and Lichess specific patterns
        chessCom: /piece\s+king|king\s+piece/gi,
        lichess: /cg-wrap.*king/gi
    };

    // CSS for highlighting kings
    const HIGHLIGHT_STYLE = `
        .king-hunter-highlight {
            background-color: rgba(255, 215, 0, 0.6) !important;
            border: 2px solid #FFD700 !important;
            border-radius: 4px !important;
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.8) !important;
            transition: all 0.3s ease !important;
            position: relative !important;
        }
        
        .king-hunter-highlight::after {
            content: '👑';
            position: absolute;
            top: -5px;
            right: -5px;
            font-size: 12px;
            background: #FFD700;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        
        .king-hunter-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }
        
        .king-hunter-notification.show {
            transform: translateX(0);
        }
    `;

    // Initialize the extension
    function init() {
        // Inject CSS
        injectCSS();
        
        // Load state from storage
        loadState();
        
        // Set up observers
        setupObservers();
        
        console.log('King Hunter content script initialized');
    }

    // Inject CSS styles
    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = HIGHLIGHT_STYLE;
        document.head.appendChild(style);
    }

    // Load state from Chrome storage
    async function loadState() {
        try {
            const result = await chrome.storage.sync.get({
                isActive: false,
                kingsFound: 0,
                gamesAnalyzed: 0
            });

            isActive = result.isActive;
            kingsFound = result.kingsFound;
            gamesAnalyzed = result.gamesAnalyzed;

            if (isActive) {
                startHunting();
            }
        } catch (error) {
            console.error('King Hunter: Error loading state:', error);
        }
    }

    // Set up mutation observer to detect dynamic content changes
    function setupObservers() {
        const observer = new MutationObserver((mutations) => {
            if (isActive) {
                let shouldScan = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        shouldScan = true;
                    }
                });
                
                if (shouldScan) {
                    setTimeout(scanForKings, 500); // Debounce scanning
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Start hunting for kings
    function startHunting() {
        scanForKings();
        showNotification('King Hunter activated! 🏹');
    }

    // Stop hunting
    function stopHunting() {
        clearHighlights();
        showNotification('King Hunter deactivated');
    }

    // Scan the page for kings
    function scanForKings() {
        if (!isActive) return;

        clearHighlights();
        
        const elements = document.querySelectorAll('*');
        let foundKings = 0;

        elements.forEach(element => {
            // Skip script and style elements
            if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
                return;
            }

            // Check for chess pieces in various formats
            const textContent = element.textContent || '';
            const innerHTML = element.innerHTML || '';
            
            // Check for Unicode chess pieces
            if (CHESS_PATTERNS.whiteKing.test(textContent) || 
                CHESS_PATTERNS.blackKing.test(textContent)) {
                highlightElement(element, 'Unicode King');
                foundKings++;
            }
            
            // Check for text mentions of kings
            else if (CHESS_PATTERNS.textKing.test(textContent)) {
                highlightElement(element, 'King Mention');
                foundKings++;
            }
            
            // Check for chess notation
            else if (CHESS_PATTERNS.chessNotation.test(textContent)) {
                highlightElement(element, 'King Move');
                foundKings++;
            }
            
            // Check for chess site specific patterns
            else if (element.className && 
                     (element.className.includes('king') || 
                      element.className.includes('piece'))) {
                if (element.className.toLowerCase().includes('king')) {
                    highlightElement(element, 'Chess Piece');
                    foundKings++;
                }
            }
        });

        // Update statistics
        if (foundKings > 0) {
            kingsFound += foundKings;
            gamesAnalyzed++;
            updateStats();
            
            showNotification(`Found ${foundKings} kings! 👑`);
        }
    }

    // Highlight an element
    function highlightElement(element, type) {
        element.classList.add('king-hunter-highlight');
        element.title = `King Hunter: ${type}`;
        currentlyHighlighted.push(element);
    }

    // Clear all highlights
    function clearHighlights() {
        currentlyHighlighted.forEach(element => {
            element.classList.remove('king-hunter-highlight');
            element.removeAttribute('title');
        });
        currentlyHighlighted = [];
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'king-hunter-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Update statistics in storage
    async function updateStats() {
        try {
            await chrome.storage.sync.set({
                kingsFound: kingsFound,
                gamesAnalyzed: gamesAnalyzed
            });

            // Notify popup of stats update
            chrome.runtime.sendMessage({
                action: 'updateStats',
                kingsFound: kingsFound,
                gamesAnalyzed: gamesAnalyzed
            });
        } catch (error) {
            console.error('King Hunter: Error updating stats:', error);
        }
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggleKingHunter') {
            isActive = message.isActive;
            
            if (isActive) {
                startHunting();
            } else {
                stopHunting();
            }
            
            sendResponse({ success: true });
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
