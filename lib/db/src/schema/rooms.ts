import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomsTable = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  isPrivate: boolean("is_private").notNull().default(false),
  passwordHash: text("password_hash"),
  maxParticipants: integer("max_participants").notNull().default(10),
  background: text("background").notNull().default("default"),
  focusDuration: integer("focus_duration").notNull().default(25),
  breakDuration: integer("break_duration").notNull().default(5),
  hostId: text("host_id").notNull(),
  timerState: jsonb("timer_state").$type<{
    phase: "focus" | "break" | "idle";
    isRunning: boolean;
    timeRemaining: number;
    startedAt: string | null;
    pomodoroCount: number;
  }>().notNull().default({
    phase: "idle",
    isRunning: false,
    timeRemaining: 25 * 60,
    startedAt: null,
    pomodoroCount: 0,
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
