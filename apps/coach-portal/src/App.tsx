import { useEffect, useState, type FormEvent } from 'react';
import {
  Session,
  addNote,
  claimReview,
  decideRecommendation,
  listAssignments,
  listInbox,
  listNotes,
  login,
  memberState,
  readPacket,
  sendFeedback,
  workload,
} from './api';

type Review = {
  id: string;
  memberUserId: string;
  coachUserId: string | null;
  weekOf: string;
  status: string;
  updatedAt: string;
};

type Packet = Awaited<ReturnType<typeof readPacket>>['packet'];

export function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem('traina.coach.session');
    return raw ? (JSON.parse(raw) as Session) : null;
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState({ assignedMembers: 0, openReviews: 0, completedLast14Days: 0 });
  const [assignments, setAssignments] = useState<
    { coachUserId: string; memberUserId: string; active: boolean; assignedAt: string }[]
  >([]);
  const [inbox, setInbox] = useState<Review[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [reviewMeta, setReviewMeta] = useState<{ id: string; status: string; memberUserId: string; weekOf: string } | null>(
    null,
  );
  const [timeline, setTimeline] = useState<string>('');
  const [notes, setNotes] = useState<{ id: string; body: string; createdAt: string }[]>([]);
  const [feedback, setFeedback] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  function persist(next: Session | null) {
    setSession(next);
    if (next === null) localStorage.removeItem('traina.coach.session');
    else localStorage.setItem('traina.coach.session', JSON.stringify(next));
  }

  async function refreshWorkspace(token: string) {
    const [metricsResult, assignmentResult, inboxResult] = await Promise.all([
      workload(token),
      listAssignments(token),
      listInbox(token),
    ]);
    setMetrics(metricsResult);
    setAssignments(assignmentResult.assignments);
    setInbox(inboxResult.reviews);
  }

  useEffect(() => {
    if (session === null) return;
    void refreshWorkspace(session.accessToken).catch((err: Error) => setError(err.message));
  }, [session?.accessToken]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await login(email.trim(), password);
      persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function openReview(review: Review) {
    if (session === null) return;
    setSelectedId(review.id);
    setError(null);
    setBusy(true);
    try {
      const [packetResult, stateResult, notesResult] = await Promise.all([
        readPacket(session.accessToken, review.id),
        memberState(session.accessToken, review.memberUserId),
        listNotes(session.accessToken, review.memberUserId),
      ]);
      setPacket(packetResult.packet);
      setReviewMeta(packetResult.review);
      setNotes(notesResult.notes);
      setTimeline(
        `asOf ${stateResult.state.asOfDay} · confidence ${stateResult.state.confidence} · weekly meals ${String(stateResult.state.weekly.mealDaysLogged ?? '—')}`,
      );
    } catch (err) {
      setPacket(null);
      setError(err instanceof Error ? err.message : 'Unable to load review');
    } finally {
      setBusy(false);
    }
  }

  async function onClaim() {
    if (session === null || selectedId === null) return;
    setBusy(true);
    setError(null);
    try {
      await claimReview(session.accessToken, selectedId);
      await refreshWorkspace(session.accessToken);
      const current = inbox.find((row) => row.id === selectedId);
      if (current) await openReview(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSendFeedback() {
    if (session === null || selectedId === null || feedback.trim().length < 1) return;
    setBusy(true);
    setError(null);
    try {
      await sendFeedback(session.accessToken, selectedId, feedback.trim());
      setFeedback('');
      await refreshWorkspace(session.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(proposalId: string, decision: 'APPROVED' | 'REJECTED') {
    if (session === null || reviewMeta === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await decideRecommendation(
        session.accessToken,
        reviewMeta.memberUserId,
        proposalId,
        decision,
        decision === 'APPROVED' ? 'coach_workspace_approve' : 'coach_workspace_reject',
      );
      if (result.energyPolicyBlocksApply) {
        setError('Nutrition marked for human review; ENERGY_POLICY still blocks application.');
      }
      await openReview({
        id: reviewMeta.id,
        memberUserId: reviewMeta.memberUserId,
        coachUserId: null,
        weekOf: reviewMeta.weekOf,
        status: reviewMeta.status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAddNote() {
    if (session === null || reviewMeta === null || noteDraft.trim().length < 1) return;
    setBusy(true);
    try {
      await addNote(session.accessToken, reviewMeta.memberUserId, noteDraft.trim());
      setNoteDraft('');
      const notesResult = await listNotes(session.accessToken, reviewMeta.memberUserId);
      setNotes(notesResult.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Note failed');
    } finally {
      setBusy(false);
    }
  }

  if (session === null) {
    return (
      <div className="app-shell">
        <h1 className="brand">Traina</h1>
        <p className="lede">Coach Workspace — assigned members, weekly review inbox, and human approvals only.</p>
        <form className="login-card" onSubmit={onLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            Sign in
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1 className="brand">Traina</h1>
          <p className="lede">Signed in as {session.email}. AI proposals never count as human approval.</p>
        </div>
        <button className="ghost" type="button" onClick={() => persist(null)}>
          Sign out
        </button>
      </div>

      <div className="metrics">
        <div className="metric">
          <strong>{metrics.assignedMembers}</strong>
          <span>Assigned members</span>
        </div>
        <div className="metric">
          <strong>{metrics.openReviews}</strong>
          <span>Open reviews</span>
        </div>
        <div className="metric">
          <strong>{metrics.completedLast14Days}</strong>
          <span>Completed (14d)</span>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="layout">
        <section className="panel stack">
          <div>
            <h2>Assigned members</h2>
            <div className="list">
              {assignments.length === 0 ? <p className="meta">No active assignments.</p> : null}
              {assignments.map((row) => (
                <div key={`${row.coachUserId}-${row.memberUserId}`} className="chip">
                  {row.memberUserId.slice(0, 8)}… · since {row.assignedAt.slice(0, 10)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2>Weekly review inbox</h2>
            <div className="list">
              {inbox.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className={selectedId === review.id ? 'active' : undefined}
                  onClick={() => void openReview(review)}
                >
                  <div>
                    {review.weekOf} · {review.status}
                  </div>
                  <div className="meta">{review.memberUserId}</div>
                </button>
              ))}
              {inbox.length === 0 ? <p className="meta">Inbox clear.</p> : null}
            </div>
          </div>
        </section>

        <section className="panel stack">
          <h2>Review desk</h2>
          {!packet || !reviewMeta ? (
            <p className="meta">Select a review to load the authorized weekly packet.</p>
          ) : (
            <>
              <div className="banner">
                Human review for week {reviewMeta.weekOf}. Status {reviewMeta.status}. {timeline}
              </div>
              <div className="actions">
                <button className="primary" type="button" disabled={busy} onClick={() => void onClaim()}>
                  Claim / start review
                </button>
              </div>

              <div>
                <h3>Goals & plan</h3>
                <div className="chip-row">
                  {packet.goals.map((goal) => (
                    <span className="chip" key={goal}>
                      {goal}
                    </span>
                  ))}
                </div>
                <p className="meta">
                  Program {packet.approvedPlan.programId ?? 'none'} · nutrition phase{' '}
                  {packet.approvedPlan.nutritionPhase ?? 'unset'}
                </p>
              </div>

              <div>
                <h3>Progression</h3>
                <p className="meta">
                  Meals {String(packet.adherence.mealDaysLogged)} · water {String(packet.adherence.waterDaysLogged)} ·
                  sessions {String(packet.adherence.sessionsCompleted)} · completeness{' '}
                  {(packet.dataCompletenessBps / 100).toFixed(0)}% · confidence {packet.confidence}
                </p>
                <p className="meta">
                  Weight trend:{' '}
                  {packet.weightTrendGramsPerWeek === null
                    ? 'unavailable (not invented)'
                    : `${packet.weightTrendGramsPerWeek} g/week`}
                </p>
                <p className="meta">
                  Survey sleep: {packet.surveySleep === null ? 'unavailable' : packet.surveySleep}/5 · daily sleep logging:
                  unavailable
                </p>
              </div>

              <div>
                <h3>Member questions</h3>
                {packet.memberQuestions.length === 0 ? <p className="meta">None submitted.</p> : null}
                <ul>
                  {packet.memberQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3>Uncertainty & safety</h3>
                <div className="chip-row">
                  {packet.uncertaintyNotes.map((note) => (
                    <span className="chip" key={note}>
                      {note}
                    </span>
                  ))}
                  {packet.safetyFlags.map((flag) => (
                    <span className="chip" key={flag}>
                      {flag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="stack">
                <h3>Yazan proposals (require human decision)</h3>
                {packet.yazanProposals.map((proposal) => (
                  <div className="proposal" key={proposal.id}>
                    <h3>
                      {proposal.category} · {proposal.status}
                    </h3>
                    <p>{proposal.summary}</p>
                    <p className="meta">{proposal.rationale}</p>
                    <div className="actions">
                      <button
                        className="primary"
                        type="button"
                        disabled={busy || proposal.humanApproved}
                        onClick={() => void onDecide(proposal.id, 'APPROVED')}
                      >
                        Approve
                      </button>
                      <button className="danger" type="button" disabled={busy} onClick={() => void onDecide(proposal.id, 'REJECTED')}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="stack">
                <h3>Personalized feedback</h3>
                <textarea rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
                <button className="primary" type="button" disabled={busy} onClick={() => void onSendFeedback()}>
                  Send human feedback
                </button>
              </div>

              <div className="stack">
                <h3>Internal coach notes</h3>
                {notes.map((note) => (
                  <p key={note.id} className="meta">
                    {note.createdAt.slice(0, 16)} — {note.body}
                  </p>
                ))}
                <textarea rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
                <button className="ghost" type="button" disabled={busy} onClick={() => void onAddNote()}>
                  Save note
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
