// static/js/map/controls.js
// ----------------------------
//  • Renders "Day 1 / Day 2 / …" toggle checkboxes.
//  • Each label's text colour is taken from getColourForDay(dayIndex + 1),
//    so it will match the corresponding marker & route colour.
// ----------------------------
(function() {
    if (!window.google || !window.google.maps) {
        console.error('Google Maps API not fully loaded yet for controls.js - retrying...');
        setTimeout(function() {
            const script = document.createElement('script');
            script.src = '/travel/static/js/map/controls.js';
            document.head.appendChild(script);
        }, 100);
        return;
    }

// Store current visibility state globally
window.currentDayVisibility = window.currentDayVisibility || {};

// Track which days are visible
let dayVisibility = {};

/**
 * Render day control checkboxes
 *
 * @param {Array<Object>} days
 *   Each element is { label?: string, color?: string, stops: [...] }.
 *   We will ignore `day.color` here, and instead use getColourForDay().
 */
function renderDayControls(days) {
  const { debugLog } = window.TravelHelpers;
  debugLog("Rendering day controls for", days.length, "days");

  const controls = document.getElementById("day-controls");
  if (!controls) {
    debugLog("Day controls container not found");
    return;
  }

  // Initialize visibility: restore previous state or default to Day 1 only
  dayVisibility = window.currentDayVisibility || {};
  if (Object.keys(dayVisibility).length === 0) {
    days.forEach((_, index) => {
      dayVisibility[index] = index === 0;
    });
  }
  window.currentDayVisibility = dayVisibility;

  controls.innerHTML = "";
  controls.style.display = "flex";
  controls.style.gap = "1rem";
  controls.style.alignItems = "flex-start";

  days.forEach((day, i) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "0.3rem";

    // 1) Create the <label> for Day (i+1)
    const label = document.createElement("label");

    // Instead of using day.color, grab from our shared helper:
    const colour = window.TravelGoogleMaps.getColourForDay(i + 1);

    label.style.color = colour;          // e.g. "#FFADAD" for Day 1, "#FFD6A5" for Day 2, etc.
    label.style.fontWeight = "bold";
    label.style.fontSize = "0.9rem";
    label.textContent = day.label || `Day ${i + 1}`;
    label.style.cursor = "pointer";
    label.setAttribute("for", `day-checkbox-${i}`);

    // 2) Create the checkbox itself
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `day-checkbox-${i}`;
    checkbox.checked = dayVisibility[i] !== false;  // Use restored state
    checkbox.style.cursor = "pointer";
    checkbox.style.width = "18px";
    checkbox.style.height = "18px";

    // When toggled, this will show/hide markers & routes for this day
    checkbox.onchange = () => toggleDay(i);

    // 3) Assemble & append
    wrapper.appendChild(label);
    wrapper.appendChild(checkbox);
    controls.appendChild(wrapper);
  });

  debugLog(`Created ${days.length} day control checkboxes`);
}

/**
 * Toggle visibility for a specific day
 *
 * @param {number} dayIndex
 *   Zero-based index (0 → Day 1, 1 → Day 2, etc.)
 */
function toggleDay(dayIndex) {
  const { debugLog } = window.TravelHelpers;
  const { toggleMarkersForDay } = window.TravelMarkers;
  const { toggleRoutesForDay } = window.TravelRoutes;

  debugLog(`Toggling day ${dayIndex + 1}`);

  dayVisibility[dayIndex] = !dayVisibility[dayIndex];
  
  // Save state globally
  window.currentDayVisibility = dayVisibility;

  // Update markers and routes visibility
  toggleMarkersForDay(dayIndex, dayVisibility[dayIndex]);
  toggleRoutesForDay(dayIndex, dayVisibility[dayIndex]);
}

/**
 * Get whether a given day is currently visible
 *
 * @param {number} dayIndex
 *   Zero-based index of the day
 * @returns {boolean}
 */
function isDayVisible(dayIndex) {
  return dayVisibility[dayIndex] !== false;
}

/**
 * Clear all day‐control checkboxes (for re‐rendering)
 */
function clearDayControls() {
  const controls = document.getElementById("day-controls");
  if (controls) {
    controls.innerHTML = "";
  }
  // Don't clear visibility state here - we want to preserve it
}

// Export these functions for other modules to use
window.TravelControls = {
  renderDayControls,
  toggleDay,
  isDayVisible,
  clearDayControls
};
})();