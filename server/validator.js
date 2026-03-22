const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const HOME_RE = /^\/[a-z0-9/_.-]+$/;
const GECOS_RE = /^[^:\n]{0,255}$/;
const ALLOWED_SHELLS = ['/bin/bash', '/bin/sh', '/bin/zsh', '/bin/fish', '/bin/dash', '/bin/csh', '/bin/tcsh', '/bin/ksh', '/usr/bin/bash', '/usr/bin/sh', '/usr/bin/zsh', '/usr/bin/fish', '/usr/sbin/nologin', '/sbin/nologin', '/bin/false', '/usr/bin/false', '/bin/nologin'];

export function validateUsername(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateGroupname(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateShell(shell) {
  return typeof shell === 'string' && ALLOWED_SHELLS.includes(shell);
}

export function validateHome(home) {
  if (typeof home !== 'string') return false;
  if (home.length > 255) return false;
  if (home.includes('..')) return false;
  return HOME_RE.test(home);
}

export function validateGecos(gecos) {
  return typeof gecos === 'string' && GECOS_RE.test(gecos);
}

export function validateInteger(value, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}

const TERMINAL_RE = /^(pts\/\d+|tty\d+)$/;

export function validateTerminal(terminal) {
  return typeof terminal === 'string' && TERMINAL_RE.test(terminal);
}

export function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 1024) return false;
  if (/[\n\r:]/.test(password)) return false;
  return true;
}

export function validateRequired(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  return missing.length === 0 ? null : `Missing required fields: ${missing.join(', ')}`;
}
