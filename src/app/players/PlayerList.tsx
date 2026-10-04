'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addPlayer, setPlayerArchived } from '@/app/actions';
import { Money } from '@/components/ui';

interface Row {
  id: number;
  name: string;
  archived: boolean;
  netCents: number;
  wins: number;
  losses: number;
}

export default function PlayerList({ players }: { players: Row[] }) {
  const [state, action, pending] = useActionState(addPlayer, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  const current = players.filter((p) => !p.archived);
  const archived = players.filter((p) => p.archived);

  return (
    <>
      <section className="section">
        <h2 className="h2">Add a player</h2>
        <form ref={formRef} action={action} style={{ display: 'flex', gap: 8 }}>
          <input name="name" className="input" placeholder="Name" maxLength={40} required aria-label="Player name" />
          <button type="submit" className="btn-outline" disabled={pending} style={{ flex: 'none' }}>
            {pending ? 'Adding…' : 'Add'}
          </button>
        </form>
        {state?.error && <div className="error">{state.error}</div>}
      </section>

      <section className="section" style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div className="section-head">
          <h2 className="h2">The crew</h2>
          <span className="tiny muted">{current.length} players</span>
        </div>
        {current.length === 0 ? (
          <div className="card pad small muted">Nobody yet. Add at least four players to start a session.</div>
        ) : (
          <div className="card">
            <div className="table-head" style={{ gridTemplateColumns: '1fr 70px 64px' }}>
              <span>Player</span>
              <span className="right">W–L</span>
              <span className="right">$</span>
            </div>
            {current.map((p, i) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="table-row"
                style={{ gridTemplateColumns: '1fr 70px 64px', minHeight: 50, borderRadius: i === current.length - 1 ? '0 0 20px 20px' : 0 }}
              >
                <strong>{p.name}</strong>
                <span className="num right">
                  {p.wins}–{p.losses}
                </span>
                <Money cents={p.netCents} className="right" />
              </Link>
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <>
            <button type="button" className="btn-ghost" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Hide' : 'Show'} retired players ({archived.length})
            </button>
            {showArchived && (
              <div className="card clip">
                {archived.map((p) => (
                  <div key={p.id} className="table-row" style={{ gridTemplateColumns: '1fr auto', minHeight: 54 }}>
                    <Link href={`/players/${p.id}`} style={{ color: 'var(--muted)', fontWeight: 600 }}>
                      {p.name}
                    </Link>
                    <button type="button" className="btn-outline" onClick={() => start(() => setPlayerArchived(p.id, false))}>
                      Bring back
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
