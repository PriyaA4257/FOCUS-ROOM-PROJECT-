import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { roomsTable, roomParticipantsTable, usersTable } from "@workspace/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { generateId } from "../lib/id.js";
import { getIo } from "../lib/socket.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, category } = req.query as { search?: string; category?: string };

    let query = db
      .select({
        room: roomsTable,
        host: usersTable,
      })
      .from(roomsTable)
      .leftJoin(usersTable, eq(roomsTable.hostId, usersTable.id))
      .where(eq(roomsTable.isPrivate, false));

    const rooms = await query;

    // Get participant counts
    const allParticipants = await db.select().from(roomParticipantsTable);
    const countByRoom = allParticipants.reduce((acc, p) => {
      acc[p.roomId] = (acc[p.roomId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let filtered = rooms.filter(({ room }) => {
      if (search && !room.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category && room.category !== category) return false;
      return true;
    });

    res.json(
      filtered.map(({ room, host }) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        category: room.category,
        isPrivate: room.isPrivate,
        hasPassword: !!room.passwordHash,
        maxParticipants: room.maxParticipants,
        participantCount: countByRoom[room.id] || 0,
        background: room.background,
        focusDuration: room.focusDuration,
        breakDuration: room.breakDuration,
        hostId: room.hostId,
        hostUsername: host?.username || "Unknown",
        timerState: room.timerState,
        createdAt: room.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "List rooms error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      category = "general",
      isPrivate = false,
      password,
      maxParticipants = 10,
      background = "default",
      focusDuration = 25,
      breakDuration = 5,
    } = req.body;

    if (!name || name.length < 3) {
      res.status(400).json({ message: "Room name must be at least 3 characters" });
      return;
    }

    const id = generateId();
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const [room] = await db
      .insert(roomsTable)
      .values({
        id,
        name,
        description,
        category,
        isPrivate,
        passwordHash,
        maxParticipants,
        background,
        focusDuration,
        breakDuration,
        hostId: req.user!.userId,
        timerState: {
          phase: "idle",
          isRunning: false,
          timeRemaining: focusDuration * 60,
          startedAt: null,
          pomodoroCount: 0,
        },
      })
      .returning();

    // Auto-join host
    await db.insert(roomParticipantsTable).values({
      roomId: id,
      userId: req.user!.userId,
      isHost: true,
    });

    const [host] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));

    res.status(201).json({
      id: room.id,
      name: room.name,
      description: room.description,
      category: room.category,
      isPrivate: room.isPrivate,
      hasPassword: !!room.passwordHash,
      maxParticipants: room.maxParticipants,
      participantCount: 1,
      background: room.background,
      focusDuration: room.focusDuration,
      breakDuration: room.breakDuration,
      hostId: room.hostId,
      hostUsername: host?.username || "Unknown",
      timerState: room.timerState,
      createdAt: room.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Create room error");
    res.status(500).json({ message: "Internal server error" });
  }
});

async function getRoomDetail(roomId: string) {
  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, roomId));
  if (!room) return null;

  const participants = await db
    .select({
      participant: roomParticipantsTable,
      user: usersTable,
    })
    .from(roomParticipantsTable)
    .leftJoin(usersTable, eq(roomParticipantsTable.userId, usersTable.id))
    .where(eq(roomParticipantsTable.roomId, roomId));

  const [host] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, room.hostId));

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    category: room.category,
    isPrivate: room.isPrivate,
    hasPassword: !!room.passwordHash,
    maxParticipants: room.maxParticipants,
    participantCount: participants.length,
    background: room.background,
    focusDuration: room.focusDuration,
    breakDuration: room.breakDuration,
    hostId: room.hostId,
    hostUsername: host?.username || "Unknown",
    timerState: room.timerState,
    createdAt: room.createdAt,
    participants: participants.map(({ participant, user }) => ({
      userId: participant.userId,
      username: user?.username || "Unknown",
      avatar: user?.avatar || null,
      joinedAt: participant.joinedAt,
      isHost: participant.isHost,
    })),
  };
}

router.get("/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const detail = await getRoomDetail(req.params["roomId"]!);
    if (!detail) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Get room error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:roomId/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params as { roomId: string };
    const { password } = req.body;

    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.passwordHash && !password) {
      res.status(403).json({ message: "Password required" });
      return;
    }

    if (room.passwordHash && password) {
      const valid = await bcrypt.compare(password, room.passwordHash);
      if (!valid) {
        res.status(403).json({ message: "Wrong password" });
        return;
      }
    }

    // Check if already in room
    const existing = await db
      .select()
      .from(roomParticipantsTable)
      .where(
        and(
          eq(roomParticipantsTable.roomId, roomId),
          eq(roomParticipantsTable.userId, req.user!.userId)
        )
      );

    if (existing.length === 0) {
      await db.insert(roomParticipantsTable).values({
        roomId,
        userId: req.user!.userId,
        isHost: false,
      });
    }

    const detail = await getRoomDetail(roomId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Join room error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:roomId/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params as { roomId: string };

    await db
      .delete(roomParticipantsTable)
      .where(
        and(
          eq(roomParticipantsTable.roomId, roomId),
          eq(roomParticipantsTable.userId, req.user!.userId)
        )
      );

    res.json({ message: "Left room" });
  } catch (err) {
    req.log.error({ err }, "Leave room error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:roomId/timer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params as { roomId: string };
    const { action } = req.body;

    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    // Check if participant is host
    const [participant] = await db
      .select()
      .from(roomParticipantsTable)
      .where(
        and(
          eq(roomParticipantsTable.roomId, roomId),
          eq(roomParticipantsTable.userId, req.user!.userId)
        )
      );

    const isHost = participant?.isHost || room.hostId === req.user!.userId;

    let newState = { ...room.timerState };

    switch (action) {
      case "start":
        newState.isRunning = true;
        if (newState.phase === "idle") {
          newState.phase = "focus";
          newState.timeRemaining = room.focusDuration * 60;
        }
        newState.startedAt = new Date().toISOString();
        break;
      case "pause":
        newState.isRunning = false;
        newState.startedAt = null;
        break;
      case "reset":
        newState = {
          phase: "idle",
          isRunning: false,
          timeRemaining: room.focusDuration * 60,
          startedAt: null,
          pomodoroCount: newState.pomodoroCount,
        };
        break;
      case "skip":
        if (newState.phase === "focus") {
          newState.pomodoroCount += 1;
          newState.phase = "break";
          newState.timeRemaining = room.breakDuration * 60;
        } else {
          newState.phase = "focus";
          newState.timeRemaining = room.focusDuration * 60;
        }
        newState.isRunning = false;
        newState.startedAt = null;
        break;
    }

    await db
      .update(roomsTable)
      .set({ timerState: newState, updatedAt: new Date() })
      .where(eq(roomsTable.id, roomId));

    // Broadcast to all room members via Socket.IO
    const io = getIo();
    if (io) {
      io.to(`room:${roomId}`).emit("timer-update", newState);
    }

    res.json(newState);
  } catch (err) {
    req.log.error({ err }, "Timer update error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:roomId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params as { roomId: string };

    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.hostId !== req.user!.userId) {
      res.status(403).json({ message: "Only the host can delete the room" });
      return;
    }

    await db.delete(roomParticipantsTable).where(eq(roomParticipantsTable.roomId, roomId));
    await db.delete(roomsTable).where(eq(roomsTable.id, roomId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete room error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
