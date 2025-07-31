// public/js/app.js
/**
 * PiText Mobile - Main Application Entry Point
 * Initializes the application and coordinates all modules
 */

import { Config } from './core/config.js';
import { State } from './core/state.js';
import { API } from './core/api.js';
import { MermaidManager } from './diagram/mermaid.js';
import { DiagramGenerator } from './diagram/generator.js';
import { SelectionHandler } from './selection/handler.js';
import { DeepDive } from './selection/deepdive.js';
import { DOMHelpers } from './utils/dom.js';
import { initializeApp } from './core/init.js';
import { setupEventListeners } from './ui/events.js';


/**
 * Main application class
 */
class PiTextApp {
  constructor() {
    this.config = new Config();
    this.state = new State();
    this.api = new API(this.config);
    this.mermaid = new MermaidManager();
    this.generator = null; // Initialized after Mermaid is ready
    this.selection = null;
    this.deepDive = null;
    this.dom = new DOMHelpers();
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🚀 PiText Mobile initializing...');
    
    try {
      // Wait for Mermaid to be ready
      await this.mermaid.waitForReady();
      
      // Initialize components that depend on Mermaid
      this.generator = new DiagramGenerator(
        this.api,
        this.mermaid,
        this.state,
        this.dom
      );
      
      this.selection = new SelectionHandler(this.state, this.dom);
      
      this.deepDive = new DeepDive(
        this.api,
        this.state,
        this.dom
      );
      
      // Use init module
      initializeApp(this);
      
      // Use events module
      setupEventListeners(this);
      
      console.log('✅ PiText Mobile ready!');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showInitError();
    }
  }

  /**
   * Handle diagram generation
   */
  async handleGenerate() {
    const queryInput = document.getElementById('query');
    const generateBtn = document.getElementById('generateBtn');
    const query = queryInput?.value.trim();
    
    if (!query) {
      this.dom.showNotification('Please enter a query', 'warning');
      return;
    }
    
    // Check if already generating
    if (this.state.get('isGenerating')) {
      return;
    }
    
    try {
      // Disable the button
      generateBtn.disabled = true;
      
      // Clear any existing selection
      this.selection?.clearSelection();
      
      // Generate diagram
      await this.generator.generate(query);
      
      // Set up selection handling for the new diagram
      const resultDiv = document.getElementById('result');
      if (resultDiv) {
        this.selection.setupForContainer(resultDiv);
      }
      
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      // Re-enable button
      generateBtn.disabled = false;
    }
  }

  /**
   * Handle deep dive question
   */
  async handleAsk() {
    const questionInput = document.getElementById('deepDiveQuery');
    const askBtn = document.getElementById('askBtn');
    const question = questionInput?.value.trim();
    
    if (!question) {
      this.dom.showNotification('Please enter a question', 'warning');
      return;
    }
    
    if (!this.state.hasSelection()) {
      this.dom.showNotification('Please select something first', 'info');
      return;
    }
    
    // Check if already asking
    if (this.state.get('isAskingDeepDive')) {
      this.dom.showNotification('Already processing question', 'info');
      return;
    }
    
    try {
      // Disable controls
      if (askBtn) {
        this.dom.disableElement(askBtn, 'Asking...');
      }
      if (questionInput) {
        questionInput.disabled = true;
      }
      
      await this.deepDive.ask(question);
    } catch (error) {
      console.error('Deep dive failed:', error);
      // Error handling is done in the deep dive module
    } finally {
      // Re-enable controls
      if (askBtn) {
        this.dom.enableElement(askBtn);
      }
      if (questionInput) {
        questionInput.disabled = false;
        questionInput.focus();
      }
    }
  }

  /**
   * Show initialization error
   */
  showInitError() {
    const result = document.getElementById('result');
    if (result) {
      result.innerHTML = `
        <div class="error-message">
          <div class="error-icon">⚠️</div>
          <div class="error-text">
            Failed to initialize the application. 
            Please refresh the page to try again.
          </div>
        </div>
      `;
    }
  }
}


// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.piTextApp = new PiTextApp();
    window.piTextApp.init();
  });
} else {
  // DOM already loaded
  window.piTextApp = new PiTextApp();
  window.piTextApp.init();
}


// Export for debugging in console
window.PiTextApp = PiTextApp;