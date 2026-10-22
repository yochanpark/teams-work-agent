import { addDays, isoDate, nthWeekdayOfMonth, weekdayOf, yearOf } from '../calendar/calendar.js';

const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// LLM은 날짜를 계산하지 않고 "어떤 표현이었는지"만 돌려준다(dateExpr).
// 실제 날짜는 여기서 계산한다. 연도를 말하지 않았고 계산 결과가 오늘보다 앞이면
// preferFuture일 때 내년으로 본다("1월 5일 연차"를 10월에 말한 경우).
export function resolveDateExpr(expr, today, { preferFuture = false } = {}) {
  if (!expr || expr.kind === 'none') return null;

  const withYear = (build) => {
    if (expr.year) return build(expr.year);
    const thisYear = build(yearOf(today));
    if (preferFuture && thisYear && thisYear < today) return build(yearOf(today) + 1);
    return thisYear;
  };

  switch (expr.kind) {
    case 'absolute':
      return withYear((y) => isoDate(y, expr.month, expr.day));
    case 'relative':
      return addDays(today, expr.offsetDays ?? 0);
    case 'weekday': {
      const target = WEEK.indexOf(expr.weekday);
      if (expr.weekOffset === null || expr.weekOffset === undefined) {
        // "수요일에" — 오늘 포함 가장 가까운 그 요일
        return addDays(today, (target - WEEK.indexOf(weekdayOf(today)) + 7) % 7);
      }
      const monday = addDays(today, -WEEK.indexOf(weekdayOf(today)));
      return addDays(monday, expr.weekOffset * 7 + target);
    }
    case 'nthWeekdayOfMonth':
      return withYear((y) => nthWeekdayOfMonth(y, expr.month, expr.nth, expr.weekday));
    default:
      return null;
  }
}
