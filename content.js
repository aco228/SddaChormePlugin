// Inject bypassing script immediately
(function() {
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('injected.js');
	(document.head || document.documentElement).appendChild(script);
	script.onload = () => script.remove();
  })();
  
  // Global function to find elements with text (accessible from popup)
  window.findElementWithText = function(searchText, parentNum, returnType) {
	// Convert search text to lowercase for case-insensitive search
	const searchLower = searchText.toLowerCase();
	
	// Search in all possible locations
	const allElements = [];
	
	// Regular DOM elements - search all text nodes
	const walk = document.createTreeWalker(
	  document.body,
	  NodeFilter.SHOW_TEXT,
	  null,
	  false
	);
	
	let node;
	while (node = walk.nextNode()) {
	  const textLower = node.textContent.toLowerCase();
	  if (textLower.includes(searchLower)) {
		allElements.push(node.parentElement);
	  }
	}
	
	// Input and textarea values
	document.querySelectorAll('input, textarea').forEach(el => {
	  if (el.value) {
		const valueLower = el.value.toLowerCase();
		if (valueLower.includes(searchLower)) {
		  allElements.push(el);
		}
	  }
	  // Also check placeholder
	  if (el.placeholder) {
		const placeholderLower = el.placeholder.toLowerCase();
		if (placeholderLower.includes(searchLower)) {
		  allElements.push(el);
		}
	  }
	});
	
	// Check all element attributes and properties
	document.querySelectorAll('*').forEach(el => {
	  // Check aria-label, title, alt, etc.
	  const textLower = (el.getAttribute('aria-label') || el.title || el.alt || '').toLowerCase();
	  if (textLower.includes(searchLower)) {
		allElements.push(el);
	  }
	});
	
	// Shadow DOM
	function searchShadowDOM(root) {
	  root.querySelectorAll('*').forEach(el => {
		if (el.shadowRoot) {
		  const walker = document.createTreeWalker(
			el.shadowRoot,
			NodeFilter.SHOW_TEXT,
			null,
			false
		  );
		  let shadowNode;
		  while (shadowNode = walker.nextNode()) {
			const textLower = shadowNode.textContent.toLowerCase();
			if (textLower.includes(searchLower)) {
			  allElements.push(shadowNode.parentElement || el);
			}
		  }
		  // Also check inputs in shadow DOM
		  el.shadowRoot.querySelectorAll('input, textarea').forEach(input => {
			if (input.value) {
			  const valueLower = input.value.toLowerCase();
			  if (valueLower.includes(searchLower)) {
				allElements.push(input);
			  }
			}
		  });
		  searchShadowDOM(el.shadowRoot);
		}
	  });
	}
	searchShadowDOM(document);
	
	// iframes (if accessible)
	document.querySelectorAll('iframe').forEach(iframe => {
	  try {
		const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
		const walker = document.createTreeWalker(
		  iframeDoc.body,
		  NodeFilter.SHOW_TEXT,
		  null,
		  false
		);
		let iframeNode;
		while (iframeNode = walker.nextNode()) {
		  const textLower = iframeNode.textContent.toLowerCase();
		  if (textLower.includes(searchLower)) {
			allElements.push(iframeNode.parentElement);
		  }
		}
	  } catch (e) {
		// Cross-origin iframe, skip
	  }
	});
	
	if (allElements.length === 0) return null;
	
	// Get the first found element
	let targetElement = allElements[0];
	
	// Go up parent levels
	for (let i = 0; i < parentNum && targetElement.parentElement; i++) {
	  targetElement = targetElement.parentElement;
	}
	
	// Return HTML or Text
	if (returnType === 'html') {
	  return targetElement.outerHTML;
	} else {
	  return targetElement.innerText || targetElement.textContent;
	}
  };
  
  // Floating widget management
  let floatingWidget = null;
  let isDragging = false;
  let currentX, currentY, initialX, initialY;
  let xOffset = 0, yOffset = 0;
  
  function createFloatingWidget() {
	if (floatingWidget) return;

	// Create floating button
	floatingWidget = document.createElement('div');
	floatingWidget.id = 'html-copier-widget';
	floatingWidget.innerHTML = `
	  <div class="widget-button">⚙️</div>
	  <div class="widget-panel" style="display: none;">
		<div class="widget-header">
		  <span>HTML Copier</span>
		  <button class="widget-close">×</button>
		</div>
		<div class="widget-content">
		  <button class="widget-btn" data-action="copyHtml">Copy HTML</button>
		  <button class="widget-btn" data-action="copyText">Copy Text</button>
		  <input type="text" class="widget-input" placeholder="Server url..." id="serverUrl">
		  <button class="widget-btn" data-action="sendToServer">Send to server</button>
		  <input type="text" class="widget-input" placeholder="Find text..." id="widgetFindText">
		  <input type="number" class="widget-input" placeholder="Parents" value="0" min="0" max="10" id="widgetParentNum">
		  <button class="widget-btn" data-action="copyFoundHtml">Copy Found HTML</button>
		  <button class="widget-btn" data-action="copyFoundText">Copy Found Text</button>
		</div>
	  </div>
	`;
	
	document.body.appendChild(floatingWidget);
	
	chrome.storage.local.get(["serverUrl"], (result) => {
		document.getElementById('serverUrl').value = result.serverUrl;
	});

	const button = floatingWidget.querySelector('.widget-button');
	const panel = floatingWidget.querySelector('.widget-panel');
	const closeBtn = floatingWidget.querySelector('.widget-close');
	
	// Toggle panel
	  button.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		e.preventDefault();
		panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
	  });
	
	// Close panel
	closeBtn.addEventListener('click', (e) => {
	  e.stopPropagation();
	  panel.style.display = 'none';
	});
	
	// Dragging
	button.addEventListener('mousedown', dragStart);
	document.addEventListener('mousemove', drag);
	document.addEventListener('mouseup', dragEnd);
	
	// Touch support for mobile
	button.addEventListener('touchstart', (e) => {
	  const touch = e.touches[0];
	  initialX = touch.clientX - xOffset;
	  initialY = touch.clientY - yOffset;
	  isDragging = true;
	});
	
	document.addEventListener('touchmove', (e) => {
	  if (isDragging) {
		e.preventDefault();
		const touch = e.touches[0];
		currentX = touch.clientX - initialX;
		currentY = touch.clientY - initialY;
		xOffset = currentX;
		yOffset = currentY;
		setTranslate(currentX, currentY, floatingWidget);
	  }
	});
	
	document.addEventListener('touchend', () => {
	  isDragging = false;
	});
	
	// Button actions
	floatingWidget.querySelectorAll('.widget-btn').forEach(btn => {
	  btn.addEventListener('click', async (e) => {
		const action = e.target.dataset.action;
		await handleWidgetAction(action);
	  });
	});
	
	// Position in top right corner by default
	const rightPosition = window.innerWidth - 68; // 48px button + 20px margin
	floatingWidget.style.left = rightPosition + 'px';
	floatingWidget.style.top = '20px';
	xOffset = rightPosition;
	yOffset = 20;
  }
  
  function dragStart(e) {
	if (e.target.classList.contains('widget-button')) {
	  e.preventDefault();
	  initialX = e.clientX - xOffset;
	  initialY = e.clientY - yOffset;
	  
	  // Small delay to distinguish click from drag
	  setTimeout(() => {
		isDragging = true;
	  }, 50);
	}
  }
  
  function drag(e) {
	if (isDragging) {
	  e.preventDefault();
	  currentX = e.clientX - initialX;
	  currentY = e.clientY - initialY;
	  xOffset = currentX;
	  yOffset = currentY;
	  setTranslate(currentX, currentY, floatingWidget);
	}
  }
  
  function dragEnd() {
	setTimeout(() => {
	  isDragging = false;
	}, 100);
  }
  
  function setTranslate(xPos, yPos, el) {
	el.style.left = xPos + 'px';
	el.style.top = yPos + 'px';
  }
  
  async function handleWidgetAction(action) {
	let result;
	
	switch(action) {
	  case 'copyHtml':
		result = document.documentElement.outerHTML;
		await copyToClipboardWidget(result);
		break;

	  case 'copyText':
		result = document.body.innerText;
		await copyToClipboardWidget(result);
		break;

	  case 'sendToServer':
		const serverUrl = document.getElementById('serverUrl').value;
		  if (!serverUrl)
			  return;

		chrome.storage.local.set({ serverUrl }, () => { });

		const text = document.body.innerText;
  		const html = document.documentElement.outerHTML;

	  	const apiResponse = await postToServer(serverUrl, text, html);
	  	await copyToClipboard(apiResponse.id);
		break;
		
	  case 'copyFoundHtml':
		const searchHtml = document.getElementById('widgetFindText').value;
		const parentHtml = parseInt(document.getElementById('widgetParentNum').value) || 0;
		if (!searchHtml) {
		  alert('Please enter text to find');
		  return;
		}
		result = window.findElementWithText(searchHtml, parentHtml, 'html');
		if (result) {
		  await copyToClipboardWidget(result);
		} else {
		  alert('Text not found');
		}
		break;
		
	  case 'copyFoundText':
		const searchText = document.getElementById('widgetFindText').value;
		const parentText = parseInt(document.getElementById('widgetParentNum').value) || 0;
		if (!searchText) {
		  alert('Please enter text to find');
		  return;
		}
		result = window.findElementWithText(searchText, parentText, 'text');
		if (result) {
		  await copyToClipboardWidget(result);
		} else {
		  alert('Text not found');
		}
		break;
	}
  }
  
  async function copyToClipboardWidget(text) {
	try {
	  await navigator.clipboard.writeText(text);
	  showWidgetNotification('✓ Copied!');
	} catch (err) {
	  // Fallback
	  const textarea = document.createElement('textarea');
	  textarea.value = text;
	  textarea.style.position = 'fixed';
	  textarea.style.opacity = '0';
	  document.body.appendChild(textarea);
	  textarea.select();
	  document.execCommand('copy');
	  document.body.removeChild(textarea);
	  showWidgetNotification('✓ Copied!');
	}
  }
  
  async function postToServer(serverUrl, textContent, htmlContent) {
    try {
		const request = {
			html: htmlContent,
			text: textContent,
		};

        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'  // sending JSON
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
			showStatus(`Server responded with status ${response.status}`);
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();  // assuming the server returns JSON
		showStatus('Received: ' + data.id, showStatus);
        return data;
    } catch (error) {
		showStatus('Error posting to server:');
        console.error('Error posting to server:', error);
        throw error;  // re-throw so caller can handle it
    }
}

  function showWidgetNotification(message) {
	const notif = document.createElement('div');
	notif.className = 'widget-notification';
	notif.textContent = message;
	floatingWidget.appendChild(notif);
	
	setTimeout(() => notif.remove(), 2000);
  }
  
  function removeFloatingWidget() {
	if (floatingWidget) {
	  floatingWidget.remove();
	  floatingWidget = null;
	}
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'toggleInject') {
	  if (request.enabled) {
		createFloatingWidget();
	  } else {
		removeFloatingWidget();
	  }
	}
  });
  
  // Check initial state and inject if needed
  (function initWidget() {
	// Wait for body to be available
	if (!document.body) {
	  setTimeout(initWidget, 100);
	  return;
	}
	
	chrome.storage.local.get(['injectEnabled'], (result) => {
	  if (result.injectEnabled) {
		setTimeout(() => {
		  createFloatingWidget();
		}, 500); // Small delay to ensure page is ready
	  }
	});
  })();