"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("catvi-theme");
    const initial = saved === "light" ? "light" : "dark";
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function setTheme(next) {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("catvi-theme", next);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
