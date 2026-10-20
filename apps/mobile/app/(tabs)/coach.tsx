import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView, Text, TextInput, View, type ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { labelList } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import { AIChatBubble, AppHeader, EmptyState, LoadingSkeleton } from '../../src/ui/kit';
import { stableRecordKey } from '../../src/lists/keys';

type CoachReply = { text: string; provider: string; productionIntelligence: boolean; tool?: string | null };
type StoredMessage = { id: string; role: string; body: string; authorKind?: string };
type History = {
  messages: StoredMessage[];
  productionIntelligence: boolean;
  providerConfigured: boolean;
  provider?: string;
  quota?: { used: number; limit: number; remaining: number };
};
type Me = { goals?: string[] };

function toolNote(tool: string | null | undefined, locale: 'ar' | 'en'): string | undefined {
  if (tool === null || tool === undefined || tool.length === 0) return undefined;
  const map: Record<string, { ar: string; en: string }> = {
    getTodaysWorkout: { ar: 'استند إلى تمرين اليوم', en: 'Used today’s workout' },
    getFoodDiary: { ar: 'استند إلى سجل الطعام', en: 'Used food diary' },
    getMemberState: { ar: 'استند إلى حالتك', en: 'Used member state' },
    getRecommendationStatus: { ar: 'استند إلى حالة التوصيات', en: 'Used recommendation status' },
    getHumanCoachFeedback: { ar: 'استند إلى ملاحظات المدرب البشري', en: 'Used human coach feedback' },
  };
  return map[tool]?.[locale] ?? (locale === 'ar' ? `أداة: ${tool}` : `Tool: ${tool}`);
}

