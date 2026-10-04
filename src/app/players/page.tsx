import { Badge, BottomNav } from '@/components/ui';
import { completedHistory, listPlayers } from '@/lib/data';
import { playerLines } from '@/lib/stats';
import PlayerList from './PlayerList';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const [players, history] = await Promise.all([listPlayers(true), completedHistory('all')]);
  const lines = playerLines(history.games);

  return (
    <main className="screen">
      <header className="band" style={{ padding: '18px 16px 18px' }}>
        <div className="band-row">
          <h1 className="title">Players</h1>
          <Badge />
        </div>
        <div className="sub">The crew, their records, and who&apos;s up</div>
      </header>
      <PlayerList
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          archived: p.archived,
          netCents: lines.get(p.id)?.netCents ?? 0,
          wins: lines.get(p.id)?.wins ?? 0,
          losses: lines.get(p.id)?.losses ?? 0,
        }))}
      />
      <BottomNav active="players" />
    </main>
  );
}
