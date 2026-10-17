import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFileSync } from 'node:child_process';
import { prepareVault, vault } from '../bridge/vault.mjs';
import { roomClient, validateServiceUrl } from '../bridge/room-client.mjs';
import { claimLines, createRoom, joinRoom, getRoomSnapshot, releaseClaim, heartbeat } from '../src/lib/rooms.ts';

const [command, ...args] = process.argv.slice(2);
async function run() {
  if (!command || command === 'help') {
    console.log('Overlap agent bridge\n  login <email>\n  create <room-name> <display-name>\n  join <invite-token> <display-name>\n  select <room-uuid>\n  status\n  claim <relative-file> <start> <end> [agent]\n  release <claim-uuid>\n  logout\n\nClaims renew while this process runs. Ctrl+C releases a claim. No source code is uploaded.'); return;
  }
  await prepareVault();
  if (command === 'logout') { await vault.delete('room'); console.log('Local room session removed.'); return; }
  if (command === 'login') {
    const url = validateServiceUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key || !args[0]) throw new Error('Configure .env.local and provide your email address.');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithOtp({ email: args[0] });
    if (error) throw new Error('Could not send sign-in code. Check Supabase email configuration.');
    const input = createInterface({ input: stdin, output: stdout });
    let token;
    try { token = await input.question('Enter the email code: '); } finally { input.close(); }
    const result = await client.auth.verifyOtp({ email: args[0], token: token.trim(), type: 'email' });
    if (result.error || !result.data.session) throw new Error('Invalid or expired email code.');
    await vault.write({ url, key, session: result.data.session }, 'room');
    console.log('Room account connected. Session stored in macOS Keychain.'); return;
  }
  const { client, roomId, deviceId } = await roomClient();
  async function select(id) {
    await getRoomSnapshot(client, id);
    const record = await vault.read('room'); await vault.write({ ...record, roomId: id }, 'room');
    console.log(`Selected room ${id}.`);
  }
  if (command === 'create') {
    const result = await createRoom(client, args[0] || '', args[1] || 'Teammate');
    await select(result.room_id); console.log(`Invite token (share privately): ${result.invite_token}`); return;
  }
  if (command === 'join') { await select(await joinRoom(client, args[0] || '', args[1] || 'Teammate')); return; }
  if (command === 'select') { await select(args[0]); return; }
  if (!roomId) throw new Error('Create, join, or select a room first.');
  if (command === 'status') { console.log(JSON.stringify(await getRoomSnapshot(client, roomId), null, 2)); return; }
  if (command === 'release') { await releaseClaim(client, args[0]); console.log('Claim released.'); return; }
  if (command === 'claim') {
    let branch = 'working-tree';
    try { branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() || branch; } catch {}
    const result = await claimLines(client, { roomId, deviceId, filePath: args[0], startLine: Number(args[1]), endLine: Number(args[2]), agent: args[3] || 'Codex', branch });
    console.log(JSON.stringify(result, null, 2));
    if (result.conflicts.length) console.error('OVERLAP WARNING: another teammate is editing these lines. Claims are advisory.');
    let renewing = false;
    const interval = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try { const renewed = await roomClient(); await heartbeat(renewed.client, roomId, deviceId); }
      catch { console.error('Room heartbeat failed. Claim will expire; stop editing until reconnected.'); clearInterval(interval); process.exitCode = 1; }
      finally { renewing = false; }
    }, 25_000);
    const stop = async () => {
      clearInterval(interval);
      try { const renewed = await roomClient(); await releaseClaim(renewed.client, result.claim_id); }
      catch { console.error('Release failed. The editing claim will expire within 90 seconds.'); process.exitCode = 1; }
      process.exit();
    };
    process.once('SIGINT', stop); process.once('SIGTERM', stop); return;
  }
  throw new Error('Unknown command. Run npm run agent -- help.');
}
try { await run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
