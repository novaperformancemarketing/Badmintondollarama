'use server';

import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, schema, type Db } from '@/db';
import { AUTH_COOKIE, passcodeToken } from '@/lib/auth';
import { getSessionDetail, toRounds } from '@/lib/data';
import { settleUp } from '@/lib/money';
import { generateSchedule, gamesPerRound, type Round } from '@/lib/schedule';

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

export async function createSession(_: FormState, form: FormData): Promise<FormState> {
  const db = await getDb();
  const ids = form.getAll('player').map(Number).filter(Number.isFinite);
  const courts = Math.max(1, Math.min(8, Number(form.get('courts')) || 1));
  const roundCount = Math.max(1, Math.min(40, Number(form.get('rounds')) || 1));
  const stakeCents = Math.max(25, Math.min(10000, Math.round(Number(form.get('stake')) * 100) || 100));
  const playedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(form.get('playedOn')))
    ? String(form.get('playedOn'))
    : new Date().toISOString().slice(0, 10);

  for (const raw of form.getAll('newName')) {
    const name = cleanName(raw);
    if (name) ids.push(await findOrCreatePlayer(db, name));
  }
  const roster = [...new Set(ids)];
  if (roster.length < 4) return { error: 'Pick at least 4 players for doubles.' };
  if (gamesPerRound(roster.length, courts) === 0) return { error: 'Not enough players for a game.' };

  const [session] = await db
    .insert(sessions)
    .values({ playedOn, courts, stakeCents })
    .returning({ id: sessions.id });
  await db.insert(sessionPlayers).values(roster.map((playerId) => ({ sessionId: session.id, playerId })));
  await insertRounds(db, session.id, 1, generateSchedule({ players: roster, courts, rounds: roundCount }));

  revalidatePath('/');
  redirect(`/sessions/${session.id}`);
}

/** The round on court: the first one with an unfinished game. */
function currentRound(detail: NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>): number {
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

  const active = detail.roster.filter((p) => p.active).map((p) => p.id);
  const next = generateSchedule({ players: active, courts: detail.session.courts, rounds: futureCount, previous: kept });
  await insertRounds(db, sessionId, lastKept + 1, next);
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

export async function addLatePlayer(_: FormState, form: FormData): Promise<FormState> {
  const sessionId = Number(form.get('sessionId'));
  const db = await getDb();
  const name = cleanName(form.get('name'));
  const picked = Number(form.get('playerId'));
  const playerId = name ? await findOrCreatePlayer(db, name) : picked;
  if (!playerId) return { error: 'Pick a player or type a new name.' };

  const [row] = await db
    .select()
    .from(sessionPlayers)
    .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
  if (row) {
    await db
      .update(sessionPlayers)
      .set({ active: true })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
  } else {
    await db.insert(sessionPlayers).values({ sessionId, playerId });
  }
  await rebuildFuture(db, sessionId);
  revalidatePath(`/sessions/${sessionId}`);
  return {};
}

export async function removeFromSession(sessionId: number, playerId: number) {
  const db = await getDb();
  await db
    .update(sessionPlayers)
    .set({ active: false })
    .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.playerId, playerId)));
  await rebuildFuture(db, sessionId);
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
