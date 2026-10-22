import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCalendar, nthWeekdayOfMonth, monthRange, isoDate, todayKst, weekdayOf } from '../src/calendar/calendar.js';
import { holidays2026 } from './helpers.js';

const cal = createCalendar(holidays2026);

test('주말과 공휴일은 근무일이 아니다', () => {
  assert.equal(weekdayOf('2026-05-04'), 'MON');
  assert.equal(cal.isWorkday('2026-05-04'), true);
  assert.equal(cal.isWorkday('2026-05-05'), false); // 어린이날
  assert.equal(cal.isWorkday('2026-05-09'), false); // 토요일
});

test('다음 근무일은 주말·연휴를 건너뛴다', () => {
  assert.equal(cal.workdayAfter('2026-05-04'), '2026-05-06');
  assert.equal(cal.workdayAfter('2026-09-23'), '2026-09-29'); // 추석 연휴 + 대체공휴일
});

test('시작일 포함 근무일 n일째', () => {
  assert.equal(cal.nthWorkdayFrom('2026-05-07', 3), '2026-05-11'); // 목·금·월
  assert.equal(cal.nthWorkdayFrom('2026-05-06', 1), '2026-05-06');
});

test('M월 N째주 X요일 = 그 달의 N번째 X요일', () => {
  assert.equal(nthWeekdayOfMonth(2026, 5, 2, 'WED'), '2026-05-13');
  assert.equal(nthWeekdayOfMonth(2026, 5, 1, 'FRI'), '2026-05-01');
  assert.equal(nthWeekdayOfMonth(2026, 5, -1, 'SUN'), '2026-05-31');
  assert.equal(nthWeekdayOfMonth(2026, 2, 5, 'MON'), null); // 2월에 다섯째 월요일은 없다
});

test('월 범위·없는 날짜·한국 시간 오늘', () => {
  assert.deepEqual(monthRange(2028, 2), ['2028-02-01', '2028-02-29']);
  assert.equal(isoDate(2026, 2, 30), null);
  assert.equal(todayKst(new Date('2026-10-13T15:30:00Z')), '2026-10-14'); // UTC 15:30 = KST 다음날 00:30
});
