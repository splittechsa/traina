import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView, Text, TextInput, View, type ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { labelList } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { fontFamily, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import { AIChatBubble, AppHeader, EmptyState, LoadingSkeleton } from '../../src/ui/kit';
import { stableRecordKey } from '../../src/lists/keys';

type CoachReply = { text: string; provider: string; productionIntelligence: boolean };
type StoredMessage = { id: string; role: string; body: string };
type History = { messages: StoredMessage[]; productionIntelligence: boolean; providerConfigured: boolean; provider?: string };
type Me = { goals?: string[] };

export default function CoachScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { tokens } = useSession();
  const client = useQueryClient();
  const { reduce } = useMotion();
  const scroll = useRef<ScrollView>(null);
  const [message, setMessage] = useState('');
  const history = useQuery({
    queryKey: ['coach-messages'],
    queryFn: () => apiRequest<History>('/v1/coach/messages'),
  });
  const checkin = useQuery({
    queryKey: ['coach-daily-checkin'],
    queryFn: async () => {
      const result = await apiRequest<{ text: string; created: boolean; persona: string }>('/v1/coach/daily-checkin', {
        method: 'POST',
        body: {},
      });
      await client.invalidateQueries({ queryKey: ['coach-messages'] });
      return result;
    },
  });
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const send = useMutation({
    // The server's own budget for a single reply (services/api/src/coach/provider.ts,
    // COACH_OVERALL_TIMEOUT_MS) is 28s, because a tool-use turn can take two sequential
    // model calls that share that one deadline. This client timeout must stay comfortably
    // above that server budget, or the client aborts a request the server is still honestly
    // working on — which is what produced the "stuck loading" reports: the server would
    // finish and persist the reply after the client had already given up, so it only showed
    // up on the next history refetch.
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
    onSuccess: (reply) => {
      setMessage('');
      client.setQueryData<History>(['coach-messages'], (current) =>
        current === undefined
          ? current
          : {
              ...current,
              messages: [
                ...current.messages,
                { id: `reply-${Date.now()}`, role: 'assistant', body: reply.text },
              ],
            },
      );
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
  const isAr = locale === 'ar';
  const prompts = [
    { key: 'promptWorkout', icon: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' } },
    { key: 'promptMeal', icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } },
    { key: 'promptProgress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' } },
    { key: 'promptMotivate', icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' } },
  ] as const;
  const sendError = send.error instanceof ApiClientError ? messageFor(send.error.code, locale, text(locale, 'error')) : null;
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: !reduce });
  }, [messages.length, send.isPending, reduce]);

  const statusLine = history.data === undefined
    ? text(locale, 'askCoach')
    : providerConfigured
      ? text(locale, history.data.provider === 'openai_compatible' ? 'coachReady' : 'coachLocal')
      : text(locale, 'coachUnavailable');
  const welcomeTitle = providerConfigured ? text(locale, 'coachHeroReady') : text(locale, 'coachHeroUnavailable');
  const welcomeCaption = goals.length > 0 ? labelList(locale, 'goal', goals) : statusLine;

  return (
    <Screen>
      <ScreenBody
        scrollRef={scroll}
        footer={
          <View style={{ gap: 10 }}>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {prompts.map((prompt) => (
                <Pressable
                  key={prompt.key}
                  accessibilityRole="button"
                  disabled={send.isPending || !providerConfigured}
                  onPress={() => send.mutate(text(locale, prompt.key))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: theme.surfaceMuted,
                    opacity: providerConfigured ? 1 : 0.5,
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
                placeholder={text(locale, 'askCoach')}
                placeholderTextColor={theme.textMuted}
                style={{
                  flex: 1,
                  minHeight: 40,
                  maxHeight: 120,
                  paddingVertical: 8,
                  color: theme.text,
                  fontFamily: fontFamily.regular,
                  fontSize: typeScale.body,
                  // Natural alignment: start edge follows the RTL/LTR root, so no manual flip.
                  writingDirection: isAr ? 'rtl' : 'ltr',
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text(locale, 'send')}
                disabled={send.isPending || !providerConfigured || message.trim().length === 0}
                onPress={() => send.mutate(message.trim())}
                style={{
                  height: 40,
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor: send.isPending || !providerConfigured || message.trim().length === 0 ? theme.surfaceMuted : theme.emphasis,
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
          trailing={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: providerConfigured ? theme.success : theme.textMuted }} />
            <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11, maxWidth: 110 }}>{statusLine}</Text>
          </View>}
        />
        {history.isPending ? <LoadingSkeleton /> : null}
        {history.isError ? (
          <EmptyState
            compact
            title={text(locale, 'error')}
            body={history.error instanceof ApiClientError ? messageFor(history.error.code, locale, text(locale, 'error')) : text(locale, 'error')}
          />
        ) : null}
        {history.data !== undefined && !providerConfigured ? (
          <EmptyState
            compact
            title={text(locale, 'yazanDaily')}
            body={isAr ? 'يزن يرسل رسالة يومية من مدخلاتك حتى بدون مزوّد نموذج. الرد الحر يحتاج إعداد المزوّد.' : 'Yazan still posts a daily check-in from your logs without a model provider. Free chat needs the provider configured.'}
          />
        ) : null}
        {checkin.isPending ? <AIChatBubble role="coach" text={text(locale, 'coachThinking')} pending /> : null}
        {messages.length === 0 && !send.isPending && !checkin.isPending ? (
          <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }}>
            <View style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <SymbolView name={{ ios: 'bolt.heart.fill', android: 'favorite', web: 'favorite' }} size={24} tintColor={theme.heroAccent} />
            </View>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18, textAlign: 'center' }}>{welcomeTitle}</Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }} numberOfLines={3}>
              {welcomeCaption}
            </Text>
          </View>
        ) : null}
        {messages.map((item) => (
          <AIChatBubble
            key={stableRecordKey(item.id)}
            role={item.role === 'member' ? 'user' : 'coach'}
            text={item.body}
            note={item.role === 'assistant' && item.body.toLowerCase().includes('not a production coach') ? text(locale, 'coachMock') : undefined}
          />
        ))}
        {send.isPending ? <AIChatBubble role="coach" text={text(locale, 'coachThinking')} pending /> : null}
        {sendError !== null ? (
          <View>
            <EmptyState compact title={text(locale, 'error')} body={sendError} />
            <Button label={text(locale, 'retry')} variant="secondary" onPress={() => send.mutate(message.trim().length > 0 ? message.trim() : text(locale, prompts[0].key))} />
          </View>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
