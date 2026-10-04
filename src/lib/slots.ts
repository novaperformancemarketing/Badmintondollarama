/**
 * Shared spots: two people can split one place in the schedule. The
 * scheduler only sees slots (identified by the spot owner's player id);
 * these helpers translate between slots and the people who actually play.
 */
import type { GameSlot, Round } from './schedule';

export interface RosterEntry {
  id: number;
  active: boolean;
  /** Set when this person shares the spot owned by that player. */
  sharesWith: number | null;
}

/** person id -> slot id (the spot owner's id). */
export function slotMap(roster: RosterEntry[]): Map<number, number> {
  return new Map(roster.map((r) => [r.id, r.sharesWith ?? r.id]));
}

/** slot id -> active sharer, for slots that are currently shared. */
export function activeSharers(roster: RosterEntry[]): Map<number, number> {
  const owners = new Set(roster.filter((r) => r.active && r.sharesWith === null).map((r) => r.id));
  const out = new Map<number, number>();
  for (const r of roster) if (r.active && r.sharesWith !== null && owners.has(r.sharesWith)) out.set(r.sharesWith, r.id);
  return out;
}

/** Active slots to schedule. */
export function activeSlots(roster: RosterEntry[]): number[] {
  return roster.filter((r) => r.active && r.sharesWith === null).map((r) => r.id);
}

export function toSlotRound(round: Round, slots: Map<number, number>): Round {
  const s = (p: number) => slots.get(p) ?? p;
  return {
    games: round.games.map((g) => g.map(s) as GameSlot),
    byes: round.byes.map(s),
  };
}

export interface ShareState {
  /** Games each person has played (or is down to play) so far. */
  played: Map<number, number>;
  /** Who filled each shared slot most recently. */
  last: Map<number, number>;
}

export function shareState(rounds: Round[], slots: Map<number, number>): ShareState {
  const played = new Map<number, number>();
  const last = new Map<number, number>();
  for (const r of rounds)
    for (const g of r.games)
      for (const p of g) {
        played.set(p, (played.get(p) ?? 0) + 1);
        last.set(slots.get(p) ?? p, p);
      }
  return { played, last };
}

/** Whoever has played fewer games; on a tie, whoever didn't play last; otherwise the owner. */
export function nextUp(owner: number, sharer: number, state: ShareState): number {
  const a = state.played.get(owner) ?? 0;
  const b = state.played.get(sharer) ?? 0;
  if (a !== b) return a < b ? owner : sharer;
  const last = state.last.get(owner);
  if (last === owner) return sharer;
  return owner;
}

/**
 * Turns slot rounds into the people who play them, alternating each shared
 * slot between its two people. `state` is updated as it goes.
 */
export function assignPeople(rounds: Round[], sharers: Map<number, number>, state: ShareState): Round[] {
  return rounds.map((r) => ({
    byes: r.byes,
    games: r.games.map(
      (g) =>
        g.map((slot) => {
          const sharer = sharers.get(slot);
          if (sharer === undefined) return slot;
          const person = nextUp(slot, sharer, state);
          state.played.set(person, (state.played.get(person) ?? 0) + 1);
          state.last.set(slot, person);
          return person;
        }) as GameSlot,
    ),
  }));
}
