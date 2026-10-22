import { readFileSync } from 'node:fs';
import express from 'express';
import botbuilder from 'botbuilder';
import { createCalendar } from './calendar/calendar.js';
import { createAgent } from './agent.js';
import { createMemoryStore } from './rules/reservationStore.js';
import { WorkAgentBot } from './bot/workAgentBot.js';

const { CloudAdapter, ConfigurationBotFrameworkAuthentication } = botbuilder;

const loadJson = (name) => JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8'));

// 의존성을 밖에서 받아 테스트에서 가짜 LLM·RPA로 바꿔 끼운다.
export function createApp({ llm, rpa, env = process.env, store = createMemoryStore(), today, logger }) {
  const agent = createAgent({
    llm,
    calendar: createCalendar(loadJson('holidays-kr-2026.json')),
    catalog: loadJson('resources.json'),
    store,
    today,
  });
  const bot = new WorkAgentBot({ agent, rpa, logger });

  // MicrosoftAppId 등이 비어 있으면 인증 없이 동작한다(로컬·에뮬레이터)
  const adapter = new CloudAdapter(new ConfigurationBotFrameworkAuthentication(env));
  adapter.onTurnError = async (context, error) => {
    logger?.error?.('turn', error);
    await context.sendActivity('처리 중 문제가 생겼습니다.');
  };

  const app = express();
  app.use(express.json());
  app.post('/api/messages', (req, res) => adapter.process(req, res, (context) => bot.run(context)));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return app;
}
