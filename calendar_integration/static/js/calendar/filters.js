import { allLoadedEvents } from './events.js';

// Checkbox state (persisted in localStorage for session persistence)
// All filters default to true unless explicitly turned off
export let showFun = localStorage.getItem('showFun') !== 'false';
export let showWork = localStorage.getItem('showWork') !== 'false'; 
export let showOther = localStorage.getItem('showOther') !== 'false';

// Helper to update localStorage and state
export function setShowFun(val) { 
  showFun = val; 
  localStorage.setItem('showFun', val); 
  filterAndRenderEvents(); 
  if (window.renderMonthSummary) {
    window.renderMonthSummary(); 
  }
}

export function setShowWork(val) { 
  showWork = val; 
  localStorage.setItem('showWork', val); 
  filterAndRenderEvents(); 
  if (window.renderMonthSummary) {
    window.renderMonthSummary(); 
  }
}

export function setShowOther(val) { 
  showOther = val; 
  localStorage.setItem('showOther', val); 
  filterAndRenderEvents(); 
  if (window.renderMonthSummary) {
    window.renderMonthSummary(); 
  }
}

// Wire up existing checkboxes in the sidebar
export function wireExistingCheckboxes() {
  ['fun','work','other'].forEach(type => {
    const box = document.getElementById(`show-${type}`);
    if (!box) return;
    
    // Remove any existing listeners to avoid duplicates
    const newBox = box.cloneNode(true);
    box.parentNode.replaceChild(newBox, box);
    
    // Set initial state from localStorage
    newBox.checked = (type === 'work')
      ? showWork : (type === 'fun' ? showFun : showOther);
      
    // Hook listener
    newBox.addEventListener('change', e => {
      if (type === 'fun')  setShowFun(e.target.checked);
      if (type === 'work') setShowWork(e.target.checked);
      if (type === 'other') setShowOther(e.target.checked);
    });
  });
}

// Inject checkboxes after FullCalendar renders
export function injectCheckboxes() {
  const todayBtn = document.querySelector('.fc-today-button');
  // If the box already exists (sidebar version), just wire up the listeners
  if (document.getElementById('calendar-filters')) {
    wireExistingCheckboxes();
    return;
  }
  
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
  document.getElementById('show-work').checked = showWork;
  document.getElementById('show-other').checked = showOther;
  
  // Add listeners
  document.getElementById('show-fun').addEventListener('change', e => setShowFun(e.target.checked));
  document.getElementById('show-work').addEventListener('change', e => setShowWork(e.target.checked));
  document.getElementById('show-other').addEventListener('change', e => setShowOther(e.target.checked));
}

// Filter events based on checkboxes
export function getFilteredEvents(events) {
  return events.filter(ev => {
    // Normalize eventType - treat empty/null as "other"
    const eventType = (ev.eventType || 'other').toLowerCase();
    
    // Also check type field (for weather events, etc)
    const type = (ev.type || '').toLowerCase();
    
    // Weather events are always shown
    if (type === 'weather-warning' || eventType === 'weather') {
      return true;
    }
    
    if (eventType === "work" && showWork) return true;
    if (eventType === "fun" && showFun) return true;
    if (eventType === "other" && showOther) return true;
    
    return false; // hidden
  });
}

// Filter and render events
export function filterAndRenderEvents() {
  if (!window.calendar || typeof window.calendar.removeAllEvents !== 'function') {
    console.warn('Calendar not ready for filtering');
    return;
  }
  
  console.log('Filtering events - Work:', showWork, 'Fun:', showFun, 'Other:', showOther);
  
  window.calendar.removeAllEvents();
  const filtered = getFilteredEvents(allLoadedEvents);
  
  console.log(`Showing ${filtered.length} of ${allLoadedEvents.length} events after filtering`);
  
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
    const eventType = (ev.eventType || 'other').toLowerCase();
    
    if (eventType === 'fun') {
      backgroundColor = '#e91e63';
      textColor = '#fff';
      classNames.push('event-fun');
    } else if (eventType === 'other') {
      backgroundColor = '#e8f5e9';
      borderColor = '#4caf50';
      textColor = '#2e7d32';
      classNames.push('event-other');
    } else {
      // Work events (default)
      backgroundColor = '#e3f2fd';
      borderColor = '#2196f3';
      textColor = '#1565c0';
      classNames.push('event-work');
    }
    
    // Add event to calendar
    window.calendar.addEvent({
      id: ev.event_id || ev.id,
      title: ev.title || 'Untitled Event',
      start: startTime,
      end: endTime,
      allDay: ev.all_day || false,
      backgroundColor,
      borderColor,
      textColor,
      editable: ev.editable !== false,
      classNames,
      display: 'block',
      extendedProps: {
        description: ev.description || '',
        location: ev.location || '',
        user_id: ev.user_id,
        type: ev.type,
        eventType: ev.eventType || 'other',
        flowchart: ev.flowchart,
        created: ev.created,
        last_modified: ev.last_modified
      }
    });
  });
}

// Make filterAndRenderEvents available globally
window.filterAndRenderEvents = filterAndRenderEvents;
window.wireExistingCheckboxes = wireExistingCheckboxes;