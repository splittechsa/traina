export const COACH_REQUIRED_ENV = [
  'SAHHTI_COACH_PROVIDER',
  'SAHHTI_COACH_API_KEY',
  'SAHHTI_COACH_BASE_URL',
  'SAHHTI_COACH_MODEL',
] as const;

export type CoachRuntime =
  | { name: 'development_mock' }
  | { name: 'unconfigured'; missing: string[] }
  | { name: 'openai_compatible'; apiKey: string; baseUrl: string; model: string };

const READ_TOOLS = [
  'getUserProfile',
  'getActiveGoals',
  'getTodaysWorkout',
  'getWorkoutHistory',
  'getFoodDiary',
  'getNutritionTargets',
  'getProgressTrends',
] as const;

const WRITE_TOOLS = new Set([
  'proposeProgramAdjustment',
  'proposeNutritionAdjustment',
  'logWorkoutSet',
  'logFoodEntry',
  'saveConfirmedMemory',
]);

export function coachRuntimeFromEnv(env: Record<string, string | undefined>): CoachRuntime {
  if (env.SAHHTI_COACH_PROVIDER === 'development_mock') {
    return { name: 'development_mock' };
  }
  if (env.SAHHTI_COACH_PROVIDER !== 'openai_compatible') {
    return { name: 'unconfigured', missing: [...COACH_REQUIRED_ENV] };
  }
  const missing = ['SAHHTI_COACH_API_KEY', 'SAHHTI_COACH_BASE_URL', 'SAHHTI_COACH_MODEL'].filter((key) => {
    const value = env[key];
    return value === undefined || value.trim().length === 0;
  });
  if (missing.length > 0) {
    return { name: 'unconfigured', missing };
  }
  return {
    name: 'openai_compatible',
    apiKey: env.SAHHTI_COACH_API_KEY!.trim(),
    baseUrl: env.SAHHTI_COACH_BASE_URL!.trim().replace(/\/$/, ''),
    model: env.SAHHTI_COACH_MODEL!.trim(),
  };
}

export type CoachTurn = {
  text: string;
  tool: string | null;
  promptTokens: number;
  completionTokens: number;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown;
};

function systemPrompt(localeHint: 'ar' | 'en', context: string): string {
  const language = localeHint === 'ar'
    ? 'Reply in Arabic. Use a natural Saudi tone when the member writes in Saudi Arabic.'
    : 'Reply in English.';
  return [
    'You are the Sahhti fitness coach.',
    language,
    'Do not diagnose disease, prescribe medication, or recommend extreme dieting, dangerous fasting, or unprescribed supplements.',
    'Use only the member context. If a value is absent, say it is unknown. Never invent calories, body weight, workouts, or food nutrition.',
    'Write actions are not executed here. If the member wants a log changed, tell them to confirm it in the app.',
    `Member context: ${context}`,
  ].join('\n');
}

