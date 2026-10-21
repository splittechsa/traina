import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiClientError, apiRequest } from '../api/client';
import { accountResource, accountScope } from '../offline/resource';
import type { TrainingFamily } from './filterCards';
const sessionSchema = z.object({ id:z.string().max(64),name:z.string().max(200),status:z.string().max(32),discipline:z.string().max(40),scheduled_for:z.string().max(40),duration_seconds:z.number() });
const count = z.number().int().nonnegative();
export const HISTORY_PAGE_SIZE = 20;
const schema = z.object({ sessions:z.array(sessionSchema).max(HISTORY_PAGE_SIZE),resume:sessionSchema.nullable(),featured:sessionSchema.nullable(),counts:z.object({all:count,strength:count,crossfit:count,calisthenics:count}),summary:z.object({today:count,completed:count,active:count}),scheduledDays:z.array(z.string()).max(7),pageInfo:z.object({hasMore:z.boolean(),nextCursor:z.string().max(1024).nullable(),previousCursor:z.string().max(1024).nullable()}) });
export type SessionRow = z.infer<typeof sessionSchema>;
export type HistoryPage = z.infer<typeof schema>;
export function decodeHistoryPage(value: unknown): HistoryPage {
  const parsed=schema.safeParse(value);
  if(!parsed.success)throw new ApiClientError(503,'HISTORY_UNAVAILABLE','Workout history is temporarily unavailable');
  return parsed.data;
}
export function historyPath(family: TrainingFamily, cursor: string | null) {
  return '/v1/training/sessions?limit=' + HISTORY_PAGE_SIZE + '&family=' + family + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
}
export function historyPlaceholder(owner: string | null, family: TrainingFamily) {
  return (previous: HistoryPage | undefined, query?: { queryKey: readonly unknown[] }) => query?.queryKey[2] === owner && query?.queryKey[3] === family ? previous : undefined;
}
export function historyOptions(owner: string | null, family: TrainingFamily = 'all', cursor: string | null = null) {
  return queryOptions({
    queryKey: ['sessions', 'history', owner, family, cursor] as const,
    enabled: owner !== null,
    queryFn: async () => cursor ? decodeHistoryPage(await apiRequest<unknown>(historyPath(family,cursor))) : accountResource<HistoryPage>(historyPath(family,null),decodeHistoryPage),
    // One observed page per screen; no growing page arrays or retained inactive cursor queries.
    gcTime: 0,
    staleTime: 30_000,
    placeholderData: historyPlaceholder(owner,family),
  });
}
export function useWorkoutHistory(family: TrainingFamily = 'all', cursor: string | null = null) {
  return useQuery(historyOptions(accountScope(),family,cursor));
}
