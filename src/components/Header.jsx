/* =========================================================
   HEADER
========================================================= */

import "./Header.css";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import SmartAlerts from "./SmartAlerts";

const NOTIFICATION_ACK_KEY =
  "uptrend_notification_acknowledged";

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

  const [notificationCount, setNotificationCount] =
    useState(0);

  const [notificationSignature, setNotificationSignature] =
    useState("");

  const [notificationRinging, setNotificationRinging] =
    useState(false);

  const previousSignatureRef =
    useRef("");

  const audioContextRef =
    useRef(null);

  const acknowledgedSignatureRef =
    useRef("");

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

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    const timer =
      setTimeout(() => {
        setLoaded(true);
      }, 100);

    return () =>
      clearTimeout(timer);
  }, []);

  /* =======================================================
     LOAD LAST ACKNOWLEDGED NOTIFICATION STATE
  ======================================================= */

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(
          NOTIFICATION_ACK_KEY
        );

      if (saved) {
        acknowledgedSignatureRef.current =
          saved;
      }
    } catch {
      acknowledgedSignatureRef.current =
        "";
    }
  }, []);

  /* =======================================================
     NOTIFICATION SOUND
     -------------------------------------------------------
     Uses Web Audio API.
     No external sound file is required.
  ======================================================= */

  const playNotificationSound =
    useCallback(() => {
      try {
        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) return;

        if (!audioContextRef.current) {
          audioContextRef.current =
            new AudioContext();
        }

        const audioContext =
          audioContextRef.current;

        const playTone = () => {
          const now =
            audioContext.currentTime;

          const oscillator =
            audioContext.createOscillator();

          const gain =
            audioContext.createGain();

          oscillator.type = "sine";

          oscillator.frequency.setValueAtTime(
            880,
            now
          );

          oscillator.frequency.setValueAtTime(
            1174,
            now + 0.09
          );

          oscillator.frequency.setValueAtTime(
            880,
            now + 0.18
          );

          gain.gain.setValueAtTime(
            0.0001,
            now
          );

          gain.gain.exponentialRampToValueAtTime(
            0.07,
            now + 0.015
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.28
          );

          oscillator.connect(gain);
          gain.connect(
            audioContext.destination
          );

          oscillator.start(now);

          oscillator.stop(
            now + 0.3
          );
        };

        if (
          audioContext.state ===
          "suspended"
        ) {
          audioContext
            .resume()
            .then(() => {
              playTone();
            })
            .catch(() => {
              // Browser blocked audio.
            });
        } else {
          playTone();
        }
      } catch {
        /*
         * Browser/device may block audio.
         * Notification UI still works normally.
         */
      }
    }, []);

  /* =======================================================
     SMART ALERTS -> HEADER
  ======================================================= */

  const handleAlertsChange =
    useCallback(
      ({ count, signature }) => {
        const nextCount =
          Number(count) || 0;

        const nextSignature =
          signature || "";

        setNotificationCount(
          nextCount
        );

        setNotificationSignature(
          nextSignature
        );

        /*
         * No alerts.
         */
        if (nextCount === 0) {
          setNotificationRinging(false);

          previousSignatureRef.current =
            "";

          return;
        }

        const previousSignature =
          previousSignatureRef.current;

        /*
         * Always remember the latest
         * notification collection.
         */
        previousSignatureRef.current =
          nextSignature;

        /*
         * The current notification collection
         * has already been acknowledged.
         */
        if (
          nextSignature &&
          nextSignature ===
            acknowledgedSignatureRef.current
        ) {
          setNotificationRinging(false);
          return;
        }

        /*
         * New notification collection.
         */
        if (
          nextSignature &&
          nextSignature !==
            previousSignature
        ) {
          setNotificationRinging(
            true
          );

          /*
           * Play the notification sound once
           * when a new notification collection
           * appears.
           */
          playNotificationSound();
        }
      },
      [playNotificationSound]
    );

  /* =======================================================
     BELL CLICK
  ======================================================= */

  const handleNotificationClick =
    () => {
      /*
       * User interaction with the bell is also
       * used to unlock/resume Web Audio on browsers
       * that require a user gesture.
       */
      try {
        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (
          AudioContext &&
          !audioContextRef.current
        ) {
          audioContextRef.current =
            new AudioContext();
        }

        if (
          audioContextRef.current &&
          audioContextRef.current
            .state === "suspended"
        ) {
          audioContextRef.current.resume();
        }
      } catch {
        // Ignore browser audio restrictions.
      }

      /*
       * The current notification collection
       * has now been acknowledged.
       */
      if (notificationSignature) {
        acknowledgedSignatureRef.current =
          notificationSignature;

        try {
          window.localStorage.setItem(
            NOTIFICATION_ACK_KEY,
            notificationSignature
          );
        } catch {
          // Ignore storage restrictions.
        }
      }

      /*
       * Stop ringing immediately.
       */
      setNotificationRinging(false);

      /*
       * Open / close the notification panel.
       */
      setAlertsOpen(
        (open) => !open
      );
    };

  /* =======================================================
     THEME
  ======================================================= */

  const resetDemoData = async () => {
    const confirmed = window.confirm(
      "Reset ALL UpTrend business data? This will permanently clear products, sales, expenses, suppliers, purchases, payments, returns and finance transactions."
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc(
        "reset_uptrend_demo_data"
      );

      if (error) throw error;

      window.alert(
        "UpTrend has been reset successfully. Everything is now ready for a fresh test."
      );

      window.location.reload();
    } catch (error) {
      console.error("Reset demo data failed:", error);

      window.alert(
        error?.message ||
          "Unable to reset the UpTrend data."
      );
    }
  };

  const selectTheme = (mode) => {
    setThemeMode(mode);
    setThemeMenuOpen(false);
  };

  const themeIcon =
    effectiveTheme === "dark"
      ? "☾"
      : "☀";

  const hasNotifications =
    notificationCount > 0;

  return (
    <header
      className={`command-header ${
        loaded
          ? "header-loaded"
          : ""
      }`}
    >
      {/* ===================================================
          LEFT
      =================================================== */}

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

      {/* ===================================================
          RIGHT
      =================================================== */}

      <div className="header-actions">

        {/* =================================================
            THEME
        ================================================= */}

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

        {/* =================================================
            NOTIFICATIONS
        ================================================= */}

        <div className="notification-control">

          <button
            className={`header-icon notification ${
              hasNotifications
                ? "has-notifications"
                : ""
            } ${
              notificationRinging
                ? "ringing"
                : ""
            } ${
              alertsOpen
                ? "active"
                : ""
            }`}
            type="button"
            aria-label={
              hasNotifications
                ? `${notificationCount} notifications`
                : "Notifications"
            }
            aria-expanded={
              alertsOpen
            }
            onClick={
              handleNotificationClick
            }
          >

            <span
              className="notification-icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 9.5C18 6.46 15.76 4 12 4C8.24 4 6 6.46 6 9.5C6 14.75 4.5 16.5 3.5 18H20.5C19.5 16.5 18 14.75 18 9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M10 21H14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <path
                  d="M12 4V3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            {hasNotifications && (
              <span
                className="notification-badge"
                aria-hidden="true"
              >
                {notificationCount > 99
                  ? "99+"
                  : notificationCount}
              </span>
            )}

            {hasNotifications && (
              <span
                className="notification-dot"
                aria-hidden="true"
              />
            )}

          </button>

          {/*
           * SmartAlerts stays mounted even when
           * the panel is closed so it can continue
           * detecting new notifications.
           */}
          <SmartAlerts
            isOpen={alertsOpen}
            onAlertsChange={
              handleAlertsChange
            }
          />

        </div>

        {/* =================================================
            RESET DEMO DATA
        ================================================= */}

        <button
          type="button"
          className="reset-demo-button"
          onClick={resetDemoData}
        >
          Reset All
        </button>

        {/* =================================================
            RECORD SALE
        ================================================= */}

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