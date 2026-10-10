import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  playedOn: date('played_on', { mode: 'string' }).notNull(),
  stakeCents: integer('stake_cents').notNull().default(100),
  courts: integer('courts').notNull(),
  /** 'A' / 'B' when the night is split into brackets that run side by side. */
  bracket: text('bracket'),
  /** Shared by brackets created together, so they can link to each other. */
  groupKey: text('group_key'),
  /** 'active' while games are being played, 'completed' once settled. */
  status: text('status', { enum: ['active', 'completed'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

/**
 * Who is (or was) part of a session. Inactive rows are players who left mid-session.
 * A row with sharesWith set shares that player's spot: the scheduler treats the two
 * as one slot and they alternate games.
 */
export const sessionPlayers = pgTable(
  'session_players',
  {
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    active: boolean('active').notNull().default(true),
    sharesWith: integer('shares_with').references(() => players.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.playerId] })],
);

/** One doubles game: team A (a1 + a2) vs team B (b1 + b2). */
export const games = pgTable(
  'games',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    court: integer('court').notNull(),
    a1: integer('a1').notNull().references(() => players.id),
    a2: integer('a2').notNull().references(() => players.id),
    b1: integer('b1').notNull().references(() => players.id),
    b2: integer('b2').notNull().references(() => players.id),
    winner: text('winner', { enum: ['A', 'B'] }),
    scoreA: integer('score_a'),
    scoreB: integer('score_b'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('games_session_idx').on(t.sessionId, t.round)],
);

/** Players sitting out a given round. */
export const byes = pgTable(
  'byes',
  {
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.round, t.playerId] })],
);

/** Settle-up transfers generated when a session ends. */
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  fromId: integer('from_id')
    .notNull()
    .references(() => players.id),
  toId: integer('to_id')
    .notNull()
    .references(() => players.id),
  amountCents: integer('amount_cents').notNull(),
  paid: boolean('paid').notNull().default(false),
});

export type Player = typeof players.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Payment = typeof payments.$inferSelect;

/**
 * Money actually handed over between players. Balances on the tab are every
 * finished session's results minus these, so debts net out across sessions.
 */
export const settlements = pgTable('settlements', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id')
    .notNull()
    .references(() => players.id),
  toId: integer('to_id')
    .notNull()
    .references(() => players.id),
  amountCents: integer('amount_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Settlement = typeof settlements.$inferSelect;
