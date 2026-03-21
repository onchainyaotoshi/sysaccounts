import { readFile } from 'fs/promises';
import { execute } from './executor.js';

export function parseGroup(data) {
  return data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [name, , gid, memberStr] = line.split(':');
      return { name, gid: Number(gid), members: memberStr ? memberStr.split(',').filter(Boolean) : [] };
    });
}

export async function listGroups() {
  const data = await readFile('/etc/group', 'utf-8');
  return parseGroup(data);
}

export async function createGroup(name, gid) {
  const args = gid !== undefined ? ['-g', String(gid), name] : [name];
  await execute('groupadd', args);
}

export async function deleteGroup(name) { await execute('groupdel', [name]); }

export async function modifyGroup(name, { newName, gid }) {
  const args = [];
  if (newName) args.push('-n', newName);
  if (gid !== undefined) args.push('-g', String(gid));
  if (args.length === 0) return;
  args.push(name);
  await execute('groupmod', args);
}

export async function addMember(groupName, username) { await execute('gpasswd', ['-a', username, groupName]); }
export async function removeMember(groupName, username) { await execute('gpasswd', ['-d', username, groupName]); }
