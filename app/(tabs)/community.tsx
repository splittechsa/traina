import { useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { uniqueById } from '../../src/lists/unique';
import { stableRecordKey } from '../../src/lists/keys';
import { fontFamily, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, EmptyState, ErrorState, ProfileAvatar } from '../../src/ui/kit';

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

  return (
    <Screen>
      <ScreenBody
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { setOlder([]); setMore(true); void feed.refetch(); }} tintColor={theme.accent} />}
        footer={<Button label={text(locale, 'publishPost')} onPress={() => { setError(''); setCompose(true); }} />}
      >
        <AppHeader title={text(locale, 'community')} />
        {feed.isError ? (
          <ErrorState
            body={feed.error instanceof ApiClientError ? messageFor(feed.error.code, locale, text(locale, 'error')) : text(locale, 'error')}
            onRetry={() => void feed.refetch()}
          />
        ) : null}
        {feed.isPending ? <Body>{text(locale, 'loading')}</Body> : null}
        {feed.data !== undefined && posts.length === 0 ? <EmptyState title={text(locale, 'community')} body={text(locale, 'communityMissing')} /> : null}
        {posts.map((post) => (
          <View key={stableRecordKey(post.id)} style={{ borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ProfileAvatar name={post.authorName ?? text(locale, 'community')} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{post.authorName ?? text(locale, 'community')}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label }}>{post.visibility === 'private' ? text(locale, 'privatePost') : text(locale, 'membersPost')}</Text>
              </View>
            </View>
            <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{post.body}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable accessibilityRole="button" onPress={() => void support(post.id)}>
                <Text style={{ color: post.supported ? theme.accent : theme.text, fontFamily: fontFamily.semibold }}>{`${text(locale, 'support')} ${post.supportCount}`}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setActiveId(activeId === post.id ? null : post.id)}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.medium }}>{text(locale, 'comment')}</Text>
              </Pressable>
              {me.data?.userId === post.authorUserId ? (
                <Pressable accessibilityRole="button" onPress={() => void remove(post.id)}>
                  <Text style={{ color: theme.danger, fontFamily: fontFamily.medium }}>{text(locale, 'deleteEntry')}</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => void block(post.authorUserId)}>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>{text(locale, 'blockMember')}</Text>
                </Pressable>
              )}
            </View>
            {activeId === post.id ? (
              <View>
                {thread.data?.comments.map((item) => (
                  <Text key={stableRecordKey(item.id)} style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 20, marginBottom: 6 }}>
                    {`${item.authorName ?? text(locale, 'community')}: ${item.body}`}
                  </Text>
                ))}
                <Field label={text(locale, 'comment')} value={draft} onChangeText={setDraft} />
                <Button label={text(locale, 'send')} variant="secondary" onPress={() => void comment(post.id)} />
              </View>
            ) : null}
          </View>
        ))}
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
