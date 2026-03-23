import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import roomsRouter from "./rooms.js";
import sessionsRouter from "./sessions.js";
import dashboardRouter from "./dashboard.js";
import leaderboardRouter from "./leaderboard.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/rooms", roomsRouter);
router.use("/sessions", sessionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/leaderboard", leaderboardRouter);

export default router;
