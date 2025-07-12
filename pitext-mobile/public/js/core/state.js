// public/js/core/state.js
/**
 * Centralized state management for PiText Desktop
 * Manages application state with event emitters for reactivity
 */

export class State {
  constructor() {
    // Core state
    this._state = {
      // Current query and diagram
      currentQuery: '',
      currentDiagramType: null,
      currentDiagramCode: null,
      
      // Selection state
      selectedElement: null,
      selectedText: '',
      
      // UI state
      isGenerating: false,
      isAskingDeepDive: false,
      lastError: null,
      
      // History
      queryHistory: [],
      diagramHistory: [],
      
      // Deep dive
      deepDiveHistory: []
    };
    
    // Event listeners
    this._listeners = {
      'selection-changed': [],
      'query-changed': [],
      'diagram-generated': [],
      'state-changed': [],
      'error-occurred': []
    };
    
    // Initialize from storage if available
    this._loadFromStorage();
  }

  /**
   * Get state value
   * @param {string} key - State key
   * @returns {any} State value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set state value
   * @param {string} key - State key
   * @param {any} value - New value
   */
  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    
    // Emit state change event
    this._emit('state-changed', { key, value, oldValue });
    
    // Emit specific events
    switch (key) {
      case 'selectedElement':
      case 'selectedText':
        this._emit('selection-changed', {
          element: this._state.selectedElement,
          text: this._state.selectedText
        });
        break;
      case 'currentQuery':
        this._emit('query-changed', value);
        break;
    }
    
    // Save to storage
    this._saveToStorage();
  }

  /**
   * Update multiple state values
   * @param {Object} updates - Object with key-value pairs to update
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Set current query
   * @param {string} query - Query text
   */
  setQuery(query) {
    this.set('currentQuery', query);
    
    // Add to history
    if (query && !this._state.queryHistory.includes(query)) {
      this._state.queryHistory.unshift(query);
      // Keep only last 20 queries
      if (this._state.queryHistory.length > 20) {
        this._state.queryHistory.pop();
      }
    }
  }

  /**
   * Set diagram data
   * @param {Object} diagramData - Diagram information
   */
  setDiagram(diagramData) {
    const { type, code, query } = diagramData;
    
    this.update({
      currentDiagramType: type,
      currentDiagramCode: code
    });
    
    // Add to history
    this._state.diagramHistory.unshift({
      query,
      type,
      code,
      timestamp: Date.now()
    });
    
    // Keep only last 10 diagrams
    if (this._state.diagramHistory.length > 10) {
      this._state.diagramHistory.pop();
    }
    
    this._emit('diagram-generated', diagramData);
  }

  /**
   * Set selection
   * @param {HTMLElement} element - Selected element
   * @param {string} text - Selected text
   */
  setSelection(element, text) {
    this.update({
      selectedElement: element,
      selectedText: text
    });
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.update({
      selectedElement: null,
      selectedText: ''
    });
  }

  /**
   * Check if there's an active selection
   * @returns {boolean}
   */
  hasSelection() {
    return Boolean(this._state.selectedText);
  }

  /**
   * Set loading state
   * @param {string} operation - Operation name ('generating', 'askingDeepDive')
   * @param {boolean} isLoading - Loading state
   */
  setLoading(operation, isLoading) {
    switch (operation) {
      case 'generating':
        this.set('isGenerating', isLoading);
        break;
      case 'askingDeepDive':
        this.set('isAskingDeepDive', isLoading);
        break;
    }
  }

  /**
   * Set error state
   * @param {Error|string|null} error - Error object or message
   */
  setError(error) {
    const errorData = error ? {
      message: error.message || String(error),
      timestamp: Date.now(),
      stack: error.stack
    } : null;
    
    this.set('lastError', errorData);
    
    if (errorData) {
      this._emit('error-occurred', errorData);
    }
  }

  /**
   * Add deep dive to history
   * @param {Object} deepDiveData - Deep dive information
   */
  addDeepDive(deepDiveData) {
    this._state.deepDiveHistory.unshift({
      ...deepDiveData,
      timestamp: Date.now()
    });
    
    // Keep only last 20 deep dives
    if (this._state.deepDiveHistory.length > 20) {
      this._state.deepDiveHistory.pop();
    }
  }

  /**
   * Get query suggestions based on history
   * @param {string} partial - Partial query
   * @returns {string[]} Suggested queries
   */
  getQuerySuggestions(partial) {
    if (!partial) return [];
    
    const lowerPartial = partial.toLowerCase();
    return this._state.queryHistory
      .filter(q => q.toLowerCase().includes(lowerPartial))
      .slice(0, 5);
  }

  /**
   * Subscribe to state events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      throw new Error(`Unknown event: ${event}`);
    }
    
    this._listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this._listeners[event].indexOf(callback);
      if (index > -1) {
        this._listeners[event].splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   * @private
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Save state to localStorage
   * @private
   */
  _saveToStorage() {
    try {
      const toSave = {
        queryHistory: this._state.queryHistory,
        diagramHistory: this._state.diagramHistory.slice(0, 5), // Only save recent 5
        deepDiveHistory: this._state.deepDiveHistory.slice(0, 5)
      };
      
      localStorage.setItem('pitext_state', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }

  /**
   * Load state from localStorage
   * @private
   */
  _loadFromStorage() {
    try {
      const saved = localStorage.getItem('pitext_state');
      if (saved) {
        const data = JSON.parse(saved);
        Object.assign(this._state, data);
      }
    } catch (error) {
      console.warn('Failed to load state:', error);
    }
  }

  /**
   * Clear all state and storage
   */
  reset() {
    // Reset to initial state
    this._state = {
      currentQuery: '',
      currentDiagramType: null,
      currentDiagramCode: null,
      selectedElement: null,
      selectedText: '',
      isGenerating: false,
      isAskingDeepDive: false,
      lastError: null,
      queryHistory: [],
      diagramHistory: [],
      deepDiveHistory: []
    };
    
    // Clear storage
    localStorage.removeItem('pitext_state');
    
    // Emit reset event
    this._emit('state-changed', { reset: true });
  }

  /**
   * Get current state snapshot
   * @returns {Object} Copy of current state
   */
  getSnapshot() {
    return JSON.parse(JSON.stringify(this._state));
  }
}

// Export singleton instance for convenience
export const state = new State();
