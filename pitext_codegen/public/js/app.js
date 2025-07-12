// js/app.js
import { state } from './state.js';
import { setupTextSelection, resetSelection } from './selectionHandler.js';
import { askAboutSelection } from './deepDive.js';

let mermaidReady = false;

// Initialize Mermaid
const checkMermaid = setInterval(() => {
  if (window.mermaid) {
    mermaidReady = true;
    clearInterval(checkMermaid);
    console.log('Mermaid ready');
  }
}, 100);

// Wire up event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('generateBtn').addEventListener('click', createDiagram);
  document.getElementById('approveBtn').addEventListener('click', generateCodeFiles);
  document.getElementById('rejectBtn').addEventListener('click', startOver);
  document.getElementById('askBtn').addEventListener('click', askAboutSelection);
  
  document.getElementById('prompt').addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      createDiagram();
    }
  });

  document.getElementById('deepDiveQuery').addEventListener('keypress', e => {
    if (e.key === 'Enter') askAboutSelection();
  });
});

// STEP 1: Create Mermaid diagram
async function createDiagram() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) {
    alert('Please enter a description of the code you want to generate.');
    return;
  }

  const language = document.getElementById('language').value;
  const generateBtn = document.getElementById('generateBtn');
  const diagramSection = document.getElementById('diagram-section');
  const diagramContainer = document.getElementById('diagram-container');

  resetSelection();
  state.currentQuery = prompt;

  generateBtn.disabled = true;
  generateBtn.textContent = 'Creating Diagram...';
  diagramContainer.innerHTML = '<p class="loading">🔄 Creating code flow... Please wait.</p>';
  diagramSection.style.display = 'block';

  try {
    const response = await fetch('/codegen/generate-diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        language: language,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const diagramData = await response.json();
    state.currentDiagramData = diagramData;
    showDiagramPreview(diagramData);

  } catch (error) {
    diagramContainer.innerHTML = `<p class="error">❌ Diagram creation failed: ${error.message}</p>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Create Diagram';
  }
}

function showDiagramPreview(diagramData) {
  const diagramContainer = document.getElementById('diagram-container');
  
  diagramContainer.innerHTML = `<div class="mermaid">${diagramData.diagram_mermaid}</div>`;
  
  if (mermaidReady) {
    setTimeout(async () => {
      try {
        await window.mermaid.init(undefined, diagramContainer.querySelector('.mermaid'));
        console.log('Diagram rendered successfully');
        setupTextSelection(diagramContainer);
      } catch (error) {
        console.error('Mermaid rendering failed:', error);
        diagramContainer.innerHTML = `
          <div class="error">
            <h4>❌ Diagram Rendering Failed</h4>
            <p>Raw Mermaid code:</p>
            <pre>${escapeHtml(diagramData.diagram_mermaid)}</pre>
          </div>
        `;
      }
    }, 100);
  } else {
    diagramContainer.innerHTML = '<p class="error">Mermaid not ready. Please refresh the page.</p>';
  }
}

// STEP 2: Generate code files after user approval
async function generateCodeFiles() {
  if (!state.currentDiagramData) {
    alert('No diagram data available. Please start over.');
    return;
  }

  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  const resultsDiv = document.getElementById('results');

  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  approveBtn.textContent = 'Generating Code...';
  resultsDiv.innerHTML = '<p class="loading">🔄 Generating code file... This may take 20-30 seconds.</p>';

  try {
    const response = await fetch('/codegen/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.currentDiagramData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const codeData = await response.json();
    showFinalResults(codeData);

  } catch (error) {
    resultsDiv.innerHTML = `<p class="error">❌ Code generation failed: ${error.message}</p>`;
  } finally {
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = '✅ Generate Code Files';
  }
}

function showFinalResults(codeData) {
  const resultsDiv = document.getElementById('results');
  
  let html = '<div class="success">🎉 Complete! Your code has been generated successfully.</div>';
  
  if (codeData.files && codeData.files.length > 0) {
    html += `<h3>📁 Generated Code File(s)</h3>`;
    codeData.files.forEach(file => {
      html += `
        <div class="file-item">
          <div class="file-header">
            <span class="file-path">${file.path}</span>
            <div class="file-actions">
              <button onclick="copyFileContent(this)" class="copy-btn">Copy</button>
              <button onclick="downloadFile(this)" class="download-btn">Download</button>
            </div>
          </div>
          <div class="file-content">
            <pre><code>${escapeHtml(file.content)}</code></pre>
          </div>
        </div>
      `;
    });
  }

  html += `
    <div class="final-actions">
      <button onclick="startOver()" class="restart-btn">🔄 Generate New Code</button>
    </div>
  `;
  
  resultsDiv.innerHTML = html;
}

function startOver() {
  state.currentDiagramData = null;
  state.currentQuery = '';
  resetSelection();
  
  document.getElementById('prompt').value = '';
  document.getElementById('diagram-section').style.display = 'none';
  document.getElementById('results').innerHTML = '<div class="placeholder">Your generated code will appear here.</div>';
  document.getElementById('generateBtn').textContent = 'Create Diagram';
  
  document.getElementById('prompt').focus();
}

function copyFileContent(button) {
    const fileItem = button.closest('.file-item');
    const code = fileItem.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

function downloadFile(button) {
    const fileItem = button.closest('.file-item');
    const code = fileItem.querySelector('code').textContent;
    const path = fileItem.querySelector('.file-path').textContent;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 1rem;
    border-radius: 4px;
    z-index: 1001;
    animation: fadeIn 0.3s ease-in;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

// Make functions globally available for inline event handlers
window.copyFileContent = copyFileContent;
window.downloadFile = downloadFile;
window.startOver = startOver;