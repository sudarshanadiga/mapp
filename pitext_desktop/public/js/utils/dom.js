// public/js/utils/dom.js
/**
 * DOM manipulation utilities
 * Provides common DOM operations and UI helpers
 */

export class DOMHelpers {
  constructor() {
    this.notificationContainer = null;
    this.notificationTimeout = null;
    this._ensureNotificationContainer();
  }

  /**
   * Get multiple elements by selectors
   * @param {Object} selectors - Object with key: selector pairs
   * @returns {Object} Object with key: element pairs
   */
  getElements(selectors) {
    const elements = {};
    
    Object.entries(selectors).forEach(([key, selector]) => {
      elements[key] = document.querySelector(selector);
      
      if (!elements[key]) {
        console.warn(`Element not found: ${selector}`);
      }
    });
    
    return elements;
  }

  /**
   * Show element with optional animation
   * @param {HTMLElement} element - Element to show
   * @param {string} animation - Animation type ('fade', 'slide', 'none')
   */
  showElement(element, animation = 'fade') {
    if (!element) return;
    
    switch (animation) {
      case 'fade':
        element.style.display = 'block';
        element.style.opacity = '0';
        element.classList.add('active');
        
        // Force reflow
        element.offsetHeight;
        
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '1';
        break;
        
      case 'slide':
        element.style.display = 'block';
        element.style.transform = 'translateY(-20px)';
        element.style.opacity = '0';
        element.classList.add('active');
        
        // Force reflow
        element.offsetHeight;
        
        element.style.transition = 'all 0.3s ease-out';
        element.style.transform = 'translateY(0)';
        element.style.opacity = '1';
        break;
        
      default:
        element.style.display = 'block';
        element.classList.add('active');
    }
  }

  /**
   * Hide element with optional animation
   * @param {HTMLElement} element - Element to hide
   * @param {string} animation - Animation type ('fade', 'slide', 'none')
   */
  hideElement(element, animation = 'fade') {
    if (!element) return;
    
    const hide = () => {
      element.style.display = 'none';
      element.classList.remove('active');
    };
    
    switch (animation) {
      case 'fade':
        element.style.transition = 'opacity 0.2s ease-in';
        element.style.opacity = '0';
        setTimeout(hide, 200);
        break;
        
      case 'slide':
        element.style.transition = 'all 0.2s ease-in';
        element.style.transform = 'translateY(-20px)';
        element.style.opacity = '0';
        setTimeout(hide, 200);
        break;
        
      default:
        hide();
    }
  }

