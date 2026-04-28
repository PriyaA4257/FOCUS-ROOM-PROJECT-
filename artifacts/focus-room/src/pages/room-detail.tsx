import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoom, updateTimer, joinRoom, TimerUpdateRequestAction } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useRoomSocket } from "@/hooks/use-socket";
import { useThemeStore, AMBIENT_THEMES } from "@/hooks/use-theme";
import { notifySessionComplete, notifyBreakOver, requestNotificationPermission } from "@/hooks/use-notifications";
import { Card, Button, Input } from "@/components/ui";
import {
  Users, Play, Pause, RotateCcw, SkipForward,
  Maximize2, Minimize2, ArrowLeft, LogOut, Trash2,
  Video, ExternalLink, Check, X, PlusCircle
} from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const REACTIONS = ["👍", "👏", "🔥", "❤️", "😄", "🎉", "💪", "🤯"];

export default function RoomDetail() {
  const [, params]   = useRoute("/rooms/:roomId");
  const roomId       = params?.roomId || "";
  const { authHeaders, user } = useAuthApi();
  const [, setLocation]       = useLocation();
  const queryClient           = useQueryClient();

  const [isFocusMode,      setIsFocusMode]      = useState(false);
  const [isFullscreen,     setIsFullscreen]      = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm]  = useState(false);
  const [showEndConfirm,   setShowEndConfirm]    = useState(false);
  const [editingMeetLink,  setEditingMeetLink]   = useState(false);
  const [meetLinkInput,    setMeetLinkInput]     = useState("");
  const [localMeetLink,    setLocalMeetLink]     = useState<string | null | undefined>(undefined);

  // ── Session tracking refs ─────────────────────────────────
  const sessionIdRef       = useRef<string | null>(null);
  const sessionCreatedRef  = useRef(false);
  const localPomodorosRef  = useRef(0);        // focus rounds completed this session
  const autoSkipFiredRef   = useRef(false);    // prevent double-fire when timer hits 0
  const prevPhaseRef       = useRef<string | null>(null);
  const autoStartedRef     = useRef(false);

  const { ambientTheme, setAmbientTheme } = useThemeStore();

  // ── Fetch room ────────────────────────────────────────────
  const { data: initialRoom, isLoading, isError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    queryFn: () => getRoom(roomId, { headers: authHeaders }),
    retry: false,
  });

  // ── Seed meet link once ───────────────────────────────────
  useEffect(() => {
    if (initialRoom && localMeetLink === undefined) {
      const ml = (initialRoom as any).meetLink ?? null;
      setLocalMeetLink(ml);
      setMeetLinkInput(ml ?? "");
    }
  }, [initialRoom]);

  // ── Join room + create study session ─────────────────────
  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId, {}, { headers: authHeaders }),
  });

  const createSession = useCallback(async () => {
    if (sessionCreatedRef.current || !roomId) return;
    sessionCreatedRef.current = true;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/sessions`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionIdRef.current = data.id;
      }
    } catch {/* silently ignore */}
  }, [roomId, authHeaders]);

  const completeSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      await fetch(`${import.meta.env.BASE_URL}api/sessions/${sessionIdRef.current}/complete`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ pomodorosCompleted: localPomodorosRef.current }),
      });
      sessionIdRef.current = null;
    } catch {/* silently ignore */}
  }, [authHeaders]);

  useEffect(() => {
    if (initialRoom) {
      localStorage.setItem("focus_last_room_id",   roomId);
      localStorage.setItem("focus_last_room_name",  initialRoom.name);
      const alreadyIn = initialRoom.participants?.find((p: any) => p.userId === user?.id);
      if (!alreadyIn) joinMutation.mutate();
      createSession();
    }
  }, [initialRoom?.id]);

  // ── Leave room mutations ──────────────────────────────────
  const leaveMutation = useMutation({
    mutationFn: async () => {
      await completeSession();
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}/leave`, {
        method: "POST", headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to leave");
    },
    onSuccess: () => {
      localStorage.removeItem("focus_last_room_id");
      localStorage.removeItem("focus_last_room_name");
      setLocation("/rooms");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await completeSession();
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}`, {
        method: "DELETE", headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to end");
    },
    onSuccess: () => {
      localStorage.removeItem("focus_last_room_id");
      localStorage.removeItem("focus_last_room_name");
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setLocation("/rooms");
    },
  });

  // ── Meet link mutation ────────────────────────────────────
  const meetLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/rooms/${roomId}/meet-link`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ meetLink: link || null }),
      });
      if (!res.ok) throw new Error("Failed to update meet link");
      return res.json() as Promise<{ meetLink: string | null }>;
    },
    onSuccess: (data) => {
      setLocalMeetLink(data.meetLink ?? null);
      setMeetLinkInput(data.meetLink ?? "");
      setEditingMeetLink(false);
    },
  });

  // ── Socket ────────────────────────────────────────────────
  const { isConnected, roomState, timerState, reactions, meetLink: socketMeetLink, sendReaction } = useRoomSocket(roomId);

  useEffect(() => {
    if (socketMeetLink !== null) setLocalMeetLink(socketMeetLink);
  }, [socketMeetLink]);

  const activeRoom  = roomState || initialRoom;
  const activeTimer = timerState || initialRoom?.timerState;
  const isHost      = activeRoom?.hostId === user?.id;
  const activeMeetLink = localMeetLink !== undefined ? localMeetLink : null;

  // ── Local countdown ───────────────────────────────────────
  const [localTime, setLocalTime] = useState(activeTimer?.timeRemaining ?? 0);

  useEffect(() => {
    if (activeTimer) {
      setLocalTime(activeTimer.timeRemaining);
      autoSkipFiredRef.current = false; // reset when phase/time changes from server
    }
  }, [activeTimer?.timeRemaining, activeTimer?.phase]);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const iv = setInterval(() => setLocalTime(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [activeTimer?.isRunning]);

  // ── AUTO-ADVANCE: when timer hits 0, host skips to next phase ──
  const timerActionMutation = useMutation({
    mutationFn: (action: TimerUpdateRequestAction) =>
      updateTimer(roomId, { action }, { headers: authHeaders }),
  });

  useEffect(() => {
    if (
      localTime === 0 &&
      activeTimer?.isRunning &&
      isHost &&
      !autoSkipFiredRef.current
    ) {
      autoSkipFiredRef.current = true;
      // Count completed focus round
      if (activeTimer.phase === "focus") {
        localPomodorosRef.current += 1;
      }
      // Small delay so the UI shows 0:00 briefly
      const t = setTimeout(() => {
        timerActionMutation.mutate(TimerUpdateRequestAction.skip);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [localTime, activeTimer?.isRunning, activeTimer?.phase, isHost]);

  // ── AUTO-START for host on idle ───────────────────────────
  useEffect(() => {
    if (
      isHost &&
      activeTimer?.phase === "idle" &&
      !activeTimer?.isRunning &&
      !autoStartedRef.current &&
      activeRoom
    ) {
      autoStartedRef.current = true;
      const t = setTimeout(() => timerActionMutation.mutate(TimerUpdateRequestAction.start), 2500);
      return () => clearTimeout(t);
    }
  }, [isHost, activeTimer?.phase, activeTimer?.isRunning, activeRoom?.id]);

  // ── Phase change notifications ────────────────────────────
  useEffect(() => {
    if (!activeTimer) return;
    requestNotificationPermission();
    const prev = prevPhaseRef.current;
    if (prev === "focus" && activeTimer.phase === "break") notifySessionComplete(activeTimer.pomodoroCount);
    if (prev === "break" && activeTimer.phase === "focus") notifyBreakOver();
    prevPhaseRef.current = activeTimer.phase;
  }, [activeTimer?.phase]);

  // ── Focus mode (dims UI when timer running) ───────────────
  useEffect(() => {
    const active = activeTimer?.phase === "focus" && activeTimer.isRunning;
    document.body.classList.toggle("focus-mode-active", active);
    setIsFocusMode(active);
    return () => document.body.classList.remove("focus-mode-active");
  }, [activeTimer?.phase, activeTimer?.isRunning]);

  // ── Complete session on browser close ─────────────────────
  useEffect(() => {
    const handler = () => { completeSession(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [completeSession]);

  // ── Fullscreen ────────────────────────────────────────────
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Loading / error guards ────────────────────────────────
  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 rounded-full border-b-2 border-primary" />
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
  const progress      = activeTimer ? 1 - (localTime / totalDuration) : 0;
  const isBreak       = activeTimer?.phase === "break";
  const circumference = 2 * Math.PI * 120;

  return (
    <div className="h-full flex flex-col gap-3">

      {/* ── Top Bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 dim-in-focus">
        <button onClick={() => setLocation("/rooms")}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm font-medium group">
          <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
          Back to Rooms
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {activeMeetLink && (
            <a href={activeMeetLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#34A853]/15 border border-[#34A853]/40 text-[#34A853] text-sm font-semibold hover:bg-[#34A853]/25 transition-colors">
              <Video size={15} /> Join Google Meet <ExternalLink size={12} />
            </a>
          )}

          {isHost && !editingMeetLink && (
            <button onClick={() => setEditingMeetLink(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#34A853] transition-colors px-2 py-1.5 rounded-lg border border-dashed border-border hover:border-[#34A853]/50">
              <PlusCircle size={13} />
              {activeMeetLink ? "Edit Meet link" : "Add Meet link"}
            </button>
          )}

          {isHost ? (
            !showEndConfirm
              ? <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={() => setShowEndConfirm(true)}>
                  <Trash2 size={14} /> End Session
                </Button>
              : <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-destructive font-medium">End for everyone?</span>
                  <button onClick={() => deleteMutation.mutate()} className="text-destructive hover:opacity-70"><Check size={15} /></button>
                  <button onClick={() => setShowEndConfirm(false)} className="text-muted-foreground hover:opacity-70"><X size={15} /></button>
                </div>
          ) : (
            !showLeaveConfirm
              ? <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive gap-1.5"
                  onClick={() => setShowLeaveConfirm(true)}>
                  <LogOut size={14} /> Leave
                </Button>
              : <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-destructive font-medium">Leave room?</span>
                  <button onClick={() => leaveMutation.mutate()} className="text-destructive hover:opacity-70"><Check size={15} /></button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="text-muted-foreground hover:opacity-70"><X size={15} /></button>
                </div>
          )}

          <Button size="icon" variant="ghost" className="text-muted-foreground w-8 h-8" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </div>
      </div>

      {/* ── Meet link editor ─────────────────────────────── */}
      <AnimatePresence>
        {isHost && editingMeetLink && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 dim-in-focus overflow-hidden">
            <div className="flex-1 relative">
              <Video size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34A853]" />
              <Input value={meetLinkInput} onChange={e => setMeetLinkInput(e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                className="pl-9 text-sm" autoFocus />
            </div>
            <Button size="sm" onClick={() => meetLinkMutation.mutate(meetLinkInput)}
              disabled={meetLinkMutation.isPending}
              className="bg-[#34A853] hover:bg-[#34A853]/90 text-white shrink-0">
              {meetLinkMutation.isPending ? "Saving…" : "Save"}
            </Button>
            {activeMeetLink && (
              <Button size="sm" variant="ghost" className="text-destructive shrink-0"
                onClick={() => meetLinkMutation.mutate("")}>Remove</Button>
            )}
            <Button size="sm" variant="ghost" className="shrink-0"
              onClick={() => setEditingMeetLink(false)}>Cancel</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main 3-column layout ─────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 relative">

        {/* Floating emoji reactions */}
        {reactions.map(r => (
          <div key={r.id} className="reaction-float"
            style={{ left: `${25 + Math.random() * 50}%`, bottom: "25%" }}>
            {r.emoji}
          </div>
        ))}

        {/* ── Left: Participants + Ambient ──────────────── */}
        <Card className="hidden md:flex w-52 flex-col p-4 dim-in-focus overflow-hidden shrink-0">
          <div className="mb-4">
            <h3 className="font-bold text-white text-sm truncate">{activeRoom.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-success" : "bg-warning")} />
              {isConnected ? "Live" : "Reconnecting…"}
            </p>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={11} /> Participants</span>
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

          <div className="border-t border-border/50 pt-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
            <div className="grid grid-cols-3 gap-1.5">
              {AMBIENT_THEMES.map(t => (
                <button key={t.id} onClick={() => setAmbientTheme(t.id)} title={t.label}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-all",
                    ambientTheme === t.id
                      ? "bg-primary/20 border border-primary"
                      : "hover:bg-secondary border border-transparent"
                  )}>
                  <span className="text-base">{t.emoji}</span>
                  <span className={cn("text-[9px] font-medium", ambientTheme === t.id ? "text-primary" : "text-muted-foreground")}>
                    {t.label.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Center: Timer ─────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center relative bg-card/30 rounded-3xl border border-border/50 backdrop-blur-sm py-8 px-4 overflow-hidden min-h-0">

          <AnimatePresence mode="wait">
            {isBreak && (
              <motion.div key="break"
                initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className="absolute top-6 text-warning font-display font-bold text-xl tracking-widest uppercase">
                ☕ Take a breather
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer ring */}
          <motion.div
            className={cn("relative flex items-center justify-center mb-6", activeTimer?.isRunning && "timer-running")}
            style={{ width: 270, height: 270 }}
            animate={activeTimer?.isRunning ? { scale: [1, 1.006, 1] } : { scale: 1 }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          >
            <svg className="w-full h-full -rotate-90" viewBox="0 0 270 270">
              <circle cx="135" cy="135" r="120" className="stroke-secondary fill-none" strokeWidth="10" />
              <motion.circle cx="135" cy="135" r="120"
                className={cn("fill-none", isBreak ? "stroke-warning" : "stroke-primary")}
                strokeWidth="14" strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, progress))) }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <motion.span key={activeTimer?.phase}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={cn("text-xs font-bold tracking-widest uppercase mb-1", isBreak ? "text-warning" : "text-primary")}>
                {activeTimer?.phase === "idle" ? "STARTING…"
                  : localTime === 0 && activeTimer?.isRunning ? "SWITCHING…"
                  : activeTimer?.phase ?? "READY"}
              </motion.span>
              <span className="text-6xl font-display font-bold text-white tracking-tight tabular-nums">
                {formatTime(localTime)}
              </span>
              <span className="text-muted-foreground mt-2 text-sm">
                🍅 Pomodoro #{activeTimer?.pomodoroCount ?? 0}
              </span>
            </div>
          </motion.div>

          {/* Host timer controls */}
          <div className="flex items-center gap-4 mb-6">
            {isHost ? (
              <>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}>
                  <Button size="icon" variant="secondary"
                    onClick={() => {
                      autoStartedRef.current = false;
                      autoSkipFiredRef.current = false;
                      timerActionMutation.mutate(TimerUpdateRequestAction.reset);
                    }}
                    disabled={timerActionMutation.isPending}>
                    <RotateCcw size={18} />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
                  <Button size="lg"
                    className={cn("w-[72px] h-[72px] rounded-full shadow-2xl transition-all",
                      isBreak ? "bg-warning hover:bg-warning/90 shadow-warning/30" : "bg-primary shadow-primary/30")}
                    onClick={() => timerActionMutation.mutate(
                      activeTimer?.isRunning ? TimerUpdateRequestAction.pause : TimerUpdateRequestAction.start
                    )}
                    disabled={timerActionMutation.isPending}>
                    {activeTimer?.isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}>
                  <Button size="icon" variant="secondary"
                    onClick={() => {
                      if (activeTimer?.phase === "focus") localPomodorosRef.current += 1;
                      timerActionMutation.mutate(TimerUpdateRequestAction.skip);
                    }}
                    disabled={timerActionMutation.isPending}>
                    <SkipForward size={18} />
                  </Button>
                </motion.div>
              </>
            ) : (
              <div className="px-5 py-2.5 rounded-full bg-secondary/50 text-muted-foreground text-sm font-medium">
                Host controls the timer
              </div>
            )}
          </div>

          {/* ── Emoji Reaction Buttons (always visible) ── */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {REACTIONS.map(emoji => (
              <motion.button key={emoji}
                whileHover={{ scale: 1.35, y: -5 }} whileTap={{ scale: 0.85 }}
                onClick={() => sendReaction(emoji)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/60 hover:bg-secondary text-xl transition-colors border border-border/40">
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Right: Reactions Feed + Ambient ──────────── */}
        <Card className="hidden lg:flex w-52 flex-col dim-in-focus overflow-hidden shrink-0">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-bold text-white text-sm">Live Reactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cheer your study buddies</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            <AnimatePresence>
              {reactions.slice().reverse().map(r => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2.5 bg-secondary/30 px-3 py-2 rounded-xl">
                  <span className="text-xl">{r.emoji}</span>
                  <div>
                    <p className="text-xs font-medium text-white leading-tight">{r.username}</p>
                    <p className="text-[10px] text-muted-foreground">reacted</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {reactions.length === 0 && (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-xs text-center gap-2 pt-8">
                <span className="text-3xl">👋</span>
                Click an emoji below to react!
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
            <div className="grid grid-cols-3 gap-1">
              {AMBIENT_THEMES.map(t => (
                <button key={t.id} onClick={() => setAmbientTheme(t.id)} title={t.label}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-all",
                    ambientTheme === t.id
                      ? "bg-primary/20 border border-primary"
                      : "hover:bg-secondary border border-transparent"
                  )}>
                  <span className="text-sm">{t.emoji}</span>
                  <span className={cn("text-[9px]", ambientTheme === t.id ? "text-primary" : "text-muted-foreground")}>
                    {t.label.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
