import { monthRange, yearOf, monthOf } from '../calendar/calendar.js';
import { resolveDateExpr } from './dateExpr.js';

// 날짜·기본값 규칙은 LLM이 아니라 이 코드가 맡는다.

const APPLY_KEYWORDS = /(근태|휴가)\s*(신청|등록)/;

export function buildLeaveRequest(extracted, { today, calendar, text }) {
  const type = APPLY_KEYWORDS.test(text) ? '신청' : extracted.action;

  const entities = {
    type,
    leaveType: extracted.leaveType ?? '연차',
    startDate: null,
    endDate: null,
    startleaveTime: extracted.startHalf ?? '',
    endleaveTime: extracted.endHalf ?? '',
    reason: extracted.reason ?? '',
  };

  if (type === '조회') {
    [entities.startDate, entities.endDate] = inquiryRange(extracted, today);
  } else {
    [entities.startDate, entities.endDate] = leaveRange(extracted, today, calendar);
  }

  return { intent: 'annual.book', entities };
}

function leaveRange(extracted, today, calendar) {
  let start = resolveDateExpr(extracted.start, today, { preferFuture: true });

  // 날짜가 없거나 오늘이거나 지난 날이면 → 오늘 다음 근무일
  if (!start || start <= today) start = calendar.workdayAfter(today);
  // 주말·공휴일이면 → 그 다음 근무일
  start = calendar.workdayOnOrAfter(start);

  // "3일" → 시작일 포함 근무일 3일째가 종료일(주말·공휴일 제외)
  if (extracted.durationDays) return [start, calendar.nthWorkdayFrom(start, extracted.durationDays)];

  // 종료일이 없으면 시작일과 같게
  // 종료일이 주말·공휴일이면 그 앞 근무일로 당긴다
  const end = calendar.workdayOnOrBefore(resolveDateExpr(extracted.end, today, { preferFuture: true }) ?? start);
  return [start, end < start ? start : end];
}

function inquiryRange(extracted, today) {
  const y = yearOf(today);
  const period = extracted.period ?? { kind: 'none' };
  switch (period.kind) {
    case 'thisMonth': // "이달" → 이번 달 1일 ~ 말일
      return monthRange(y, monthOf(today));
    case 'month':
      return monthRange(y, period.month);
    case 'thisYear':
      return [`${y}-01-01`, `${y}-12-31`];
    case 'lastYear': // "작년 근태" → 작년 1/1 ~ 12/31
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'dates': {
      // 특정 일자를 말했으면 그대로
      const start = resolveDateExpr(extracted.start, today);
      const end = resolveDateExpr(extracted.end, today) ?? start;
      if (start) return [start, end];
      break;
    }
  }
  // 기간이 없으면 작년 1/1 ~ 올해 12/31
  return [`${y - 1}-01-01`, `${y}-12-31`];
}
