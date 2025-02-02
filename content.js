let audioContext;
let mediaStream;
let recognition;
let isPaused = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startCapture(request.streamId);
  } else if (request.action === 'stopCapture') {
    stopCapture();
  } else if (request.action === 'pauseCapture') {
    pauseCapture();
  } else if (request.action === 'resumeCapture') {
    resumeCapture();
  }
});

function pauseCapture() {
  if (recognition) {
    recognition.stop();
    isPaused = true;
  }
}

function resumeCapture() {
  if (recognition && isPaused) {
    recognition.start();
    isPaused = false;
  }
}

function startCapture(streamId) {
  navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  }).then((stream) => {
    mediaStream = stream;
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // Initialize speech recognition
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = function(event) {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript.trim() !== '') {
        console.log('Sending transcript:', finalTranscript.trim()); // Debug log
        chrome.runtime.sendMessage({
          action: 'updateTranscript', 
          transcript: finalTranscript.trim()
        });
      }
    };

    recognition.start();
  }).catch((error) => {
    console.error('Error starting capture:', error);
  });
}

function stopCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close();
  }
  if (recognition) {
    // Add event listener for final result before stopping
    recognition.onresult = function(event) {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        chrome.runtime.sendMessage({
          action: 'updateTranscript', 
          transcript: finalTranscript.trim()
        });
      }
    };
    
    recognition.stop();
  }
}

function isQuestion(text) {
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how'];
  const lowerText = text.toLowerCase();
  return questionWords.some(word => lowerText.includes(word)) || text.includes('?');
}