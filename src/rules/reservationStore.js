// 예약 현황 저장소. 데모·테스트용 메모리 구현이고, 운영에서는 같은 인터페이스로
// 그룹웨어 API나 DB 조회를 붙인다.
export function createMemoryStore(reservations = []) {
  const items = [...reservations];
  const overlaps = (a, b) => a.startTime < b.endTime && b.startTime < a.endTime;

  return {
    isFree(resourceId, date, startTime, endTime) {
      return !items.some(
        (r) => r.resourceId === resourceId && r.date === date && overlaps(r, { startTime, endTime }),
      );
    },
    // 업무 시간(08~19시) 중 비어 있는 1시간 단위 슬롯
    freeSlots(resourceId, date) {
      const slots = [];
      for (let h = 8; h < 19; h++) {
        const s = `${String(h).padStart(2, '0')}:00`;
        const e = `${String(h + 1).padStart(2, '0')}:00`;
        if (this.isFree(resourceId, date, s, e)) slots.push(`${s}-${e}`);
      }
      return slots;
    },
  };
}
