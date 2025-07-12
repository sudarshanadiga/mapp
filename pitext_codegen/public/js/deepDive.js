// js/deepDive.js
import { state } from './state.js';

function addDeepDiveUtilities(panel) {
  if (!panel || panel.querySelector('.deep-utils')) return;
  
  const utils = document.createElement('div');
  utils.className = 'deep-utils';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => navigator.clipboard.writeText(panel.innerText.trim());

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save TXT';
  saveBtn.onclick = () => {
    const blob = new Blob([panel.innerText.trim()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deep-dive.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 250);
  };

  utils.append(copyBtn, saveBtn);
  panel.prepend(utils);
}

export async function askAboutSelection() {
  const q = document.getElementById('deepDiveQuery').value.trim();
  if (!q || !state.selectedText) return;

  const respDiv = document.getElementById('deepDiveResponse');
  respDiv.innerHTML = '<div>Answering...</div>';
  respDiv.classList.add('active');

  try {
    const r = await fetch('/codegen/deepdive-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_name: state.selectedText,
        question: q,
        original_prompt: state.currentQuery,
        flowchart: state.currentDiagramData ? state.currentDiagramData.diagram_mermaid : ''
      })
    });

    const data = await r.json();
    if (!data.success) {
      throw new Error(data.detail || 'Unknown error');
    }

    respDiv.innerHTML = `
      <h3>Deep Dive: ${state.selectedText}</h3>
      <div class="question">Q: ${q}</div>
      <div class="answer">${data.explanation}</div>
    `;
    addDeepDiveUtilities(respDiv);
    document.getElementById('deepDiveQuery').value = '';
  } catch (err) {
    respDiv.innerHTML = `<div style="color:#ff6b6b;">Error: ${err.message}</div>`;
  }
}
