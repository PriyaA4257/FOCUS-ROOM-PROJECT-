import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studySessionsTable = pgTable("study_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  roomId: text("room_id"),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  pomodorosCompleted: integer("pomodoros_completed").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({
  createdAt: true,
});

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessionsTable.$inferSelect;
