import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, roomsTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { generateId } from "../lib/id.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] || 20), 100);
    const offset = Number(req.query["offset"] || 0);

    const sessions = await db
      .select()
      .from(studySessionsTable)
      .where(eq(studySessionsTable.userId, req.user!.userId))
      .orderBy(desc(studySessionsTable.startTime))
      .limit(limit)
      .offset(offset);

    // Get room names
    const roomIds = [...new Set(sessions.map((s) => s.roomId).filter(Boolean) as string[])];
    const rooms = roomIds.length > 0
      ? await db.select().from(roomsTable).where(eq(roomsTable.id, roomIds[0]!))
      : [];
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r.name]));

    res.json(
      sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        roomId: s.roomId,
        roomName: s.roomId ? roomMap[s.roomId] || null : null,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        pomodorosCompleted: s.pomodorosCompleted,
        completed: s.completed,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "List sessions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.body;
    const id = generateId();

    const [session] = await db
      .insert(studySessionsTable)
      .values({
        id,
        userId: req.user!.userId,
        roomId: roomId || null,
      })
      .returning();

    res.status(201).json({
      id: session.id,
      userId: session.userId,
      roomId: session.roomId,
      roomName: null,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      pomodorosCompleted: session.pomodorosCompleted,
      completed: session.completed,
    });
  } catch (err) {
    req.log.error({ err }, "Create session error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:sessionId/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { pomodorosCompleted = 0 } = req.body;

    const [existing] = await db
      .select()
      .from(studySessionsTable)
      .where(eq(studySessionsTable.id, sessionId));

    if (!existing) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - existing.startTime.getTime()) / 60000
    );

    const [session] = await db
      .update(studySessionsTable)
      .set({
        endTime,
        durationMinutes,
        pomodorosCompleted,
        completed: true,
      })
      .where(eq(studySessionsTable.id, sessionId))
      .returning();

    // Update user stats
    const today = new Date().toISOString().split("T")[0]!;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));

    if (user) {
      const lastDate = user.lastStudyDate;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0]!;

      let newStreak = user.currentStreak;
      if (lastDate === today) {
        // same day, no streak change
      } else if (lastDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }

      const newTotal = user.totalFocusMinutes + (durationMinutes || 0);
      const newLongest = Math.max(user.longestStreak, newStreak);

      await db
        .update(usersTable)
        .set({
          totalFocusMinutes: newTotal,
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastStudyDate: today,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, req.user!.userId));
    }

    res.json({
      id: session.id,
      userId: session.userId,
      roomId: session.roomId,
      roomName: null,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      pomodorosCompleted: session.pomodorosCompleted,
      completed: session.completed,
    });
  } catch (err) {
    req.log.error({ err }, "Complete session error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
