import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken } from "./auth.js";
import { db } from "@workspace/db";
import { roomParticipantsTable, usersTable, roomsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";

let io: SocketIOServer | null = null;

export function getIo(): SocketIOServer | null {
  return io;
}

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }
    try {
      const payload = verifyToken(token);
      (socket as typeof socket & { user: ReturnType<typeof verifyToken> }).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as typeof socket & { user: ReturnType<typeof verifyToken> }).user;
    logger.info({ userId: user.userId }, "Socket connected");

    socket.on("join-room", async (roomId: string) => {
      try {
        socket.join(`room:${roomId}`);
        const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
        const participants = await db
          .select({ participant: roomParticipantsTable, u: usersTable })
          .from(roomParticipantsTable)
          .leftJoin(usersTable, eq(roomParticipantsTable.userId, usersTable.id))
          .where(eq(roomParticipantsTable.roomId, roomId));

        const [hostUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, room?.hostId || ""));

        socket.to(`room:${roomId}`).emit("user-joined", {
          userId: user.userId,
          username: user.username,
          avatar: null,
          joinedAt: new Date().toISOString(),
          isHost: room?.hostId === user.userId,
        });

        socket.emit("room-state", {
          roomId,
          timerState: room?.timerState || null,
          participants: participants.map(({ participant, u }) => ({
            userId: participant.userId,
            username: u?.username || "Unknown",
            avatar: u?.avatar || null,
            joinedAt: participant.joinedAt,
            isHost: participant.isHost,
          })),
        });
      } catch (err) {
        logger.error({ err }, "join-room error");
      }
    });

    socket.on("leave-room", async (roomId: string) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit("user-left", user.userId);

      try {
        await db
          .delete(roomParticipantsTable)
          .where(
            and(
              eq(roomParticipantsTable.roomId, roomId),
              eq(roomParticipantsTable.userId, user.userId)
            )
          );
      } catch (err) {
        logger.error({ err }, "leave-room error");
      }
    });

    socket.on("send-message", (data: { roomId: string; content: string }) => {
      const msg = {
        id: Date.now().toString(),
        userId: user.userId,
        username: user.username,
        content: data.content,
        timestamp: new Date().toISOString(),
      };
      io?.to(`room:${data.roomId}`).emit("message", msg);
    });

    socket.on("timer-action", async (data: { roomId: string; action: string }) => {
      try {
        const [room] = await db
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, data.roomId));
        if (!room) return;

        if (room.hostId !== user.userId) return;

        let newState = { ...room.timerState };
        switch (data.action) {
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
          .where(eq(roomsTable.id, data.roomId));

        io?.to(`room:${data.roomId}`).emit("timer-update", newState);
      } catch (err) {
        logger.error({ err }, "timer-action error");
      }
    });

    socket.on("disconnect", async () => {
      logger.info({ userId: user.userId }, "Socket disconnected");
    });
  });

  return io;
}
