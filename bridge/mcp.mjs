import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { roomClient } from './room-client.mjs';
import { claimLines, getRoomSnapshot, releaseClaim, heartbeat } from '../src/lib/rooms.ts';

const tools = [
  { name: 'overlap_status', description: 'Read active workers and file/range leases in the selected Overlap room. Call before planning or editing.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'overlap_begin_work', description: 'Call immediately before every planned edit. It automatically announces this Codex worker, checks conflicts, and returns structured room state. If conflicts exist, coordinate before writing.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, startLine: { type: 'integer' }, endLine: { type: 'integer' }, branch: { type: 'string' }, agent: { type: 'string' } }, required: ['filePath', 'startLine', 'endLine', 'branch'], additionalProperties: false } },
  { name: 'overlap_finish_work', description: 'Call after an edit is finished or abandoned to release its lease.', inputSchema: { type: 'object', properties: { claimId: { type: 'string' } }, required: ['claimId'], additionalProperties: false } },
  { name: 'overlap_claim', description: 'Compatibility alias for overlap_begin_work.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, startLine: { type: 'integer' }, endLine: { type: 'integer' }, branch: { type: 'string' }, agent: { type: 'string' } }, required: ['filePath', 'startLine', 'endLine', 'branch'], additionalProperties: false } },
  { name: 'overlap_release', description: 'Compatibility alias for overlap_finish_work.', inputSchema: { type: 'object', properties: { claimId: { type: 'string' } }, required: ['claimId'], additionalProperties: false } },
];
let connection;
let claimed = false;
let queue = Promise.resolve();
const workerId = randomUUID();
const timer = setInterval(() => {
  queue = queue.then(async () => {
    if (!claimed) return;
    try {
      connection = await roomClient();
      await heartbeat(connection.client, connection.roomId, connection.deviceId, workerId);
    } catch { claimed = false; console.error('Overlap heartbeat failed; claims will expire. Reconnect before editing.'); }
  });
}, 25_000);
timer.unref();
async function handle(message) {
  if (message.id === undefined) return;
  let result;
  try {
    if (message.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'overlap', version: '0.1.0' } };
    else if (message.method === 'ping') result = {};
    else if (message.method === 'tools/list') result = { tools };
    else if (message.method === 'tools/call') {
      connection = await roomClient();
      if (!connection.roomId) throw new Error('Select a room using npm run agent -- select <room-uuid>.');
      const { client, roomId, deviceId } = connection;
      const args = message.params?.arguments || {};
      let value;
      switch (message.params?.name) {
        case 'overlap_status': value = await getRoomSnapshot(client, roomId); break;
        case 'overlap_begin_work':
        case 'overlap_claim': value = await claimLines(client, { ...args, roomId, deviceId, workerId, agent: args.agent || 'Codex' }); claimed = true; break;
        case 'overlap_finish_work':
        case 'overlap_release': value = await releaseClaim(client, args.claimId); break;
        default: throw new Error('Unknown Overlap tool.');
      }
      result = { content: [{ type: 'text', text: JSON.stringify(value ?? { released: true }) }] };
    } else { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }) + '\n'); return; }
  } catch {
    result = { isError: true, content: [{ type: 'text', text: 'Room operation failed. Check local room login, membership, and valid file/range inputs. No successful claim was verified.' }] };
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
}
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  if (line.length > 65_536) return;
  try {
    const message = JSON.parse(line);
    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }) + '\n'); return;
    }
    queue = queue.then(() => handle(message)).catch(() => { console.error('Overlap request failed.'); });
  }
  catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }) + '\n'); }
});
lines.on('close', () => clearInterval(timer));
