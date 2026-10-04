import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BackLink, Badge, BottomNav, formatDate } from '@/components/ui';
import { getActiveSessions } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** The Session tab: straight into the live session, or a picker when brackets run side by side. */
export default async function LivePickerPage() {
  const active = await getActiveSessions();
  if (active.length === 0) redirect('/sessions/new');
  if (active.length === 1) redirect(`/sessions/${active[0].id}`);

  return (
    <main className="screen">
      <header className="band">
        <div className="band-row">
          <BackLink href="/" label="Back to home" />
        </div>
        <div className="band-row">
          <h1 className="title">Live sessions</h1>
          <Badge />
        </div>
        <div className="sub">Pick a bracket</div>
      </header>
      <section className="section">
        {active.map((s) => (
          <Link key={s.id} href={`/sessions/${s.id}`} className="card pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
            <span className="display" style={{ fontSize: 22, color: 'var(--green)' }}>
              {s.bracket ? `${s.bracket} bracket` : 'Session'}
            </span>
            <span className="small muted">{formatDate(s.playedOn)}</span>
          </Link>
        ))}
        <Link href="/sessions/new" className="btn-ghost">
          Start another session
        </Link>
      </section>
      <BottomNav active="session" />
    </main>
  );
}
