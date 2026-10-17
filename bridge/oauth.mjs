import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const ISSUER = 'https://auth.openai.com';
export const RESOURCE = 'https://api.openai.com/v1';
const keys = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export function createAttempt(hostId, registration, redirectUri) {
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const params = new URLSearchParams({
    client_id: registration?.client_id || 'dynamic_agent_client',
    ext_agent_host_id: hostId, response_type: 'code', redirect_uri: redirectUri,
    scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
    resource: RESOURCE, state, nonce, code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  });
  if (!registration?.client_id) params.set('agent_name_hint', 'Overlap');
  return { state, nonce, verifier, redirectUri, registration, expires: Date.now() + 600_000, url: `${ISSUER}/api/accounts/authorize?${params}` };
}

export function validateCallback(params, attempt) {
  if (!attempt || Date.now() > attempt.expires || params.get('state') !== attempt.state) throw new Error('Sign-in expired or state did not match. Start again.');
  if (params.has('error')) throw new Error('Sign-in was declined or cancelled.');
  const clientId = params.get('client_id') || attempt.registration?.client_id;
  if (!clientId || clientId === 'dynamic_agent_client' || !params.get('code')) throw new Error('OpenAI did not complete client registration.');
  if (attempt.registration?.client_id && clientId !== attempt.registration.client_id) throw new Error('Client registration did not match.');
  return { clientId, code: params.get('code') };
}

export async function verifyIdentity(token, clientId, nonce, keySet = keys) {
  const { payload } = await jwtVerify(token, keySet, { issuer: ISSUER, audience: clientId, algorithms: ['RS256'], requiredClaims: ['exp', 'sub', 'iat'] });
  if (!payload.sub || nonce && payload.nonce !== nonce) throw new Error('OpenAI identity validation failed.');
  return { subject: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' };
}

export async function tokenRequest(parameters, fetcher = fetch) {
  const response = await fetcher(`${ISSUER}/api/accounts/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenAI token exchange failed (${response.status}). Sign in again.`);
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || data.token_type?.toLowerCase() !== 'bearer') throw new Error('OpenAI returned an incomplete token response.');
  return data;
}

export function mergeCredentials(data, previous = {}) {
  return { ...previous, access_token: data.access_token, refresh_token: data.refresh_token || previous.refresh_token,
    id_token: data.id_token || previous.id_token, scopes: typeof data.scope === 'string' ? data.scope.split(/\s+/) : previous.scopes || [],
    expires: Date.now() + data.expires_in * 1000 };
}

export async function completedText(body) {
  let buffer = '', text = '', completed = false;
  const decoder = new TextDecoder();
  function event(block) {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') return;
    const value = JSON.parse(data);
    if (value.type === 'response.output_text.delta') text += value.delta;
    if (value.type === 'response.completed') completed = true;
    if (['error', 'response.failed', 'response.incomplete'].includes(value.type)) throw new Error('OpenAI did not complete the response. Check your plan usage or reconnect.');
  }
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r/g, '');
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) { event(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
    if (buffer.length > 2_000_000 || text.length > 200_000) throw new Error('Response exceeded the local limit.');
  }
  buffer += decoder.decode();
  if (buffer.trim()) event(buffer);
  if (!completed || !text.trim()) throw new Error('OpenAI stream ended without a completed response.');
  return text;
}
