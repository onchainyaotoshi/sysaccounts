import { describe, it, expect } from '@jest/globals';
import { parseSudoersFile } from '../services/sudoService.js';

describe('parseSudoersFile', () => {
  it('parses user rules from sudoers content', () => {
    const content = `# sudoers file
root ALL=(ALL:ALL) ALL
%admin ALL=(ALL) ALL
jdoe ALL=(ALL) NOPASSWD: /usr/bin/apt
`;
    const rules = parseSudoersFile(content);
    expect(rules).toContainEqual({ username: 'root', rule: 'ALL=(ALL:ALL) ALL', type: 'user' });
    expect(rules).toContainEqual({ username: 'admin', rule: 'ALL=(ALL) ALL', type: 'group' });
    expect(rules).toContainEqual({ username: 'jdoe', rule: 'ALL=(ALL) NOPASSWD: /usr/bin/apt', type: 'user' });
  });
  it('skips comments and empty lines', () => {
    const content = `# comment\n\nDefaults env_reset\n`;
    const rules = parseSudoersFile(content);
    expect(rules).toEqual([]);
  });
});
