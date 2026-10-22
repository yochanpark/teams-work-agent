import { createOpenAiLlm } from './openai.js';

// OpenAI 키가 있으면 OpenAI, 없고 GEMINI_API_KEY만 있으면 Gemini(무료 등급)의 OpenAI 호환 주소로 부른다.
// 둘 다 Chat Completions 형식이라 주소·모델 이름만 다르다.
export function llmFromEnv(env = process.env) {
  if (env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
      llm: createOpenAiLlm({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }),
    };
  }
  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL ?? 'gemini-3.5-flash';
    return {
      provider: 'gemini',
      model,
      llm: createOpenAiLlm({
        apiKey: env.GEMINI_API_KEY,
        model,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      }),
    };
  }
  return null;
}
