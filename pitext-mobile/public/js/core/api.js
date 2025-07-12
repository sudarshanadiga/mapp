// public/js/core/api.js
/**
 * API client for backend communication
 * Handles all HTTP requests with retry logic and error handling
 */

export class API {
  constructor(config) {
    this.config = config;
    this.activeRequests = new Map();
  }

  /**
   * Generate a diagram from a query
   * @param {string} query - User query
   * @returns {Promise<Object>} Diagram response
   */
  async generateDiagram(query) {
    return this._request('describe', {
      method: 'POST',
      body: { query }
    });
  }

  /**
   * Get deep dive information
   * @param {Object} params - Deep dive parameters
   * @param {string} params.selectedText - Selected text from diagram
   * @param {string} params.question - User's question
   * @param {string} params.originalQuery - Original query that created the diagram
   * @returns {Promise<Object>} Deep dive response
   */
  async getDeepDive({ selectedText, question, originalQuery = '' }) {
    return this._request('deep-dive', {
      method: 'POST',
      body: {
        selected_text: selectedText,
        question: question,
        original_query: originalQuery
      }
    });
  }

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    return this._request('health', {
      method: 'GET',
      skipRetry: true
    });
  }

  /**
   * Make HTTP request with retry logic
   * @private
   * @param {string} endpoint - Endpoint name from config
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async _request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      skipRetry = false,
      signal = null
    } = options;

    const url = this.config.getApiUrl(endpoint);
    const requestKey = `${method}:${url}`;

    // Cancel any existing request to the same endpoint
    this._cancelRequest(requestKey);

    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(requestKey, abortController);

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: signal || abortController.signal
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await this._fetchWithRetry(
        url,
        requestOptions,
        skipRetry ? 0 : this.config.api.retryAttempts
      );

      // Remove from active requests
      this.activeRequests.delete(requestKey);

      return response;

    } catch (error) {
      // Remove from active requests
      this.activeRequests.delete(requestKey);

      // Enhance error with context
      error.endpoint = endpoint;
      error.method = method;
      
      throw error;
    }
  }

  /**
   * Fetch with retry logic
   * @private
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<Object>} Response data
   */
  async _fetchWithRetry(url, options, retries) {
    try {
      this.config.debug('API Request:', options.method, url);

      const response = await this._timeout(
        fetch(url, options),
        this.config.api.timeout
      );

      this.config.debug('API Response:', response.status, response.statusText);

      if (!response.ok) {
        const error = await this._parseError(response);
        throw error;
      }

      const data = await response.json();

      // Validate response structure - accept both standard and mobile backend formats
      if (!data.success && !data.message && !data.status && !data.diagram && !data.response) {
        console.warn('Non-standard API response:', data);
      }

      return data;

    } catch (error) {
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw new APIError('Request cancelled', 'cancelled', 0);
      }

      // Retry if attempts remaining
      if (retries > 0) {
        this.config.debug(`Retrying request, ${retries} attempts remaining`);
        
        await this._delay(this.config.api.retryDelay);
        
        return this._fetchWithRetry(url, options, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Parse error response
   * @private
   * @param {Response} response - Fetch response
   * @returns {Promise<APIError>} Parsed error
   */
  async _parseError(response) {
    let detail = 'Unknown error';
    let errorType = 'unknown';

    try {
      const data = await response.json();
      detail = data.detail || data.message || detail;
      errorType = data.error_type || errorType;
    } catch {
      // If JSON parsing fails, use status text
      detail = response.statusText || `HTTP ${response.status}`;
    }

    return new APIError(detail, errorType, response.status);
  }

  /**
   * Add timeout to promise
   * @private
   * @param {Promise} promise - Promise to timeout
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Promise with timeout
   */
  _timeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new APIError('Request timeout', 'timeout', 0));
        }, ms);
      })
    ]);
  }

  /**
   * Delay helper for retries
   * @private
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise} Resolves after delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel active request
   * @private
   * @param {string} requestKey - Request identifier
   */
  _cancelRequest(requestKey) {
    const controller = this.activeRequests.get(requestKey);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAll() {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Create FormData for file uploads
   * @param {Object} data - Data including files
   * @returns {FormData} Form data object
   */
  createFormData(data) {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    
    return formData;
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, type = 'unknown', status = 0) {
    super(message);
    this.name = 'APIError';
    this.type = type;
    this.status = status;
    this.timestamp = Date.now();
  }

  /**
   * Check if error is a network error
   * @returns {boolean}
   */
  isNetworkError() {
    return this.type === 'timeout' || this.status === 0;
  }

  /**
   * Check if error is a server error
   * @returns {boolean}
   */
  isServerError() {
    return this.status >= 500;
  }

  /**
   * Check if error is a client error
   * @returns {boolean}
   */
  isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Get user-friendly error message
   * @returns {string}
   */
  getUserMessage() {
    if (this.isNetworkError()) {
      return 'Connection failed. Please check your internet connection.';
    }
    
    if (this.isServerError()) {
      return 'Server error. Please try again later.';
    }
    
    if (this.status === 404) {
      return 'The requested resource was not found.';
    }
    
    if (this.status === 401) {
      return 'You are not authorized to perform this action.';
    }
    
    if (this.status === 403) {
      return 'Access denied.';
    }
    
    if (this.status === 429) {
      return 'Too many requests. Please slow down.';
    }
    
    return this.message || 'An error occurred. Please try again.';
  }
}
