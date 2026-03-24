import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuthApi } from "@/hooks/use-auth-api";
import { useThemeStore, AMBIENT_THEMES } from "@/hooks/use-theme";
import { Card, Button, Input, Label } from "@/components/ui";
import { requestNotificationPermission } from "@/hooks/use-notifications";
import { User, Bell, Palette, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATARS = [
  "🧑‍💻", "👩‍🎓", "🧑‍🔬", "👨‍🎨", "🦊", "🐼", "🐨", "🦁",
  "🐸", "🦋", "🌟", "🎯", "🚀", "🎸", "📚", "☕",
];

export default function Profile() {
  const { user, updateProfile, isUpdatingProfile } = useAuthApi();
  const { colorTheme, setColorTheme, ambientTheme, setAmbientTheme } = useThemeStore();
  const [username, setUsername] = useState(user?.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || AVATARS[0]);
  const [notifGranted, setNotifGranted] = useState(Notification?.permission === "granted");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateProfile({ username, avatar: selectedAvatar });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  return (
    <div className="space-y-8 pb-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Profile</h1>
        <p className="text-muted-foreground text-lg">Customize your experience</p>
      </motion.div>

      {/* Avatar & Username */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <User size={18} className="text-primary" />
            <h3 className="font-bold text-lg">Account Info</h3>
          </div>

          {/* Avatar picker */}
          <div>
            <Label className="mb-3 block text-sm text-muted-foreground">Choose your avatar</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all",
                    selectedAvatar === av
                      ? "bg-primary/30 border-2 border-primary scale-110 shadow-lg shadow-primary/30"
                      : "bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:scale-105"
                  )}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-2xl">
            <span className="text-4xl">{selectedAvatar}</span>
            <div>
              <p className="font-bold text-white">{username || user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <Label className="mb-2 block">Display Name</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              maxLength={30}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isUpdatingProfile}
            className="w-full"
          >
            {saved ? "✓ Saved!" : isUpdatingProfile ? "Saving..." : "Save Changes"}
          </Button>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Palette size={18} className="text-primary" />
            <h3 className="font-bold text-lg">Appearance</h3>
          </div>

          {/* Color theme */}
          <div>
            <Label className="mb-3 block text-sm text-muted-foreground">Color Mode</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setColorTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
                  colorTheme === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-border/80"
                )}
              >
                <Moon size={16} /> Dark Mode
              </button>
              <button
                onClick={() => setColorTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
                  colorTheme === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-border/80"
                )}
              >
                <Sun size={16} /> Light Mode
              </button>
            </div>
          </div>

          {/* Ambient theme */}
          <div>
            <Label className="mb-3 block text-sm text-muted-foreground">Default Ambient Theme</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AMBIENT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setAmbientTheme(theme.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                    ambientTheme === theme.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80 hover:bg-secondary/40"
                  )}
                >
                  <span className="text-2xl">{theme.emoji}</span>
                  <div>
                    <p className={cn("text-sm font-semibold", ambientTheme === theme.id ? "text-primary" : "text-white")}>
                      {theme.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={18} className="text-primary" />
            <h3 className="font-bold text-lg">Notifications</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Get notified when your focus session ends or your break is over.
          </p>
          {notifGranted ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm font-medium">
              ✓ Notifications enabled
            </div>
          ) : (
            <Button variant="secondary" onClick={handleEnableNotifications} className="w-full gap-2">
              <Bell size={16} /> Enable Desktop Notifications
            </Button>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
