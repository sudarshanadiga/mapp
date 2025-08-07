import { allLoadedEvents } from './events.js';
import { showOther, showFun, showWork, getFilteredEvents } from './filters.js';
import { ui } from '../ui.js';

// Add month summary bar above the calendar
export function renderMonthSummary() {
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
  const view = window.calendar.view;
  const start = new Date(view.currentStart);
  const end = new Date(view.currentEnd);
  const monthEvents = allLoadedEvents.filter(event => {
    const evStart = new Date(event.start_time || event.start);
    return evStart >= start && evStart < end;
  });
  let totalFunHours = 0, totalWorkHours = 0, totalOtherHours = 0;
  monthEvents.forEach(ev => {
    const hrs = (new Date(ev.end_time||ev.end) - new Date(ev.start_time||ev.start)) / 3_600_000;
    const eventType = (ev.eventType || '').toLowerCase();
    if (eventType === 'fun')  totalFunHours += hrs;
    else if (eventType === 'work') totalWorkHours += hrs;
    else if (eventType === 'other' || eventType === '') totalOtherHours += hrs;
  });
  // Show one total that honours the filters
  const selectedTotal =
    (showFun ? totalFunHours : 0) +
    (showWork  ? totalWorkHours  : 0) +
    (showOther ? totalOtherHours : 0);
  summaryBar.textContent = `Total event time: ${Math.round(selectedTotal)}h`;
}

// Enhance month view day cells after render
export function enhanceMonthCells() {
  if (window.calendar.view.type !== 'dayGridMonth') return;
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

// helper: compute & paint total hours for *visible* types
export function refreshTotalHours() {
  // cache checkbox nodes (they already exist in the page)
  const filterBoxes = {
    fun: document.getElementById('show-fun'),
    work: document.getElementById('show-work'),
    other: document.getElementById('show-other'),
  };

  // element that shows "Total event time:"
  const totalLabel = document.getElementById('month-summary-bar');

  // 1) which event types are ON?
  const visibleTypes = Object.entries(filterBoxes)
    .filter(([,box]) => box && box.checked)
    .map(([type]) => type);

  // 2) walk through *all* events currently in the view
  const hours = window.calendar.getEvents()
    .filter(ev =>
      !ev.extendedProps.isPlaceholder &&           // skip generated rows
      visibleTypes.includes(ev.extendedProps.eventType)
    )
    .reduce((acc, ev) => acc + (ev.end - ev.start), 0)   // ms
    / (1000 * 60 * 60);                                   // → hours

  if (totalLabel) {
    totalLabel.textContent = `${Math.round(hours)} h`;
  }
}