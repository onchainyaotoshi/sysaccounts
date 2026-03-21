import { execute } from './executor.js';

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

function toISO(dateStr) {
  if (!dateStr) return '';
  // Already YYYY-MM-DD HH:mm
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateStr)) return dateStr.slice(0, 16);
  const now = new Date();
  // "Fri Mar 21 10:30:00 2025" or "Mar 21 10:30:00 2025" (last -F)
  const fullMatch = dateStr.match(/(\w{3})\s+(\d+)\s+(\d{2}:\d{2})(?::\d{2})?\s+(\d{4})/);
  if (fullMatch) {
    const [, mon, day, time, year] = fullMatch;
    return `${year}-${MONTHS[mon] || '01'}-${day.padStart(2, '0')} ${time}`;
  }
  // "Mon Mar 21 10:30" or "Mar 21 10:30"
  const shortMatch = dateStr.match(/(\w{3})\s+(\d+)\s+(\d{2}:\d{2})/);
  if (shortMatch) {
    const [, mon, day, time] = shortMatch;
    const year = now.getFullYear();
    return `${year}-${MONTHS[mon] || '01'}-${day.padStart(2, '0')} ${time}`;
  }
  return dateStr;
}

export function parseWho(output) {
  return output.split('\n').filter(line => line.trim()).map(line => {
    const parts = line.trim().split(/\s+/);
    const hostMatch = line.match(/\((.+)\)/);
    // Match ISO format or "Mon DD HH:MM" style
    const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
    const textMatch = line.match(/(\w{3}\s+\d+\s+\d{2}:\d{2})/);
    const rawDate = isoMatch ? isoMatch[1] : (textMatch ? textMatch[1] : `${parts[2]} ${parts[3]}`);
    return { user: parts[0], terminal: parts[1], date: toISO(rawDate), host: hostMatch ? hostMatch[1] : '' };
  });
}

export function parseLast(output) {
  return output.split('\n')
    .filter(line => line.trim() && !line.startsWith('wtmp') && !line.startsWith('reboot'))
    .map(line => {
      const parts = line.trim().split(/\s+/);
      const user = parts[0];
      const terminal = parts[1];
      const hostCandidate = parts[2];
      const isHost = hostCandidate && (hostCandidate.includes('.') || hostCandidate.includes(':'));
      const host = isHost ? hostCandidate : '';
      // Match full date with year first, then without year
      const fullDateMatch = line.match(/(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}(?::\d{2})?\s+\d{4})/);
      const shortDateMatch = line.match(/(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2})/);
      const rawDate = fullDateMatch ? fullDateMatch[1] : (shortDateMatch ? shortDateMatch[1] : '');
      const durationMatch = line.match(/\((.+?)\)/);
      const stillIn = line.includes('still logged in');
      const duration = stillIn ? 'still logged in' : (durationMatch ? durationMatch[1] : '');
      return { user, terminal, host, date: toISO(rawDate), duration };
    });
}

export async function getActiveSessions() {
  try { const output = await execute('who', []); return parseWho(output); } catch { return []; }
}

export async function getLastLogins(limit = 50) {
  try { const output = await execute('last', ['-F', '-n', String(limit)]); return parseLast(output); } catch { return []; }
}

export async function killSession(terminal) {
  if (!/^(pts\/\d+|tty\d+)$/.test(terminal)) {
    throw new Error('Invalid terminal name');
  }
  const output = await execute('pkill', ['-9', '-t', terminal]);
  return output;
}
