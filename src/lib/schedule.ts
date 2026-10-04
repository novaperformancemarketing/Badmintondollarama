/**
 * Doubles round-robin scheduling.
 *
 * For group sizes with a known balanced table (everyone partners everyone
 * exactly once) we use that table. Every other size, extra rounds, and
 * mid-session rebuilds go through a search that rotates sit-outs fairly,
 * avoids repeat partners, and spreads opponents.
 */

/** [a1, a2, b1, b2]: team A is a1 + a2, team B is b1 + b2. */
export type GameSlot = [number, number, number, number];

export interface Round {
  games: GameSlot[];
  byes: number[];
}

export interface History {
  partner: Map<string, number>;
  opponent: Map<string, number>;
  byes: Map<number, number>;
  games: Map<number, number>;
  /** Players who sat out the most recent round. */
  lastByes: Set<number>;
}

export interface ScheduleOptions {
  players: number[];
  courts: number;
  rounds: number;
  /** Rounds already played this session (kept as-is when rebuilding). */
  previous?: Round[];
  seed?: number;
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const bump = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function gamesPerRound(playerCount: number, courts: number): number {
  return Math.max(0, Math.min(courts, Math.floor(playerCount / 4)));
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Round count where every player plays (and sits out) the same number of times. */
export function suggestedRounds(playerCount: number, courts: number): number {
  const g = gamesPerRound(playerCount, courts);
  if (g === 0) return 0;
  const sit = playerCount - 4 * g;
  if (sit === 0) return playerCount - 1;
  let r = playerCount / gcd(playerCount, sit);
  while (r < 5) r *= 2;
  return r;
}

/**
 * Cyclic balanced tables. Points 0..m-1 rotate (+1 each round); when `fixed`
 * is set, point m stays put. Base games are listed for round 0.
 * Found by exhaustive search; 4, 8, 12, 13, 16, 17 partner everyone exactly
 * once AND face everyone exactly twice. 5 and 9 partner everyone once.
 */
const TABLES: Record<number, { m: number; fixed: boolean; base: GameSlot[] }> = {
  4: { m: 3, fixed: true, base: [[3, 0, 2, 1]] },
  5: { m: 5, fixed: false, base: [[4, 2, 0, 1]] },
  8: { m: 7, fixed: true, base: [[7, 0, 1, 3], [2, 6, 4, 5]] },
  9: { m: 9, fixed: false, base: [[0, 1, 2, 4], [3, 7, 5, 8]] },
  12: { m: 11, fixed: true, base: [[1, 9, 7, 2], [8, 10, 0, 4], [5, 6, 3, 11]] },
  13: { m: 13, fixed: false, base: [[10, 1, 7, 5], [6, 11, 12, 9], [2, 8, 3, 4]] },
  16: { m: 15, fixed: true, base: [[4, 12, 8, 13], [15, 7, 0, 9], [5, 3, 10, 6], [1, 2, 11, 14]] },
  17: { m: 17, fixed: false, base: [[8, 11, 2, 1], [10, 14, 15, 13], [7, 16, 12, 5], [0, 6, 4, 9]] },
};

function tableRounds(n: number, courts: number): Round[] | null {
  const t = TABLES[n];
  if (!t || gamesPerRound(n, courts) !== t.base.length) return null;
  const rot = (x: number, r: number) => (t.fixed && x === t.m ? x : (x + r) % t.m);
  const out: Round[] = [];
  for (let r = 0; r < t.m; r++) {
    const games = t.base.map((g) => g.map((x) => rot(x, r)) as GameSlot);
    const used = new Set(games.flat());
    const byes = Array.from({ length: n }, (_, i) => i).filter((i) => !used.has(i));
    out.push({ games, byes });
  }
  return out;
}

/** Deterministic PRNG so schedules are reproducible in tests. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function emptyHistory(): History {
  return { partner: new Map(), opponent: new Map(), byes: new Map(), games: new Map(), lastByes: new Set() };
}

export function recordRound(h: History, round: Round): void {
  for (const [a1, a2, b1, b2] of round.games) {
    bump(h.partner, key(a1, a2));
    bump(h.partner, key(b1, b2));
    for (const x of [a1, a2]) for (const y of [b1, b2]) bump(h.opponent, key(x, y));
    for (const p of [a1, a2, b1, b2]) bump(h.games, p);
  }
  for (const p of round.byes) bump(h.byes, p);
  h.lastByes = new Set(round.byes);
}

export function historyFrom(rounds: Round[]): History {
  const h = emptyHistory();
  for (const r of rounds) recordRound(h, r);
  return h;
}

const PARTNER_WEIGHT = 1000;
const OPPONENT_WEIGHT = 10;

function gameCost(h: History, [a1, a2, b1, b2]: GameSlot): number {
  const p1 = h.partner.get(key(a1, a2)) ?? 0;
  const p2 = h.partner.get(key(b1, b2)) ?? 0;
  let opp = 0;
  for (const x of [a1, a2]) for (const y of [b1, b2]) {
    const c = h.opponent.get(key(x, y)) ?? 0;
    opp += c * c;
  }
  return PARTNER_WEIGHT * (p1 * p1 + p2 * p2) + OPPONENT_WEIGHT * opp;
}

/** Best of the three ways to split four players into two teams. */
function bestSplit(h: History, q: number[]): { game: GameSlot; cost: number } {
  const [w, x, y, z] = q;
  const options: GameSlot[] = [
    [w, x, y, z],
    [w, y, x, z],
    [w, z, x, y],
  ];
  let best = options[0];
  let bestCost = gameCost(h, best);
  for (const o of options.slice(1)) {
    const c = gameCost(h, o);
    if (c < bestCost) {
      best = o;
      bestCost = c;
    }
  }
  return { game: best, cost: bestCost };
}

function pickByes(players: number[], sit: number, h: History, rand: () => number, avoidRepeat: boolean): number[] {
  if (sit <= 0) return [];
  // Fewest byes sit first (keeps sit-outs fair); ties are random. When
  // avoidRepeat is set, players who just sat out go to the back of the queue.
  const ranked = shuffle(players, rand).sort((a, b) => {
    const byeDiff = (h.byes.get(a) ?? 0) - (h.byes.get(b) ?? 0);
    if (byeDiff) return byeDiff;
    return avoidRepeat ? Number(h.lastByes.has(a)) - Number(h.lastByes.has(b)) : 0;
  });
  return ranked.slice(0, sit);
}

/** Sitting out two rounds in a row is allowed, but only when it buys fresh partners. */
const BACK_TO_BACK_WEIGHT = 200;

function planRound(players: number[], courts: number, h: History, rand: () => number): Round {
  const g = gamesPerRound(players.length, courts);
  const sit = players.length - 4 * g;

  let best: { games: GameSlot[]; byes: number[]; cost: number } | null = null;
  const attempts = 30;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Each attempt re-draws sit-outs among equally fair candidates.
    const byes = pickByes(players, sit, h, rand, attempt % 2 === 0);
    const byeSet = new Set(byes);
    const order = shuffle(players.filter((p) => !byeSet.has(p)), rand);
    const groups = Array.from({ length: g }, (_, i) => order.slice(i * 4, i * 4 + 4));
    let splits = groups.map((q) => bestSplit(h, q));

    // Local search: swap players between groups while it lowers the cost.
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < g; i++) {
        for (let j = i + 1; j < g; j++) {
          for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
              const gi = groups[i].slice();
              const gj = groups[j].slice();
              [gi[x], gj[y]] = [gj[y], gi[x]];
              const si = bestSplit(h, gi);
              const sj = bestSplit(h, gj);
              if (si.cost + sj.cost < splits[i].cost + splits[j].cost) {
                groups[i] = gi;
                groups[j] = gj;
                splits = splits.slice();
                splits[i] = si;
                splits[j] = sj;
                improved = true;
              }
            }
          }
        }
      }
    }
    const cost =
      splits.reduce((s, x) => s + x.cost, 0) + BACK_TO_BACK_WEIGHT * byes.filter((p) => h.lastByes.has(p)).length;
    if (!best || cost < best.cost) best = { games: splits.map((s) => s.game), byes, cost };
    if (cost === 0) break;
  }
  return { games: best?.games ?? [], byes: best?.byes ?? [] };
}

