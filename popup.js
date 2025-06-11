document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const dimensionsEl = document.getElementById('dimensions');
  const extractBtn = document.getElementById('extractBtn');

  function updateStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function showDimensions(width, height) {
    dimensionsEl.textContent = `${width} × ${height}`;
    dimensionsEl.style.display = 'block';
  }

  function showResults(width, height, pieces) {
    dimensionsEl.innerHTML = `
      <div><strong>Board Size:</strong> ${width} × ${height}</div>
      <div><strong>Pieces (${pieces.length}):</strong></div>
      <div style="max-height: 200px; overflow-y: auto; font-size: 12px; margin-top: 5px;">
        ${pieces.map(piece => `<div>${piece}</div>`).join('')}
      </div>
    `;
    dimensionsEl.style.display = 'block';
  }


  function isLichessGamePage(url) {
    // Check if URL matches https://lichess.org/[game_id] format
    const lichessGamePattern = /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}(?:\/.*)?$/;
    return lichessGamePattern.test(url);
  }

  function extractDimensions(styleStr) {
    if (!styleStr) return null;
    
    const widthMatch = styleStr.match(/width:\s*(\d+)px/);
    const heightMatch = styleStr.match(/height:\s*(\d+)px/);
    
    if (widthMatch && heightMatch) {
      return {
        width: parseInt(widthMatch[1]),
        height: parseInt(heightMatch[1])
      };
    }
    return null;
  }

  extractBtn.addEventListener('click', async function() {
    try {
      extractBtn.disabled = true;
      updateStatus('Checking page...', 'info');

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url) {
        updateStatus('Cannot access current page', 'error');
        return;
      }

      // Check if it's a Lichess game page
      if (!isLichessGamePage(tab.url)) {
        updateStatus('Not a Lichess game page', 'error');
        return;
      }

      updateStatus('Extracting board data...', 'info');

      // Inject script to find cg-container and pieces
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const cgContainer = document.querySelector('cg-container');
          if (!cgContainer) {
            return { error: 'cg-container not found' };
          }

          const style = cgContainer.getAttribute('style');
          if (!style) {
            return { error: 'No style attribute found' };
          }

          // Find cg-board and extract pieces
          const cgBoard = document.querySelector('cg-board');
          const pieces = [];
          
          if (cgBoard) {
            const pieceElements = cgBoard.querySelectorAll('piece');
            pieceElements.forEach(piece => {
              const classAttr = piece.getAttribute('class');
              const styleAttr = piece.getAttribute('style');
              
              if (classAttr && styleAttr) {
                // Extract translate values from transform
                const translateMatch = styleAttr.match(/translate\((\d+)px,\s*(\d+)px\)/);
                if (translateMatch) {
                  const x = translateMatch[1];
                  const y = translateMatch[2];
                  pieces.push(`${classAttr} ${x} ${y}`);
                }
              }
            });
          }

          return { 
            style: style,
            pieces: pieces
          };
        }
      });

      const result = results[0].result;

      if (result.error) {
        updateStatus(result.error, 'error');
        return;
      }

      const dimensions = extractDimensions(result.style);
      
      if (!dimensions) {
        updateStatus('Could not extract width/height from style', 'error');
        return;
      }

      updateStatus('Board data extracted!', 'success');
      showResults(dimensions.width, dimensions.height, result.pieces);

    } catch (error) {
      updateStatus(`Error: ${error.message}`, 'error');
    } finally {
      extractBtn.disabled = false;
    }
  });

  // Auto-check when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && isLichessGamePage(tabs[0].url)) {
      updateStatus('Lichess game page detected', 'success');
    } else {
      updateStatus('Not on a Lichess game page', 'error');
    }
  });
});
