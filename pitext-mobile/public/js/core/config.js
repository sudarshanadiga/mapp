// public/js/core/config.js
/**
 * Frontend configuration management
 * Centralizes all configuration settings for the client-side application
 */

export class Config {
  constructor() {
    // API Configuration
    this.api = {
      baseUrl: '/mobile',
      endpoints: {
        describe: '/describe',
        'deep-dive': '/deep-dive',
        health: '/health'
      },
      timeout: 30000, // 30 seconds
      retryAttempts: 2,
      retryDelay: 1000 // 1 second
    };

    // Mermaid Configuration
    this.mermaid = {
      theme: 'base',
      fontFamily: 'Optima, "Optima Nova", "Linux Biolinum", "URW Classico", "Segoe UI", -apple-system, sans-serif',
      fontSize: '13px',
      startOnLoad: false,
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: false,
        wrap: true,
        useMaxWidth: true,
        nodeSpacing: 50,
        rankSpacing: 50,
        curve: 'basis'
      },
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#000000',
        lineColor: '#000000',
        arrowheadColor: '#000000',
        edgeLabelBackground: '#ffffff',
        defaultLinkColor: '#000000'
      }
    };

    // UI Configuration
    this.ui = {
      notifications: {
        duration: 3000,
        position: 'top-right'
      },
      animation: {
        duration: 200,
        easing: 'ease-out'
      },
      selection: {
        highlightColor: '#ffb300',
        highlightWidth: 5,
        textEmphasisFilter: 'drop-shadow(0 0 2px #fff6)'
      },
      diagram: {
        errorMessageDelay: 100,
        arrowFixDelay: 50,
        maxRetries: 3
      }
    };

    // Export Configuration
    this.export = {
      png: {
        scale: 4,
        backgroundColor: 'transparent',
        quality: 0.95
      },
      svg: {
        includeStyles: true,
        cleanIds: true
      },
      filename: {
        prefix: 'pitext-diagram',
        timestamp: true,
        format: 'YYYY-MM-DD-HHmmss'
      }
    };

    // Feature Flags
    this.features = {
      enableKeyboardShortcuts: true,
      enableAutoSave: false,
      enableAnalytics: false,
      debugMode: this._isDebugMode()
    };

    // Storage Configuration
    this.storage = {
      prefix: 'pitext_',
      keys: {
        recentQueries: 'recent_queries',
        preferences: 'user_preferences',
        diagramCache: 'diagram_cache'
      },
      maxRecentQueries: 10,
      cacheExpiry: 86400000 // 24 hours
    };
  }

  /**
   * Get full API endpoint URL
   * @param {string} endpoint - Endpoint name from config.api.endpoints
   * @returns {string} Full URL
   */
  getApiUrl(endpoint) {
    const path = this.api.endpoints[endpoint];
    if (!path) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    return `${this.api.baseUrl}${path}`;
  }

  /**
   * Get Mermaid initialization config
   * @returns {Object} Mermaid config object
   */
  getMermaidConfig() {
    return {
      ...this.mermaid,
      flowchart: { ...this.mermaid.flowchart },
      themeVariables: { ...this.mermaid.themeVariables }
    };
  }

  /**
   * Check if in debug mode
   * @private
   * @returns {boolean}
   */
  _isDebugMode() {
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      return true;
    }

    // Check localStorage
    if (localStorage.getItem('pitext_debug') === 'true') {
      return true;
    }

    // Check if running on localhost
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  }

  /**
   * Enable debug mode
   */
  enableDebug() {
    this.features.debugMode = true;
    localStorage.setItem('pitext_debug', 'true');
    console.log('🐛 Debug mode enabled');
  }

  /**
   * Disable debug mode
   */
  disableDebug() {
    this.features.debugMode = false;
    localStorage.removeItem('pitext_debug');
    console.log('Debug mode disabled');
  }

  /**
   * Get export filename
   * @param {string} extension - File extension
   * @returns {string} Formatted filename
   */
  getExportFilename(extension) {
    const { prefix, timestamp, format } = this.export.filename;
    let filename = prefix;
    
    if (timestamp) {
      const date = new Date();
      const formatted = format
        .replace('YYYY', date.getFullYear())
        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(date.getDate()).padStart(2, '0'))
        .replace('HH', String(date.getHours()).padStart(2, '0'))
        .replace('mm', String(date.getMinutes()).padStart(2, '0'))
        .replace('ss', String(date.getSeconds()).padStart(2, '0'));
      
      filename += `-${formatted}`;
    }
    
    return `${filename}.${extension}`;
  }

  /**
   * Log debug message if debug mode is enabled
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (this.features.debugMode) {
      console.log('[PiText Debug]', ...args);
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot-separated path (e.g., 'api.timeout')
   * @returns {any} Configuration value
   */
  get(path) {
    const keys = path.split('.');
    let value = this;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        throw new Error(`Configuration not found: ${path}`);
      }
    }
    
    return value;
  }

  /**
   * Override configuration value
   * @param {string} path - Dot-separated path
   * @param {any} value - New value
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this;
    
    for (const key of keys) {
      if (!target[key]) {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    this.debug(`Configuration updated: ${path} =`, value);
  }
}

// Export singleton instance
export const config = new Config();