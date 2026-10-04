'use server';

import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, schema, type Db } from '@/db';
import { AUTH_COOKIE, passcodeToken } from '@/lib/auth';
import { getSessionDetail, toRounds, type SessionDetail } from '@/lib/data';
import { settleUp } from '@/lib/money';
import { generateSchedule, gamesPerRound, type Round } from '@/lib/schedule';
import { activeSharers, activeSlots, assignPeople, nextUp, shareState, slotMap, toSlotRound } from '@/lib/slots';

const { players, sessions, sessionPlayers, games, byes, payments } = schema;

export type FormState = { error?: string } | undefined;

/* ---------- Access ---------- */

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const expected = process.env.APP_PASSCODE;
  const given = String(form.get('passcode') ?? '').trim();
  if (expected && given !== expected) return { error: 'That passcode is not right.' };
  if (expected) {
    (await cookies()).set(AUTH_COOKIE, await passcodeToken(expected), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  redirect('/');
}

/* ---------- Players ---------- */

function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

async function findOrCreatePlayer(db: Db, name: string): Promise<number> {
  const [existing] = await db.select().from(players).where(eq(players.name, name));
  if (existing) {
    if (existing.archived) await db.update(players).set({ archived: false }).where(eq(players.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(players).values({ name }).returning({ id: players.id });
  return row.id;
}

export async function addPlayer(_: FormState, form: FormData): Promise<FormState> {
  const name = cleanName(form.get('name'));
  if (!name) return { error: 'Enter a name.' };
  const db = await getDb();
  await findOrCreatePlayer(db, name);
  revalidatePath('/players');
  revalidatePath('/sessions/new');
  return {};
}

export async function renamePlayer(_: FormState, form: FormData): Promise<FormState> {
  const id = Number(form.get('id'));
  const name = cleanName(form.get('name'));
  if (!name) return { error: 'Enter a name.' };
  const db = await getDb();
  const [clash] = await db.select().from(players).where(eq(players.name, name));
  if (clash && clash.id !== id) return { error: `${name} already exists.` };
  await db.update(players).set({ name }).where(eq(players.id, id));
  revalidatePath('/', 'layout');
  return {};
}

export async function setPlayerArchived(id: number, archived: boolean) {
  const db = await getDb();
  await db.update(players).set({ archived }).where(eq(players.id, id));
  revalidatePath('/players');
  revalidatePath('/sessions/new');
}

/* ---------- Sessions ---------- */

async function insertRounds(db: Db, sessionId: number, startRound: number, rounds: Round[]) {
  const gameRows = rounds.flatMap((r, i) =>
    r.games.map(([a1, a2, b1, b2], court) => ({
      sessionId,
      round: startRound + i,
      court: court + 1,
      a1,
      a2,
      b1,
      b2,
    })),
  );
  const byeRows = rounds.flatMap((r, i) => r.byes.map((playerId) => ({ sessionId, round: startRound + i, playerId })));
  if (gameRows.length) await db.insert(games).values(gameRows);
  if (byeRows.length) await db.insert(byes).values(byeRows);
}

/** What the setup screen sends: one entry per bracket. */
interface BracketConfig {
  label: string | null;
  courts: number;
  rounds: number;
  stakeCents: number;
  /** Players by id, or by name for people typed in on the setup screen. */
  members: { id?: number; name?: string }[];
  /** Index pairs into `members`: [spot owner, sharer]. */
  pairs: [number, number][];
}

export async function createSession(_: FormState, form: FormData): Promise<FormState> {
  const db = await getDb();
  let configs: BracketConfig[];
  try {
    configs = JSON.parse(String(form.get('config') ?? '[]'));
  } catch {
    return { error: 'Something went wrong reading the setup. Try again.' };
  }
  if (!Array.isArray(configs) || configs.length === 0 || configs.length > 2) return { error: 'Set up one or two brackets.' };
  const playedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(form.get('playedOn')))
    ? String(form.get('playedOn'))
    : new Date().toISOString().slice(0, 10);

  // Validate everything before writing anything.
  const seen = new Set<string>();
  for (const c of configs) {
    const name = c.label ? `${c.label} bracket` : 'This session';
    const slots = c.members.length - c.pairs.length;
    if (slots < 4) return { error: `${name} needs at least 4 spots for doubles.` };
    if (gamesPerRound(slots, Math.max(1, c.courts)) === 0) return { error: `${name} needs more players.` };
    for (const m of c.members) {
      const key = m.id ? `id:${m.id}` : `name:${cleanName(m.name).toLowerCase()}`;
      if (seen.has(key)) return { error: 'Someone is in both brackets.' };
      seen.add(key);
    }
    const paired = c.pairs.flat();
    if (new Set(paired).size !== paired.length || paired.some((i) => i < 0 || i >= c.members.length))
      return { error: 'Each person can only share one spot.' };
  }

  const groupKey = configs.length > 1 ? crypto.randomUUID() : null;
  const created: number[] = [];
  for (const c of configs) {
    const ids: number[] = [];
    for (const m of c.members) ids.push(m.id ? Number(m.id) : await findOrCreatePlayer(db, cleanName(m.name)));
    const sharesWith = new Map<number, number>(c.pairs.map(([owner, sharer]) => [ids[sharer], ids[owner]]));
    const courts = Math.max(1, Math.min(8, Math.round(c.courts)));
    const roundCount = Math.max(1, Math.min(40, Math.round(c.rounds)));
    const stakeCents = Math.max(25, Math.min(10000, Math.round(c.stakeCents) || 100));

    const [session] = await db
      .insert(sessions)
      .values({ playedOn, courts, stakeCents, bracket: c.label, groupKey })
      .returning({ id: sessions.id });
    const roster = ids.map((playerId) => ({ id: playerId, active: true, sharesWith: sharesWith.get(playerId) ?? null }));
    await db
      .insert(sessionPlayers)
      .values(roster.map((r) => ({ sessionId: session.id, playerId: r.id, sharesWith: r.sharesWith })));
    const slotRounds = generateSchedule({ players: activeSlots(roster), courts, rounds: roundCount });
    const people = assignPeople(slotRounds, activeSharers(roster), shareState([], slotMap(roster)));
    await insertRounds(db, session.id, 1, people);
    created.push(session.id);
  }

  revalidatePath('/', 'layout');
  redirect(`/sessions/${created[0]}`);
}

/** The round on court: the first one with an unfinished game. */
function currentRound(detail: SessionDetail): number {
  const open = detail.games.filter((g) => !g.winner).map((g) => g.round);
  return open.length ? Math.min(...open) : Infinity;
}

/**
 * Re-plans every round after the one on court for the current roster,
 * keeping already-played rounds as history so partners stay fresh.
 */
async function rebuildFuture(db: Db, sessionId: number, extraRounds = 0) {
  const detail = await getSessionDetail(sessionId);
  if (!detail || detail.session.status !== 'active') return;
  const rounds = toRounds(detail);
  const lockThrough = currentRound(detail);
  const kept = [...rounds].filter(([r]) => r <= lockThrough).map(([, round]) => round);
  const futureCount = [...rounds.keys()].filter((r) => r > lockThrough).length + extraRounds;
  const lastKept = [...rounds.keys()].filter((r) => r <= lockThrough).reduce((m, r) => Math.max(m, r), 0);

  await db.delete(games).where(and(eq(games.sessionId, sessionId), gt(games.round, lastKept)));
  await db.delete(byes).where(and(eq(byes.sessionId, sessionId), gt(byes.round, lastKept)));

  const slots = slotMap(detail.roster);
  const keptSlots = kept.map((r) => toSlotRound(r, slots));
  const next = generateSchedule({
    players: activeSlots(detail.roster),
    courts: detail.session.courts,
    rounds: futureCount,
    previous: keptSlots,
  });
  await insertRounds(db, sessionId, lastKept + 1, assignPeople(next, activeSharers(detail.roster), shareState(kept, slots)));
}

/** Re-runs the alternation for a shared spot over its unplayed games after `afterRound`. */
async function realternate(db: Db, sessionId: number, slot: number, afterRound: number) {
  const detail = await getSessionDetail(sessionId);
  if (!detail) return;
  const sharer = activeSharers(detail.roster).get(slot);
  const people = sharer === undefined ? [slot] : [slot, sharer];
  const slots = slotMap(detail.roster);
  const isSlot = (p: number) => slots.get(p) === slot;
  const settled = detail.games.filter((g) => g.round <= afterRound || g.winner);
  const state = shareState(
    settled.map((g) => ({ games: [[g.a1, g.a2, g.b1, g.b2]], byes: [] })),
    slots,
  );
  const upcoming = detail.games.filter((g) => g.round > afterRound && !g.winner).sort((a, b) => a.round - b.round || a.court - b.court);
  for (const g of upcoming) {
    const seats = (['a1', 'a2', 'b1', 'b2'] as const).filter((k) => isSlot(g[k]));
    if (!seats.length) continue;
    const person = people.length === 2 ? nextUp(slot, people[1], state) : slot;
    state.played.set(person, (state.played.get(person) ?? 0) + 1);
    state.last.set(slot, person);
    if (g[seats[0]] !== person) await db.update(games).set({ [seats[0]]: person }).where(eq(games.id, g.id));
  }
}

export async function setWinner(gameId: number, winner: 'A' | 'B' | null) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, game.sessionId));
  if (!session || session.status !== 'active') return;
  await db.update(games).set({ winner, updatedAt: new Date() }).where(eq(games.id, gameId));
  revalidatePath(`/sessions/${game.sessionId}`);
}

