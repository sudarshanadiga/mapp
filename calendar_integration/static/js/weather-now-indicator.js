// Weather Now Indicator
// Updates the current time indicator color based on weather conditions

class WeatherNowIndicator {
  constructor() {
    this.currentWeather = null;
    this.indicatorElement = null;
    this.updateInterval = null;
  }

  init() {
    this.findIndicator();
    this.startWeatherUpdates();
  }

  findIndicator() {
    // Look for the current time indicator
    this.indicatorElement = document.querySelector('.fc-timegrid-now-indicator-line');
    if (!this.indicatorElement) {
      // If not found, try to find it after a short delay
      setTimeout(() => this.findIndicator(), 1000);
    }
  }

  startWeatherUpdates() {
    // Update weather every 30 minutes
    this.updateInterval = setInterval(() => {
      this.updateWeatherColor();
    }, 30 * 60 * 1000);
    
    // Initial update
    this.updateWeatherColor();
  }

  async updateWeatherColor() {
    try {
      const weatherData = await this.fetchWeatherData();
      this.currentWeather = weatherData;
      this.applyWeatherColor();
    } catch (error) {
      console.warn('Failed to update weather indicator:', error);
      this.resetToDefault();
    }
  }

  async fetchWeatherData() {
    // Get location from the weather input
    const locationInput = document.getElementById('weather-location-input');
    const location = locationInput ? locationInput.value : 'Mclean, Virginia';
    
    try {
      const response = await fetch(`/calendar/weather?location=${encodeURIComponent(location)}`);
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      // Extract the weather data from the API response structure
      return data.data || data;
    } catch (error) {
      console.warn('Weather fetch error:', error);
      return null;
    }
  }

  applyWeatherColor() {
    if (!this.indicatorElement || !this.currentWeather) {
      this.resetToDefault();
      return;
    }

    const weather = this.currentWeather.forecast || this.currentWeather;
    // Get current weather from forecast data
    const currentWeather = weather.daily ? weather.daily : weather;
    
    let temp = 70; // Default temperature
    let conditions = '';
    
    if (currentWeather.temperature_2m_max) {
      temp = currentWeather.temperature_2m_max[0] || temp;
    }
    
    if (currentWeather.weathercode) {
      conditions = this.getConditionsFromCode(currentWeather.weathercode[0] || 0);
    }

    let color = this.getWeatherColor(temp, conditions);
    
    // Apply the color with a subtle opacity for softer appearance
    this.indicatorElement.style.borderColor = color;
    this.indicatorElement.style.opacity = '0.8';
    
    // Also update the arrow if it exists
    const arrowElement = document.querySelector('.fc-timegrid-now-indicator-arrow');
    if (arrowElement) {
      arrowElement.style.borderColor = color;
      arrowElement.style.opacity = '0.8';
    }
  }

  getConditionsFromCode(weatherCode) {
    const codes = {
      0: 'clear',
      1: 'clear', 2: 'cloudy', 3: 'cloudy',
      45: 'fog', 48: 'fog',
      51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
      56: 'drizzle', 57: 'drizzle',
      61: 'rain', 63: 'rain', 65: 'rain',
      66: 'rain', 67: 'rain',
      71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
      80: 'rain', 81: 'rain', 82: 'rain',
      85: 'snow', 86: 'snow',
      95: 'storm', 96: 'storm', 99: 'storm'
    };
    return codes[weatherCode] || 'clear';
  }

  getWeatherColor(temperature, conditions) {
    // Softer color palette for modern design
    const colors = {
      // Cold temperatures - soft blue tones
      cold: '#93c5fd', // Soft blue
      freezing: '#dbeafe', // Very light blue
      
      // Mild temperatures - soft green tones
      mild: '#86efac', // Soft green
      cool: '#bbf7d0', // Light green
      
      // Warm temperatures - soft orange tones
      warm: '#fed7aa', // Soft orange
      hot: '#fecaca', // Soft red
      
      // Weather conditions
      rain: '#93c5fd', // Soft blue for rain
      snow: '#dbeafe', // Very light blue for snow
      storm: '#fca5a5', // Soft red for storms
      sunny: '#fde047', // Soft yellow for sun
      cloudy: '#e5e7eb', // Soft gray for clouds
      
      // Default
      default: '#667eea' // Primary blue
    };

    // Temperature-based colors
    if (temperature <= 32) return colors.freezing;
    if (temperature <= 50) return colors.cold;
    if (temperature <= 65) return colors.cool;
    if (temperature <= 80) return colors.mild;
    if (temperature <= 90) return colors.warm;
    if (temperature > 90) return colors.hot;

    // Weather condition overrides
    if (conditions.includes('rain') || conditions.includes('drizzle')) return colors.rain;
    if (conditions.includes('snow') || conditions.includes('sleet')) return colors.snow;
    if (conditions.includes('storm') || conditions.includes('thunder')) return colors.storm;
    if (conditions.includes('sunny') || conditions.includes('clear')) return colors.sunny;
    if (conditions.includes('cloudy') || conditions.includes('overcast')) return colors.cloudy;

    return colors.default;
  }

  resetToDefault() {
    if (this.indicatorElement) {
      this.indicatorElement.style.borderColor = '';
      this.indicatorElement.style.opacity = '';
      
      const arrowElement = document.querySelector('.fc-timegrid-now-indicator-arrow');
      if (arrowElement) {
        arrowElement.style.borderColor = '';
        arrowElement.style.opacity = '';
      }
    }
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.resetToDefault();
  }
}

// Export the initialization function
export function initializeWeatherNowIndicator(calendar) {
  const weatherIndicator = new WeatherNowIndicator();
  weatherIndicator.init();
  
  // Make it available globally for debugging
  window.weatherIndicator = weatherIndicator;
  
  return weatherIndicator;
}

// Initialize when DOM is ready (fallback for direct script loading)
document.addEventListener('DOMContentLoaded', () => {
  const weatherIndicator = new WeatherNowIndicator();
  weatherIndicator.init();
  
  // Make it available globally for debugging
  window.weatherIndicator = weatherIndicator;
});