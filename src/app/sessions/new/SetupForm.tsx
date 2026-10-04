'use client';

import { useActionState, useMemo, useState } from 'react';
import { createSession } from '@/app/actions';
import { Icon } from '@/components/ui';
import { gamesPerRound, suggestedRounds } from '@/lib/schedule';

interface Props {
  players: { id: number; name: string }[];
  preselected: number[];
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SetupForm({ players, preselected }: Props) {
  const [state, formAction, pending] = useActionState(createSession, undefined);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(preselected));
  const [newNames, setNewNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [courts, setCourts] = useState(2);
  const [roundsOverride, setRoundsOverride] = useState<number | null>(null);
  const [stake, setStake] = useState(1);

  const n = selected.size + newNames.length;
  const g = gamesPerRound(n, courts);
  const sit = g ? n - 4 * g : 0;
  const suggested = suggestedRounds(n, courts);
  const rounds = roundsOverride ?? suggested;

  const summary = useMemo(() => {
    if (n < 4) return { each: '–', hint: 'Pick at least 4 players for doubles.' };
    const raw = (rounds * 4 * g) / n;
    const even = Math.abs(raw - Math.round(raw)) < 1e-9;
    const each = even ? String(Math.round(raw)) : `~${Math.round(raw)}`;
    let hint: string;
    if (sit === 0 && n % 4 === 0 && rounds === n - 1 && [4, 8, 12, 16].includes(n)) {
      hint = 'Perfect round robin: everyone partners with everyone exactly once and faces each player twice.';
    } else if (even) {
      const sitsEach = (rounds * sit) / n;
      hint =
        sit === 0
          ? 'Nobody sits out. Partners rotate so repeats are kept to a minimum.'
          : `Fair rotation: everyone sits out exactly ${sitsEach} ${sitsEach === 1 ? 'time' : 'times'} and plays ${each} games.`;
    } else {
      hint = `Uneven: some players get one more game than others. Try ${suggested} rounds to even it out.`;
    }
    return { each, hint, max: Math.ceil(raw) };
  }, [n, g, sit, rounds, suggested]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRoundsOverride(null);
  };

  const addDraft = () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSelected((prev) => new Set(prev).add(existing.id));
    } else if (!newNames.some((x) => x.toLowerCase() === name.toLowerCase())) {
      setNewNames((prev) => [...prev, name]);
    }
    setDraft('');
    setAdding(false);
    setRoundsOverride(null);
  };

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <input type="hidden" name="playedOn" value={localToday()} />
      <input type="hidden" name="courts" value={courts} />
      <input type="hidden" name="rounds" value={rounds} />
      <input type="hidden" name="stake" value={stake} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="player" value={id} />
      ))}
      {newNames.map((name) => (
        <input key={name} type="hidden" name="newName" value={name} />
      ))}

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="section-head">
          <h2 className="h2">Who&apos;s here</h2>
          <span className="num tag" style={{ borderRadius: 99, fontSize: 13 }}>
            {n} IN
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {players.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={selected.has(p.id)} onClick={() => toggle(p.id)}>
              <span className="initial">{p.name.charAt(0).toUpperCase()}</span>
              {p.name}
            </button>
          ))}
          {newNames.map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              aria-pressed
              onClick={() => setNewNames((prev) => prev.filter((x) => x !== name))}
              title="New player, tap to remove"
            >
              <span className="initial">{name.charAt(0).toUpperCase()}</span>
              {name}
            </button>
          ))}
          {adding ? (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                className="input"
                autoFocus
                placeholder="New player name"
                value={draft}
                maxLength={40}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDraft();
                  }
                }}
                aria-label="New player name"
              />
              <button type="button" className="btn-outline" onClick={addDraft}>
                Add
              </button>
            </div>
          ) : (
            <button type="button" className="chip add" onClick={() => setAdding(true)}>
              <Icon.Plus size={16} />
              Add player
            </button>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <h2 className="h2">Format</h2>
        <div className="card">
          <div className="setting-row">
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>Courts</strong>
              <span className="small muted">
                {g} {g === 1 ? 'game' : 'games'} per round
              </span>
            </span>
            <span className="stepper">
              <button type="button" aria-label="Fewer courts" disabled={courts <= 1} onClick={() => (setCourts(courts - 1), setRoundsOverride(null))}>
                −
              </button>
              <span className="num value">{courts}</span>
              <button type="button" className="plus" aria-label="More courts" disabled={courts >= 8} onClick={() => (setCourts(courts + 1), setRoundsOverride(null))}>
                +
              </button>
            </span>
          </div>
          <div className="setting-row">
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>Rounds</strong>
              <span className="small muted">Suggested: {suggested || '–'}</span>
            </span>
            <span className="stepper">
              <button type="button" aria-label="Fewer rounds" disabled={rounds <= 1} onClick={() => setRoundsOverride(Math.max(1, rounds - 1))}>
                −
              </button>
              <span className="num value">{rounds}</span>
              <button type="button" className="plus" aria-label="More rounds" disabled={rounds >= 40} onClick={() => setRoundsOverride(rounds + 1)}>
                +
              </button>
            </span>
          </div>
          <div className="setting-row">
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>Stake</strong>
              <span className="small muted">Per player, per game</span>
            </span>
            <span className="stepper">
              <button type="button" aria-label="Lower stake" disabled={stake <= 0.25} onClick={() => setStake(Math.max(0.25, stake <= 1 ? stake - 0.25 : stake - 1))}>
                −
              </button>
              <span className="num tag" style={{ fontSize: 18, minWidth: 56, textAlign: 'center' }}>
                ${Number.isInteger(stake) ? stake : stake.toFixed(2)}
              </span>
              <button type="button" className="plus" aria-label="Raise stake" disabled={stake >= 20} onClick={() => setStake(stake < 1 ? stake + 0.25 : stake + 1)}>
                +
              </button>
            </span>
          </div>
        </div>

        <div className="glass-green sign stack" style={{ padding: 18, gap: 12 }}>
          <div className="grid-3">
            {[
              [summary.each, 'games each'],
              [String(sit), 'sit out / round'],
              [n >= 4 ? `$${Math.ceil(((rounds * 4 * g) / n) * stake)}` : '–', 'max win / loss'],
            ].map(([v, l]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="num" style={{ fontSize: 30, color: 'var(--yellow)', lineHeight: 1 }}>
                  {v}
                </span>
                <span className="tiny" style={{ color: 'var(--on-green-muted)' }}>
                  {l}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>{summary.hint}</div>
        </div>
      </section>

      <div className="footer-actions">
        {state?.error && (
          <div className="error" role="alert">
            {state.error}
          </div>
        )}
        <button type="submit" className="btn-yellow" style={{ minHeight: 64, fontSize: 21 }} disabled={pending || n < 4}>
          {pending ? 'Building schedule…' : 'Generate schedule'}
        </button>
        <div className="small muted" style={{ textAlign: 'center' }}>
          Players are shuffled into slots. Late arrivals can join mid-session.
        </div>
      </div>
    </form>
  );
}
