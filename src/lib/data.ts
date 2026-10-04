import 'server-only';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Round } from './schedule';
import type { GameRecord } from './stats';

const { players, sessions, sessionPlayers, games, byes, payments } = schema;

export type Range = 'all' | 'season' | '30d';

export async function listPlayers(includeArchived = false) {
  const db = await getDb();
  const rows = await db.select().from(players).orderBy(asc(players.name));
  return includeArchived ? rows : rows.filter((p) => !p.archived);
}

export async function playerNames(): Promise<Map<number, string>> {
  const db = await getDb();
  const rows = await db.select({ id: players.id, name: players.name }).from(players);
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Active sessions, newest first; brackets of the same night sit together (A before B). */
export async function getActiveSessions() {
  const db = await getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.status, 'active')).orderBy(desc(sessions.createdAt));
  return rows.sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      (a.groupKey ?? '').localeCompare(b.groupKey ?? '') ||
      (a.bracket ?? '').localeCompare(b.bracket ?? ''),
  );
}

/** Other brackets created alongside this session. */
export async function getSiblingSessions(session: { id: number; groupKey: string | null }) {
  if (!session.groupKey) return [];
  const db = await getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.groupKey, session.groupKey)).orderBy(asc(sessions.bracket));
  return rows;
}

export async function getSessionDetail(id: number) {
  const db = await getDb();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return null;
  const [roster, gameRows, byeRows, paymentRows] = await Promise.all([
    db
      .select({ id: players.id, name: players.name, active: sessionPlayers.active, sharesWith: sessionPlayers.sharesWith })
      .from(sessionPlayers)
      .innerJoin(players, eq(players.id, sessionPlayers.playerId))
      .where(eq(sessionPlayers.sessionId, id))
      .orderBy(asc(players.name)),
    db.select().from(games).where(eq(games.sessionId, id)).orderBy(asc(games.round), asc(games.court)),
    db.select().from(byes).where(eq(byes.sessionId, id)),
    db.select().from(payments).where(eq(payments.sessionId, id)).orderBy(asc(payments.id)),
  ]);
  return { session, roster, games: gameRows, byes: byeRows, payments: paymentRows };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;

/** Rounds as the scheduler sees them, for rebuilding the rest of a session. */
export function toRounds(detail: Pick<SessionDetail, 'games' | 'byes'>): Map<number, Round> {
  const out = new Map<number, Round>();
  const get = (r: number) => {
    if (!out.has(r)) out.set(r, { games: [], byes: [] });
    return out.get(r)!;
  };
  for (const g of detail.games) get(g.round).games.push([g.a1, g.a2, g.b1, g.b2]);
  for (const b of detail.byes) get(b.round).byes.push(b.playerId);
  return new Map([...out].sort(([a], [b]) => a - b));
}

function rangeStart(range: Range): string | null {
  const now = new Date();
  if (range === 'season') return `${now.getFullYear()}-01-01`;
  if (range === '30d') {
    const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Completed sessions (oldest first) and their played games, within a range. */
export async function completedHistory(range: Range = 'all') {
  const db = await getDb();
  const start = rangeStart(range);
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(
      start
        ? and(eq(sessions.status, 'completed'), gte(sessions.playedOn, start))
        : eq(sessions.status, 'completed'),
    )
    .orderBy(asc(sessions.playedOn), asc(sessions.id));
  if (sessionRows.length === 0) return { sessions: sessionRows, games: [] as GameRecord[] };
  const stake = new Map(sessionRows.map((s) => [s.id, s.stakeCents]));
  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.sessionId, sessionRows.map((s) => s.id)));
  const records: GameRecord[] = gameRows.map((g) => ({
    sessionId: g.sessionId,
    round: g.round,
    court: g.court,
    a1: g.a1,
    a2: g.a2,
    b1: g.b1,
    b2: g.b2,
    winner: g.winner,
    stakeCents: stake.get(g.sessionId) ?? 100,
  }));
  return { sessions: sessionRows, games: records };
}

export function toRecords(detail: SessionDetail): GameRecord[] {
  return detail.games.map((g) => ({
    sessionId: g.sessionId,
    round: g.round,
    court: g.court,
    a1: g.a1,
    a2: g.a2,
    b1: g.b1,
    b2: g.b2,
    winner: g.winner,
    stakeCents: detail.session.stakeCents,
  }));
}
