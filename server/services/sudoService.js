import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { execute } from './executor.js';

export function parseSudoersFile(content) {
  const rules = [];
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('Defaults')) return;
    const groupMatch = trimmed.match(/^%(\S+)\s+(.+)$/);
    if (groupMatch) { rules.push({ username: groupMatch[1], rule: groupMatch[2], type: 'group' }); return; }
    const userMatch = trimmed.match(/^([a-z_][a-z0-9_-]*)\s+(ALL.+)$/);
    if (userMatch) { rules.push({ username: userMatch[1], rule: userMatch[2], type: 'user' }); }
  });
  return rules;
}

export async function listSudoers() {
  const rules = [];
  try { const main = await readFile('/etc/sudoers', 'utf-8'); rules.push(...parseSudoersFile(main)); } catch (err) { console.error('Failed to read sudoers:', err.message); }
  try {
    const files = await readdir('/etc/sudoers.d');
    for (const file of files) {
      if (file.startsWith('.') || file.endsWith('~')) continue;
      const content = await readFile(`/etc/sudoers.d/${file}`, 'utf-8');
      rules.push(...parseSudoersFile(content));
    }
  } catch (err) { console.error('Failed to read sudoers:', err.message); }
  return rules;
}

const SUDO_RULE_RE = /^ALL=\(([a-z_][a-z0-9_-]*|ALL)(:[a-z_][a-z0-9_-]*|:ALL)?\)\s+(NOPASSWD:\s*)?(ALL|\/[a-z0-9\/_.-]+(\s*,\s*\/[a-z0-9\/_.-]+)*)$/;

export async function grantSudo(username, rule) {
  if (rule.includes('..')) {
    throw new Error('Invalid sudo rule format: path traversal not allowed');
  }
  if (!SUDO_RULE_RE.test(rule)) {
    throw new Error('Invalid sudo rule format. Expected: ALL=(ALL) ALL or ALL=(ALL) NOPASSWD: /path/to/cmd');
  }
  const content = `${username} ${rule}\n`;
  const filePath = `/etc/sudoers.d/${username}`;
  await writeFile(filePath, content, { mode: 0o440 });
  try { await execute('visudo', ['-c', '-f', filePath]); }
  catch (err) { await unlink(filePath); throw new Error(`Invalid sudoers syntax: ${err.message}`); }
}

export async function modifySudo(username, rule) { await grantSudo(username, rule); }

export async function revokeSudo(username) {
  try { await unlink(`/etc/sudoers.d/${username}`); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
}
