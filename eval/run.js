// 실제 모델로 발화 → 최종 출력까지 돌려 정답과 비교한다.
// 사용: OPENAI_API_KEY 또는 GEMINI_API_KEY를 .env에 넣고 npm run eval
import { readFileSync } from 'node:fs';
import { createAgent } from '../src/agent.js';
import { createCalendar } from '../src/calendar/calendar.js';
import { llmFromEnv } from '../src/llm/config.js';
import { createMemoryStore } from '../src/rules/reservationStore.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const configured = llmFromEnv();
if (!configured) {
  console.error('OPENAI_API_KEY 또는 GEMINI_API_KEY가 없습니다. .env에 넣고 다시 실행하세요.');
  process.exit(1);
}

const { today, cases } = load('./cases.json');
const agent = createAgent({
  llm: configured.llm,
  calendar: createCalendar(load('../src/data/holidays-kr-2026.json')),
  catalog: load('../src/data/resources.json'),
  store: createMemoryStore(),
  today: () => today,
});

// 사유·목적은 모델이 표현을 조금 바꿔도 맞게 본다(포함 여부)
const LOOSE = new Set(['reason', 'purpose']);
const same = (key, expected, actual) =>
  LOOSE.has(key) ? typeof actual === 'string' && actual.includes(expected) : expected === actual;

// 무료 등급은 분당 요청 수가 적다. EVAL_DELAY_MS만큼 문장 사이를 띄운다(문장당 호출 2번)
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 0);

let passed = 0;
for (const c of cases) {
  if (delayMs && c !== cases[0]) await new Promise((r) => setTimeout(r, delayMs));
  let actual;
  try {
    const r = await agent.handle(c.text, { name: '평가', email: 'eval@example.com' });
    actual = { kind: r.kind, ...(r.kind === 'leave' ? r.payload.entities : { ...r.payload, status: r.status }) };
  } catch (error) {
    actual = { kind: 'error', error: error.message };
  }
  const diffs =
    actual.kind === 'error'
      ? [`호출 실패: ${actual.error.replace(/\s+/g, ' ').slice(0, 200)}`]
      : [['kind', c.kind], ...Object.entries(c.expected)]
          .filter(([k, v]) => !same(k, v, actual[k]))
          .map(([k, v]) => `${k}: 기대 ${JSON.stringify(v)} / 실제 ${JSON.stringify(actual[k])}`);
  if (!diffs.length) passed++;
  console.log(`${diffs.length ? '✗' : '✓'} ${c.text}${diffs.length ? `\n    ${diffs.join('\n    ')}` : ''}`);
}

console.log(`\n${passed}/${cases.length} 통과 (${Math.round((passed / cases.length) * 100)}%) — ${configured.provider} ${configured.model}`);
