import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FocusRoomIcon } from "@/components/focus-room-icon";
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
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-lg shadow-primary/20">
            <FocusRoomIcon color="#8B7CF6" size={26} />
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
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center text-center px-4 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h1 className="text-6xl md:text-8xl font-display font-bold text-white mb-10 leading-tight tracking-tight">
            Lock In. <br />
            <span className="text-gradient">Level Up.</span>
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-lg gap-2 group px-8">
                Enter Study Room
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg backdrop-blur-sm px-8">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
