// public/js/selection/deepdive.js
/**
 * Deep dive functionality for selected diagram elements
 * Handles Q&A interactions about selected content
 */

export class DeepDive {
  constructor(api, state, dom) {
    this.api = api;
    this.state = state;
    this.dom = dom;
    this.responseContainer = null;
    this.queryInput = null;
    this.isProcessing = false;
  }

  /**
   * Initialize deep dive UI elements
   */
  init() {
    this.responseContainer = document.getElementById('deepDiveResponse');
    this.queryInput = document.getElementById('deepDiveQuery');
    
    if (!this.responseContainer || !this.queryInput) {
      console.warn('Deep dive UI elements not found');
    }
  }

  /**
   * Ask a question about the selected content
   * @param {string} question - User's question
   * @returns {Promise<void>}
   */
  async ask(question) {
    // Validate inputs
    if (!question || !question.trim()) {
      this.dom.showNotification('Please enter a question', 'warning');
      return;
    }
    
    const selectedText = this.state.get('selectedText');
    if (!selectedText) {
      this.dom.showNotification('Please select something first', 'info');
      return;
    }
    
    // Prevent concurrent requests
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.state.setLoading('askingDeepDive', true);
    
    try {
      // Show loading state
      this._showLoading();
      
      // Make API request
      const response = await this.api.getDeepDive({
        selectedText: selectedText,
        question: question,
        originalQuery: this.state.get('currentQuery') || ''
      });
      
      // Validate response
      if (!response.success) {
        throw new Error(response.detail || 'Failed to get response');
      }
      
      // Display response
      this._displayResponse(selectedText, question, response.response);
      
      // Add to history
      this.state.addDeepDive({
        selectedText,
        question,
        response: response.response
      });
      
      // Clear input
      if (this.queryInput) {
        this.queryInput.value = '';
      }
      
    } catch (error) {
      console.error('Deep dive error:', error);
      this._showError(error);
      
    } finally {
      this.isProcessing = false;
      this.state.setLoading('askingDeepDive', false);
    }
  }

  /**
   * Display deep dive response
   * @private
   * @param {string} selectedText - Selected text
   * @param {string} question - User's question
   * @param {string} response - API response
   */
// pitext-desktop/public/js/selection/deepdive.js

  _displayResponse(selectedText, question, response) {
    if (!this.responseContainer) {
      this.responseContainer = document.getElementById('deepDiveResponse');
    }
    
    // Format the response
    const html = `
      <div class="deep-dive-content">
        <button class="close-btn" onclick="window.piTextApp.deepDive.close()">×</button>
        <div class="deep-dive-header">
          <h3>Deep Dive: ${this._escapeHtml(this._truncate(selectedText, 50))}</h3>
        </div>
        
        <div class="deep-dive-qa">
          <div class="answer">
            ${this._formatResponse(response)}
          </div>
        </div>
        
        <div class="deep-dive-actions">
          <button class="action-btn copy-btn" onclick="window.piTextApp.deepDive.copyResponse()">
            Copy Answer
          </button>
          <button class="action-btn save-btn" onclick="window.piTextApp.deepDive.saveResponse()">
            Save as TXT
          </button>
          <button class="action-btn ask-followup-btn" onclick="window.piTextApp.deepDive.focusInput()">
            Ask Follow-up
          </button>
        </div>
        
        <div class="deep-dive-history">
          <details>
            <summary>Previous questions (${this._getHistoryCount()})</summary>
            <div class="history-list">
              ${this._renderHistory()}
            </div>
          </details>
        </div>
      </div>
    `;
    
    this.responseContainer.innerHTML = html;
    this.dom.showElement(this.responseContainer);
    
    // Store current response for actions
    this.currentResponse = {
      selectedText,
      question,
      response
    };
    
    // Animate in
    this._animateIn();
  }
  /**
   * Show loading state
   * @private
   */
  _showLoading() {
    if (!this.responseContainer) return;
    
    this.responseContainer.innerHTML = `
      <div class="deep-dive-loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Diving deep...</div>
      </div>
    `;
    
    this.dom.showElement(this.responseContainer);
  }

  /**
   * Show error state
   * @private
   * @param {Error} error - Error object
   */
  _showError(error) {
    if (!this.responseContainer) return;
    
    const userMessage = error.getUserMessage 
      ? error.getUserMessage() 
      : 'Failed to get response. Please try again.';
    
    this.responseContainer.innerHTML = `
      <div class="deep-dive-error">
        <div class="error-icon">⚠️</div>
        <div class="error-message">${userMessage}</div>
        <button class="retry-btn" onclick="window.piTextApp.deepDive.retry()">
          Try Again
        </button>
      </div>
    `;
    
    this.dom.showElement(this.responseContainer);
  }

