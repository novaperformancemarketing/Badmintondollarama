'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteSession, reopenSession } from '@/app/actions';
import { Icon } from '@/components/ui';

export function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-yellow"
      style={{ minHeight: 64, fontSize: 20 }}
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: 'Smash Champs Dollarama', text });
            return;
          }
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Share sheet dismissed: nothing to do.
        }
      }}
    >
      <Icon.Share />
      {copied ? 'Copied for the group chat' : 'Share to group chat'}
    </button>
  );
}

export function SummaryActions({ sessionId, completed }: { sessionId: number; completed: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ gap: 4 }}>
      <Link href="/" className="btn-ghost">
        Done
      </Link>
      {completed ? (
        <button
          type="button"
          className="btn-ghost"
          style={{ color: 'var(--muted)', fontWeight: 600 }}
          disabled={pending}
          onClick={() => {
            if (confirm('Reopen this session to fix results? Settle-up payments will be recalculated when you end it again.'))
              start(() => reopenSession(sessionId));
          }}
        >
          Fix a result (reopen session)
        </button>
      ) : (
        <Link href={`/sessions/${sessionId}`} className="btn-ghost">
          Back to the live session
        </Link>
      )}
      <button
        type="button"
        className="btn-ghost"
        style={{ color: 'var(--neg)', fontWeight: 600 }}
        disabled={pending}
        onClick={() => {
          if (confirm('Delete this session and all its results? This cannot be undone.')) start(() => deleteSession(sessionId));
        }}
      >
        Delete session
      </button>
    </div>
  );
}
