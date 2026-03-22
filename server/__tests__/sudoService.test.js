import { describe, it, expect } from '@jest/globals';
import { parseSudoersFile, grantSudo } from '../services/sudoService.js';

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

describe('grantSudo validation', () => {
  it('rejects rules with path traversal', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL) /usr/../bin/bash')).rejects.toThrow('Path traversal not allowed in sudo rules');
  });
  it('rejects rules with .. in paths', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL) NOPASSWD: /home/../../etc/shadow')).rejects.toThrow('Path traversal not allowed in sudo rules');
  });
  it('rejects rules with invalid user spec in parens', async () => {
    await expect(grantSudo('testuser', 'ALL=(ALL; rm -rf /) ALL')).rejects.toThrow('Invalid sudo rule');
  });
  it('accepts valid standard rules (fails at execute, not validation)', async () => {
    // These should NOT fail at the validation step.
    // They may fail at execute/write since we can't actually write sudoers in test.
    // We check that the error message is NOT about invalid sudo rule format.
    try {
      await grantSudo('testuser', 'ALL=(ALL) ALL');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
    try {
      await grantSudo('testuser', 'ALL=(ALL) NOPASSWD: /usr/bin/apt');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
    try {
      await grantSudo('testuser', 'ALL=(root:wheel) NOPASSWD: /usr/bin/systemctl');
    } catch (err) {
      expect(err.message).not.toMatch(/Invalid sudo rule/);
    }
  });
});
