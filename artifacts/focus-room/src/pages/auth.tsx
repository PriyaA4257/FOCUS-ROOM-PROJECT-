import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { FocusRoomIcon } from "@/components/focus-room-icon";
import { Button, Input, Label, Card } from "@/components/ui";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useToast } from "@/hooks/use-toast";

export default function Auth({ mode = "login" }: { mode?: "login" | "register" }) {
  const isLogin = mode === "login";
  const { login, register, isLoggingIn, isRegistering } = useAuthApi();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ email, password });
        toast({ title: "Welcome back!", description: "Successfully logged in." });
      } else {
        await register({ username, email, password });
        toast({ title: "Account created!", description: "Welcome to Focus Room." });
      }
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Authentication failed", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shadow-xl shadow-primary/30">
              <FocusRoomIcon color="#8B7CF6" size={30} />
            </div>
          </Link>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? "Enter your details to enter the study room." : "Join thousands of focused students."}
          </p>
        </div>

        <Card className="p-8 backdrop-blur-xl bg-card/80 border-border/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  placeholder="focusninja" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base mt-2" 
              disabled={isLoggingIn || isRegistering}
            >
              {isLoggingIn || isRegistering ? (
                <Loader2 className="animate-spin mr-2" />
              ) : null}
              {isLogin ? "Log In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground border-t border-border/50 pt-6">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Log in
                </Link>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
