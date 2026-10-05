import Link from 'next/link';
import { Badge, BottomNav, Money, formatDate } from '@/components/ui';
import { completedHistory, playerNames, type Range } from '@/lib/data';
import { cumulativeSeries, netBySession, playerLines } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'All-time' },
  { key: 'season', label: 'This season' },
  { key: '30d', label: '30 days' },
];

const SERIES_COLORS = ['#036230', '#c9b800', '#c0281a'];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: raw } = await searchParams;
  const range: Range = raw === 'season' || raw === '30d' ? raw : 'all';
  const [history, names] = await Promise.all([completedHistory(range), playerNames()]);
  const name = (id: number) => names.get(id) ?? '?';

  const lines = [...playerLines(history.games).values()].sort(
    (a, b) => b.netCents - a.netCents || b.wins - a.wins || name(a.playerId).localeCompare(name(b.playerId)),
  );
  const perSession = netBySession(history.games, history.sessions.map((s) => s.id));

  // Chart the top two and the bottom one, like a race.
  const charted = [...lines.slice(0, 2), ...(lines.length > 2 ? [lines[lines.length - 1]] : [])];
  const series = charted.map((l) => ({ id: l.playerId, values: [0, ...cumulativeSeries(perSession, l.playerId)] }));
  const all = series.flatMap((s) => s.values);
  const bound = Math.max(100, ...all.map(Math.abs));
  const W = 326;
  const H = 170;
  const x0 = 34;
  const top = 10;
  const bottom = 150;
  const mid = (top + bottom) / 2;
  const steps = Math.max(1, (series[0]?.values.length ?? 1) - 1);
  const pt = (v: number, i: number) => `${(x0 + ((W - x0 - 6) * i) / steps).toFixed(1)},${(mid - ((bottom - top) / 2) * (v / bound)).toFixed(1)}`;
  const boundLabel = `${Math.round(bound / 100)}`;

  return (
    <main className="screen">
      <header className="band" style={{ padding: '18px 16px', gap: 14 }}>
        <div className="band-row">
          <h1 className="title">Leaderboard</h1>
          <Badge />
        </div>
        <nav aria-label="Time range" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, borderRadius: 99, padding: 4, background: 'var(--green-deep)' }}>
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={r.key === 'all' ? '/leaderboard' : `/leaderboard?range=${r.key}`}
              aria-current={r.key === range ? 'page' : undefined}
              style={{
                minHeight: 42,
                borderRadius: 99,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: r.key === range ? 700 : 600,
                textDecoration: 'none',
                background: r.key === range ? 'var(--yellow-grad)' : 'transparent',
                color: r.key === range ? 'var(--green-ink)' : '#fff',
              }}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </header>

      {lines.length === 0 ? (
        <section className="section">
          <div className="card pad small muted">No finished sessions in this range yet.</div>
        </section>
      ) : (
        <>
          <div className="cols cols-lg">
          {history.sessions.length > 1 && (
            <section className="section" style={{ paddingTop: 18 }}>
              <div className="card pad stack">
                <div className="section-head">
                  <h2 className="h2" style={{ fontSize: 17 }}>
                    Cumulative $
                  </h2>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 600, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {series.map((s, i) => (
                      <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 4, borderRadius: 2, background: SERIES_COLORS[i] }} />
                        {name(s.id)}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Running money over ${history.sessions.length} sessions for ${series.map((s) => name(s.id)).join(', ')}`}>
                  <line x1={x0} y1={mid} x2={W} y2={mid} stroke="#b9c7be" strokeDasharray="3 3" />
                  <text x="0" y={mid + 4} fontSize="11" fill="#4f6357" fontWeight="700">$0</text>
                  <text x="0" y={top + 6} fontSize="11" fill="#4f6357" fontWeight="700">+{boundLabel}</text>
                  <text x="0" y={bottom + 4} fontSize="11" fill="#4f6357" fontWeight="700">−{boundLabel}</text>
                  {series.map((s, i) => (
                    <polyline key={s.id} fill="none" stroke={SERIES_COLORS[i]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={s.values.map(pt).join(' ')} />
                  ))}
                  <text x={x0} y={H - 2} fontSize="11" fill="#4f6357">
                    {formatDate(history.sessions[0].playedOn, { month: 'short', day: 'numeric' })}
                  </text>
                  <text x={W} y={H - 2} fontSize="11" fill="#4f6357" textAnchor="end">
                    {formatDate(history.sessions.at(-1)!.playedOn, { month: 'short', day: 'numeric' })}
                  </text>
                </svg>
              </div>
            </section>
          )}

          <section className="section" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div className="card">
              <div className="table-head" style={{ gridTemplateColumns: '24px 1fr 62px 46px 60px', padding: '10px 14px', gap: 6 }}>
                <span>#</span>
                <span>Player</span>
                <span className="right">W–L</span>
                <span className="right">$/gm</span>
                <span className="right">Total</span>
              </div>
              {lines.map((l, i) => {
                const games = l.wins + l.losses;
                const per = games ? l.netCents / 100 / games : 0;
                return (
                  <Link
                    key={l.playerId}
                    href={`/players/${l.playerId}`}
                    className="table-row"
                    style={{
                      gridTemplateColumns: '24px 1fr 62px 46px 60px',
                      minHeight: 54,
                      padding: '0 14px',
                      gap: 6,
                      background: i === 0 ? '#fff7c2' : 'transparent',
                      borderRadius: i === lines.length - 1 ? '0 0 20px 20px' : 0,
                    }}
                  >
                    <span className="num muted" style={{ fontSize: 14 }}>
                      {i + 1}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: 16 }}>{name(l.playerId)}</strong>
                      <span className="tiny muted">
                        {l.sessions} {l.sessions === 1 ? 'night' : 'nights'} · {games ? Math.round((100 * l.wins) / games) : 0}% wins
                      </span>
                    </span>
                    <span className="num right" style={{ fontSize: 13 }}>
                      {l.wins}–{l.losses}
                    </span>
                    <span className={`num right ${per > 0 ? 'pos' : per < 0 ? 'neg' : 'zero'}`} style={{ fontSize: 13 }}>
                      {per > 0 ? '+' : per < 0 ? '−' : ''}
                      {Math.abs(per).toFixed(2)}
                    </span>
                    <Money cents={l.netCents} className="right" style={{ fontSize: 17 }} />
                  </Link>
                );
              })}
            </div>
          </section>
          </div>
        </>
      )}

      <BottomNav active="leaders" />
    </main>
  );
}
