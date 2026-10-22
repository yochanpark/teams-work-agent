// Automation Anywhere Control Room API로 RPA 봇을 실행한다.
//  1) POST /v2/authentication           → token
//  2) POST /v4/automations/deploy       (X-Authorization: token)
//     botInput.dicInput = DICTIONARY    ← 에이전트가 만든 JSON을 그대로 넘긴다
// controlRoomUrl이 없으면 실제 호출 없이 보낼 내용만 돌려준다(로컬 데모용).

export function createAaClient({
  controlRoomUrl,
  username,
  apiKey,
  bots = {}, // { leave: 123, resource: 456 } — 의도별로 실행할 봇 ID
  runAsUserIds = [],
  fetchImpl = fetch,
}) {
  let token = null;

  async function authenticate() {
    const res = await fetchImpl(`${controlRoomUrl}/v2/authentication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, apiKey, multipleLogin: true }),
    });
    if (!res.ok) throw new Error(`AA authentication failed: ${res.status}`);
    token = (await res.json()).token;
  }

  async function deploy(body) {
    return fetchImpl(`${controlRoomUrl}/v4/automations/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': token },
      body: JSON.stringify(body),
    });
  }

  return {
    async run(kind, payload) {
      const body = {
        botId: bots[kind],
        unattendedRequest: { runAsUserIds },
        botInput: { dicInput: { type: 'DICTIONARY', dictionary: payload } },
      };
      if (!controlRoomUrl) return { dryRun: true, body };

      if (!token) await authenticate();
      let res = await deploy(body);
      if (res.status === 401) {
        // 토큰 만료 — 한 번만 다시 발급받는다
        await authenticate();
        res = await deploy(body);
      }
      if (!res.ok) throw new Error(`AA deploy failed: ${res.status}`);
      return { dryRun: false, deploymentId: (await res.json()).deploymentId };
    },
  };
}
