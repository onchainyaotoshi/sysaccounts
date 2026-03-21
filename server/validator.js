const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const SHELL_RE = /^\/[a-z0-9/_-]+$/;

export function validateUsername(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateGroupname(name) {
  return typeof name === 'string' && USERNAME_RE.test(name);
}

export function validateShell(shell) {
  return typeof shell === 'string' && SHELL_RE.test(shell);
}

const TERMINAL_RE = /^(pts\/\d+|tty\d+)$/;

export function validateTerminal(terminal) {
  return typeof terminal === 'string' && TERMINAL_RE.test(terminal);
}

export function validateRequired(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  return missing.length === 0 ? null : `Missing required fields: ${missing.join(', ')}`;
}
