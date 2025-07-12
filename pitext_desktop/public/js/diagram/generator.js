// public/js/diagram/generator.js
/**
 * Diagram generation orchestration – from query to rendered diagram.
 */

import { DiagramUtilities } from './utilities.js';
import { Helpers } from '../utils/helpers.js';

export class DiagramGenerator {
  constructor(api, mermaid, state, dom) {
    this.api = api;
    this.mermaid = mermaid;
    this.state = state;
    this.dom = dom;
    this.utilities = new DiagramUtilities();
    this.helpers = new Helpers();

    // Retry settings
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Generate a diagram from the user query.
   * @param {string}  query     User's request
   * @param {boolean} isRetry   Internal flag (do not supply manually)
   **/
  async generate(query, isRetry = false) {
      const resultContainer = document.getElementById('result');

      // Reset counter only on the very first attempt
      if (!isRetry) this.retryCount = 0;

      // House‑keeping
      this.state.setQuery(query);
      this.state.setLoading('generating', true);
      this.state.setError(null);
      this._showLoading(resultContainer);

      try {
          const response = await this.api.generateDiagram(query);

          if (!response.success) {
              throw new Error(response.detail || 'Generation failed');
          }

          // Store diagram in the state
          this.state.setDiagram({
              type: response.diagram_type,
              code: response.diagram,
              content: response.content,
              query,
          });

          const ok = await this._renderDiagram(response.diagram, resultContainer);

          if (!ok) {
              // DON'T retry the entire generation - just fail
              throw new Error('Failed to render diagram');
          }

          // Success – augment the SVG
          this._enhanceDiagram(resultContainer);
      } catch (err) {
          console.error('Generation error:', err);
          this.state.setError(err);
          this._showError(resultContainer, err);
      } finally {
          this.state.setLoading('generating', false);
      }
  }
  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Attempt to render Mermaid code.
   * @returns {Promise<boolean>} true on success, false on failure
   */
async _renderDiagram(code, container) {
    try {
        console.log('Starting Mermaid render with code:', code.substring(0, 100) + '...');
        
        // Ensure container is ready
        container.innerHTML = '';
        
        // Create a pre element with mermaid class
        const pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.textContent = code;
        container.appendChild(pre);
        
        // Force Mermaid to render
        console.log('Calling mermaid.run()...');
        await window.mermaid.run({
            nodes: [pre],
            suppressErrors: false
        });
        
        // Wait for render to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if SVG was created
        const svg = container.querySelector('svg');
        if (!svg) {
            console.error('No SVG created by Mermaid');
            // Try displaying the raw code as fallback
            container.innerHTML = `
                <div class="mermaid-error">
                    <p>Failed to render diagram. Raw Mermaid code:</p>
                    <pre style="text-align: left; background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; overflow: auto;">${this.helpers.escapeHtml(code)}</pre>
                </div>
            `;
            return false;
        }
        
        console.log('SVG successfully created');
        this._fixArrowVisibility(container);
        return true;
        
    } catch (err) {
        console.error('Mermaid render error:', err);
        console.error('Failed code:', code);
        // Show the error to user
        container.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <div class="error-text">Failed to render diagram: ${err.message}</div>
                <details style="margin-top: 1rem;">
                    <summary>View Mermaid Code</summary>
                    <pre style="text-align: left; background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; overflow: auto;">${this.helpers.escapeHtml(code)}</pre>
                </details>
            </div>
        `;
        return false;
    }
}

  _showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">Generating textchart...</div>
        <div class="loading-tip">This may take a few seconds</div>
      </div>
    `;
    this._addLoadingAnimation();
  }

  _showError(container, error) {
    const userMessage = error.getUserMessage
      ? error.getUserMessage()
      : this.helpers.getErrorMessage(error);

    container.innerHTML = `
      <div class="error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-text">${userMessage}</div>
        <button class="retry-btn" id="retryBtn">Try Again</button>
        <div class="error-details">
          <details>
            <summary>Technical details</summary>
            <pre>${error.message}</pre>
          </details>
        </div>
      </div>
    `;

    const retryBtn = container.querySelector('#retryBtn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        const q = this.state.get('currentQuery');
        if (q) this.generate(q);
      };
    }
  }

  _enhanceDiagram(container) {
    this.utilities.addButtons(container);
    this._makeInteractive(container);

    if (this._isDiagramLarge(container)) {
      this.utilities.addZoomControls(container);
    }

    this.currentContainer = container;
  }

  _makeInteractive(container) {
    const svg = container.querySelector('svg');
    if (!svg) return;

    const nodes = svg.querySelectorAll('g.node, .node');
    nodes.forEach((node) => {
      node.style.cursor = 'pointer';
      node.addEventListener('mouseenter', () =>
        node.classList.add('node-hover')
      );
      node.addEventListener('mouseleave', () =>
        node.classList.remove('node-hover')
      );
    });

    const edgeLabels = svg.querySelectorAll('.edgeLabel');
    edgeLabels.forEach((label) => (label.style.cursor = 'pointer'));
  }

  _fixArrowVisibility(container) {
    setTimeout(() => {
      const svg = container.querySelector('svg');
      if (!svg) return;

      const paths = svg.querySelectorAll('path');
      paths.forEach((p) => {
        const d = p.getAttribute('d');
        if (d && d.includes('M') && d.includes('L')) {
          p.setAttribute('stroke', '#000000');
          p.setAttribute('stroke-width', '4');
          p.setAttribute('fill', 'none');
          p.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
        }
      });

      const markers = svg.querySelectorAll('marker path, marker polygon');
      markers.forEach((m) => {
        m.setAttribute('fill', '#000000');
        m.setAttribute('stroke', '#ffffff');
        m.setAttribute('stroke-width', '2');
      });

      const edgePaths = svg.querySelectorAll('g.edgePath path, .edgePath path');
      edgePaths.forEach((e) => {
        e.setAttribute('stroke', '#000000');
        e.setAttribute('stroke-width', '4');
        e.setAttribute('fill', 'none');
        e.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
      });
    }, 50);
  }

  _isDiagramLarge(container) {
    const svg = container.querySelector('svg');
    if (!svg) return false;

    const vb = svg.getAttribute('viewBox');
    if (!vb) return false;

    const [, , w, h] = vb.split(' ').map(Number);
    return w > 1000 || h > 1000;
  }

  _addLoadingAnimation() {
    if (document.getElementById('generator-loading-styles')) return;

    const style = document.createElement('style');
    style.id = 'generator-loading-styles';
    style.textContent = `
      .loading-state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:1rem}
      .loading-spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
      .loading-text{font-size:18px;color:#fff}
      .loading-tip{font-size:14px;color:rgba(255,255,255,0.7)}
      @keyframes spin{to{transform:rotate(360deg)}}
      .node-hover rect,
      .node-hover circle,
      .node-hover ellipse{stroke-width:3px!important;filter:brightness(1.1)}
    `;
    document.head.appendChild(style);
  }

  /**
   * Export the diagram in PNG, SVG or Mermaid form.
   */
  async exportDiagram(format) {
    if (!this.currentContainer) {
      throw new Error('No diagram to export');
    }

    const svg = this.currentContainer.querySelector('svg');
    if (!svg && format !== 'mermaid') {
      throw new Error('No SVG found to export');
    }

    switch (format) {
      case 'png':
        await this.utilities.exportAsPNG(svg);
        break;
      case 'svg':
        await this.utilities.exportAsSVG(svg);
        break;
      case 'mermaid': {
        const code = this.state.get('currentDiagramCode');
        await this.utilities.exportAsMermaid(code);
        break;
      }
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
}
