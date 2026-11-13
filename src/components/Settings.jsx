import "./Settings.css";
import { useEffect, useRef, useState } from "react";
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

  const previousSettingsSection = useRef(activeSection);

  useEffect(() => {
    if (previousSettingsSection.current === activeSection) return;
    previousSettingsSection.current = activeSection;

    const guides = {
      appearance: [
        { target: ".theme-options", title: "Choose Your Theme", text: "Select Dark, Light or Scheduled mode. Your selection is applied automatically across UpTrend." },
        { target: ".theme-option:nth-child(1)", title: "Dark Mode", text: "Choose Dark to keep the UpTrend interface in dark mode at all times." },
        { target: ".theme-option:nth-child(2)", title: "Light Mode", text: "Choose Light to use a bright interface at all times." },
        { target: ".theme-option:nth-child(3)", title: "Scheduled Mode", text: "Scheduled mode automatically uses Light from 6:00 AM to 6:00 PM and Dark from 6:00 PM to 6:00 AM." },
        { target: ".current-theme", title: "Current Appearance", text: "This indicator shows the theme currently being applied." },
        { target: ".schedule-preview", title: "Automatic Theme Schedule", text: "Review the scheduled switch times. The schedule is fixed at 6:00 AM and 6:00 PM." },
        { target: ".settings-note", title: "Saved Automatically", text: "Your appearance preference is saved automatically and remains after refreshing UpTrend." }
      ],
      profile: [
        { target: ".settings-card-header", title: "Personal Information", text: "Manage the name and username connected to your UpTrend account." },
        { target: ".settings-profile-fields label:nth-child(1)", title: "Your Name", text: "Enter the name you want associated with your UpTrend profile." },
        { target: ".settings-profile-fields label:nth-child(2)", title: "Username", text: "Enter or update your account username." },
        { target: ".settings-profile-fields label:nth-child(3)", title: "Email Address", text: "Your account email is displayed here but cannot be edited from this form." },
        { target: ".settings-save-button", title: "Save Profile Changes", text: "Click Save Changes to update your name and username. Both fields are required." },
        { target: ".settings-form-error", title: "Profile Errors", text: "Validation or account errors appear here. Correct the issue before trying to save again." },
        { target: ".settings-form-success", title: "Profile Updated", text: "A success message appears here when your profile update is completed." }
      ],
      account: [
        { target: ".account-details-card", title: "Signed-in Account", text: "This card displays the email address currently signed in to UpTrend." },
        { target: ".account-detail-copy", title: "Account Email", text: "Check this email to confirm which account is currently active on this device." },
        { target: ".account-access-row", title: "Account Access", text: "This section contains the logout action for your current UpTrend session." },
        { target: ".settings-logout-button", title: "Log Out", text: "Use this button to sign out of UpTrend on this device. Make sure your work is saved before logging out." }
      ],
      notifications: [
        { target: ".notification-preference-list", title: "Smart Alerts", text: "Choose which business events UpTrend should bring to your attention. Change the switches and save your preferences." },
        { target: ".notification-preference.master", title: "Master Smart Alerts Switch", text: "Turn this off to disable the business alert preferences below. Turn it on to enable the individual alert controls." },
        { target: ".notification-preference:nth-child(2)", title: "Inventory Alerts", text: "Control alerts about stock, low stock and stock received." },
        { target: ".notification-preference:nth-child(3)", title: "Payment Alerts", text: "Control supplier and customer credit payment alerts." },
        { target: ".notification-preference:nth-child(4)", title: "Sales and Expenses Alerts", text: "Control alerts about revenue, profit, margin and expenses." },
        { target: ".notification-preference:nth-child(5)", title: "Business Target Alerts", text: "Control alerts relating to revenue, profit, units and expense limits." },
        { target: ".settings-save-button", title: "Save Notification Preferences", text: "Save your selected alert preferences. UpTrend confirms when they have been saved successfully." }
      ],
      security: [
        { target: ".security-status-card", title: "Password Protection", text: "This card confirms that your UpTrend account is protected by its authentication password." },
        { target: ".security-password-card", title: "Change Your Password", text: "Use this section to replace your current account password. Choose a strong password with at least eight characters." },
        { target: ".security-password-fields", title: "Password Fields", text: "Enter your new password, then enter it again to confirm. Both entries must match." },
        { target: ".security-password-input:nth-of-type(1)", title: "New Password", text: "Enter the new password you want to use. It must contain at least eight characters." },
        { target: ".security-password-input:nth-of-type(2)", title: "Confirm Password", text: "Re-enter the new password exactly as entered above." },
        { target: ".security-password-toggle", title: "Show or Hide Password", text: "Use Show to reveal the password while checking it, or Hide to conceal it again." },
        { target: ".settings-save-button", title: "Update Password", text: "Click Update Password to submit the change. UpTrend checks that both fields are filled, contain at least eight characters and match." }
      ],
      backups: [
        { target: ".backup-center-hero", title: "UpTrend Backup Center", text: "Welcome to Backup Center. This area helps protect your business data by creating downloadable backup files and restoring data from a previously saved UpTrend backup." },
        { target: ".backup-center-status", title: "Last Backup", text: "This shows the date and time of the latest backup recorded in the backup history on this device. If no backup has been created, it displays No backup yet." },
        { target: ".backup-center-actions", title: "Backup and Restore Actions", text: "There are two main actions here: create a backup of your current business data or restore data from a previously downloaded backup file." },
        { target: ".backup-action-card:nth-child(1)", title: "Create a Backup", text: "This creates a full UpTrend JSON backup containing your current products, sales, expenses and finance data." },
        { target: ".backup-primary-button", title: "Backup Now", text: "Click Backup Now to create and download your backup file. Keep the downloaded JSON file somewhere safe so you can use it later if needed." },
        { target: ".backup-action-card:nth-child(2)", title: "Restore a Backup", text: "Use this option to select a previously downloaded UpTrend JSON backup file. UpTrend asks for confirmation before replacing the current data." },
        { target: ".backup-secondary-button", title: "Select Restore File", text: "Click Restore and choose a valid UpTrend JSON backup file. Confirm only when you are certain you want to replace the current business data on this device. A successful restore reloads UpTrend." },
        { target: ".backup-included", title: "What Is Protected", text: "The current backup file includes four data groups: Products and inventory, Sales records, Expenses and Finance data. Other account information and business records are not included in this backup implementation." },
        { target: ".backup-data-grid", title: "Included Data Categories", text: "These four items identify the data groups saved in the backup file: products and inventory, sales, expenses and finance." },
        { target: ".backup-warning", title: "Important Restore Warning", text: "Restoring a backup replaces the current business data on this device. Keep backup files somewhere safe and make sure you select the correct file before confirming restoration." },
        { target: ".backup-history", title: "Recent Backup History", text: "This section appears after backups have been created. It lists recent backup dates and times. UpTrend keeps up to ten backup history entries on this device." },
        { target: ".backup-history-item", title: "Individual Backup Record", text: "Each entry identifies a full UpTrend backup and shows when it was created. The history records the backup event; the downloaded JSON file itself should be kept separately." }
      ]
    };

    const steps = guides[activeSection];
    if (!steps) return;

    window.dispatchEvent(new CustomEvent("uptrend:open-context-tour", {
      detail: {
        page: "settings",
        context: "settings-" + activeSection,
        steps
      }
    }));
  }, [activeSection]);

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