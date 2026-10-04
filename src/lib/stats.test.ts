import { describe, expect, it } from 'vitest';
import {
  cumulativeSeries,
  netBySession,
  opponentLines,
  partnerLines,
  playerLines,
  sessionStories,
  type GameRecord,
} from './stats';

const g = (sessionId: number, round: number, a: [number, number], b: [number, number], winner: 'A' | 'B' | null): GameRecord => ({
  sessionId,
  round,
  court: 1,
  a1: a[0],
  a2: a[1],
  b1: b[0],
  b2: b[1],
  winner,
  stakeCents: 100,
});

const games = [
  g(1, 1, [1, 2], [3, 4], 'A'),
  g(1, 2, [1, 3], [2, 4], 'A'),
  g(1, 3, [1, 4], [2, 3], 'B'),
  g(2, 1, [1, 2], [3, 4], 'B'),
  g(2, 2, [1, 3], [2, 4], null), // unplayed games never count
];

describe('playerLines', () => {
  it('tallies wins, losses, money and sessions, and is zero-sum', () => {
    const lines = playerLines(games);
    expect(lines.get(1)).toMatchObject({ wins: 2, losses: 2, netCents: 0, sessions: 2 });
    expect(lines.get(4)).toMatchObject({ wins: 1, losses: 3, netCents: -200 });
    const total = [...lines.values()].reduce((s, l) => s + l.netCents, 0);
    expect(total).toBe(0);
  });
});

describe('partner and opponent lines', () => {
  it('reports results with each partner', () => {
    const p = partnerLines(games, 1);
    expect(p.find((l) => l.otherId === 3)).toMatchObject({ wins: 1, losses: 0, netCents: 100 });
    expect(p.find((l) => l.otherId === 2)).toMatchObject({ wins: 1, losses: 1, netCents: 0 });
  });

  it('reports head-to-head against each opponent', () => {
    const o = opponentLines(games, 1);
    expect(o.find((l) => l.otherId === 4)).toMatchObject({ wins: 2, losses: 1 });
  });
});

describe('cumulative series', () => {
  it('builds a running total per session', () => {
    const per = netBySession(games, [1, 2]);
    expect(cumulativeSeries(per, 2)).toEqual([100, 0]);
    expect(cumulativeSeries(per, 3)).toEqual([100, 200]);
  });
});

describe('sessionStories', () => {
  it('finds a hot start and a rough night', () => {
    const s = [
      g(1, 1, [1, 2], [3, 4], 'A'),
      g(1, 2, [1, 3], [2, 4], 'A'),
      g(1, 3, [1, 4], [2, 3], 'A'),
    ];
    const stories = sessionStories(s);
    expect(stories[0]).toMatchObject({ label: 'Hot start', playerId: 1 });
  });
});
