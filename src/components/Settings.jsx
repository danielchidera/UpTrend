import "./Settings.css";
import { useTheme } from "../context/ThemeContext";

function Settings({ onLogout }) {
  const {
    themeMode,
    effectiveTheme,
    setThemeMode,
  } = useTheme();

  const themes = [
    {
      id: "dark",
      icon: "☾",
      title: "Dark",
      description:
        "Keep UpTrend in dark mode at all times.",
    },
    {
      id: "light",
      icon: "☀",
      title: "Light",
      description:
        "Use a bright light interface at all times.",
    },
    {
      id: "scheduled",
      icon: "◐",
      title: "Scheduled",
      description:
        "Light from 6:00 AM to 6:00 PM, then dark.",
    },
  ];

  const handleLogout = () => {
    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <div className="settings-page">

      {/* =====================================================
          INTRO
      ===================================================== */}

      <div className="settings-intro">
        <div>
          <span className="settings-eyebrow">
            SETTINGS
          </span>

          <h2>Make UpTrend yours.</h2>

          <p>
            Manage how UpTrend looks and behaves.
            More account and business settings will
            be added here as the platform grows.
          </p>
        </div>
      </div>

      {/* =====================================================
          SETTINGS LAYOUT
      ===================================================== */}

      <div className="settings-layout">

        {/* ===================================================
            SETTINGS NAVIGATION
        =================================================== */}

        <aside className="settings-navigation">

          <button
            className="settings-nav-item active"
            type="button"
          >
            <span>◐</span>

            <div>
              <strong>Appearance</strong>

              <small>
                Theme and display
              </small>
            </div>
          </button>

          <button
            className="settings-nav-item"
            type="button"
          >
            <span>◎</span>

            <div>
              <strong>Profile</strong>

              <small>
                Coming soon
              </small>
            </div>
          </button>

          <button
            className="settings-nav-item"
            type="button"
          >
            <span>⚙</span>

            <div>
              <strong>Account</strong>

              <small>
                Account settings
              </small>
            </div>
          </button>

          <button
            className="settings-nav-item"
            type="button"
          >
            <span>♢</span>

            <div>
              <strong>Notifications</strong>

              <small>
                Coming soon
              </small>
            </div>
          </button>

          <button
            className="settings-nav-item"
            type="button"
          >
            <span>◇</span>

            <div>
              <strong>Security</strong>

              <small>
                Coming soon
              </small>
            </div>
          </button>

        </aside>

        {/* ===================================================
            SETTINGS CONTENT
        =================================================== */}

        <main className="settings-content">

          {/* =================================================
              APPEARANCE
          ================================================= */}

          <section className="settings-card">

            <div className="settings-card-header">

              <div>

                <span className="settings-section-label">
                  APPEARANCE
                </span>

                <h3>
                  Theme
                </h3>

                <p>
                  Choose how UpTrend should appear
                  across your device.
                </p>

              </div>

              <div className="current-theme">

                <span>
                  {effectiveTheme === "dark"
                    ? "☾"
                    : "☀"}
                </span>

                <small>
                  {effectiveTheme === "dark"
                    ? "Dark"
                    : "Light"}
                </small>

              </div>

            </div>

            <div className="theme-options">

              {themes.map((theme) => (

                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option ${
                    themeMode === theme.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setThemeMode(theme.id)
                  }
                >

                  <div className="theme-option-icon">
                    {theme.icon}
                  </div>

                  <div className="theme-option-copy">

                    <strong>
                      {theme.title}
                    </strong>

                    <span>
                      {theme.description}
                    </span>

                  </div>

                  <span className="theme-radio">
                    {themeMode === theme.id
                      ? "✓"
                      : ""}
                  </span>

                </button>

              ))}

            </div>

          </section>

          {/* =================================================
              SCHEDULE
          ================================================= */}

          <section className="settings-card schedule-card">

            <div className="settings-card-header">

              <div>

                <span className="settings-section-label">
                  SCHEDULE
                </span>

                <h3>
                  Automatic theme
                </h3>

                <p>
                  Scheduled mode follows the
                  current UpTrend schedule.
                </p>

              </div>

            </div>

            <div className="schedule-preview">

              <div className="schedule-item">

                <div className="schedule-icon light">
                  ☀
                </div>

                <div>

                  <strong>
                    Light mode
                  </strong>

                  <span>
                    6:00 AM
                  </span>

                </div>

              </div>

              <div className="schedule-line" />

              <div className="schedule-item">

                <div className="schedule-icon dark">
                  ☾
                </div>

                <div>

                  <strong>
                    Dark mode
                  </strong>

                  <span>
                    6:00 PM
                  </span>

                </div>

              </div>

            </div>

          </section>

          {/* =================================================
              ACCOUNT
          ================================================= */}

          <section className="settings-card account-settings-card">

            <div className="settings-card-header">

              <div>

                <span className="settings-section-label">
                  ACCOUNT
                </span>

                <h3>
                  Account access
                </h3>

                <p>
                  Manage your current UpTrend
                  session.
                </p>

              </div>

            </div>

            <div className="account-access-row">

              <div className="account-access-icon">
                ↪
              </div>

              <div className="account-access-copy">

                <strong>
                  Log out
                </strong>

                <span>
                  Sign out of this UpTrend account
                  on this device.
                </span>

              </div>

              <button
                type="button"
                className="settings-logout-button"
                onClick={handleLogout}
              >
                Log out
              </button>

            </div>

          </section>

          {/* =================================================
              NOTE
          ================================================= */}

          <div className="settings-note">

            <span>
              i
            </span>

            <p>
              Your appearance preference is saved
              automatically and will remain after
              refreshing UpTrend.
            </p>

          </div>

        </main>

      </div>

    </div>
  );
}

export default Settings;