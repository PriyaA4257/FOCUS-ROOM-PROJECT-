import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./use-auth-store";
import { TimerState, RoomDetail } from "@workspace/api-client-react";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

export function useRoomSocket(roomId: string) {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomDetail | null>(null);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!token || !roomId) return;

    // Connect to the root namespace via /api/socket.io path
    const socket = io("/", {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", roomId);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("room-state", (data: RoomDetail) => {
      setRoomState(data);
      if (data.timerState) setTimerState(data.timerState);
    });

    socket.on("timer-update", (data: TimerState) => {
      setTimerState(data);
    });

    socket.on("message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("leave-room", roomId);
      socket.disconnect();
    };
  }, [roomId, token]);

  const sendMessage = (content: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("send-message", { roomId, content });
    }
  };

  return {
    isConnected,
    roomState,
    timerState,
    messages,
    sendMessage,
  };
}
