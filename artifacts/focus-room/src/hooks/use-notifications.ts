export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

export function sendNotification(title: string, body: string, icon?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: icon || "/favicon.ico",
    badge: "/favicon.ico",
  });
}

export function notifySessionComplete(pomodoroCount: number) {
  sendNotification(
    "🎉 Focus Session Complete!",
    `Pomodoro #${pomodoroCount} done. Time to take a well-earned break!`
  );
}

export function notifyBreakOver() {
  sendNotification(
    "⏰ Break Time Over",
    "Ready to focus again? Let's get back to it!"
  );
}
