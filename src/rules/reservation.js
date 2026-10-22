import { resolveDateExpr } from './dateExpr.js';

// LLM이 뽑은 값으로 예약 가능 여부를 판정한다. 수용 인원·빈 시간 같은 사실 판단은
// 모델에 맡기지 않고 자원 목록과 예약 현황을 조회해서 정한다.

const addMinutes = (hhmm, minutes) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export function buildReservation(extracted, { today, catalog, store, user }) {
  const date = resolveDateExpr(extracted.date, today, { preferFuture: true });
  const startTime = extracted.startTime;
  const endTime =
    extracted.endTime ??
    (startTime && extracted.durationMinutes ? addMinutes(startTime, extracted.durationMinutes) : null);

  // 빠진 값이 있으면 되묻는다
  const missing = [];
  if (!date) missing.push('date');
  if (!startTime) missing.push('startTime');
  if (!endTime) missing.push('endTime');
  if (missing.length) return { status: 'needs_input', missing };

  if (date < today) return { status: 'rejected', reason: 'past_date', date };
  if (endTime <= startTime) return { status: 'rejected', reason: 'invalid_time', startTime, endTime };

  const ofType = catalog.filter((r) => r.type === extracted.resourceType);
  // 모델이 "301호"처럼 "호"를 붙여 뽑기도 해서 공백과 "호"를 빼고 비교한다
  const normalize = (name) => name.replace(/\s|호/g, '');
  const named = extracted.resourceName
    ? ofType.filter((r) => normalize(r.name).includes(normalize(extracted.resourceName)))
    : ofType;
  if (!named.length) return { status: 'rejected', reason: 'unknown_resource', resourceName: extracted.resourceName };

  const headcount = extracted.attendeesCount ?? (extracted.attendees.length || null);
  const fits = (r) =>
    (!headcount || r.capacity >= headcount) && extracted.facility.every((f) => r.facility.includes(f));

  const suitable = named.filter(fits);
  if (!suitable.length) {
    return {
      status: 'rejected',
      reason: 'not_suitable',
      // 인원·장비 조건을 만족하는 같은 유형 자원을 대안으로
      alternatives: ofType.filter(fits).map((r) => r.name),
    };
  }

  // 조건을 만족하는 자원 중 가장 작은 것부터 비어 있는지 확인
  suitable.sort((a, b) => a.capacity - b.capacity);
  const free = suitable.find((r) => store.isFree(r.id, date, startTime, endTime));
  if (!free) {
    return {
      status: 'conflict',
      date,
      availableSlots: Object.fromEntries(suitable.map((r) => [r.name, store.freeSlots(r.id, date)])),
    };
  }

  return {
    status: 'ready',
    payload: {
      type: free.type,
      resourceName: free.name,
      location: free.location,
      userName: user.name,
      userEmail: user.email ?? '',
      date,
      startTime,
      endTime,
      attendeesCount: headcount ?? 0,
      attendees: extracted.attendees,
      capacity: free.capacity,
      purpose: extracted.purpose ?? '',
      facility: extracted.facility,
      status: '대기',
      isRecurring: extracted.isRecurring,
      recurrencePattern: extracted.recurrencePattern ?? '',
      notificationRequest: extracted.notificationRequest,
      notes: extracted.notes ?? '',
    },
  };
}
