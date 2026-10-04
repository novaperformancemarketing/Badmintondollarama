/** Pure stat calculations over recorded games. Money is always in cents. */

export interface GameRecord {
  sessionId: number;
  round: number;
  court: number;
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  winner: 'A' | 'B' | null;
  stakeCents: number;
}

export interface PlayerLine {
  playerId: number;
  wins: number;
  losses: number;
  netCents: number;
  sessions: number;
}

export interface PairLine {
  otherId: number;
  wins: number;
  losses: number;
  netCents: number;
}

function sides(g: GameRecord) {
  const a = [g.a1, g.a2];
  const b = [g.b1, g.b2];
  return g.winner === 'A' ? { win: a, lose: b } : { win: b, lose: a };
}

export function playerLines(games: GameRecord[]): Map<number, PlayerLine> {
  const out = new Map<number, PlayerLine>();
  const sessionsByPlayer = new Map<number, Set<number>>();
  const line = (id: number) => {
    let l = out.get(id);
    if (!l) out.set(id, (l = { playerId: id, wins: 0, losses: 0, netCents: 0, sessions: 0 }));
    return l;
  };
  for (const g of games) {
    if (!g.winner) continue;
    const { win, lose } = sides(g);
    for (const p of win) {
      const l = line(p);
      l.wins++;
      l.netCents += g.stakeCents;
    }
    for (const p of lose) {
      const l = line(p);
      l.losses++;
      l.netCents -= g.stakeCents;
    }
    for (const p of [...win, ...lose]) {
      if (!sessionsByPlayer.has(p)) sessionsByPlayer.set(p, new Set());
      sessionsByPlayer.get(p)!.add(g.sessionId);
    }
  }
  for (const [id, set] of sessionsByPlayer) line(id).sessions = set.size;
  return out;
}

/** Record and money for `playerId` alongside each partner. */
export function partnerLines(games: GameRecord[], playerId: number): PairLine[] {
  const map = new Map<number, PairLine>();
  for (const g of games) {
    if (!g.winner) continue;
    const teams = [
      { team: [g.a1, g.a2], won: g.winner === 'A' },
      { team: [g.b1, g.b2], won: g.winner === 'B' },
    ];
    for (const { team, won } of teams) {
      if (!team.includes(playerId)) continue;
      const other = team[0] === playerId ? team[1] : team[0];
      const l = map.get(other) ?? { otherId: other, wins: 0, losses: 0, netCents: 0 };
      if (won) l.wins++;
      else l.losses++;
      l.netCents += won ? g.stakeCents : -g.stakeCents;
      map.set(other, l);
    }
  }
  return [...map.values()].sort((a, b) => b.netCents - a.netCents || b.wins - a.wins);
}

/** Record and money for `playerId` against each opponent. */
export function opponentLines(games: GameRecord[], playerId: number): PairLine[] {
  const map = new Map<number, PairLine>();
  for (const g of games) {
    if (!g.winner) continue;
    const a = [g.a1, g.a2];
    const b = [g.b1, g.b2];
    const mine = a.includes(playerId) ? 'A' : b.includes(playerId) ? 'B' : null;
    if (!mine) continue;
    const won = g.winner === mine;
    for (const other of mine === 'A' ? b : a) {
      const l = map.get(other) ?? { otherId: other, wins: 0, losses: 0, netCents: 0 };
      if (won) l.wins++;
      else l.losses++;
      l.netCents += won ? g.stakeCents : -g.stakeCents;
      map.set(other, l);
    }
  }
  return [...map.values()].sort((a, b) => b.netCents - a.netCents || b.wins - a.wins);
}

/** Net cents per player for each session, in session order. */
export function netBySession(games: GameRecord[], sessionOrder: number[]): Map<number, Map<number, number>> {
  const out = new Map<number, Map<number, number>>();
  for (const id of sessionOrder) out.set(id, new Map());
  for (const g of games) {
    if (!g.winner) continue;
    const m = out.get(g.sessionId);
    if (!m) continue;
    const { win, lose } = sides(g);
    for (const p of win) m.set(p, (m.get(p) ?? 0) + g.stakeCents);
    for (const p of lose) m.set(p, (m.get(p) ?? 0) - g.stakeCents);
  }
  return out;
}

/** Running total of a player's money after each session. */
export function cumulativeSeries(perSession: Map<number, Map<number, number>>, playerId: number): number[] {
  let total = 0;
  return [...perSession.values()].map((m) => (total += m.get(playerId) ?? 0));
}

/** Win/loss sequence for each player in play order (round, then court). */
export function resultSequences(games: GameRecord[]): Map<number, ('W' | 'L')[]> {
  const out = new Map<number, ('W' | 'L')[]>();
  const ordered = games.filter((g) => g.winner).sort((x, y) => x.round - y.round || x.court - y.court);
  for (const g of ordered) {
    const { win, lose } = sides(g);
    for (const p of win) out.set(p, [...(out.get(p) ?? []), 'W']);
    for (const p of lose) out.set(p, [...(out.get(p) ?? []), 'L']);
  }
  return out;
}

export interface Story {
  label: string;
  playerId: number;
  text: string;
}

/** Fun callouts for the session summary. */
export function sessionStories(games: GameRecord[]): Story[] {
  const seqs = resultSequences(games);
  const stories: Story[] = [];
  const longest = (seq: string[], c: string) => {
    let best = 0;
    let run = 0;
    for (const s of seq) {
      run = s === c ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  };
  const trailing = (seq: string[], c: string) => {
    let n = 0;
    for (let i = seq.length - 1; i >= 0 && seq[i] === c; i--) n++;
    return n;
  };
  const leading = (seq: string[], c: string) => {
    let n = 0;
    while (n < seq.length && seq[n] === c) n++;
    return n;
  };
  const top = (fn: (seq: string[]) => number) => {
    let best: { id: number; n: number } | null = null;
    for (const [id, seq] of seqs) {
      const n = fn(seq);
      if (!best || n > best.n) best = { id, n };
    }
    return best;
  };

  const hot = top((s) => leading(s, 'W'));
  if (hot && hot.n >= 3) stories.push({ label: 'Hot start', playerId: hot.id, text: `Won the first ${hot.n} straight` });
  const closer = top((s) => trailing(s, 'W'));
  if (closer && closer.n >= 2 && closer.id !== hot?.id)
    stories.push({ label: 'Closer', playerId: closer.id, text: `Finished on ${closer.n} wins in a row` });
  const streak = top((s) => longest(s, 'W'));
  if (streak && streak.n >= 3 && !stories.some((s) => s.playerId === streak.id))
    stories.push({ label: 'On fire', playerId: streak.id, text: `${streak.n} wins in a row` });
  const rough = top((s) => longest(s, 'L'));
  if (rough && rough.n >= 3) stories.push({ label: 'Rough night', playerId: rough.id, text: `Lost ${rough.n} in a row` });
  return stories.slice(0, 3);
}
