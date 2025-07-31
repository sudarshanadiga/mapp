// pitext-mobile/public/js/app.js
// Mobile-optimized application JavaScript

// Initialize Mermaid
async function initializeMermaid() {
  if (window.mermaid) {
      window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
              primaryColor: '#2563eb',
              primaryTextColor: '#fff',
              primaryBorderColor: '#1d4ed8',
              lineColor: '#5b5b5b',
              secondaryColor: '#1f2937',
              tertiaryColor: '#374151',
              background: '#0a0a0a',
              mainBkg: '#1f2937',
              secondBkg: '#374151',
              tertiaryBkg: '#4b5563',
              noteBkgColor: '#fef3c7',
              noteTextColor: '#92400e',
              noteBorderColor: '#f59e0b',
              actorBorder: '#1d4ed8',
              actorBkg: '#1f2937',
              actorTextColor: '#fff',
              actorLineColor: '#5b5b5b',
              signalColor: '#fff',
              signalTextColor: '#fff',
              labelBoxBkgColor: '#1f2937',
              labelBoxBorderColor: '#1d4ed8',
              labelTextColor: '#fff',
              loopTextColor: '#fff',
              activationBorderColor: '#1d4ed8',
              activationBkgColor: '#374151',
              sequenceNumberColor: '#fff'
          },
          flowchart: {
              htmlLabels: false,
              wrap: true,
              useMaxWidth: true
          }
      });
  }
}

// API configuration
const API_BASE_URL = '/mobile';

// API client
async function apiRequest(endpoint, options = {}) {
  try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: {
              'Content-Type': 'application/json',
              ...options.headers
          }
      });

      if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
  } catch (error) {
      console.error('API Request failed:', error);
      throw error;
  }
}

// Mobile menu functionality
function setupMobileMenu() {
  const menuButton = document.getElementById('menuButton');
  const menuClose = document.getElementById('menuClose');
  const mobileMenu = document.getElementById('mobileMenu');

  menuButton?.addEventListener('click', () => {
      mobileMenu.classList.add('active');
      document.body.style.overflow = 'hidden';
  });

  menuClose?.addEventListener('click', () => {
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
  });
}

// Navigation functionality
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');
  const mobileMenu = document.getElementById('mobileMenu');

  function showSection(sectionId) {
      sections.forEach(section => {
          section.classList.remove('active');
      });
      
      navLinks.forEach(link => {
          link.classList.remove('active');
      });

      const targetSection = document.getElementById(sectionId);
      const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
      
      if (targetSection) {
          targetSection.classList.add('active');
          
          // Initialize Mermaid when showing Strassens section
          if (sectionId === 'strassens') {
              initializeMermaid();
          }
      }
      
      if (targetLink) {
          targetLink.classList.add('active');
      }

      // Close mobile menu
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
          e.preventDefault();
          const sectionId = link.getAttribute('data-section');
          showSection(sectionId);
          history.pushState(null, '', `#${sectionId}`);
      });
  });

  // Handle initial hash
  const initialHash = window.location.hash.slice(1) || 'home';
  showSection(initialHash);

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
      const hash = window.location.hash.slice(1) || 'home';
      showSection(hash);
  });

  // CTA buttons
  document.querySelectorAll('a[href="#waitlist"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
          e.preventDefault();
          showSection('waitlist');
      });
  });
}

// Example buttons functionality
function setupExampleButtons() {
  const exampleBtns = document.querySelectorAll('.example-btn');
  const queryInput = document.getElementById('query');
  
  exampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          const query = btn.getAttribute('data-query');
          if (queryInput) {
              queryInput.value = query;
              queryInput.focus();
              // Scroll to input on mobile
              queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      });
  });
}

// Notification system
function showNotification(message, type = 'info') {
  const container = document.getElementById('notifications');
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
  };
  
  notification.innerHTML = `
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
  `;
  
  container.appendChild(notification);

  // Animate in
  setTimeout(() => {
      notification.classList.add('notification-show');
  }, 10);

  // Auto remove after 3 seconds
  setTimeout(() => {
      notification.classList.remove('notification-show');
      setTimeout(() => {
          notification.remove();
      }, 300);
  }, 3000);
}

