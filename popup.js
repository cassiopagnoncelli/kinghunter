document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const toggleBtn = document.getElementById('toggle-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('status-text');
    const kingsFoundElement = document.getElementById('kings-found');
    const gamesAnalyzedElement = document.getElementById('games-analyzed');

    // Initialize extension state
    let isActive = false;
    let kingsFound = 0;
    let gamesAnalyzed = 0;

    // Load saved state from storage
    loadExtensionState();

    // Event listeners
    toggleBtn.addEventListener('click', toggleExtension);
    settingsBtn.addEventListener('click', openSettings);

    // Load extension state from Chrome storage
    async function loadExtensionState() {
        try {
            const result = await chrome.storage.sync.get({
                isActive: false,
                kingsFound: 0,
                gamesAnalyzed: 0
            });

            isActive = result.isActive;
            kingsFound = result.kingsFound;
            gamesAnalyzed = result.gamesAnalyzed;

            updateUI();
        } catch (error) {
            console.error('Error loading extension state:', error);
        }
    }

    // Save extension state to Chrome storage
    async function saveExtensionState() {
        try {
            await chrome.storage.sync.set({
                isActive: isActive,
                kingsFound: kingsFound,
                gamesAnalyzed: gamesAnalyzed
            });
        } catch (error) {
            console.error('Error saving extension state:', error);
        }
    }

    // Toggle extension active state
    async function toggleExtension() {
        isActive = !isActive;
        
        // Send message to content script
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            chrome.tabs.sendMessage(tab.id, {
                action: 'toggleKingHunter',
                isActive: isActive
            });

            // Send message to background script
            chrome.runtime.sendMessage({
                action: 'updateStatus',
                isActive: isActive
            });

        } catch (error) {
            console.error('Error sending toggle message:', error);
        }

        updateUI();
        saveExtensionState();
    }

    // Update the UI based on current state
    function updateUI() {
        if (isActive) {
            statusIndicator.classList.remove('inactive');
            statusIndicator.classList.add('active');
            statusText.textContent = 'Active';
            toggleBtn.textContent = 'Deactivate Hunter';
            toggleBtn.style.background = 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)';
        } else {
            statusIndicator.classList.remove('active');
            statusIndicator.classList.add('inactive');
            statusText.textContent = 'Inactive';
            toggleBtn.textContent = 'Activate Hunter';
            toggleBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }

        kingsFoundElement.textContent = kingsFound;
        gamesAnalyzedElement.textContent = gamesAnalyzed;
    }

    // Open settings (placeholder functionality)
    function openSettings() {
        // For now, just show an alert
        // In a full implementation, this could open an options page
        alert('Settings functionality coming soon!\n\nKing Hunter v1.0.0');
    }

    // Listen for messages from content script or background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateStats') {
            if (message.kingsFound !== undefined) {
                kingsFound = message.kingsFound;
            }
            if (message.gamesAnalyzed !== undefined) {
                gamesAnalyzed = message.gamesAnalyzed;
            }
            updateUI();
            saveExtensionState();
            sendResponse({ success: true });
        }
    });

    // Update stats periodically
    setInterval(async () => {
        try {
            const result = await chrome.storage.sync.get({
                kingsFound: kingsFound,
                gamesAnalyzed: gamesAnalyzed
            });

            if (result.kingsFound !== kingsFound || result.gamesAnalyzed !== gamesAnalyzed) {
                kingsFound = result.kingsFound;
                gamesAnalyzed = result.gamesAnalyzed;
                updateUI();
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }, 2000);
});
