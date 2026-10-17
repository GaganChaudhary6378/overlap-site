import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b/,
  /["'](?:access_token|refresh_token|service_role_key)["']\s*:\s*["'][A-Za-z0-9._-]{24,}["']/i,
];

export function hasSecret(text) { return patterns.some(pattern => pattern.test(text)); }
export function unsafePath(path) {
  return /(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example') || /\.(?:pem|key|p12|pfx)$/.test(path);
}

export function scan() {
  const staged = process.argv.includes('--staged');
  const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'] : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  const paths = execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
  const failures = [];
  for (const path of paths) {
    let data;
    try { data = staged ? execFileSync('git', ['show', `:${path}`]) : readFileSync(path); }
    catch { continue; }
    if (unsafePath(path) || !data.includes(0) && hasSecret(data.toString('utf8'))) failures.push(path);
  }
  // Scan all reachable history, including files deleted from the current tree.
  if (process.argv.includes('--history')) {
    const history = execFileSync('git', ['log', '--all', '-p', '--format=commit %h', '--no-ext-diff'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (hasSecret(history)) failures.push('Git history (review locally with a redacting scanner)');
  }
  if (failures.length) throw new Error(`Possible secrets detected; values hidden:\n${[...new Set(failures)].join('\n')}`);
  console.log(`Secret check passed (${paths.length} paths${process.argv.includes('--history') ? ', reachable history included' : ''}). Pattern checks cannot detect every kind of secret.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { scan(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
