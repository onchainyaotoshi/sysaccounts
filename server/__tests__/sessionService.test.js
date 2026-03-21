import { describe, it, expect } from '@jest/globals';
import { parseWho, parseLast } from '../services/sessionService.js';

describe('parseWho', () => {
  it('parses who output with ISO dates', () => {
    const output = `jdoe     pts/0        2026-03-21 10:00 (192.168.1.5)
root     tty1         2026-03-21 08:00
`;
    const sessions = parseWho(output);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toEqual({ user: 'jdoe', terminal: 'pts/0', date: '2026-03-21 10:00', host: '192.168.1.5' });
    expect(sessions[1].host).toBe('');
    expect(sessions[1].date).toBe('2026-03-21 08:00');
  });

  it('parses who output with text dates', () => {
    const output = `jdoe     pts/0        Mar 21 10:30 (10.0.0.1)\n`;
    const sessions = parseWho(output);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toMatch(/^\d{4}-03-21 10:30$/);
  });

  it('returns empty array for empty output', () => {
    expect(parseWho('')).toEqual([]);
  });
});

describe('parseLast', () => {
  it('parses last output with dates in YYYY-MM-DD HH:mm format', () => {
    const output = `jdoe     pts/0        192.168.1.5      Fri Mar 21 10:00   still logged in
root     tty1                          Fri Mar 21 08:00 - 09:00  (01:00)

wtmp begins Fri Mar  1 00:00:00 2026
`;
    const logins = parseLast(output);
    expect(logins).toHaveLength(2);
    expect(logins[0].user).toBe('jdoe');
    expect(logins[0].host).toBe('192.168.1.5');
    expect(logins[0].duration).toBe('still logged in');
    expect(logins[0].date).toMatch(/^\d{4}-03-21 10:00$/);
    expect(logins[1].date).toMatch(/^\d{4}-03-21 08:00$/);
    expect(logins[1].duration).toBe('01:00');
  });

  it('parses last -F output with full year', () => {
    const output = `jdoe     pts/0        192.168.1.5      Fri Mar 21 10:30:45 2026   still logged in\n`;
    const logins = parseLast(output);
    expect(logins).toHaveLength(1);
    expect(logins[0].date).toBe('2026-03-21 10:30');
  });

  it('filters out wtmp and reboot lines', () => {
    const output = `reboot   system boot  5.15.0-170-generic\nwtmp begins Fri Mar  1 00:00:00 2026\n`;
    expect(parseLast(output)).toEqual([]);
  });

  it('returns empty array for empty output', () => {
    expect(parseLast('')).toEqual([]);
  });
});
