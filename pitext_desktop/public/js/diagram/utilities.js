/**
 * public/js/diagram/utilities.js
 *
 * Diagram utility functions
 * Handles Copy, Save, Export, and Zoom functionality
 */

import { state } from '../core/state.js';

export class DiagramUtilities {
  constructor() {
    this.zoomLevel = 1;
    this.minZoom = 0.5;
    this.maxZoom = 3;
    this.zoomStep = 0.25;
  }

  /**
   * Add utility buttons to diagram container
   * @param {HTMLElement} container - Diagram container
   */
  addButtons(container) {
    // Prevent duplicate buttons
    if (container.querySelector('.diagram-utils')) return;

    const utils = document.createElement('div');
    utils.className = 'diagram-utils';

    // "Save text" button: export diagram's content as .txt
    const copyBtn = this._createButton('Save text', 'copy-icon', () => {
      this.exportDiagramContent();
    });

    // "Save PNG" button: export diagram as PNG
    const saveBtn = this._createButton('Save PNG', 'save-icon', () => {
      const svg = container.querySelector('svg');
      if (svg) this.exportAsPNG(svg);
    });

    // Append buttons
    utils.appendChild(copyBtn);
    utils.appendChild(saveBtn);

    // Insert at bottom of container (so CSS absolute positioning puts it bottom right)
    container.appendChild(utils);
  }

  /**
   * Add zoom controls to diagram
   * @param {HTMLElement} container - Diagram container
   */
  addZoomControls(container) {
    // Check if controls already exist
    if (container.querySelector('.zoom-controls')) return;
    
    const controls = document.createElement('div');
    controls.className = 'zoom-controls';
    
    // Zoom out button
    const zoomOutBtn = this._createButton('-', 'zoom-out', () => {
      this.zoom(container, this.zoomLevel - this.zoomStep);
    });
    
    // Zoom level display
    const zoomDisplay = document.createElement('span');
    zoomDisplay.className = 'zoom-level';
    zoomDisplay.textContent = '100%';
    this.zoomDisplay = zoomDisplay;
    
    // Zoom in button
    const zoomInBtn = this._createButton('+', 'zoom-in', () => {
      this.zoom(container, this.zoomLevel + this.zoomStep);
    });
    
    // Reset zoom button
    const resetBtn = this._createButton('Reset', 'zoom-reset', () => {
      this.zoom(container, 1);
    });
    
    controls.appendChild(zoomOutBtn);
    controls.appendChild(zoomDisplay);
    controls.appendChild(zoomInBtn);
    controls.appendChild(resetBtn);
    
    container.appendChild(controls);
    
    // Add mouse wheel zoom
    this._addWheelZoom(container);
  }

  /**
   * Export diagram as PNG
   * @param {SVGElement} svg - SVG element
   */
  async exportAsPNG(svg) {
    if (!svg) return;
    
    try {
      const blob = await this._svgToBlob(svg, 'png');
      this._downloadBlob(blob, this._getFilename('png'));
      this._showNotification('PNG exported successfully!', 'success');
    } catch (error) {
      console.error('PNG export failed:', error);
      this._showNotification('Failed to export PNG', 'error');
    }
  }

  /** Export the raw bullet-point text we now hold in state */
  async exportDiagramContent() {
    const diagramContent = state.get('currentDiagramContent');
    if (!diagramContent) {
        this._showNotification('No diagram text available to save.', 'error');
         return;
     }

    const currentQuery = state.get('currentQuery') || 'No query found';

    // Format the content
    const contentLines = [];
    contentLines.push(`Query: "${currentQuery}"`);
    contentLines.push(`Generated: ${new Date().toLocaleString()}`);
    contentLines.push('');
    contentLines.push('--- Diagram Text ---');
    contentLines.push('');
    contentLines.push(diagramContent);

    const fileContent = contentLines.join('\n');

    try {
        await this._downloadTextFile(fileContent, this._getFilename('txt'));
        this._showNotification('Diagram text downloaded!', 'success');
    } catch (error) {
        console.error('Text export failed:', error);
        this._showNotification('Failed to download diagram text.', 'error');
    }
  }

  /**
   * Helper to download text file
   * @private
   */
  async _downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this._downloadBlob(blob, filename);
  }

  /**
   * Zoom diagram
   * @param {HTMLElement} container - Diagram container
   * @param {number} level - Zoom level
   */
  zoom(container, level) {
    level = Math.max(this.minZoom, Math.min(this.maxZoom, level));
    this.zoomLevel = level;
    
    const svg = container.querySelector('svg');
    if (!svg) return;
    
    svg.style.transform = `scale(${level})`;
    svg.style.transformOrigin = 'center';
    
    if (this.zoomDisplay) {
      this.zoomDisplay.textContent = `${Math.round(level * 100)}%`;
    }
    
    if (level !== 1) {
      container.classList.add('diagram-zoomed');
    } else {
      container.classList.remove('diagram-zoomed');
    }
  }

    /**
   * Convert SVG to blob for download
   * @private
   * @param {SVGElement} svg - SVG element
   * @param {string} format - Output format ('png' or 'webp')
   * @returns {Promise<Blob>}
   */
  async _svgToBlob(svg, format = 'png') {
    const clone = svg.cloneNode(true);
    const viewBox = (clone.getAttribute('viewBox') || '').split(' ').map(Number);
    let width, height;

    if (viewBox.length === 4) {
      [ , , width, height ] = viewBox;
    } else {
      const bbox = svg.getBBox();
      width = bbox.width;
      height = bbox.height;
      clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    const scale = 4;
    clone.setAttribute('width', width * scale);
    clone.setAttribute('height', height * scale);
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clone.insertBefore(rect, clone.firstChild);
    
    const svgString = new XMLSerializer().serializeToString(clone);
    
    // --- START OF FIX ---
    // Convert the SVG string to a robust base64 data URL to prevent canvas tainting.
    // This is more reliable than using a blob URL.
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    // --- END OF FIX ---

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          // No need to revoke a data URL, so the cleanup step is removed.
          resolve(blob);
        }, `image/${format}`, 0.95);
      };
      // Updated error message for better debugging.
      img.onerror = () => { reject(new Error('Failed to load SVG into an image element.')); };
      img.src = url;
    });
  }
  /**
   * Download blob as file
   * @private
   * @param {Blob} blob - File blob
   * @param {string} filename - File name
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  /**
   * Generate filename with timestamp
   * @private
   * @param {string} extension - File extension
   * @returns {string}
   */
  _getFilename(extension) {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `pitext-diagram-${timestamp}.${extension}`;
  }

  /**
   * Create button element
   * @private
   * @param {string} text - Button text
   * @param {string} className - CSS class
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement}
   */
  _createButton(text, className, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `diagram-btn ${className}`;
    button.onclick = onClick;
    return button;
  }

  /**
   * Add mouse wheel zoom
   * @private
   * @param {HTMLElement} container - Diagram container
   */
  _addWheelZoom(container) {
    container.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        this.zoom(container, this.zoomLevel + delta);
      }
    });
  }

  /**
   * Show notification
   * @private
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   */
  _showNotification(message, type = 'info') {
    if (window.piTextApp?.dom) {
      window.piTextApp.dom.showNotification(message, type);
      return;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}