import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAttempt, validateCallback, verifyIdentity, tokenRequest, mergeCredentials, completedText, RESOURCE } from './oauth.mjs';
import { prepareVault, vault } from './vault.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createBridge({ storage = vault, hostId, port = 4319, fetcher = fetch, verify = verifyIdentity } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const session = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  let attempt, notice = '', output = '', busy = false;
  const form = (action, label, content = '') => `<form method="post" action="${action}"><input type="hidden" name="csrf" value="${csrf}">${content}<button>${label}</button></form>`;
  async function credentials() {
    let record = await storage.read();
    if (!record?.access_token) throw new Error('Connect your ChatGPT plan first.');
    if (record.expires <= Date.now() + 60_000) {
      if (!record.refresh_token) throw new Error('Your session expired. Sign in again.');
      const data = await tokenRequest({ grant_type: 'refresh_token', client_id: record.client_id, refresh_token: record.refresh_token, resource: RESOURCE }, fetcher);
      if (data.id_token) {
        const identity = await verify(data.id_token, record.client_id);
        if (identity.subject !== record.subject) throw new Error('Account identity changed. Sign in again.');
      }
      record = mergeCredentials(data, record);
      await storage.write(record);
    }
    if (!record.scopes.includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan usage is not enabled. Reconnect and grant permission.');
    return record;
  }
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://auth.openai.com; frame-ancestors 'none'; base-uri 'none'");
    if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403).end('Loopback access only.'); return; }
    let url;
    try {
      url = new URL(request.url, origin);
      if (url.origin !== origin) throw new Error('Invalid origin');
    } catch { response.writeHead(400).end('Invalid request URL.'); return; }
    const hasSession = request.headers.cookie?.split(';').some(c => c.trim() === `overlap_local=${session}`);
    const redirect = destination => response.writeHead(303, { Location: destination }).end();
    try {
      if (request.method === 'GET' && url.pathname === '/auth/callback') {
        if (!hasSession) throw new Error('Sign-in browser session was lost. Start again.');
        if (busy) { response.writeHead(409).end('Another request is still running.'); return; }
        busy = true;
        try {
        const pending = attempt;
        attempt = undefined;
        const { clientId, code } = validateCallback(url.searchParams, pending);
        await storage.write({ client_id: clientId, subject: pending.registration?.subject }, 'registration');
        const data = await tokenRequest({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE }, fetcher);
        if (!data.id_token) throw new Error('OpenAI did not return an ID token.');
        const identity = await verify(data.id_token, clientId, pending.nonce);
        if (pending.registration?.subject && identity.subject !== pending.registration.subject) throw new Error('Connected account does not match the selected registration.');
        const record = { ...mergeCredentials(data), ...identity, client_id: clientId };
        await storage.write(record);
        await storage.write({ client_id: clientId, subject: identity.subject }, 'registration');
        notice = record.scopes.includes('chatgpt.tokens.use.direct') ? 'Connected. Your ChatGPT plan can now be used on this Mac.' : 'Identity connected; plan usage permission was not granted.';
        redirect('/'); return;
        } finally { busy = false; }
      }
      if (request.method === 'POST') {
        if (!hasSession || request.headers.origin !== origin) { response.writeHead(403).end('Open the local connection page first.'); return; }
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 16_384) { response.writeHead(413).end('Request too large.'); return; }
        }
        const fields = new URLSearchParams(body);
        if (fields.get('csrf') !== csrf) { response.writeHead(403).end('Invalid request token.'); return; }
        if (busy) { response.writeHead(409).end('Another request is still running.'); return; }
        busy = true;
        try {
          if (url.pathname === '/connect') {
            const registration = await storage.read('registration');
            attempt = createAttempt(hostId, registration, `${origin}/auth/callback`);
            redirect(attempt.url); return;
          }
          if (url.pathname === '/disconnect') {
            const record = await storage.read();
            // Local deletion always succeeds independently of remote revocation availability.
            await storage.delete(); await storage.delete('registration'); attempt = undefined; output = '';
            if (record?.refresh_token) {
              try {
                const revoked = await fetcher('https://auth.openai.com/api/accounts/oauth/revoke', { method: 'POST', body: new URLSearchParams({ token: record.refresh_token, token_type_hint: 'refresh_token', client_id: record.client_id }), signal: AbortSignal.timeout(10_000) });
                notice = revoked.ok ? 'Disconnected and refresh token revoked.' : 'Local credentials deleted. Remove Overlap in ChatGPT settings to revoke remote access.';
              } catch { notice = 'Local credentials deleted. Remove Overlap in ChatGPT settings to revoke remote access.'; }
            } else notice = 'Disconnected. Local credentials deleted.';
          } else if (url.pathname === '/verify') {
            const record = await credentials();
            const headers = { Authorization: `Bearer ${record.access_token}`, 'Content-Type': 'application/json' };
            const models = await fetcher(`${RESOURCE}/models`, { headers, signal: AbortSignal.timeout(30_000) });
            if (!models.ok) throw new Error(`Model access failed (${models.status}). Check plan usage or reconnect.`);
            const catalog = await models.json();
            const model = catalog.data?.[0]?.id;
            if (!model) throw new Error('No models are available for this connection.');
            const result = await fetcher(`${RESOURCE}/responses`, { method: 'POST', headers, signal: AbortSignal.timeout(120_000),
              body: JSON.stringify({ model, store: false, stream: true, input: [{ role: 'user', content: fields.get('prompt')?.trim() || 'Reply with exactly: Overlap is connected.' }] }) });
            if (!result.ok || !result.body) throw new Error(`Inference failed (${result.status}). Check your ChatGPT plan usage.`);
            output = await completedText(result.body);
            notice = `Completed with ${model}. Using your ChatGPT plan. This request used plan allowance.`;
          } else { response.writeHead(404).end('Not found.'); return; }
        } finally { busy = false; }
        redirect('/'); return;
      }
      if (request.method !== 'GET' || url.pathname !== '/') { response.writeHead(404).end('Not found.'); return; }
      response.setHeader('Set-Cookie', `overlap_local=${session}; HttpOnly; SameSite=Lax; Path=/`);
      const record = await storage.read();
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Overlap · Local connection</title><style>body{background:#f3efe3;color:#292e3a;font:19px Georgia,serif;margin:0;padding:40px 22px}main{max-width:720px;margin:auto}header{border-block:4px double #777;padding:14px 0}h1{font-size:60px;margin:0}h2{font-weight:400;font-size:32px}p{line-height:1.6}.kicker{font:12px system-ui;text-transform:uppercase;letter-spacing:.14em;color:#826236}section{border-bottom:1px solid #b8ae9a;padding:22px 0}button,a{font:15px system-ui}button{border:1px solid #6c6353;border-radius:8px;padding:12px 20px;background:#292e3a;color:#fff;cursor:pointer}form{margin:15px 0}textarea{box-sizing:border-box;display:block;width:100%;min-height:95px;padding:12px;border:1px solid #b8ae9a;border-radius:8px;margin:12px 0;background:#faf8f0;font:17px Georgia}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#e8e1d2;padding:18px;border-radius:8px}.status{border-left:3px solid #826236;padding-left:15px}a{color:#69512e}</style><main><header><span class="kicker">This Mac · Private connection</span><h1>Overlap</h1></header><section><h2>Your plan. Your connection.</h2><p>Connect your ChatGPT account on this Mac. Credentials stay in macOS Keychain. Room members never receive them.</p><p class="status" role="status">${escape(notice || (record ? 'Connected to ' + (record.email || 'your ChatGPT account') : 'No ChatGPT account connected.'))}</p>${record ? `<p>${escape(record.email)} · ${record.scopes.includes('chatgpt.tokens.use.direct') ? 'Plan usage enabled' : 'Plan usage not enabled'}</p>` : ''}${form('/connect', 'Continue with ChatGPT')}${record ? form('/disconnect', 'Disconnect') : ''}<p><a href="https://chatgpt.com/#settings/Usage" target="_blank" rel="noreferrer">Manage ChatGPT usage</a></p></section>${record ? `<section><h2>Try your connection</h2><p>A completed response verifies access for this request and uses your plan allowance.</p>${form('/verify', 'Send using ChatGPT plan', '<label for="prompt">Message</label><textarea id="prompt" name="prompt" maxlength="8000">Reply with exactly: Overlap is connected.</textarea>')}${output ? `<pre>${escape(output)}</pre>` : ''}</section>` : ''}<p class="kicker">Locally hosted personal app · ${busy ? 'Request in progress' : 'Ready'}</p><p><a href="http://localhost:3000/app">Open your room dashboard</a></p></main></html>`);
    } catch (error) {
      // Never send raw provider bodies, tokens, request URLs, or stack traces to the browser.
      const message = error instanceof Error ? error.message : 'Connection failed.';
      notice = /token exchange failed|Sign-in|state|registration|identity|permission|session|Account|plan|Model access|models|Inference|stream|Response|Keychain|Connected account|OpenAI did not/.test(message) ? message : 'Connection failed. Please try again.';
      redirect('/');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareVault();
  const directory = join(homedir(), 'Library/Application Support/Overlap');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const hostPath = join(directory, 'host.json');
  let host;
  try { host = JSON.parse(await readFile(hostPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!host) {
    host = { id: `urn:uuid:${randomUUID()}` };
    await writeFile(hostPath + '.tmp', JSON.stringify(host), { mode: 0o600 });
    await rename(hostPath + '.tmp', hostPath);
  }
  createBridge({ hostId: host.id }).listen(4319, '127.0.0.1', () => console.log('Overlap local connection: http://127.0.0.1:4319'));
}
