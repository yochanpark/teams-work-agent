import { createApp } from './app.js';
import { llmFromEnv } from './llm/config.js';
import { createAaClient } from './rpa/aaClient.js';

const env = process.env;
const configured = llmFromEnv(env);
if (!configured) {
  console.error('OPENAI_API_KEY 또는 GEMINI_API_KEY가 필요합니다. .env를 확인하세요.');
  process.exit(1);
}

const app = createApp({
  llm: configured.llm,
  rpa: createAaClient({
    controlRoomUrl: env.AA_CONTROL_ROOM_URL,
    username: env.AA_USERNAME,
    apiKey: env.AA_API_KEY,
    bots: { leave: Number(env.AA_LEAVE_BOT_ID), resource: Number(env.AA_RESOURCE_BOT_ID) },
    runAsUserIds: (env.AA_RUN_AS_USER_IDS ?? '').split(',').filter(Boolean).map(Number),
  }),
  logger: console,
});

const port = Number(env.PORT ?? 3978);
app.listen(port, () => console.log(`teams-work-agent listening on :${port}/api/messages`));
