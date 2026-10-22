// 날짜는 전부 'YYYY-MM-DD' 문자열로 주고받는다.
// 내부 계산은 UTC 자정 기준이라 서버 시간대와 무관하게 같은 결과가 나온다.

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const format = (date) => date.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}

export const weekdayOf = (iso) => WEEKDAYS[parse(iso).getUTCDay()];
export const yearOf = (iso) => Number(iso.slice(0, 4));
export const monthOf = (iso) => Number(iso.slice(5, 7));

export function todayKst(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

export function isoDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  // 2월 30일처럼 없는 날짜는 Date가 다음 달로 넘겨 버리므로 되돌려 확인한다
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return format(d);
}

export function monthRange(year, month) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [isoDate(year, month, 1), isoDate(year, month, last)];
}

// nth = 1..5, -1은 마지막 주. "5월 둘째주 수요일" = 5월의 두 번째 수요일.
export function nthWeekdayOfMonth(year, month, nth, weekday) {
  const target = WEEKDAYS.indexOf(weekday);
  const [first, last] = monthRange(year, month);
  if (nth === -1) {
    let d = last;
    while (weekdayOf(d) !== weekday) d = addDays(d, -1);
    return d;
  }
  const offset = (target - parse(first).getUTCDay() + 7) % 7;
  const d = addDays(first, offset + (nth - 1) * 7);
  return d <= last ? d : null;
}

export function createCalendar(holidays = []) {
  const holidaySet = new Set(holidays);
  const isWorkday = (iso) => !['SAT', 'SUN'].includes(weekdayOf(iso)) && !holidaySet.has(iso);

  // 그날이 근무일이면 그날, 아니면 다음 근무일
  const workdayOnOrAfter = (iso) => {
    let d = iso;
    while (!isWorkday(d)) d = addDays(d, 1);
    return d;
  };
  const workdayOnOrBefore = (iso) => {
    let d = iso;
    while (!isWorkday(d)) d = addDays(d, -1);
    return d;
  };
  const workdayAfter = (iso) => workdayOnOrAfter(addDays(iso, 1));

  // start 포함 근무일 n일째 되는 날
  const nthWorkdayFrom = (start, n) => {
    let d = workdayOnOrAfter(start);
    for (let i = 1; i < n; i++) d = workdayAfter(d);
    return d;
  };

  return { isWorkday, workdayOnOrAfter, workdayOnOrBefore, workdayAfter, nthWorkdayFrom };
}
