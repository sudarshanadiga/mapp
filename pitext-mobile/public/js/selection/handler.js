// public/js/selection/handler.js
/**
 * Selection handler for diagram elements
 * Manages selection of nodes, edges, and text in Mermaid diagrams
 */

export class SelectionHandler {
  constructor(state, dom) {
    this.state = state;
    this.dom = dom;
    this.selectedClass = 'element-selected';
    this.currentContainer = null;
  }

  /**
   * Set up selection handling for a container
   * @param {HTMLElement} container - Diagram container
   */
  setupForContainer(container) {
    this.currentContainer = container;
    const svg = container.querySelector('svg');
    
    if (!svg) {
      console.warn('No SVG found in container');
      return;
    }
    
    // Clear any existing selection
    this.clearSelection();
    
    // Set up different selection types based on diagram type
    const diagramType = this._detectDiagramType(svg);
    
    switch (diagramType) {
      case 'flowchart':
      case 'graph':
        this._setupFlowchartSelection(svg);
        break;
      case 'sequence':
        this._setupSequenceSelection(svg);
        break;
      default:
        this._setupGenericSelection(svg);
    }
    
    // Set up canvas click to deselect
    this._setupCanvasDeselect(svg);
  }

  /**
   * Clear current selection
   */
  clearSelection() {
    // Remove visual selection
    if (this.state.get('selectedElement')) {
      this._removeSelectionStyling(this.state.get('selectedElement'));
    }
    
    // Clear state
    this.state.clearSelection();
    
    // Hide selection UI
    const indicator = document.getElementById('selectionIndicator');
    if (indicator) {
      this.dom.hideElement(indicator);
    }
    
    // Clear deep dive response
    const response = document.getElementById('deepDiveResponse');
    if (response) {
      this.dom.hideElement(response);
    }
  }

  /**
   * Handle element selection
   * @param {Element} element - Selected element
   * @param {string} text - Selected text
   */
  selectElement(element, text) {
    // Clear previous selection
    if (this.state.get('selectedElement')) {
      this._removeSelectionStyling(this.state.get('selectedElement'));
    }
    
    // Apply selection styling
    this._applySelectionStyling(element);
    
    // Update state
    this.state.setSelection(element, text);
    
    // Show selection UI
    this._showSelectionUI(text);
  }

