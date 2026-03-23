import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, GetLeaderboardPeriod } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { Card, Button } from "@/components/ui";
import { Trophy, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Leaderboard() {
  const { authHeaders } = useAuthApi();
  const [period, setPeriod] = useState<GetLeaderboardPeriod>(GetLeaderboardPeriod.weekly);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["/api/leaderboard", period],
    queryFn: () => getLeaderboard({ period, limit: 10 }, { headers: authHeaders }),
  });

  const periods = [
    { id: GetLeaderboardPeriod.daily, label: "Daily" },
    { id: GetLeaderboardPeriod.weekly, label: "Weekly" },
    { id: GetLeaderboardPeriod.monthly, label: "Monthly" },
    { id: GetLeaderboardPeriod.alltime, label: "All Time" },
  ];

  return (
    <div className="space-y-8 pb-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 text-accent">
          <Trophy size={32} />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-muted-foreground text-lg">Top focused students.</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-secondary p-1 rounded-xl">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                period === p.id 
                  ? "bg-primary text-white shadow-md" 
                  : "text-muted-foreground hover:text-white hover:bg-background/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/50 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {entries?.map((entry) => (
              <div 
                key={entry.userId} 
                className={cn(
                  "flex items-center p-4 md:p-6 transition-colors",
                  entry.isCurrentUser ? "bg-primary/10 relative" : "hover:bg-secondary/30"
                )}
              >
                {entry.isCurrentUser && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                
                <div className="w-12 text-center font-display font-bold text-xl text-muted-foreground">
                  {entry.rank === 1 ? <span className="text-yellow-400">1</span> :
                   entry.rank === 2 ? <span className="text-slate-300">2</span> :
                   entry.rank === 3 ? <span className="text-amber-600">3</span> :
                   entry.rank}
                </div>
                
                <div className="flex items-center gap-4 flex-1">
                  <img 
                    src={entry.avatar || `${import.meta.env.BASE_URL}images/avatar-placeholder.png`} 
                    alt={entry.username} 
                    className="w-12 h-12 rounded-full object-cover bg-secondary"
                  />
                  <div>
                    <h4 className="font-bold text-white text-lg">{entry.username}</h4>
                    {entry.isCurrentUser && <span className="text-xs text-primary font-medium">You</span>}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Flame size={12}/> Streak</span>
                    <span className="font-semibold text-white">{entry.currentStreak} days</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12}/> Focus Time</span>
                    <span className="font-bold text-primary text-lg">{entry.focusMinutes}m</span>
                  </div>
                </div>
              </div>
            ))}
            {entries?.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                No data for this period yet.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
