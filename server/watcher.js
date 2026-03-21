import chokidar from 'chokidar';
import { listUsers } from './services/userService.js';
import { listGroups } from './services/groupService.js';

export function startWatcher(io) {
  const userFiles = ['/etc/passwd', '/etc/shadow'];
  const groupFiles = ['/etc/group'];
  let debounceUser = null;
  let debounceGroup = null;

  const userWatcher = chokidar.watch(userFiles, { persistent: true, usePolling: true, interval: 2000 });
  const groupWatcher = chokidar.watch(groupFiles, { persistent: true, usePolling: true, interval: 2000 });

  userWatcher.on('change', () => {
    clearTimeout(debounceUser);
    debounceUser = setTimeout(async () => {
      try { const users = await listUsers(); io.emit('users:changed', { type: 'users', data: users }); }
      catch (err) { console.error('Failed to broadcast user changes:', err.message); }
    }, 500);
  });

  groupWatcher.on('change', () => {
    clearTimeout(debounceGroup);
    debounceGroup = setTimeout(async () => {
      try { const groups = await listGroups(); io.emit('groups:changed', { type: 'groups', data: groups }); }
      catch (err) { console.error('Failed to broadcast group changes:', err.message); }
    }, 500);
  });

  return { userWatcher, groupWatcher };
}
