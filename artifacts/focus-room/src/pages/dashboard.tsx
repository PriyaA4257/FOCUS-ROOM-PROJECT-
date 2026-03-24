import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getActivity, listSessions } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { Card } from "@/components/ui";
import { Achievements } from "@/components/achievements";
import { Clock, Flame, CheckCircle2, Target, CalendarDays } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { authHeaders, user } = useAuthApi();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: () => getDashboard({ headers: authHeaders }),
  });

  const { data: activity } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    queryFn: () => getActivity({ days: 7 }, { headers: authHeaders }),
  });

  const { data: sessions } = useQuery({
    queryKey: ["/api/sessions"],
    queryFn: () => listSessions({ limit: 5 }, { headers: authHeaders }),
  });

  // Focus vs Break ratio data
  const focusMinutes = stats?.weeklyMinutes || 0;
  const breakMinutes = Math.round(focusMinutes / 5);
  const pieData = [
    { name: "Focus", value: focusMinutes || 1, fill: "hsl(var(--primary))" },
    { name: "Break", value: breakMinutes || 1, fill: "hsl(var(--warning))" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Welcome back, <span className="text-primary font-medium">{user?.username}</span>. Here's your progress.
          </p>
        </div>
        {(stats?.currentStreak || 0) > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border border-warning/30 rounded-2xl">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-warning font-bold text-lg leading-none">{stats?.currentStreak} day streak!</p>
              <p className="text-xs text-muted-foreground">Keep it going!</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock, label: "Today's Focus", value: `${stats?.todayMinutes || 0}m`, color: "text-primary", bg: "bg-primary/20" },
          { icon: Flame, label: "Current Streak", value: `${stats?.currentStreak || 0} days`, color: "text-warning", bg: "bg-warning/20" },
          { icon: Target, label: "Weekly Total", value: `${stats?.weeklyMinutes || 0}m`, color: "text-accent", bg: "bg-accent/20" },
          { icon: CheckCircle2, label: "Sessions Done", value: stats?.completedSessions || 0, color: "text-success", bg: "bg-success/20" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart - 7-day activity */}
        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold font-display">Study Hours — 7 Days</h3>
            <div className="text-sm px-3 py-1 bg-secondary rounded-full text-muted-foreground">Minutes</div>
          </div>
          <div className="flex-1 min-h-[220px]">
            {activity && activity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(val) => format(parseISO(val), "E")} stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", color: "white", fontSize: "13px" }}
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#focusGrad)"
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <span className="text-4xl">📊</span>
                <p>No activity data yet — start a session!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Focus vs Break Pie */}
        <Card className="p-6 flex flex-col">
          <h3 className="text-xl font-bold font-display mb-4">Focus vs Break</h3>
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: "12px" }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", color: "white", fontSize: "12px" }}
                  formatter={(val: number) => [`${val}m`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Weekly goal ring */}
            <div className="relative w-24 h-24 flex items-center justify-center mt-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" className="stroke-secondary fill-none" strokeWidth="8" />
                <circle
                  cx="48" cy="48" r="40"
                  className="stroke-accent fill-none transition-all duration-1000"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min((stats?.goalProgressPercent || 0) / 100, 1))}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg font-bold font-display text-white">{Math.round(stats?.goalProgressPercent || 0)}%</span>
                <span className="text-[10px] text-muted-foreground">goal</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Achievements */}
      <Card className="p-6">
        <Achievements
          stats={{
            completedSessions: stats?.completedSessions,
            currentStreak: stats?.currentStreak,
            totalMinutes: (stats?.weeklyMinutes || 0) * 4,
            weeklyMinutes: stats?.weeklyMinutes,
          }}
        />
      </Card>

      {/* Recent Sessions */}
      <Card className="p-6">
        <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
          <CalendarDays className="text-primary" size={20} />
          Recent Sessions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground text-sm">
                <th className="pb-3 font-medium">Room</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Duration</th>
                <th className="pb-3 font-medium">🍅</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions?.map((session) => (
                <motion.tr
                  key={session.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  <td className="py-4 text-white font-medium">{session.roomName || "Private Session"}</td>
                  <td className="py-4 text-muted-foreground">{format(parseISO(session.startTime), "MMM d, h:mm a")}</td>
                  <td className="py-4 text-muted-foreground">{session.durationMinutes ? `${session.durationMinutes}m` : "-"}</td>
                  <td className="py-4 text-muted-foreground">{session.pomodorosCompleted}</td>
                  <td className="py-4">
                    {session.completed ? (
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full font-medium">✓ Done</span>
                    ) : (
                      <span className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded-full font-medium">In progress</span>
                    )}
                  </td>
                </motion.tr>
              ))}
              {!sessions?.length && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">⏳</span>
                      No sessions recorded yet. Time to focus!
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string | number; color: string; bg: string }) {
  return (
    <Card className={cn("p-5 flex items-center gap-4 group hover:border-primary/30 transition-all cursor-default card-hover")}>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", bg, color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-2xl font-display font-bold text-white mt-0.5">{value}</p>
      </div>
    </Card>
  );
}
