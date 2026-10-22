import Ajv from 'ajv';
import { todayKst } from './calendar/calendar.js';
import { intentSchema, leaveSchema, reservationSchema } from './llm/schemas.js';
import { intentPrompt, leavePrompt, reservationPrompt } from './llm/prompts.js';
import { buildLeaveRequest } from './rules/leave.js';
import { buildReservation } from './rules/reservation.js';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validators = {
  intent: ajv.compile(intentSchema),
  leave: ajv.compile(leaveSchema),
  reservation: ajv.compile(reservationSchema),
};

export class LlmOutputError extends Error {}

// 1단계: 의도 분류 → 2단계: 의도별 스키마로 추출 → 3단계: 코드 규칙으로 확정
export function createAgent({ llm, calendar, catalog, store, today = todayKst }) {
  async function extract(name, prompt, schema, text) {
    const output = await llm.extract({ ...prompt, user: text, schemaName: name, schema });
    if (!validators[name](output)) {
      throw new LlmOutputError(`${name} output invalid: ${ajv.errorsText(validators[name].errors)}`);
    }
    return output;
  }

  return {
    async handle(text, user) {
      const day = today();
      const { intent } = await extract('intent', intentPrompt(), intentSchema, text);

      if (intent === 'leave') {
        const extracted = await extract('leave', leavePrompt(day), leaveSchema, text);
        const request = buildLeaveRequest(extracted, { today: day, calendar, text });
        return { kind: 'leave', status: 'ready', payload: { ...request, userEmail: user.email ?? '' } };
      }

      if (intent === 'resource') {
        const extracted = await extract('reservation', reservationPrompt(day), reservationSchema, text);
        return { kind: 'resource', ...buildReservation(extracted, { today: day, catalog, store, user }) };
      }

      return { kind: 'unknown' };
    },
  };
}
