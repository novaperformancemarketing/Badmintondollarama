import { notFound, redirect } from 'next/navigation';
import { getSessionDetail, getSiblingSessions, listPlayers } from '@/lib/data';
import LiveBoard from './LiveBoard';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getSessionDetail(Number(id));
  if (!detail) notFound();
  if (detail.session.status === 'completed') redirect(`/sessions/${id}/summary`);
  const [everyone, siblings] = await Promise.all([listPlayers(), getSiblingSessions(detail.session)]);
  // People playing in the other bracket tonight aren't available here.
  const otherBrackets = await Promise.all(
    siblings.filter((s) => s.id !== detail.session.id && s.status === 'active').map((s) => getSessionDetail(s.id)),
  );
  const elsewhere = new Set(otherBrackets.flatMap((d) => d?.roster.filter((r) => r.active).map((r) => r.id) ?? []));

  return (
    <LiveBoard
      session={{
        id: detail.session.id,
        playedOn: detail.session.playedOn,
        courts: detail.session.courts,
        stakeCents: detail.session.stakeCents,
        bracket: detail.session.bracket,
      }}
      brackets={siblings.map((s) => ({ id: s.id, label: s.bracket ?? '', status: s.status }))}
      roster={detail.roster}
      games={detail.games.map((g) => ({
        id: g.id,
        round: g.round,
        court: g.court,
        a1: g.a1,
        a2: g.a2,
        b1: g.b1,
        b2: g.b2,
        winner: g.winner,
      }))}
      byes={detail.byes.map((b) => ({ round: b.round, playerId: b.playerId }))}
      bench={everyone
        .filter((p) => !elsewhere.has(p.id) && !detail.roster.some((r) => r.id === p.id && r.active))
        .map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
