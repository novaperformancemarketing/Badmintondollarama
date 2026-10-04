import { describe, expect, it } from 'vitest';
import { generateSchedule } from './schedule';
import { activeSharers, activeSlots, assignPeople, shareState, slotMap, toSlotRound } from './slots';

const roster = [
  { id: 1, active: true, sharesWith: null },
  { id: 2, active: true, sharesWith: null },
  { id: 3, active: true, sharesWith: null },
  { id: 4, active: true, sharesWith: null },
  { id: 5, active: true, sharesWith: null },
  { id: 6, active: true, sharesWith: null },
  { id: 7, active: true, sharesWith: null },
  { id: 8, active: true, sharesWith: null },
  { id: 9, active: true, sharesWith: 8 }, // 9 shares 8's spot
];

describe('shared spots', () => {
  it('schedules slots, not people', () => {
    expect(activeSlots(roster)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(activeSharers(roster).get(8)).toBe(9);
  });

  it('alternates the two people across the slot’s games', () => {
    const slots = slotMap(roster);
    const rounds = generateSchedule({ players: activeSlots(roster), courts: 2, rounds: 7, seed: 5 });
    const people = assignPeople(rounds, activeSharers(roster), shareState([], slots));
    const sequence = people.flatMap((r) => r.games.flat()).filter((p) => p === 8 || p === 9);
    expect(sequence).toEqual([8, 9, 8, 9, 8, 9, 8]);
    // Nobody appears twice in a game, and the slot round robin is untouched.
    for (const r of people) for (const g of r.games) expect(new Set(g).size).toBe(4);
    expect(people.map((r) => toSlotRound(r, slots))).toEqual(rounds);
  });

  it('picks up the alternation from games already played', () => {
    const slots = slotMap(roster);
    const played = [{ games: [[9, 1, 2, 3]] as [number, number, number, number][], byes: [] }];
    const next = assignPeople(
      [{ games: [[8, 4, 5, 6]], byes: [] }],
      activeSharers(roster),
      shareState(played, slots),
    );
    expect(next[0].games[0][0]).toBe(8);
  });
});
