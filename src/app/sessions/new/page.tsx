import { BackLink, Badge, formatDate } from '@/components/ui';
import { completedHistory, listPlayers } from '@/lib/data';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function NewSessionPage() {
  const [players, history] = await Promise.all([listPlayers(), completedHistory('all')]);

  // Pre-select whoever played last time.
  const last = history.sessions.at(-1);
  const lastIds = new Set(
    last ? history.games.filter((g) => g.sessionId === last.id).flatMap((g) => [g.a1, g.a2, g.b1, g.b2]) : [],
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="screen">
      <header className="band">
        <div className="band-row">
          <BackLink href="/" label="Back to home" />
        </div>
        <div className="band-row">
          <h1 className="title">New session</h1>
          <Badge />
        </div>
        <div className="sub">{formatDate(today)} · tap who&apos;s here</div>
      </header>
      <SetupForm
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        preselected={players.filter((p) => lastIds.has(p.id)).map((p) => p.id)}
      />
    </main>
  );
}
