import { describe, it, expect } from '@jest/globals';
import { validateUsername, validateGroupname, validateShell, validateTerminal } from '../validator.js';

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('jdoe')).toBe(true);
    expect(validateUsername('_backup')).toBe(true);
    expect(validateUsername('user-name')).toBe(true);
    expect(validateUsername('user_123')).toBe(true);
  });
  it('rejects invalid usernames', () => {
    expect(validateUsername('')).toBe(false);
    expect(validateUsername('123user')).toBe(false);
    expect(validateUsername('User')).toBe(false);
    expect(validateUsername('user name')).toBe(false);
    expect(validateUsername('a'.repeat(33))).toBe(false);
    expect(validateUsername('user;rm')).toBe(false);
  });
});

describe('validateGroupname', () => {
  it('accepts valid group names', () => { expect(validateGroupname('developers')).toBe(true); });
  it('rejects invalid group names', () => {
    expect(validateGroupname('')).toBe(false);
    expect(validateGroupname('123group')).toBe(false);
  });
});

describe('validateShell', () => {
  it('accepts valid shell paths', () => {
    expect(validateShell('/bin/bash')).toBe(true);
    expect(validateShell('/bin/zsh')).toBe(true);
    expect(validateShell('/usr/bin/fish')).toBe(true);
    expect(validateShell('/sbin/nologin')).toBe(true);
  });
  it('rejects invalid shell paths', () => {
    expect(validateShell('bash')).toBe(false);
    expect(validateShell('/bin/bash; rm -rf')).toBe(false);
    expect(validateShell('')).toBe(false);
  });
});

describe('validateTerminal', () => {
  it('accepts valid terminal names', () => {
    expect(validateTerminal('pts/0')).toBe(true);
    expect(validateTerminal('pts/12')).toBe(true);
    expect(validateTerminal('tty1')).toBe(true);
    expect(validateTerminal('tty99')).toBe(true);
  });
  it('rejects invalid terminal names', () => {
    expect(validateTerminal('')).toBe(false);
    expect(validateTerminal('pts/0; rm -rf /')).toBe(false);
    expect(validateTerminal('../etc/passwd')).toBe(false);
    expect(validateTerminal('tty')).toBe(false);
    expect(validateTerminal(123)).toBe(false);
    expect(validateTerminal(null)).toBe(false);
  });
});
