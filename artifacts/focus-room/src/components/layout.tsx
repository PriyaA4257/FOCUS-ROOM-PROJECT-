import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, LayoutDashboard, Trophy, LogOut, Search, User, Moon, Sun } from "lucide-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useThemeStore, initTheme } from "@/hooks/use-theme";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

initTheme();

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useAuthApi();
  const [location] = useLocation();
  const { colorTheme, setColorTheme } = useThemeStore();

  const lastRoom = localStorage.getItem("focus_last_room_id");
  const lastRoomName = localStorage.getItem("focus_last_room_name");

  const navItems = [
    { href: "/rooms", icon: Search, label: "Explore" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  if (!isAuthenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card/50 backdrop-blur-md z-50 sticky top-0">
        <Link href="/rooms" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <BrainCircuit size={20} />
          </div>
          <span className="font-display font-bold text-lg text-white">FocusRoom</span>
        </Link>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setColorTheme(colorTheme === "dark" ? "light" : "dark")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary/60 text-muted-foreground transition-colors"
          >
            {colorTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant={location === item.href ? "secondary" : "ghost"} size="icon" className="w-9 h-9 rounded-full">
                <item.icon size={16} className={location === item.href ? "text-primary" : "text-muted-foreground"} />
              </Button>
            </Link>
          ))}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card/30 backdrop-blur-xl p-6 dim-in-focus transition-all duration-500">
        <Link href="/rooms" className="flex items-center gap-3 mb-10 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <BrainCircuit size={24} />
          </div>
          <span className="font-display font-bold text-2xl text-white tracking-tight">FocusRoom</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group relative",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}>
                  <item.icon size={18} className={cn("transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                  {item.label}
                  {isActive && (
                    <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Quick Rejoin */}
        {lastRoom && (
          <Link href={`/rooms/${lastRoom}`}>
            <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer">
              <p className="text-xs text-accent font-bold uppercase tracking-wide mb-1">Continue Session</p>
              <p className="text-sm text-white font-medium truncate">{lastRoomName || "Last Room"}</p>
            </div>
          </Link>
        )}

        <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <span className="text-2xl">{user?.avatar || "🧑‍💻"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                🔥 {user?.currentStreak || 0} day streak
              </p>
            </div>
            <button
              onClick={() => setColorTheme(colorTheme === "dark" ? "light" : "dark")}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/60 text-muted-foreground transition-colors shrink-0"
              title="Toggle theme"
            >
              {colorTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout}>
            <LogOut size={18} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col h-[calc(100vh-73px)] md:h-screen">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-w-6xl mx-auto h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
