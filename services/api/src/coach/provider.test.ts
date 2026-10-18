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

  it('refuses write tools without saving and explains confirmation is required', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: '',
              tool_calls: [{ id: 'w1', function: { name: 'proposeNutritionAdjustment' } }],
            },
          }],
          usage: { prompt_tokens: 5, completion_tokens: 1 },
        }),
        { status: 200 },
      )) as typeof fetch;
    const reply = await completeModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'en',
      history: [{ role: 'member', body: 'Cut my calories by 500' }],
      context: { goals: ['fat_loss'] },
      fetchImpl,
    });
    expect(reply.tool).toBe('proposeNutritionAdjustment');
    expect(reply.text.toLowerCase()).toContain('confirmation');
    expect(reply.text.toLowerCase()).toContain('nothing was saved');
  });

  it('aggregates token cost across the tool-calling round trip', async () => {
    let round = 0;
    const fetchImpl = (async () => {
      round += 1;
      if (round === 1) {
        return new Response(
          JSON.stringify({
            choices: [{
              message: {
                content: '',
                tool_calls: [{ id: 'c1', function: { name: 'getProgressTrends' } }],
              },
            }],
            usage: { prompt_tokens: 11, completion_tokens: 3 },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Weight trend is -350 g/week from MemberState.' } }],
          usage: { prompt_tokens: 17, completion_tokens: 9 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const reply = await completeModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'en',
      history: [{ role: 'member', body: 'How is my progress?' }],
      context: { goals: ['strength'] },
      resolveTool: () => ({
        inventsTrends: false,
        weightTrendGramsPerWeek: -350,
        confidence: 'moderate',
      }),
      fetchImpl,
    });
    expect(reply.tool).toBe('getProgressTrends');
    expect(reply.promptTokens).toBe(28);
    expect(reply.completionTokens).toBe(12);
    expect(reply.text).toContain('-350');
  });

  it('recovers from an empty model completion with MODEL_EMPTY', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '   ' } }],
          usage: { prompt_tokens: 2, completion_tokens: 0 },
        }),
        { status: 200 },
      )) as typeof fetch;
    await expect(
      completeModelReply({
        runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
        localeHint: 'en',
        history: [{ role: 'member', body: 'hi' }],
        context: {},
        fetchImpl,
      }),
    ).rejects.toThrow('MODEL_EMPTY');
  });

  it('puts ENERGY_POLICY and human-approval rules in the system prompt', async () => {
    let body = '';
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      body = String(init?.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    await completeModelReply({
      runtime: { name: 'openai_compatible', apiKey: 'secret-key', baseUrl: 'https://example.test/v1', model: 'sahhti-model' },
      localeHint: 'en',
      history: [{ role: 'member', body: 'change my macros' }],
      context: { goals: ['fat_loss'] },
      fetchImpl,
    });
    expect(body).toContain('ENERGY_POLICY');
    expect(body).toContain('draft_only');
    expect(body).toContain('human approval');
    expect(body).toContain('getProgressTrends');
  });
});