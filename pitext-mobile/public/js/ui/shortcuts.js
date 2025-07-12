// public/js/ui/shortcuts.js
/**
 * Keyboard shortcut handlers
 * Sets up global keyboard shortcuts
 */

/**
 * Set up keyboard shortcuts
 * @param {Object} app - Main app instance
 */
export function setupKeyboardShortcuts(app) {
  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      app.handleGenerate();
    }
    
    // Escape to clear selection
    if (e.key === 'Escape' && app.state.hasSelection()) {
      app.selection.clearSelection();
    }
  });
}