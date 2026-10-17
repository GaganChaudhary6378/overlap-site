import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createBridge } from '../bridge/server.mjs';

test('disconnect cannot race an in-flight callback and credentials can then be deleted', { timeout: 10_000 }, async () => {
  const records = new Map();
  const storage = {
    read: async (key = 'chatgpt') => records.get(key) ?? null,
    write: async (value, key = 'chatgpt') => { records.set(key, value); },
    delete: async (key = 'chatgpt') => { records.delete(key); },
  };
  let finishExchange, markExchangeStarted;
  const exchangeStarted = new Promise(resolve => { markExchangeStarted = resolve; });
  const exchangeGate = new Promise(resolve => { finishExchange = resolve; });
  const fetcher = async (url) => {
    if (String(url).endsWith('/oauth/revoke')) return new Response('', { status: 200 });
    assert.match(String(url), /\/oauth\/token$/);
    markExchangeStarted();
    await exchangeGate;
    return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', id_token: 'fixture-identity', token_type: 'Bearer', expires_in: 3600, scope: 'chatgpt.tokens.use.direct' });
  };
  const port = 14320;
  const origin = `http://127.0.0.1:${port}`;
  const server = createBridge({ storage, hostId: 'urn:uuid:test', port, fetcher,
    verify: async () => ({ subject: 'fixture-user', email: 'person@example.test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  let callbackRequest;
  try {
    const page = await fetch(origin);
    const cookie = page.headers.get('set-cookie').split(';')[0];
    const html = await page.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    // Browser form redirects must be allowed to reach OpenAI's authorization page.
    assert.match(page.headers.get('content-security-policy'), /form-action[^;]*https:\/\/auth\.openai\.com/);
    const post = (path) => fetch(`${origin}${path}`, {
      method: 'POST', redirect: 'manual', headers: { cookie, origin, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf }),
    });
    const connect = await post('/connect');
    assert.equal(connect.status, 303);
    const state = new URL(connect.headers.get('location')).searchParams.get('state');
    const callbackQuery = new URLSearchParams({ state, code: 'fixture-code', client_id: 'oaiapp_fixture' });
    callbackRequest = fetch(`${origin}/auth/callback?${callbackQuery}`, { headers: { cookie }, redirect: 'manual' });
    await exchangeStarted;
    const denied = await post('/disconnect');
    assert.equal(denied.status, 409, 'disconnect must not report success while the callback can write credentials');
    finishExchange();
    assert.equal((await callbackRequest).status, 303);
    assert.equal(records.get('chatgpt').subject, 'fixture-user');
    assert.equal((await post('/disconnect')).status, 303);
    assert.equal(records.size, 0, 'successful disconnect removes credentials and registration');
  } finally {
    finishExchange();
    if (callbackRequest) await callbackRequest.catch(() => {});
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('malformed HTTP request paths return 400 and leave the bridge running', { timeout: 10_000 }, async () => {
  const port = 14321;
  const server = createBridge({ hostId: 'test', port, storage: { read: async () => null } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  try {
    const status = await new Promise((resolve, reject) => {
      const call = request({ hostname: '127.0.0.1', port, path: '//[', method: 'GET' }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      call.on('error', reject);
      call.end();
    });
    assert.equal(status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
