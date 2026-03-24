import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  rarity: "bronze" | "silver" | "gold" | "platinum";
}

function getBadges(stats: {
  completedSessions?: number;
  currentStreak?: number;
  totalMinutes?: number;
  weeklyMinutes?: number;
}): Badge[] {
  const sessions = stats.completedSessions || 0;
  const streak = stats.currentStreak || 0;
  const totalMin = stats.totalMinutes || 0;

  return [
    {
      id: "first-session",
      icon: "🌱",
      title: "Beginner",
      description: "Complete your first study session",
      earned: sessions >= 1,
      rarity: "bronze",
    },
    {
      id: "five-sessions",
      icon: "📚",
      title: "Bookworm",
      description: "Complete 5 study sessions",
      earned: sessions >= 5,
      rarity: "bronze",
    },
    {
      id: "streak-3",
      icon: "🔥",
      title: "On Fire",
      description: "Maintain a 3-day streak",
      earned: streak >= 3,
      rarity: "silver",
    },
    {
      id: "consistent",
      icon: "⚡",
      title: "Consistent Learner",
      description: "Maintain a 7-day streak",
      earned: streak >= 7,
      rarity: "silver",
    },
    {
      id: "twenty-sessions",
      icon: "🎯",
      title: "Dedicated",
      description: "Complete 20 study sessions",
      earned: sessions >= 20,
      rarity: "gold",
    },
    {
      id: "ten-hours",
      icon: "⏰",
      title: "Time Keeper",
      description: "Study for 10 total hours",
      earned: totalMin >= 600,
      rarity: "gold",
    },
    {
      id: "deep-focus",
      icon: "🧠",
      title: "Deep Focus Master",
      description: "Study for 50 total hours",
      earned: totalMin >= 3000,
      rarity: "platinum",
    },
    {
      id: "streak-30",
      icon: "💎",
      title: "Iron Will",
      description: "Maintain a 30-day streak",
      earned: streak >= 30,
      rarity: "platinum",
    },
  ];
}

const rarityStyles = {
  bronze:   { border: "border-orange-700/50",   bg: "bg-orange-900/20",  text: "text-orange-400",   glow: "shadow-orange-900/30" },
  silver:   { border: "border-slate-400/50",     bg: "bg-slate-600/20",   text: "text-slate-300",    glow: "shadow-slate-700/30" },
  gold:     { border: "border-yellow-500/60",    bg: "bg-yellow-900/20",  text: "text-yellow-400",   glow: "shadow-yellow-900/40" },
  platinum: { border: "border-purple-400/60",    bg: "bg-purple-900/20",  text: "text-purple-300",   glow: "shadow-purple-900/40" },
};

export function Achievements({ stats }: { stats: Parameters<typeof getBadges>[0] }) {
  const badges = getBadges(stats);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold font-display flex items-center gap-2">
          🏆 Achievements
        </h3>
        <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
          {earned} / {badges.length} earned
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {badges.map((badge, i) => {
          const style = rarityStyles[badge.rarity];
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-2xl border text-center transition-all",
                badge.earned
                  ? cn(style.border, style.bg, `shadow-lg ${style.glow}`, "badge-earned")
                  : "border-border/30 bg-secondary/10 opacity-40 grayscale",
              )}
            >
              <span className="text-3xl mb-2">{badge.icon}</span>
              <p className={cn("text-xs font-bold mb-1", badge.earned ? style.text : "text-muted-foreground")}>
                {badge.title}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{badge.description}</p>
              {badge.earned && (
                <span className={cn("mt-2 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide", style.text, style.bg)}>
                  {badge.rarity}
                </span>
              )}
              {!badge.earned && (
                <span className="mt-2 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide text-muted-foreground bg-secondary/30">
                  locked
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
