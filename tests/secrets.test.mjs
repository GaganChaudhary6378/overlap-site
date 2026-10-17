import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSecret, unsafePath } from '../scripts/check-secrets.mjs';
test('flags common secrets without leaking values', () => {
  assert.ok(hasSecret('sk-' + 'a'.repeat(40)));
  assert.ok(hasSecret('-----BEGIN ' + 'PRIVATE KEY-----'));
  assert.ok(hasSecret(JSON.stringify({ refresh_token: 'a'.repeat(40) })));
  assert.equal(hasSecret('your-public-anon-key'), false);
});
test('real environment files are blocked, placeholder example allowed', () => {
  assert.ok(unsafePath('.env.local')); assert.ok(unsafePath('nested/.env'));
  assert.equal(unsafePath('.env.example'), false);
});
