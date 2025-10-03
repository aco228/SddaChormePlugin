// Get current tab
async function getCurrentTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
  }
  
  // Execute script in current tab
  async function executeInTab(func) {
	const tab = await getCurrentTab();
	const results = await chrome.scripting.executeScript({
	  target: { tabId: tab.id },
	  func: func
	});
	return results[0].result;
  }
  
  // Show status message
  function showStatus(message) {
	const status = document.getElementById('status');
	status.textContent = message;
	status.style.display = 'block';
	setTimeout(() => {
	  status.style.display = 'none';
	}, 2000);
  }
  
  // Copy to clipboard
  async function copyToClipboard(text) {
	try {
	  await navigator.clipboard.writeText(text);
	  showStatus('✓ Copied to clipboard!');
	} catch (err) {
	  showStatus('✗ Failed to copy');
	}
  }
  
  // Copy HTML
  document.getElementById('copyHtml').addEventListener('click', async () => {
	const html = await executeInTab(() => {
	  return document.documentElement.outerHTML;
	});
	await copyToClipboard(html);
  });
  
  // Copy Text
  document.getElementById('copyText').addEventListener('click', async () => {
	const text = await executeInTab(() => {
	  return document.body.innerText;
	});
	await copyToClipboard(text);
  });
  
  // Find element and copy HTML
  document.getElementById('copyFoundHtml').addEventListener('click', async () => {
	const searchText = document.getElementById('findText').value;
	const parentNum = parseInt(document.getElementById('parentNum').value) || 0;
	
	if (!searchText) {
	  showStatus('Please enter text to find');
	  return;
	}
  
	const tab = await getCurrentTab();
	const results = await chrome.scripting.executeScript({
	  target: { tabId: tab.id },
	  func: (searchText, parentNum) => {
		return window.findElementWithText(searchText, parentNum, 'html');
	  },
	  args: [searchText, parentNum]
	});
	
	const result = results[0].result;
  
	if (result) {
	  await copyToClipboard(result);
	} else {
	  showStatus('✗ Text not found');
	}
  });
  
  // Find element and copy Text
  document.getElementById('copyFoundText').addEventListener('click', async () => {
	const searchText = document.getElementById('findText').value;
	const parentNum = parseInt(document.getElementById('parentNum').value) || 0;
	
	if (!searchText) {
	  showStatus('Please enter text to find');
	  return;
	}
  
	const tab = await getCurrentTab();
	const results = await chrome.scripting.executeScript({
	  target: { tabId: tab.id },
	  func: (searchText, parentNum) => {
		return window.findElementWithText(searchText, parentNum, 'text');
	  },
	  args: [searchText, parentNum]
	});
	
	const result = results[0].result;
  
	if (result) {
	  await copyToClipboard(result);
	} else {
	  showStatus('✗ Text not found');
	}
  });
  
  // Toggle inject
  const toggle = document.getElementById('toggleInject');
  
  // Load saved state
  chrome.storage.local.get(['injectEnabled'], (result) => {
	if (result.injectEnabled) {
	  toggle.classList.add('active');
	}
  });
  
  toggle.addEventListener('click', async () => {
	const isActive = toggle.classList.toggle('active');
	
	// Save state
	await chrome.storage.local.set({ injectEnabled: isActive });
	
	// Get ALL tabs (not just current)
	const tabs = await chrome.tabs.query({});
	
	// Send message to all tabs
	for (const tab of tabs) {
	  try {
		await chrome.tabs.sendMessage(tab.id, { 
		  action: 'toggleInject', 
		  enabled: isActive 
		});
	  } catch (err) {
		// Tab might not have content script loaded yet, that's ok
		console.log('Could not send to tab', tab.id);
	  }
	}
	
	showStatus(isActive ? '✓ Injection enabled on all tabs' : '✓ Injection disabled');
  });