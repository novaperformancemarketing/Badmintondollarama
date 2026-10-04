/** Formats cents as a signed dollar amount, e.g. +$3, −$1.50, $0. */
export function signedMoney(cents: number): string {
  const sign = cents > 0 ? '+' : cents < 0 ? '−' : '';
  return `${sign}${money(Math.abs(cents))}`;
}

export function money(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const text = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  return `${cents < 0 ? '−' : ''}$${text}`;
}

export function moneyTone(cents: number): 'pos' | 'neg' | 'zero' {
  return cents > 0 ? 'pos' : cents < 0 ? 'neg' : 'zero';
}

export interface Transfer {
  from: number;
  to: number;
  amountCents: number;
}

/**
 * Settles a zero-sum set of balances with few transfers: the biggest
 * debtor repeatedly pays the biggest creditor. Exact matches are paired
 * first, which removes a transfer whenever two balances cancel out.
 */
export function settleUp(balances: Map<number, number>): Transfer[] {
  const debtors = [...balances].filter(([, c]) => c < 0).map(([id, c]) => ({ id, amt: -c }));
  const creditors = [...balances].filter(([, c]) => c > 0).map(([id, c]) => ({ id, amt: c }));
  const out: Transfer[] = [];

  for (const d of debtors) {
    const match = creditors.find((c) => c.amt === d.amt);
    if (match) {
      out.push({ from: d.id, to: match.id, amountCents: d.amt });
      d.amt = 0;
      match.amt = 0;
    }
  }

  const byAmt = (a: { amt: number }, b: { amt: number }) => b.amt - a.amt;
  for (;;) {
    const d = debtors.filter((x) => x.amt > 0).sort(byAmt)[0];
    const c = creditors.filter((x) => x.amt > 0).sort(byAmt)[0];
    if (!d || !c) break;
    const amt = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amountCents: amt });
    d.amt -= amt;
    c.amt -= amt;
  }
  return out;
}
