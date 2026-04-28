import React from "react";

export function FocusRoomIcon({ color = "#8B7CF6", size = 24 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer timer ring */}
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" />
      {/* Progress arc (about 75% filled - looks dynamic) */}
      <path
        d="M12 2 A10 10 0 1 1 4.93 19.07"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Inner focus ring */}
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.2" strokeOpacity="0.55" />
      {/* Center filled dot */}
      <circle cx="12" cy="12" r="2" fill={color} />
      {/* Top tick (12 o'clock) */}
      <line x1="12" y1="2.5" x2="12" y2="4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Right tick */}
      <line x1="21.5" y1="12" x2="19.5" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
      {/* Bottom tick */}
      <line x1="12" y1="21.5" x2="12" y2="19.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
      {/* Left tick */}
      <line x1="2.5" y1="12" x2="4.5" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  );
}
