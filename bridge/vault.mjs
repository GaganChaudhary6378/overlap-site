import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const binary = resolve(root, '.local/keychain');
export async function prepareVault() {
  if (process.platform !== 'darwin') throw new Error('The secure local bridge currently requires macOS Keychain.');
  try { await access(binary); } catch {
    await mkdir(resolve(root, '.local'), { recursive: true, mode: 0o700 });
    await execute('swiftc', [resolve(root, 'scripts/keychain.swift'), '-o', binary]);
  }
}
function operation(command, account, value) {
  return new Promise((resolve, reject) => {
    const child = execFile(binary, [command, account], { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) reject(new Error('Keychain is unavailable. Unlock your Mac and allow Overlap access.'));
      else { try { resolve(stdout ? JSON.parse(stdout) : null); } catch { reject(new Error('Invalid Keychain record.')); } }
    });
    child.stdin.end(value === undefined ? '' : JSON.stringify(value));
  });
}
export const vault = {
  read: (account = 'chatgpt') => operation('read', account),
  write: (value, account = 'chatgpt') => operation('write', account, value),
  delete: (account = 'chatgpt') => operation('delete', account),
};
