'use client';

import { useActionState, useMemo, useState } from 'react';
import { createSession } from '@/app/actions';
import { Icon } from '@/components/ui';
import { gamesPerRound, suggestedRounds } from '@/lib/schedule';

interface Props {
  players: { id: number; name: string }[];
  preselected: number[];
}

type Label = 'A' | 'B';
/** `p:<id>` for saved players, `n:<name>` for people typed in here. */
type Key = string;

interface FormatState {
  courts: number;
  roundsOverride: number | null;
  stake: number;
}

const defaultFormat = (): FormatState => ({ courts: 2, roundsOverride: null, stake: 1 });

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SetupForm({ players, preselected }: Props) {
  const [state, formAction, pending] = useActionState(createSession, undefined);
  const [split, setSplit] = useState(false);
  const [assigned, setAssigned] = useState<Map<Key, Label>>(() => new Map(preselected.map((id) => [`p:${id}`, 'A'])));
  const [newNames, setNewNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [pairs, setPairs] = useState<[Key, Key][]>([]);
  const [pairDraft, setPairDraft] = useState<[Key, Key]>(['', '']);
  const [pairing, setPairing] = useState(false);
  const [formats, setFormats] = useState<Record<Label, FormatState>>({ A: defaultFormat(), B: defaultFormat() });

  const nameOf = useMemo(() => {
    const m = new Map<Key, string>(players.map((p) => [`p:${p.id}`, p.name]));
    for (const n of newNames) m.set(`n:${n}`, n);
    return m;
  }, [players, newNames]);

  const allKeys: Key[] = [...players.map((p) => `p:${p.id}`), ...newNames.map((n) => `n:${n}`)];
  const labels: Label[] = split ? ['A', 'B'] : ['A'];
  const members = (l: Label) => allKeys.filter((k) => assigned.get(k) === l);
  // Pairs only count while both people are in, and in the same bracket.
  const validPairs = pairs.filter(([a, b]) => assigned.has(a) && assigned.get(a) === assigned.get(b));
  const paired = new Set(validPairs.flat());
  const totalIn = allKeys.filter((k) => assigned.has(k)).length;

  const tap = (k: Key) => {
    setAssigned((prev) => {
      const next = new Map(prev);
      const cur = next.get(k);
      if (!split) {
        if (cur) next.delete(k);
        else next.set(k, 'A');
      } else if (!cur) next.set(k, 'A');
      else if (cur === 'A') next.set(k, 'B');
      else next.delete(k);
      return next;
    });
    setFormats((f) => ({ A: { ...f.A, roundsOverride: null }, B: { ...f.B, roundsOverride: null } }));
  };

  const setSplitMode = (on: boolean) => {
    setSplit(on);
    if (!on) setAssigned((prev) => new Map([...prev].map(([k]) => [k, 'A' as Label])));
  };

  const addDraft = () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const key = existing ? `p:${existing.id}` : `n:${name}`;
    if (!existing && !newNames.some((x) => x.toLowerCase() === name.toLowerCase())) setNewNames((prev) => [...prev, name]);
    setAssigned((prev) => new Map(prev).set(key, prev.get(key) ?? 'A'));
    setDraft('');
    setAdding(false);
  };

  const config = labels.map((l) => {
    const keys = members(l);
    const f = formats[l];
    const slots = keys.length - validPairs.filter(([a]) => assigned.get(a) === l).length;
    return {
      label: split ? l : null,
      courts: f.courts,
      rounds: f.roundsOverride ?? suggestedRounds(slots, f.courts),
      stakeCents: Math.round(f.stake * 100),
      members: keys.map((k) => (k.startsWith('p:') ? { id: Number(k.slice(2)) } : { name: k.slice(2) })),
      pairs: validPairs.filter(([a]) => assigned.get(a) === l).map(([a, b]) => [keys.indexOf(a), keys.indexOf(b)]),
    };
  });
  const ready = config.every((c) => c.members.length - c.pairs.length >= 4);

  const pairCandidates = allKeys.filter((k) => assigned.has(k) && !paired.has(k));

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <input type="hidden" name="playedOn" value={localToday()} />
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <section className="section" style={{ paddingTop: 20 }}>
        <div role="group" aria-label="Brackets" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, borderRadius: 99, padding: 4, background: '#eef5f0', border: '1px solid rgba(3,98,48,0.16)' }}>
          {[
            { on: false, label: 'One group' },
            { on: true, label: 'A + B brackets' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={split === o.on}
              onClick={() => setSplitMode(o.on)}
              style={{
                minHeight: 42,
                borderRadius: 99,
                border: 0,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                background: split === o.on ? 'var(--green-grad)' : 'transparent',
                color: split === o.on ? '#fff' : 'var(--green)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 18 }}>
        <div className="section-head">
          <h2 className="h2">Who&apos;s here</h2>
          <span className="num tag" style={{ borderRadius: 99, fontSize: 13 }}>
            {split ? `${members('A').length} A · ${members('B').length} B` : `${totalIn} IN`}
          </span>
        </div>
        {split && <span className="small muted">Tap once for A, twice for B, three times to take them out.</span>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allKeys.map((k) => {
            const l = assigned.get(k);
            return (
              <button
                key={k}
                type="button"
                className={`chip ${l === 'B' ? 'chip-b' : ''}`}
                aria-pressed={!!l}
                aria-label={`${nameOf.get(k)}${l ? (split ? `, ${l} bracket` : ', in') : ', out'}`}
                onClick={() => tap(k)}
              >
                <span className="initial">{split && l ? l : nameOf.get(k)!.charAt(0).toUpperCase()}</span>
                {nameOf.get(k)}
              </button>
            );
          })}
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

      <section className="section" style={{ paddingTop: 22 }}>
        <div className="section-head">
          <h2 className="h2">Shared spots</h2>
          <span className="tiny muted">Two people, one spot, alternate games</span>
        </div>
        {validPairs.map(([a, b]) => (
          <div key={`${a}-${b}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 8px 16px' }}>
            <span style={{ fontWeight: 700 }}>
              {nameOf.get(a)} <span style={{ color: 'var(--green)' }}>⇄</span> {nameOf.get(b)}
              {split && <span className="tiny muted"> · {assigned.get(a)} bracket</span>}
            </span>
            <button type="button" className="btn-ghost" style={{ width: 'auto', minHeight: 40, padding: '0 10px' }} onClick={() => setPairs(pairs.filter((p) => p[0] !== a || p[1] !== b))}>
              Remove
            </button>
          </div>
        ))}
        {pairing ? (
          <div className="card pad stack">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
              {[0, 1].map((i) => (
                <select
                  key={i}
                  className="input"
                  style={{ gridColumn: i === 0 ? 1 : 3, gridRow: 1 }}
                  value={pairDraft[i]}
                  aria-label={i === 0 ? 'First person' : 'Second person'}
                  onChange={(e) => setPairDraft(i === 0 ? [e.target.value, pairDraft[1]] : [pairDraft[0], e.target.value])}
                >
                  <option value="">Pick…</option>
                  {pairCandidates
                    .filter((k) => k !== pairDraft[1 - i] && (!pairDraft[1 - i] || assigned.get(k) === assigned.get(pairDraft[1 - i])))
                    .map((k) => (
                      <option key={k} value={k}>
                        {nameOf.get(k)}
                        {split ? ` (${assigned.get(k)})` : ''}
                      </option>
                    ))}
                </select>
              ))}
              <span style={{ gridColumn: 2, gridRow: 1, color: 'var(--green)', fontWeight: 900 }}>⇄</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-outline"
                disabled={!pairDraft[0] || !pairDraft[1]}
                onClick={() => {
                  setPairs([...pairs, pairDraft]);
                  setPairDraft(['', '']);
                  setPairing(false);
                }}
              >
                Share the spot
              </button>
              <button type="button" className="btn-ghost" style={{ width: 'auto' }} onClick={() => setPairing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="chip add" style={{ alignSelf: 'flex-start' }} disabled={pairCandidates.length < 2} onClick={() => setPairing(true)}>
            <Icon.Plus size={16} />
            Pair two people to share a spot
          </button>
        )}
      </section>

      {labels.map((l, i) => (
        <BracketFormat
          key={l}
          title={split ? `${l} bracket` : 'Format'}
          people={config[i].members.length}
          spots={config[i].members.length - config[i].pairs.length}
          format={formats[l]}
          onChange={(f) => setFormats((prev) => ({ ...prev, [l]: f }))}
        />
      ))}

      <div className="footer-actions">
        {state?.error && (
          <div className="error" role="alert">
            {state.error}
          </div>
        )}
        <button type="submit" className="btn-yellow" style={{ minHeight: 64, fontSize: 21 }} disabled={pending || !ready}>
          {pending ? 'Building schedule…' : split ? 'Generate both brackets' : 'Generate schedule'}
        </button>
        <div className="small muted" style={{ textAlign: 'center' }}>
          Players are shuffled into slots. Late arrivals can join mid-session.
        </div>
      </div>
    </form>
  );
}

function BracketFormat({
  title,
  people,
  spots,
  format,
  onChange,
}: {
  title: string;
  people: number;
  spots: number;
  format: FormatState;
  onChange: (f: FormatState) => void;
}) {
  const { courts, stake } = format;
  const g = gamesPerRound(spots, courts);
  const sit = g ? spots - 4 * g : 0;
  const suggested = suggestedRounds(spots, courts);
  const rounds = format.roundsOverride ?? suggested;
  const raw = spots ? (rounds * 4 * g) / spots : 0;
  const even = Math.abs(raw - Math.round(raw)) < 1e-9;
  const each = spots < 4 ? '–' : even ? String(Math.round(raw)) : `~${Math.round(raw)}`;
  const shared = people - spots;

  let hint: string;
  if (spots < 4) hint = 'Needs at least 4 spots for doubles.';
  else if (sit === 0 && rounds === spots - 1 && [4, 8, 12, 16].includes(spots))
    hint = 'Perfect round robin: every spot partners every other spot exactly once.';
  else if (even) {
    const sitsEach = (rounds * sit) / spots;
    hint =
      sit === 0
        ? 'Nobody sits out. Partners rotate so repeats are kept to a minimum.'
        : `Fair rotation: every spot sits out exactly ${sitsEach} ${sitsEach === 1 ? 'time' : 'times'} and plays ${each} games.`;
  } else hint = `Uneven: some spots get one more game than others. Try ${suggested} rounds to even it out.`;
  if (shared > 0 && spots >= 4) hint += ` ${shared} shared ${shared === 1 ? 'spot alternates' : 'spots alternate'} games.`;

  const set = (patch: Partial<FormatState>) => onChange({ ...format, ...patch });

  return (
    <section className="section" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2 className="h2">{title}</h2>
        <span className="tiny muted">
          {people} {people === 1 ? 'player' : 'players'}
          {shared > 0 ? ` · ${spots} spots` : ''}
        </span>
      </div>
      <div className="card">
        <div className="setting-row">
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <strong>Courts</strong>
            <span className="small muted">
              {g} {g === 1 ? 'game' : 'games'} per round
            </span>
          </span>
          <span className="stepper">
            <button type="button" aria-label="Fewer courts" disabled={courts <= 1} onClick={() => set({ courts: courts - 1, roundsOverride: null })}>
              −
            </button>
            <span className="num value">{courts}</span>
            <button type="button" className="plus" aria-label="More courts" disabled={courts >= 8} onClick={() => set({ courts: courts + 1, roundsOverride: null })}>
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
            <button type="button" aria-label="Fewer rounds" disabled={rounds <= 1} onClick={() => set({ roundsOverride: Math.max(1, rounds - 1) })}>
              −
            </button>
            <span className="num value">{rounds}</span>
            <button type="button" className="plus" aria-label="More rounds" disabled={rounds >= 40} onClick={() => set({ roundsOverride: rounds + 1 })}>
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
            <button type="button" aria-label="Lower stake" disabled={stake <= 0.25} onClick={() => set({ stake: Math.max(0.25, stake <= 1 ? stake - 0.25 : stake - 1) })}>
              −
            </button>
            <span className="num tag" style={{ fontSize: 18, minWidth: 56, textAlign: 'center' }}>
              ${Number.isInteger(stake) ? stake : stake.toFixed(2)}
            </span>
            <button type="button" className="plus" aria-label="Raise stake" disabled={stake >= 20} onClick={() => set({ stake: stake < 1 ? stake + 0.25 : stake + 1 })}>
              +
            </button>
          </span>
        </div>
      </div>

      <div className="glass-green sign stack" style={{ padding: 18, gap: 12 }}>
        <div className="grid-3">
          {[
            [each, shared ? 'games per spot' : 'games each'],
            [String(sit), 'sit out / round'],
            [spots >= 4 ? `$${Math.ceil(raw * stake)}` : '–', 'max win / loss'],
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
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>{hint}</div>
      </div>
    </section>
  );
}
