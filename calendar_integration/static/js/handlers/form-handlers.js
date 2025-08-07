// Initialize CSRF token
export function initializeCSRF() {
    fetch('/calendar/csrf-token')
      .then(response => response.json())
      .then(data => {
        if (data.data && data.data.csrf_token) {
          document.cookie = `csrftoken=${data.data.csrf_token}; path=/; SameSite=Lax`;
        }
      })
      .catch(error => console.error('Failed to get CSRF token:', error));
  }
  
  // Initialize form validators and handlers
  export function initializeFormHandlers() {
    // This function is called during initialization but form-specific
    // handlers are attached when the modal opens (in ui.js)
    // Keeping this here for potential future form-related setup
  }
  
  // Export validation functions that might be used by forms
  export function validateEventDuration(eventType, durationMinutes) {
    if (eventType === 'fun') {
      const hours = durationMinutes / 60;
      if (hours > 8) {
        return {
          valid: false,
          message: 'Fun activity duration cannot be more than 8 hours'
        };
      }
    }
    return { valid: true };
  }
  
  export function validateEventTime(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return {
        valid: false,
        message: 'End time must be after start time'
      };
    }
    
    return { valid: true };
  }