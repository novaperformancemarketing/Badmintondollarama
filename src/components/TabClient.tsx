'use client';

import { useActionState, useEffect, useOptimistic, useRef, useTransition } from 'react';
import { markPaid, recordPayment, undoPayment } from '@/app/actions';
import { money } from '@/lib/money';

export interface NamedTransfer {
  from: number;
  to: number;
  amountCents: number;
  fromName: string;
  toName: string;
}

const key = (t: { from: number; to: number; amountCents: number }) => `${t.from}-${t.to}-${t.amountCents}`;

/** Suggested payments, each with a one-tap "Paid" button. */
export function TransferList({ transfers }: { transfers: NamedTransfer[] }) {
  const [, start] = useTransition();
  const [shown, hide] = useOptimistic(transfers, (list, k: string) => list.filter((t) => key(t) !== k));

  if (shown.length === 0) {
    return (
      <div className="notice" style={{ justifyContent: 'center', fontWeight: 700 }}>
        All square! Nobody owes anything.
      </div>
    );
  }
  return (
    <div className="card clip">
      {shown.map((t) => (
        <div key={key(t)} className="table-row" style={{ gridTemplateColumns: '1fr auto auto', minHeight: 60, gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {t.fromName} <span className="muted" style={{ fontWeight: 400 }}>pays</span> {t.toName}
          </span>
          <span className="tag" style={{ fontSize: 17 }}>
            {money(t.amountCents)}
          </span>
          <button
            type="button"
            className="btn-outline"
            style={{ minHeight: 40, padding: '0 14px' }}
            aria-label={`Mark ${t.fromName} paid ${t.toName} ${money(t.amountCents)}`}
            onClick={() =>
              start(async () => {
                hide(key(t));
                await markPaid(t.from, t.to, t.amountCents);
              })
            }
          >
            Paid
          </button>
        </div>
      ))}
    </div>
  );
}

/** Record any payment by hand, e.g. someone paying part of what they owe. */
export function RecordPaymentForm({ players }: { players: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card pad stack">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
        <select name="fromId" className="input" defaultValue="" required aria-label="Who paid">
          <option value="">Who paid…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="small muted">paid</span>
        <select name="toId" className="input" defaultValue="" required aria-label="Who they paid">
          <option value="">…who</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input name="amount" className="input" inputMode="decimal" placeholder="$ amount" required aria-label="Amount in dollars" />
        <button type="submit" className="btn-outline" disabled={pending} style={{ flex: 'none' }}>
          {pending ? 'Saving…' : 'Record'}
        </button>
      </div>
      {state?.error && <div className="error">{state.error}</div>}
    </form>
  );
}

export function UndoPaymentButton({ id, label }: { id: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ width: 'auto', minHeight: 40, padding: '0 8px', color: 'var(--neg)' }}
      disabled={pending}
      aria-label={`Undo ${label}`}
      onClick={() => {
        if (confirm(`Undo "${label}"? It goes back on the tab.`)) start(() => undoPayment(id));
      }}
    >
      Undo
    </button>
  );
}