  /**
   * Format response text
   * @private
   * @param {string} response - Raw response text
   * @returns {string} Formatted HTML
   */
  _formatResponse(response) {
    // Escape HTML first
    let formatted = this._escapeHtml(response);
    
    // Convert line breaks to paragraphs
    const paragraphs = formatted.split('\n\n').filter(p => p.trim());
    formatted = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    
    // Add syntax highlighting for code blocks
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Make lists look better
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Highlight key terms from the selected text
    const terms = this._extractKeyTerms(this.state.get('selectedText'));
    terms.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      formatted = formatted.replace(regex, '<mark>$1</mark>');
    });
    
    return formatted;
  }

  /**
   * Copy current response to clipboard
   */
  async copyResponse() {
    if (!this.currentResponse) return;
    
    const text = `Q: ${this.currentResponse.question}\n\nA: ${this.currentResponse.response}`;
    
    try {
      await navigator.clipboard.writeText(text);
      this.dom.showNotification('Answer copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.dom.showNotification('Failed to copy answer', 'error');
    }
  }

  /**
   * Save current response as text file
   */
  saveResponse() {
    if (!this.currentResponse) return;
    
    const content = [
      `Deep Dive: ${this.currentResponse.selectedText}`,
      '=' .repeat(50),
      '',
      `Q: ${this.currentResponse.question}`,
      '',
      `A: ${this.currentResponse.response}`,
      '',
      '---',
      `Generated on: ${new Date().toLocaleString()}`
    ].join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-dive-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.dom.showNotification('Response saved!', 'success');
  }

  /**
   * Focus on input for follow-up question
   */
  focusInput() {
    if (this.queryInput) {
      this.queryInput.focus();
      this.queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Close deep dive panel
   */
  close() {
    if (this.responseContainer) {
      this._animateOut(() => {
        this.dom.hideElement(this.responseContainer);
        this.currentResponse = null;
      });
    }
  }

  /**
   * Retry last question
   */
  retry() {
    if (this.queryInput && this.queryInput.value) {
      this.ask(this.queryInput.value);
    }
  }

  /**
   * Get history count for current selection
   * @private
   * @returns {number}
   */
  _getHistoryCount() {
    const selectedText = this.state.get('selectedText');
    const history = this.state.get('deepDiveHistory') || [];
    
    return history.filter(item => 
      item.selectedText === selectedText
    ).length;
  }

  /**
   * Render history for current selection
   * @private
   * @returns {string} HTML
   */
  _renderHistory() {
    const selectedText = this.state.get('selectedText');
    const history = this.state.get('deepDiveHistory') || [];
    
    const relevant = history
      .filter(item => item.selectedText === selectedText)
      .slice(0, 5);
    
    if (relevant.length === 0) {
      return '<p class="no-history">No previous questions for this selection</p>';
    }
    
    return relevant.map(item => `
      <div class="history-item" onclick="window.piTextApp.deepDive.loadFromHistory('${item.question}')">
        <div class="history-question">${this._escapeHtml(item.question)}</div>
        <div class="history-time">${this._formatTime(item.timestamp)}</div>
      </div>
    `).join('');
  }

  /**
   * Load question from history
   * @param {string} question - Historical question
   */
  loadFromHistory(question) {
    if (this.queryInput) {
      this.queryInput.value = question;
      this.focusInput();
    }
  }

  /**
   * Extract key terms from text
   * @private
   * @param {string} text - Source text
   * @returns {string[]} Key terms
   */
  _extractKeyTerms(text) {
    // Simple extraction - words longer than 4 chars
    const words = text.split(/\W+/);
    return words
      .filter(w => w.length > 4)
      .map(w => w.toLowerCase())
      .filter((w, i, arr) => arr.indexOf(w) === i) // unique
      .slice(0, 5); // limit to 5 terms
  }

  /**
   * Escape HTML
   * @private
   * @param {string} text - Raw text
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Truncate text
   * @private
   * @param {string} text - Text to truncate
   * @param {number} length - Max length
   * @returns {string} Truncated text
   */
  _truncate(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  /**
   * Format timestamp
   * @private
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted time
   */
  _formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Animate panel in
   * @private
   */
  _animateIn() {
    if (!this.responseContainer) return;
    
    this.responseContainer.style.opacity = '0';
    this.responseContainer.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      this.responseContainer.style.transition = 'all 0.3s ease-out';
      this.responseContainer.style.opacity = '1';
      this.responseContainer.style.transform = 'translateY(0)';
    }, 10);
  }

  /**
   * Animate panel out
   * @private
   * @param {Function} callback - Callback after animation
   */
  _animateOut(callback) {
    if (!this.responseContainer) return;
    
    this.responseContainer.style.transition = 'all 0.2s ease-in';
    this.responseContainer.style.opacity = '0';
    this.responseContainer.style.transform = 'translateY(20px)';
    
    setTimeout(callback, 200);
  }
}
