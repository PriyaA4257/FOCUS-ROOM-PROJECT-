import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getRoom, updateTimer, joinRoom, TimerUpdateRequestAction } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useRoomSocket } from "@/hooks/use-socket";
import { Card, Button, Input } from "@/components/ui";
import { Users, Send, Settings, Play, Pause, RotateCcw, SkipForward, Maximize2 } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function RoomDetail() {
  const [, params] = useRoute("/rooms/:roomId");
  const roomId = params?.roomId || "";
  const { authHeaders, user } = useAuthApi();
  const [, setLocation] = useLocation();
  const [chatInput, setChatInput] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Initial fetch and join
  const { data: initialRoom, isLoading, isError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    queryFn: () => getRoom(roomId, { headers: authHeaders }),
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId, {}, { headers: authHeaders }),
  });

  useEffect(() => {
    if (initialRoom && !initialRoom.participants.find(p => p.userId === user?.id)) {
      joinMutation.mutate();
    }
  }, [initialRoom, user?.id]);

  // Real-time socket sync
  const { isConnected, roomState, timerState, messages, sendMessage } = useRoomSocket(roomId);
  
  // Use real-time state if available, fallback to initial
  const activeRoom = roomState || initialRoom;
  const activeTimer = timerState || initialRoom?.timerState;
  const isHost = activeRoom?.hostId === user?.id;

  // Sync local timer tick for smooth UI between socket updates
  const [localTimeRemaining, setLocalTimeRemaining] = useState(activeTimer?.timeRemaining || 0);

  useEffect(() => {
    if (activeTimer) {
      setLocalTimeRemaining(activeTimer.timeRemaining);
    }
  }, [activeTimer?.timeRemaining, activeTimer?.phase]);

  useEffect(() => {
    if (activeTimer?.isRunning) {
      const interval = setInterval(() => {
        setLocalTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTimer?.isRunning]);

  // Handle focus mode toggle automatically based on timer phase
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


  const timerActionMutation = useMutation({
    mutationFn: (action: TimerUpdateRequestAction) => updateTimer(roomId, { action }, { headers: authHeaders }),
  });

  const handleTimerAction = (action: TimerUpdateRequestAction) => {
    timerActionMutation.mutate(action);
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput("");
    }
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (isError || !activeRoom) return <div className="text-center py-20 text-destructive">Room not found or access denied.</div>;

  const progress = activeTimer ? 1 - (localTimeRemaining / (activeTimer.phase === 'focus' ? activeRoom.focusDuration * 60 : activeRoom.breakDuration * 60)) : 0;
  const isBreak = activeTimer?.phase === 'break';

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Left Sidebar - Participants */}
      <Card className="hidden md:flex w-64 flex-col p-4 dim-in-focus">
        <h3 className="font-bold text-white mb-1">{activeRoom.name}</h3>
        <p className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success"></span>
          {isConnected ? "Connected" : "Reconnecting..."}
        </p>

        <div className="flex items-center justify-between mb-4 text-sm font-medium text-muted-foreground">
          <span>Participants</span>
          <span className="bg-secondary px-2 py-0.5 rounded-full">{activeRoom.participants?.length || 0}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {activeRoom.participants?.map(p => (
            <div key={p.userId} className="flex items-center gap-3">
              <div className="relative">
                <img src={p.avatar || `${import.meta.env.BASE_URL}images/avatar-placeholder.png`} alt={p.username} className="w-8 h-8 rounded-full bg-secondary" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-card rounded-full"></span>
              </div>
              <span className="text-sm text-white font-medium truncate flex-1">{p.username}</span>
              {p.isHost && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Host</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Center - Timer */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-card/30 rounded-3xl border border-border/50 backdrop-blur-sm p-8 transition-all duration-500">
        
        {/* Fullscreen toggle (visual only for mockup) */}
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-muted-foreground dim-in-focus" onClick={() => document.body.classList.toggle("focus-mode-active")}>
          <Maximize2 size={20} />
        </Button>

        {isBreak && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-10 text-warning font-display font-bold text-2xl tracking-widest uppercase"
          >
            Take a breather
          </motion.div>
        )}

        {/* Circular Timer */}
        <div className="relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center mb-8">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="50%" cy="50%" r="48%" className="stroke-secondary fill-none" strokeWidth="8" />
            <motion.circle 
              cx="50%" cy="50%" r="48%" 
              className={cn("fill-none transition-all duration-1000 ease-linear", isBreak ? "stroke-warning" : "stroke-primary")} 
              strokeWidth="12" 
              strokeLinecap="round"
              initial={{ strokeDasharray: "2000", strokeDashoffset: "2000" }}
              animate={{ 
                strokeDasharray: "2000", 
                strokeDashoffset: 2000 - (2000 * Math.max(0, Math.min(1, progress)))
              }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className={cn("text-lg font-bold tracking-widest uppercase mb-2", isBreak ? "text-warning" : "text-primary")}>
              {activeTimer?.phase === "idle" ? "READY" : activeTimer?.phase}
            </span>
            <span className="text-6xl md:text-8xl font-display font-bold text-white tracking-tight tabular-nums">
              {formatTime(localTimeRemaining)}
            </span>
            <span className="text-muted-foreground mt-4 font-medium">
              Session {activeTimer?.pomodoroCount || 0}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className={cn("flex items-center gap-4 transition-opacity duration-500", isFocusMode ? "opacity-10 hover:opacity-100" : "opacity-100")}>
          {isHost ? (
            <>
              <Button size="icon" variant="secondary" onClick={() => handleTimerAction(TimerUpdateRequestAction.reset)} disabled={timerActionMutation.isPending}>
                <RotateCcw size={20} />
              </Button>
              <Button 
                size="lg" 
                className={cn("w-20 h-20 rounded-full shadow-2xl", isBreak ? "bg-warning hover:bg-warning/90" : "bg-primary")}
                onClick={() => handleTimerAction(activeTimer?.isRunning ? TimerUpdateRequestAction.pause : TimerUpdateRequestAction.start)}
                disabled={timerActionMutation.isPending}
              >
                {activeTimer?.isRunning ? <Pause size={32} className={isBreak ? "text-warning-foreground" : ""} /> : <Play size={32} className="ml-2" />}
              </Button>
              <Button size="icon" variant="secondary" onClick={() => handleTimerAction(TimerUpdateRequestAction.skip)} disabled={timerActionMutation.isPending}>
                <SkipForward size={20} />
              </Button>
            </>
          ) : (
            <div className="px-6 py-3 rounded-full bg-secondary/50 text-muted-foreground text-sm font-medium">
              Only the host can control the timer
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Chat */}
      <Card className="hidden lg:flex w-80 flex-col dim-in-focus overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-card/50">
          <h3 className="font-bold text-white">Room Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex flex-col", msg.userId === user?.id ? "items-end" : "items-start")}>
              <span className="text-xs text-muted-foreground mb-1">{msg.username}</span>
              <div className={cn("px-4 py-2 rounded-2xl max-w-[85%] text-sm", msg.userId === user?.id ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-secondary-foreground rounded-tl-sm")}>
                {msg.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center">
              Say hi to your study buddies!
            </div>
          )}
        </div>

        <form onSubmit={handleChat} className="p-4 border-t border-border/50 bg-card/50">
          <div className="relative">
            <Input 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a message..." 
              className="pr-12 bg-background"
            />
            <Button type="submit" size="icon" variant="ghost" className="absolute right-1 top-1 w-10 h-10 text-primary hover:bg-primary/20">
              <Send size={18} />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
