import { execute } from './executor.js';

export function parseWho(output) {
  return output.split('\n').filter(line => line.trim()).map(line => {
    const parts = line.trim().split(/\s+/);
    const hostMatch = line.match(/\((.+)\)/);
    return { user: parts[0], terminal: parts[1], date: `${parts[2]} ${parts[3]}`, host: hostMatch ? hostMatch[1] : '' };
  });
}

export function parseLast(output) {
  return output.split('\n')
    .filter(line => line.trim() && !line.startsWith('wtmp') && !line.startsWith('reboot'))
    .filter(line => line.trim())
    .map(line => {
      const parts = line.trim().split(/\s+/);
      const user = parts[0];
      const terminal = parts[1];
      const hostCandidate = parts[2];
      const isHost = hostCandidate && (hostCandidate.includes('.') || hostCandidate.includes(':'));
      const host = isHost ? hostCandidate : '';
      const durationMatch = line.match(/\((.+?)\)/);
      const stillIn = line.includes('still logged in');
      const duration = stillIn ? 'still logged in' : (durationMatch ? durationMatch[1] : '');
      return { user, terminal, host, duration };
    });
}

export async function getActiveSessions() {
  try { const output = await execute('who', []); return parseWho(output); } catch { return []; }
}

export async function getLastLogins(limit = 50) {
  try { const output = await execute('last', ['-n', String(limit)]); return parseLast(output); } catch { return []; }
}
