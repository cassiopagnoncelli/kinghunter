// King Hunter Background Service Worker
// Handles background tasks, notifications, and inter-component communication

// Extension state
let extensionState = {
    isActive: false,
    kingsFound: 0,
    gamesAnalyzed: 0,
    lastUpdated: Date.now()
};

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('King Hunter extension installed/updated');
    
    if (details.reason === 'install') {
        // Set up default state on first install
        initializeExtension();
    } else if (details.reason === 'update') {
        // Handle extension updates
        console.log('King Hunter updated to version', chrome.runtime.getManifest().version);
    }
});

// Initialize extension with default values
async function initializeExtension() {
    try {
        await chrome.storage.sync.set({
            isActive: false,
            kingsFound: 0,
            gamesAnalyzed: 0,
            settings: {
                notifications: true,
                autoScan: true,
                highlightColor: '#FFD700'
            }
        });
        
        // Set initial badge
        updateBadge(false);
        
        console.log('King Hunter initialized with default settings');
    } catch (error) {
        console.error('Error initializing King Hunter:', error);
    }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.action) {
        case 'updateStatus':
            handleStatusUpdate(message);
            sendResponse({ success: true });
            break;
            
        case 'updateStats':
            handleStatsUpdate(message);
            sendResponse({ success: true });
            break;
            
        case 'getState':
            sendResponse(extensionState);
            break;
            
        default:
            console.log('Unknown message action:', message.action);
            sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
});

// Handle status updates
async function handleStatusUpdate(message) {
    extensionState.isActive = message.isActive;
    extensionState.lastUpdated = Date.now();
    
    // Update badge
    updateBadge(message.isActive);
    
    // Update storage
    try {
        await chrome.storage.sync.set({
            isActive: message.isActive
        });
    } catch (error) {
        console.error('Error updating status in storage:', error);
    }
}

// Handle statistics updates
async function handleStatsUpdate(message) {
    if (message.kingsFound !== undefined) {
        extensionState.kingsFound = message.kingsFound;
    }
    if (message.gamesAnalyzed !== undefined) {
        extensionState.gamesAnalyzed = message.gamesAnalyzed;
    }
    
    extensionState.lastUpdated = Date.now();
    
    // Update storage
    try {
        await chrome.storage.sync.set({
            kingsFound: extensionState.kingsFound,
            gamesAnalyzed: extensionState.gamesAnalyzed
        });
    } catch (error) {
        console.error('Error updating stats in storage:', error);
    }
    
    // Show notification for significant milestones
    checkMilestones();
}

// Update extension badge
function updateBadge(isActive) {
    if (isActive) {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        chrome.action.setTitle({ title: 'King Hunter is active - Click to manage' });
    } else {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'King Hunter - Click to activate' });
    }
}

// Check for milestones and show notifications
function checkMilestones() {
    const milestones = [10, 25, 50, 100, 250, 500, 1000];
    
    if (milestones.includes(extensionState.kingsFound)) {
        showNotification(
            'King Hunter Milestone!',
            `You've found ${extensionState.kingsFound} kings! 👑`,
            'milestone'
        );
    }
}

// Show system notification
function showNotification(title, message, type = 'info') {
    const notificationId = `king-hunter-${type}-${Date.now()}`;
    
    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message,
        priority: 1
    });
    
    // Auto-clear notification after 5 seconds
    setTimeout(() => {
        chrome.notifications.clear(notificationId);
    }, 5000);
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    // Open popup when notification is clicked
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
});

// Periodic cleanup and maintenance
setInterval(async () => {
    try {
        // Sync state with storage
        const result = await chrome.storage.sync.get([
            'isActive', 'kingsFound', 'gamesAnalyzed'
        ]);
        
        extensionState.isActive = result.isActive || false;
        extensionState.kingsFound = result.kingsFound || 0;
        extensionState.gamesAnalyzed = result.gamesAnalyzed || 0;
        
        // Update badge to reflect current state
        updateBadge(extensionState.isActive);
        
    } catch (error) {
        console.error('Error during periodic sync:', error);
    }
}, 30000); // Run every 30 seconds

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Only inject on http/https pages
        if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
            // Check if this is a chess-related site
            const chessKeywords = ['chess', 'lichess', 'chess.com', 'chessbase'];
            const isChessSite = chessKeywords.some(keyword => 
                tab.url.toLowerCase().includes(keyword) || 
                (tab.title && tab.title.toLowerCase().includes(keyword))
            );
            
            if (isChessSite && extensionState.isActive) {
                // Send message to content script to start scanning
                chrome.tabs.sendMessage(tabId, {
                    action: 'startAutoScan'
                }).catch(() => {
                    // Content script might not be ready yet, ignore error
                });
            }
        }
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This is handled by the popup, but we can add fallback logic here
    console.log('Extension icon clicked on tab:', tab.url);
});

// Load initial state from storage
chrome.storage.sync.get([
    'isActive', 'kingsFound', 'gamesAnalyzed'
]).then((result) => {
    extensionState.isActive = result.isActive || false;
    extensionState.kingsFound = result.kingsFound || 0;
    extensionState.gamesAnalyzed = result.gamesAnalyzed || 0;
    
    updateBadge(extensionState.isActive);
    
    console.log('King Hunter background script loaded with state:', extensionState);
}).catch((error) => {
    console.error('Error loading initial state:', error);
});

// Export for debugging
if (typeof globalThis !== 'undefined') {
    globalThis.kingHunterBackground = {
        getState: () => extensionState,
        updateStats: handleStatsUpdate,
        updateStatus: handleStatusUpdate
    };
}
