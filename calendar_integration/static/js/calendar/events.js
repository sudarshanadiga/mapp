import { api } from '../api.js';

export let allLoadedEvents = [];

export async function loadEvents(calendar, userId) {
  try {
    const uid = userId || window.currentUserId || 'default_user';
    console.log('=== LOADING EVENTS ===');
    console.log('User ID:', uid);

    const response = await api.get(`/calendar/events?user_id=${encodeURIComponent(uid)}`);
    const events = response.data || response || [];

    console.log('Raw events from API:', events);
    console.log('Number of events:', events.length);

    // Store events globally with normalized eventType
    allLoadedEvents = events.map(event => ({
      ...event,
      eventType: event.eventType || 'other'
    }));

    // Clear calendar first
    calendar.removeAllEvents();

    // Small delay to ensure UI is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // IMPORTANT: Update the global calendar reference to ensure filters work
    window.calendar = calendar;

    // Filter and render events
    if (window.filterAndRenderEvents) {
      window.filterAndRenderEvents();
    } else {
      // Fallback: directly add events if filters not available
      console.log('Filters not available, adding events directly');
      allLoadedEvents.forEach(event => {
        try {
          calendar.addEvent({
            id: event.event_id || event.id,
            title: event.title,
            start: event.start_time || event.start,
            end: event.end_time || event.end,
            allDay: event.all_day || false,
            backgroundColor: event.color || getEventColor(event.eventType),
            extendedProps: {
              description: event.description || '',
              location: event.location || '',
              eventType: event.eventType || 'other',
              user_id: event.user_id
            }
          });
        } catch (e) {
          console.warn('Failed to add event:', event.title, e);
        }
      });
    }
    
    if (window.renderMonthSummary) {
      window.renderMonthSummary();
    }
    if (window.enhanceMonthCells) {
      window.enhanceMonthCells();
    }

    console.log(`Total events loaded: ${allLoadedEvents.length}`);
    console.log('Events displayed after filtering:', calendar.getEvents().length);

    // Debug: List all event titles and types
    allLoadedEvents.forEach((event, index) => {
        console.log(`Event ${index + 1}: "${event.title}" (${event.eventType || 'regular'}) - ${event.start_time}`);
    });

  } catch (err) {
    console.error('Failed to load events:', err);
    console.error('Error details:', err.message);
  }
}

// Helper function to get event color
function getEventColor(eventType) {
  const type = (eventType || '').toLowerCase();
  if (type === 'fun') return '#e91e63';
  if (type === 'other' || type === '') return '#4caf50';
  return '#2196f3'; // default/work
}

export function checkEventConflicts(newEvent, existingEvents) {
  return existingEvents.filter(event => {
    if ((event.event_id || event.id) === (newEvent.event_id || newEvent.id)) return false;
    const startA = new Date(newEvent.start_time || newEvent.start);
    const endA = new Date(newEvent.end_time || newEvent.end);
    const startB = new Date(event.start_time || event.start);
    const endB = new Date(event.end_time || event.end);
    // Overlap logic
    return (
      (startA >= startB && startA < endB) ||
      (endA > startB && endA <= endB) ||
      (startA <= startB && endA >= endB)
    );
  });
}

export function validateEventBeforeSave(event) {
  const conflicts = checkEventConflicts(event, allLoadedEvents);
  // Special rules for fun events
  const eventType = (event.eventType || '').toLowerCase();
  if (eventType === 'fun') {
    const funConflicts = conflicts.filter(c => (c.eventType || '').toLowerCase() === 'fun');
    if (funConflicts.length > 0) {
      alert('Fun activities cannot overlap. Please adjust the time.');
      return false;
    }
    // Warn about work conflicts
    const workConflicts = conflicts.filter(c => !c.eventType || (c.eventType || '').toLowerCase() === 'work');
    if (workConflicts.length > 0) {
      const confirmMsg =
        'This fun activity conflicts with work events. The work events will be hidden when viewing fun activities. Continue?';
      if (!window.confirm(confirmMsg)) return false;
    }
  }
  // For work events, warn about fun conflicts
  if (!event.eventType || eventType === 'work') {
    const funConflicts = conflicts.filter(c => (c.eventType || '').toLowerCase() === 'fun');
    if (funConflicts.length > 0) {
      const confirmMsg =
        'This event conflicts with scheduled fun time. Are you planning to work during fun hours?';
      if (!window.confirm(confirmMsg)) return false;
    }
  }
  return true;
}

export function initializeDefaultFunEvents() {
  const funEvents = [];
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Create fun events for weekends
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0 || date.getDay() === 6) { // Sunday or Saturday
      const start = new Date(year, month, day, 14, 0); // 2 PM
      const end = new Date(year, month, day, 18, 0);   // 6 PM
      funEvents.push({
        id: `fun-${year}-${month + 1}-${day}`,
        title: 'Fun Time',
        start: start.toISOString(),
        end: end.toISOString(),
        eventType: 'fun',
        color: '#e91e63',
        editable: true
      });
    }
  }
  return funEvents;
}