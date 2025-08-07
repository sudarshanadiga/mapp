// Sleep toggle state
let earlyCollapsed = true;
let lateCollapsed = true;

export function initializeSleepToggles(calendar) {
  console.log('Initializing sleep toggles for calendar:', calendar);
  
  // Hook into FullCalendar's lifecycle
  calendar.on('viewDidMount', () => {
    console.log('View mounted, applying sleep states');
    setTimeout(() => {
      applySleepStates(calendar);
      renderSleepToggles(calendar);
    }, 100);
  });

  // Also listen for view changes
  calendar.on('datesSet', () => {
    console.log('Dates set, rendering sleep toggles');
    setTimeout(() => {
      renderSleepToggles(calendar);
    }, 100);
  });

  // Initial setup after calendar is fully rendered
  setTimeout(() => {
    console.log('Initial sleep toggles setup');
    applySleepStates(calendar);
    renderSleepToggles(calendar);
  }, 500);
}

function applySleepStates(calendar) {
  if (!calendar || !calendar.view) return;

  const minTime = earlyCollapsed ? '06:00:00' : '00:00:00';
  const maxTime = lateCollapsed ? '22:00:00' : '24:00:00';

  console.log('Applying sleep states:', { earlyCollapsed, lateCollapsed, minTime, maxTime });
  
  calendar.setOption('slotMinTime', minTime);
  calendar.setOption('slotMaxTime', maxTime);
}

// Helper function to create toggle bars as table rows
function makeToggleRow(text, className, onClick) {
  const row = document.createElement('tr');
  row.className = `sleep-toggle-row ${className}`;
  
  // Create a cell that spans all columns
  const cell = document.createElement('td');
  cell.colSpan = 1000; // Large number to span all columns
  cell.className = 'sleep-toggle-cell';
  
  const div = document.createElement('div');
  div.className = 'sleep-toggle-bar';
  div.textContent = text;
  div.onclick = onClick;
  
  cell.appendChild(div);
  row.appendChild(cell);
  
  return row;
}

function renderSleepToggles(calendar) {
  if (!calendar || !calendar.view) {
    console.warn('Calendar or view not available for sleep toggles');
    return;
  }

  console.log('Rendering sleep toggles for view type:', calendar.view.type);

  // Only run for Week or Day views
  const isTimeGrid = calendar.view.type.startsWith('timeGrid');
  if (!isTimeGrid) {
    console.log('Not a time grid view, cleaning up toggles');
    // Clean up toggles if we switch to a non-timegrid view
    const existingEarly = document.querySelector('.sleep-toggle-row.early-sleep-toggle-row');
    const existingLate = document.querySelector('.sleep-toggle-row.late-sleep-toggle-row');
    if (existingEarly) existingEarly.remove();
    if (existingLate) existingLate.remove();
    return;
  }

  // Wait for calendar to be fully rendered
  setTimeout(() => {
    // Find the time grid body table
    const timeGridBody = document.querySelector('.fc-timegrid-body');
    if (!timeGridBody) {
      console.warn('Could not find time grid body');
      return;
    }

    console.log('Found time grid body:', timeGridBody);

    // Find the table element within the time grid body
    const table = timeGridBody.querySelector('table');
    if (!table) {
      console.warn('Could not find table within time grid body');
      return;
    }

    // Find the tbody element
    const tbody = table.querySelector('tbody');
    if (!tbody) {
      console.warn('Could not find tbody within table');
      return;
    }

    console.log('Found table and tbody:', { table, tbody });

    // Remove existing toggles first
    const existingEarly = tbody.querySelector('.sleep-toggle-row.early-sleep-toggle-row');
    const existingLate = tbody.querySelector('.sleep-toggle-row.late-sleep-toggle-row');
    if (existingEarly) existingEarly.remove();
    if (existingLate) existingLate.remove();

    // --- Early Sleep Toggle (inserted before 6 AM row) ---
    const earlyToggle = makeToggleRow(
      earlyCollapsed ? '＋ 12 AM – 6 AM' : '－ Hide Early Hours',
      'early-sleep-toggle-row',
      () => {
        earlyCollapsed = !earlyCollapsed;
        applySleepStates(calendar);
        renderSleepToggles(calendar);
      }
    );

    // --- Late Sleep Toggle (inserted after 9 PM row) ---
    const lateToggle = makeToggleRow(
      lateCollapsed ? '＋ 10 PM – 12 AM' : '－ Hide Late Hours',
      'late-sleep-toggle-row',
      () => {
        lateCollapsed = !lateCollapsed;
        applySleepStates(calendar);
        renderSleepToggles(calendar);
      }
    );

    // Find the first and last visible time slots
    const timeSlots = tbody.querySelectorAll('tr:not(.sleep-toggle-row)');
    let firstVisibleSlot = null;
    let lastVisibleSlot = null;

    for (let slot of timeSlots) {
      const label = slot.querySelector('.fc-timegrid-slot-label');
      if (label) {
        const timeText = label.textContent.toLowerCase();
        if (timeText.includes('6am') || timeText.includes('6:00')) {
          firstVisibleSlot = slot;
        }
        if (timeText.includes('9pm') || timeText.includes('21:00') || timeText.includes('9:00 pm')) {
          lastVisibleSlot = slot;
        }
      }
    }

    // Insert early toggle before the first visible slot (6 AM)
    if (firstVisibleSlot) {
      tbody.insertBefore(earlyToggle, firstVisibleSlot);
      console.log('Early toggle inserted before 6 AM slot');
    } else {
      // Fallback: insert at the beginning
      tbody.insertBefore(earlyToggle, tbody.firstChild);
      console.log('Early toggle inserted at beginning (fallback)');
    }

    // Insert late toggle after the last visible slot (9 PM)
    if (lastVisibleSlot) {
      tbody.insertBefore(lateToggle, lastVisibleSlot.nextSibling);
      console.log('Late toggle inserted after 9 PM slot');
    } else {
      // Fallback: insert at the end
      tbody.appendChild(lateToggle);
      console.log('Late toggle inserted at end (fallback)');
    }
    
    console.log('Sleep toggles rendered as table rows:', { earlyCollapsed, lateCollapsed });
  }, 200); // Increased timeout for better reliability
}