  /**
   * Set up flowchart/graph selection
   * @private
   * @param {SVGElement} svg - SVG element
   */
  _setupFlowchartSelection(svg) {
    // Nodes
    const nodes = svg.querySelectorAll('g.node, .node');
    nodes.forEach(node => {
      node.style.cursor = 'pointer';
      
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = this._extractNodeText(node);
        if (text) {
          this.selectElement(node, text);
        }
      });
    });
    
    // Edge labels
    const edgeLabels = svg.querySelectorAll('.edgeLabel, g.edgeLabel');
    edgeLabels.forEach(label => {
      label.style.cursor = 'pointer';
      
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = this._extractEdgeText(label);
        if (text) {
          this.selectElement(label, text);
        }
      });
    });
  }

  /**
   * Set up sequence diagram selection
   * @private
   * @param {SVGElement} svg - SVG element
   */
  _setupSequenceSelection(svg) {
    // Participants/actors
    const actors = svg.querySelectorAll('g.actor, .actor');
    actors.forEach(actor => {
      const text = actor.querySelector('text');
      if (text) {
        text.style.cursor = 'pointer';
        text.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectElement(text, text.textContent.trim());
        });
      }
    });
    
    // Notes and messages
    const notes = svg.querySelectorAll('g.note, .note');
    notes.forEach(note => {
      note.style.cursor = 'pointer';
      
      note.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = this._extractNoteText(note);
        if (text) {
          this.selectElement(note, text);
        }
      });
    });
    
    // Numbered lines in notes
    const tspans = svg.querySelectorAll('tspan');
    tspans.forEach(tspan => {
      const text = (tspan.textContent || '').trim();
      if (/^\d+[\.\)]\s/.test(text)) {
        tspan.style.cursor = 'pointer';
        tspan.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectElement(tspan, text);
        });
      }
    });
    
    // Background rectangles for blocks
    const rects = svg.querySelectorAll('rect');
    rects.forEach(rect => {
      if (this._isSelectableRect(rect)) {
        rect.style.cursor = 'pointer';
        rect.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = this._extractBlockText(rect, svg);
          if (text) {
            this.selectElement(rect, text);
          }
        });
      }
    });
  }

  /**
   * Set up generic selection for other diagram types
   * @private
   * @param {SVGElement} svg - SVG element
   */
  _setupGenericSelection(svg) {
    // Any text element
    const texts = svg.querySelectorAll('text');
    texts.forEach(text => {
      if (text.textContent.trim()) {
        text.style.cursor = 'pointer';
        text.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectElement(text, text.textContent.trim());
        });
      }
    });
    
    // Any labeled group
    const groups = svg.querySelectorAll('g[id]');
    groups.forEach(group => {
      const text = group.querySelector('text');
      if (text && text.textContent.trim()) {
        group.style.cursor = 'pointer';
        group.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectElement(group, text.textContent.trim());
        });
      }
    });
  }

  /**
   * Set up canvas deselection
   * @private
   * @param {SVGElement} svg - SVG element
   */
  _setupCanvasDeselect(svg) {
    svg.addEventListener('click', (e) => {
      // Only deselect if clicked on SVG background
      if (e.target === svg || e.target.classList.contains('background')) {
        this.clearSelection();
      }
    });
  }

  /**
   * Apply selection styling to element
   * @private
   * @param {Element} element - Element to style
   */
  _applySelectionStyling(element) {
    element.classList.add(this.selectedClass);
    
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'text':
      case 'tspan':
        element.style.fontWeight = 'bold';
        element.style.filter = 'drop-shadow(0 0 4px #ffb300)';
        break;
        
      case 'rect':
        element.setAttribute('data-original-stroke', element.getAttribute('stroke') || '');
        element.setAttribute('data-original-stroke-width', element.getAttribute('stroke-width') || '');
        element.setAttribute('stroke', '#ffb300');
        element.setAttribute('stroke-width', '5');
        element.style.filter = 'drop-shadow(0 0 6px #ffb300)';
        break;
        
      case 'g':
        // For groups, highlight the shape inside
        const shape = element.querySelector('rect, circle, ellipse, polygon');
        if (shape) {
          shape.setAttribute('data-original-stroke', shape.getAttribute('stroke') || '');
          shape.setAttribute('data-original-stroke-width', shape.getAttribute('stroke-width') || '');
          shape.setAttribute('stroke', '#ffb300');
          shape.setAttribute('stroke-width', '3');
        }
        // Highlight text
        const text = element.querySelector('text');
        if (text) {
          text.style.fontWeight = 'bold';
        }
        break;
    }
  }

  /**
   * Remove selection styling from element
   * @private
   * @param {Element} element - Element to unstyle
   */
  _removeSelectionStyling(element) {
    if (!element) return;
    
    element.classList.remove(this.selectedClass);
    
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'text':
      case 'tspan':
        element.style.fontWeight = '';
        element.style.filter = '';
        break;
        
      case 'rect':
        const originalStroke = element.getAttribute('data-original-stroke');
        const originalWidth = element.getAttribute('data-original-stroke-width');
        if (originalStroke !== null) {
          element.setAttribute('stroke', originalStroke);
        }
        if (originalWidth !== null) {
          element.setAttribute('stroke-width', originalWidth);
        }
        element.style.filter = '';
        break;
        
      case 'g':
        // Restore group children
        const shape = element.querySelector('rect, circle, ellipse, polygon');
        if (shape) {
          const origStroke = shape.getAttribute('data-original-stroke');
          const origWidth = shape.getAttribute('data-original-stroke-width');
          if (origStroke !== null) {
            shape.setAttribute('stroke', origStroke);
          }
          if (origWidth !== null) {
            shape.setAttribute('stroke-width', origWidth);
          }
        }
        const text = element.querySelector('text');
        if (text) {
          text.style.fontWeight = '';
        }
        break;
    }
  }

  /**
   * Show selection UI
   * @private
   * @param {string} text - Selected text
   */
  _showSelectionUI(text) {
    const indicator = document.getElementById('selectionIndicator');
    const selectedTextSpan = document.getElementById('selectedText');
    const deepDiveInput = document.getElementById('deepDiveQuery');
    
    if (indicator && selectedTextSpan) {
      selectedTextSpan.textContent = text;
      this.dom.showElement(indicator);
      
      // Focus on deep dive input
      if (deepDiveInput) {
        deepDiveInput.value = '';
        deepDiveInput.focus();
      }
    }
  }

  /**
   * Extract text from node
   * @private
   * @param {Element} node - Node element
   * @returns {string} Extracted text
   */
  _extractNodeText(node) {
    // Try multiple selectors
    const textElement = node.querySelector('text, .nodeLabel, span');
    
    if (textElement) {
      // Handle tspans
      const tspans = textElement.querySelectorAll('tspan');
      if (tspans.length > 0) {
        return Array.from(tspans)
          .map(t => t.textContent.trim())
          .filter(Boolean)
          .join(' ');
      }
      
      return textElement.textContent.trim();
    }
    
    return '';
  }

  /**
   * Extract text from edge label
   * @private
   * @param {Element} label - Edge label element
   * @returns {string} Extracted text
   */
  _extractEdgeText(label) {
    const text = label.querySelector('text, span');
    return text ? text.textContent.trim() : label.textContent.trim();
  }

  /**
   * Extract text from note
   * @private
   * @param {Element} note - Note element
   * @returns {string} Extracted text
   */
  _extractNoteText(note) {
    const texts = note.querySelectorAll('text');
    return Array.from(texts)
      .map(t => t.textContent.trim())
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Extract text from block (sequence diagram)
   * @private
   * @param {Element} rect - Rectangle element
   * @param {SVGElement} svg - SVG container
   * @returns {string} Extracted text
   */
  _extractBlockText(rect, svg) {
    const bbox = rect.getBBox();
    
    // Find all text elements within this rectangle
    const texts = Array.from(svg.querySelectorAll('text')).filter(text => {
      const textBox = text.getBBox();
      return (
        textBox.x >= bbox.x - 5 &&
        textBox.x + textBox.width <= bbox.x + bbox.width + 5 &&
        textBox.y >= bbox.y - 5 &&
        textBox.y + textBox.height <= bbox.y + bbox.height + 5
      );
    });
    
    return texts
      .map(t => t.textContent.trim())
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Check if rect is selectable
   * @private
   * @param {Element} rect - Rectangle element
   * @returns {boolean}
   */
  _isSelectableRect(rect) {
    const fill = rect.getAttribute('fill');
    
    // Skip white/transparent/no fill
    if (!fill || ['#fff', '#ffffff', 'white', 'none', 'transparent'].includes(fill.toLowerCase())) {
      return false;
    }
    
    // Must be reasonably sized
    const width = parseFloat(rect.getAttribute('width')) || 0;
    const height = parseFloat(rect.getAttribute('height')) || 0;
    
    return width > 100 && height > 40;
  }

  /**
   * Detect diagram type from SVG
   * @private
   * @param {SVGElement} svg - SVG element
   * @returns {string} Diagram type
   */
  _detectDiagramType(svg) {
    // Check for specific class names or structures
    if (svg.querySelector('.actor, .note, sequenceDiagram')) {
      return 'sequence';
    }
    if (svg.querySelector('.node, .edgePath, .flowchart')) {
      return 'flowchart';
    }
    if (svg.querySelector('.gantt')) {
      return 'gantt';
    }
    if (svg.querySelector('.pie')) {
      return 'pie';
    }
    
    return 'generic';
  }

  /**
   * Decode HTML entities
   * @param {string} text - Text with entities
   * @returns {string} Decoded text
   */
  decodeEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
}
