import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackLink, Logo, Money, formatDate } from '@/components/ui';
import { getSessionDetail, getTab, playerNames, toRecords } from '@/lib/data';
import { tally } from '@/lib/live';
import { money, signedMoney } from '@/lib/money';
import { sessionStories } from '@/lib/stats';
import { TransferList } from '@/components/TabClient';
import { ShareButton, SummaryActions } from './SummaryClient';

export const dynamic = 'force-dynamic';

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, names, tab] = await Promise.all([getSessionDetail(Number(id)), playerNames(), getTab()]);
  if (!detail) notFound();
  const name = (pid: number) => names.get(pid) ?? '?';
  const { session } = detail;
  const played = detail.games.filter((g) => g.winner);
  const rows = tally(played, [], session.stakeCents).sort(
    (a, b) => b.netCents - a.netCents || name(a.playerId).localeCompare(name(b.playerId)),
  );
  const ranks = rows.map((r) => rows.findIndex((x) => x.netCents === r.netCents) + 1);
  const rounds = new Set(played.map((g) => g.round)).size;
  const moved = rows.filter((r) => r.netCents > 0).reduce((s, r) => s + r.netCents, 0);
  const leaders = rows.filter((r) => rows[0] && r.netCents === rows[0].netCents && r.netCents > 0);
  const stories = sessionStories(toRecords(detail));
  // Settling happens on the running tab, so earlier nights net out. Show what's
  // outstanding for anyone who played tonight.
  const tonight = new Set(rows.map((r) => r.playerId));
  const owing = tab.transfers.filter((t) => tonight.has(t.from) || tonight.has(t.to));

  const headline =
    rows.length === 0
      ? 'No games played'
      : leaders.length > 1
        ? `${['', '', 'Two', 'Three', 'Four', 'Five', 'Six'][leaders.length] ?? leaders.length}-way tie at the top`
        : leaders.length === 1
          ? `${name(leaders[0].playerId)} takes the night`
          : 'All square tonight';

  const shareText = [
    `🏸 Smash Champs Dollarama${session.bracket ? ` · ${session.bracket} bracket` : ''} · ${formatDate(session.playedOn)}`,
    ...rows.map((r) => `${name(r.playerId)} ${signedMoney(r.netCents)} (${r.wins}–${r.losses})`),
    owing.length ? '\nSettle up (running tab):' : '',
    ...owing.map((t) => `${name(t.from)} → ${name(t.to)} ${money(t.amountCents)}`),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <main className="screen">
      <header className="band" style={{ gap: 12, paddingBottom: 22 }}>
        <div className="band-row">
          <BackLink href="/" label="Back to home" />
        </div>
        <Logo />
        <span className="pill" style={{ alignSelf: 'flex-start' }}>
          {session.status === 'completed' ? 'Final' : 'In progress'}
          {session.bracket ? ` · ${session.bracket} bracket` : ''} · {formatDate(session.playedOn)}
        </span>
        <h1 className="title">{headline}</h1>
        <div className="sub">
          {rows.length} players · {rounds} rounds · {played.length} games · {money(moved)} changed hands
        </div>
      </header>

      <div className="cols">
      <section className="section">
        <h2 className="h2">Final standings</h2>
        <div className="card">
          <div className="table-head" style={{ gridTemplateColumns: '26px 1fr 54px 64px' }}>
            <span>#</span>
            <span>Player</span>
            <span className="right">W–L</span>
            <span className="right">$</span>
          </div>
          {rows.map((r, i) => (
            <Link
              key={r.playerId}
              href={`/players/${r.playerId}`}
              className="table-row"
              style={{ gridTemplateColumns: '26px 1fr 54px 64px' }}
            >
              <span className="num small muted">{ranks[i]}</span>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{name(r.playerId)}</span>
              <span className="num right" style={{ fontSize: 15 }}>
                {r.wins}–{r.losses}
              </span>
              <Money cents={r.netCents} className="right" style={{ fontSize: 18 }} />
            </Link>
          ))}
        </div>
      </section>

      <div className="col">
      {session.status === 'completed' && (
        <section className="section" style={{ paddingTop: 24 }}>
          <div className="section-head">
            <h2 className="h2">Settle up</h2>
            <Link href="/tab" className="link-strong">
              Full tab
            </Link>
          </div>
          <span className="small muted">Running tab: earlier nights net out, so you only pay the difference.</span>
          <TransferList transfers={owing.map((t) => ({ ...t, fromName: name(t.from), toName: name(t.to) }))} />
        </section>
      )}

      {stories.length > 0 && (
        <section className="section" style={{ paddingTop: 24 }}>
          <h2 className="h2">Tonight&apos;s stories</h2>
          <div className="grid-3">
            {stories.map((s) => (
              <div key={s.label} className="card stack" style={{ padding: 12, gap: 6, borderTop: '6px solid var(--yellow)' }}>
                <span className="label" style={{ color: 'var(--green)' }}>
                  {s.label}
                </span>
                <span className="display" style={{ fontSize: 17 }}>
                  {name(s.playerId)}
                </span>
                <span className="small muted" style={{ lineHeight: 1.3 }}>
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      </div>
      </div>

      <div className="footer-actions">
        <ShareButton text={shareText} />
        <SummaryActions sessionId={session.id} completed={session.status === 'completed'} />
      </div>
    </main>
  );
}
