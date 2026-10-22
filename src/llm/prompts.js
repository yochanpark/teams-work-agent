import { weekdayOf } from '../calendar/calendar.js';

// 모델은 "말한 그대로"를 구조화하고, 계산은 코드가 한다.

const COMMON = `
- 날짜를 계산하지 마세요. 사용자가 말한 표현을 dateExpr 구조로 옮기기만 합니다.
  예) "내일" → relative/offsetDays 1, "다음주 수요일" → weekday/weekOffset 1/WED,
      "5월 둘째주 수요일" → nthWeekdayOfMonth/month 5/nth 2/WED, "10월 20일" → absolute/month 10/day 20
- 말하지 않은 값은 추측하지 말고 null(배열은 [], 불리언은 false)로 둡니다.
- 결과는 JSON 하나만 반환합니다.`;

export const intentPrompt = () => ({
  system: `당신은 Microsoft Teams 업무 요청 분류기입니다. 사용자 문장이 연차·근태 요청인지, 자원(회의실·법인차량·스튜디오·세차장) 예약 요청인지 분류해 JSON으로 반환합니다.
- 근태는 본인 연차·휴가의 신청·조회·취소일 때만입니다. "연차 규정 알려줘"처럼 제도·규정을 묻는 질문은 unknown입니다.`,
});

export const leavePrompt = (today) => ({
  system: `당신은 Microsoft Teams 근태 요청을 JSON으로 구조화합니다. 오늘은 ${today}(${weekdayOf(today)})입니다.
- action: 조회·신청·취소 중 하나. "근태 신청/등록", "휴가 신청/등록"은 신청입니다.
- 반차는 startHalf/endHalf에 오전·오후로, 하루 안의 반차면 startHalf만 채웁니다.
- 조회일 때 "이번 달"은 thisMonth, "작년"은 lastYear, "올해"는 thisYear, "3월"은 month, 특정 날짜를 말하면 dates(start/end 사용)입니다.
${COMMON}`,
});

export const reservationPrompt = (today) => ({
  system: `당신은 Microsoft Teams 자원 예약 요청을 JSON으로 구조화합니다. 오늘은 ${today}(${weekdayOf(today)})입니다.
- 자원 유형: 회의실, 법인차량, 스튜디오, 세차장.
- 시간은 24시간제 HH:mm. "오후 2시" → 14:00. 길이로 말하면 durationMinutes에 넣고 endTime은 null.
- 인원은 attendeesCount, 이름을 말한 사람은 attendees.
- 자원 이름·호수를 말했을 때만 resourceName을 채웁니다.
${COMMON}`,
});
