import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink, Badge, BottomNav, Money, formatDate } from '@/components/ui';
import { completedHistory, listPlayers, playerNames } from '@/lib/data';
import { signedMoney } from '@/lib/money';
import { netBySession, opponentLines, partnerLines, playerLines } from '@/lib/stats';
import PlayerSettings from './PlayerSettings';

export const dynamic = 'force-dynamic';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);
  const [everyone, names, history] = await Promise.all([listPlayers(true), playerNames(), completedHistory('all')]);
  const player = everyone.find((p) => p.id === playerId);
  if (!player) notFound();
  const name = (id: number) => names.get(id) ?? '?';

  const lines = [...playerLines(history.games).values()].sort((a, b) => b.netCents - a.netCents);
  const me = lines.find((l) => l.playerId === playerId);
  const rank = me ? lines.indexOf(me) + 1 : null;
  const games = (me?.wins ?? 0) + (me?.losses ?? 0);
  const partners = partnerLines(history.games, playerId);
  const opponents = opponentLines(history.games, playerId);
  const perSession = netBySession(history.games, history.sessions.map((s) => s.id));
  const nights = history.sessions
    .filter((s) => perSession.get(s.id)?.has(playerId))
    .map((s) => ({ id: s.id, date: s.playedOn, cents: perSession.get(s.id)!.get(playerId)! }));
  const best = nights.reduce<number | null>((m, n) => (m === null || n.cents > m ? n.cents : m), null);

  const withGames = (l: { wins: number; losses: number }) => l.wins + l.losses;
  const bestPartner = partners.filter((p) => withGames(p) >= 2)[0] ?? partners[0];
  // Only call someone kryptonite / nemesis when it actually cost money, and a victim when it paid.
  const kryptonite = partners.filter((p) => withGames(p) >= 2 && p.netCents <= 0).at(-1);
  const nemesis = opponents.filter((p) => withGames(p) >= 2 && p.netCents < 0).at(-1);
  const victim = opponents.filter((p) => withGames(p) >= 2 && p.netCents > 0)[0];

  return (
    <main className="screen">
      <header className="band" style={{ gap: 8 }}>
        <div className="band-row">
          <BackLink href="/leaderboard" label="Back to leaderboard" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="avatar">{player.name.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <h1 className="title">{player.name}</h1>
            <div className="sub">
              {rank ? `#${rank} all-time · ` : ''}
              {nights.length} {nights.length === 1 ? 'night' : 'nights'}
              {player.archived ? ' · retired' : ''}
            </div>
          </div>
          <Badge />
        </div>
      </header>

      <section className="section" style={{ paddingTop: 18 }}>
        <div className="card pad grid-3">
          <div className="stack" style={{ gap: 6 }}>
            <span className="tag" style={{ alignSelf: 'flex-start', fontSize: 22 }}>
              {signedMoney(me?.netCents ?? 0)}
            </span>
            <span className="tiny muted">lifetime</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="num" style={{ fontSize: 22, paddingTop: 3 }}>
              {me?.wins ?? 0}–{me?.losses ?? 0}
            </span>
            <span className="tiny muted">{games ? Math.round((100 * (me?.wins ?? 0)) / games) : 0}% wins</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <Money cents={best ?? 0} style={{ fontSize: 22, paddingTop: 3 }} />
            <span className="tiny muted">best night</span>
          </div>
        </div>
      </section>

      <div className="cols">
      {partners.length > 0 && (
        <section className="section">
          <h2 className="h2">Partners</h2>
          <div className="grid-2" style={{ gap: 8 }}>
            {bestPartner && (
              <div className="glass-green sign stack" style={{ padding: 14, gap: 6 }}>
                <span className="label" style={{ color: 'var(--yellow)' }}>
                  Best partner
                </span>
                <span className="display" style={{ fontSize: 22 }}>
                  {name(bestPartner.otherId)}
                </span>
                <span className="small" style={{ color: 'var(--on-green-muted)' }}>
                  {bestPartner.wins}–{bestPartner.losses} together · {signedMoney(bestPartner.netCents)}
                </span>
              </div>
            )}
            {kryptonite && kryptonite.otherId !== bestPartner?.otherId && (
              <div
                className="stack"
                style={{ padding: 14, gap: 6, borderRadius: 20, background: 'linear-gradient(160deg,#fff4f2 0%,#fbe1dd 100%)', border: '1px solid #f4c2bc' }}
              >
                <span className="label" style={{ color: '#9e1f14' }}>
                  Kryptonite
                </span>
                <span className="display" style={{ fontSize: 22 }}>
                  {name(kryptonite.otherId)}
                </span>
                <span className="small" style={{ color: '#6e2a23' }}>
                  {kryptonite.wins}–{kryptonite.losses} together · {signedMoney(kryptonite.netCents)}
                </span>
              </div>
            )}
          </div>
          <div className="card">
            <div className="table-head" style={{ gridTemplateColumns: '1fr 46px 60px 56px' }}>
              <span>With</span>
              <span className="right">Gms</span>
              <span className="right">W–L</span>
              <span className="right">$</span>
            </div>
            {partners.map((p, i) => (
              <Link
                key={p.otherId}
                href={`/players/${p.otherId}`}
                className="table-row"
                style={{ gridTemplateColumns: '1fr 46px 60px 56px', minHeight: 44, borderRadius: i === partners.length - 1 ? '0 0 20px 20px' : 0 }}
              >
                <span style={{ fontWeight: 600 }}>{name(p.otherId)}</span>
                <span className="num right" style={{ fontSize: 14 }}>
                  {withGames(p)}
                </span>
                <span className="num right" style={{ fontSize: 14 }}>
                  {p.wins}–{p.losses}
                </span>
                <Money cents={p.netCents} className="right" style={{ fontSize: 16 }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {opponents.length > 0 && (
        <section className="section">
          <h2 className="h2">Head to head</h2>
          <div className="card">
            <div className="table-head" style={{ gridTemplateColumns: '1fr 60px 56px' }}>
              <span>Against</span>
              <span className="right">W–L</span>
              <span className="right">$</span>
            </div>
            {opponents.map((o, i) => (
              <Link
                key={o.otherId}
                href={`/players/${o.otherId}`}
                className="table-row"
                style={{ gridTemplateColumns: '1fr 60px 56px', minHeight: 50, borderRadius: i === opponents.length - 1 ? '0 0 20px 20px' : 0 }}
              >
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{name(o.otherId)}</span>
                  {(o.otherId === victim?.otherId || o.otherId === nemesis?.otherId) && (
                    <span className="tiny" style={{ color: 'var(--green)', fontWeight: 700 }}>
                      {o.otherId === victim?.otherId ? 'Favourite victim' : 'Nemesis'}
                    </span>
                  )}
                </span>
                <span className="num right" style={{ fontSize: 14 }}>
                  {o.wins}–{o.losses}
                </span>
                <Money cents={o.netCents} className="right" style={{ fontSize: 16 }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      </div>

      {nights.length > 0 && (
        <section className="section">
          <h2 className="h2">Recent nights</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {nights
              .slice(-8)
              .reverse()
              .map((n) => (
                <Link
                  key={n.id}
                  href={`/sessions/${n.id}/summary`}
                  className="card stack"
                  style={{ borderRadius: 14, padding: '10px 12px', gap: 4, borderTop: '5px solid var(--yellow)', textDecoration: 'none' }}
                >
                  <span className="tiny muted">{formatDate(n.date, { month: 'short', day: 'numeric' })}</span>
                  <Money cents={n.cents} style={{ fontSize: 18 }} />
                </Link>
              ))}
          </div>
        </section>
      )}

      {games === 0 && (
        <section className="section">
          <div className="card pad small muted">No finished games yet. Stats show up after their first session.</div>
        </section>
      )}

      <PlayerSettings id={player.id} name={player.name} archived={player.archived} />

      <BottomNav active="players" />
    </main>
  );
}