// Diagram generation functionality
function setupDiagramGeneration() {
  const generateBtn = document.getElementById('generateBtn');
  const queryInput = document.getElementById('query');
  const resultDiv = document.getElementById('result');

  if (!generateBtn || !queryInput || !resultDiv) return;

  generateBtn.addEventListener('click', async () => {
      const query = queryInput.value.trim();
      if (!query) {
          showNotification('Please enter a question!', 'warning');
          return;
      }

      // Show loading state
      generateBtn.innerHTML = '<div class="loading-spinner"></div>';
      generateBtn.disabled = true;
      resultDiv.innerHTML = `
          <div class="loading-state">
              <div class="loading-spinner"></div>
              <div class="loading-text">Creating textchart...</div>
          </div>
      `;

      try {
          // Call API
          const response = await apiRequest('/describe', {
              method: 'POST',
              body: JSON.stringify({ query })
          });

          // Check if it's a sequence comparison to add wide class
          const isSequence = response.diagram_type === 'sequence_comparison';
          if (isSequence) {
              resultDiv.classList.add('sequence-wide');
          } else {
              resultDiv.classList.remove('sequence-wide');
          }

          // Render diagram
          resultDiv.innerHTML = `<div class="mermaid">${response.diagram}</div>`;
          
          if (window.mermaid) {
              await window.mermaid.run();
          }

          // Store original query for deep dive
          resultDiv.dataset.originalQuery = query;

          showNotification('Textchart created successfully!', 'success');

      } catch (error) {
          console.error('Generation error:', error);
          resultDiv.innerHTML = `
              <div class="error-message">
                  <div class="error-icon">⚠️</div>
                  <div class="error-text">Failed to generate textchart</div>
                  <div style="font-size: 14px; margin-top: 8px; color: var(--text-light);">${error.message}</div>
              </div>
          `;
          showNotification('Failed to generate textchart', 'error');
      } finally {
          generateBtn.innerHTML = '<span class="btn-text">Answer</span>';
          generateBtn.disabled = false;
      }
  });

  // Enter key support
  queryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          generateBtn.click();
      }
  });
}

// Selection handling for mobile
function setupSelectionHandling() {
  const resultDiv = document.getElementById('result');
  const selectionSection = document.getElementById('selectionSection');
  const selectedText = document.getElementById('selectedText');
  
  if (!resultDiv || !selectionSection || !selectedText) return;

  let touchTimer;
  
  // Handle long press for selection on mobile
  resultDiv.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => {
          handleSelection();
      }, 500); // 500ms long press
  });

  resultDiv.addEventListener('touchend', () => {
      clearTimeout(touchTimer);
  });

  resultDiv.addEventListener('touchmove', () => {
      clearTimeout(touchTimer);
  });

  // Also keep regular selection for desktop/tablets
  resultDiv.addEventListener('mouseup', () => {
      setTimeout(handleSelection, 10);
  });

  function handleSelection() {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text) {
          selectedText.textContent = text;
          selectionSection.classList.add('show');
          // Store selected text for deep dive
          selectionSection.dataset.selectedText = text;
      }
  }
}

// Deep dive functionality
function setupDeepDive() {
  const askBtn = document.getElementById('askBtn');
  const deepDiveQuery = document.getElementById('deepDiveQuery');
  const deepDiveResponse = document.getElementById('deepDiveResponse');
  const selectionSection = document.getElementById('selectionSection');
  const resultDiv = document.getElementById('result');

  if (!askBtn || !deepDiveQuery || !deepDiveResponse) return;

  askBtn.addEventListener('click', async () => {
      const question = deepDiveQuery.value.trim();
      const selected = selectionSection.dataset.selectedText;
      const originalQuery = resultDiv.dataset.originalQuery || '';

      if (!question) {
          showNotification('Please enter a question about the selection!', 'warning');
          return;
      }

      // Show loading state
      askBtn.textContent = 'Asking...';
      askBtn.disabled = true;

      try {
          const response = await apiRequest('/deep-dive', {
              method: 'POST',
              body: JSON.stringify({
                  selected_text: selected,
                  question: question,
                  original_query: originalQuery
              })
          });

          // Display response with close button
          deepDiveResponse.innerHTML = `
              <button class="close-btn" id="deepDiveCloseBtn">×</button>
              <div style="padding-right: 20px;">${response.response}</div>
          `;
          deepDiveResponse.classList.add('show');
          
          // Add event listener to close button
          const closeBtn = document.getElementById('deepDiveCloseBtn');
          if (closeBtn) {
              closeBtn.addEventListener('click', () => {
                  deepDiveResponse.classList.remove('show');
                  deepDiveQuery.value = '';
              });
          }

      } catch (error) {
          showNotification('Failed to get answer', 'error');
      } finally {
          askBtn.textContent = 'Ask';
          askBtn.disabled = false;
      }
  });

  // Enter key support
  deepDiveQuery.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          askBtn.click();
      }
  });
}

// Prevent double-tap zoom on buttons
function preventDoubleTapZoom() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
          e.preventDefault();
      }
      lastTouchEnd = now;
  }, false);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupNavigation();
  setupExampleButtons();
  setupDiagramGeneration();
  setupSelectionHandling();
  setupDeepDive();
  preventDoubleTapZoom();
});

// Export for potential use in other modules
export {
  showNotification,
  apiRequest,
  initializeMermaid
};