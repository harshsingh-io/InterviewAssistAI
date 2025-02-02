document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleListening');
    const transcriptDiv = document.getElementById('transcript');
    const aiResponseDiv = document.getElementById('aiResponse');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    let isListening = false;
  
    // Load saved API key
    chrome.storage.sync.get('openaiApiKey', (result) => {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
            saveApiKeyButton.textContent = 'API Key Saved';
            saveApiKeyButton.disabled = true;
        }
    });

    apiKeyInput.addEventListener('input', function() {
        saveApiKeyButton.textContent = 'Save API Key';
        saveApiKeyButton.disabled = false;
    });

    saveApiKeyButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.runtime.sendMessage({action: 'setApiKey', apiKey: apiKey});
            saveApiKeyButton.textContent = 'API Key Saved';
            saveApiKeyButton.disabled = true;
        } else {
            alert('Please enter a valid API key');
        }
    });

    toggleButton.addEventListener('click', function() {
        isListening = !isListening;
        toggleButton.textContent = isListening ? 'Stop Listening' : 'Start Listening';
        
        if (isListening) {
            chrome.runtime.sendMessage({action: 'startListening'});
            transcriptDiv.textContent = 'Listening for questions...';
            aiResponseDiv.textContent = 'The answer will appear here.';
        } else {
            chrome.runtime.sendMessage({action: 'stopListening'});
            transcriptDiv.textContent = '';
            aiResponseDiv.textContent = '';
        }
    });
  
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateTranscript') {
            transcriptDiv.textContent = request.transcript;
        } else if (request.action === 'updateAIResponse') {
            aiResponseDiv.textContent = request.response;
        }
    });

    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Sync theme across all extension pages
        chrome.runtime.sendMessage({
            action: 'syncTheme',
            theme: newTheme
        });
    });
    
    // Listen for theme sync from other pages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'syncTheme') {
            document.documentElement.setAttribute('data-theme', request.theme);
            localStorage.setItem('theme', request.theme);
        }
    });
});