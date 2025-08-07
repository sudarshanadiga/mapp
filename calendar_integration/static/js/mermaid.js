/* global mermaid */

(function initMermaidObserver () {
  // Render any <code class="language-mermaid"> blocks that appear later
  const render = codeEl => {
    const container = document.createElement('div');
    container.className = 'mermaid';
    container.textContent = codeEl.textContent;
    codeEl.replaceWith(container);
    mermaid.init(undefined, container);

    // Click-through: each node id becomes clickable
    container.addEventListener('click', e => {
      if (e.target.tagName !== 'text') return;
      const id = e.target.textContent.trim();
      // Expect node text to be the event_id
      if (id.startsWith('EV')) {
        window.calendar?.selectEvent?.(id); // FullCalendar extension point
      }
    });
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.matches('code.language-mermaid')) {
          render(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})(); 