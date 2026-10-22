import { readFileSync } from 'node:fs';

export const holidays2026 = JSON.parse(readFileSync(new URL('../src/data/holidays-kr-2026.json', import.meta.url), 'utf8'));
export const catalog = JSON.parse(readFileSync(new URL('../src/data/resources.json', import.meta.url), 'utf8'));

const NONE = { kind: 'none', year: null, month: null, day: null, offsetDays: null, weekOffset: null, weekday: null, nth: null };
export const date = {
  none: () => ({ ...NONE }),
  abs: (month, day, year = null) => ({ ...NONE, kind: 'absolute', month, day, year }),
  rel: (offsetDays) => ({ ...NONE, kind: 'relative', offsetDays }),
  weekday: (weekday, weekOffset = null) => ({ ...NONE, kind: 'weekday', weekday, weekOffset }),
  nth: (month, nth, weekday) => ({ ...NONE, kind: 'nthWeekdayOfMonth', month, nth, weekday }),
};

// LLM이 돌려줄 법한 추출 결과(스키마를 만족하는 기본값 + 덮어쓰기)
export const leaveExtract = (o = {}) => ({
  action: '신청',
  leaveType: null,
  start: date.none(),
  end: date.none(),
  durationDays: null,
  startHalf: null,
  endHalf: null,
  reason: null,
  period: { kind: 'none', month: null },
  ...o,
});

export const reservationExtract = (o = {}) => ({
  resourceType: '회의실',
  resourceName: null,
  date: date.rel(1),
  startTime: '14:00',
  endTime: null,
  durationMinutes: 60,
  attendeesCount: null,
  attendees: [],
  purpose: null,
  facility: [],
  isRecurring: false,
  recurrencePattern: null,
  notificationRequest: false,
  notes: null,
  ...o,
});

// 정해진 순서대로 응답하는 가짜 LLM. 받은 요청도 기록한다.
export function scriptedLlm(...outputs) {
  const calls = [];
  return {
    calls,
    async extract(request) {
      calls.push(request);
      if (!outputs.length) throw new Error('no scripted output left');
      return outputs.shift();
    },
  };
}
