'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions';
import { Logo } from '@/components/ui';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="screen">
      <header className="band" style={{ alignItems: 'center', padding: '28px 16px 22px' }}>
        <h1 style={{ margin: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Logo />
        </h1>
      </header>
      <form action={action} className="section stack" style={{ paddingTop: 32 }}>
        <h2 className="h2">Crew only</h2>
        <p className="muted" style={{ margin: 0 }}>
          Enter the group passcode to get in. You&apos;ll stay signed in on this device.
        </p>
        <input name="passcode" type="password" className="input" placeholder="Passcode" autoFocus required aria-label="Passcode" />
        {state?.error && <div className="error">{state.error}</div>}
        <button type="submit" className="btn-yellow" disabled={pending}>
          {pending ? 'Checking…' : 'Let me in'}
        </button>
      </form>
    </main>
  );
}
