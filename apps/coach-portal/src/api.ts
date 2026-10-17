const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export type Session = {
  accessToken: string;
  email: string;
};

async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    const message = json.error?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export async function login(email: string, password: string): Promise<Session> {
  const result = await request<{ accessToken: string }>('/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return { accessToken: result.accessToken, email };
}

export function listAssignments(token: string) {
  return request<{
    assignments: { coachUserId: string; memberUserId: string; active: boolean; assignedAt: string }[];
  }>('/v1/coach/assignments', { token });
}

export function listInbox(token: string) {
  return request<{
    reviews: {
      id: string;
      memberUserId: string;
      coachUserId: string | null;
      weekOf: string;
      status: string;
      updatedAt: string;
    }[];
  }>('/v1/coach/workspace/inbox', { token });
}

export function workload(token: string) {
  return request<{ assignedMembers: number; openReviews: number; completedLast14Days: number }>(
    '/v1/coach/workspace/metrics',
    { token },
  );
}

export function readPacket(token: string, reviewId: string) {
  return request<{
    review: { id: string; status: string; memberUserId: string; weekOf: string };
    packet: {
      goals: string[];
      approvedPlan: { programId: string | null; nutritionPhase: string | null };
      adherence: Record<string, number | boolean>;
      weightTrendGramsPerWeek: number | null;
      dataCompletenessBps: number;
      confidence: string;
      surveySleep: number | null;
      memberQuestions: string[];
      safetyFlags: string[];
      uncertaintyNotes: string[];
      yazanProposals: {
        id: string;
        category: string;
        status: string;
        summary: string;
        rationale: string;
        humanApproved: boolean;
      }[];
    };
  }>(`/v1/coach/reviews/${reviewId}/packet`, { token });
}

export function claimReview(token: string, reviewId: string) {
  return request<{ review: { status: string } }>(`/v1/coach/reviews/${reviewId}/claim`, {
    method: 'POST',
    token,
  });
}

export function sendFeedback(token: string, reviewId: string, body: string) {
  return request<{ feedback: { authorKind: string } }>(`/v1/coach/reviews/${reviewId}/feedback`, {
    method: 'POST',
    token,
    body: { body },
  });
}

export function decideRecommendation(
  token: string,
  memberUserId: string,
  recommendationId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
) {
  return request<{
    humanApproved: boolean;
    authorKind: string;
    energyPolicyBlocksApply: boolean;
    recommendation: { status: string; category: string };
  }>(`/v1/coach/members/${memberUserId}/recommendations/${recommendationId}/decide`, {
    method: 'POST',
    token,
    body: { decision, reason },
  });
}

export function listNotes(token: string, memberUserId: string) {
  return request<{ notes: { id: string; body: string; createdAt: string }[] }>(
    `/v1/coach/members/${memberUserId}/notes`,
    { token },
  );
}

export function addNote(token: string, memberUserId: string, body: string) {
  return request<{ persisted: boolean }>(`/v1/coach/members/${memberUserId}/notes`, {
    method: 'POST',
    token,
    body: { body },
  });
}

export function memberState(token: string, memberUserId: string) {
  return request<{ state: { asOfDay: string; confidence: string; weekly: Record<string, unknown> } }>(
    `/v1/coach/members/${memberUserId}/state`,
    { token },
  );
}
