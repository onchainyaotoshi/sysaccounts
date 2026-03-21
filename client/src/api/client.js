import { getAuth } from '../auth.js';

const BASE = '/api';

let isRedirecting = false;

function handleUnauthorized() {
  if (isRedirecting) return;
  isRedirecting = true;
  // Don't call auth.logout() — token is already invalid server-side.
  // Just clear local storage and redirect to show login page.
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  window.location.href = '/';
}

async function request(path, options = {}) {
  let token = null;
  try {
    const auth = getAuth();
    token = auth.getAccessToken();
  } catch {
    // Auth not initialized yet (e.g., during config fetch)
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Authentication required');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  getUsers: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/users?${qs}`); },
  getUser: (username) => request(`/users/${username}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  deleteUser: (username, removeHome = false) => request(`/users/${username}?removeHome=${removeHome}`, { method: 'DELETE' }),
  modifyUser: (username, body) => request(`/users/${username}`, { method: 'PATCH', body }),
  changePassword: (username, password) => request(`/users/${username}/password`, { method: 'POST', body: { password } }),
  lockUser: (username, locked) => request(`/users/${username}/lock`, { method: 'POST', body: { locked } }),
  changeAging: (username, body) => request(`/users/${username}/aging`, { method: 'PATCH', body }),
  getGroups: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/groups?${qs}`); },
  createGroup: (body) => request('/groups', { method: 'POST', body }),
  deleteGroup: (name) => request(`/groups/${name}`, { method: 'DELETE' }),
  modifyGroup: (name, body) => request(`/groups/${name}`, { method: 'PATCH', body }),
  addMembers: (groupName, usernames) => request(`/groups/${groupName}/members`, { method: 'POST', body: { usernames } }),
  removeMember: (groupName, username) => request(`/groups/${groupName}/members/${username}`, { method: 'DELETE' }),
  getSudoers: () => request('/sudoers'),
  grantSudo: (body) => request('/sudoers', { method: 'POST', body }),
  modifySudo: (username, rule) => request(`/sudoers/${username}`, { method: 'PATCH', body: { rule } }),
  revokeSudo: (username) => request(`/sudoers/${username}`, { method: 'DELETE' }),
  getSessions: () => request('/sessions'),
  getLogins: (limit = 50) => request(`/sessions/logins?limit=${limit}`),
  killSession: (terminal) => request(`/sessions/${terminal}`, { method: 'DELETE' }),
  getHealth: () => request('/health'),
};
