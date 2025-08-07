// static/js/chat.js
// Handles voice transcripts and chat interactions

class Chat {
  constructor() {
    this.panel = document.getElementById('chat-panel');
    this.isSpeaking = false;
    this.voiceInitialized = false;
    
    // Initialize voice on first user interaction
    this.initializeVoice();
    
    // Set up voice integration
    if (window.voice) {
      window.voice.onTranscript = t => this.handleUser(t);
    }
  }

  initializeVoice() {
    // Many browsers require user interaction to enable speech synthesis
    const initHandler = () => {
      if (!this.voiceInitialized && 'speechSynthesis' in window) {
        // Get voices to initialize the speech synthesis
        const voices = window.speechSynthesis.getVoices();
        console.log(`Speech synthesis initialized with ${voices.length} voices`);
        
        // Test speech synthesis with empty utterance
        const testUtterance = new SpeechSynthesisUtterance('');
        testUtterance.volume = 0;
        window.speechSynthesis.speak(testUtterance);
        
        this.voiceInitialized = true;
        
        // Remove the event listeners after initialization
        document.removeEventListener('click', initHandler);
        document.removeEventListener('touchstart', initHandler);
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', initHandler);
    document.addEventListener('touchstart', initHandler);
    
    // Also try to initialize immediately
    if ('speechSynthesis' in window) {
      // Load voices
      window.speechSynthesis.getVoices();
      
      // Chrome loads voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = window.speechSynthesis.getVoices();
          console.log(`Voices loaded: ${voices.length} available`);
        };
      }
    }
  }

  async handleUser(text) {
    this.addBubble('user', text);

    try {
      const res = await fetch('/travel/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text}),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      // Show reply
      this.addBubble('assistant', data.reply);
      
      // Speak the reply
      this.speakText(data.reply);

      // Handle itinerary if present AND it's a new trip
      if (data.itinerary && window.TravelApp) {
        // Only render if it's a new itinerary (check if city/days changed)
        const isNewTrip = data.reply.includes("I've created") || 
                          data.reply.includes("planned") ||
                          data.reply.includes("itinerary for");
        
        if (isNewTrip) {
          window.TravelApp.renderTripOnMap(data.itinerary);
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.addBubble('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Notify voice controller that assistant is about to speak
    if (window.voice && window.voice.setAssistantSpeaking) {
      window.voice.setAssistantSpeaking(true);
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Wait a bit for cancel to complete
    setTimeout(() => {
      // Remove markdown formatting for cleaner speech
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
        .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
        .replace(/\n+/g, '. ')            // Replace newlines with periods
        .replace(/[#_~`]/g, '');          // Remove other markdown chars

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Configure the utterance
      utterance.rate = 0.9;     // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 0.8;   // Slightly lower volume to reduce pickup
      utterance.lang = 'en-US';
      
      // Select a voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Try to find an English voice
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && !voice.name.includes('Google')
        ) || voices[0];
        utterance.voice = englishVoice;
        console.log(`Using voice: ${englishVoice.name}`);
      }
      
      // Handle events
      utterance.onstart = () => {
        this.isSpeaking = true;
        console.log('Started speaking:', cleanText.substring(0, 50) + '...');
      };
      
      utterance.onend = () => {
        this.isSpeaking = false;
        console.log('Finished speaking');
        
        // Notify voice controller that assistant finished speaking
        if (window.voice && window.voice.setAssistantSpeaking) {
          window.voice.setAssistantSpeaking(false);
        }
        
        // DO NOT automatically restart voice recognition
        // User must click the mic button to speak again
        console.log('Click the mic button to speak again');
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error, event);
        this.isSpeaking = false;
        
        // Notify voice controller on error too
        if (window.voice && window.voice.setAssistantSpeaking) {
          window.voice.setAssistantSpeaking(false);
        }
        
        // Try to help debug common issues
        if (event.error === 'not-allowed') {
          console.error('Speech synthesis not allowed. User interaction may be required.');
        }
      };

      // Speak
      try {
        window.speechSynthesis.speak(utterance);
        console.log('Speech synthesis started');
      } catch (error) {
        console.error('Failed to start speech:', error);
        // Notify voice controller on failure
        if (window.voice && window.voice.setAssistantSpeaking) {
          window.voice.setAssistantSpeaking(false);
        }
      }
    }, 100);
  }
  
  addBubble(role, text) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    
    // Parse markdown-style formatting for display
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
      .replace(/\n/g, '<br>');                           // Line breaks
    
    div.innerHTML = formattedText;
    this.panel.appendChild(div);
    
    // Ensure panel is visible
    this.panel.style.display = 'block';
    
    // Smooth scroll to latest message
    setTimeout(() => {
      div.scrollIntoView({behavior: 'smooth', block: 'end'});
    }, 100);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.chatInstance = new Chat();
  console.log('Chat system initialized');
});