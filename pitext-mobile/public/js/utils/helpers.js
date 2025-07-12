// public/js/utils/helpers.js
/**
 * General helper functions
 * Utility functions for common operations
 */

export class Helpers {
  /**
   * Debounce function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @param {boolean} immediate - Execute immediately on first call
   * @returns {Function} Debounced function
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in ms
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Get user-friendly error message
   * @param {Error|string} error - Error object or message
   * @returns {string} User-friendly message
   */
  getErrorMessage(error) {
    // Handle API errors
    if (error && error.getUserMessage) {
      return error.getUserMessage();
    }
    
    // Handle known error types
    const errorString = error?.message || String(error);
    
    // Network errors
    if (errorString.includes('fetch')) {
      return 'Connection failed. Please check your internet.';
    }
    
    if (errorString.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Generation errors
    if (errorString.includes('diagram')) {
      return 'Failed to generate.';
    }
    
    if (errorString.includes('render')) {
      return 'Failed. Please try again.';
    }
    
    // Validation errors
    if (errorString.includes('empty') || errorString.includes('required')) {
      return 'Please provide all required information.';
    }
    
    // Generic message
    return 'Something went wrong. Please try again.';
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted size
   */
  formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format relative time
   * @param {Date|number} date - Date object or timestamp
   * @returns {string} Relative time string
   */
  formatRelativeTime(date) {
    const timestamp = date instanceof Date ? date.getTime() : date;
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  /**
   * Deep clone object
   * @param {any} obj - Object to clone
   * @returns {any} Cloned object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (obj instanceof RegExp) {
      return new RegExp(obj);
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  /**
   * Generate unique ID
   * @param {string} prefix - Optional prefix
   * @returns {string} Unique ID
   */
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  }

  /**
   * Parse query string
   * @param {string} query - Query string
   * @returns {Object} Parsed parameters
   */
  parseQueryString(query = window.location.search) {
    const params = new URLSearchParams(query);
    const result = {};
    
    for (const [key, value] of params) {
      // Handle array parameters
      if (key.endsWith('[]')) {
        const arrayKey = key.slice(0, -2);
        if (!result[arrayKey]) {
          result[arrayKey] = [];
        }
        result[arrayKey].push(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Build query string from object
   * @param {Object} params - Parameters object
   * @returns {string} Query string
   */
  buildQueryString(params) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(`${key}[]`, v));
      } else if (value !== null && value !== undefined) {
        searchParams.append(key, value);
      }
    });
    
    return searchParams.toString();
  }

  /**
   * Sanitize HTML string
   * @param {string} html - HTML string
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(html, options = {}) {
    const defaults = {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p', 'ul', 'li'],
      allowedAttributes: {
        'a': ['href', 'target', 'rel']
      }
    };
    
    const config = { ...defaults, ...options };
    
    // Create temporary element
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script tags
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove event handlers
    const elements = temp.querySelectorAll('*');
    elements.forEach(el => {
      // Remove event attributes
      for (const attr of el.attributes) {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      }
      
      // Check if tag is allowed
      if (!config.allowedTags.includes(el.tagName.toLowerCase())) {
        el.replaceWith(...el.childNodes);
      } else {
        // Remove disallowed attributes
        const allowedAttrs = config.allowedAttributes[el.tagName.toLowerCase()] || [];
        for (const attr of el.attributes) {
          if (!allowedAttrs.includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        }
      }
    });
    
    return temp.innerHTML;
  }

  /**
   * Detect mobile device
   * @returns {boolean} Is mobile device
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Detect touch device
   * @returns {boolean} Has touch support
   */
  isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  }

  /**
   * Get browser info
   * @returns {Object} Browser information
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = '';
    
    if (ua.includes('Firefox/')) {
      browser = 'Firefox';
      version = ua.match(/Firefox\/(\d+)/)[1];
    } else if (ua.includes('Chrome/')) {
      browser = 'Chrome';
      version = ua.match(/Chrome\/(\d+)/)[1];
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      browser = 'Safari';
      version = ua.match(/Version\/(\d+)/)[1];
    } else if (ua.includes('Edge/')) {
      browser = 'Edge';
      version = ua.match(/Edge\/(\d+)/)[1];
    }
    
    return {
      browser,
      version,
      userAgent: ua,
      platform: navigator.platform,
      language: navigator.language
    };
  }

  /**
   * Copy text to clipboard with fallback
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(text) {
    // Try modern API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Clipboard API failed:', err);
      }
    }
    
    // Fallback method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      document.body.removeChild(textArea);
      return false;
    }
  }

  /**
   * Download data as file
   * @param {string|Blob} data - Data to download
   * @param {string} filename - File name
   * @param {string} type - MIME type
   */
  downloadFile(data, filename, type = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  /**
   * Load external script
   * @param {string} src - Script URL
   * @param {Object} options - Load options
   * @returns {Promise} Resolves when loaded
   */
  loadScript(src, options = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      
      if (options.async !== false) {
        script.async = true;
      }
      
      if (options.defer) {
        script.defer = true;
      }
      
      if (options.crossOrigin) {
        script.crossOrigin = options.crossOrigin;
      }
      
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }

  /**
   * Retry async operation
   * @param {Function} operation - Async operation
   * @param {number} maxAttempts - Maximum attempts
   * @param {number} delay - Delay between attempts
   * @returns {Promise} Operation result
   */
  async retry(operation, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          console.warn(`Attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Wait for condition to be true
   * @param {Function} condition - Condition function
   * @param {number} timeout - Timeout in ms
   * @param {number} interval - Check interval in ms
   * @returns {Promise} Resolves when condition is true
   */
  waitFor(condition, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, interval);
        }
      };
      
      check();
    });
  }
}

// Export singleton instance
export const helpers = new Helpers();
