import { execFile } from 'child_process';
import { access } from 'fs/promises';

let _isDocker = null;

export async function isDocker() {
  if (_isDocker !== null) return _isDocker;
  try {
    await access('/.dockerenv');
    _isDocker = true;
  } catch {
    _isDocker = false;
  }
  return _isDocker;
}

export function buildCommand(cmd, args, inDocker) {
  if (inDocker) {
    return {
      cmd: 'nsenter',
      args: ['-t', '1', '-m', '-u', '-i', '-n', '--', cmd, ...args],
    };
  }
  return { cmd, args };
}

export async function execute(cmd, args = [], options = {}) {
  const inDocker = await isDocker();
  const { cmd: finalCmd, args: finalArgs } = buildCommand(cmd, args, inDocker);

  return new Promise((resolve, reject) => {
    const proc = execFile(finalCmd, finalArgs, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
    if (options.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }
  });
}
