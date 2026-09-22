import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_MODE_KEY = "uptrend_theme_mode";

const DEFAULT_MODE = "dark";

const ThemeContext = createContext(null);

function getStoredMode() {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY);

    if (
      saved === "dark" ||
      saved === "light" ||
      saved === "scheduled"
    ) {
      return saved;
    }
  } catch {}

  return DEFAULT_MODE;
}

function getScheduledTheme() {
  const hour = new Date().getHours();

  /*
   * 6:00 AM → Light
   * 6:00 PM → Dark
   */
  return hour >= 6 && hour < 18
    ? "light"
    : "dark";
}

function getEffectiveTheme(mode) {
  if (mode === "scheduled") {
    return getScheduledTheme();
  }

  return mode;
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] =
    useState(getStoredMode);

  const [effectiveTheme, setEffectiveTheme] =
    useState(() =>
      getEffectiveTheme(getStoredMode())
    );

  useEffect(() => {
    try {
      localStorage.setItem(
        THEME_MODE_KEY,
        themeMode
      );
    } catch {}

    const applyTheme = () => {
      const nextTheme =
        getEffectiveTheme(themeMode);

      setEffectiveTheme(nextTheme);

      document.documentElement.setAttribute(
        "data-theme",
        nextTheme
      );
    };

    applyTheme();

    /*
     * Recheck periodically so Scheduled mode
     * changes automatically around 6 AM / 6 PM.
     */
    const interval = setInterval(
      applyTheme,
      60 * 1000
    );

    return () => clearInterval(interval);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      effectiveTheme,
      setThemeMode,

      isDark:
        effectiveTheme === "dark",

      isLight:
        effectiveTheme === "light",
    }),
    [
      themeMode,
      effectiveTheme,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context =
    useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}
