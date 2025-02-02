document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleListening');
    const transcriptDiv = document.getElementById('transcript');
    const aiResponseDiv = document.getElementById('aiResponse');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const jobDescriptionInput = document.getElementById('jobDescription');
    const resumeInput = document.getElementById('resume');
    const saveContextButton = document.getElementById('saveContext');
    const collapseToggle = document.querySelector('.collapse-toggle');
    let isListening = false;
    let isPaused = false;
  
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
        if (!isListening) {
            // Start new recording session
            chrome.runtime.sendMessage({action: 'startListening'});
            toggleButton.textContent = 'Stop Listening';
            isListening = true;
            isPaused = false;
            // Clear previous responses
            transcriptDiv.textContent = '';
            aiResponseDiv.textContent = '';
        } else {
            // Stop recording and get AI response for the last transcript
            chrome.runtime.sendMessage({action: 'stopListening'});
            const currentTranscript = transcriptDiv.textContent;
            console.log('Current transcript when stopping:', currentTranscript); // Debug log
            
            if (currentTranscript.trim()) {
                // Show loading state
                aiResponseDiv.textContent = 'Generating response...';
                
                // Send for AI processing
                chrome.runtime.sendMessage({
                    action: 'questionDetected',
                    question: currentTranscript.trim()
                });
            }
            toggleButton.textContent = 'Start Listening';
            isListening = false;
            isPaused = false;
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateListeningState') {
            isListening = request.isListening;
            isPaused = request.isPaused;
            toggleButton.textContent = isPaused ? 'Resume Listening' : 
                                     isListening ? 'Stop Listening' : 
                                     'Start Listening';
        } else if (request.action === 'updateTranscript') {
            transcriptDiv.textContent = request.transcript;
        } else if (request.action === 'updateAIResponse') {
            console.log('Received AI response:', request.response); // Add logging
            aiResponseDiv.textContent = request.response;
        }
    });

    // Handle collapsible section
    collapseToggle.addEventListener('click', function() {
        const content = this.nextElementSibling;
        content.classList.toggle('active');
        this.textContent = content.classList.contains('active') ? 
            'Interview Context ▼' : 'Interview Context ►';
    });

    // Load saved context
    chrome.storage.sync.get(['jobDescription', 'resume'], (result) => {
        if (result.jobDescription) {
            jobDescriptionInput.value = result.jobDescription;
        }
        if (result.resume) {
            resumeInput.value = result.resume;
        }
    });

    // Save context
    saveContextButton.addEventListener('click', function() {
        const context = {
            jobDescription: jobDescriptionInput.value.trim(),
            resume: resumeInput.value.trim()
        };
        
        chrome.storage.sync.set(context, () => {
            saveContextButton.textContent = 'Context Saved';
            saveContextButton.disabled = true;
            setTimeout(() => {
                saveContextButton.textContent = 'Save Context';
                saveContextButton.disabled = false;
            }, 2000);
        });

        // Send context to background script
        chrome.runtime.sendMessage({
            action: 'updateContext',
            context: context
        });
    });

    // Enable save button when context changes
    [jobDescriptionInput, resumeInput].forEach(input => {
        input.addEventListener('input', function() {
            saveContextButton.textContent = 'Save Context';
            saveContextButton.disabled = false;
        });
    });
});