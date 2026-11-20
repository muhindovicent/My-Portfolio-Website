// API client for Portfolio Studio.
// All requests are same-origin and carry the session cookie. State-changing
// requests include the CSRF token issued for the current session.

let csrfToken = null;

export async function refreshCsrfToken() {
  const res = await fetch('/api/admin/auth/csrf-token', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Unable to initialize a secure session');
  const body = await res.json();
  csrfToken = body.csrfToken;
  return csrfToken;
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const err = payload && payload.error ? payload.error : {};
    const details = Array.isArray(err.details)
      ? err.details.map((d) => `${d.path}: ${d.message}`).join(' · ')
      : null;
    throw new ApiError(err.message || `Request failed (${res.status})`, res.status, details);
  }

  return payload;
}

export function mutate(method, path, body) {
  return request(path, {
    method,
    body,
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
  });
}

export const api = {
  me: () => request('/api/admin/auth/me'),
  dashboard: () => request('/api/admin/dashboard'),
  notifications: () => request('/api/admin/dashboard/notifications'),
  search: (q) => request(`/api/admin/dashboard/search?q=${encodeURIComponent(q)}`),
  logout: () => mutate('POST', '/api/admin/auth/logout'),
  list: (resource, params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/api/admin/${resource}${suffix}`);
  },
  get: (resource, id) => request(`/api/admin/${resource}/${encodeURIComponent(id)}`),
  create: (resource, body) => mutate('POST', `/api/admin/${resource}`, body),
  update: (resource, id, body) => mutate('PATCH', `/api/admin/${resource}/${encodeURIComponent(id)}`, body),
  remove: (resource, id) => mutate('DELETE', `/api/admin/${resource}/${encodeURIComponent(id)}`),
};