/** Swap who fills a shared spot in one game; later games keep alternating from there. */
export async function swapSharedSpot(gameId: number, outId: number) {
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game || game.winner) return;
  const detail = await getSessionDetail(game.sessionId);
  if (!detail || detail.session.status !== 'active') return;
  const slot = slotMap(detail.roster).get(outId) ?? outId;
  const sharer = activeSharers(detail.roster).get(slot);
  if (sharer === undefined) return;
  const inId = outId === slot ? sharer : slot;
  const seat = (['a1', 'a2', 'b1', 'b2'] as const).find((k) => game[k] === outId);
  if (!seat) return;
  await db.update(games).set({ [seat]: inId, updatedAt: new Date() }).where(eq(games.id, gameId));
  await realternate(db, game.sessionId, slot, game.round);
  revalidatePath(`/sessions/${game.sessionId}`);
}

export async function addLatePlayer(_: FormState, form: FormData): Promise<FormState> {
  const sessionId = Number(form.get('sessionId'));
  const db = await getDb();
  const name = cleanName(form.get('name'));
  const picked = Number(form.get('playerId'));
  const playerId = name ? await findOrCreatePlayer(db, name) : picked;
  if (!playerId) return { error: 'Pick a player or type a new name.' };
  const shareWith = Number(form.get('shareWith')) || null;
  const current = await getSessionDetail(sessionId);
  if (!current || current.session.status !== 'active') return { error: 'This session has ended.' };
  if (current.roster.some((r) => r.id === playerId && r.active)) return { error: 'They are already playing tonight.' };
  if (shareWith && !activeSlots(current.roster).includes(shareWith)) return { error: 'That spot is not available to share.' };
  if (shareWith && activeSharers(current.roster).has(shareWith)) return { error: 'That spot is already shared.' };

  const [row] = await db
    .select()
    .from(sessionPlayers)
    .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
  const values = { active: true, sharesWith: shareWith };
  if (row) {
    await db
      .update(sessionPlayers)
      .set(values)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
  } else {
    await db.insert(sessionPlayers).values({ sessionId, playerId, ...values });
  }

  if (shareWith) {
    // Same number of spots, so the schedule stays; the newcomer takes alternate games.
    const detail = await getSessionDetail(sessionId);
    // Leave the round on court alone; alternation starts from the next round.
    if (detail) await realternate(db, sessionId, shareWith, Math.min(currentRound(detail), 999));
  } else {
    await rebuildFuture(db, sessionId);
  }
  revalidatePath(`/sessions/${sessionId}`);
  return {};
}

