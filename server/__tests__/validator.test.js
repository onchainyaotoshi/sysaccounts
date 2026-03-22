import { describe, it, expect } from '@jest/globals';
import { validateUsername, validateGroupname, validateShell, validateTerminal, validatePassword, validateHome, validateInteger, validateGecos, validateRequired } from '../validator.js';
import { CommandError } from '../errors.js';

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

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('securepass123')).toBe(true);
    expect(validatePassword('a'.repeat(1024))).toBe(true);
    expect(validatePassword('p@$$w0rd!')).toBe(true);
  });
  it('rejects passwords with newlines', () => {
    expect(validatePassword('pass\nword')).toBe(false);
    expect(validatePassword('pass\rword')).toBe(false);
    expect(validatePassword('user:pass\nanother:pass')).toBe(false);
  });
  it('rejects passwords with colons', () => {
    expect(validatePassword('user:password')).toBe(false);
  });
  it('rejects passwords too short', () => {
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword('1234567')).toBe(false);
  });
  it('rejects passwords too long', () => {
    expect(validatePassword('a'.repeat(1025))).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(validatePassword(12345678)).toBe(false);
    expect(validatePassword(null)).toBe(false);
    expect(validatePassword(undefined)).toBe(false);
  });
});

describe('validateHome', () => {
  it('accepts valid home paths', () => {
    expect(validateHome('/home/jdoe')).toBe(true);
    expect(validateHome('/var/lib/service')).toBe(true);
  });
  it('rejects path traversal', () => {
    expect(validateHome('/home/../etc/shadow')).toBe(false);
    expect(validateHome('/home/user/../../root')).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(validateHome(123)).toBe(false);
    expect(validateHome(null)).toBe(false);
  });
});

describe('validateInteger with range', () => {
  it('accepts integers within range', () => {
    expect(validateInteger(0, 0, 99999)).toBe(true);
    expect(validateInteger(99999, 0, 99999)).toBe(true);
    expect(validateInteger(500, 0, 99999)).toBe(true);
    expect(validateInteger('42', 0, 99999)).toBe(true);
  });
  it('rejects integers outside range', () => {
    expect(validateInteger(-1, 0, 99999)).toBe(false);
    expect(validateInteger(100000, 0, 99999)).toBe(false);
  });
  it('still works without range (backward compat)', () => {
    expect(validateInteger(42)).toBe(true);
    expect(validateInteger(-5)).toBe(true);
    expect(validateInteger('abc')).toBe(false);
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

describe('validateUsername edge cases', () => {
  it('rejects null and undefined', () => {
    expect(validateUsername(null)).toBe(false);
    expect(validateUsername(undefined)).toBe(false);
  });
  it('rejects objects and numbers', () => {
    expect(validateUsername({})).toBe(false);
    expect(validateUsername(42)).toBe(false);
  });
});

describe('validateHome edge cases', () => {
  it('rejects strings over 255 chars', () => {
    expect(validateHome('/' + 'a'.repeat(256))).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateHome('')).toBe(false);
  });
  it('rejects relative paths', () => {
    expect(validateHome('home/user')).toBe(false);
  });
});

describe('validateGecos', () => {
  it('accepts valid GECOS', () => {
    expect(validateGecos('John Doe')).toBe(true);
    expect(validateGecos('User, Room 123, x1234')).toBe(true);
  });
  it('rejects GECOS with colon', () => {
    expect(validateGecos('user:info')).toBe(false);
  });
  it('rejects GECOS with newline', () => {
    expect(validateGecos('user\ninfo')).toBe(false);
  });
  it('rejects GECOS over 255 chars', () => {
    expect(validateGecos('a'.repeat(256))).toBe(false);
  });
  it('rejects non-string', () => {
    expect(validateGecos(123)).toBe(false);
    expect(validateGecos(null)).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns null when all fields present', () => {
    expect(validateRequired({ a: 'x', b: 'y' }, ['a', 'b'])).toBeNull();
  });
  it('returns missing fields message', () => {
    expect(validateRequired({ a: 'x' }, ['a', 'b'])).toContain('b');
  });
  it('rejects empty string values', () => {
    expect(validateRequired({ a: '' }, ['a'])).toContain('a');
  });
  it('rejects null values', () => {
    expect(validateRequired({ a: null }, ['a'])).toContain('a');
  });
});

describe('CommandError', () => {
  it('creates error with default code', () => {
    const err = new CommandError('something failed');
    expect(err.message).toBe('something failed');
    expect(err.code).toBe('COMMAND_FAILED');
    expect(err.name).toBe('CommandError');
    expect(err instanceof Error).toBe(true);
  });
  it('creates error with custom code', () => {
    const err = new CommandError('user exists', 'USER_EXISTS');
    expect(err.message).toBe('user exists');
    expect(err.code).toBe('USER_EXISTS');
  });
});