  /**
   * Toggle element visibility
   * @param {HTMLElement} element - Element to toggle
   * @param {string} animation - Animation type
   */
  toggleElement(element, animation = 'fade') {
    if (!element) return;
    
    const isVisible = element.classList.contains('active') || 
                     element.style.display !== 'none';
    
    if (isVisible) {
      this.hideElement(element, animation);
    } else {
      this.showElement(element, animation);
    }
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
   * @param {number} duration - Duration in ms (0 for persistent)
   */
  showNotification(message, type = 'info', duration = 3000) {
    this._ensureNotificationContainer();
    
    // Clear existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon
    const icon = this._getNotificationIcon(type);
    
    // Build content
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${this._escapeHtml(message)}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add to container
    this.notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    // Auto-remove if duration > 0
    if (duration > 0) {
      this.notificationTimeout = setTimeout(() => {
        this._removeNotification(notification);
      }, duration);
    }
    
    // Click to dismiss
    notification.addEventListener('click', () => {
      this._removeNotification(notification);
    });
  }

  /**
   * Clear all notifications
   */
  clearNotifications() {
    if (this.notificationContainer) {
      this.notificationContainer.innerHTML = '';
    }
  }

  /**
   * Add loading overlay to element
   * @param {HTMLElement} element - Target element
   * @param {string} message - Loading message
   */
  addLoadingOverlay(element, message = 'Loading...') {
    if (!element) return;
    
    // Remove existing overlay
    this.removeLoadingOverlay(element);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">${this._escapeHtml(message)}</div>
      </div>
    `;
    
    // Position relative to element
    element.style.position = 'relative';
    element.appendChild(overlay);
    
    // Animate in
    setTimeout(() => {
      overlay.classList.add('loading-overlay-show');
    }, 10);
  }

  /**
   * Remove loading overlay from element
   * @param {HTMLElement} element - Target element
   */
  removeLoadingOverlay(element) {
    if (!element) return;
    
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('loading-overlay-show');
      setTimeout(() => overlay.remove(), 200);
    }
  }

  /**
   * Disable element with optional message
   * @param {HTMLElement} element - Element to disable
   * @param {string} message - Optional tooltip message
   */
  disableElement(element, message) {
    if (!element) return;
    
    element.disabled = true;
    element.classList.add('disabled');
    
    if (message) {
      element.setAttribute('title', message);
      element.setAttribute('data-disabled-message', message);
    }
  }

  /**
   * Enable element
   * @param {HTMLElement} element - Element to enable
   */
  enableElement(element) {
    if (!element) return;
    
    element.disabled = false;
    element.classList.remove('disabled');
    element.removeAttribute('title');
    element.removeAttribute('data-disabled-message');
  }

  /**
   * Smooth scroll to element
   * @param {HTMLElement|string} target - Element or selector
   * @param {Object} options - Scroll options
   */
  scrollToElement(target, options = {}) {
    const element = typeof target === 'string' 
      ? document.querySelector(target) 
      : target;
    
    if (!element) return;
    
    const defaultOptions = {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    };
    
    element.scrollIntoView({ ...defaultOptions, ...options });
  }

  /**
   * Create and show tooltip
   * @param {HTMLElement} element - Target element
   * @param {string} text - Tooltip text
   * @param {string} position - Position ('top', 'bottom', 'left', 'right')
   */
  showTooltip(element, text, position = 'top') {
    if (!element) return;
    
    // Remove existing tooltip
    this.hideTooltip(element);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = `tooltip tooltip-${position}`;
    tooltip.textContent = text;
    tooltip.setAttribute('role', 'tooltip');
    
    // Position tooltip
    document.body.appendChild(tooltip);
    this._positionTooltip(tooltip, element, position);
    
    // Store reference
    element._tooltip = tooltip;
    
    // Animate in
    setTimeout(() => {
      tooltip.classList.add('tooltip-show');
    }, 10);
  }

  /**
   * Hide tooltip
   * @param {HTMLElement} element - Target element
   */
  hideTooltip(element) {
    if (!element || !element._tooltip) return;
    
    const tooltip = element._tooltip;
    tooltip.classList.remove('tooltip-show');
    
    setTimeout(() => {
      tooltip.remove();
      delete element._tooltip;
    }, 200);
  }

  /**
   * Add keyboard shortcut
   * @param {string} key - Key combination (e.g., 'ctrl+s', 'cmd+enter')
   * @param {Function} handler - Handler function
   * @param {string} description - Description for help
   */
  addKeyboardShortcut(key, handler, description) {
    // Parse key combination
    const parts = key.toLowerCase().split('+');
    const modifiers = {
      ctrl: false,
      cmd: false,
      alt: false,
      shift: false
    };
    
    let mainKey = '';
    
    parts.forEach(part => {
      if (part in modifiers) {
        modifiers[part] = true;
      } else {
        mainKey = part;
      }
    });
    
    // Add event listener
    document.addEventListener('keydown', (e) => {
      const isMatch = 
        (modifiers.ctrl === (e.ctrlKey || (modifiers.cmd && e.metaKey))) &&
        (modifiers.alt === e.altKey) &&
        (modifiers.shift === e.shiftKey) &&
        (e.key.toLowerCase() === mainKey);
      
      if (isMatch) {
        e.preventDefault();
        handler(e);
      }
    });
    
    // Store for help display
    if (!window._shortcuts) {
      window._shortcuts = [];
    }
    window._shortcuts.push({ key, description });
  }

  /**
   * Ensure notification container exists
   * @private
   */
  _ensureNotificationContainer() {
    if (!this.notificationContainer) {
      this.notificationContainer = document.getElementById('notifications');
      
      if (!this.notificationContainer) {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'notifications';
        this.notificationContainer.className = 'notification-container';
        document.body.appendChild(this.notificationContainer);
      }
    }
  }

  /**
   * Remove notification with animation
   * @private
   * @param {HTMLElement} notification - Notification element
   */
  _removeNotification(notification) {
    notification.classList.remove('notification-show');
    setTimeout(() => notification.remove(), 200);
  }

  /**
   * Get notification icon
   * @private
   * @param {string} type - Notification type
   * @returns {string} Icon HTML
   */
  _getNotificationIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    return icons[type] || icons.info;
  }

  /**
   * Position tooltip relative to element
   * @private
   * @param {HTMLElement} tooltip - Tooltip element
   * @param {HTMLElement} target - Target element
   * @param {string} position - Position
   */
  _positionTooltip(tooltip, target, position) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
        
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
        
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - gap;
        break;
        
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + gap;
        break;
    }
    
    // Ensure tooltip stays within viewport
    top = Math.max(gap, Math.min(top, window.innerHeight - tooltipRect.height - gap));
    left = Math.max(gap, Math.min(left, window.innerWidth - tooltipRect.width - gap));
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
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
   * Add CSS styles dynamically
   * @param {string} id - Style ID
   * @param {string} css - CSS content
   */
  addStyles(id, css) {
    // Check if styles already exist
    if (document.getElementById(id)) return;
    
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
}
