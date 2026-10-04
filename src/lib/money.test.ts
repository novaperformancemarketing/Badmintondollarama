import { describe, expect, it } from 'vitest';
import { money, settleUp, signedMoney } from './money';

describe('money formatting', () => {
  it('formats whole and fractional dollars with signs', () => {
    expect(signedMoney(300)).toBe('+$3');
    expect(signedMoney(-150)).toBe('−$1.50');
    expect(signedMoney(0)).toBe('$0');
    expect(money(2500)).toBe('$25');
  });
});

describe('settleUp', () => {
  it('clears every balance and never moves more money than owed', () => {
    const balances = new Map([
      [1, 300], [2, 300], [3, 300], [4, 300],
      [5, -100], [6, -100], [7, -500], [8, -500],
    ]);
    const transfers = settleUp(balances);
    const net = new Map<number, number>();
    for (const t of transfers) {
      net.set(t.from, (net.get(t.from) ?? 0) - t.amountCents);
      net.set(t.to, (net.get(t.to) ?? 0) + t.amountCents);
    }
    for (const [id, c] of balances) expect(net.get(id) ?? 0).toBe(c);
    expect(transfers.length).toBeLessThanOrEqual(7);
  });

  it('pairs exact matches directly', () => {
    const transfers = settleUp(new Map([[1, 200], [2, -200], [3, 500], [4, -500]]));
    expect(transfers).toHaveLength(2);
  });

  it('returns nothing when everyone is square', () => {
    expect(settleUp(new Map([[1, 0], [2, 0]]))).toEqual([]);
  });
});
