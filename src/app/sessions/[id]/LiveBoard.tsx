'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import { endSession, setWinner } from '@/app/actions';
import { BackLink, Badge, Icon, Money, formatDate } from '@/components/ui';
import { progress, tally, type LiveGame } from '@/lib/live';
import { signedMoney } from '@/lib/money';
import SessionMenu from './SessionMenu';

interface Props {
  session: { id: number; playedOn: string; courts: number; stakeCents: number };
  roster: { id: number; name: string; active: boolean }[];
  games: LiveGame[];
  byes: { round: number; playerId: number }[];
  bench: { id: number; name: string }[];
}

const REFRESH_MS = 5000;

export default function LiveBoard({ session, roster, games, byes, bench }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ending, startEnding] = useTransition();
  const [traced, setTraced] = useState<number | null>(null);
  const [optimisticGames, applyResult] = useOptimistic(games, (state, update: { id: number; winner: 'A' | 'B' | null }) =>
    state.map((g) => (g.id === update.id ? { ...g, winner: update.winner } : g)),
  );

  // Other phones at the court may be entering results too.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  const names = useMemo(() => new Map(roster.map((p) => [p.id, p.name])), [roster]);
  const name = (id: number) => names.get(id) ?? '?';
  const active = roster.filter((p) => p.active);
  const stake = session.stakeCents;

  const prog = progress(optimisticGames);
  const rows = tally(optimisticGames, active.map((p) => p.id), stake).sort(
    (a, b) => b.netCents - a.netCents || name(a.playerId).localeCompare(name(b.playerId)),
  );

  const rounds = useMemo(() => {
    const map = new Map<number, { games: LiveGame[]; byes: number[] }>();
    for (const g of optimisticGames) {
      if (!map.has(g.round)) map.set(g.round, { games: [], byes: [] });
      map.get(g.round)!.games.push(g);
    }
    for (const b of byes) map.get(b.round)?.byes.push(b.playerId);
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [optimisticGames, byes]);

  const now = prog.currentRound === null ? null : rounds.find(([r]) => r === prog.currentRound);
  const maxCourts = Math.max(1, ...rounds.map(([, r]) => r.games.length));

  const pick = (g: LiveGame, side: 'A' | 'B') => {
    const winner = g.winner === side ? null : side;
    startTransition(async () => {
      applyResult({ id: g.id, winner });
      await setWinner(g.id, winner);
    });
  };

  const teamClass = (g: LiveGame, side: 'A' | 'B') => {
    const ids = side === 'A' ? [g.a1, g.a2] : [g.b1, g.b2];
    const state = !g.winner ? '' : g.winner === side ? 'win' : 'lose';
    return `team ${state} ${traced && ids.includes(traced) ? 'traced' : ''}`;
  };
  const chip = (g: LiveGame, side: 'A' | 'B') =>
    !g.winner ? 'Tap if won' : g.winner === side ? `WON · ${signedMoney(stake)} each` : `${signedMoney(-stake)} each`;

  return (
    <main className="screen">
      <header className="band">
        <div className="band-row">
          <BackLink href="/" label="Back to home" />
          <span className="pill">
            <span className="dot" />
            Live · {formatDate(session.playedOn)}
          </span>
          <SessionMenu sessionId={session.id} active={active} bench={bench} />
        </div>
        <div className="band-row">
          <h1 className="title">
            {prog.currentRound === null ? 'All rounds played' : `Round ${prog.roundIndex} of ${prog.totalRounds}`}
          </h1>
          <Badge />
        </div>
        <div className="small" style={{ color: 'var(--on-green-muted)', fontWeight: 600 }}>
          {active.length} players · {session.courts} {session.courts === 1 ? 'court' : 'courts'}
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.played}>
          <div style={{ width: `${prog.total ? (100 * prog.played) / prog.total : 0}%` }} />
        </div>
        <div className="small" style={{ color: 'var(--on-green-muted)' }}>
          {prog.played} of {prog.total} games played · {signedMoney(stake).replace('+', '')} a game
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Tonight&apos;s tally</h2>
          <span className="tiny muted">Tap a player to trace</span>
        </div>
        <div className="card">
          <div className="table-head" style={{ gridTemplateColumns: '26px 1fr 34px 34px 64px' }}>
            <span>#</span>
            <span>Player</span>
            <span className="right">W</span>
            <span className="right">L</span>
            <span className="right">$</span>
          </div>
          {rows.map((r, i) => (
            <button
              key={r.playerId}
              type="button"
              className="table-row"
              aria-pressed={traced === r.playerId}
              onClick={() => setTraced(traced === r.playerId ? null : r.playerId)}
              style={{
                gridTemplateColumns: '26px 1fr 34px 34px 64px',
                fontSize: 16,
                cursor: 'pointer',
                background: traced === r.playerId ? 'rgba(245,231,21,0.28)' : 'transparent',
                borderRadius: i === rows.length - 1 ? '0 0 20px 20px' : 0,
              }}
            >
              <span className="num small muted">{i + 1}</span>
              <span style={{ fontWeight: 600 }}>{name(r.playerId)}</span>
              <span className="num right">{r.wins}</span>
              <span className="num right">{r.losses}</span>
              <Money cents={r.netCents} className="right" style={{ fontSize: 17 }} />
            </button>
          ))}
        </div>
      </section>

      {now && (
        <section className="section">
          <h2 className="h2">Now playing · Round {prog.roundIndex}</h2>
          {now[1].games.map((g) => (
            <div key={g.id} className="card pad stack" style={{ padding: 14 }}>
              <span className="label muted">Court {g.court} · tap the winners</span>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                {(['A', 'B'] as const).map((side, i) => (
                  <FragmentWithVs key={side} showVs={i === 1}>
                    <button type="button" className={`${teamClass(g, side)} team-big`} aria-pressed={g.winner === side} onClick={() => pick(g, side)}>
                      <span className="names">
                        {name(side === 'A' ? g.a1 : g.b1)}
                        <br />
                        {name(side === 'A' ? g.a2 : g.b2)}
                      </span>
                      <span className="result-chip">{chip(g, side)}</span>
                    </button>
                  </FragmentWithVs>
                ))}
              </div>
            </div>
          ))}
          {now[1].byes.length > 0 && (
            <div className="notice">
              <Icon.Bench />
              <span>
                <strong style={{ color: 'var(--green)' }}>Sitting out:</strong> {now[1].byes.map(name).join(', ')}
              </span>
            </div>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">The sheet</h2>
          <span className="tiny muted">Every round, every court</span>
        </div>
        <div className="card">
          <div className="table-head" style={{ gridTemplateColumns: `50px repeat(${maxCourts}, minmax(0, 1fr))`, padding: '10px 12px' }}>
            <span>Rd</span>
            {Array.from({ length: maxCourts }, (_, i) => (
              <span key={i}>Court {i + 1}</span>
            ))}
          </div>
          {rounds.map(([round, r], idx) => (
            <div
              key={round}
              style={{
                display: 'grid',
                gridTemplateColumns: `50px repeat(${maxCourts}, minmax(0, 1fr))`,
                gap: 8,
                padding: '10px 12px',
                borderTop: '1px solid var(--line)',
                background: round === prog.currentRound ? 'rgba(245,231,21,0.18)' : 'transparent',
                borderRadius: idx === rounds.length - 1 ? '0 0 20px 20px' : 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="display" style={{ fontSize: 18, color: 'var(--green)' }}>
                  R{idx + 1}
                </span>
                {r.byes.length > 0 && (
                  <span className="muted" style={{ fontSize: 11, lineHeight: 1.25 }}>
                    Out: {r.byes.map(name).join(', ')}
                  </span>
                )}
              </div>
              {r.games.map((g) => (
                <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  {(['A', 'B'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={`${teamClass(g, side)} team-small`}
                      aria-pressed={g.winner === side}
                      onClick={() => pick(g, side)}
                    >
                      {name(side === 'A' ? g.a1 : g.b1)} + {name(side === 'A' ? g.a2 : g.b2)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="footer-actions" style={{ paddingTop: 24 }}>
        <button
          type="button"
          className="btn-yellow"
          disabled={ending}
          onClick={() => {
            const left = prog.total - prog.played;
            if (left > 0 && !confirm(`${left} game${left === 1 ? '' : 's'} not played yet. End the session and settle up anyway?`)) return;
            startEnding(() => endSession(session.id));
          }}
        >
          {ending ? 'Settling up…' : 'End session & settle up'}
        </button>
        <div className="small muted" style={{ textAlign: 'center' }}>
          Tap a team again to undo a result · <Link href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}

function FragmentWithVs({ showVs, children }: { showVs: boolean; children: React.ReactNode }) {
  return (
    <>
      {showVs && (
        <span className="display" style={{ alignSelf: 'center', fontSize: 14, color: 'var(--green)' }}>
          VS
        </span>
      )}
      {children}
    </>
  );
}
