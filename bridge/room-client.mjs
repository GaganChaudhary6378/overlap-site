import { createClient } from '@supabase/supabase-js';
import { vault, prepareVault } from './vault.mjs';
import { randomUUID } from 'node:crypto';

export function validateServiceUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Use HTTPS for the room service.');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Enter the Supabase project origin only.');
  return url.origin;
}

export async function roomClient() {
  await prepareVault();
  const saved = await vault.read('room');
  if (!saved?.session) throw new Error('Run npm run agent -- login first.');
  const client = createClient(validateServiceUrl(saved.url), saved.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.setSession(saved.session);
  if (error || !data.session) throw new Error('Room session expired. Run npm run agent -- login again.');
  const deviceId = saved.deviceId || randomUUID();
  await vault.write({ ...saved, deviceId, session: data.session }, 'room');
  return { client, roomId: saved.roomId, deviceId };
}
