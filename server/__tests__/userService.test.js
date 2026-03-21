import { describe, it, expect } from '@jest/globals';
import { parsePasswd, parseShadow, mergeUserData } from '../services/userService.js';

const PASSWD_DATA = `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
jdoe:x:1001:1001:John Doe:/home/jdoe:/bin/bash
`;

const SHADOW_DATA = `root:$6$hash:19000:0:99999:7:::
daemon:*:19000:0:99999:7:::
jdoe:$6$hash2:19500:0:90:7:30::
`;

describe('parsePasswd', () => {
  it('parses /etc/passwd format', () => {
    const users = parsePasswd(PASSWD_DATA);
    expect(users).toHaveLength(3);
    expect(users[2]).toEqual({
      username: 'jdoe', uid: 1001, gid: 1001,
      gecos: 'John Doe', home: '/home/jdoe', shell: '/bin/bash',
    });
  });
  it('skips empty lines', () => {
    const users = parsePasswd('root:x:0:0:root:/root:/bin/bash\n\n');
    expect(users).toHaveLength(1);
  });
});

describe('parseShadow', () => {
  it('parses /etc/shadow format', () => {
    const shadow = parseShadow(SHADOW_DATA);
    expect(shadow.jdoe).toBeDefined();
    expect(shadow.jdoe.locked).toBe(false);
    expect(shadow.jdoe.lastChanged).toBe(19500);
    expect(shadow.jdoe.maxDays).toBe(90);
    expect(shadow.jdoe.inactiveDays).toBe(30);
  });
  it('detects locked accounts', () => {
    const shadow = parseShadow('locked:!$6$hash:19000:0:99999:7:::\n');
    expect(shadow.locked.locked).toBe(true);
  });
  it('detects disabled accounts', () => {
    const shadow = parseShadow('daemon:*:19000:0:99999:7:::\n');
    expect(shadow.daemon.locked).toBe(true);
  });
});

describe('mergeUserData', () => {
  it('merges passwd and shadow data', () => {
    const users = parsePasswd(PASSWD_DATA);
    const shadow = parseShadow(SHADOW_DATA);
    const merged = mergeUserData(users, shadow);
    expect(merged[2].locked).toBe(false);
    expect(merged[2].passwordAging.maxDays).toBe(90);
  });
});
