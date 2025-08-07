/**
 * Weather functionality for calendar integration.
 * Handles location input, weather data fetching, and weather event display.
 */

import { api } from './api.js';

// Weather state
let currentLocation = localStorage.getItem('weatherLocation') || 'New York';
let weatherEvents = [];

/**
 * Initialize weather functionality
 */
export function initializeWeather() {
    console.log('Initializing weather functionality');
    
    // Load initial weather data
    loadWeatherData();
    
    // Set up weather event rendering
    setupWeatherEventRendering();
}
    
    locationContainer.appendChild(locationLabel);
    locationContainer.appendChild(locationInput);
    locationContainer.appendChild(updateButton);
    
    // Append to header
    header.appendChild(locationContainer);
    
    // Add event listeners
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateWeatherLocation();
        }
    });
    
    updateButton.addEventListener('click', updateWeatherLocation);
}

/**
 * Update weather location
 */
async function updateWeatherLocation() {
    const locationInput = document.getElementById('weather-location-input');
    if (!locationInput) return;
    
    const newLocation = locationInput.value.trim();
    if (!newLocation) return;
    
    try {
        console.log(`Updating weather location to: ${newLocation}`);
        
        const response = await api.post('/calendar/weather/location', { location: newLocation });
        
        if (response) {
            currentLocation = newLocation;
            localStorage.setItem('weatherLocation', newLocation);
            
            // Reload weather data
            await loadWeatherData();
            
            // Update now indicator for new location
            if (window.updateNowIndicatorForLocation) {
                window.updateNowIndicatorForLocation(newLocation);
            }
            
            // Show success message
            showWeatherNotification('Location updated successfully!', 'success');
        } else {
            throw new Error('Failed to update location');
        }
        
    } catch (error) {
        console.error('Error updating weather location:', error);
        showWeatherNotification('Failed to update location', 'error');
    }
}

/**
 * Load weather data from the API
 */
async function loadWeatherData() {
    try {
        console.log('Loading weather data...');
        
        const response = await api.get(`/calendar/weather?location=${encodeURIComponent(currentLocation)}`);
        
        if (response) {
            weatherEvents = response.weather_events || [];
            console.log(`Loaded ${weatherEvents.length} weather events`);
            
            // Update calendar with weather events
            updateCalendarWithWeatherEvents();
        }
        
    } catch (error) {
        console.error('Error loading weather data:', error);
        showWeatherNotification('Failed to load weather data', 'error');
    }
}

/**
 * Update calendar with weather events
 */
function updateCalendarWithWeatherEvents() {
    if (!window.calendar) {
        console.warn('Calendar not available for weather events');
        return;
    }
    
    // Remove existing weather events
    const existingEvents = window.calendar.getEvents();
    existingEvents.forEach(event => {
        if (event.extendedProps.type === 'weather-warning') {
            event.remove();
        }
    });
    
    // Add new weather events as all-day events
    weatherEvents.forEach(event => {
        try {
            window.calendar.addEvent({
                id: event.event_id || `weather-${Date.now()}-${Math.random()}`,
                title: event.title,
                start: event.start_time,
                end: event.end_time,
                allDay: true,  // This ensures it goes to all-day section
                backgroundColor: '#ffb3b3',
                borderColor: '#ff8080',
                textColor: '#d00000',
                editable: false,
                classNames: ['fc-event-weather'],
                extendedProps: {
                    type: 'weather-warning',
                    eventType: 'weather',
                    details: event.details || {},
                    location: currentLocation
                }
            });
        } catch (error) {
            console.error('Error adding weather event:', error);
        }
    });
    
    console.log(`Added ${weatherEvents.length} weather events to calendar`);
}

/**
 * Setup weather event rendering
 */
function setupWeatherEventRendering() {
    // Re-render weather events when calendar view changes
    if (window.calendar) {
        window.calendar.setOption('datesSet', function() {
            setTimeout(() => {
                updateCalendarWithWeatherEvents();
            }, 100);
        });
    }
}

/**
 * Show weather notification
 */
function showWeatherNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Get current weather location
 */
export function getCurrentLocation() {
    return currentLocation;
}

/**
 * Get weather events
 */
export function getWeatherEvents() {
    return weatherEvents;
}

/**
 * Refresh weather data manually
 */
export async function refreshWeatherData() {
    try {
        console.log('Manually refreshing weather data...');
        
        const response = await api.post('/calendar/weather/refresh');
        
        if (response) {
            await loadWeatherData();
            showWeatherNotification('Weather data refreshed!', 'success');
        } else {
            throw new Error('Failed to refresh weather data');
        }
        
    } catch (error) {
        console.error('Error refreshing weather data:', error);
        showWeatherNotification('Failed to refresh weather data', 'error');
    }
} 