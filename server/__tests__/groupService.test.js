import { describe, it, expect } from '@jest/globals';
import { parseGroup } from '../services/groupService.js';

const GROUP_DATA = `root:x:0:
daemon:x:1:
developers:x:1001:jdoe,alice
docker:x:999:jdoe
`;

describe('parseGroup', () => {
  it('parses /etc/group format', () => {
    const groups = parseGroup(GROUP_DATA);
    expect(groups).toHaveLength(4);
    expect(groups[2]).toEqual({ name: 'developers', gid: 1001, members: ['jdoe', 'alice'] });
  });
  it('handles empty member list', () => {
    const groups = parseGroup('root:x:0:\n');
    expect(groups[0].members).toEqual([]);
  });
  it('skips empty lines', () => {
    const groups = parseGroup('root:x:0:\n\n');
    expect(groups).toHaveLength(1);
  });
});
