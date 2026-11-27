export const themeKey = "palonex-theme";
export const lightPreference = "(prefers-color-scheme: light)";
export const themeChange = "palonex:theme-change";

// Static script runs before the first paint and shares the toggle's preference key.
export const initializeTheme = `(() => {
  let theme;
  try { theme = localStorage.getItem(${JSON.stringify(themeKey)}); } catch {}
  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia?.(${JSON.stringify(lightPreference)}).matches ? "light" : "dark";
  }
  document.documentElement.dataset.theme = theme;
})()`;
