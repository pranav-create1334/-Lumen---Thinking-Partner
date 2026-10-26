"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
});

const STORAGE_KEY = "ai-chat.theme";

function readCurrentIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Persists the theme choice in localStorage; layout applies it pre-paint. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readCurrentIsDark());
  }, []);

  const toggleTheme = useCallback(() => {
    const nextIsDark = !readCurrentIsDark();
    document.documentElement.classList.toggle("dark", nextIsDark);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextIsDark ? "dark" : "light");
    } catch {
      // storage unavailable; theme still applies for this session
    }
    setIsDark(nextIsDark);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: isDark ? "dark" : "light", isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
