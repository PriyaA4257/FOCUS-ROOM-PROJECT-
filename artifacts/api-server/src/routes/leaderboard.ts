import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, usersTable } from "@workspace/db/schema";
import { eq, gte, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const period = (req.query["period"] as string) || "weekly";
    const limit = Math.min(Number(req.query["limit"] || 10), 50);

    let since: Date | null = null;
    const now = new Date();

    switch (period) {
      case "daily":
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        since = new Date(now);
        since.setDate(since.getDate() - 7);
        break;
      case "monthly":
        since = new Date(now);
        since.setDate(since.getDate() - 30);
        break;
      case "alltime":
      default:
        since = null;
    }

    const users = await db.select().from(usersTable);

    const completedFilter = eq(studySessionsTable.completed, true);

    // Get all completed sessions in the period
    const sessions = since
      ? await db
          .select()
          .from(studySessionsTable)
          .where(and(completedFilter, gte(studySessionsTable.startTime, since)))
      : await db
          .select()
          .from(studySessionsTable)
          .where(completedFilter);

    // Aggregate by user
    const userStats: Record<string, { minutes: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!userStats[s.userId]) userStats[s.userId] = { minutes: 0, sessions: 0 };
      userStats[s.userId].minutes += s.durationMinutes || 0;
      userStats[s.userId].sessions += 1;
    }

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const ranked = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        username: userMap[userId]?.username || "Unknown",
        avatar: userMap[userId]?.avatar || null,
        focusMinutes: stats.minutes,
        sessionsCompleted: stats.sessions,
        currentStreak: userMap[userId]?.currentStreak || 0,
      }))
      .sort((a, b) => b.focusMinutes - a.focusMinutes)
      .slice(0, limit)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        isCurrentUser: entry.userId === req.user!.userId,
      }));

    res.json(ranked);
  } catch (err) {
    req.log.error({ err }, "Leaderboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
