// Opt-in hosted smoke checks. Uses only the public key; does not create users or send emails.
import assert from 'node:assert/strict';
import { validateServiceUrl } from '../bridge/room-client.mjs';

const origin = validateServiceUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
assert.ok(headers.apikey, 'Configure the public client key first.');
const health = await fetch(`${origin}/auth/v1/health`, { headers, signal: AbortSignal.timeout(15_000) });
assert.equal(health.status, 200, 'Supabase Auth health endpoint');
const rooms = await fetch(`${origin}/rest/v1/rooms?select=id`, { headers, signal: AbortSignal.timeout(15_000) });
assert.ok([401, 403].includes(rooms.status), 'Unauthenticated room reads must be denied.');
const snapshot = await fetch(`${origin}/rest/v1/rpc/room_snapshot`, { method: 'POST', headers, body: JSON.stringify({ p_room_id: '00000000-0000-0000-0000-000000000001' }), signal: AbortSignal.timeout(15_000) });
assert.ok([401, 403].includes(snapshot.status), 'Unauthenticated snapshot RPC must be denied.');
console.log('Live smoke passed: Auth is reachable; anonymous table and RPC access denied. No users or messages created.');
