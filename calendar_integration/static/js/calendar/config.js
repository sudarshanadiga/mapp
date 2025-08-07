/* global FullCalendar */

export function createCalendarConfig(ui, formatLocalDateTime) {
  return {
    initialView: 'timeGridWeek',
    height: 'auto',
    dayMaxEvents: true,
    timeZone: 'America/New_York',
    now: function() {
      // Return current time as a Date object (FullCalendar handles timezone conversion)
      return new Date();
    },
    slotDuration: '01:00:00',  // 1 hour slots instead of 30 minutes
    slotLabelInterval: '01:00',  // Show label every hour
    snapDuration: '00:30:00',  // Controls selection granularity - 30-minute increments
    slotMinTime: '06:00:00',  // Start time of the calendar
    slotMaxTime: '22:00:00',  // End time of the calendar
    allDaySlot: true,  // Add this to show all-day section
    allDayText: 'all-day',
    defaultTimedEventDuration: '00:30:00',  // Default 30 minutes for new events
    forceEventDuration: true,  // Force events to show their actual duration
    slotEventOverlap: false,  // Prevent event overlap for better alignment
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek'
    },

    dateClick (info) {
      // Determine the current view
      const viewType = info.view?.type || (window.calendar && window.calendar.view && window.calendar.view.type);
      let date;
      if (viewType === 'dayGridMonth') {
        // Month view: always use 2:00 PM
        const [year, month, day] = info.dateStr.split('-').map(Number);
        date = new Date(year, month - 1, day, 14, 0, 0, 0); // 2:00 PM
      } else {
        // Week/Day view: use the actual clicked time
        date = info.date;
      }
      const pad = n => n.toString().padStart(2, '0');
      const formatted = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      ui.openEventModal({ 
        start_time: formatted,
        duration_minutes: 30  // Explicitly set to match visual duration
      });
    },

    select(info) {
      // User selected a date/time range
      const start = info.start;
      const end = info.end;
      const duration = Math.round((end - start) / 60000); // duration in minutes
      
      // Format start time for datetime-local input
      const pad = n => n.toString().padStart(2, '0');
      const formatted = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
      
      // Open modal with selected range
      ui.openEventModal({
        start_time: formatted,
        duration_minutes: duration,
        eventType: 'work' // default to work for new events
      });
      
      // Clear the selection after opening modal
      info.view.calendar.unselect();
    },

    eventClick(info) {
      // Ignore clicks on weather events
      if (info.event.extendedProps.type === 'weather-warning') {
        info.jsEvent.preventDefault();
        return;
      }
      
      // If this is a free time block, open event modal pre-filled
      if (info.event.extendedProps.isPlaceholder) {
        // Only allow creating events in awake hours
        const start = info.event.start;
        const end = info.event.end;
        if (start.getHours() >= 7 && end.getHours() <= 23) {
          ui.openEventModal({
            title: '',
            start_time: start.toISOString().slice(0,16),
            duration_minutes: Math.round((end - start) / 60000),
            eventType: 'work'
          });
        }
        return;
      }
      const start  = info.event.start;
      const end    = info.event.end ?? start;           // handle all-day events
      const mins   = Math.round((end - start) / 60000);
      const props  = info.event.extendedProps;

      ui.openEventModal({
        event_id        : info.event.id,
        title           : info.event.title,
        description     : props.description || '',
        location        : props.location || '',
        start_time      : formatLocalDateTime(start), // Use local time for modal
        duration_minutes: mins > 0 ? mins : 30,
        flowchart       : props.flowchart || null,
        type            : props.type || null,
        eventType       : props.eventType || 'other',
        echo_event_ids  : props.echo_event_ids || null
      });
    },

    eventDrop(info) {
      const event = info.event;
      const ext = event.extendedProps;
      // Prevent dragging free/placeholder events
      if (ext.isPlaceholder) {
        info.revert();
        return;
      }
      // Prevent overlapping fun events
      const eventType = (ext.eventType || '').toLowerCase();
      if (eventType === 'fun') {
        const allEvents = window.calendar.getEvents();
        const thisDate = event.start.toISOString().slice(0,10);
        const otherFun = allEvents.filter(e =>
          e.id !== event.id &&
          ((e.extendedProps.eventType || '').toLowerCase() === 'fun') &&
          e.start.toISOString().slice(0,10) === thisDate
        );
        if (otherFun.length > 0) {
          alert('Only one fun activity allowed per day');
          info.revert();
          return;
        }
      }
      // Validate fun duration
      if (eventType === 'fun') {
        const duration = (event.end - event.start) / (1000 * 60 * 60);
        if (duration > 8) {
          alert('Fun activity duration cannot be more than 8 hours');
          info.revert();
          return;
        }
      }
      // Save updated event
      const payload = {
        event_id: event.id,
        title: event.title,
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        eventType: ext.eventType,
        user_id: window.currentUserId
      };
      ui.emit('event:saved', payload);
    },

    eventResize(info) {
      const event = info.event;
      const ext = event.extendedProps;
      // Prevent resizing free/placeholder events
      if (ext.isPlaceholder) {
        info.revert();
        return;
      }
      // Validate fun event duration
      const eventType = (ext.eventType || '').toLowerCase();
      if (eventType === 'fun') {
        const duration = (event.end - event.start) / (1000 * 60 * 60);
        if (duration > 8) {
          alert('Fun activity duration cannot be more than 8 hours');
          info.revert();
          return;
        }
      }
      // Save updated event
      const payload = {
        event_id: event.id,
        title: event.title,
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        eventType: ext.eventType,
        user_id: window.currentUserId
      };
      ui.emit('event:saved', payload);
    },

    editable: true,
    eventDurationEditable: true,
    eventStartEditable: true,
    selectable: true,
    selectMirror: true
  };
}