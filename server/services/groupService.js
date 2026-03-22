import { readFile } from 'fs/promises';
import { execute } from './executor.js';
import { CommandError } from '../errors.js';

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
  try {
    await execute('groupadd', args);
  } catch (err) {
    if (err.message.includes('already exists')) {
      throw new CommandError(err.message, 'GROUP_EXISTS');
    }
    throw new CommandError(err.message);
  }
}

export async function deleteGroup(name) {
  try {
    await execute('groupdel', [name]);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      throw new CommandError(err.message, 'GROUP_NOT_FOUND');
    }
    throw new CommandError(err.message);
  }
}

export async function modifyGroup(name, { newName, gid }) {
  const args = [];
  if (newName) args.push('-n', newName);
  if (gid !== undefined) args.push('-g', String(gid));
  if (args.length === 0) return;
  args.push(name);
  try {
    await execute('groupmod', args);
  } catch (err) {
    throw new CommandError(err.message);
  }
}

export async function addMember(groupName, username) {
  try {
    await execute('gpasswd', ['-a', username, groupName]);
  } catch (err) {
    throw new CommandError(err.message);
  }
}
export async function removeMember(groupName, username) {
  try {
    await execute('gpasswd', ['-d', username, groupName]);
  } catch (err) {
    throw new CommandError(err.message);
  }
}
