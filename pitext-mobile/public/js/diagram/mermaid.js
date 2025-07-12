// public/js/diagram/mermaid.js
/**
 * Mermaid diagram management
 * Handles initialization, rendering, and error recovery
 */

export class MermaidManager {
  constructor() {
    this.isReady = false;
    this.mermaid = null;
    this.initPromise = null;
    this.renderCount = 0;
  }

  /**
   * Wait for Mermaid to be available on window
   * @returns {Promise} Resolves when Mermaid is ready
   */
  async waitForReady() {
    if (this.isReady) {
      return this.mermaid;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  /**
   * Initialize Mermaid
   * @private
   * @returns {Promise} Resolves when initialized
   */
  async _initialize() {
    console.log('🔄 Waiting for Mermaid...');

    // Wait for Mermaid to appear on window
    this.mermaid = await this._waitForGlobal('mermaid', 10000);
    
    if (!this.mermaid) {
      throw new Error('Mermaid failed to load');
    }

    console.log('📦 Mermaid loaded, version:', this.mermaid.version || 'unknown');

    // Configure Mermaid
    const config = this._getMermaidConfig();
    console.log('⚙️  Configuring Mermaid with:', config);
    
    try {
      this.mermaid.initialize(config);
      console.log('✅ Mermaid configuration successful');
    } catch (configError) {
      console.error('❌ Mermaid configuration failed:', configError);
      throw configError;
    }
    
    this.isReady = true;
    console.log('✅ Mermaid initialized');
    
    return this.mermaid;
  }

  /**
   * Wait for a global variable to be defined
   * @private
   * @param {string} name - Variable name
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} Resolves with the variable value
   */
  _waitForGlobal(name, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (window[name]) {
          resolve(window[name]);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for ${name}`));
          return;
        }
        
        setTimeout(check, 100);
      };
      
      check();
    });
  }

  /**
   * Get Mermaid configuration
   * @private
   * @returns {Object} Mermaid config
   */
  _getMermaidConfig() {
    // Import config from our config module
    return {
      startOnLoad: false,
      theme: 'base',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      securityLevel: 'loose',
      logLevel: 'error',
      flowchart: {
        htmlLabels: false,
        wrap: true,
        useMaxWidth: true
      },
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#000000',
        lineColor: '#000000',
        arrowheadColor: '#000000',
        edgeLabelBackground: '#ffffff',
        defaultLinkColor: '#000000'
      }
    };
  }

  /**
   * Render a Mermaid diagram
   * @param {string} code - Mermaid diagram code
   * @param {HTMLElement} container - Container element
   * @returns {Promise<boolean>} Success status
   */
  async render(code, container) {
    if (!this.isReady) {
        await this.waitForReady();
    }

    // Debug: Log the diagram code
    console.log('🔍 Rendering diagram code:', code.substring(0, 200) + '...');

    // Clear container
    container.innerHTML = '';
    
    // Create diagram element
    const diagramId = `mermaid-${++this.renderCount}`;
    const diagramDiv = document.createElement('div');
    diagramDiv.className = 'mermaid';
    diagramDiv.id = diagramId;
    diagramDiv.textContent = code;
    
    container.appendChild(diagramDiv);

    try {
        // Remove any existing diagrams with same ID
        this.mermaid.contentLoaded();
        
        // Additional validation before rendering
        if (code.includes('```')) {
            console.warn('⚠️  Diagram code still contains markdown code blocks, attempting to clean...');
            code = this.cleanCode(code);
        }
        
        // Render the diagram
        this.mermaid.init(undefined, diagramDiv);
        
        // Wait a bit for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check for rendering success
        const success = await this._checkRenderSuccess(container);
        
        if (!success) {
            throw new Error('Diagram rendering failed');
        }
        
        return true;
        
    } catch (error) {
        console.error('Mermaid render error:', error);
        
        // Special handling for JSON parsing errors
        if (error.message && error.message.includes('Expected double-quoted property name in JSON')) {
            console.error('🔧 JSON parsing error detected - this might be due to markdown code blocks');
            // Try to clean the code again and retry
            try {
                const cleanedCode = this.cleanCode(code);
                diagramDiv.textContent = cleanedCode;
                this.mermaid.init(undefined, diagramDiv);
                await new Promise(resolve => setTimeout(resolve, 100));
                const success = await this._checkRenderSuccess(container);
                if (success) {
                    console.log('✅ Retry with cleaned code successful');
                    return true;
                }
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError);
            }
        }
        
        this._handleRenderError(container, error);
        return false;
    }
  }

  /**
   * Check if diagram rendered successfully
   * @private
   * @param {HTMLElement} container - Container element
   * @returns {Promise<boolean>} Success status
   */
  async _checkRenderSuccess(container) {
    // Wait a bit for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for SVG
    const svg = container.querySelector('svg');
    if (!svg) {
      return false;
    }
    
    // Check for error indicators
    const errorElements = container.querySelectorAll(
      '.mermaidError, [data-mermaid-error], .error'
    );
    if (errorElements.length > 0) {
      return false;
    }
    
    // Check for error text
    const text = container.textContent || '';
    const hasError = /syntax error|error in text|parse error/i.test(text);
    
    return !hasError;
  }