function toolDefinitions() {
  return READ_TOOLS.map((name) => ({
    type: 'function',
    function: {
      name,
      description: 'Read data already loaded for the signed-in member. Arguments are ignored.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  }));
}

type Completion = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function?: { name?: string } }>;
    };
    delta?: { content?: string };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

// Total wall-clock budget for a single /v1/coach/messages request, shared across BOTH calls
// to the model provider when a read-tool is used (initial call + the follow-up call that
// feeds the tool result back in). Previously each call got its own independent 20s
// AbortSignal.timeout, so the tool-use path could legitimately take up to 40s server-side —
// comfortably longer than the mobile client's 22s request timeout. That mismatch is the
// documented root cause of the Coach "stuck loading" / frequent-failure reports on a real
// device: the client would abort and surface an error (or, perceived by the member, stay on
// the pending bubble) well before the server had actually finished, and the server's reply —
// along with the coach_messages insert — would land after the client had already given up,
// so the message would only appear on the NEXT history refetch, looking exactly like "stuck
// then recovers on its own."
const COACH_OVERALL_TIMEOUT_MS = 28_000;

async function postChat(
  runtime: Extract<CoachRuntime, { name: 'openai_compatible' }>,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  return fetchImpl(`${runtime.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${runtime.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
}

export async function completeModelReply(input: {
  runtime: Extract<CoachRuntime, { name: 'openai_compatible' }>;
  localeHint: 'ar' | 'en';
  history: readonly { role: 'member' | 'assistant'; body: string }[];
  context: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<CoachTurn> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const deadline = Date.now() + COACH_OVERALL_TIMEOUT_MS;
  const context = JSON.stringify(input.context).slice(0, 4_500);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(input.localeHint, context) },
    ...input.history.slice(-8).map((item) => ({
      role: item.role === 'member' ? 'user' as const : 'assistant' as const,
      content: item.body,
    })),
  ];
  const first = await postChat(input.runtime, {
    model: input.runtime.model,
    temperature: 0.4,
    messages,
  }, fetchImpl, deadline - Date.now());
  if (!first.ok) {
    throw new Error('MODEL_REQUEST_FAILED');
  }
  const payload = (await first.json()) as Completion;
  const call = payload.choices?.[0]?.message?.tool_calls?.[0];
  const toolName = call?.function?.name;
  if (toolName !== undefined && WRITE_TOOLS.has(toolName)) {
    return {
      text: input.localeHint === 'ar'
        ? 'هذا التغيير يحتاج تأكيدك داخل التطبيق. لم يُحفظ شيء.'
        : 'That change needs your confirmation in the app. Nothing was saved.',
      tool: toolName,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    };
  }
  if (toolName !== undefined && (READ_TOOLS as readonly string[]).includes(toolName)) {
    messages.push({
      role: 'assistant',
      content: payload.choices?.[0]?.message?.content ?? '',
      tool_calls: payload.choices?.[0]?.message?.tool_calls,
    });
    messages.push({ role: 'tool', tool_call_id: call?.id ?? 'tool', content: context });
    // Share the SAME overall deadline rather than granting a fresh timeout: the two-call
    // tool-use path must stay within one client-observable budget, not double it.
    const remaining = deadline - Date.now();
    if (remaining < 1_500) {
      throw new Error('MODEL_REQUEST_FAILED');
    }
    const second = await postChat(input.runtime, { model: input.runtime.model, temperature: 0.4, messages }, fetchImpl, remaining);
    if (!second.ok) {
      throw new Error('MODEL_REQUEST_FAILED');
    }
    const followed = (await second.json()) as Completion;
    const text = followed.choices?.[0]?.message?.content?.trim() ?? '';
    if (text.length === 0) {
      throw new Error('MODEL_EMPTY');
    }
    return {
      text,
      tool: toolName,
      promptTokens: (payload.usage?.prompt_tokens ?? 0) + (followed.usage?.prompt_tokens ?? 0),
      completionTokens: (payload.usage?.completion_tokens ?? 0) + (followed.usage?.completion_tokens ?? 0),
    };
  }
  const text = payload.choices?.[0]?.message?.content?.trim() ?? '';
  if (text.length === 0) {
    throw new Error('MODEL_EMPTY');
  }
  return {
    text,
    tool: null,
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    completionTokens: payload.usage?.completion_tokens ?? 0,
  };
}

export async function streamModelReply(input: {
  runtime: Extract<CoachRuntime, { name: 'openai_compatible' }>;
  localeHint: 'ar' | 'en';
  history: readonly { role: 'member' | 'assistant'; body: string }[];
  context: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const context = JSON.stringify(input.context).slice(0, 4_500);
  const response = await postChat(input.runtime, {
    model: input.runtime.model,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt(input.localeHint, context) },
      ...input.history.slice(-8).map((item) => ({
        role: item.role === 'member' ? 'user' : 'assistant',
        content: item.body,
      })),
    ],
  }, fetchImpl, COACH_OVERALL_TIMEOUT_MS);
  if (!response.ok || response.body === null) {
    throw new Error('MODEL_REQUEST_FAILED');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue;
      try {
        const parsed = JSON.parse(trimmed.slice(5).trim()) as Completion;
        text += parsed.choices?.[0]?.delta?.content ?? '';
      } catch {
        continue;
      }
    }
  }
  if (text.trim().length === 0) {
    throw new Error('MODEL_EMPTY');
  }
  return { text: text.trim(), promptTokens: 0, completionTokens: 0 };
}
