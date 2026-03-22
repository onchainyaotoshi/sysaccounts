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
  return typeof home === 'string' && home.length <= 255 && HOME_RE.test(home);
}

export function validateGecos(gecos) {
  return typeof gecos === 'string' && GECOS_RE.test(gecos);
}

export function validateInteger(value) {
  return Number.isInteger(Number(value));
}

const TERMINAL_RE = /^(pts\/\d+|tty\d+)$/;

export function validateTerminal(terminal) {
  return typeof terminal === 'string' && TERMINAL_RE.test(terminal);
}

export function validateRequired(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  return missing.length === 0 ? null : `Missing required fields: ${missing.join(', ')}`;
}
