import { describe, it, expect, jest } from '@jest/globals';
import { isDocker, buildCommand } from '../services/executor.js';

describe('buildCommand', () => {
  it('returns command directly when not in Docker', () => {
    const result = buildCommand('useradd', ['testuser'], false);
    expect(result).toEqual({ cmd: 'useradd', args: ['testuser'] });
  });
  it('wraps with nsenter when in Docker', () => {
    const result = buildCommand('useradd', ['testuser'], true);
    expect(result.cmd).toBe('nsenter');
    expect(result.args).toEqual(['-t', '1', '-m', '-u', '-i', '-n', '--', 'useradd', 'testuser']);
  });
});
