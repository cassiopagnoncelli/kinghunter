// Lichess Board Size Extractor Background Service Worker
// Handles background tasks and inter-component communication

console.log('Lichess Board Size Extractor background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Lichess Board Size Extractor extension installed/updated');
    
    if (details.reason === 'install') {
        console.log('Extension installed for the first time');
    } else if (details.reason === 'update') {
        console.log('Extension updated to version', chrome.runtime.getManifest().version);
    }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    // Handle different message types
    switch (message.type) {
        case 'BOARD_DATA_UPDATED':
            // Forward board data updates to popup if it's open
            console.log('Forwarding board data update');
            sendResponse({ success: true });
            break;
            
        case 'GET_BOARD_DATA':
            // This is handled by content script, just acknowledge
            sendResponse({ success: true });
            break;
            
        default:
            console.log('Unknown message type:', message.type);
            sendResponse({ error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open for async response
});

// Handle tab updates for Lichess pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if this is a Lichess page
        if (tab.url.includes('lichess.org')) {
            console.log('Lichess page detected:', tab.url);
            
            // The content script is already injected via manifest
            // No additional action needed here
        }
    }
});

// Keep service worker alive (workaround for MV3 limitations)
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20000);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

console.log('Background script initialization complete');
