import "./Settings.css";
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import BackupCenter from "./BackupCenter";
import { supabase } from "../lib/supabase";

function Settings({
  subscription,
  onLogout,
}) {
  const {
    themeMode,
    effectiveTheme,
    setThemeMode,
  } = useTheme();

  const [activeSection, setActiveSection] =
    useState("appearance");

  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    email: "",
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [accountEmail, setAccountEmail] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  const [notificationPreferences, setNotificationPreferences] =
    useState({
      enabled: true,
      inventory: true,
      payments: true,
      salesExpenses: true,
      targets: true,
    });

  const [notificationLoading, setNotificationLoading] =
    useState(false);

  const [notificationSaving, setNotificationSaving] =
    useState(false);

  const [notificationMessage, setNotificationMessage] =
    useState("");

  const [notificationError, setNotificationError] =
    useState("");

  const [securityForm, setSecurityForm] =
    useState({
      newPassword: "",
      confirmPassword: "",
    });

  const [securitySaving, setSecuritySaving] =
    useState(false);

  const [securityMessage, setSecurityMessage] =
    useState("");

  const [securityError, setSecurityError] =
    useState("");

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

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

  const handleSecurityPasswordChange = async () => {
    setSecurityError("");
    setSecurityMessage("");

    const newPassword =
      securityForm.newPassword.trim();

    const confirmPassword =
      securityForm.confirmPassword.trim();

    if (!newPassword || !confirmPassword) {
      setSecurityError(
        "Please enter and confirm your new password."
      );
      return;
    }

    if (newPassword.length < 8) {
      setSecurityError(
        "Your password must be at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError(
        "Your passwords do not match."
      );
      return;
    }

    setSecuritySaving(true);

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (error) {
      setSecurityError(
        error.message ||
          "Unable to update your password."
      );
      setSecuritySaving(false);
      return;
    }

    setSecurityForm({
      newPassword: "",
      confirmPassword: "",
    });

    setSecurityMessage(
      "Your password has been updated successfully."
    );

    setSecuritySaving(false);
  };

  useEffect(() => {
    if (activeSection !== "profile") {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");
      setProfileMessage("");

      const { data, error } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (error) {
        setProfileError(error.message);
        setProfileLoading(false);
        return;
      }

      const user = data?.user;

      setProfileForm({
        name: user?.user_metadata?.name || "",
        username: user?.user_metadata?.username || "",
        email: user?.email || "",
      });

      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "account") {
      return;
    }

    let cancelled = false;

    const loadAccount = async () => {
      setAccountLoading(true);

      const { data, error } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (!error) {
        setAccountEmail(data?.user?.email || "");
      }

      setAccountLoading(false);
    };

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "notifications") {
      return;
    }

    let cancelled = false;

    const loadNotificationPreferences = async () => {
      setNotificationLoading(true);
      setNotificationError("");
      setNotificationMessage("");

      const { data, error } =
        await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (error) {
        setNotificationError(error.message);
        setNotificationLoading(false);
        return;
      }

      const preferences =
        data?.user?.user_metadata?.notification_preferences || {};

      setNotificationPreferences({
        enabled:
          preferences.enabled !== false,
        inventory:
          preferences.inventory !== false,
        payments:
          preferences.payments !== false,
        salesExpenses:
          preferences.salesExpenses !== false,
        targets:
          preferences.targets !== false,
      });

      setNotificationLoading(false);
    };

    loadNotificationPreferences();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const handleNotificationSave = async (event) => {
    event.preventDefault();

    setNotificationSaving(true);
    setNotificationError("");
    setNotificationMessage("");

    const { error } =
      await supabase.auth.updateUser({
        data: {
          notification_preferences:
            notificationPreferences,
        },
      });

    if (error) {
      setNotificationError(error.message);
    } else {
      setNotificationMessage(
        "Notification preferences saved successfully."
      );

      window.dispatchEvent(
        new CustomEvent(
          "uptrend:notification-settings-changed"
        )
      );
    }

    setNotificationSaving(false);
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    setProfileMessage("");
    setProfileError("");

    const name = profileForm.name.trim();
    const username = profileForm.username.trim();

    if (!name || !username) {
      setProfileError("Name and username are required.");
      return;
    }

    setProfileSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        name,
        username,
      },
    });

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileMessage("Profile updated successfully.");
    }

    setProfileSaving(false);
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
            className={`settings-nav-item ${
              activeSection === "appearance"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("appearance")
            }
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
            className={`settings-nav-item ${
              activeSection === "profile"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("profile")
            }
          >
            <span>◎</span>

            <div>
              <strong>Profile</strong>

              <small>
                Personal information
              </small>
            </div>
          </button>

          <button
            className={`settings-nav-item ${
              activeSection === "account"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("account")
            }
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
            className={`settings-nav-item ${
              activeSection === "notifications"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("notifications")
            }
          >
            <span>♢</span>

            <div>
              <strong>Notifications</strong>

              <small>
                Alerts and preferences
              </small>
            </div>
          </button>

          <button
            className={`settings-nav-item ${
              activeSection === "security"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("security")
            }
          >
            <span>◇</span>

            <div>
              <strong>Security</strong>

              <small>
                Password and account security
              </small>
            </div>
          </button>

          <button
            className={`settings-nav-item settings-backup-nav ${
              activeSection === "backups"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              setActiveSection("backups")
            }
          >
            <span>💾</span>

            <div>
              <strong>Backups</strong>

              <small>
                Business data protection
              </small>
            </div>
          </button>

        </aside>

        {/* ===================================================
            SETTINGS CONTENT
        =================================================== */}

        <main className="settings-content">

          {activeSection === "backups" ? (
            <BackupCenter
              subscription={subscription}
            />
          ) : activeSection === "profile" ? (
            <section className="settings-card">

              <div className="settings-card-header">

                <div>

                  <span className="settings-section-label">
                    PROFILE
                  </span>

                  <h3>
                    Personal information
                  </h3>

                  <p>
                    Update the name and username
                    connected to your UpTrend account.
                  </p>

                </div>

              </div>

              {profileLoading ? (
                <div className="settings-note">

                  <span>i</span>

                  <p>
                    Loading your profile...
                  </p>

                </div>
              ) : (
                <form onSubmit={handleProfileSave}>

                  <div className="settings-profile-fields">

                    <label>
                      <span>Name</span>

                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Your name"
                        autoComplete="name"
                      />
                    </label>

                    <label>
                      <span>Username</span>

                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                        placeholder="Your username"
                        autoComplete="username"
                      />
                    </label>

                    <label>
                      <span>Email</span>

                      <input
                        type="email"
                        value={profileForm.email}
                        readOnly
                        disabled
                      />
                    </label>

                  </div>

                  {profileError && (
                    <div className="settings-form-error">
                      {profileError}
                    </div>
                  )}

                  {profileMessage && (
                    <div className="settings-form-success">
                      {profileMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="settings-save-button"
                    disabled={profileSaving}
                  >
                    {profileSaving
                      ? "Saving..."
                      : "Save changes"}
                  </button>

                </form>
              )}

            </section>
          ) : activeSection === "notifications" ? (
            <section className="settings-card notification-settings-card">

              <div className="settings-card-header">

                <div>

                  <span className="settings-section-label">
                    NOTIFICATIONS
                  </span>

                  <h3>
                    Smart Alerts
                  </h3>

                  <p>
                    Choose which business events UpTrend
                    should bring to your attention.
                  </p>

                </div>

              </div>

              {notificationLoading ? (
                <div className="settings-note">

                  <span>i</span>

                  <p>
                    Loading notification preferences...
                  </p>

                </div>
              ) : (
                <form onSubmit={handleNotificationSave}>

                  <div className="notification-preference-list">

                    <label className="notification-preference master">

                      <div className="notification-preference-copy">

                        <strong>
                          Smart Alerts
                        </strong>

                        <span>
                          Turn UpTrend business alerts on or off.
                        </span>

                      </div>

                      <input
                        type="checkbox"
                        checked={notificationPreferences.enabled}
                        onChange={(event) =>
                          setNotificationPreferences((current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                      />

                      <span className="notification-toggle" />

                    </label>

                    <label
                      className={`notification-preference ${
                        !notificationPreferences.enabled
                          ? "disabled"
                          : ""
                      }`}
                    >

                      <div className="notification-preference-copy">

                        <strong>
                          Inventory
                        </strong>

                        <span>
                          Stock, low-stock and stock-received alerts.
                        </span>

                      </div>

                      <input
                        type="checkbox"
                        checked={notificationPreferences.inventory}
                        disabled={!notificationPreferences.enabled}
                        onChange={(event) =>
                          setNotificationPreferences((current) => ({
                            ...current,
                            inventory: event.target.checked,
                          }))
                        }
                      />

                      <span className="notification-toggle" />

                    </label>

                    <label
                      className={`notification-preference ${
                        !notificationPreferences.enabled
                          ? "disabled"
                          : ""
                      }`}
                    >

                      <div className="notification-preference-copy">

                        <strong>
                          Payments
                        </strong>

                        <span>
                          Supplier and customer credit payment alerts.
                        </span>

                      </div>

                      <input
                        type="checkbox"
                        checked={notificationPreferences.payments}
                        disabled={!notificationPreferences.enabled}
                        onChange={(event) =>
                          setNotificationPreferences((current) => ({
                            ...current,
                            payments: event.target.checked,
                          }))
                        }
                      />

                      <span className="notification-toggle" />

                    </label>

                    <label
                      className={`notification-preference ${
                        !notificationPreferences.enabled
                          ? "disabled"
                          : ""
                      }`}
                    >

                      <div className="notification-preference-copy">

                        <strong>
                          Sales & expenses
                        </strong>

                        <span>
                          Revenue, profit, margin and expense alerts.
                        </span>

                      </div>

                      <input
                        type="checkbox"
                        checked={notificationPreferences.salesExpenses}
                        disabled={!notificationPreferences.enabled}
                        onChange={(event) =>
                          setNotificationPreferences((current) => ({
                            ...current,
                            salesExpenses: event.target.checked,
                          }))
                        }
                      />

                      <span className="notification-toggle" />

                    </label>

                    <label
                      className={`notification-preference ${
                        !notificationPreferences.enabled
                          ? "disabled"
                          : ""
                      }`}
                    >

                      <div className="notification-preference-copy">

                        <strong>
                          Business targets
                        </strong>

                        <span>
                          Revenue, profit, units and expense-limit alerts.
                        </span>

                      </div>

                      <input
                        type="checkbox"
                        checked={notificationPreferences.targets}
                        disabled={!notificationPreferences.enabled}
                        onChange={(event) =>
                          setNotificationPreferences((current) => ({
                            ...current,
                            targets: event.target.checked,
                          }))
                        }
                      />

                      <span className="notification-toggle" />

                    </label>

                  </div>

                  {notificationError && (
                    <div className="settings-form-error">
                      {notificationError}
                    </div>
                  )}

                  {notificationMessage && (
                    <div className="settings-form-success">
                      {notificationMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="settings-save-button"
                    disabled={notificationSaving}
                  >
                    {notificationSaving
                      ? "Saving..."
                      : "Save preferences"}
                  </button>

                </form>
              )}

            </section>
          ) : activeSection === "security" ? (
            <section className="settings-card security-settings-card">

              <div className="settings-card-header">

                <div>

                  <span className="settings-section-label">
                    SECURITY
                  </span>

                  <h3>
                    Security
                  </h3>

                  <p>
                    Keep your UpTrend account protected
                    with a strong password.
                  </p>

                </div>

              </div>

              <div className="security-status-card">

                <div className="security-status-icon">
                  ✓
                </div>

                <div className="security-status-copy">

                  <strong>
                    Password protection
                  </strong>

                  <span>
                    Your account is protected by your
                    authentication password.
                  </span>

                </div>

                <span className="security-status-badge">
                  Active
                </span>

              </div>

              <div className="security-password-card">

                <div className="settings-card-header">

                  <div>

                    <h3>
                      Change password
                    </h3>

                    <p>
                      Choose a new password with at least
                      8 characters.
                    </p>

                  </div>

                </div>

                <div className="security-password-fields">

                  <label htmlFor="security-new-password">
                    New password
                  </label>

                  <div className="security-password-input">

                    <input
                      id="security-new-password"
                      type={
                        showNewPassword
                          ? "text"
                          : "password"
                      }
                      value={securityForm.newPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          newPassword:
                            event.target.value,
                        }))
                      }
                      placeholder="Enter your new password"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className="security-password-toggle"
                      onClick={() =>
                        setShowNewPassword(
                          (value) => !value
                        )
                      }
                    >
                      {showNewPassword
                        ? "Hide"
                        : "Show"}
                    </button>

                  </div>

                  <label htmlFor="security-confirm-password">
                    Confirm new password
                  </label>

                  <div className="security-password-input">

                    <input
                      id="security-confirm-password"
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        securityForm.confirmPassword
                      }
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          confirmPassword:
                            event.target.value,
                        }))
                      }
                      placeholder="Enter your new password again"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className="security-password-toggle"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) => !value
                        )
                      }
                    >
                      {showConfirmPassword
                        ? "Hide"
                        : "Show"}
                    </button>

                  </div>

                </div>

                {securityError && (
                  <div className="settings-form-error">
                    {securityError}
                  </div>
                )}

                {securityMessage && (
                  <div className="settings-form-success">
                    {securityMessage}
                  </div>
                )}

                <button
                  type="button"
                  className="settings-save-button"
                  onClick={
                    handleSecurityPasswordChange
                  }
                  disabled={securitySaving}
                >
                  {securitySaving
                    ? "Updating password..."
                    : "Update password"}
                </button>

              </div>

            </section>
          ) : activeSection === "account" ? (
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
                    Manage your UpTrend account and
                    current session.
                  </p>

                </div>

              </div>

              {accountLoading ? (
                <div className="settings-note">

                  <span>i</span>

                  <p>
                    Loading your account...
                  </p>

                </div>
              ) : (
                <>

                  <div className="account-details-card">

                    <div className="account-detail-icon">
                      @
                    </div>

                    <div className="account-detail-copy">

                      <span>
                        SIGNED-IN EMAIL
                      </span>

                      <strong>
                        {accountEmail || "No email available"}
                      </strong>

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

                </>
              )}

            </section>
          ) : (
            <>

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

            </>
          )}

        </main>

      </div>

    </div>
  );
}

export default Settings;