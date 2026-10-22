import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { leaveExtract, scriptedLlm, date } from './helpers.js';

// Bot Framework 커넥터 흉내: 봇이 보내는 답장을 받아 둔다
async function fakeConnector() {
  const replies = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url.includes('/activities')) replies.push(JSON.parse(raw));
      res.statusCode = req.method === 'GET' ? 404 : 200; // 멤버 조회는 실패 → 표시 이름으로 대체
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: String(replies.length) }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  return { replies, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const listen = async (app) => {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
};

const activity = (serviceUrl, fields) => ({
  type: 'message',
  id: `act-${Math.random()}`,
  channelId: 'msteams',
  serviceUrl,
  from: { id: 'user-1', name: '홍길동' },
  recipient: { id: 'bot-1', name: 'work-agent' },
  conversation: { id: 'conv-1' },
  ...fields,
});

test('메시지 → 확인 카드, 확인 → RPA 실행', async (t) => {
  const connector = await fakeConnector();
  const rpaCalls = [];
  const app = createApp({
    llm: scriptedLlm({ intent: 'leave' }, leaveExtract({ start: date.abs(5, 12), startHalf: '오후' })),
    rpa: { run: async (kind, payload) => (rpaCalls.push({ kind, payload }), { dryRun: true }) },
    env: {},
    today: () => '2026-05-04',
    logger: {},
  });
  const server = await listen(app);
  t.after(() => (server.close(), connector.close()));

  const send = (fields) =>
    fetch(`${server.url}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity(connector.url, fields)),
    });

  assert.equal((await send({ text: '5월 12일 오후 반차' })).status, 200);
  const card = connector.replies[0].attachments[0];
  assert.equal(card.contentType, 'application/vnd.microsoft.card.adaptive');
  const confirm = card.content.actions.find((a) => a.title === '확인').data;
  assert.equal(confirm.payload.entities.startDate, '2026-05-12');

  await send({ value: confirm });
  assert.deepEqual(rpaCalls, [{ kind: 'leave', payload: confirm.payload }]);
  assert.match(connector.replies[1].text, /데모 모드/);
});
