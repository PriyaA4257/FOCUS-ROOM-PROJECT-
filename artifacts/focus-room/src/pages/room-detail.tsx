import React, { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoom, updateTimer, joinRoom, TimerUpdateRequestAction } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useRoomSocket } from "@/hooks/use-socket";
import { useThemeStore, AMBIENT_THEMES } from "@/hooks/use-theme";
import { notifySessionComplete, notifyBreakOver, requestNotificationPermission } from "@/hooks/use-notifications";
import { Card, Button, Input } from "@/components/ui";
import { Users, Play, Pause, RotateCcw, SkipForward, Maximize2, Minimize2, ArrowLeft, LogOut, Trash2, Video, ExternalLink, Check, X } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const REACTIONS = ["👍", "👏", "🔥", "❤️", "😄", "🎉", "💪", "🤯"];

export default function RoomDetail() {
  const [, params] = useRoute("/rooms/:roomId");
  const roomId = params?.roomId || "";
  const { authHeaders, user } = useAuthApi();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [editingMeetLink, setEditingMeetLink] = useState(false);
  const [meetLinkInput, setMeetLinkInput] = useState("");
  const prevPhaseRef = useRef<string | null>(null);
  const prevIsRunningRef = useRef<boolean>(false);
  const { ambientTheme, setAmbientTheme } = useThemeStore();

  const { data: initialRoom, isLoading, isError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    queryFn: () => getRoom(roomId, { headers: authHeaders }),
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId, {}, { headers: authHeaders }),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to leave room");
    },
    onSuccess: () => {
      localStorage.removeItem("focus_last_room_id");
      localStorage.removeItem("focus_last_room_name");
      setLocation("/rooms");
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to end room");
    },
    onSuccess: () => {
      localStorage.removeItem("focus_last_room_id");
      localStorage.removeItem("focus_last_room_name");
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setLocation("/rooms");
    },
  });

  const updateMeetLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}/meet-link`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ meetLink: link || null }),
      });
      if (!res.ok) throw new Error("Failed to update meet link");
      return res.json();
    },
    onSuccess: () => {
      setEditingMeetLink(false);
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomId] });
    },
  });

  useEffect(() => {
    if (initialRoom) {
      localStorage.setItem("focus_last_room_id", roomId);
      localStorage.setItem("focus_last_room_name", initialRoom.name);
      if (!initialRoom.participants.find((p: any) => p.userId === user?.id)) {
        joinMutation.mutate();
      }
      setMeetLinkInput((initialRoom as any).meetLink || "");
    }
  }, [initialRoom, user?.id]);

  const { isConnected, roomState, timerState, reactions, meetLink: socketMeetLink, sendReaction } = useRoomSocket(roomId);

  const activeRoom = roomState || initialRoom;
  const activeTimer = timerState || initialRoom?.timerState;
  const isHost = activeRoom?.hostId === user?.id;
  const activeMeetLink = socketMeetLink !== null ? socketMeetLink : (initialRoom as any)?.meetLink;

  const [localTimeRemaining, setLocalTimeRemaining] = useState(activeTimer?.timeRemaining || 0);

  useEffect(() => {
    if (activeTimer) setLocalTimeRemaining(activeTimer.timeRemaining);
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
    requestNotificationPermission();
    if (prevPhaseRef.current === "focus" && activeTimer.phase === "break") {
      notifySessionComplete(activeTimer.pomodoroCount);
    }
    if (prevPhaseRef.current === "break" && activeTimer.phase === "focus") {
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

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 rounded-full border-b-2 border-primary"
      />
    </div>
  );
  if (isError || !activeRoom) return (
    <div className="text-center py-20">
      <p className="text-destructive text-xl mb-4">Room not found or access denied.</p>
      <Button onClick={() => setLocation("/rooms")}>← Back to Rooms</Button>
    </div>
  );

  const totalDuration = activeTimer
    ? (activeTimer.phase === "focus" ? activeRoom.focusDuration : activeRoom.breakDuration) * 60
    : 1;
  const progress = activeTimer ? 1 - (localTimeRemaining / totalDuration) : 0;
  const isBreak = activeTimer?.phase === "break";
  const circumference = 2 * Math.PI * 120;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Top Bar */}
      <div className="flex items-center justify-between dim-in-focus">
        <button
          onClick={() => setLocation("/rooms")}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm font-medium group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Rooms
        </button>

        <div className="flex items-center gap-2">
          {/* Google Meet link banner */}
          {activeMeetLink && (
            <a
              href={activeMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#34A853]/15 border border-[#34A853]/40 text-[#34A853] text-sm font-semibold hover:bg-[#34A853]/25 transition-colors"
            >
              <Video size={16} />
              Join Google Meet
              <ExternalLink size={13} />
            </a>
          )}

          {/* End / Leave buttons */}
          {isHost ? (
            !showEndConfirm ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => setShowEndConfirm(true)}
              >
                <Trash2 size={15} /> End Session
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-destructive font-medium">End for everyone?</span>
                <button onClick={() => deleteRoomMutation.mutate()} className="text-destructive hover:opacity-70">
                  <Check size={16} />
                </button>
                <button onClick={() => setShowEndConfirm(false)} className="text-muted-foreground hover:opacity-70">
                  <X size={16} />
                </button>
              </div>
            )
          ) : (
            !showLeaveConfirm ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive gap-1.5"
                onClick={() => setShowLeaveConfirm(true)}
              >
                <LogOut size={15} /> Leave
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-destructive font-medium">Leave room?</span>
                <button onClick={() => leaveMutation.mutate()} className="text-destructive hover:opacity-70">
                  <Check size={16} />
                </button>
                <button onClick={() => setShowLeaveConfirm(false)} className="text-muted-foreground hover:opacity-70">
                  <X size={16} />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Meet Link editor for host (if no link set) */}
      {isHost && !activeMeetLink && (
        <div className="dim-in-focus">
          {!editingMeetLink ? (
            <button
              onClick={() => setEditingMeetLink(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#34A853]/40 text-[#34A853]/70 hover:border-[#34A853] hover:text-[#34A853] text-sm transition-colors"
            >
              <Video size={15} />
              + Add Google Meet link for your participants
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Video size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34A853]" />
                <Input
                  value={meetLinkInput}
                  onChange={(e) => setMeetLinkInput(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="pl-9 text-sm"
                  autoFocus
                />
              </div>
              <Button
                size="sm"
                onClick={() => updateMeetLinkMutation.mutate(meetLinkInput)}
                disabled={updateMeetLinkMutation.isPending}
                className="bg-[#34A853] hover:bg-[#34A853]/90 text-white"
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingMeetLink(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Host can update an existing link */}
      {isHost && activeMeetLink && (
        <div className="flex items-center gap-2 dim-in-focus">
          {!editingMeetLink ? (
            <button
              onClick={() => { setMeetLinkInput(activeMeetLink); setEditingMeetLink(true); }}
              className="text-xs text-muted-foreground hover:text-[#34A853] transition-colors"
            >
              Edit Meet link
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 relative">
                <Video size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34A853]" />
                <Input value={meetLinkInput} onChange={(e) => setMeetLinkInput(e.target.value)} className="pl-9 text-sm" autoFocus />
              </div>
              <Button size="sm" onClick={() => updateMeetLinkMutation.mutate(meetLinkInput)} disabled={updateMeetLinkMutation.isPending} className="bg-[#34A853] hover:bg-[#34A853]/90 text-white">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => updateMeetLinkMutation.mutate("")} className="text-destructive hover:text-destructive">Remove</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingMeetLink(false)}>Cancel</Button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 relative">

        {/* Floating Reactions */}
        {reactions.map((r) => (
          <div
            key={r.id}
            className="reaction-float"
            style={{ left: `${20 + Math.random() * 60}%`, bottom: "20%" }}
          >
            {r.emoji}
          </div>
        ))}

        {/* Left Sidebar - Participants */}
        <Card className="hidden md:flex w-56 flex-col p-4 dim-in-focus overflow-hidden shrink-0">
          <div className="mb-4">
            <h3 className="font-bold text-white text-sm truncate">{activeRoom.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-success" : "bg-warning")} />
              {isConnected ? "Live" : "Reconnecting..."}
            </p>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={12} /> Participants</span>
            <span className="bg-secondary px-1.5 py-0.5 rounded-full">{activeRoom.participants?.length || 0}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 mb-4">
            {activeRoom.participants?.map((p: any) => (
              <div key={p.userId} className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <span className="text-lg">{p.avatar || "🧑‍💻"}</span>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-success border-2 border-card rounded-full" />
                </div>
                <span className="text-sm text-white font-medium truncate flex-1">{p.username}</span>
                {p.isHost && <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded uppercase font-bold shrink-0">Host</span>}
              </div>
            ))}
          </div>

          {/* Ambient picker */}
          <div className="border-t border-border/50 pt-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
            <div className="grid grid-cols-5 gap-1">
              {AMBIENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAmbientTheme(t.id)}
                  title={t.label}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all",
                    ambientTheme === t.id
                      ? "bg-primary/20 border border-primary scale-110"
                      : "hover:bg-secondary border border-transparent"
                  )}
                >
                  {t.emoji}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Center - Timer */}
        <div className="flex-1 flex flex-col items-center justify-center relative bg-card/30 rounded-3xl border border-border/50 backdrop-blur-sm p-6 transition-all duration-500 overflow-hidden min-h-0">

          <Button
            variant="ghost" size="icon"
            className="absolute top-4 right-4 text-muted-foreground dim-in-focus z-10"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </Button>

          <AnimatePresence mode="wait">
            {isBreak && (
              <motion.div
                key="break-banner"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="absolute top-8 text-warning font-display font-bold text-xl tracking-widest uppercase"
              >
                ☕ Take a breather
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer Ring */}
          <motion.div
            className={cn("relative flex items-center justify-center mb-6", activeTimer?.isRunning && "timer-running")}
            style={{ width: 280, height: 280 }}
            animate={activeTimer?.isRunning ? { scale: [1, 1.005, 1] } : { scale: 1 }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          >
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 280 280">
              <circle cx="140" cy="140" r="120" className="stroke-secondary fill-none" strokeWidth="10" />
              <motion.circle
                cx="140" cy="140" r="120"
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {activeTimer?.phase === "idle" ? "READY" : activeTimer?.phase || "READY"}
              </motion.span>
              <span className="text-6xl font-display font-bold text-white tracking-tight tabular-nums">
                {formatTime(localTimeRemaining)}
              </span>
              <span className="text-muted-foreground mt-2 font-medium text-sm">
                🍅 #{activeTimer?.pomodoroCount || 0}
              </span>
            </div>
          </motion.div>

          {/* Controls */}
          <div className={cn("flex items-center gap-4 transition-opacity duration-500", isFocusMode ? "opacity-10 hover:opacity-100" : "opacity-100")}>
            {isHost ? (
              <>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}>
                  <Button size="icon" variant="secondary" onClick={() => timerActionMutation.mutate(TimerUpdateRequestAction.reset)} disabled={timerActionMutation.isPending}>
                    <RotateCcw size={18} />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
                  <Button
                    size="lg"
                    className={cn("w-18 h-18 w-[72px] h-[72px] rounded-full shadow-2xl transition-all", isBreak ? "bg-warning hover:bg-warning/90 shadow-warning/30" : "bg-primary shadow-primary/30")}
                    onClick={() => timerActionMutation.mutate(activeTimer?.isRunning ? TimerUpdateRequestAction.pause : TimerUpdateRequestAction.start)}
                    disabled={timerActionMutation.isPending}
                  >
                    {activeTimer?.isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}>
                  <Button size="icon" variant="secondary" onClick={() => timerActionMutation.mutate(TimerUpdateRequestAction.skip)} disabled={timerActionMutation.isPending}>
                    <SkipForward size={18} />
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
          <div className={cn("flex items-center gap-1.5 mt-6 flex-wrap justify-center transition-opacity duration-500", isFocusMode ? "opacity-10 hover:opacity-100" : "opacity-100")}>
            {REACTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.35, y: -5 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => sendReaction(emoji)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-secondary text-xl transition-colors"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Reactions Feed */}
        <Card className="hidden lg:flex w-56 flex-col dim-in-focus overflow-hidden shrink-0">
          <div className="p-4 border-b border-border/50 bg-card/50">
            <h3 className="font-bold text-white text-sm">Live Reactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cheer your study buddies</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence>
              {reactions.slice().reverse().map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2.5 bg-secondary/30 px-3 py-2 rounded-xl"
                >
                  <span className="text-xl">{r.emoji}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{r.username}</p>
                    <p className="text-[10px] text-muted-foreground">reacted</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {reactions.length === 0 && (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-xs text-center gap-2 pt-8">
                <span className="text-3xl">👋</span>
                React below to hype up the room!
              </div>
            )}
          </div>

          {/* Ambient on this panel too */}
          <div className="p-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
            <div className="flex gap-1 flex-wrap">
              {AMBIENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAmbientTheme(t.id)}
                  title={t.label}
                  className={cn(
                    "w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all",
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
    </div>
  );
}
