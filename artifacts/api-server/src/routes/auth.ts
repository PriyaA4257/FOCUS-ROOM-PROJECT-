import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth.js";
import { generateId } from "../lib/id.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: "Username, email and password are required" });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ message: "Username must be between 3 and 30 characters" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const existingUsername = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      res.status(409).json({ message: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = generateId();

    const [user] = await db
      .insert(usersTable)
      .values({ id, username, email, passwordHash })
      .returning();

    const token = signToken({ userId: user.id, email: user.email, username: user.username });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        theme: user.theme,
        studyGoalMinutes: user.studyGoalMinutes,
        totalFocusMinutes: user.totalFocusMinutes,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, username: user.username });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        theme: user.theme,
        studyGoalMinutes: user.studyGoalMinutes,
        totalFocusMinutes: user.totalFocusMinutes,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      theme: user.theme,
      studyGoalMinutes: user.studyGoalMinutes,
      totalFocusMinutes: user.totalFocusMinutes,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, avatar, theme, studyGoalMinutes } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (username !== undefined) updates["username"] = username;
    if (avatar !== undefined) updates["avatar"] = avatar;
    if (theme !== undefined) updates["theme"] = theme;
    if (studyGoalMinutes !== undefined) updates["studyGoalMinutes"] = studyGoalMinutes;

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.user!.userId))
      .returning();

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      theme: user.theme,
      studyGoalMinutes: user.studyGoalMinutes,
      totalFocusMinutes: user.totalFocusMinutes,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