/** Lower is better: heavily penalises repeat partners, lightly repeat opponents. */
function scheduleCost(rounds: Round[], previous: Round[]): number {
  const h = historyFrom([...previous, ...rounds]);
  let cost = 0;
  for (const c of h.partner.values()) cost += PARTNER_WEIGHT * (c - 1) * Math.max(0, c - 1);
  for (const c of h.opponent.values()) cost += OPPONENT_WEIGHT * c * c;
  return cost;
}

/**
 * Builds `rounds` new rounds for `players`, continuing on from `previous`.
 * Player ids are shuffled into table slots, so the same group gets a
 * different pairing order each night.
 */
export function generateSchedule(opts: ScheduleOptions): Round[] {
  const { players, courts, rounds, previous = [], seed = Date.now() } = opts;
  if (gamesPerRound(players.length, courts) === 0 || rounds <= 0) return [];
  // Greedy round-by-round planning can paint itself into a corner, so build
  // several complete schedules and keep the best one.
  const restarts = previous.length === 0 && tableRounds(players.length, courts) && rounds <= players.length ? 1 : 16;
  let best: { rounds: Round[]; cost: number } | null = null;
  for (let i = 0; i < restarts; i++) {
    const candidate = buildOnce(players, courts, rounds, previous, seed + i * 7919);
    const cost = scheduleCost(candidate, previous);
    if (!best || cost < best.cost) best = { rounds: candidate, cost };
  }
  return best!.rounds;
}

