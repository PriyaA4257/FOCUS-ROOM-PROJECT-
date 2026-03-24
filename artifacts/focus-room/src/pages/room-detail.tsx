import React, { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getRoom, updateTimer, joinRoom, TimerUpdateRequestAction } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useRoomSocket } from "@/hooks/use-socket";
import { useThemeStore, AMBIENT_THEMES } from "@/hooks/use-theme";
import { notifySessionComplete, notifyBreakOver, requestNotificationPermission } from "@/hooks/use-notifications";
import { Card, Button } from "@/components/ui";
import { Users, Play, Pause, RotateCcw, SkipForward, Maximize2, Minimize2 } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const REACTIONS = ["👍", "👏", "🔥", "❤️", "😄", "🎉", "💪", "🤯"];

export default function RoomDetail() {
  const [, params] = useRoute("/rooms/:roomId");
  const roomId = params?.roomId || "";
  const { authHeaders, user } = useAuthApi();
  const [, setLocation] = useLocation();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ambientTheme, setAmbientTheme } = useThemeStore();
  const prevPhaseRef = useRef<string | null>(null);
  const prevIsRunningRef = useRef<boolean>(false);

  const { data: initialRoom, isLoading, isError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    queryFn: () => getRoom(roomId, { headers: authHeaders }),
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId, {}, { headers: authHeaders }),
  });

  useEffect(() => {
    if (initialRoom) {
      localStorage.setItem("focus_last_room_id", roomId);
      localStorage.setItem("focus_last_room_name", initialRoom.name);
      if (!initialRoom.participants.find((p: any) => p.userId === user?.id)) {
        joinMutation.mutate();
      }
    }
  }, [initialRoom, user?.id]);

  const { isConnected, roomState, timerState, reactions, sendReaction } = useRoomSocket(roomId);

  const activeRoom = roomState || initialRoom;
  const activeTimer = timerState || initialRoom?.timerState;
  const isHost = activeRoom?.hostId === user?.id;

  const [localTimeRemaining, setLocalTimeRemaining] = useState(activeTimer?.timeRemaining || 0);

  useEffect(() => {
    if (activeTimer) {
      setLocalTimeRemaining(activeTimer.timeRemaining);
    }
  }, [activeTimer?.timeRemaining, activeTimer?.phase]);

  useEffect(() => {
    if (activeTimer?.isRunning) {
      const interval = setInterval(() => {
        setLocalTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTimer?.isRunning]);

  // Smart Notifications on phase change
  useEffect(() => {
    if (!activeTimer) return;
    const prevPhase = prevPhaseRef.current;
    const prevRunning = prevIsRunningRef.current;

    requestNotificationPermission();

    if (prevPhase === "focus" && activeTimer.phase === "break" && activeTimer.isRunning) {
      notifySessionComplete(activeTimer.pomodoroCount);
    }
    if (prevPhase === "break" && activeTimer.phase === "focus" && activeTimer.isRunning) {
      notifyBreakOver();
    }

    prevPhaseRef.current = activeTimer.phase;
    prevIsRunningRef.current = activeTimer.isRunning;
  }, [activeTimer?.phase, activeTimer?.isRunning]);

  // Focus mode
  useEffect(() => {
    if (activeTimer?.phase === "focus" && activeTimer.isRunning) {
      document.body.classList.add("focus-mode-active");
      setIsFocusMode(true);
    } else {
      document.body.classList.remove("focus-mode-active");
      setIsFocusMode(false);
    }
    return () => document.body.classList.remove("focus-mode-active");
  }, [activeTimer?.phase, activeTimer?.isRunning]);

  // Fullscreen API
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const timerActionMutation = useMutation({
    mutationFn: (action: TimerUpdateRequestAction) => updateTimer(roomId, { action }, { headers: authHeaders }),
  });

  const handleTimerAction = (action: TimerUpdateRequestAction) => {
    timerActionMutation.mutate(action);
  };

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 rounded-full border-b-2 border-primary"
      />
    </div>
  );
  if (isError || !activeRoom) return <div className="text-center py-20 text-destructive">Room not found or access denied.</div>;

  const totalDuration = activeTimer
    ? (activeTimer.phase === "focus" ? activeRoom.focusDuration : activeRoom.breakDuration) * 60
    : 1;
  const progress = activeTimer ? 1 - (localTimeRemaining / totalDuration) : 0;
  const isBreak = activeTimer?.phase === "break";
  const circumference = 2 * Math.PI * 120;

  return (
    <div ref={containerRef} className="h-full flex flex-col md:flex-row gap-6 relative">

      {/* Floating Emoji Reactions */}
      {reactions.map((r) => (
        <div
          key={r.id}
          className="reaction-float"
          style={{ left: `${20 + Math.random() * 60}%`, bottom: "20%" }}
        >
          {r.emoji}
        </div>
      ))}

      {/* Left Sidebar - Participants + Ambient Theme */}
      <Card className="hidden md:flex w-64 flex-col p-4 dim-in-focus overflow-hidden">
        <h3 className="font-bold text-white mb-1">{activeRoom.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-success" : "bg-warning")}></span>
          {isConnected ? "Connected" : "Reconnecting..."}
        </p>

        <div className="flex items-center justify-between mb-3 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-1"><Users size={14} /> Participants</span>
          <span className="bg-secondary px-2 py-0.5 rounded-full">{activeRoom.participants?.length || 0}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {activeRoom.participants?.map((p: any) => (
            <div key={p.userId} className="flex items-center gap-3">
              <div className="relative">
                <span className="text-xl">{p.avatar || "🧑‍💻"}</span>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-success border-2 border-card rounded-full"></span>
              </div>
              <span className="text-sm text-white font-medium truncate flex-1">{p.username}</span>
              {p.isHost && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Host</span>}
            </div>
          ))}
        </div>

        {/* Ambient Theme Picker */}
        <div className="border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
          <div className="grid grid-cols-5 gap-1">
            {AMBIENT_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setAmbientTheme(t.id)}
                title={t.label}
                className={cn(
                  "w-9 h-9 rounded-lg text-base flex items-center justify-center transition-all",
                  ambientTheme === t.id
                    ? "bg-primary/20 border border-primary scale-110"
                    : "hover:bg-secondary border border-transparent"
                )}
              >
                {t.emoji}
              </button>
            ))}
          </div>
          <p className="text-xs text-primary mt-1 font-medium">
            {AMBIENT_THEMES.find((t) => t.id === ambientTheme)?.label}
          </p>
        </div>
      </Card>

      {/* Center - Timer */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-card/30 rounded-3xl border border-border/50 backdrop-blur-sm p-8 transition-all duration-500 overflow-hidden">

        {/* Fullscreen toggle */}
        <Button
          variant="ghost" size="icon"
          className="absolute top-4 right-4 text-muted-foreground dim-in-focus z-10"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </Button>

        {/* Background ambient glow */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-all duration-1000",
            isBreak
              ? "bg-gradient-radial from-warning/5 via-transparent to-transparent"
              : activeTimer?.isRunning
              ? "bg-gradient-radial from-primary/5 via-transparent to-transparent"
              : "opacity-0"
          )}
        />

        <AnimatePresence mode="wait">
          {isBreak && (
            <motion.div
              key="break-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-10 text-warning font-display font-bold text-2xl tracking-widest uppercase"
            >
              ☕ Take a breather
            </motion.div>
          )}
        </AnimatePresence>

        {/* Circular Timer */}
        <motion.div
          className={cn("relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center mb-8", activeTimer?.isRunning && "timer-running")}
          animate={activeTimer?.isRunning ? { scale: [1, 1.008, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 300 300">
            <circle cx="150" cy="150" r="120" className="stroke-secondary fill-none" strokeWidth="10" />
            <motion.circle
              cx="150" cy="150" r="120"
              className={cn("fill-none", isBreak ? "stroke-warning" : "stroke-primary")}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, progress))) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <motion.span
              className={cn("text-xs font-bold tracking-widest uppercase mb-2", isBreak ? "text-warning" : "text-primary")}
              key={activeTimer?.phase}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {activeTimer?.phase === "idle" ? "READY" : activeTimer?.phase || "READY"}
            </motion.span>
            <motion.span
              className="text-6xl md:text-7xl font-display font-bold text-white tracking-tight tabular-nums"
              key={`time-${Math.floor(localTimeRemaining / 10)}`}
              animate={{ scale: localTimeRemaining === 0 && activeTimer?.isRunning ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              {formatTime(localTimeRemaining)}
            </motion.span>
            <span className="text-muted-foreground mt-3 font-medium text-sm">
              🍅 Pomodoro #{activeTimer?.pomodoroCount || 0}
            </span>
          </div>
        </motion.div>

        {/* Controls */}
        <div className={cn("flex items-center gap-4 transition-opacity duration-500", isFocusMode ? "opacity-10 hover:opacity-100" : "opacity-100")}>
          {isHost ? (
            <>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button size="icon" variant="secondary" onClick={() => handleTimerAction(TimerUpdateRequestAction.reset)} disabled={timerActionMutation.isPending}>
                  <RotateCcw size={20} />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  className={cn("w-20 h-20 rounded-full shadow-2xl transition-all", isBreak ? "bg-warning hover:bg-warning/90 shadow-warning/30" : "bg-primary shadow-primary/30")}
                  onClick={() => handleTimerAction(activeTimer?.isRunning ? TimerUpdateRequestAction.pause : TimerUpdateRequestAction.start)}
                  disabled={timerActionMutation.isPending}
                >
                  {activeTimer?.isRunning
                    ? <Pause size={32} />
                    : <Play size={32} className="ml-1" />}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button size="icon" variant="secondary" onClick={() => handleTimerAction(TimerUpdateRequestAction.skip)} disabled={timerActionMutation.isPending}>
                  <SkipForward size={20} />
                </Button>
              </motion.div>
            </>
          ) : (
            <div className="px-6 py-3 rounded-full bg-secondary/50 text-muted-foreground text-sm font-medium">
              Only the host can control the timer
            </div>
          )}
        </div>

        {/* Emoji Reactions Bar */}
        <div className={cn("flex items-center gap-2 mt-8 transition-opacity duration-500", isFocusMode ? "opacity-10 hover:opacity-100" : "opacity-100")}>
          {REACTIONS.map((emoji) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.3, y: -4 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => sendReaction(emoji)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-secondary text-xl transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right Sidebar - Live Reactions feed */}
      <Card className="hidden lg:flex w-64 flex-col dim-in-focus overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/50">
          <h3 className="font-bold text-white text-sm">Live Reactions</h3>
          <p className="text-xs text-muted-foreground mt-1">React to cheer your study buddies</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence>
            {reactions.slice().reverse().map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 bg-secondary/30 px-3 py-2 rounded-xl"
              >
                <span className="text-2xl">{r.emoji}</span>
                <div>
                  <p className="text-xs font-medium text-white">{r.username}</p>
                  <p className="text-[10px] text-muted-foreground">just reacted</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {reactions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs text-center gap-2 pt-8">
              <span className="text-3xl">👋</span>
              React below to hype up the room!
            </div>
          )}
        </div>

        {/* Ambient on mobile */}
        <div className="p-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
          <div className="flex gap-1 flex-wrap">
            {AMBIENT_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setAmbientTheme(t.id)}
                title={t.label}
                className={cn(
                  "w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all",
                  ambientTheme === t.id
                    ? "bg-primary/20 border border-primary"
                    : "hover:bg-secondary border border-transparent"
                )}
              >
                {t.emoji}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
