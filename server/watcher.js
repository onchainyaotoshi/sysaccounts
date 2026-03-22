import chokidar from 'chokidar';

export function startWatcher(io) {
  const userFiles = ['/etc/passwd', '/etc/shadow'];
  const groupFiles = ['/etc/group'];
  let debounceUser = null;
  let debounceGroup = null;

  const userWatcher = chokidar.watch(userFiles, { persistent: true, usePolling: true, interval: 2000 });
  const groupWatcher = chokidar.watch(groupFiles, { persistent: true, usePolling: true, interval: 2000 });

  userWatcher.on('change', () => {
    clearTimeout(debounceUser);
    debounceUser = setTimeout(() => {
      try { io.emit('users:changed'); }
      catch (err) { console.error('Failed to broadcast user changes:', err.message); }
    }, 500);
  });

  groupWatcher.on('change', () => {
    clearTimeout(debounceGroup);
    debounceGroup = setTimeout(() => {
      try { io.emit('groups:changed'); }
      catch (err) { console.error('Failed to broadcast group changes:', err.message); }
    }, 500);
  });

  return { userWatcher, groupWatcher };
}
