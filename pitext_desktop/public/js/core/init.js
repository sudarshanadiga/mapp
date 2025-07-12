// public/js/core/init.js
/**
 * Application initialization logic
 * Sets up initial UI state
 */

import { DOMHelpers } from '../utils/dom.js';

/**
 * Initialize the application UI
 * @param {Object} app - Main app instance
 */
export function initializeApp(app) {
  setupUI(app);
}

/**
 * Set up initial UI state
 * @param {Object} app - Main app instance
 */
function setupUI(app) {
  // Get DOM elements
  const elements = app.dom.getElements({
    query: '#query',
    result: '#result',
    selectionIndicator: '#selectionIndicator',
    deepDiveResponse: '#deepDiveResponse'
  });
  
  // Focus on query input
  elements.query?.focus();
  
  // Set initial result message
  if (elements.result) {
    elements.result.innerHTML = '<div class="placeholder">Textchart will appear here.</div>';
  }
  
  // Hide selection UI initially
  app.dom.hideElement(elements.selectionIndicator);
  app.dom.hideElement(elements.deepDiveResponse);
}