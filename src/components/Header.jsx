import "./Header.css";

import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import SmartAlerts from "./SmartAlerts";

function Header({
  activePage,
  setIsOpen,
  onRecordSale,
}) {
  const [loaded, setLoaded] =
    useState(false);

  const {
    themeMode,
    effectiveTheme,
    setThemeMode,
  } = useTheme();

  const [themeMenuOpen, setThemeMenuOpen] =
    useState(false);

  const [alertsOpen, setAlertsOpen] =
    useState(false);

  const pageTitles = {
    dashboard: "Business Dashboard",
    sales: "Sales",
    record: "Record Sale",
    products: "Products",
    reports: "Reports",
    finance: "Finance",
    expenses: "Expenses",
    settings: "Settings",
  };

  useEffect(() => {
    const timer =
      setTimeout(() => {
        setLoaded(true);
      }, 100);

    return () =>
      clearTimeout(timer);
  }, []);

  const selectTheme = (mode) => {
    setThemeMode(mode);
    setThemeMenuOpen(false);
  };

  const themeIcon =
    effectiveTheme === "dark"
      ? "☾"
      : "☀";

  return (
    <header
      className={`command-header ${
        loaded
          ? "header-loaded"
          : ""
      }`}
    >
      <div className="header-left">
        <button
          className="mobile-menu"
          onClick={() =>
            setIsOpen(true)
          }
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="header-title-wrap">
          <div className="header-overline">
            <span className="overline-dot" />
            UPTREND
          </div>

          <h1>
            {pageTitles[activePage] ||
              "Business Dashboard"}
          </h1>
        </div>
      </div>

      <div className="header-actions">
        <div className="theme-control">
          <button
            className="theme-toggle"
            type="button"
            aria-label="Change theme"
            aria-expanded={
              themeMenuOpen
            }
            onClick={() =>
              setThemeMenuOpen(
                (open) => !open
              )
            }
          >
            <span className="theme-toggle-icon">
              {themeIcon}
            </span>

            <span className="theme-toggle-label">
              {themeMode === "dark" &&
                "Dark"}

              {themeMode === "light" &&
                "Light"}

              {themeMode ===
                "scheduled" &&
                "Auto"}
            </span>

            <span className="theme-chevron">
              {themeMenuOpen
                ? "⌃"
                : "⌄"}
            </span>
          </button>

          {themeMenuOpen && (
            <div className="theme-menu">
              <button
                type="button"
                className={
                  themeMode === "dark"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  selectTheme(
                    "dark"
                  )
                }
              >
                <span>☾</span>

                <div>
                  <strong>
                    Dark
                  </strong>

                  <small>
                    Always use dark
                  </small>
                </div>

                {themeMode ===
                  "dark" && (
                  <b>✓</b>
                )}
              </button>

              <button
                type="button"
                className={
                  themeMode === "light"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  selectTheme(
                    "light"
                  )
                }
              >
                <span>☀</span>

                <div>
                  <strong>
                    Light
                  </strong>

                  <small>
                    Always use light
                  </small>
                </div>

                {themeMode ===
                  "light" && (
                  <b>✓</b>
                )}
              </button>

              <button
                type="button"
                className={
                  themeMode ===
                  "scheduled"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  selectTheme(
                    "scheduled"
                  )
                }
              >
                <span>◐</span>

                <div>
                  <strong>
                    Scheduled
                  </strong>

                  <small>
                    Light 6 AM · Dark 6 PM
                  </small>
                </div>

                {themeMode ===
                  "scheduled" && (
                  <b>✓</b>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="notification-control">

          <button
            className={`header-icon notification ${
              alertsOpen
                ? "active"
                : ""
            }`}
            type="button"
            aria-label="Notifications"
            aria-expanded={alertsOpen}
            onClick={() =>
              setAlertsOpen(
                (open) => !open
              )
            }
          >
            <span className="notification-icon">
              ♢
            </span>

            <i />
          </button>

          {alertsOpen && (
            <SmartAlerts />
          )}

        </div>

        <button
          className="primary-action header-record-button"
          onClick={onRecordSale}
        >
          <span className="record-plus">
            +
          </span>

          <span>
            Record Sale
          </span>

          <span className="record-arrow">
            →
          </span>
        </button>
      </div>
    </header>
  );
}

export default Header;
