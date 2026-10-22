// LLM 출력 스키마. OpenAI Structured Outputs(strict)에 그대로 넘기고,
// 응답이 오면 같은 스키마로 한 번 더 검증한다.
// strict 모드 규칙: 모든 속성 required, additionalProperties false, 없음은 null.

const nullable = (type, description) => ({ type: [type, 'null'], description });
const nullableEnum = (values, description) => ({ type: ['string', 'null'], enum: [...values, null], description });
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const dateExpr = (description) => ({
  description,
  ...object({
    kind: {
      type: 'string',
      enum: ['none', 'absolute', 'relative', 'weekday', 'nthWeekdayOfMonth'],
      description:
        'none=날짜 언급 없음, absolute=월/일을 말함, relative=오늘·내일·모레, weekday=이번주/다음주 X요일 또는 요일만, nthWeekdayOfMonth=M월 N째주 X요일',
    },
    year: nullable('integer', '연도를 직접 말했을 때만'),
    month: nullable('integer', 'absolute, nthWeekdayOfMonth'),
    day: nullable('integer', 'absolute'),
    offsetDays: nullable('integer', 'relative: 오늘 0, 내일 1, 모레 2, 글피 3'),
    weekOffset: nullable('integer', 'weekday: 이번주 0, 다음주 1, 다다음주 2. 요일만 말했으면 null'),
    weekday: nullableEnum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 'weekday, nthWeekdayOfMonth'),
    nth: nullable('integer', 'nthWeekdayOfMonth: 첫째 1 … 다섯째 5, 마지막 -1'),
  }),
});

const HHMM = { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: '24시간제 HH:mm' };

export const intentSchema = object({
  intent: {
    type: 'string',
    enum: ['leave', 'resource', 'unknown'],
    description:
      'leave=본인 연차·휴가·근태의 신청·조회·취소, resource=회의실·법인차량·스튜디오·세차장 예약, unknown=그 외(규정·제도 질문 포함)',
  },
});

export const leaveSchema = object({
  action: { type: 'string', enum: ['조회', '신청', '취소'] },
  leaveType: nullableEnum(['연차', '리프레시휴가'], '말하지 않았으면 null'),
  start: dateExpr('시작일 표현'),
  end: dateExpr('종료일 표현. "~부터 ~까지"의 종료일. 기간을 일수로 말했으면 none'),
  durationDays: nullable('integer', '"3일", "이틀"처럼 일수로 말한 기간'),
  startHalf: nullableEnum(['오전', '오후'], '시작일 반차'),
  endHalf: nullableEnum(['오전', '오후'], '종료일 반차'),
  reason: nullable('string', '사유. 없으면 null'),
  period: {
    description: '조회일 때 기간',
    ...object({
      kind: { type: 'string', enum: ['none', 'thisMonth', 'month', 'thisYear', 'lastYear', 'dates'] },
      month: nullable('integer', 'kind=month일 때'),
    }),
  },
});

export const reservationSchema = object({
  resourceType: { type: 'string', enum: ['회의실', '법인차량', '스튜디오', '세차장'] },
  resourceName: nullable('string', '특정 자원 이름·번호를 말했을 때만. 예: "301"'),
  date: dateExpr('예약일 표현'),
  startTime: HHMM,
  endTime: HHMM,
  durationMinutes: nullable('integer', '"1시간", "30분"처럼 길이로 말한 경우'),
  attendeesCount: nullable('integer', '인원'),
  attendees: { type: 'array', items: { type: 'string' }, description: '이름을 말한 참석자·동승자' },
  purpose: nullable('string', '사용 목적'),
  facility: {
    type: 'array',
    items: { type: 'string', enum: ['모니터', '화이트보드', '빔프로젝터', '화상회의', '하이패스', '조명', '크로마키', '카메라'] },
  },
  isRecurring: { type: 'boolean' },
  recurrencePattern: nullableEnum(['매주', '격주', '매월'], '반복 예약일 때'),
  notificationRequest: { type: 'boolean', description: '알림·리마인드를 원하면 true' },
  notes: nullable('string', '그 밖의 요청 사항'),
});
