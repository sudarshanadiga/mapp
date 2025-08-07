// static/js/api/client.js - API Communication

/**
 * Fetch CSRF token from the server
 */
async function fetchCSRFToken() {
    try {
        const response = await fetch('/travel/api/csrf-token', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch CSRF token: ${response.status}`);
        }
        
        const data = await response.json();
        return data.csrf_token;
    } catch (error) {
        console.error('CSRF token fetch error:', error);
        return null;
    }
}

/**
 * Fetch itinerary from Flask backend
 */
async function fetchItinerary(city = "Paris", days = 3) {
    const { debugLog, errorLog } = window.TravelHelpers;
    const { API_ENDPOINTS } = window.TravelConstants;
    
    debugLog(`Fetching itinerary for ${city}, ${days} days...`);
    
    try {
        // Get CSRF token first
        const csrfToken = await fetchCSRFToken();
        debugLog("CSRF token obtained:", csrfToken ? "Yes" : "No");
        
        const endpoint = API_ENDPOINTS.ITINERARY;
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        
        // Add CSRF token to headers if available
        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }
        
        const fetchOptions = {
            method: "POST",
            headers: headers,
            credentials: "include", // Important for CSRF
            body: JSON.stringify({ city, days })
        };

        debugLog("Fetch options:", fetchOptions);

        const response = await fetch(endpoint, fetchOptions);
        
        debugLog("API response status:", response.status);
        
        // Get response text for debugging
        const responseText = await response.text();
        debugLog("Raw response:", responseText);
        
        if (!response.ok) {
            // Try to parse error details
            let errorDetail = `Server error: ${response.status}`;
            try {
                const errorData = JSON.parse(responseText);
                errorDetail = errorData.error || errorData.detail || errorDetail;
            } catch (e) {
                // If not JSON, use the text
                errorDetail = responseText || errorDetail;
            }
            throw new Error(errorDetail);
        }
        
        // Parse successful response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            errorLog("Failed to parse response as JSON:", responseText);
            throw new Error("Invalid response format from server");
        }
        
        debugLog("API response data:", data);
        
        if (!data.days || !Array.isArray(data.days)) {
            errorLog("Invalid data structure:", data);
            throw new Error("Invalid itinerary data received from server");
        }
        
        if (data.days.length === 0) {
            throw new Error("No itinerary data returned");
        }
        
        return data;
    } catch (error) {
        errorLog("Fetch error details:", error);
        // Re-throw with more context
        throw new Error(`API Error: ${error.message}`);
    }
}

// Export for other modules
window.TravelAPI = {
    fetchItinerary,
    fetchCSRFToken
};