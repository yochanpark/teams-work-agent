import botbuilder from 'botbuilder';
import { confirmCard } from './cards.js';

const { TeamsActivityHandler, TeamsInfo, CardFactory } = botbuilder;

const FIELD_QUESTIONS = { date: '날짜', startTime: '시작 시간', endTime: '종료 시간이나 사용 시간' };
const REJECT_MESSAGES = {
  past_date: '지난 날짜는 예약할 수 없습니다.',
  invalid_time: '종료 시간이 시작 시간보다 늦어야 합니다.',
  unknown_resource: '말씀하신 자원을 찾지 못했습니다.',
};

export function replyText(result) {
  switch (result.status) {
    case 'needs_input':
      return `${result.missing.map((f) => FIELD_QUESTIONS[f]).join(', ')}을(를) 알려 주세요.`;
    case 'conflict':
      return [
        `${result.date}에 요청하신 시간은 이미 예약되어 있습니다. 비어 있는 시간:`,
        ...Object.entries(result.availableSlots).map(([name, slots]) => `- ${name}: ${slots.join(', ') || '없음'}`),
      ].join('\n');
    case 'rejected':
      if (result.reason === 'not_suitable') {
        return `인원·장비 조건에 맞지 않습니다. 대신 ${result.alternatives.join(', ') || '맞는 자원이 없습니다'}`;
      }
      return REJECT_MESSAGES[result.reason];
    default:
      return '연차·근태 요청이나 회의실·법인차량·스튜디오·세차장 예약을 말씀해 주세요.';
  }
}

// Teams 사용자 정보. Teams 밖(에뮬레이터)에서는 조회가 실패하므로 표시 이름만 쓴다.
async function currentUser(context) {
  try {
    const member = await TeamsInfo.getMember(context, context.activity.from.id);
    return { name: member.name, email: member.email ?? member.userPrincipalName };
  } catch {
    return { name: context.activity.from.name ?? '', email: null };
  }
}

export class WorkAgentBot extends TeamsActivityHandler {
  constructor({ agent, rpa, logger = console }) {
    super();

    this.onMessage(async (context, next) => {
      const submitted = context.activity.value;

      if (submitted?.action === 'confirm') {
        const result = await rpa.run(submitted.kind, submitted.payload);
        await context.sendActivity(
          result.dryRun ? '확인했습니다. (데모 모드: RPA 호출 없이 요청 내용만 기록했습니다)' : '요청을 접수했습니다.',
        );
        logger.info?.('rpa', JSON.stringify(result));
      } else if (submitted?.action === 'cancel') {
        await context.sendActivity('요청을 취소했습니다.');
      } else {
        const text = (context.activity.text ?? '').trim();
        try {
          const result = await agent.handle(text, await currentUser(context));
          if (result.status === 'ready') {
            await context.sendActivity({ attachments: [CardFactory.adaptiveCard(confirmCard(result.kind, result.payload))] });
          } else {
            await context.sendActivity(replyText(result));
          }
        } catch (error) {
          logger.error?.('agent', error);
          await context.sendActivity('요청을 이해하지 못했습니다. 조금 다르게 말씀해 주세요.');
        }
      }
      await next();
    });
  }
}
