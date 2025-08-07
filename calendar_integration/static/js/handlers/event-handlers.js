import { api } from '../api.js';
import { ui } from '../ui.js';
import { loadEvents, validateEventBeforeSave, allLoadedEvents } from '../calendar/events.js';

export function setupEventHandlers(calendar, userId) {
  // Add event button handler
  document.getElementById('add-event')
    ?.addEventListener('click', () => ui.openEventModal());

  // Event saved handler
  ui.on('event:saved', async payload => {
    const currentUserId = window.currentUserId || 'default_user';
    payload.user_id = currentUserId;

    console.log('=== SAVING EVENT ===', payload); // Debug log

    // Calculate end_time from start_time and duration_minutes
    const start = new Date(payload.start_time);
    const duration = Number(payload.duration_minutes) || 30;
    const end = new Date(start.getTime() + duration * 60000);

    // Format as ISO strings but without timezone conversion
    // This keeps the time as entered by the user
    const formatLocalISO = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    payload.start_time = formatLocalISO(start);
    payload.end_time = formatLocalISO(end);

    // Ensure eventType is set
    if (!payload.eventType) {
      payload.eventType = '';
    }

    // Validate for conflicts
    if (!validateEventBeforeSave(payload)) {
        return;
    }

    try {
        // Show loading state
        const modal = document.getElementById('event-modal');
        const saveBtn = modal.querySelector('.modal-footer .btn-primary');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        console.log('Making API call...'); // Debug log

        const saved = payload.event_id
            ? await api.put(`/calendar/events/${payload.event_id}?user_id=${currentUserId}`, payload)
            : await api.post('/calendar/events', payload);

        console.log('API response:', saved); // Debug log

        // Close modal immediately after successful API call
        modal.close();

        // Show success notification immediately
        const notif = document.createElement('div');
        notif.className = 'success-notification';
        notif.textContent = payload.event_id ? 'Event updated!' : 'Event created!';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);

        // Force reload events with a small delay to ensure modal is closed
        setTimeout(async () => {
            console.log('Reloading events...'); // Debug log
            await loadEvents(calendar, currentUserId);

            // Navigate to event date if new event
            if (!payload.event_id && saved) {
                const eventData = saved.data || saved;
                const evDate = new Date(eventData.start_time || payload.start_time);
                calendar.gotoDate(evDate);
                console.log('Navigated to date:', evDate); // Debug log
            }
        }, 100);

    } catch (err) {
        console.error('Failed to save event:', err);
        alert(`Error: ${err.message || err}`);
    } finally {
        const modal = document.getElementById('event-modal');
        const saveBtn = modal?.querySelector('.modal-footer .btn-primary');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
  });

  // Event deleted handler
  ui.on('event:deleted', async eventId => {
    try {
      await api.del(`/calendar/events/${eventId}?user_id=${encodeURIComponent(userId)}`);
      await loadEvents(calendar, userId); // Reload events to update UI immediately
    } catch (err) {
      ui.toastError(err);
    }
  });

  // Setup Google Calendar import handler
  document.getElementById('import-google-calendar').onclick = function() {
    const userId = localStorage.getItem('pitext_user_id') || document.querySelector('meta[name="user-id"]').content;
    
    if (!userId) {
        alert('Please refresh the page to initialize user session');
        return;
    }
    
    fetch('/calendar/set-session-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
    }).then(response => {
        if (response.ok) {
            window.location.href = '/calendar/oauth/google/start';
        } else {
            alert('Failed to initialize session. Please try again.');
        }
    }).catch(error => {
        console.error('Error setting session:', error);
        alert('Failed to initialize session. Please try again.');
    });
  };

  // Handle OAuth success
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  
  window.addEventListener('DOMContentLoaded', function() {
    if (getQueryParam('google_import') === 'success') {
      const btn = document.getElementById('import-google-calendar');
      const status = document.getElementById('google-calendar-status');
      const text = document.getElementById('google-calendar-btn-text');
      
      status.textContent = '✓';
      status.style.color = 'green';
      status.style.fontWeight = 'bold';
      status.style.marginRight = '4px';
      text.textContent = 'Google Calendar Connected';
      btn.disabled = true;
      
      // Show notification
      const notif = document.createElement('div');
      notif.className = 'success-notification';
      notif.textContent = 'Google Calendar imported successfully!';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3500);
    }
  });
}

// Ensure gotoDateWithTitle is always defined globally for Mermaid click handlers
window.gotoDateWithTitle = function(dateStr, eventTitle) {
  if (window.calendar) {
    try {
      const date = new Date(dateStr);
      window.calendar.gotoDate(date);
      // Find and open the event on this date with matching title
      const allEvents = window.calendar.getEvents();
      let foundEvent = null;
      for (const event of allEvents) {
        const eventDate = event.start;
        // Check if this event is on the clicked date
        if (eventDate && eventDate.toISOString().startsWith(dateStr)) {
          // If we have a title to match, check it
          if (eventTitle && event.title === eventTitle) {
            foundEvent = event;
            break;
          } else if (!eventTitle && !foundEvent) {
            // If no title specified, take the first event on this date
            foundEvent = event;
          }
        }
      }
      if (foundEvent) {
        // Trigger event click to open modal with correct event details
        const eventClickInfo = {
          event: foundEvent,
          el: null,
          jsEvent: null,
          view: window.calendar.view
        };
        // Call the eventClick handler directly
        const eventClickHandler = window.calendar.getOption('eventClick');
        if (eventClickHandler) {
          eventClickHandler(eventClickInfo);
        }
      }
    } catch (e) {
      console.error('Invalid date or event lookup:', e);
    }
  }
};