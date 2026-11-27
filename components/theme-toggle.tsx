"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { lightPreference, themeChange, themeKey } from "@/lib/theme";

function getTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(update: () => void) {
  const preference = window.matchMedia(lightPreference);

  function syncPreference() {
    let saved: string | null = null;
    try { saved = localStorage.getItem(themeKey); } catch {}
    document.documentElement.dataset.theme =
      saved === "light" || saved === "dark" ? saved : preference.matches ? "light" : "dark";
    update();
  }

  function syncStorage(event: StorageEvent) {
    if (event.key === themeKey || event.key === null) syncPreference();
  }

  preference.addEventListener("change", syncPreference);
  window.addEventListener("storage", syncStorage);
  window.addEventListener(themeChange, update);

  return () => {
    preference.removeEventListener("change", syncPreference);
    window.removeEventListener("storage", syncStorage);
    window.removeEventListener(themeChange, update);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);

  function toggle() {
    const next = getTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(themeKey, next); } catch {}
    window.dispatchEvent(new Event(themeChange));
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Light theme"
      aria-pressed={theme === null ? undefined : theme === "light"} title="Toggle light and dark theme">
      <Sun className="theme-sun" size={19} aria-hidden="true" />
      <Moon className="theme-moon" size={19} aria-hidden="true" />
    </button>
  );
}
