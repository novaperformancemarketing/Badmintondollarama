'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { addLatePlayer, addRound, deleteSession, removeFromSession } from '@/app/actions';
import { Icon } from '@/components/ui';

interface Props {
  sessionId: number;
  active: { id: number; name: string; sharesWith: number | null }[];
  bench: { id: number; name: string }[];
}

export default function SessionMenu({ sessionId, active, bench }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [pending, start] = useTransition();
  const [state, addAction, adding] = useActionState(addLatePlayer, undefined);
  const close = () => ref.current?.removeAttribute('open');
  // Spots that can take a second person: owners nobody shares with yet.
  const openSpots = active.filter((p) => p.sharesWith === null && !active.some((q) => q.sharesWith === p.id));

  useEffect(() => {
    if (state && !state.error) close();
  }, [state]);

  return (
    <details className="menu" ref={ref}>
      <summary className="icon-btn right" aria-label="Session menu">
        <Icon.More />
      </summary>
      <div className="scrim" onClick={close} />
      <div className="sheet" role="dialog" aria-label="Session options">
        <div className="section-head">
          <h2 className="h2">Session options</h2>
          <button type="button" className="btn-ghost" style={{ width: 'auto', minHeight: 44 }} onClick={close}>
            Done
          </button>
        </div>

        <form action={addAction} className="stack">
          <input type="hidden" name="sessionId" value={sessionId} />
          <strong>Add a late arrival</strong>
          <span className="small muted">Give them their own spot, or have them share someone&apos;s spot and alternate games.</span>
          {bench.length > 0 && (
            <select name="playerId" className="input" defaultValue="" aria-label="Pick a player">
              <option value="">Pick from the roster…</option>
              {bench.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input name="name" className="input" placeholder={bench.length ? '…or type a new name' : 'New player name'} maxLength={40} aria-label="New player name" />
          <select name="shareWith" className="input" defaultValue="" aria-label="Spot">
            <option value="">Their own spot (reshuffles upcoming rounds)</option>
            {openSpots.map((p) => (
              <option key={p.id} value={p.id}>
                Share {p.name}&apos;s spot (alternate games)
              </option>
            ))}
          </select>
          {state?.error && <div className="error">{state.error}</div>}
          <button type="submit" className="btn-outline" disabled={adding}>
            {adding ? 'Adding…' : 'Add player'}
          </button>
        </form>

        <div className="stack">
          <strong>Someone leaving?</strong>
          <span className="small muted">
            Played games stay. Upcoming rounds are rebuilt without them, or their spot partner takes over.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                disabled={pending || active.length <= 4}
                onClick={() => {
                  if (!confirm(`Remove ${p.name} from the rest of tonight?`)) return;
                  start(async () => {
                    await removeFromSession(sessionId, p.id);
                    close();
                  });
                }}
              >
                <span className="initial">{p.name.charAt(0).toUpperCase()}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn-outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await addRound(sessionId);
              close();
            })
          }
        >
          Add another round
        </button>

        <button
          type="button"
          className="btn-danger"
          disabled={pending}
          onClick={() => {
            if (!confirm('Delete this session and all its results? This cannot be undone.')) return;
            start(() => deleteSession(sessionId));
          }}
        >
          Delete session
        </button>
      </div>
    </details>
  );
}
