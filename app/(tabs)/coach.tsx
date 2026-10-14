import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { labelList } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import { AIChatBubble, AppHeader, EmptyState } from '../../src/ui/kit';
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
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const send = useMutation({
    mutationFn: (body: string) => apiRequest<CoachReply>('/v1/coach/messages', { method: 'POST', body: { message: body } }),
    onSuccess: async () => {
      setMessage('');
      await client.invalidateQueries({ queryKey: ['coach-messages'] });
    },
  });
  const goals = me.data?.goals ?? [];
  const messages = history.data?.messages ?? [];
  const providerConfigured = history.data?.providerConfigured === true;
  const prompts = [text(locale, 'promptWorkout'), text(locale, 'promptMeal')] as const;
  const sendError = send.error instanceof ApiClientError ? messageFor(send.error.code, locale, text(locale, 'error')) : null;
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: !reduce });
  }, [messages.length, send.isPending, reduce]);

  const subtitle = history.data === undefined
    ? text(locale, 'askCoach')
    : providerConfigured
      ? goals.length > 0
        ? labelList(locale, 'goal', goals)
        : text(locale, history.data.provider === 'openai_compatible' ? 'coachReady' : 'coachLocal')
      : text(locale, 'coachUnavailable');

  return (
    <Screen>
      <AppHeader title={text(locale, 'coachTitle')} subtitle={subtitle} />
      <ScreenBody
        scrollRef={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduce })}
        footer={
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 40 }} contentContainerStyle={{ gap: spacing[2] }}>
              {prompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  disabled={send.isPending || !providerConfigured}
                  onPress={() => send.mutate(prompt)}
                  style={{ flexShrink: 0, borderWidth: 1, borderColor: theme.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface, opacity: providerConfigured ? 1 : 0.5 }}
                >
                  <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{prompt}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
              <TextInput
                accessibilityLabel={text(locale, 'askCoach')}
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder={text(locale, 'askCoach')}
                placeholderTextColor={theme.textMuted}
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  color: theme.text,
                  backgroundColor: theme.surface,
                  fontFamily: fontFamily.regular,
                  fontSize: typeScale.body,
                  textAlign: 'auto',
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text(locale, 'send')}
                disabled={send.isPending || !providerConfigured || message.trim().length === 0}
                onPress={() => send.mutate(message.trim())}
                style={{
                  minHeight: 44,
                  minWidth: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  backgroundColor: send.isPending || !providerConfigured || message.trim().length === 0 ? theme.surfaceMuted : theme.violet,
                  paddingHorizontal: spacing[3],
                }}
              >
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'send')}</Text>
              </Pressable>
            </View>
          </View>
        }
      >
        {history.isPending ? <EmptyState compact title={text(locale, 'coachTitle')} body={text(locale, 'loading')} /> : null}
        {history.isError ? (
          <EmptyState
            compact
            title={text(locale, 'error')}
            body={history.error instanceof ApiClientError ? messageFor(history.error.code, locale, text(locale, 'error')) : text(locale, 'error')}
          />
        ) : null}
        {history.data !== undefined && !providerConfigured ? <EmptyState title={text(locale, 'unavailable')} body={text(locale, 'coachUnavailable')} /> : null}
        {providerConfigured && messages.length === 0 && !send.isPending ? (
          <EmptyState title={text(locale, 'coachTitle')} body={history.data?.provider === 'openai_compatible' ? text(locale, 'coachReady') : text(locale, 'coachLocal')} />
        ) : null}
        {messages.map((item) => (
          <AIChatBubble
            key={stableRecordKey(item.id)}
            role={item.role === 'member' ? 'user' : 'coach'}
            text={item.body}
            note={item.role === 'assistant' && item.body.toLowerCase().includes('not a production coach') ? text(locale, 'coachMock') : undefined}
          />
        ))}
        {send.isPending ? <AIChatBubble role="coach" text={text(locale, 'loading')} /> : null}
        {sendError !== null ? (
          <View>
            <EmptyState compact title={text(locale, 'error')} body={sendError} />
            <Button label={text(locale, 'retry')} variant="secondary" onPress={() => send.mutate(message.trim().length > 0 ? message.trim() : prompts[0])} />
          </View>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
