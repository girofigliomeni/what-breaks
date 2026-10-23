"use client";

import { useSyncExternalStore } from "react";

function readTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

function subscribe(onChange: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === "what-breaks-theme" || event.key === null) {
      const theme = event.newValue;
      document.documentElement.dataset.theme = theme === "light" || theme === "dark" ? theme : "system";
      onChange();
    }
  }
  window.addEventListener("storage", sync);
  window.addEventListener("what-breaks-theme", onChange);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener("what-breaks-theme", onChange);
  };
}

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system");
  return (
    <label className="theme-control">
      Theme
      <select value={theme} onChange={(event) => {
        const value = event.target.value;
        document.documentElement.dataset.theme = value;
        try { localStorage.setItem("what-breaks-theme", value); } catch { /* Apply locally even when persistence is blocked. */ }
        window.dispatchEvent(new Event("what-breaks-theme"));
      }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
