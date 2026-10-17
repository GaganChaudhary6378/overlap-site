import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { generateKeyPair, SignJWT } from 'jose';
import { createAttempt, validateCallback, verifyIdentity, completedText, mergeCredentials } from '../bridge/oauth.mjs';
import { createBridge, escape } from '../bridge/server.mjs';

test('registration uses fresh PKCE, state, nonce, stable host and rejects forged callbacks', () => {
  const a = createAttempt('urn:uuid:test', null, 'http://127.0.0.1:4319/auth/callback');
  const b = createAttempt('urn:uuid:test', null, a.redirectUri);
  const query = new URL(a.url).searchParams;
  assert.equal(query.get('client_id'), 'dynamic_agent_client');
  assert.equal(query.get('ext_agent_host_id'), 'urn:uuid:test');
  assert.equal(query.get('code_challenge_method'), 'S256');
  assert.notEqual(a.state, b.state); assert.notEqual(a.verifier, b.verifier);
  assert.throws(() => validateCallback(new URLSearchParams({ state: 'forged' }), a));
  assert.throws(() => validateCallback(new URLSearchParams({ state: a.state, error: 'access_denied' }), a));
  assert.throws(() => validateCallback(new URLSearchParams({ state: a.state, code: 'code' }), a));
  assert.equal(validateCallback(new URLSearchParams({ state: a.state, code: 'code', client_id: 'oaiapp_test' }), a).clientId, 'oaiapp_test');
  const returning = createAttempt('host', { client_id: 'old' }, a.redirectUri);
  assert.throws(() => validateCallback(new URLSearchParams({ state: returning.state, code: 'code', client_id: 'new' }), returning));
});

test('ID token checks cryptographic signature, issuer, audience, expiry and nonce', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({ nonce: 'nonce', email: 'person@example.test' }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('app').setSubject('person').setIssuedAt().setExpirationTime('1m').sign(privateKey);
  assert.equal((await verifyIdentity(token, 'app', 'nonce', publicKey)).subject, 'person');
  await assert.rejects(verifyIdentity(token, 'other-app', 'nonce', publicKey));
  await assert.rejects(verifyIdentity(token, 'app', 'wrong', publicKey));
  const { publicKey: otherKey } = await generateKeyPair('RS256');
  await assert.rejects(verifyIdentity(token, 'app', 'nonce', otherKey));
});

async function* chunks(text) { const bytes = new TextEncoder().encode(text); for (let i = 0; i < bytes.length; i += 7) yield bytes.slice(i, i + 7); }
test('stream requires completed event, handles fragmented UTF-8, rejects failure', async () => {
  assert.equal(await completedText(chunks('data: {"type":"response.output_text.delta","delta":"Hi 👋"}\n\ndata: {"type":"response.completed"}\n\n')), 'Hi 👋');
  await assert.rejects(completedText(chunks('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')));
  await assert.rejects(completedText(chunks('data: {"type":"response.failed"}\n\n')));
});
test('refresh rotates credentials together and preserves granted scope if omitted', () => {
  const next = mergeCredentials({ access_token: 'new', refresh_token: 'rotated', expires_in: 100 }, { scopes: ['scope'], refresh_token: 'old' });
  assert.equal(next.refresh_token, 'rotated'); assert.deepEqual(next.scopes, ['scope']);
  assert.ok(next.expires > Date.now());
  assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

test('local bridge rejects DNS rebinding and cross-origin POST requests', async () => {
  const server = createBridge({ hostId: 'test', port: 14319, storage: { read: async () => null } });
  await new Promise(resolve => server.listen(14319, '127.0.0.1', resolve));
  try {
    const page = await fetch('http://127.0.0.1:14319/');
    assert.equal(page.status, 200); assert.match(await page.text(), /Continue with ChatGPT/);
    const denied = await fetch('http://127.0.0.1:14319/connect', { method: 'POST', headers: { origin: 'https://attacker.example' } });
    assert.equal(denied.status, 403);
    const status = await new Promise((resolve, reject) => {
      const req = request('http://127.0.0.1:14319/', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(status, 403);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
