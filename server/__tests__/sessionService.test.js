import { describe, it, expect } from '@jest/globals';
import { parseWho, parseLast } from '../services/sessionService.js';

describe('parseWho', () => {
  it('parses who output', () => {
    const output = `jdoe     pts/0        2026-03-21 10:00 (192.168.1.5)
root     tty1         2026-03-21 08:00
`;
    const sessions = parseWho(output);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toEqual({ user: 'jdoe', terminal: 'pts/0', date: '2026-03-21 10:00', host: '192.168.1.5' });
    expect(sessions[1].host).toBe('');
  });
});

describe('parseLast', () => {
  it('parses last output', () => {
    const output = `jdoe     pts/0        192.168.1.5      Fri Mar 21 10:00   still logged in
root     tty1                          Fri Mar 21 08:00 - 09:00  (01:00)

wtmp begins Fri Mar  1 00:00:00 2026
`;
    const logins = parseLast(output);
    expect(logins).toHaveLength(2);
    expect(logins[0].user).toBe('jdoe');
    expect(logins[0].host).toBe('192.168.1.5');
    expect(logins[0].duration).toBe('still logged in');
  });
});
