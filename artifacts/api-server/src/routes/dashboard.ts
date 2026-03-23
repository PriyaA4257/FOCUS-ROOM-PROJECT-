import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, usersTable } from "@workspace/db/schema";
import { eq, gte, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const allSessions = await db
      .select()
      .from(studySessionsTable)
      .where(and(eq(studySessionsTable.userId, userId), eq(studySessionsTable.completed, true)));

    const todaySessions = allSessions.filter((s) => s.startTime >= todayStart);
    const weeklySessions = allSessions.filter((s) => s.startTime >= weekStart);
    const monthlySessions = allSessions.filter((s) => s.startTime >= monthStart);

    const sum = (sessions: typeof allSessions) =>
      sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

    const todayMinutes = sum(todaySessions);
    const weeklyMinutes = sum(weeklySessions);
    const monthlyMinutes = sum(monthlySessions);
    const totalMinutes = user.totalFocusMinutes;

    // Most productive hour
    const hourCounts: Record<number, number> = {};
    for (const s of allSessions) {
      const h = s.startTime.getHours();
      hourCounts[h] = (hourCounts[h] || 0) + (s.durationMinutes || 0);
    }
    const topHour = Object.keys(hourCounts).length > 0
      ? Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0])
      : null;

    const goalProgress = user.studyGoalMinutes > 0
      ? Math.min(100, (todayMinutes / user.studyGoalMinutes) * 100)
      : 0;

    res.json({
      todayMinutes,
      weeklyMinutes,
      monthlyMinutes,
      totalMinutes,
      totalSessions: allSessions.length,
      completedSessions: allSessions.filter((s) => s.completed).length,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      studyGoalMinutes: user.studyGoalMinutes,
      goalProgressPercent: Math.round(goalProgress * 10) / 10,
      topProductiveHour: topHour,
      weeklyTarget: 600,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const days = Math.min(Number(req.query["days"] || 7), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const sessions = await db
      .select()
      .from(studySessionsTable)
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          eq(studySessionsTable.completed, true),
          gte(studySessionsTable.startTime, since)
        )
      );

    // Build day-by-day map
    const activity: Record<string, { minutes: number; sessions: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split("T")[0]!;
      activity[key] = { minutes: 0, sessions: 0 };
    }

    for (const s of sessions) {
      const key = s.startTime.toISOString().split("T")[0]!;
      if (activity[key]) {
        activity[key].minutes += s.durationMinutes || 0;
        activity[key].sessions += 1;
      }
    }

    res.json(
      Object.entries(activity).map(([date, data]) => ({
        date,
        minutes: data.minutes,
        sessions: data.sessions,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Activity error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
