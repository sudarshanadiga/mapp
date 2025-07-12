// js/helpers.js
export function decodeHTMLEntities(text) {
  const ta = document.createElement('textarea');
  ta.innerHTML = text;
  return ta.value;
}