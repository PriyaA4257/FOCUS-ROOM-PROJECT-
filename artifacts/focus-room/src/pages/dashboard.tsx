import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getActivity, listSessions } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { Card } from "@/components/ui";
import { Clock, Flame, CheckCircle2, Target, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO } from "date-fns";

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

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-lg">Welcome back, <span className="text-primary font-medium">{user?.username}</span>. Here's your progress.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard icon={Clock} label="Today's Focus" value={`${stats?.todayMinutes || 0}m`} color="text-primary" bg="bg-primary/20" />
        <StatCard icon={Flame} label="Current Streak" value={`${stats?.currentStreak || 0} days`} color="text-warning" bg="bg-warning/20" />
        <StatCard icon={Target} label="Weekly Total" value={`${stats?.weeklyMinutes || 0}m`} color="text-accent" bg="bg-accent/20" />
        <StatCard icon={CheckCircle2} label="Sessions Done" value={stats?.completedSessions || 0} color="text-success" bg="bg-success/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold font-display">Activity Last 7 Days</h3>
            <div className="text-sm px-3 py-1 bg-secondary rounded-full text-muted-foreground">Minutes</div>
          </div>
          <div className="flex-1 min-h-[300px]">
            {activity && activity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={(val) => format(parseISO(val), "E")} stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'white' }}
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                  />
                  <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                    {activity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.minutes > 60 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No activity data yet</div>
            )}
          </div>
        </Card>

        {/* Weekly Goal */}
        <Card className="p-6 flex flex-col">
          <h3 className="text-xl font-bold font-display mb-6">Weekly Goal</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" className="stroke-secondary fill-none" strokeWidth="12" />
                <circle 
                  cx="96" cy="96" r="88" 
                  className="stroke-accent fill-none transition-all duration-1000 ease-out" 
                  strokeWidth="12" 
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - Math.min((stats?.goalProgressPercent || 0) / 100, 1))}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-bold font-display text-white">{Math.round(stats?.goalProgressPercent || 0)}%</span>
                <span className="text-sm text-muted-foreground mt-1">{stats?.weeklyMinutes || 0} / {stats?.weeklyTarget || 600}m</span>
              </div>
            </div>
            <p className="mt-6 text-center text-muted-foreground">
              {stats?.goalProgressPercent && stats.goalProgressPercent >= 100 
                ? "🎉 Amazing! You hit your goal!" 
                : "Keep going, you're doing great!"}
            </p>
          </div>
        </Card>
      </div>

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
                <th className="pb-3 font-medium">Pomodoros</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions?.map((session) => (
                <tr key={session.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 text-white font-medium">{session.roomName || "Private Session"}</td>
                  <td className="py-4 text-muted-foreground">{format(parseISO(session.startTime), "MMM d, h:mm a")}</td>
                  <td className="py-4 text-muted-foreground">{session.durationMinutes ? `${session.durationMinutes}m` : '-'}</td>
                  <td className="py-4 text-muted-foreground">{session.pomodorosCompleted}</td>
                  <td className="py-4">
                    {session.completed ? (
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full font-medium">Completed</span>
                    ) : (
                      <span className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded-full font-medium">Incomplete</span>
                    )}
                  </td>
                </tr>
              ))}
              {!sessions?.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">No sessions recorded yet. Time to focus!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any, label: string, value: string | number, color: string, bg: string }) {
  return (
    <Card className="p-6 flex items-center gap-4 group hover:border-primary/30 transition-colors">
      <div className={`w-14 h-14 rounded-2xl ${bg} ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
        <Icon size={28} />
      </div>
      <div>
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <p className="text-2xl md:text-3xl font-display font-bold text-white mt-1">{value}</p>
      </div>
    </Card>
  );
}
