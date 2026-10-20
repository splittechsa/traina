import { describe, expect, it, vi } from 'vitest';
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

  it('resolves read tools through the server resolver instead of inventing facts', async () => {
    let round = 0;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      round += 1;
      if (round === 1) {
        return new Response(
          JSON.stringify({
            choices: [{
              message: {
                content: '',
                tool_calls: [{ id: 'call-1', function: { name: 'getCurrentTrainingProgram' } }],
              },
            }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
          }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
      const toolMsg = body.messages.find((row) => row.role === 'tool');
      expect(toolMsg?.content).toContain('recovery_preference');
      expect(toolMsg?.content).toContain('rec-1');
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'خطتك الحالية عليها تكيّف استشفاء معتمد.' } }],
          usage: { prompt_tokens: 20, completion_tokens: 12 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const reply = await completeModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'ar',
      history: [{ role: 'member', body: 'هل تغيّرت خطتي؟' }],
      context: { goals: ['fat_loss'] },
      resolveTool: (name) => {
        expect(name).toBe('getCurrentTrainingProgram');
        return {
          activeProgram: {
            programId: 'p1',
            version: 2,
            templateId: 'gym_full_body',
            adaptationKind: 'recovery_preference',
            sourceRecommendationId: 'rec-1',
          },
        };
      },
      fetchImpl,
    });
    expect(reply.tool).toBe('getCurrentTrainingProgram');
    expect(reply.text).toContain('تكيّف');
    expect(round).toBe(2);
  });

  it('resolves every parallel authorized tool and refuses mixed writes before resolving reads', async () => {
    const runtime = { name: 'openai_compatible' as const, apiKey: 'synthetic-key', baseUrl: 'https://test', model: 'test' };
    const calls = [{ id: 'profile', function: { name: 'getUserProfile' } }, { id: 'progress', function: { name: 'getProgressTrends' } }];
    const resolveTool = vi.fn((name: string) => ({ name, userId: 'owned-user' })); let round = 0;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      round++;
      if (round === 1) return new Response(JSON.stringify({ choices: [{ message: { tool_calls: calls } }] }));
      const messages = JSON.parse(String(init.body)).messages;
      expect(messages.filter((message: { role: string }) => message.role === 'tool').map((message: { tool_call_id: string }) => message.tool_call_id)).toEqual(['profile', 'progress']);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Owned facts only' } }] }));
    }) as typeof fetch;
    const reply = await completeModelReply({ runtime, localeHint: 'en', history: [], context: {}, resolveTool, fetchImpl });
    expect(reply.tools).toEqual(['getUserProfile', 'getProgressTrends']); expect(resolveTool).toHaveBeenCalledTimes(2);
    resolveTool.mockClear();
    const mixed = (async () => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [...calls, { id: 'write', function: { name: 'logWorkoutSet' } }] } }] }))) as typeof fetch;
    expect((await completeModelReply({ runtime, localeHint: 'en', history: [], context: {}, resolveTool, fetchImpl: mixed })).text).toContain('Nothing was saved');
    expect(resolveTool).not.toHaveBeenCalled();
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