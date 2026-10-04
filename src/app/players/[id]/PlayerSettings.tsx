'use client';

import { useActionState, useTransition } from 'react';
import { renamePlayer, setPlayerArchived } from '@/app/actions';

export default function PlayerSettings({ id, name, archived }: { id: number; name: string; archived: boolean }) {
  const [state, action, pending] = useActionState(renamePlayer, undefined);
  const [busy, start] = useTransition();
  return (
    <section className="section" style={{ paddingTop: 28 }}>
      <details>
        <summary className="small muted" style={{ cursor: 'pointer', fontWeight: 600 }}>
          Edit player
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <form action={action} style={{ display: 'flex', gap: 8 }}>
            <input type="hidden" name="id" value={id} />
            <input name="name" className="input" defaultValue={name} maxLength={40} required aria-label="Player name" />
            <button type="submit" className="btn-outline" disabled={pending} style={{ flex: 'none' }}>
              Rename
            </button>
          </form>
          {state?.error && <div className="error">{state.error}</div>}
          <button
            type="button"
            className={archived ? 'btn-outline' : 'btn-danger'}
            disabled={busy}
            onClick={() => start(() => setPlayerArchived(id, !archived))}
          >
            {archived ? 'Bring back to the roster' : 'Retire from the roster (keeps history)'}
          </button>
        </div>
      </details>
    </section>
  );
}
