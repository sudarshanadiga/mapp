// js/selectionHandler.js
import { state } from './state.js';
import { decodeHTMLEntities } from './helpers.js';

export function setupTextSelection(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  function deselectPrevious() {
    if (state.selectedElement) {
      state.selectedElement.classList.remove('node-selected');
    }
    state.selectedElement = null;
  }

  function updateSelectionUI(text, el) {
    state.selectedText = text;
    state.selectedElement = el;
    document.getElementById('selectedText').textContent = text;
    document.getElementById('selectionIndicator').classList.add('active');
    document.getElementById('deepDiveQuery').focus();
  }

  // Support both HTML labels and regular text labels
  const nodes = svg.querySelectorAll('g.node');
  nodes.forEach(node => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', function (e) {
      e.stopPropagation();
      deselectPrevious();
      this.classList.add('node-selected');
      let nodeText = '';
      const textEl = this.querySelector('text, .nodeLabel');
      if (textEl) {
        const tspans = textEl.querySelectorAll('tspan');
        nodeText = tspans.length
          ? Array.from(tspans).map(t => t.textContent.trim()).filter(Boolean).join(' ')
          : textEl.textContent.trim();
      }
      updateSelectionUI(decodeHTMLEntities(nodeText), this);
    });
  });

  svg.addEventListener('click', function (e) {
    if (e.target === svg || (e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'none')) {
      resetSelection();
    }
  });
}

export function resetSelection() {
  if (state.selectedElement) {
    state.selectedElement.classList.remove('node-selected');
    state.selectedElement = null;
  }
  state.selectedText = '';
  document.getElementById('selectionIndicator').classList.remove('active');
  document.getElementById('deepDiveQuery').value = '';
  document.getElementById('deepDiveResponse').classList.remove('active');
}
