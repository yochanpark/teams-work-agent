import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReservation } from '../src/rules/reservation.js';
import { createMemoryStore } from '../src/rules/reservationStore.js';
import { catalog, reservationExtract, date } from './helpers.js';

const today = '2026-05-06';
const user = { name: '홍길동', email: 'gildong@example.com' };
const store = createMemoryStore([
  { resourceId: 'MR-202', date: '2026-05-07', startTime: '14:00', endTime: '15:00' },
  { resourceId: 'MR-301', date: '2026-05-07', startTime: '13:00', endTime: '16:00' },
]);
const build = (o) => buildReservation(reservationExtract(o), { today, catalog, store, user });

test('인원에 맞는 가장 작은 빈 회의실을 고른다', () => {
  const r = build({ attendeesCount: 3 });
  assert.equal(r.status, 'ready');
  assert.equal(r.payload.resourceName, '회의실 201');
  assert.deepEqual([r.payload.date, r.payload.startTime, r.payload.endTime], ['2026-05-07', '14:00', '15:00']);
  assert.equal(r.payload.status, '대기');
});

test('작은 방이 차 있으면 다음 크기로', () => {
  const r = build({ attendeesCount: 5, startTime: '10:00' });
  assert.equal(r.payload.resourceName, '회의실 202'); // 201은 4인실이라 제외
});

test('조건에 맞는 방이 모두 차 있으면 빈 시간을 알려 준다', () => {
  const r = build({ attendeesCount: 5 });
  // 202(6인)는 14시에 예약이 있고 301(12인)도 겹친다
  assert.equal(r.status, 'conflict');
  assert.deepEqual(Object.keys(r.availableSlots), ['회의실 202', '회의실 301']);
  assert.ok(!r.availableSlots['회의실 202'].includes('14:00-15:00'));
});

test('이름을 지정한 방이 인원보다 작으면 대안을 준다', () => {
  const r = build({ resourceName: '201', attendeesCount: 8 });
  assert.equal(r.status, 'rejected');
  assert.equal(r.reason, 'not_suitable');
  assert.deepEqual(r.alternatives, ['회의실 301']);
});

test('자원 이름에 "호"가 붙어도 찾는다', () => {
  // 실모델 평가에서 "301호 회의실" → resourceName "301호"로 뽑혀 거절됐던 경우
  for (const resourceName of ['301호', '회의실 301호']) {
    assert.equal(build({ resourceName, startTime: '10:00' }).payload.resourceName, '회의실 301');
  }
  const car = build({ resourceType: '법인차량', resourceName: '2호', startTime: '09:00' });
  assert.equal(car.payload.resourceName, '법인차량 2호(승합)');
});

test('필요한 장비가 있는 자원만', () => {
  const r = build({ facility: ['빔프로젝터'], startTime: '10:00' });
  assert.equal(r.payload.resourceName, '회의실 301');
});

test('시간이 빠지면 되묻는다', () => {
  const r = build({ startTime: null, durationMinutes: null });
  assert.deepEqual(r, { status: 'needs_input', missing: ['startTime', 'endTime'] });
});

test('지난 날짜와 거꾸로 된 시간은 거절', () => {
  assert.equal(build({ date: date.abs(5, 1, 2026) }).reason, 'past_date');
  assert.equal(build({ startTime: '15:00', endTime: '14:00', durationMinutes: null }).reason, 'invalid_time');
});

test('법인차량은 동승자 수로 차종을 고른다', () => {
  const r = build({ resourceType: '법인차량', attendeesCount: 7, startTime: '09:00', durationMinutes: 240 });
  assert.equal(r.payload.resourceName, '법인차량 2호(승합)');
  assert.equal(r.payload.endTime, '13:00');
});
