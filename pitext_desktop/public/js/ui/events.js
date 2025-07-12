// public/js/ui/events.js
/**
 * Event handler setup
 * Sets up all application event listeners
 */

import { setupKeyboardShortcuts } from './shortcuts.js';

/**
 * Set up all event listeners
 * @param {Object} app - Main app instance
 */
// In pitext-desktop/public/js/ui/events.js, update the event listeners:

export function setupEventListeners(app) {
    // Generate button
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            app.handleGenerate();
        });
    }
    
    // Ask button (for deep dive)
    const askBtn = document.getElementById('askBtn');
    if (askBtn) {
        askBtn.addEventListener('click', (e) => {
            e.preventDefault();
            app.handleAsk();
        });
    }
    
    // Enter key on query input
    const queryInput = document.getElementById('query');
    if (queryInput) {
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                app.handleGenerate();
            }
        });
    }
    
    // Enter key on deep dive input
    const deepDiveInput = document.getElementById('deepDiveQuery');
    if (deepDiveInput) {
        deepDiveInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                app.handleAsk();
            }
        });
    }

    // Example buttons
    const exampleBtns = document.querySelectorAll('.example-btn');
    if (exampleBtns.length && queryInput) {
        exampleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const queryText = btn.getAttribute('data-query');
                queryInput.value = queryText;
                queryInput.focus();
            });
        });
    }
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts(app);
}