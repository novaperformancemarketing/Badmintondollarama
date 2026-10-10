/**
 * The running tab: everyone's results across every finished session, minus
 * money already handed over. Positive = owed money, negative = owes money.
 */
import { settleUp, type Transfer } from './money';
import { playerLines, type GameRecord } from './stats';

export interface PaymentRecord {
  fromId: number;
  toId: number;
  amountCents: number;
}

export function tabBalances(games: GameRecord[], paid: PaymentRecord[]): Map<number, number> {
  const balances = new Map<number, number>();
  for (const line of playerLines(games).values()) balances.set(line.playerId, line.netCents);
  for (const p of paid) {
    // Paying reduces what you owe; receiving reduces what you're owed.
    balances.set(p.fromId, (balances.get(p.fromId) ?? 0) + p.amountCents);
    balances.set(p.toId, (balances.get(p.toId) ?? 0) - p.amountCents);
  }
  for (const [id, cents] of balances) if (cents === 0) balances.delete(id);
  return balances;
}

/** The fewest payments that clear the whole tab. */
export function tabTransfers(balances: Map<number, number>): Transfer[] {
  return settleUp(balances).sort((a, b) => b.amountCents - a.amountCents);
}
