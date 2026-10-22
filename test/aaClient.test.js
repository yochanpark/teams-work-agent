import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAaClient } from '../src/rpa/aaClient.js';

// 가짜 Control Room. 첫 deploy는 401(토큰 만료)로 돌려준다.
async function fakeControlRoom() {
  const requests = [];
  let deploys = 0;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      requests.push({ url: req.url, auth: req.headers['x-authorization'], body: JSON.parse(raw) });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v2/authentication') return res.end(JSON.stringify({ token: `token-${requests.length}` }));
      if (req.url === '/v4/automations/deploy' && ++deploys === 1) {
        res.statusCode = 401;
        return res.end('{}');
      }
      res.end(JSON.stringify({ deploymentId: 'dep-1' }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  return { requests, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

test('토큰 발급 → 봇 실행, dicInput에 요청 JSON을 그대로 싣는다', async (t) => {
  const cr = await fakeControlRoom();
  t.after(cr.close);
  const client = createAaClient({ controlRoomUrl: cr.url, username: 'bot', apiKey: 'test-key', bots: { leave: 11 }, runAsUserIds: [7] });

  const payload = { intent: 'annual.book', entities: { type: '신청', startDate: '2026-05-06' } };
  const result = await client.run('leave', payload);

  assert.deepEqual(result, { dryRun: false, deploymentId: 'dep-1' });
  assert.deepEqual(cr.requests.map((r) => r.url), [
    '/v2/authentication',
    '/v4/automations/deploy', // 401
    '/v2/authentication', // 재발급
    '/v4/automations/deploy',
  ]);
  const deploy = cr.requests[3];
  assert.equal(deploy.auth, 'token-3');
  assert.deepEqual(deploy.body, {
    botId: 11,
    unattendedRequest: { runAsUserIds: [7] },
    botInput: { dicInput: { type: 'DICTIONARY', dictionary: payload } },
  });
});

test('Control Room 주소가 없으면 호출 없이 보낼 내용만 돌려준다', async () => {
  const result = await createAaClient({ bots: { resource: 22 } }).run('resource', { a: 1 });
  assert.equal(result.dryRun, true);
  assert.equal(result.body.botId, 22);
});