export default function CoachScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { tokens } = useSession();
  const client = useQueryClient();
  const { reduce } = useMotion();
  const scroll = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ seed?: string }>();
  const seed = typeof params.seed === 'string' ? params.seed : '';
  const [message, setMessage] = useState(seed);
  const [lastTool, setLastTool] = useState<string | null>(null);

  const [previousSeed, setPreviousSeed] = useState(seed);
  if (seed !== previousSeed) {
    setPreviousSeed(seed);
    if (seed.trim().length > 0) setMessage(seed);
  }
  const history = useQuery({
    queryKey: ['coach-messages'],
    queryFn: () => apiRequest<History>('/v1/coach/messages'),
  });
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const send = useMutation({
    mutationFn: (body: string) =>
      apiRequest<CoachReply>('/v1/coach/messages', { method: 'POST', body: { message: body }, timeoutMs: 35_000 }),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: ['coach-messages'] });
      const previous = client.getQueryData<History>(['coach-messages']);
      if (previous !== undefined) {
        client.setQueryData<History>(['coach-messages'], {
          ...previous,
          messages: [...previous.messages, { id: `pending-${Date.now()}`, role: 'member', body }],
        });
      }
      return { previous };
    },
    onSuccess: async (reply) => {
      setMessage('');
      setLastTool(reply.tool ?? null);
      await client.invalidateQueries({ queryKey: ['coach-messages'] });
    },
    onError: (_error, _body, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(['coach-messages'], context.previous);
      }
    },
  });
  const goals = me.data?.goals ?? [];
  const messages = history.data?.messages ?? [];
  const providerConfigured = history.data?.providerConfigured === true;
  const quota = history.data?.quota;
  const isAr = locale === 'ar';
  const prompts = [
    { key: 'promptWorkout', icon: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' } },
    { key: 'promptMeal', icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } },
    { key: 'promptProgress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' } },
    { key: 'promptMotivate', icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' } },
  ] as const;
  const sendError =
    send.error instanceof ApiClientError ? messageFor(send.error.code, locale, text(locale, 'error')) : null;
  const quotaExhausted = send.error instanceof ApiClientError && send.error.code === 'DAILY_QUOTA';
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: !reduce });
  }, [messages.length, send.isPending, reduce]);

  const statusLine =
    history.data === undefined
      ? text(locale, 'askCoach')
      : providerConfigured
        ? text(locale, history.data.provider === 'openai_compatible' ? 'coachReady' : 'coachLocal')
        : text(locale, 'coachUnavailable');
  const welcomeTitle = providerConfigured ? text(locale, 'coachHeroReady') : text(locale, 'coachHeroUnavailable');
  const welcomeCaption = goals.length > 0 ? labelList(locale, 'goal', goals) : statusLine;
  const quotaLabel =
    quota === undefined
      ? null
      : isAr
        ? `اليوم ${quota.used}/${quota.limit}`
        : `Today ${quota.used}/${quota.limit}`;

  return (
    <Screen>
      <ScreenBody
        scrollRef={scroll}
        footer={
          <View style={{ gap: 10, paddingHorizontal: spacing[1] }}>
            {quotaLabel !== null ? (
              <Text
                style={{
                  color: quota !== undefined && quota.remaining <= 2 ? theme.warning : theme.textMuted,
                  fontFamily: fontFamily.medium,
                  fontSize: typeScale.micro,
                  textAlign: isAr ? 'right' : 'left',
                  writingDirection: isAr ? 'rtl' : 'ltr',
                }}
              >
                {text(locale, 'yazanQuota')}: {quotaLabel}
              </Text>
            ) : null}
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {prompts.map((prompt) => (
                <Pressable
                  key={prompt.key}
                  accessibilityRole="button"
                  disabled={send.isPending || !providerConfigured || quotaExhausted}
                  onPress={() => send.mutate(text(locale, prompt.key))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: theme.surfaceMuted,
                    opacity: providerConfigured && !quotaExhausted ? 1 : 0.5,
                  }}
                >
                  <SymbolView name={prompt.icon} size={15} tintColor={theme.accent} />
                  <Text style={{ color: theme.text, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{text(locale, prompt.key)}</Text>
                </Pressable>
              ))}
            </RNScrollView>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 8,
                backgroundColor: theme.surfaceRaised,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 24,
                padding: 6,
                paddingStart: 16,
              }}
            >
              <TextInput
                accessibilityLabel={text(locale, 'askCoach')}
                value={message}
                onChangeText={setMessage}
                multiline
                blurOnSubmit={false}
                placeholder={text(locale, 'askCoach')}
                placeholderTextColor={theme.textMuted}
                editable={!send.isPending && providerConfigured && !quotaExhausted}
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 140,
                  paddingVertical: 10,
                  color: theme.text,
                  fontFamily: fontFamily.regular,
                  fontSize: typeScale.body,
                  lineHeight: 26,
                  writingDirection: isAr ? 'rtl' : 'ltr',
                  textAlign: isAr ? 'right' : 'left',
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text(locale, 'send')}
                disabled={send.isPending || !providerConfigured || message.trim().length === 0 || quotaExhausted}
                onPress={() => send.mutate(message.trim())}
                style={{
                  height: 40,
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor:
                    send.isPending || !providerConfigured || message.trim().length === 0 || quotaExhausted
                      ? theme.surfaceMuted
                      : theme.emphasis,
                }}
              >
                <SymbolView
                  name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                  size={17}
                  tintColor={send.isPending || message.trim().length === 0 ? theme.textMuted : theme.emphasisText}
                />
              </Pressable>
            </View>
          </View>
        }
      >
        <AppHeader
          title={text(locale, 'coachTitle')}
          subtitle={welcomeCaption}
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: providerConfigured ? theme.success : theme.textMuted }} />
              <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11, maxWidth: 110 }}>
                {statusLine}
              </Text>
            </View>
          }
        />
        {history.isPending ? <LoadingSkeleton /> : null}
        {history.isError ? (
          <EmptyState
            compact
            title={text(locale, 'error')}
            body={history.error instanceof ApiClientError ? messageFor(history.error.code, locale, text(locale, 'error')) : text(locale, 'error')}
          />
        ) : null}
        {history.data !== undefined && !providerConfigured ? <EmptyState title={text(locale, 'unavailable')} body={text(locale, 'coachUnavailable')} /> : null}
        {providerConfigured && messages.length === 0 && !send.isPending ? (
          <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }}>
            <View style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <SymbolView name={{ ios: 'bolt.heart.fill', android: 'favorite', web: 'favorite' }} size={24} tintColor={theme.heroAccent} />
            </View>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18, textAlign: 'center', writingDirection: isAr ? 'rtl' : 'ltr' }}>
              {welcomeTitle}
            </Text>
            <Text
              style={{
                color: theme.textMuted,
                fontFamily: fontFamily.regular,
                fontSize: 13,
                lineHeight: 20,
                textAlign: 'center',
                marginTop: 6,
                writingDirection: isAr ? 'rtl' : 'ltr',
              }}
              numberOfLines={3}
            >
              {welcomeCaption}
            </Text>
          </View>
        ) : null}
        {messages.map((item, index) => {
          const isLastAssistant = item.role === 'assistant' && index === messages.length - 1;
          return (
            <AIChatBubble
              key={stableRecordKey(item.id)}
              role={item.role === 'member' ? 'user' : 'coach'}
              text={item.body}
              note={
                item.role === 'human_coach' || item.authorKind === 'human_coach'
                  ? text(locale, 'humanCoachLabel')
                  : item.role === 'assistant' && item.body.toLowerCase().includes('not a production coach')
                    ? text(locale, 'coachMock')
                    : isLastAssistant
                      ? toolNote(lastTool, locale)
                      : undefined
              }
            />
          );
        })}
        {send.isPending ? <AIChatBubble role="coach" text={text(locale, 'coachThinking')} pending /> : null}
        {sendError !== null ? (
          <View style={{ gap: 8 }}>
            <EmptyState compact title={quotaExhausted ? text(locale, 'yazanQuota') : text(locale, 'error')} body={sendError} />
            {!quotaExhausted ? (
              <Button
                label={text(locale, 'retry')}
                variant="secondary"
                onPress={() => send.mutate(message.trim().length > 0 ? message.trim() : text(locale, prompts[0].key))}
              />
            ) : (
              <Button label={text(locale, 'membership')} variant="secondary" onPress={() => router.push('/membership')} />
            )}
          </View>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
