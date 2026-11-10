const TOKEN_KEY = 'ajaia.token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { json, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body });
  } catch {
    throw new ApiError(0, 'Network error, check your connection');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      setToken(null);
      window.dispatchEvent(new Event('ajaia:signed-out'));
    }
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  }
  return data;
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { json: { email, password } }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/me'),
  users: () => request('GET', '/users'),
  listDocs: () => request('GET', '/documents'),
  createDoc: (title) => request('POST', '/documents', { json: title ? { title } : {} }),
  importDoc: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/documents/import', { form });
  },
  getDoc: (id) => request('GET', `/documents/${id}`),
  saveDoc: (id, patch) => request('PATCH', `/documents/${id}`, { json: patch }),
  deleteDoc: (id) => request('DELETE', `/documents/${id}`),
  listShares: (id) => request('GET', `/documents/${id}/shares`),
  share: (id, email, role) => request('PUT', `/documents/${id}/shares`, { json: { email, role } }),
  unshare: (id, userId) => request('DELETE', `/documents/${id}/shares/${userId}`),
};