  /**
   * Handle render error
   * @private
   * @param {HTMLElement} container - Container element
   * @param {Error} error - Error object
   */
  _handleRenderError(container, error) {
    const errorMessage = this._extractErrorMessage(error);
    
    container.innerHTML = `
      <div class="mermaid-error">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Diagram Error</div>
        <div class="error-message">${errorMessage}</div>
        <div class="error-hint">Please try regenerating with a different query.</div>
      </div>
    `;
  }

  /**
   * Extract user-friendly error message
   * @private
   * @param {Error} error - Error object
   * @returns {string} Error message
   */
  _extractErrorMessage(error) {
    const message = error.message || String(error);
    
    // Common Mermaid errors
    if (message.includes('Parse error')) {
      return 'The diagram syntax is invalid.';
    }
    
    if (message.includes('Syntax error')) {
      return 'There is a syntax error in the diagram.';
    }
    
    if (message.includes('No diagram type detected')) {
      return 'The diagram type could not be determined.';
    }
    
    // Generic message
    return 'Failed to render the diagram.';
  }

  /**
   * Parse Mermaid code to extract diagram type
   * @param {string} code - Mermaid diagram code
   * @returns {string|null} Diagram type
   */
  parseDiagramType(code) {
    const firstLine = code.trim().split('\n')[0];
    
    // Common diagram types
    if (firstLine.includes('flowchart')) return 'flowchart';
    if (firstLine.includes('sequenceDiagram')) return 'sequence';
    if (firstLine.includes('gantt')) return 'gantt';
    if (firstLine.includes('pie')) return 'pie';
    if (firstLine.includes('graph')) return 'graph';
    if (firstLine.includes('stateDiagram')) return 'state';
    if (firstLine.includes('journey')) return 'journey';
    if (firstLine.includes('gitGraph')) return 'git';
    
    return null;
  }

  /**
   * Validate Mermaid code
   * @param {string} code - Mermaid diagram code
   * @returns {Object} Validation result
   */
  validateCode(code) {
    const result = {
      isValid: true,
      errors: []
    };
    
    // Check if empty
    if (!code || !code.trim()) {
      result.isValid = false;
      result.errors.push('Diagram code is empty');
      return result;
    }
    
    // Check for basic structure
    const lines = code.trim().split('\n');
    if (lines.length < 2) {
      result.isValid = false;
      result.errors.push('Diagram appears incomplete');
    }
    
    // Check for diagram type
    const type = this.parseDiagramType(code);
    if (!type && !code.includes('%%')) {
      result.isValid = false;
      result.errors.push('No valid diagram type found');
    }
    
    // Check for common syntax errors with more specific messages
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      result.isValid = false;
      const diff = openBrackets - closeBrackets;
      if (diff > 0) {
        result.errors.push(`Missing ${diff} closing bracket(s) [ ]`);
      } else {
        result.errors.push(`Missing ${Math.abs(diff)} opening bracket(s) [ ]`);
      }
    }
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      result.isValid = false;
      const diff = openParens - closeParens;
      if (diff > 0) {
        result.errors.push(`Missing ${diff} closing parenthesis/ces ( )`);
      } else {
        result.errors.push(`Missing ${Math.abs(diff)} opening parenthesis/ces ( )`);
      }
    }
    
    // Check for common Mermaid syntax issues
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check for malformed node declarations
      if (trimmedLine.includes('[') && !trimmedLine.includes(']')) {
        result.isValid = false;
        result.errors.push(`Line ${index + 1}: Incomplete node declaration - missing closing bracket`);
      }
      
      if (trimmedLine.includes('(') && !trimmedLine.includes(')')) {
        result.isValid = false;
        result.errors.push(`Line ${index + 1}: Incomplete node declaration - missing closing parenthesis`);
      }
      
      // Check for common arrow syntax issues
      if (trimmedLine.includes('==>') || trimmedLine.includes('===')) {
        result.isValid = false;
        result.errors.push(`Line ${index + 1}: Invalid arrow syntax - use --> instead of ==> or ===`);
      }
    });
    
    return result;
  }

  /**
   * Clean and prepare Mermaid code
   * @param {string} code - Raw Mermaid code
   * @returns {string} Cleaned code
   */
  cleanCode(code) {
    console.log('🧹 Cleaning diagram code:', code.substring(0, 200) + '...');
    
    // Remove markdown code fences if present
    code = code.replace(/^```mermaid\s*/i, '');
    code = code.replace(/^```\s*/i, '');
    code = code.replace(/```\s*$/g, '');
    
    // Ensure proper line endings
    code = code.replace(/\r\n/g, '\n');
    
    // Trim each line but preserve structure
    const lines = code.split('\n').map(line => line.trimEnd());
    
    // Remove empty lines at start and end
    while (lines.length > 0 && lines[0] === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    const cleaned = lines.join('\n');
    console.log('✨ Cleaned diagram code:', cleaned.substring(0, 200) + '...');
    
    return cleaned;
  }

  /**
   * Reset Mermaid state
   */
  reset() {
    if (this.mermaid) {
      this.mermaid.contentLoaded();
    }
    this.renderCount = 0;
  }
}

// Export singleton instance
export const mermaidManager = new MermaidManager();
