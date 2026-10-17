import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { validateServiceUrl } from '../bridge/room-client.mjs';

test('room service URL cannot send credentials to insecure or credential-bearing URLs', () => {
  assert.equal(validateServiceUrl('https://example.supabase.co'), 'https://example.supabase.co');
  assert.equal(validateServiceUrl('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
  for (const value of ['http://example.com', 'https://user:password@example.com', 'https://example.com/path', 'file:///tmp/test']) assert.throws(() => validateServiceUrl(value));
});
test('MCP survives malformed requests and advertises advisory coordination tools without login', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'bridge/mcp.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', chunk => { text += chunk; });
  child.stdin.end('null\n' + JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`MCP exit ${code}`))); });
  const messages = text.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(messages[0].error.code, -32600);
  assert.equal(messages.find(message => message.id === 1).result.serverInfo.name, 'overlap');
  assert.equal(messages.find(message => message.id === 2).result.tools.length, 3);
});
