import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BrainCircuit, Clock, Users, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 opacity-40">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Abstract calm background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <BrainCircuit size={24} />
          </div>
          <span className="font-display font-bold text-2xl text-white tracking-tight">FocusRoom</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white">Log In</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center text-center px-4 max-w-5xl mx-auto w-full mt-10 md:mt-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-primary/20 text-primary text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Join 10,000+ students focusing right now
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
            Your Virtual <br />
            <span className="text-gradient">Study Sanctuary</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Boost your productivity with synchronized Pomodoro timers, ambient sounds, and a supportive community. Turn distraction into deep work.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-lg gap-2 group">
                Enter Study Room
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg backdrop-blur-sm">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 mb-16 w-full text-left"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
        >
          <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 hover:bg-card/60 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4">
              <Clock size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sync Timers</h3>
            <p className="text-muted-foreground">Synchronized Pomodoro sessions with your group. Work when they work, break when they break.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 hover:bg-card/60 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent mb-4">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Virtual Body Doubling</h3>
            <p className="text-muted-foreground">The psychological power of studying alongside others keeps you accountable and focused.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 hover:bg-card/60 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center text-warning mb-4">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Track Progress</h3>
            <p className="text-muted-foreground">Build streaks, climb the leaderboard, and visualize your deep work hours over time.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