export async function removeFromSession(sessionId: number, playerId: number) {
  const db = await getDb();
  const detail = await getSessionDetail(sessionId);
  if (!detail) return;
  const me = detail.roster.find((r) => r.id === playerId);
  if (!me) return;
  const where = (pid: number) => and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, pid));
  await db.update(sessionPlayers).set({ active: false }).where(where(playerId));

  const slot = me.sharesWith ?? me.id;
  const partner = me.sharesWith !== null ? me.sharesWith : activeSharers(detail.roster).get(me.id);
  if (partner !== undefined && detail.roster.find((r) => r.id === partner)?.active) {
    // A shared spot: the other person simply takes over the spot.
    if (me.sharesWith === null) {
      await db.update(sessionPlayers).set({ sharesWith: null }).where(where(partner));
      const from = currentRound(detail);
      await db
        .update(byes)
        .set({ playerId: partner })
        .where(and(eq(byes.sessionId, sessionId), eq(byes.playerId, slot), gt(byes.round, from - 1)));
    }
    const replaced = me.sharesWith === null ? partner : slot;
    for (const g of detail.games) {
      if (g.winner) continue;
      const seat = (['a1', 'a2', 'b1', 'b2'] as const).find((k) => g[k] === playerId);
      if (seat) await db.update(games).set({ [seat]: replaced }).where(eq(games.id, g.id));
    }
  } else {
    await rebuildFuture(db, sessionId);
  }
  revalidatePath(`/sessions/${sessionId}`);
}

