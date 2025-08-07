/* global FullCalendar */

let allLoadedEvents = [];

// Import slot height adjuster for global access
let slotHeightAdjuster = null;
import('./utils/slot-height-adjuster.js').then(module => {
  slotHeightAdjuster = module;
}).catch(error => {
  console.warn('⚠️ Failed to load slot height adjuster:', error);
});

/* Fixed Calendar Initialization - Proper async loading order */

document.addEventListener('DOMContentLoaded', () => {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('Calendar element not found!');
    return;
  }

  console.log('Calendar element found:', calendarEl);

  // Runtime context
  let userId = document.querySelector('meta[name="user-id"]')?.content ?? 'default_user';
  window.currentUserId = userId;

  // Set up calendar container with proper dimensions
  console.log('Setting up calendar container...');
  calendarEl.style.minHeight = '600px';
  calendarEl.style.width = '100%';
  
  // FIXED: Load UI module FIRST, then initialize calendar
  initializeCalendarWithUI();

  async function initializeCalendarWithUI() {
    console.log('Loading UI module first...');
    
    try {
      // Load UI module before creating calendar
      const uiModule = await import('./ui.js');
      console.log('✅ UI module loaded successfully');
      
      // Now create calendar with proper event handlers
      initializeCalendar();
      
    } catch (error) {
      console.error('❌ Failed to load UI module:', error);
      // Create fallback UI and still initialize calendar
      window.ui = {
        openEventModal: function(defaults) {
          alert('Event modal not available. Please refresh the page.');
          console.error('UI module failed to load properly');
        }
      };
      initializeCalendar();
    }
  }

  function initializeCalendar() {
    console.log('Initializing FullCalendar...');
    
    // FIXED: Ensure UI is available before creating event handlers
    if (!window.ui || !window.ui.openEventModal) {
      console.error('UI module not properly loaded, using fallback');
      window.ui = {
        openEventModal: function(defaults) {
          alert('Event modal not available. Please refresh the page.');
        }
      };
    }
    
    // Create calendar with simplified, reliable configuration
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      expandRows: true,      // let FC stretch rows to fill any extra space
      dayMaxEvents: true,
      firstDay: 1,
      timeZone: 'America/New_York',
      now: function() {
        // Return current time as a Date object (FullCalendar handles timezone conversion)
        return new Date();
      },
      slotDuration: '01:00:00',
      slotLabelInterval: '01:00',
      snapDuration: '00:30:00',
      allDaySlot: true,
      allDayText: 'all-day',
      defaultTimedEventDuration: '00:30:00',
      forceEventDuration: true,
      
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek'
      },

      // FIXED: Improved event handlers with better error handling
      dateClick(info) {
        console.log('Date clicked:', info.dateStr);
        console.log('UI available:', !!window.ui, 'openEventModal available:', !!(window.ui && window.ui.openEventModal));
        
        if (!window.ui || !window.ui.openEventModal) {
          console.error('UI not available for date click');
          alert('Calendar is still loading. Please wait a moment and try again.');
          return;
        }
        
        try {
          const date = info.date;
          const pad = n => n.toString().padStart(2, '0');
          const formatted = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
          
          console.log('Opening event modal with start_time:', formatted);
          window.ui.openEventModal({ 
            start_time: formatted,
            duration_minutes: 30
          });
        } catch (error) {
          console.error('Error in dateClick handler:', error);
          alert('Error opening event modal. Please try again.');
        }
      },

      select(info) {
        console.log('Date range selected:', info.startStr, 'to', info.endStr);
        
        if (!window.ui || !window.ui.openEventModal) {
          console.error('UI not available for select');
          alert('Calendar is still loading. Please wait a moment and try again.');
          return;
        }
        
        try {
          // User selected a date/time range
          const start = info.start;
          const end = info.end;
          const duration = Math.round((end - start) / 60000); // duration in minutes
          
          // Format start time for datetime-local input
          const pad = n => n.toString().padStart(2, '0');
          const formatted = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
          
          console.log('Opening event modal for selection with start_time:', formatted, 'duration:', duration);
          
          // Open modal with selected range
          window.ui.openEventModal({
            start_time: formatted,
            duration_minutes: duration,
            eventType: 'work' // default to work for new events
          });
          
          // Clear the selection after opening modal
          info.view.calendar.unselect();
        } catch (error) {
          console.error('Error in select handler:', error);
          alert('Error opening event modal. Please try again.');
        }
      },

      eventClick(info) {
        console.log('Event clicked:', info.event.title);
        
        // Ignore clicks on weather events
        if (info.event.extendedProps.type === 'weather-warning') {
          info.jsEvent.preventDefault();
          return;
        }
        
        if (!window.ui || !window.ui.openEventModal) {
          console.error('UI not available for event click');
          alert('Calendar is still loading. Please wait a moment and try again.');
          return;
        }
        
        try {
          const event = info.event;
          const start = event.start;
          const end = event.end;
          const pad = n => n.toString().padStart(2, '0');
          const formatted = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
          const duration = Math.round((end - start) / (1000 * 60));
          
          console.log('Opening event modal for existing event:', event.title);
          window.ui.openEventModal({ 
            event_id: event.id,
            title: event.title,
            description: event.extendedProps.description || '',
            location: event.extendedProps.location || '',
            start_time: formatted,
            duration_minutes: duration,
            eventType: event.extendedProps.eventType || 'other'
          });
        } catch (error) {
          console.error('Error in eventClick handler:', error);
          alert('Error opening event modal. Please try again.');
        }
      },
      
      editable: true,
      eventDurationEditable: true,
      eventStartEditable: true,
      selectable: true,
      selectMirror: true,
      selectAllow: ({ start, end }) => {
        // end is exclusive → subtract 1 ms so 8-9 AM shows same day
        const endAdj = new Date(end.getTime() - 1);
        return start.getFullYear() === endAdj.getFullYear() &&
               start.getMonth() === endAdj.getMonth() &&
               start.getDate() === endAdj.getDate();
      }
    });

    // Expose calendar globally
    window.calendar = calendar;

    // Debug timezone information
    console.log('Calendar timezone:', calendar.getOption('timeZone'));
    console.log('Current time in Eastern:', new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    console.log('Browser local time:', new Date().toString());
    console.log('Calendar now function result:', calendar.getOption('now')());
    
    // Test timezone conversion
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    console.log('Timezone conversion test - Original:', now, 'Eastern:', easternTime);

    try {
      calendar.render();
      console.log('✅ Calendar rendered successfully');
      
      // Initialize other features after calendar is confirmed working
      initializeCalendarFeatures();
      
    } catch (error) {
      console.error('❌ Error during calendar.render():', error);
      alert('Error rendering calendar. Please refresh the page.');
    }
  }

  // Initialize other features after calendar and UI are both ready
  function initializeCalendarFeatures() {
    console.log('Initializing calendar features...');
    
    // Load event handlers (UI already loaded)
    import('./handlers/event-handlers.js').then(handlersModule => {
      console.log('✅ Event handlers loaded');
      if (handlersModule.setupEventHandlers && window.calendar) {
        handlersModule.setupEventHandlers(window.calendar, userId);
        console.log('✅ Event handlers initialized');
      }
    }).catch(error => {
      console.warn('⚠️ Failed to load event handlers:', error);
    });
    
    // Load initial events
    loadSimpleEvents();
    
    // Initialize sleep toggles
    import('./calendar/sleep-toggles.js').then(sleepModule => {
      if (sleepModule.initializeSleepToggles && window.calendar) {
        sleepModule.initializeSleepToggles(window.calendar);
        console.log('✅ Sleep toggles initialized');
      }
    }).catch(error => {
      console.warn('⚠️ Failed to load sleep toggles:', error);
    });
    
    // Initialize slot height adjustment
    import('./utils/slot-height-adjuster.js').then(slotAdjusterModule => {
      if (slotAdjusterModule.initializeSlotHeightAdjustment && window.calendar) {
        slotAdjusterModule.initializeSlotHeightAdjustment(window.calendar);
        console.log('✅ Slot height adjustment initialized');
      }
    }).catch(error => {
      console.warn('⚠️ Failed to load slot height adjuster:', error);
    });
    
    // Initialize filters
    import('./calendar/filters.js').then(filtersModule => {
      console.log('✅ Filters module loaded');
      if (filtersModule.wireExistingCheckboxes) {
        filtersModule.wireExistingCheckboxes();
        console.log('✅ Sidebar filters wired up');
      }
    }).catch(error => {
      console.warn('⚠️ Failed to load filters:', error);
    });
    
    // Load other modules but don't block on them
    Promise.all([
      import('./weather.js').catch(() => null),
    ]).then(([weatherModule]) => {
      console.log('✅ Additional modules loaded');
      
      // Initialize weather if available
      if (weatherModule && weatherModule.initializeWeather) {
        try {
          weatherModule.initializeWeather();
          console.log('✅ Weather initialized');
        } catch (e) {
          console.warn('⚠️ Weather init failed:', e);
        }
      }
    }).catch(error => {
      console.warn('⚠️ Some modules failed to load:', error);
    });
  }

  // SIMPLIFIED event loading
  async function loadSimpleEvents() {
    try {
      const response = await fetch(`/calendar/events?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        const events = data.data || data || [];
        
        console.log(`Loading ${events.length} events`);
        
        // Store events globally with normalized eventType
        window.allLoadedEvents = events.map(event => ({
          ...event,
          eventType: event.eventType || 'other'
        }));
        
        // Use filtering system if available
        if (window.filterAndRenderEvents) {
          window.filterAndRenderEvents();
        } else {
          // Fallback: directly add events if filters not available
          console.log('Filters not available, adding events directly');
          window.allLoadedEvents.forEach(event => {
            try {
              window.calendar.addEvent({
                id: event.event_id || event.id,
                title: event.title,
                start: event.start_time || event.start,
                end: event.end_time || event.end,
                allDay: event.all_day || false,
                backgroundColor: event.color || ((event.eventType || '').toLowerCase() === 'fun' ? '#e91e63' : (event.eventType || '').toLowerCase() === 'other' || !event.eventType ? '#4caf50' : '#2196f3'),
                extendedProps: {
                  description: event.description || '',
                  location: event.location || '',
                  eventType: event.eventType || 'other'
                }
              });
            } catch (e) {
              console.warn('Failed to add event:', event.title, e);
            }
          });
        }
        
        console.log('✅ Events loaded successfully');
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }
});

// Simplified loadEvents function for backward compatibility
async function loadEvents(calendar, userId) {
  try {
    const uid = userId || window.currentUserId || 'default_user';
    console.log('Loading events for user:', uid);

    const response = await fetch(`/calendar/events?user_id=${encodeURIComponent(uid)}`);
    if (response.ok) {
      const data = await response.json();
      const events = data.data || data || [];
      
      console.log(`Loading ${events.length} events`);
      
      // Store events globally with normalized eventType
      window.allLoadedEvents = events.map(event => ({
        ...event,
        eventType: event.eventType || 'other'
      }));
      
      // Clear existing events
      calendar.removeAllEvents();
      
      // Use filtering system if available
      if (window.filterAndRenderEvents) {
        window.filterAndRenderEvents();
      } else {
        // Fallback: directly add events if filters not available
        console.log('Filters not available, adding events directly');
        window.allLoadedEvents.forEach(event => {
          try {
            calendar.addEvent({
              id: event.event_id || event.id,
              title: event.title,
              start: event.start_time || event.start,
              end: event.end_time || event.end,
              allDay: event.all_day || false,
              backgroundColor: event.color || ((event.eventType || '').toLowerCase() === 'fun' ? '#e91e63' : (event.eventType || '').toLowerCase() === 'other' || !event.eventType ? '#4caf50' : '#2196f3'),
              extendedProps: {
                description: event.description || '',
                location: event.location || '',
                eventType: event.eventType || 'other'
              }
            });
          } catch (e) {
            console.warn('Failed to add event:', event.title, e);
          }
        });
      }
      
      console.log('✅ Events loaded successfully');
    }
  } catch (error) {
    console.error('Failed to load events:', error);
  }
}

// Expose loadEvents globally
window.loadEvents = loadEvents;

// Ensure gotoDateWithTitle is always defined globally for Mermaid click handlers
window.gotoDateWithTitle = function(dateStr, eventTitle) {
  if (window.calendar) {
    try {
      const date = new Date(dateStr);
      window.calendar.gotoDate(date);
      const allEvents = window.calendar.getEvents();
      let foundEvent = null;
      for (const event of allEvents) {
        const eventDate = event.start;
        if (eventDate && eventDate.toISOString().startsWith(dateStr)) {
          if (eventTitle && event.title === eventTitle) {
            foundEvent = event;
            break;
          } else if (!eventTitle && !foundEvent) {
            foundEvent = event;
          }
        }
      }
      if (foundEvent) {
        const eventClickInfo = {
          event: foundEvent,
          el: null,
          jsEvent: null,
          view: window.calendar.view
        };
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