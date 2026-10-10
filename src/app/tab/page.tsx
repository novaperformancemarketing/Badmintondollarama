import { Badge, BottomNav, Money } from '@/components/ui';
import { RecordPaymentForm, TransferList, UndoPaymentButton } from '@/components/TabClient';
import { getTab, listPlayers, playerNames } from '@/lib/data';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function TabPage() {
  const [tab, names, roster] = await Promise.all([getTab(), playerNames(), listPlayers()]);
  const name = (id: number) => names.get(id) ?? '?';
  const owed = [...tab.balances].sort((a, b) => b[1] - a[1]);
  const outstanding = tab.transfers.reduce((s, t) => s + t.amountCents, 0);

  return (
    <main className="screen">
      <header className="band" style={{ padding: '18px 16px 18px' }}>
        <div className="band-row">
          <h1 className="title">The tab</h1>
          <Badge />
        </div>
        <div className="sub">
          {tab.transfers.length
            ? `${money(outstanding)} still to settle · nets out every finished session`
            : 'Everyone is square across every finished session'}
        </div>
      </header>

      <div className="cols">
        <section className="section">
          <div className="section-head">
            <h2 className="h2">Settle up</h2>
            <span className="tiny muted">Tap Paid when the money changes hands</span>
          </div>
          <TransferList
            transfers={tab.transfers.map((t) => ({ ...t, fromName: name(t.from), toName: name(t.to) }))}
          />
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">Balances</h2>
            <span className="tiny muted">After payments so far</span>
          </div>
          {owed.length === 0 ? (
            <div className="card pad small muted">Nobody is up or down right now.</div>
          ) : (
            <div className="card">
              <div className="table-head" style={{ gridTemplateColumns: '1fr auto' }}>
                <span>Player</span>
                <span className="right">Owed / owes</span>
              </div>
              {owed.map(([id, cents], i) => (
                <div
                  key={id}
                  className="table-row"
                  style={{ gridTemplateColumns: '1fr auto', borderRadius: i === owed.length - 1 ? '0 0 20px 20px' : 0 }}
                >
                  <strong>{name(id)}</strong>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="tiny muted">{cents > 0 ? 'is owed' : 'owes'}</span>
                    <Money cents={cents} style={{ fontSize: 17 }} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="cols">
        <section className="section">
          <div className="section-head">
            <h2 className="h2">Record a payment</h2>
            <span className="tiny muted">Partial payments too</span>
          </div>
          <RecordPaymentForm players={roster.map((p) => ({ id: p.id, name: p.name }))} />
        </section>

        <section className="section" style={{ paddingBottom: 16 }}>
          <h2 className="h2">Payment history</h2>
          {tab.payments.length === 0 ? (
            <div className="card pad small muted">No payments recorded yet.</div>
          ) : (
            <div className="card clip">
              {tab.payments.slice(0, 30).map((p) => {
                const label = `${name(p.fromId)} paid ${name(p.toId)} ${money(p.amountCents)}`;
                return (
                  <div key={p.id} className="table-row" style={{ gridTemplateColumns: '1fr auto', minHeight: 54 }}>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>
                        {name(p.fromId)} <span className="muted" style={{ fontWeight: 400 }}>paid</span> {name(p.toId)}{' '}
                        <span className="num pos">{money(p.amountCents)}</span>
                      </span>
                      <span className="tiny muted">
                        {p.createdAt.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                    <UndoPaymentButton id={p.id} label={label} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <BottomNav active="tab" />
    </main>
  );
}
