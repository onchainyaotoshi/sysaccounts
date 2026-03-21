import { readFile } from 'fs/promises';
import { execute } from './executor.js';

export function parsePasswd(data) {
  return data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [username, , uid, gid, gecos, home, shell] = line.split(':');
      return { username, uid: Number(uid), gid: Number(gid), gecos: gecos || '', home, shell };
    });
}

export function parseShadow(data) {
  const map = {};
  data
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .forEach(line => {
      const [username, hash, lastChanged, minDays, maxDays, warnDays, inactiveDays, expireDate] = line.split(':');
      const locked = hash.startsWith('!') || hash === '*' || hash === '!!';
      map[username] = {
        locked,
        lastChanged: lastChanged ? Number(lastChanged) : null,
        minDays: minDays ? Number(minDays) : 0,
        maxDays: maxDays ? Number(maxDays) : 99999,
        warnDays: warnDays ? Number(warnDays) : 7,
        inactiveDays: inactiveDays ? Number(inactiveDays) : -1,
        expireDate: expireDate || null,
      };
    });
  return map;
}

export function mergeUserData(users, shadow) {
  return users.map(user => {
    const s = shadow[user.username] || {};
    return {
      ...user,
      locked: s.locked ?? false,
      passwordAging: {
        lastChanged: s.lastChanged ?? null,
        minDays: s.minDays ?? 0,
        maxDays: s.maxDays ?? 99999,
        warnDays: s.warnDays ?? 7,
        inactiveDays: s.inactiveDays ?? -1,
        expireDate: s.expireDate ?? null,
      },
    };
  });
}

export async function listUsers() {
  const [passwdData, shadowData] = await Promise.all([
    readFile('/etc/passwd', 'utf-8'),
    readFile('/etc/shadow', 'utf-8').catch(() => ''),
  ]);
  const users = parsePasswd(passwdData);
  const shadow = parseShadow(shadowData);
  return mergeUserData(users, shadow);
}

export async function getUserGroups(username) {
  const output = await execute('groups', [username]);
  const parts = output.split(':');
  return parts.length > 1 ? parts[1].trim().split(/\s+/) : [];
}

export async function getUserDetail(username) {
  const users = await listUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;

  const groups = await getUserGroups(username);

  let sudo = { hasSudo: false, rules: [] };
  try {
    const sudoOutput = await execute('sudo', ['-l', '-U', username]);
    const rules = sudoOutput
      .split('\n')
      .filter(line => line.trim().startsWith('('))
      .map(line => line.trim());
    if (rules.length > 0) {
      sudo = { hasSudo: true, rules };
    }
  } catch { /* no sudo access */ }

  let lastLogin = null;
  try {
    const lastOutput = await execute('last', ['-1', '-F', username]);
    const firstLine = lastOutput.split('\n')[0];
    if (firstLine && !firstLine.includes('wtmp')) {
      const dateMatch = firstLine.match(/\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4}/);
      if (dateMatch) lastLogin = new Date(dateMatch[0]).toISOString();
    }
  } catch { /* no login history */ }

  return { ...user, groups, sudo, lastLogin };
}

export async function createUser({ username, password, shell, home, gecos, groups, createHome }) {
  const args = [];
  if (shell) args.push('-s', shell);
  if (home) args.push('-d', home);
  if (gecos) args.push('-c', gecos);
  if (createHome) args.push('-m');
  if (groups && groups.length > 0) args.push('-G', groups.join(','));
  args.push(username);
  await execute('useradd', args);
  if (password) {
    await changePassword(username, password);
  }
}

export async function deleteUser(username, removeHome = false) {
  const args = removeHome ? ['-r', username] : [username];
  await execute('userdel', args);
}

export async function modifyUser(username, { shell, home, gecos }) {
  const args = [];
  if (shell) args.push('-s', shell);
  if (home) args.push('-d', home);
  if (gecos) args.push('-c', gecos);
  if (args.length === 0) return;
  args.push(username);
  await execute('usermod', args);
}

export async function lockUser(username, locked) {
  const flag = locked ? '-L' : '-U';
  await execute('usermod', [flag, username]);
}

export async function changePassword(username, password) {
  const { execFile } = await import('child_process');
  const inDocker = await (await import('./executor.js')).isDocker();
  const { cmd, args } = (await import('./executor.js')).buildCommand('chpasswd', [], inDocker);

  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, (error) => {
      if (error) reject(new Error(error.message));
      else resolve();
    });
    proc.stdin.write(`${username}:${password}\n`);
    proc.stdin.end();
  });
}

export async function changeAging(username, { minDays, maxDays, warnDays, inactiveDays, expireDate }) {
  const args = [];
  if (minDays !== undefined) args.push('-m', String(minDays));
  if (maxDays !== undefined) args.push('-M', String(maxDays));
  if (warnDays !== undefined) args.push('-W', String(warnDays));
  if (inactiveDays !== undefined) args.push('-I', String(inactiveDays));
  if (expireDate !== undefined) args.push('-E', expireDate || '-1');
  if (args.length === 0) return;
  args.push(username);
  await execute('chage', args);
}
