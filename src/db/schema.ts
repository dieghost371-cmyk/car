import { pgTable, uuid, text, varchar, timestamp, integer, doublePrecision, boolean, index } from 'drizzle-orm/pg-core';

export const rooms = pgTable('apex_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 6 }).notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  track: text('track').notNull().default('coastal'),
  laps: integer('laps').notNull().default(3),
  status: text('status').notNull().default('waiting'),
  hostId: uuid('host_id').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('apex_rooms_status_idx').on(table.status)]);

export const players = pgTable('apex_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  carId: text('car_id').notNull().default('gtr'),
  color: text('color').notNull().default('#bc2035'),
  tokenHash: text('token_hash').notNull().unique(),
  ready: boolean('ready').notNull().default(false),
  progress: doublePrecision('progress').notNull().default(0),
  lane: doublePrecision('lane').notNull().default(0),
  speed: doublePrecision('speed').notNull().default(0),
  lap: integer('lap').notNull().default(1),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  lastStateAt: timestamp('last_state_at', { withTimezone: true }).notNull().defaultNow(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('apex_players_room_idx').on(table.roomId)]);

export const raceResults = pgTable('apex_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  playerId: uuid('player_id'),
  playerName: text('player_name').notNull(),
  carId: text('car_id').notNull(),
  track: text('track').notNull(),
  laps: integer('laps').notNull(),
  timeMs: integer('time_ms').notNull(),
  position: integer('position').notNull().default(1),
  mode: text('mode').notNull().default('solo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('apex_results_track_time_idx').on(table.track, table.timeMs)]);
