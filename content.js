// Content script for Lichess Board Size Extractor
// This script runs on all Lichess pages to detect game pages

(function() {
  'use strict';

  // Check if current page is a Lichess game page
  function isLichessGamePage() {
    const url = window.location.href;
    const lichessGamePattern = /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}(?:\/.*)?$/;
    return lichessGamePattern.test(url);
  }

  // Function to find and analyze cg-container
  function findCgContainer() {
    const cgContainer = document.querySelector('cg-container');
    if (cgContainer) {
      console.log('Lichess Board Size Extractor: cg-container found');
      return {
        element: cgContainer,
        style: cgContainer.getAttribute('style')
      };
    }
    return null;
  }

  // Initialize when DOM is ready
  function initialize() {
    if (isLichessGamePage()) {
      console.log('Lichess Board Size Extractor: Game page detected');
      
      // Set up observer to watch for dynamic changes
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            const container = findCgContainer();
            if (container) {
              console.log('Lichess Board Size Extractor: cg-container updated');
            }
          }
        });
      });

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });

      // Initial check
      setTimeout(() => {
        findCgContainer();
      }, 1000);
    }
  }

  // Run when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Handle navigation changes (for single-page applications)
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(initialize, 500); // Delay to allow page to load
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
