import { Text } from '../../src/ui/Text';
import { useFormRecovery } from '../../src/storage/useFormRecovery';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { uniqueById } from '../../src/lists/unique';
import { stableRecordKey } from '../../src/lists/keys';
import { fontFamily, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, ErrorState, ProfileAvatar } from '../../src/ui/kit';

type Post = {
  id: string;
  body: string;
  visibility: string;
  createdAt: string;
  authorUserId: string;
  authorName: string | null;
  supportCount: number;
  supported: boolean;
};
type CommentRow = { id: string; body: string; authorName: string | null };

export default function CommunityScreen() {
  const { locale } = useLocale();
  const { tokens } = useSession();
  const client = useQueryClient();
  const theme = useTheme();
  const [compose, setCompose] = useState(false);
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const recovery = useFormRecovery('community-composer', { body, draft, activeId }, saved => { setBody(saved.body); setDraft(saved.draft); setActiveId(saved.activeId); setCompose(saved.body !== ''); }, body !== '' || draft !== '');
  const [error, setError] = useState('');
  const [older, setOlder] = useState<Post[]>([]);
  const [more, setMore] = useState(true);
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: tokens !== null,
    queryFn: () => apiRequest<{ userId: string }>('/v1/me'),
  });
  const feed = useQuery({
    queryKey: ['community-posts'],
    queryFn: () => apiRequest<{ posts: Post[]; publishing: boolean; mediaStorage: boolean }>('/v1/community/posts'),
  });
  const thread = useQuery({
    queryKey: ['community-comments', activeId],
    enabled: activeId !== null,
    queryFn: () => apiRequest<{ comments: CommentRow[] }>(`/v1/community/posts/${activeId}/comments`),
  });
  const posts = uniqueById([...(feed.data?.posts ?? []), ...older]);

  async function publish(visibility: 'members' | 'private') {
    if (body.trim().length === 0) {
      setError(text(locale, 'postBody'));
      return;
    }
    setError('');
    try {
      await apiRequest('/v1/community/posts', { method: 'POST', body: { body, visibility } });
      await recovery.clear();
      setBody('');
      setCompose(false);
      setOlder([]);
      await client.invalidateQueries({ queryKey: ['community-posts'] });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  async function support(postId: string) {
    await apiRequest(`/v1/community/posts/${postId}/support`, { method: 'POST' });
    await client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function comment(postId: string) {
    if (draft.trim().length === 0) return;
    await apiRequest(`/v1/community/posts/${postId}/comments`, { method: 'POST', body: { body: draft.trim() } });
    setDraft('');
    await client.invalidateQueries({ queryKey: ['community-comments', postId] });
  }

  async function remove(postId: string) {
    await apiRequest(`/v1/community/posts/${postId}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function block(userId: string) {
    await apiRequest(`/v1/community/blocks/${userId}`, { method: 'POST' });
    setOlder([]);
    await client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (last === undefined) return;
    const page = await apiRequest<{ posts: Post[] }>(`/v1/community/posts?before=${encodeURIComponent(last.createdAt)}`);
    setOlder((current) => [...current, ...page.posts]);
    setMore(page.posts.length === 20);
  }

  // Layout direction comes from the root (Screen `direction` + I18nManager), so a plain row
  // already starts on the right in Arabic. Reversing it here flipped Arabic back to LTR.
  const row = 'row' as const;

  return (
    <Screen>
      <ScreenBody
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { setOlder([]); setMore(true); void feed.refetch(); }} tintColor={theme.accent} />}
      >
        <AppHeader title={text(locale, 'community')} subtitle={locale === 'ar' ? 'مساحة الرياضيين، إنجازاتهم وتجاربهم' : 'A space for athletes and their progress'} />
        <Pressable
          accessibilityRole="button"
          onPress={() => { setError(''); setCompose(true); }}
          style={{ flexDirection: row, alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, marginBottom: spacing[2] }}
        >
          <ProfileAvatar name={locale === 'ar' ? 'أنا' : 'Me'} />
          <Text style={{ color: theme.textMuted, flex: 1, fontFamily: fontFamily.regular, writingDirection: 'auto', fontSize: typeScale.body }}>
            {locale === 'ar' ? 'شارِك تمرينك أو إنجازك اليوم...' : 'Share a workout or a milestone...'}
          </Text>
          <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={26} tintColor={theme.accent} />
        </Pressable>
        {feed.isError ? (
          <ErrorState
            body={feed.error instanceof ApiClientError ? messageFor(feed.error.code, locale, text(locale, 'error')) : text(locale, 'error')}
            onRetry={() => void feed.refetch()}
          />
        ) : null}
        {feed.isPending ? <Body>{text(locale, 'loading')}</Body> : null}
        {feed.data !== undefined && posts.length === 0 ? (
          <View style={{ alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] }}>
            <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={30} tintColor={theme.textMuted} />
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>
              {locale === 'ar' ? 'كل إنجاز يبدأ بخطوة' : 'Every milestone starts somewhere'}
            </Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 22, fontSize: typeScale.label, maxWidth: 280 }}>
              {locale === 'ar'
                ? 'المجتمع جديد هنا. شارك أول تحديث رياضي لك، بدون منشورات وهمية أو أرقام مصطنعة.'
                : 'This community is just getting started. Share your first real update.'}
            </Text>
          </View>
        ) : null}
        {posts.map((post) => {
          const isMine = me.data?.userId === post.authorUserId;
          const expanded = activeId === post.id;
          return (
            <View key={stableRecordKey(post.id)} style={{ paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, flexDirection: row, gap: spacing[3] }}>
              <ProfileAvatar name={post.authorName ?? text(locale, 'community')} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>
                    {post.authorName ?? text(locale, 'community')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label }}>
                    · {post.visibility === 'private' ? text(locale, 'privatePost') : text(locale, 'membersPost')}
                  </Text>
                </View>
                <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 23, writingDirection: 'auto' }}>
                  {post.body}
                </Text>
                <View style={{ flexDirection: row, alignItems: 'center', gap: spacing[5], marginTop: 2 }}>
                  <Pressable accessibilityRole="button" onPress={() => void support(post.id)} style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
                    <SymbolView
                      name={{ ios: post.supported ? 'heart.fill' : 'heart', android: 'favorite', web: 'favorite' }}
                      size={16}
                      tintColor={post.supported ? theme.accent : theme.textMuted}
                    />
                    <Text style={{ color: post.supported ? theme.accent : theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                      {post.supportCount}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setActiveId(expanded ? null : post.id)} style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
                    <SymbolView name={{ ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }} size={16} tintColor={theme.textMuted} />
                    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{text(locale, 'comment')}</Text>
                  </Pressable>
                  {isMine ? (
                    <Pressable accessibilityRole="button" onPress={() => void remove(post.id)}>
                      <SymbolView name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }} size={16} tintColor={theme.danger} />
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => void block(post.authorUserId)}>
                      <SymbolView name={{ ios: 'hand.raised', android: 'block', web: 'block' }} size={16} tintColor={theme.textMuted} />
                    </Pressable>
                  )}
                </View>
                {expanded ? (
                  <View style={{ marginTop: spacing[2], gap: spacing[2] }}>
                    {thread.data?.comments.map((item) => (
                      <Text key={stableRecordKey(item.id)} style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 19 }}>
                        <Text style={{ fontFamily: fontFamily.semibold }}>{item.authorName ?? text(locale, 'community')}</Text>
                        {`  ${item.body}`}
                      </Text>
                    ))}
                    <Field label={text(locale, 'comment')} value={draft} onChangeText={setDraft} />
                    <Button label={text(locale, 'send')} variant="secondary" onPress={() => void comment(post.id)} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
        {feed.data !== undefined && feed.data.posts.length === 20 && more ? (
          <Button label={text(locale, 'more')} variant="secondary" onPress={() => void loadMore()} />
        ) : null}
      </ScreenBody>
      <BottomSheet visible={compose} onClose={() => setCompose(false)}>
        <Field label={text(locale, 'postBody')} value={body} onChangeText={setBody} />
        {error.length > 0 ? <Body>{error}</Body> : null}
        <Button label={text(locale, 'membersPost')} onPress={() => void publish('members')} />
        <Button label={text(locale, 'privatePost')} variant="secondary" onPress={() => void publish('private')} />
      </BottomSheet>
    </Screen>
  );
}
