const JSON_HEADERS = { 'Content-Type': 'application/json' };

function handle(res, url) {
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (res.status === 204) return null;     // DELETE success, no body
  return res.json().then(obj => obj && obj.data !== undefined ? obj.data : obj);
}

function getCsrfToken() {
  // Get CSRF token from cookie
  const name = 'csrftoken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

export const api = {
  get: url => fetch(url, { credentials: 'include' })
                .then(r => handle(r, url)),

  post: (url, body) => {
    const headers = { ...JSON_HEADERS };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
    
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body)
    }).then(r => handle(r, url));
  },

  put: (url, body) => {
    const headers = { ...JSON_HEADERS };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
    
    return fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body)
    }).then(r => handle(r, url));
  },

  del: url => {
    const headers = {};
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
    
    return fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: headers
    }).then(r => handle(r, url));
  }
}; 