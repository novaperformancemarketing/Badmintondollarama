import { describe, expect, it } from 'vitest';
import type { GameRecord } from './stats';
import { tabBalances, tabTransfers } from './tab';

const NAV = 1;
const GAGAN = 2;
const GORDON = 3;
const NICK = 4;

const game = (sessionId: number, a: [number, number], b: [number, number], winner: 'A' | 'B', stakeCents = 100): GameRecord => ({
  sessionId,
  round: 1,
  court: 1,
  a1: a[0],
  a2: a[1],
  b1: b[0],
  b2: b[1],
  winner,
  stakeCents,
});

describe('running tab', () => {
  it('nets results across sessions so people who end up even owe nothing', () => {
    const games = [
      // Session 1: Nav + Gordon beat Gagan + Nick twice.
      game(1, [NAV, GORDON], [GAGAN, NICK], 'A'),
      game(1, [NAV, GORDON], [GAGAN, NICK], 'A'),
      // Session 2: Gagan + Gordon beat Nav + Nick twice.
      game(2, [GAGAN, GORDON], [NAV, NICK], 'A'),
      game(2, [GAGAN, GORDON], [NAV, NICK], 'A'),
    ];
    const balances = tabBalances(games, []);
    expect(balances.has(NAV)).toBe(false);
    expect(balances.has(GAGAN)).toBe(false);
    expect(balances.get(GORDON)).toBe(400);
    expect(balances.get(NICK)).toBe(-400);
    expect(tabTransfers(balances)).toEqual([{ from: NICK, to: GORDON, amountCents: 400 }]);
  });

  it('takes recorded payments off the tab, including partial ones', () => {
    const games = [game(1, [GORDON, NAV], [NICK, GAGAN], 'A'), game(1, [GORDON, GAGAN], [NICK, NAV], 'A')];
    // Gordon +2, Nick −2, Nav 0, Gagan 0.
    const partly = tabBalances(games, [{ fromId: NICK, toId: GORDON, amountCents: 100 }]);
    expect(partly.get(NICK)).toBe(-100);
    expect(partly.get(GORDON)).toBe(100);
    const done = tabBalances(games, [
      { fromId: NICK, toId: GORDON, amountCents: 100 },
      { fromId: NICK, toId: GORDON, amountCents: 100 },
    ]);
    expect(done.size).toBe(0);
    expect(tabTransfers(done)).toEqual([]);
  });

  it('always balances to zero', () => {
    const games = [game(1, [1, 2], [3, 4], 'A', 500), game(2, [1, 3], [2, 4], 'B', 100)];
    const balances = tabBalances(games, [{ fromId: 3, toId: 1, amountCents: 200 }]);
    expect([...balances.values()].reduce((s, c) => s + c, 0)).toBe(0);
  });
});
