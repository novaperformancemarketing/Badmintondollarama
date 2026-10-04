import { describe, expect, it } from 'vitest';
import { gamesPerRound, generateSchedule, scheduleStats, suggestedRounds } from './schedule';

const ids = (n: number) => Array.from({ length: n }, (_, i) => 101 + i);

function validate(rounds: ReturnType<typeof generateSchedule>, players: number[], courts: number) {
  for (const r of rounds) {
    const seen = [...r.games.flat(), ...r.byes];
    expect(new Set(seen).size).toBe(seen.length); // nobody twice in a round
    expect(seen.sort()).toEqual(players.slice().sort()); // everyone accounted for
    expect(r.games.length).toBe(gamesPerRound(players.length, courts));
  }
}

describe('suggestedRounds', () => {
  it('matches the round robin and fair sit-out rotations', () => {
    expect(suggestedRounds(8, 2)).toBe(7);
    expect(suggestedRounds(10, 2)).toBe(5);
    expect(suggestedRounds(9, 2)).toBe(9);
    expect(suggestedRounds(12, 2)).toBe(6);
    expect(suggestedRounds(12, 3)).toBe(11);
    expect(suggestedRounds(3, 2)).toBe(0);
  });
});

describe('balanced tables', () => {
  for (const [n, courts, perfectOpponents] of [
    [4, 1, true],
    [5, 1, false],
    [8, 2, true],
    [9, 2, false],
    [12, 3, true],
    [13, 3, true],
    [16, 4, true],
    [17, 4, true],
  ] as const) {
    it(`${n} players on ${courts} court(s): everyone partners everyone exactly once`, () => {
      const players = ids(n);
      const rounds = generateSchedule({ players, courts, rounds: suggestedRounds(n, courts), seed: 7 });
      validate(rounds, players, courts);
      const s = scheduleStats(rounds, players);
      expect(s.maxPartnerRepeat).toBe(1);
      expect(s.repeatedPartnerPairs).toBe(0);
      expect(s.minGames).toBe(s.maxGames);
      expect(s.minByes).toBe(s.maxByes);
      if (perfectOpponents) expect(s.maxOpponent).toBe(2);
    });
  }
});

describe('search-based schedules', () => {
  for (let n = 4; n <= 20; n++) {
    for (const courts of [1, 2, 3]) {
      const rounds = suggestedRounds(n, courts);
      if (!rounds) continue;
      it(`${n} players, ${courts} court(s), ${rounds} rounds: fair sit-outs, valid rounds`, () => {
        const players = ids(n);
        const sched = generateSchedule({ players, courts, rounds, seed: n * 31 + courts });
        validate(sched, players, courts);
        const s = scheduleStats(sched, players);
        expect(s.maxByes - s.minByes).toBeLessThanOrEqual(1);
        expect(s.maxGames - s.minGames).toBeLessThanOrEqual(1);
        // Partners only repeat once every pairing has been used at least once.
        const partnerSlots = sched.length * gamesPerRound(n, courts) * 2;
        const pairs = (n * (n - 1)) / 2;
        if (partnerSlots <= pairs) expect(s.maxPartnerRepeat).toBeLessThanOrEqual(1);
      });
    }
  }

  it('10 players on 2 courts sit out exactly once each over 5 rounds', () => {
    const players = ids(10);
    const s = scheduleStats(generateSchedule({ players, courts: 2, rounds: 5, seed: 3 }), players);
    expect([s.minByes, s.maxByes]).toEqual([1, 1]);
    expect([s.minGames, s.maxGames]).toEqual([4, 4]);
    expect(s.maxPartnerRepeat).toBe(1);
  });
});

describe('rebuilding mid-session', () => {
  it('continues from played rounds without repeating partners for a late arrival', () => {
    const players = ids(8);
    const played = generateSchedule({ players, courts: 2, rounds: 3, seed: 11 });
    const withLate = [...players, 999];
    const rest = generateSchedule({ players: withLate, courts: 2, rounds: 4, previous: played, seed: 12 });
    validate(rest, withLate, 2);
    const all = [...played, ...rest];
    const s = scheduleStats(all, withLate);
    expect(s.maxPartnerRepeat).toBe(1);
    // The late arrival should not sit out more than once in the remaining rounds.
    expect(rest.filter((r) => r.byes.includes(999)).length).toBeLessThanOrEqual(1);
  });
});
