import { describe, expect, it } from 'vitest';
import { coachRuntimeFromEnv, completeModelReply, streamModelReply } from './provider.js';

describe('coach provider', () => {
  it('names the environment variables required for a real model', () => {
    expect(coachRuntimeFromEnv({}).name).toBe('unconfigured');
    if (coachRuntimeFromEnv({}).name === 'unconfigured') {
      expect(coachRuntimeFromEnv({}).missing).toContain('SAHHTI_COACH_API_KEY');
    }
    expect(coachRuntimeFromEnv({ SAHHTI_COACH_PROVIDER: 'development_mock' }).name).toBe('development_mock');
    const ready = coachRuntimeFromEnv({
      SAHHTI_COACH_PROVIDER: 'openai_compatible',
      SAHHTI_COACH_API_KEY: 'secret-key',
      SAHHTI_COACH_BASE_URL: 'https://example.test/v1/',
      SAHHTI_COACH_MODEL: 'sahhti-model',
    });
    expect(ready).toMatchObject({ name: 'openai_compatible', baseUrl: 'https://example.test/v1', model: 'sahhti-model' });
  });

  it('sends member context to the provider and returns the model text', async () => {
    const calls: { authorization?: string; body?: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ authorization: new Headers(init?.headers).get('authorization') ?? undefined, body: String(init?.body) });
      expect(url).toBe('https://example.test/v1/chat/completions');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'اشرب ماء وكمّل التمرين المسجّل.' } }], usage: { prompt_tokens: 12, completion_tokens: 8 } }), { status: 200 });
    }) as typeof fetch;
    const reply = await completeModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'ar',
      history: [{ role: 'member', body: 'وش أسوي اليوم؟' }],
      context: { goals: ['general_health'], todayDiary: null },
      fetchImpl,
    });
    expect(reply.text).toContain('التمرين');
    expect(calls[0]?.authorization).toBe('Bearer secret-key');
    expect(calls[0]?.body).toContain('general_health');
    expect(calls[0]?.body).toContain('Yazan');
    expect(reply.text).not.toContain('secret-key');
  });

  it('assembles a streamed provider reply', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"تمارينك"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" محفوظة"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const fetchImpl = (async () => new Response(stream, { status: 200 })) as typeof fetch;
    const reply = await streamModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'ar',
      history: [{ role: 'member', body: 'اليوم' }],
      context: { goals: [] },
      fetchImpl,
    });
    expect(reply.text).toBe('تمارينك محفوظة');
  });
});