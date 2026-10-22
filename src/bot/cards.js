// 확인 카드. 사용자가 "확인"을 눌러야 RPA가 실행된다.

const LEAVE_LABELS = {
  type: '구분',
  leaveType: '휴가 종류',
  startDate: '시작일',
  endDate: '종료일',
  startleaveTime: '시작 반차',
  endleaveTime: '종료 반차',
  reason: '사유',
};

const RESOURCE_LABELS = {
  resourceName: '자원',
  location: '위치',
  date: '날짜',
  startTime: '시작',
  endTime: '종료',
  attendeesCount: '인원',
  purpose: '목적',
};

const facts = (values, labels) =>
  Object.entries(labels)
    .filter(([key]) => values[key] !== '' && values[key] !== null && values[key] !== undefined)
    .map(([key, title]) => ({ title, value: String(values[key]) }));

export function confirmCard(kind, payload) {
  const isLeave = kind === 'leave';
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: isLeave ? '근태 요청 확인' : '자원 예약 확인', weight: 'Bolder', size: 'Medium' },
      { type: 'FactSet', facts: isLeave ? facts(payload.entities, LEAVE_LABELS) : facts(payload, RESOURCE_LABELS) },
      { type: 'TextBlock', text: '내용이 맞으면 확인을 눌러 주세요.', wrap: true, isSubtle: true },
    ],
    actions: [
      { type: 'Action.Submit', title: '확인', data: { action: 'confirm', kind, payload } },
      { type: 'Action.Submit', title: '취소', data: { action: 'cancel' } },
    ],
  };
}
