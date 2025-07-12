// static/js/app.js - Main Application Entry Point

// Store trip data globally
let tripData = null;

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
    const { debugLog } = window.TravelHelpers;
    debugLog("DOM loaded, setting up travel planner...");
    
    // Initialize UI components
    window.TravelPanel.initializePanel();
    window.TravelForm.initializeForm();
    
    // Start loading Google Maps API
    loadGoogleMapsAPI();
});

/**
 * Load Google Maps API dynamically
 */
async function loadGoogleMapsAPI() {
    const { debugLog } = window.TravelHelpers;
    const { showError } = window.TravelOverlays;
    const { loadGoogleMapsConfig, createMapsScriptUrl, loadGoogleMapsScript } = window.TravelConfig;
    
    try {
        // Load configuration
        const config = await loadGoogleMapsConfig();
        
        // Create script URL
        const scriptUrl = createMapsScriptUrl(config);
        
        // Load the script
        await loadGoogleMapsScript(scriptUrl);
        
    } catch (error) {
        showError(`Failed to load Google Maps: ${error.message}`);
    }
}

/**
 * Initialize when Google Maps API is loaded (callback function)
 */
window.initializeApp = function() {
    const { debugLog } = window.TravelHelpers;
    const { initializeGoogleMap } = window.TravelGoogleMaps;
    
    debugLog('Google Maps API loaded successfully');
    
    try {
        initializeGoogleMap();
        
        // Load map modules after Google Maps is initialized
        if (window.loadMapModules) {
            debugLog('Loading map modules...');
            window.loadMapModules();
        } else {
            debugLog('loadMapModules function not found!');
        }
        
    } catch (error) {
        const { showError } = window.TravelOverlays;
        showError(`Map initialization failed: ${error.message}`);
    }
};

/**
 * Process itinerary data
 */
async function processItinerary(city, days) {
    const { debugLog } = window.TravelHelpers;
    const { showLoading, showError, hideOverlay } = window.TravelOverlays;
    const { isMapLoaded } = window.TravelGoogleMaps;
    const { fetchItinerary } = window.TravelAPI;
    
    if (!isMapLoaded()) {
        showError("Google Maps is still loading. Please wait a moment and try again.");
        return;
    }
    
    // Show loading
    showLoading("Generating your Holi :) Day plans!");
    
    try {
        // Fetch itinerary
        const data = await fetchItinerary(city, days);
        
        // Store trip data
        tripData = data;
        
        // Render on map
        renderTripOnMap(data);
        
        // Hide loading
        hideOverlay();
        
    } catch (error) {
        showError(`Failed to load itinerary: ${error.message}`);
    }
}

/**
 * Render the complete trip on Google Maps
 */
function renderTripOnMap(data) {
    const { debugLog } = window.TravelHelpers;
    const { showError } = window.TravelOverlays;
    const { fitMapToBounds } = window.TravelGoogleMaps;

    // If modules aren't ready yet, store the data and wait
    if (!window.mapModulesReady) {
        debugLog("Map modules not ready yet, storing pending render...");
        window.pendingRender = data;
        return;
    }

    debugLog("Map modules ready, rendering trip...");

    // Modules are loaded, proceed with rendering
    const { createAllMarkers, clearAllMarkers } = window.TravelMarkers;
    const { createAllRoutes, clearAllRoutes } = window.TravelRoutes;
    const { renderDayControls, clearDayControls } = window.TravelControls;
    
    debugLog("Rendering trip on Google Maps...", data);
    
    if (!data.days || data.days.length === 0) {
        showError("No itinerary data to display");
        return;
    }
    
    // Clear existing elements
    clearMapElements();
    
    // Create markers
    const { bounds, totalStops } = createAllMarkers(data);
    
    // Create routes
    createAllRoutes(data);
    
    // Hide all days except the first one
    data.days.forEach((_, index) => {
        if (index > 0) {
            const { toggleMarkersForDay } = window.TravelMarkers;
            const { toggleRoutesForDay } = window.TravelRoutes;
            toggleMarkersForDay(index, false);
            toggleRoutesForDay(index, false);
        }
    });
            
    // Fit map to bounds
    fitMapToBounds(bounds, totalStops);
    
    // Render day controls
    renderDayControls(data.days);
    
    debugLog("Trip rendering complete!");
}
/**
 * Clear all map elements
 */
function clearMapElements() {
    const { debugLog } = window.TravelHelpers;

    if (window.TravelMarkers && window.TravelMarkers.clearAllMarkers) {
        window.TravelMarkers.clearAllMarkers();
    }
    if (window.TravelRoutes && window.TravelRoutes.clearAllRoutes) {
        window.TravelRoutes.clearAllRoutes();
    }
    if (window.TravelControls && window.TravelControls.clearDayControls) {
        window.TravelControls.clearDayControls();
    }



    const { clearAllMarkers } = window.TravelMarkers;
    const { clearAllRoutes } = window.TravelRoutes;
    const { clearDayControls } = window.TravelControls;
    
    debugLog("Clearing map elements...");
    
    clearAllMarkers();
    clearAllRoutes();
    clearDayControls();
}

// Global error handler for Google Maps script loading issues
window.addEventListener('error', function (e) {
    if (e.filename && e.filename.includes('maps.googleapis.com')) {
        const { showError } = window.TravelOverlays;
        const errMsg = e.message || (e.error && e.error.message) || 'Unknown script error';
        console.error('Google Maps script error:', errMsg, e);

        showError(`
            <strong>Google Maps JavaScript failed to load</strong><br><br>
            <code>${errMsg}</code><br><br>
            • Check internet connectivity.<br>
            • Verify the API Key / Client ID.<br>
            • Ensure your quota hasn't been exceeded.<br><br>
            See the browser console for the full stack trace.
        `);
    }
}, true);

// Export for other modules
window.TravelApp = {
    processItinerary,
    renderTripOnMap,
    clearMapElements
};