export async function addRound(sessionId: number) {
  const db = await getDb();
  await rebuildFuture(db, sessionId, 1);
  revalidatePath(`/sessions/${sessionId}`);
}

export async function endSession(sessionId: number) {
  const db = await getDb();
  const detail = await getSessionDetail(sessionId);
  if (!detail) return;
  if (detail.session.status === 'active' && !detail.games.some((g) => g.winner)) {
    // Nothing was played: don't keep an empty session in the history.
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    revalidatePath('/', 'layout');
    redirect('/');
  }
  if (detail.session.status === 'active') {
    // Unplayed games are dropped so they never show up in history.
    await db.delete(games).where(and(eq(games.sessionId, sessionId), isNull(games.winner)));
    const playedRounds = [...new Set(detail.games.filter((g) => g.winner).map((g) => g.round))];
    const byeRows = detail.byes.filter((b) => !playedRounds.includes(b.round));
    if (byeRows.length) {
      await db
        .delete(byes)
        .where(and(eq(byes.sessionId, sessionId), inArray(byes.round, [...new Set(byeRows.map((b) => b.round))])));
    }

    const balances = new Map<number, number>();
    for (const g of detail.games) {
      if (!g.winner) continue;
      const win = g.winner === 'A' ? [g.a1, g.a2] : [g.b1, g.b2];
      const lose = g.winner === 'A' ? [g.b1, g.b2] : [g.a1, g.a2];
      for (const p of win) balances.set(p, (balances.get(p) ?? 0) + detail.session.stakeCents);
      for (const p of lose) balances.set(p, (balances.get(p) ?? 0) - detail.session.stakeCents);
    }
    const transfers = settleUp(balances);
    await db.delete(payments).where(eq(payments.sessionId, sessionId));
    if (transfers.length) {
      await db.insert(payments).values(
        transfers.map((t) => ({ sessionId, fromId: t.from, toId: t.to, amountCents: t.amountCents })),
      );
    }
    await db.update(sessions).set({ status: 'completed', endedAt: new Date() }).where(eq(sessions.id, sessionId));
  }
  revalidatePath('/', 'layout');
  redirect(`/sessions/${sessionId}/summary`);
}

export async function reopenSession(sessionId: number) {
  const db = await getDb();
  await db.delete(payments).where(eq(payments.sessionId, sessionId));
  await db.update(sessions).set({ status: 'active', endedAt: null }).where(eq(sessions.id, sessionId));
  revalidatePath('/', 'layout');
  redirect(`/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: number) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function setPaymentPaid(paymentId: number, paid: boolean) {
  const db = await getDb();
  const [row] = await db
    .update(payments)
    .set({ paid })
    .where(eq(payments.id, paymentId))
    .returning({ sessionId: payments.sessionId });
  if (row) revalidatePath(`/sessions/${row.sessionId}/summary`);
}
