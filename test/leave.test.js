import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCalendar } from '../src/calendar/calendar.js';
import { buildLeaveRequest } from '../src/rules/leave.js';
import { holidays2026, leaveExtract, date } from './helpers.js';

// 근태 날짜 규칙 테스트. 오늘 = 2026-05-04(월), 5/5는 어린이날.
const calendar = createCalendar(holidays2026);
const build = (extracted, text = '', today = '2026-05-04') =>
  buildLeaveRequest(leaveExtract(extracted), { today, calendar, text }).entities;

test('말하지 않은 값의 기본값', () => {
  const e = build({ start: date.abs(5, 6) });
  assert.equal(e.leaveType, '연차');
  assert.equal(e.startleaveTime, '');
  assert.equal(e.endleaveTime, '');
  assert.equal(e.reason, '');
});

test('날짜가 없으면 오늘 다음 근무일 (5/5 공휴일 → 5/6)', () => {
  const e = build({});
  assert.equal(e.startDate, '2026-05-06');
  assert.equal(e.endDate, '2026-05-06');
});

test('지난 날짜·오늘은 다음 근무일로', () => {
  assert.equal(build({ start: date.abs(5, 1, 2026) }).startDate, '2026-05-06');
  assert.equal(build({ start: date.rel(0) }).startDate, '2026-05-06');
});

test('주말·공휴일을 신청하면 그 다음 근무일', () => {
  assert.equal(build({ start: date.abs(5, 9) }).startDate, '2026-05-11'); // 토 → 월
  assert.equal(build({ start: date.rel(1) }).startDate, '2026-05-06'); // 내일(어린이날) → 수
});

test('종료일이 없으면 시작일과 같다', () => {
  const e = build({ start: date.abs(5, 12) });
  assert.deepEqual([e.startDate, e.endDate], ['2026-05-12', '2026-05-12']);
});

test('"N일"은 시작일 포함 근무일 N일, 주말 제외', () => {
  const e = build({ start: date.abs(5, 7), durationDays: 3 });
  assert.deepEqual([e.startDate, e.endDate], ['2026-05-07', '2026-05-11']);
});

test('종료일이 주말이면 앞 근무일로 당긴다', () => {
  const e = build({ start: date.abs(5, 6), end: date.abs(5, 10) });
  assert.equal(e.endDate, '2026-05-08');
});

test('"5월 둘째주 수요일" = 5월의 두 번째 수요일', () => {
  assert.equal(build({ start: date.nth(5, 2, 'WED') }).startDate, '2026-05-13');
});

test('연도를 말하지 않은 지난 월·일은 내년으로 본다', () => {
  const e = build({ start: date.abs(1, 5) }, '', '2026-10-14');
  assert.equal(e.startDate, '2027-01-05');
});

test('"휴가 신청"이 들어가면 모델이 조회로 읽어도 신청', () => {
  const e = build({ action: '조회', start: date.abs(5, 12) }, '다음 주 화요일 휴가 신청할게요');
  assert.equal(e.type, '신청');
  assert.equal(e.startDate, '2026-05-12');
});

test('반차는 시간 구분을 그대로 넘긴다', () => {
  const e = build({ start: date.weekday('FRI', 0), startHalf: '오후', reason: '병원' });
  assert.deepEqual([e.startDate, e.startleaveTime, e.reason], ['2026-05-08', '오후', '병원']);
});

test('조회 기간이 없으면 작년 1/1 ~ 올해 12/31 (연도 하드코딩 없음)', () => {
  const e = build({ action: '조회' });
  assert.deepEqual([e.startDate, e.endDate], ['2025-01-01', '2026-12-31']);
});

test('"이번 달" 조회는 1일 ~ 말일', () => {
  const e = build({ action: '조회', period: { kind: 'thisMonth', month: null } });
  assert.deepEqual([e.startDate, e.endDate], ['2026-05-01', '2026-05-31']);
});

test('특정 날짜 조회는 지난 날짜도 그대로', () => {
  const e = build({ action: '조회', period: { kind: 'dates', month: null }, start: date.abs(3, 2), end: date.abs(3, 6) });
  assert.deepEqual([e.startDate, e.endDate], ['2026-03-02', '2026-03-06']);
});

test('"작년 근태 조회"는 작년 전체', () => {
  const e = build({ action: '조회', period: { kind: 'lastYear', month: null } });
  assert.deepEqual([e.startDate, e.endDate], ['2025-01-01', '2025-12-31']);
});
