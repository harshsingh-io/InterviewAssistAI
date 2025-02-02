let recognition;
let assistantWindowId = null;
let interviewContext = {
    jobDescription: '',
    resume: ''
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startListening') {
    startListening();
  } else if (request.action === 'stopListening') {
    stopListening();
  } else if (request.action === 'pauseListening') {
    pauseListening();
  } else if (request.action === 'resumeListening') {
    resumeListening();
  } else if (request.action === 'questionDetected') {
    handleQuestionDetected(request.question);
  } else if (request.action === 'setApiKey') {
    chrome.storage.sync.set({ openaiApiKey: request.apiKey });
  } else if (request.action === 'getAIResponse') {
    getAIResponse(request.question);
  } else if (request.action === 'updateContext') {
    interviewContext = request.context;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === assistantWindowId) {
    assistantWindowId = null;
  }
});

function startListening() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // First inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });

      // Then get media stream ID
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId(
          { consumerTabId: tabs[0].id },
          (streamId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(streamId);
            }
          }
        );
      });

      // Send the stream ID to content script
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startCapture',
        streamId: streamId
      });

      console.log('Capture started successfully');
    } catch (error) {
      console.error('Error in startListening:', error);
    }
  });
}

function stopListening() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopCapture' })
        .catch(err => console.error('Error stopping capture:', err));
      
      // Update UI state
      chrome.runtime.sendMessage({
        action: 'updateListeningState',
        isListening: false,
        isPaused: false
      });
    }
  });
}

function pauseListening() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'pauseCapture' })
        .catch(err => console.error('Error pausing capture:', err));
    }
  });
}

function resumeListening() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'resumeCapture' })
        .catch(err => console.error('Error resuming capture:', err));
    }
  });
}

function isQuestion(text) {
  // Simple check for question words or question mark
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how'];
  const lowerText = text.toLowerCase();
  return questionWords.some(word => lowerText.includes(word)) || text.includes('?');
}

async function getAIResponse(question) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not set');
    }

    // Create system message with context
    let systemMessage = "You are acting as the interviewee in a job interview. Use the provided resume to answer questions about yourself, your experience, and skills. Keep responses professional, confident, and authentic. Highlight relevant experiences and skills from the resume that match the job description. Answer as if you are the candidate.";
    
    if (interviewContext.jobDescription || interviewContext.resume) {
      systemMessage += "\n\nYour profile:";
      if (interviewContext.resume) {
        systemMessage += "\nResume: " + interviewContext.resume;
      }
      if (interviewContext.jobDescription) {
        systemMessage += "\n\nYou are interviewing for this position:\n" + interviewContext.jobDescription;
      }
      systemMessage += "\n\nRemember: You are the candidate. Answer all questions in first person, drawing from the experiences and qualifications in your resume. Align your answers with the job requirements where relevant.";
    }

    console.log('Sending request to OpenAI API...', question);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: question }
        ],
        temperature: 0.7 // Add some variability but keep responses focused
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get response from OpenAI: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content.trim();
    console.log('Got AI response:', answer);
    chrome.runtime.sendMessage({
      action: 'updateAIResponse', 
      response: answer
    });
  } catch (error) {
    console.error('Error getting AI response:', error);
    chrome.runtime.sendMessage({
      action: 'updateAIResponse', 
      response: 'Error: ' + error.message
    });
  }
}

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('openaiApiKey', (result) => {
      resolve(result.openaiApiKey);
    });
  });
}

function handleQuestionDetected(question) {
  console.log('Question detected:', question); // Debug log
  
  // Update UI to show we're processing the question
  chrome.runtime.sendMessage({
    action: 'updateListeningState',
    isListening: false,
    isPaused: false
  });
  
  // Clear previous response and show loading state
  chrome.runtime.sendMessage({
    action: 'updateAIResponse',
    response: 'Generating response...'
  });
  
  // Get AI response for the question
  getAIResponse(question);
}