import Link from 'next/link';
import { BottomNav, Icon, Logo, Money, formatDate } from '@/components/ui';
import { completedHistory, getActiveSession, getSessionDetail, listPlayers, playerNames } from '@/lib/data';
import { progress, tally } from '@/lib/live';
import { netBySession, playerLines } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [active, history, names, roster] = await Promise.all([
    getActiveSession(),
    completedHistory('all'),
    playerNames(),
    listPlayers(),
  ]);
  const detail = active ? await getSessionDetail(active.id) : null;
  const name = (id: number) => names.get(id) ?? '?';

  let live: null | { id: number; date: string; round: number | null; rounds: number; players: number; courts: number; leader: { id: number; cents: number } | null } = null;
  if (detail) {
    const p = progress(detail.games);
    const rows = tally(detail.games, detail.roster.filter((r) => r.active).map((r) => r.id), detail.session.stakeCents)
      .filter((r) => r.netCents > 0)
      .sort((a, b) => b.netCents - a.netCents);
    live = {
      id: detail.session.id,
      date: detail.session.playedOn,
      round: p.currentRound === null ? null : p.roundIndex,
      rounds: p.totalRounds,
      players: detail.roster.filter((r) => r.active).length,
      courts: detail.session.courts,
      leader: rows[0] ? { id: rows[0].playerId, cents: rows[0].netCents } : null,
    };
  }

  const lines = [...playerLines(history.games).values()].sort((a, b) => b.netCents - a.netCents);
  const up = lines.filter((l) => l.netCents > 0).slice(0, 3);
  const down = lines.filter((l) => l.netCents < 0).slice(-3).reverse();

  const perSession = netBySession(history.games, history.sessions.map((s) => s.id));
  const recent = history.sessions
    .slice(-3)
    .reverse()
    .map((s) => {
      const nets = [...(perSession.get(s.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
      const playerCount = nets.length;
      return { session: s, top: nets[0], playerCount };
    });

  return (
    <main className="screen">
      <header className="band" style={{ alignItems: 'center', padding: '20px 16px 18px' }}>
        <h1 style={{ margin: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Logo />
        </h1>
        <div className="sub" style={{ fontWeight: 600 }}>
          $1 a game, every game
        </div>
      </header>

      <div className="section" style={{ paddingTop: 20, gap: 14 }}>
        {live && (
          <div className="card pad stack" style={{ border: '2px solid var(--green)', padding: 18, gap: 12 }}>
            <div className="section-head" style={{ alignItems: 'center' }}>
              <span className="pill">
                <span className="dot" />
                Live now
              </span>
              <span className="small muted">{formatDate(live.date)}</span>
            </div>
            <div className="display" style={{ fontSize: 28, color: 'var(--green)' }}>
              {live.round ? `Round ${live.round} of ${live.rounds}` : 'All rounds played'}
            </div>
            <div className="small muted">
              {live.players} players · {live.courts} {live.courts === 1 ? 'court' : 'courts'}
              {live.leader && (
                <>
                  {' '}· Leading: <strong style={{ color: 'var(--ink)' }}>{name(live.leader.id)}</strong>{' '}
                  <Money cents={live.leader.cents} />
                </>
              )}
            </div>
            <Link href={`/sessions/${live.id}`} className="btn-green">
              Resume session
            </Link>
          </div>
        )}

        <Link href={roster.length < 4 ? '/players' : '/sessions/new'} className="btn-yellow" style={{ minHeight: 64, fontSize: 21 }}>
          <Icon.Plus size={22} />
          {roster.length < 4 ? 'Add your crew' : 'Start new session'}
        </Link>
      </div>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="section-head">
          <h2 className="h2">All-time money</h2>
          <Link href="/leaderboard" className="link-strong">
            Full board
          </Link>
        </div>
        {lines.length === 0 ? (
          <div className="card pad small muted">No finished sessions yet. Play one and the money table shows up here.</div>
        ) : (
          <div className="grid-2">
            {[
              { title: 'Up', rows: up, bg: 'var(--green)' },
              { title: 'Down', rows: down, bg: 'var(--neg)' },
            ].map((col) => (
              <div key={col.title} className="card pad stack" style={{ padding: 14, gap: 9 }}>
                <span className="label" style={{ alignSelf: 'flex-start', color: '#fff', background: col.bg, borderRadius: 6, padding: '3px 8px' }}>
                  {col.title}
                </span>
                {col.rows.length === 0 && <span className="small muted">Nobody yet</span>}
                {col.rows.map((l) => (
                  <Link
                    key={l.playerId}
                    href={`/players/${l.playerId}`}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                  >
                    <span>{name(l.playerId)}</span>
                    <Money cents={l.netCents} />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="section" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <h2 className="h2">Recent sessions</h2>
          <div className="card clip">
            {recent.map(({ session, top, playerCount }, i) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}/summary`}
                className="table-row"
                style={{ gridTemplateColumns: '1fr auto', minHeight: 62, borderTop: i === 0 ? 0 : undefined }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong>{formatDate(session.playedOn)}</strong>
                  <span className="small muted">{playerCount} players</span>
                </span>
                {top && top[1] > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {name(top[0])} <Money cents={top[1]} />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <BottomNav active="home" sessionHref={live ? `/sessions/${live.id}` : '/sessions/new'} />
    </main>
  );
}
