import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
let configured = '';
try { configured = execFileSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim(); } catch {}
if (configured) throw new Error('Existing core.hooksPath found; add npm run secrets to your hook manager instead.');
for (const [name, args] of [['pre-commit', '--staged'], ['pre-push', '--history']]) {
  const path = resolve(execFileSync('git', ['rev-parse', '--git-path', `hooks/${name}`], { encoding: 'utf8' }).trim());
  const content = `#!/bin/sh\ncd "$(git rev-parse --show-toplevel)" || exit 1\nnode scripts/check-secrets.mjs ${args}\n`;
  if (existsSync(path)) {
    const { readFileSync } = await import('node:fs');
    if (readFileSync(path, 'utf8') !== content) throw new Error(`Existing ${name} preserved; add the secret check manually.`);
  } else writeFileSync(path, content, { mode: 0o700 });
}
console.log('Secret checks installed for commits and pushes.');
