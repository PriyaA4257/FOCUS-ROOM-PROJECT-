import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("focus_room_token"),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("focus_room_token", token);
    } else {
      localStorage.removeItem("focus_room_token");
    }
    set({ token, isAuthenticated: !!token });
  },
  isAuthenticated: !!localStorage.getItem("focus_room_token"),
}));
