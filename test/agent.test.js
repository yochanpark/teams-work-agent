import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgent, LlmOutputError } from '../src/agent.js';
import { createCalendar } from '../src/calendar/calendar.js';
import { createMemoryStore } from '../src/rules/reservationStore.js';
import { holidays2026, catalog, leaveExtract, reservationExtract, scriptedLlm, date } from './helpers.js';

const setup = (llm) =>
  createAgent({ llm, calendar: createCalendar(holidays2026), catalog, store: createMemoryStore(), today: () => '2026-05-04' });
const user = { name: '홍길동', email: 'gildong@example.com' };

test('근태: 분류 → 추출 → 규칙 적용 후 RPA 입력 형식으로', async () => {
  const llm = scriptedLlm({ intent: 'leave' }, leaveExtract({ start: date.nth(5, 2, 'WED'), durationDays: 2, reason: '가족 행사' }));
  const result = await setup(llm).handle('5월 둘째주 수요일부터 이틀 연차, 가족 행사', user);

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.payload, {
    intent: 'annual.book',
    entities: {
      type: '신청',
      leaveType: '연차',
      startDate: '2026-05-13',
      endDate: '2026-05-14',
      startleaveTime: '',
      endleaveTime: '',
      reason: '가족 행사',
    },
    userEmail: 'gildong@example.com',
  });
  // 2단계 호출에 오늘 날짜와 스키마가 같이 간다
  assert.equal(llm.calls[1].schemaName, 'leave');
  assert.match(llm.calls[1].system, /2026-05-04/);
});

test('자원 예약: 분류 → 추출 → 판정', async () => {
  const llm = scriptedLlm({ intent: 'resource' }, reservationExtract({ attendeesCount: 4 }));
  const result = await setup(llm).handle('내일 오후 2시에 4명 회의실 1시간', user);
  assert.equal(result.kind, 'resource');
  assert.equal(result.payload.resourceName, '회의실 201');
  assert.equal(result.payload.userName, '홍길동');
});

test('업무 요청이 아니면 2단계를 부르지 않는다', async () => {
  const llm = scriptedLlm({ intent: 'unknown' });
  assert.deepEqual(await setup(llm).handle('점심 뭐 먹지', user), { kind: 'unknown' });
  assert.equal(llm.calls.length, 1);
});

test('스키마에 맞지 않는 모델 출력은 그대로 쓰지 않는다', async () => {
  const llm = scriptedLlm({ intent: 'leave' }, { ...leaveExtract(), action: '승인' });
  await assert.rejects(setup(llm).handle('아무 말', user), LlmOutputError);
});
