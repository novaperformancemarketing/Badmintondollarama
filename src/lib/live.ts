/** Pure helpers shared by the live session screen and the home card. */

export interface LiveGame {
  id: number;
  round: number;
  court: number;
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  winner: 'A' | 'B' | null;
}

export interface TallyRow {
  playerId: number;
  wins: number;
  losses: number;
  netCents: number;
}

export function progress(games: LiveGame[]) {
  const rounds = [...new Set(games.map((g) => g.round))].sort((a, b) => a - b);
  const open = games.filter((g) => !g.winner).map((g) => g.round);
  const current = open.length ? Math.min(...open) : null;
  return {
    totalRounds: rounds.length,
    lastRound: rounds.length ? rounds[rounds.length - 1] : 0,
    currentRound: current,
    roundIndex: current === null ? rounds.length : rounds.indexOf(current) + 1,
    played: games.filter((g) => g.winner).length,
    total: games.length,
  };
}

export function tally(games: LiveGame[], playerIds: number[], stakeCents: number): TallyRow[] {
  const rows = new Map<number, TallyRow>(playerIds.map((id) => [id, { playerId: id, wins: 0, losses: 0, netCents: 0 }]));
  const row = (id: number) => {
    if (!rows.has(id)) rows.set(id, { playerId: id, wins: 0, losses: 0, netCents: 0 });
    return rows.get(id)!;
  };
  for (const g of games) {
    if (!g.winner) continue;
    const win = g.winner === 'A' ? [g.a1, g.a2] : [g.b1, g.b2];
    const lose = g.winner === 'A' ? [g.b1, g.b2] : [g.a1, g.a2];
    for (const p of win) {
      row(p).wins++;
      row(p).netCents += stakeCents;
    }
    for (const p of lose) {
      row(p).losses++;
      row(p).netCents -= stakeCents;
    }
  }
  return [...rows.values()];
}