function buildOnce(players: number[], courts: number, rounds: number, previous: Round[], seed: number): Round[] {
  const rand = rng(seed);
  const h = historyFrom(previous);
  const out: Round[] = [];

  if (previous.length === 0) {
    const table = tableRounds(players.length, courts);
    if (table) {
      const slotToPlayer = shuffle(players, rand);
      const order = shuffle(table, rand);
      for (const r of order.slice(0, rounds)) {
        const mapped: Round = {
          // Shuffle court order too, so the table's fixed slot isn't always on court 1.
          games: shuffle(r.games, rand).map((g) => g.map((s) => slotToPlayer[s]) as GameSlot),
          byes: r.byes.map((s) => slotToPlayer[s]),
        };
        out.push(mapped);
        recordRound(h, mapped);
      }
    }
  }

  while (out.length < rounds) {
    const r = planRound(players, courts, h, rand);
    out.push(r);
    recordRound(h, r);
  }
  return out;
}

/** Summary numbers used by tests and the setup screen. */
export function scheduleStats(rounds: Round[], players: number[]) {
  const h = historyFrom(rounds);
  const pairs: number[] = [];
  const opps: number[] = [];
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      pairs.push(h.partner.get(key(players[i], players[j])) ?? 0);
      opps.push(h.opponent.get(key(players[i], players[j])) ?? 0);
    }
  const gamesEach = players.map((p) => h.games.get(p) ?? 0);
  const byesEach = players.map((p) => h.byes.get(p) ?? 0);
  return {
    maxPartnerRepeat: Math.max(0, ...pairs),
    repeatedPartnerPairs: pairs.filter((c) => c > 1).length,
    maxOpponent: Math.max(0, ...opps),
    minGames: Math.min(...gamesEach),
    maxGames: Math.max(...gamesEach),
    minByes: Math.min(...byesEach),
    maxByes: Math.max(...byesEach),
  };
}
