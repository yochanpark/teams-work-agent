// OpenAI Chat Completions + Structured Outputs(json_schema, strict).
// SDK 없이 fetch로 호출한다. 429·5xx는 짧게 물러났다가 다시 시도한다.

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createOpenAiLlm({
  apiKey,
  model = 'gpt-4o-mini',
  baseUrl = 'https://api.openai.com/v1',
  maxAttempts = 3,
  fetchImpl = fetch,
}) {
  return {
    async extract({ system, user, schemaName, schema }) {
      const body = JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
      });

      for (let attempt = 1; ; attempt++) {
        const res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body,
        });
        if (res.ok) {
          const message = (await res.json()).choices[0].message;
          if (message.refusal) throw new Error(`LLM refused: ${message.refusal}`);
          return JSON.parse(message.content);
        }
        if (!RETRYABLE.has(res.status) || attempt >= maxAttempts) {
          throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
        }
        await sleep(500 * 2 ** (attempt - 1));
      }
    },
  };
}
