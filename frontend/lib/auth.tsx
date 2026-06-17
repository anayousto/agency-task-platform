"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, clearTokens, getAccessToken, getRefreshToken, setTokens, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = async () => {
    const { data } = await api.get<User>("/auth/me");
    setUser(data);
  };

  useEffect(() => {
    const load = async () => {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        await refreshMe();
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      refreshMe,
      login: async (email: string, password: string) => {
        const { data } = await api.post("/auth/login", { email, password });
        setTokens(data);
        await refreshMe();
      },
      logout: async () => {
        const refresh_token = getRefreshToken();
        try {
          await api.post("/auth/logout", { refresh_token });
        } finally {
          clearTokens();
          setUser(null);
        }
      }
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
