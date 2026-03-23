import { pgTable, text, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomParticipantsTable = pgTable("room_participants", {
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  isHost: boolean("is_host").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.roomId, t.userId] })]);

export const insertRoomParticipantSchema = createInsertSchema(roomParticipantsTable).omit({
  joinedAt: true,
});

export type InsertRoomParticipant = z.infer<typeof insertRoomParticipantSchema>;
export type RoomParticipant = typeof roomParticipantsTable.$inferSelect;
