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
  Video, ExternalLink, Check, X, PlusCircle,
  Camera, CameraOff, Send, MessageSquare, Mic, MicOff
} from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const REACTIONS = ["👍", "👏", "🔥", "❤️", "😄", "🎉", "💪", "🤯"];

// ── Webcam + Mic Panel ───────────────────────────────────────────────
function MediaPanel() {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  const [camOn,     setCamOn]     = useState(false);
  const [micOn,     setMicOn]     = useState(false);
  const [micLevel,  setMicLevel]  = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // KEY FIX: assign srcObject AFTER the <video> element mounts/updates
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
    }
  }, [camOn]);

  // Cleanup on unmount
  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
  }, []);

  const toggleCamera = async () => {
    if (camOn) {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      setCamOn(false);
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        camStreamRef.current = s;
        setCamOn(true);   // video element mounts → useEffect assigns srcObject
        setMediaError(null);
      } catch {
        setMediaError("Camera access denied — check browser permissions.");
      }
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setMicLevel(0);
      setMicOn(false);
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = s;

        // Live mic level via Web Audio API
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(s).connect(analyser);

        const tick = () => {
          const buf = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          setMicLevel(Math.min(100, avg * 2.5));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();

        setMicOn(true);
        setMediaError(null);
      } catch {
        setMediaError("Mic access denied — check browser permissions.");
      }
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Camera preview */}
      <div className={cn(
        "relative w-full rounded-xl overflow-hidden bg-black/50 border border-border/40 transition-all",
        camOn ? "aspect-video" : "h-16 flex items-center justify-center"
      )}>
        {camOn ? (
          <video ref={videoRef} autoPlay muted playsInline
            className="w-full h-full object-cover scale-x-[-1]" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <Camera size={18} />
            <p className="text-[9px]">Camera off</p>
          </div>
        )}
        {camOn && (
          <span className="absolute bottom-1 left-1 text-[8px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">
            You (muted)
          </span>
        )}
        {/* Mic speaking ring on camera */}
        {camOn && micOn && micLevel > 15 && (
          <div className="absolute inset-0 rounded-xl border-2 border-primary/70 pointer-events-none animate-pulse" />
        )}
      </div>

      {/* Mic level bar */}
      {micOn && (
        <div className="flex items-center gap-2">
          <Mic size={10} className="text-primary shrink-0" />
          <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full"
              animate={{ width: `${micLevel}%` }}
              transition={{ duration: 0.08 }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={toggleCamera}
          className={cn(
            "flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
            camOn
              ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
              : "bg-secondary/60 text-muted-foreground border border-transparent hover:bg-secondary"
          )}>
          {camOn ? <><CameraOff size={11} /> Off</> : <><Camera size={11} /> Camera</>}
        </button>

        <button onClick={toggleMic}
          className={cn(
            "flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
            micOn
              ? "bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30"
              : "bg-secondary/60 text-muted-foreground border border-transparent hover:bg-secondary"
          )}>
          {micOn ? <><Mic size={11} /> Mute</> : <><MicOff size={11} /> Mic</>}
        </button>
      </div>

      {mediaError && (
        <p className="text-[9px] text-destructive leading-snug">{mediaError}</p>
      )}
    </div>
  );
}

// ── Main Room Component ──────────────────────────────────────────────
export default function RoomDetail() {
  const [, params] = useRoute("/rooms/:roomId");
  const roomId     = params?.roomId || "";
  const { authHeaders, user } = useAuthApi();
  const [, setLocation]       = useLocation();
  const queryClient           = useQueryClient();

  const [isFullscreen,     setIsFullscreen]     = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndConfirm,   setShowEndConfirm]   = useState(false);
  const [editingMeetLink,  setEditingMeetLink]  = useState(false);
  const [meetLinkInput,    setMeetLinkInput]    = useState("");
  const [localMeetLink,    setLocalMeetLink]    = useState<string | null | undefined>(undefined);
  const [messageInput,     setMessageInput]     = useState("");

  // Session + timer refs
  const sessionIdRef      = useRef<string | null>(null);
  const sessionCreatedRef = useRef(false);
  const localPomodorosRef = useRef(0);
  const autoSkipFiredRef  = useRef(false);
  const autoStartedRef    = useRef(false);
  const prevPhaseRef      = useRef<string | null>(null);
  const messagesEndRef    = useRef<HTMLDivElement>(null);

  const { ambientTheme, setAmbientTheme } = useThemeStore();

  // ── Fetch room ──────────────────────────────────────────────
  const { data: initialRoom, isLoading, isError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    queryFn:  () => getRoom(roomId, { headers: authHeaders }),
    retry: false,
  });

  useEffect(() => {
    if (initialRoom && localMeetLink === undefined) {
      const ml = (initialRoom as any).meetLink ?? null;
      setLocalMeetLink(ml);
      setMeetLinkInput(ml ?? "");
    }
  }, [initialRoom]);

  // ── Session helpers ─────────────────────────────────────────
  const createSession = useCallback(async () => {
    if (sessionCreatedRef.current || !roomId) return;
    sessionCreatedRef.current = true;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/sessions`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) sessionIdRef.current = (await res.json()).id;
    } catch {}
  }, [roomId, authHeaders]);

  const completeSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    try {
      await fetch(`${import.meta.env.BASE_URL}api/sessions/${sid}/complete`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ pomodorosCompleted: localPomodorosRef.current }),
      });
    } catch {}
  }, [authHeaders]);

  // ── Join room ───────────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId, {}, { headers: authHeaders }),
  });

  useEffect(() => {
    if (initialRoom) {
      localStorage.setItem("focus_last_room_id",   roomId);
      localStorage.setItem("focus_last_room_name", initialRoom.name);
      const alreadyIn = initialRoom.participants?.find((p: any) => p.userId === user?.id);
      if (!alreadyIn) joinMutation.mutate();
      createSession();
    }
  }, [initialRoom?.id]);

  // ── Leave / end ─────────────────────────────────────────────
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

  // ── Meet link ────────────────────────────────────────────────
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

  // ── Socket ───────────────────────────────────────────────────
  const {
    isConnected, roomState, timerState, messages,
    reactions, meetLink: socketMeetLink,
    sendReaction, sendMessage
  } = useRoomSocket(roomId);

  useEffect(() => {
    if (socketMeetLink !== null) setLocalMeetLink(socketMeetLink);
  }, [socketMeetLink]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Derived state ────────────────────────────────────────────
  const activeRoom  = roomState  || initialRoom;
  const activeTimer = timerState || initialRoom?.timerState;

  // FIX: always use initialRoom.hostId so the roomState socket event
  // (which lacks hostId) does NOT break host detection
  const isHost = initialRoom?.hostId === user?.id;
  const activeMeetLink = localMeetLink !== undefined ? localMeetLink : null;

  // ── Local countdown ──────────────────────────────────────────
  const [localTime, setLocalTime] = useState(activeTimer?.timeRemaining ?? 0);

  useEffect(() => {
    if (activeTimer) {
      setLocalTime(activeTimer.timeRemaining);
      autoSkipFiredRef.current = false;
    }
  }, [activeTimer?.timeRemaining, activeTimer?.phase]);

  useEffect(() => {
    if (!activeTimer?.isRunning) return;
    const iv = setInterval(() => setLocalTime(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [activeTimer?.isRunning]);

  // ── Timer action mutation ────────────────────────────────────
  const timerMutation = useMutation({
    mutationFn: (action: TimerUpdateRequestAction) =>
      updateTimer(roomId, { action }, { headers: authHeaders }),
  });

  // Auto-advance when timer hits 0 (host only)
  useEffect(() => {
    if (localTime === 0 && activeTimer?.isRunning && isHost && !autoSkipFiredRef.current) {
      autoSkipFiredRef.current = true;
      if (activeTimer.phase === "focus") localPomodorosRef.current += 1;
      const t = setTimeout(() => timerMutation.mutate(TimerUpdateRequestAction.skip), 1500);
      return () => clearTimeout(t);
    }
  }, [localTime, activeTimer?.isRunning, activeTimer?.phase, isHost]);

  // Auto-start for host on idle
  useEffect(() => {
    if (isHost && activeTimer?.phase === "idle" && !activeTimer?.isRunning && !autoStartedRef.current && activeRoom) {
      autoStartedRef.current = true;
      const t = setTimeout(() => timerMutation.mutate(TimerUpdateRequestAction.start), 2500);
      return () => clearTimeout(t);
    }
  }, [isHost, activeTimer?.phase, activeTimer?.isRunning, activeRoom?.id]);

  // Phase notifications
  useEffect(() => {
    if (!activeTimer) return;
    requestNotificationPermission();
    const prev = prevPhaseRef.current;
    if (prev === "focus" && activeTimer.phase === "break") notifySessionComplete(activeTimer.pomodoroCount);
    if (prev === "break" && activeTimer.phase === "focus")  notifyBreakOver();
    prevPhaseRef.current = activeTimer.phase;
  }, [activeTimer?.phase]);

  // Focus mode
  useEffect(() => {
    const active = activeTimer?.phase === "focus" && !!activeTimer.isRunning;
    document.body.classList.toggle("focus-mode-active", active);
    return () => document.body.classList.remove("focus-mode-active");
  }, [activeTimer?.phase, activeTimer?.isRunning]);

  // Complete session on tab close
  useEffect(() => {
    window.addEventListener("beforeunload", completeSession);
    return () => window.removeEventListener("beforeunload", completeSession);
  }, [completeSession]);

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput.trim());
      setMessageInput("");
    }
  };

  // ── Guards ───────────────────────────────────────────────────
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

  const isBreak   = activeTimer?.phase === "break";
  const totalDur  = activeTimer
    ? (isBreak ? activeRoom.breakDuration : activeRoom.focusDuration) * 60 : 1;
  const progress  = Math.max(0, Math.min(1, 1 - (localTime / totalDur)));
  const circum    = 2 * Math.PI * 38; // smaller ring radius 38

  return (
    <div className="h-full flex flex-col gap-2">

      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 dim-in-focus shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/rooms")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-white transition-colors text-sm group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Rooms
          </button>
          <span className="text-border/70">|</span>
          <h2 className="font-bold text-white text-sm">{activeRoom.name}</h2>
          <span className={cn("flex items-center gap-1 text-xs font-medium", isConnected ? "text-success" : "text-warning")}>
            <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-success" : "bg-warning animate-pulse")} />
            {isConnected ? "Live" : "Reconnecting"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeMeetLink && (
            <a href={activeMeetLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#34A853]/15 border border-[#34A853]/30 text-[#34A853] text-xs font-semibold hover:bg-[#34A853]/25 transition-colors">
              <Video size={13} /> Join Meet <ExternalLink size={10} />
            </a>
          )}
          {isHost && !editingMeetLink && (
            <button onClick={() => setEditingMeetLink(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#34A853] transition-colors px-2 py-1.5 rounded-lg border border-dashed border-border hover:border-[#34A853]/40">
              <PlusCircle size={12} />
              {activeMeetLink ? "Edit Meet" : "Add Meet"}
            </button>
          )}
          {isHost ? (
            !showEndConfirm
              ? <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 gap-1 h-7 text-xs px-2"
                  onClick={() => setShowEndConfirm(true)}>
                  <Trash2 size={12} /> End
                </Button>
              : <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/30 px-2 py-1 rounded-lg">
                  <span className="text-[11px] text-destructive font-medium">End session?</span>
                  <button onClick={() => deleteMutation.mutate()} className="text-destructive"><Check size={13} /></button>
                  <button onClick={() => setShowEndConfirm(false)} className="text-muted-foreground"><X size={13} /></button>
                </div>
          ) : (
            !showLeaveConfirm
              ? <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive gap-1 h-7 text-xs px-2"
                  onClick={() => setShowLeaveConfirm(true)}>
                  <LogOut size={12} /> Leave
                </Button>
              : <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/30 px-2 py-1 rounded-lg">
                  <span className="text-[11px] text-destructive font-medium">Leave?</span>
                  <button onClick={() => leaveMutation.mutate()} className="text-destructive"><Check size={13} /></button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="text-muted-foreground"><X size={13} /></button>
                </div>
          )}
          <Button size="icon" variant="ghost" className="text-muted-foreground w-7 h-7" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
      </div>

      {/* ── Meet link editor ─────────────────────────────── */}
      <AnimatePresence>
        {isHost && editingMeetLink && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden shrink-0 dim-in-focus">
            <div className="flex-1 relative">
              <Video size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34A853]" />
              <Input value={meetLinkInput} onChange={e => setMeetLinkInput(e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                className="pl-8 text-sm h-9" autoFocus />
            </div>
            <Button size="sm" onClick={() => meetLinkMutation.mutate(meetLinkInput)}
              disabled={meetLinkMutation.isPending}
              className="bg-[#34A853] hover:bg-[#34A853]/80 text-white shrink-0 h-9">
              {meetLinkMutation.isPending ? "…" : "Save"}
            </Button>
            {activeMeetLink && (
              <Button size="sm" variant="ghost" className="text-destructive shrink-0 h-9"
                onClick={() => meetLinkMutation.mutate("")}>Remove</Button>
            )}
            <Button size="sm" variant="ghost" className="shrink-0 h-9"
              onClick={() => setEditingMeetLink(false)}>Cancel</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body: Participants + Chat ─────────────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* Floating emoji reactions */}
        {reactions.map(r => (
          <div key={r.id} className="reaction-float"
            style={{ left: `${30 + Math.random() * 40}%`, bottom: "20%" }}>
            {r.emoji}
          </div>
        ))}

        {/* ── Left Panel: Participants + Camera + Ambient ── */}
        <Card className="hidden md:flex w-52 shrink-0 flex-col p-3 dim-in-focus overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Users size={11} /> Participants
            </span>
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground">
              {activeRoom.participants?.length || 0}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {activeRoom.participants?.map((p: any) => (
              <div key={p.userId} className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <span className="text-base">{p.avatar || "🧑‍💻"}</span>
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-success border border-card rounded-full" />
                </div>
                <span className="text-xs text-white font-medium truncate flex-1">{p.username}</span>
                {p.isHost && <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded font-bold">HOST</span>}
              </div>
            ))}
          </div>

          {/* Camera + Mic */}
          <div className="border-t border-border/50 pt-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Camera &amp; Mic
            </p>
            <MediaPanel />
          </div>

          {/* Ambient */}
          <div className="border-t border-border/50 pt-3 mt-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Ambient</p>
            <div className="grid grid-cols-3 gap-1">
              {AMBIENT_THEMES.map(t => (
                <button key={t.id} onClick={() => setAmbientTheme(t.id)} title={t.label}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all",
                    ambientTheme === t.id
                      ? "bg-primary/20 border border-primary"
                      : "hover:bg-secondary border border-transparent"
                  )}>
                  <span className="text-sm">{t.emoji}</span>
                  <span className={cn("text-[8px] font-medium", ambientTheme === t.id ? "text-primary" : "text-muted-foreground")}>
                    {t.label.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Center: Chat ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 bg-card/30 rounded-2xl border border-border/50 backdrop-blur-sm overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0 dim-in-focus">
            <MessageSquare size={15} className="text-primary" />
            <h3 className="font-semibold text-white text-sm">Room Chat</h3>
            <span className="text-xs text-muted-foreground ml-auto">Share thoughts, ask doubts, discuss ideas</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                  <MessageSquare size={40} className="opacity-20 mb-3" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Start the conversation — ask a question or share a thought!</p>
                </motion.div>
              )}
              {messages.map(msg => {
                const isOwn = msg.userId === user?.id;
                return (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-2.5", isOwn && "flex-row-reverse")}>
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-sm shrink-0">
                      {activeRoom.participants?.find((p: any) => p.userId === msg.userId)?.avatar || "🧑‍💻"}
                    </div>
                    <div className={cn("max-w-[75%]", isOwn && "items-end flex flex-col")}>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className={cn("text-[11px] font-semibold", isOwn ? "text-primary" : "text-muted-foreground")}>
                          {isOwn ? "You" : msg.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className={cn(
                        "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                        isOwn
                          ? "bg-primary/20 text-white rounded-tr-sm"
                          : "bg-secondary/60 text-white rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage}
            className="flex items-center gap-2 p-3 border-t border-border/50 shrink-0 bg-card/50 dim-in-focus">
            <input
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              placeholder="Type a message, question, or thought…"
              className="flex-1 bg-secondary/40 text-white placeholder:text-muted-foreground/60 text-sm px-4 py-2.5 rounded-xl border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
              maxLength={500}
            />
            <button type="submit" disabled={!messageInput.trim()}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0",
                messageInput.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  : "bg-secondary/40 text-muted-foreground/40 cursor-not-allowed"
              )}>
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Bottom: Timer Bar ─────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-card/50 rounded-2xl border border-border/50 backdrop-blur-sm dim-in-focus">

        {/* Mini timer ring */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 88, height: 88 }}>
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r="38" className="stroke-secondary fill-none" strokeWidth="6" />
            <motion.circle cx="44" cy="44" r="38"
              className={cn("fill-none", isBreak ? "stroke-warning" : "stroke-primary")}
              strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circum}
              animate={{ strokeDashoffset: circum * (1 - progress) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center leading-none">
            <span className="text-[11px] font-bold tabular-nums text-white">{formatTime(localTime)}</span>
            <span className={cn("text-[9px] font-semibold uppercase", isBreak ? "text-warning" : "text-primary")}>
              {activeTimer?.phase === "idle" ? "READY"
                : localTime === 0 && activeTimer?.isRunning ? "…"
                : activeTimer?.phase ?? "READY"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isHost ? (
            <>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => { autoStartedRef.current = false; autoSkipFiredRef.current = false; timerMutation.mutate(TimerUpdateRequestAction.reset); }}
                disabled={timerMutation.isPending}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground transition-colors">
                <RotateCcw size={14} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                onClick={() => timerMutation.mutate(activeTimer?.isRunning ? TimerUpdateRequestAction.pause : TimerUpdateRequestAction.start)}
                disabled={timerMutation.isPending}
                className={cn(
                  "w-11 h-11 flex items-center justify-center rounded-full transition-all shadow-lg font-bold",
                  isBreak
                    ? "bg-warning text-warning-foreground shadow-warning/30 hover:bg-warning/90"
                    : "bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90"
                )}>
                {activeTimer?.isRunning ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => { if (activeTimer?.phase === "focus") localPomodorosRef.current += 1; timerMutation.mutate(TimerUpdateRequestAction.skip); }}
                disabled={timerMutation.isPending}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground transition-colors">
                <SkipForward size={14} />
              </motion.button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary/30">
              Host controls timer
            </span>
          )}
        </div>

        {/* Pomodoro count */}
        <div className="text-xs text-muted-foreground shrink-0">
          🍅 <span className="font-bold text-white">{activeTimer?.pomodoroCount ?? 0}</span> pomodoros
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border/50 shrink-0 hidden sm:block" />

        {/* Emoji reactions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {REACTIONS.map(emoji => (
            <motion.button key={emoji}
              whileHover={{ scale: 1.3, y: -3 }} whileTap={{ scale: 0.85 }}
              onClick={() => sendReaction(emoji)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/50 hover:bg-secondary text-base transition-colors">
              {emoji}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
