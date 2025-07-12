/* global FullCalendar */

import { api } from './api.js';
import { ui }  from './ui.js';

let allLoadedEvents = [];

document.addEventListener('DOMContentLoaded', () => {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // ------------------------------------------------------------------  
  // Runtime context
  // ------------------------------------------------------------------  
  let userId = document.querySelector('meta[name="user-id"]')?.content ?? 'default_user';
  window.currentUserId = userId; // Make it globally accessible
  const csrftoken = document.cookie
    .split('; ')
    .find(c => c.startsWith('csrftoken='))?.split('=')[1] ?? '';

  // ------------------------------------------------------------------  
  // Checkbox state (persisted in localStorage for session persistence)
  // ------------------------------------------------------------------  
  let showFun = localStorage.getItem('showFun') === 'true';
  let showWork  = localStorage.getItem('showWork') !== 'false'; // Default to true
  let showOther = localStorage.getItem('showOther') === 'true';

  // Helper to update localStorage and state
  function setShowFun(val) { showFun = val; localStorage.setItem('showFun', val); filterAndRenderEvents(); renderMonthSummary(); }
  function setShowWork(val)  { showWork  = val; localStorage.setItem('showWork', val); filterAndRenderEvents(); renderMonthSummary(); }
  function setShowOther(val)  { showOther  = val; localStorage.setItem('showOther', val); filterAndRenderEvents(); renderMonthSummary(); }

  // Inject checkboxes after FullCalendar renders
  function injectCheckboxes() {
    const todayBtn = document.querySelector('.fc-today-button');
    if (!todayBtn || document.getElementById('calendar-filters')) return;
    
    const filterDiv = document.createElement('div');
    filterDiv.id = 'calendar-filters';
    
    // Updated styling to position closer to today button with box
    filterDiv.style.display = 'flex';
    filterDiv.style.gap = '15px';
    filterDiv.style.marginLeft = '12px'; // Reduced from 20px to move closer
    filterDiv.style.alignItems = 'center';
    
    filterDiv.innerHTML = `
      <label style="display:flex;align-items:center;gap:5px;">
        <input type="checkbox" id="show-fun"> Fun
      </label>
      <label style="display:flex;align-items:center;gap:5px;">
        <input type="checkbox" id="show-work"> Work
      </label>
      <label style="display:flex;align-items:center;gap:5px;">
        <input type="checkbox" id="show-other"> Other
      </label>
    `;
    
    // Insert filterDiv immediately after the Today button
    todayBtn.parentElement.insertAdjacentElement('afterend', filterDiv);
    
    // Set initial state
    document.getElementById('show-fun').checked = showFun;
    document.getElementById('show-work').checked  = showWork;
    document.getElementById('show-other').checked  = showOther;
    
    // Add listeners
    document.getElementById('show-fun').addEventListener('change', e => setShowFun(e.target.checked));
    document.getElementById('show-work').addEventListener('change', e => setShowWork(e.target.checked));
    document.getElementById('show-other').addEventListener('change', e => setShowOther(e.target.checked));
  }

  // ------------------------------------------------------------------  
  // FullCalendar instance
  // ------------------------------------------------------------------  
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: 'auto',
    dayMaxEvents: true,
    timeZone: 'local',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,timeGridDay,dayGridMonth'
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
      ui.openEventModal({ start_time: formatted });
    },

    eventClick(info) {
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
        duration_minutes: mins > 0 ? mins : 60,
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
      if (ext.eventType === 'fun') {
        const allEvents = calendar.getEvents();
        const thisDate = event.start.toISOString().slice(0,10);
        const otherFun = allEvents.filter(e =>
          e.id !== event.id &&
          (e.extendedProps.eventType === 'fun') &&
          e.start.toISOString().slice(0,10) === thisDate
        );
        if (otherFun.length > 0) {
          alert('Only one fun activity allowed per day');
          info.revert();
          return;
        }
      }
      // Validate fun duration
      if (ext.eventType === 'fun') {
        const duration = (event.end - event.start) / (1000 * 60 * 60);
        if (duration < 1 || duration > 8) {
          alert('Fun activity duration should be between 1 and 8 hours');
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
        user_id: userId
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
      if (ext.eventType === 'fun') {
        const duration = (event.end - event.start) / (1000 * 60 * 60);
        if (duration < 1) {
          alert('Fun activity duration cannot be less than 1 hour');
          info.revert();
          return;
        }
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
        user_id: userId
      };
      ui.emit('event:saved', payload);
    },

    editable: true,
    eventDurationEditable: true,
    eventStartEditable: true,
    selectable: true,
    selectMirror: true
  });

  // CRITICAL: Expose calendar to window object BEFORE calling any methods
  window.calendar = calendar;

  // Render the calendar
  calendar.render();

  // Wait for calendar to be fully rendered before proceeding
  setTimeout(() => {
    console.log('Initializing calendar components...');
    // Sleep toggles are initialized after calendar events
    injectCheckboxes();
    // Initialize sleep toggles
    let earlyCollapsed = true;
    let lateCollapsed = true;

    function applySleepStates() {
      if (!calendar || !calendar.view) return;

      const minTime = earlyCollapsed ? '06:00:00' : '00:00:00';
      const maxTime = lateCollapsed ? '22:00:00' : '24:00:00';

      calendar.setOption('slotMinTime', minTime);
      calendar.setOption('slotMaxTime', maxTime);
    }

    function renderSleepToggles() {
      if (!calendar || !calendar.view) return;

      // Only run for Week or Day views
      const isTimeGrid = calendar.view.type.startsWith('timeGrid');
      if (!isTimeGrid) {
        // Clean up toggles if we switch to a non-timegrid view
        const existingEarly = document.querySelector('.early-sleep-toggle-bar');
        const existingLate = document.querySelector('.late-sleep-toggle-bar');
        if (existingEarly) existingEarly.remove();
        if (existingLate) existingLate.remove();
        return;
      }

      // Wait for calendar to be fully rendered
      setTimeout(() => {
        // Find the time grid container
        const timeGridContainer = document.querySelector('.fc-timegrid-body');
        if (!timeGridContainer) {
          console.warn('Could not find time grid container');
          return;
        }

        // Create container for toggles if it doesn't exist
        let toggleContainer = document.querySelector('.sleep-toggle-container');
        if (!toggleContainer) {
          toggleContainer = document.createElement('div');
          toggleContainer.className = 'sleep-toggle-container';
          toggleContainer.style.position = 'relative';
          timeGridContainer.parentElement.insertBefore(toggleContainer, timeGridContainer);
        }

        // --- Early Sleep Toggle (at the top) ---
        let earlyToggle = document.querySelector('.early-sleep-toggle-bar');
        if (!earlyToggle) {
          earlyToggle = document.createElement('div');
          earlyToggle.className = 'sleep-toggle-bar early-sleep-toggle-bar';
          earlyToggle.onclick = () => {
            earlyCollapsed = !earlyCollapsed;
            applySleepStates();
          };
          toggleContainer.appendChild(earlyToggle);
        }
        earlyToggle.textContent = earlyCollapsed ? '＋ Show Early Hours (12 AM – 6 AM)' : '－ Hide Early Hours';

        // --- Late Sleep Toggle (at the bottom) ---
        let lateToggle = document.querySelector('.late-sleep-toggle-bar');
        if (!lateToggle) {
          lateToggle = document.createElement('div');
          lateToggle.className = 'sleep-toggle-bar late-sleep-toggle-bar';
          lateToggle.onclick = () => {
            lateCollapsed = !lateCollapsed;
            applySleepStates();
          };
          // Insert after the time grid
          timeGridContainer.parentElement.appendChild(lateToggle);
        }
        lateToggle.textContent = lateCollapsed ? '＋ Show Late Hours (10 PM – 12 AM)' : '－ Hide Late Hours';
      }, 100);
    }

    // Hook into FullCalendar's lifecycle
    calendar.on('viewDidMount', () => {
      setTimeout(() => {
        applySleepStates();
        renderSleepToggles();
      }, 100);
    });

    // Also listen for view changes
    calendar.on('datesSet', () => {
      setTimeout(() => {
        renderSleepToggles();
      }, 100);
    });

    // Initial setup after calendar is fully rendered
    setTimeout(() => {
      applySleepStates();
      renderSleepToggles();
    }, 500);
    // Load events last
    loadEvents(calendar, userId);
  }, 300); // Increased delay to ensure calendar is fully rendered.

  // Expose loadEvents globally for reloading after echo generation
  window.loadEvents = loadEvents;

  // ------------------------------------------------------------------  
  // Global listeners
  // ------------------------------------------------------------------  
  document.getElementById('add-event')
    ?.addEventListener('click', () => ui.openEventModal());

  ui.on('event:saved', async payload => {
    const currentUserId = window.currentUserId || 'default_user';
    payload.user_id = currentUserId;

    console.log('=== SAVING EVENT ===', payload); // Debug log

    // Calculate end_time from start_time and duration_minutes
    const start = new Date(payload.start_time);
    payload.start_time = start.toISOString();

    const duration = Number(payload.duration_minutes) || 60;
    const end = new Date(start.getTime() + duration * 60000);
    payload.end_time = end.toISOString();

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

        // Close modal immediately
        modal.close();

        // Force reload events
        console.log('Reloading events...'); // Debug log
        await loadEvents(calendar, currentUserId);

        // Navigate to event date if new event
        if (!payload.event_id && saved) {
            const eventData = saved.data || saved;
            const evDate = new Date(eventData.start_time || payload.start_time);
            calendar.gotoDate(evDate);
            console.log('Navigated to date:', evDate); // Debug log
        }

        // Show success notification
        const notif = document.createElement('div');
        notif.className = 'success-notification';
        notif.textContent = payload.event_id ? 'Event updated!' : 'Event created!';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);

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

  ui.on('event:deleted', async eventId => {
    try {
      await api.del(`/calendar/events/${eventId}?user_id=${encodeURIComponent(userId)}`);
      await loadEvents(calendar, userId); // Reload events to update UI immediately
    } catch (err) {
      ui.toastError(err);
    }
  });

  // Filter events based on checkboxes
  function getFilteredEvents(events) {
    return events.filter(ev => {
      if (ev.eventType === "work" && showWork) return true;
      if (ev.eventType === "fun" && showFun) return true;
      if (ev.eventType === "other" && showOther) return true;
      return false;                                             // hidden
    });
  }

  // Filter and render events
  function filterAndRenderEvents() {
    if (!window.calendar || typeof window.calendar.removeAllEvents !== 'function') {
      console.warn('Calendar not ready for filtering');
      return;
    }
    window.calendar.removeAllEvents();
    const filtered = getFilteredEvents(allLoadedEvents);
    filtered.forEach(ev => {
      let startTime = ev.start_time || ev.start;
      let endTime = ev.end_time || ev.end;
      if (typeof startTime === 'string' && !startTime.includes('T')) startTime += 'T00:00:00';
      if (typeof endTime === 'string' && !endTime.includes('T')) endTime += 'T00:00:00';

      // Style by eventType
      let backgroundColor = ev.color;
      let borderColor = undefined;
      let textColor = undefined;
      let classNames = [];
      if (ev.eventType === 'fun') {
        backgroundColor = '#e91e63';
        textColor = '#fff';
        classNames.push('event-fun');
      } else if (ev.eventType === 'other') {
        backgroundColor = '#e8f5e9';
        borderColor = '#4caf50';
        textColor = '#2e7d32';
        classNames.push('event-other');
      }
      // Add event to calendar
      window.calendar.addEvent({
        id: ev.event_id || ev.id,
        title: ev.title,
        start: startTime,
        end: endTime,
        allDay: ev.all_day || false,
        backgroundColor,
        borderColor,
        textColor,
        editable: ev.editable !== false,
        classNames,
        extendedProps: {
          description: ev.description || '',
          location: ev.location || '',
          user_id: ev.user_id,
          type: ev.type,
          eventType: ev.eventType,
          flowchart: ev.flowchart,
          created: ev.created,
          last_modified: ev.last_modified
        }
      });
    });
  }

  window.filterAndRenderEvents = filterAndRenderEvents;
  window.getFilteredEvents = getFilteredEvents;

  // Add month summary bar above the calendar
  function renderMonthSummary() {
    // Only show if at least one filter is active
    if (!showOther && !showFun && !showWork) return;
    // Find the toolbar chunk containing the view buttons
    const viewToolbar = document.querySelector('.fc-toolbar-chunk:last-child');
    if (!viewToolbar) return;
    let summaryBar = document.getElementById('month-summary-bar');
    if (!summaryBar) {
      summaryBar = document.createElement('div');
      summaryBar.id = 'month-summary-bar';
      summaryBar.style.padding = '10px 18px 10px 0';
      summaryBar.style.backgroundColor = 'transparent';
      summaryBar.style.borderRadius = '4px';
      summaryBar.style.fontSize = '14px';
      summaryBar.style.display = 'inline-block';
      summaryBar.style.color = '#facf0f';
      summaryBar.style.fontWeight = '600';
      summaryBar.style.marginRight = '18px';
      viewToolbar.insertBefore(summaryBar, viewToolbar.firstChild);
    }
    // Calculate stats for current month
    const view = calendar.view;
    const start = new Date(view.currentStart);
    const end = new Date(view.currentEnd);
    const monthEvents = allLoadedEvents.filter(event => {
      const evStart = new Date(event.start_time || event.start);
      return evStart >= start && evStart < end;
    });
    let totalFunHours = 0, totalWorkHours = 0, totalOtherHours = 0;
    monthEvents.forEach(ev => {
      const hrs = (new Date(ev.end_time||ev.end) - new Date(ev.start_time||ev.start)) / 3_600_000;
      if (ev.eventType === 'fun')  totalFunHours += hrs;
      else if (ev.eventType === 'work') totalWorkHours += hrs;
      else if (ev.eventType === 'other') totalOtherHours += hrs;
    });
    // Show one total that honours the filters
    const selectedTotal =
      (showFun ? totalFunHours : 0) +
      (showWork  ? totalWorkHours  : 0) +
      (showOther ? totalOtherHours : 0);
    summaryBar.textContent = `Total event time: ${Math.round(selectedTotal)}h`;
    // (Optional) If you want to keep the per-type breakdown, append below:
    // let html = 'Total event time:';
    // if (showFun) html += ` ${Math.round(totalFunHours)}h`;
    // if (showWork)  html += ` ${Math.round(totalWorkHours)}h`;
    // if (showOther) html += ` ${Math.round(totalOtherHours)}h`;
    // summaryBar.innerHTML = html;
  }

  window.renderMonthSummary = renderMonthSummary;

  // Enhance month view day cells after render
  function enhanceMonthCells() {
    if (calendar.view.type !== 'dayGridMonth') return;
    // Wait for cells to be in DOM
    setTimeout(() => {
      document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        // Remove any previously rendered 'other-badge' elements
        cell.querySelectorAll('.other-badge').forEach(b => b.remove());
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;
        const date = new Date(dateStr);
        const dayEvents = getFilteredEvents(allLoadedEvents).filter(ev => {
          const evDate = new Date(ev.start_time || ev.start);
          return evDate.toDateString() === date.toDateString();
        });
        // Group events by type
        const grouped = dayEvents.reduce((acc, ev) => {
          const type = ev.eventType || 'other';
          if (!acc[type]) acc[type] = [];
          acc[type].push(ev);
          return acc;
        }, {});
        // Add fun indicator dot
        if (grouped.fun && showFun) {
          let dot = cell.querySelector('.fun-dot');
          if (!dot) {
            dot = document.createElement('div');
            dot.className = 'fun-dot';
            dot.style.position = 'absolute';
            dot.style.bottom = '2px';
            dot.style.right = '2px';
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = '#e91e63';
            dot.title = 'Fun activity scheduled';
            cell.appendChild(dot);
          }
        }
        // Limit events shown (excluding other)
        const maxEventsToShow = 3;
        const eventsToShow = dayEvents.filter(e => e.eventType !== 'other').slice(0, maxEventsToShow);
        // Remove old event previews
        cell.querySelectorAll('.month-event-preview').forEach(e => e.remove());
        eventsToShow.forEach(ev => {
          const preview = document.createElement('div');
          preview.className = 'month-event-preview';
          preview.style.fontSize = '11px';
          preview.style.padding = '1px 4px';
          preview.style.marginBottom = '1px';
          preview.style.backgroundColor = ev.color || '#e3f2fd';
          preview.style.borderRadius = '2px';
          preview.style.overflow = 'hidden';
          preview.style.textOverflow = 'ellipsis';
          preview.style.whiteSpace = 'nowrap';
          preview.style.cursor = 'pointer';
          preview.textContent = ev.title;
          preview.onclick = () => {
            // Open event modal for this event
            ui.openEventModal({
              event_id: ev.event_id || ev.id,
              title: ev.title,
              description: ev.description,
              location: ev.location,
              start_time: (ev.start_time || ev.start).slice(0,16),
              duration_minutes: Math.round((new Date(ev.end_time || ev.end) - new Date(ev.start_time || ev.start)) / 60000),
              eventType: ev.eventType
            });
          };
          cell.appendChild(preview);
        });
        // Add '+N more' indicator
        if (dayEvents.filter(e => e.eventType !== 'other').length > maxEventsToShow) {
          let more = cell.querySelector('.month-more-indicator');
          if (!more) {
            more = document.createElement('div');
            more.className = 'month-more-indicator';
            more.style.fontSize = '10px';
            more.style.color = '#666';
            more.style.textAlign = 'center';
            more.textContent = `+${dayEvents.length - maxEventsToShow} more`;
            cell.appendChild(more);
          }
        }
      });
    }, 100);
  }

  window.enhanceMonthCells = enhanceMonthCells;

  // Event conflict detection and validation
  function checkEventConflicts(newEvent, existingEvents) {
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

  function validateEventBeforeSave(event) {
    const conflicts = checkEventConflicts(event, allLoadedEvents);
    // Special rules for fun events
    if (event.eventType === 'fun') {
      const funConflicts = conflicts.filter(c => c.eventType === 'fun');
      if (funConflicts.length > 0) {
        alert('Fun activities cannot overlap. Please adjust the time.');
        return false;
      }
      // Warn about work conflicts
      const workConflicts = conflicts.filter(c => !c.eventType || c.eventType === 'work');
      if (workConflicts.length > 0) {
        const confirmMsg =
          'This fun activity conflicts with work events. The work events will be hidden when viewing fun activities. Continue?';
        if (!window.confirm(confirmMsg)) return false;
      }
    }
    // For work events, warn about fun conflicts
    if (!event.eventType || event.eventType === 'work') {
      const funConflicts = conflicts.filter(c => c.eventType === 'fun');
      if (funConflicts.length > 0) {
        const confirmMsg =
          'This event conflicts with scheduled fun time. Are you planning to work during fun hours?';
        if (!window.confirm(confirmMsg)) return false;
      }
    }
    return true;
  }

  // Patch FullCalendar render to inject checkboxes and summary
  setTimeout(() => {
    injectCheckboxes();
    renderMonthSummary();
    enhanceMonthCells();
  }, 300); // Wait for FC to render

  // Listen for view changes to update summary and cells
  calendar.on('datesSet', () => {
    renderMonthSummary();
    enhanceMonthCells();
  });

  // cache checkbox nodes  (they already exist in the page)
  const filterBoxes = {
    fun: document.getElementById('show-fun'),
    work : document.getElementById('show-work'),
    other: document.getElementById('show-other'),
  };

  // element that shows "Total event time:"
  const totalLabel = document.getElementById('month-summary-bar');

  // helper: compute & paint total hours for *visible* types
  function refreshTotalHours () {
    // 1 ) which event types are ON?
    const visibleTypes = Object.entries(filterBoxes)
      .filter(([,box]) => box && box.checked)
      .map(([type]) => type);

    // 2 ) walk through *all* events currently in the view
    const hours = calendar.getEvents()
      .filter(ev =>
        !ev.extendedProps.isPlaceholder &&           // skip generated rows
        visibleTypes.includes(ev.extendedProps.eventType)
      )
      .reduce((acc, ev) => acc + (ev.end - ev.start), 0)   // ms
      / (1000 * 60 * 60);                                 // → hours

    if (totalLabel) {
      totalLabel.textContent = `${Math.round(hours)} h`;
    }
  }

  // recalc any time FullCalendar finishes (re)rendering its event set
  calendar.on('eventsSet', refreshTotalHours);
  calendar.on('datesSet',  refreshTotalHours);    // month ⇆ week ⇆ day

  // recalc when the user toggles a filter
  Object.values(filterBoxes).forEach(box =>
    box && box.addEventListener('change', refreshTotalHours)
  );

  // run once at startup
  refreshTotalHours();
});

let loadEventsTimeout;
async function loadEvents(calendar, userId) {
  try {
    const uid = userId || window.currentUserId || 'default_user';
    console.log('=== LOADING EVENTS ===');
    console.log('User ID:', uid);

    const response = await api.get(`/calendar/events?user_id=${encodeURIComponent(uid)}`);
    const events = response.data || response || [];

    console.log('Raw events from API:', events);
    console.log('Number of events:', events.length);

    // Store events globally
    allLoadedEvents = events;

    // Clear calendar first
    calendar.removeAllEvents();

    // Small delay to ensure UI is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Filter and render events
    if (window.filterAndRenderEvents) {
      window.filterAndRenderEvents();
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

// Helper to create default fun events for current month
function initializeDefaultFunEvents() {
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

// Helper to format datetime for datetime-local input without timezone conversion
function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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