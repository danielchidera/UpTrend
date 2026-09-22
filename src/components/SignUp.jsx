import { useState } from "react";
import "./SignUp.css";
import UpTrendLogo from "./UpTrendLogo";
import { supabase } from "../lib/supabase";

function SignUp({
  onBackHome,
  onSignIn,
  onRegistered,
}) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const username = form.username.trim();
    const email = form.email.trim();

    setError("");

    if (!name || !username || !email || !form.password) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Your password must be at least 8 characters."
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    try {
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            data: {
              name,
              username,
            },
          },
        });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      /*
        Supabase may require email confirmation before
        creating an authenticated session.

        If a session is returned immediately, continue
        into the UpTrend dashboard.
      */
      if (data.session) {
        if (onRegistered) {
          onRegistered();
        }
        return;
      }

      setError(
        "Account created successfully. Please check your email to verify your account before signing in."
      );
    } catch {
      setError(
        "We couldn't complete registration. Please try again."
      );
    }
  };

  return (
    <div className="signup-page">

      <div className="signup-background-glow" />

      <header className="signup-header">

        <button
          className="signup-logo-button"
          onClick={onBackHome}
          type="button"
        >
          <UpTrendLogo />
        </button>

        <button
          className="signup-home-button"
          onClick={onBackHome}
          type="button"
        >
          ← Back to Home
        </button>

      </header>

      <main className="signup-main">

        <section className="signup-card">

          <div className="signup-heading">

            <div className="signup-eyebrow">
              <span />
              GET STARTED
            </div>

            <h1>
              Create your
              <span> UpTrend account.</span>
            </h1>

            <p>
              Set up your account and start managing
              your business from one workspace.
            </p>

          </div>

          <form
            className="signup-form"
            onSubmit={handleSubmit}
          >

            <div className="signup-field">

              <label htmlFor="signup-name">
                Full name
              </label>

              <input
                id="signup-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                autoComplete="name"
              />

            </div>

            <div className="signup-field">

              <label htmlFor="signup-username">
                Username
              </label>

              <input
                id="signup-username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username"
                autoComplete="username"
              />

            </div>

            <div className="signup-field">

              <label htmlFor="signup-email">
                Email address
              </label>

              <input
                id="signup-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
              />

            </div>

            <div className="signup-field">

              <label htmlFor="signup-password">
                Password
              </label>

              <div className="signup-password-wrap">

                <input
                  id="signup-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>

            <div className="signup-field">

              <label htmlFor="signup-confirm-password">
                Confirm password
              </label>

              <div className="signup-password-wrap">

                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      (current) => !current
                    )
                  }
                >
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>

            {error && (
              <div className="signup-error">
                {error}
              </div>
            )}

            <button
              className="signup-submit"
              type="submit"
            >
              Create account
              <span>→</span>
            </button>

          </form>

          <div className="signup-divider">
            <span />
            <small>Already have an account?</small>
            <span />
          </div>

          <button
            className="signup-signin"
            type="button"
            onClick={onSignIn}
          >
            Sign in instead
          </button>

          <p className="signup-note">
            By creating an account, you can manage
            your business from your UpTrend workspace.
          </p>

        </section>

      </main>

      <footer className="signup-footer">
        <UpTrendLogo compact />
        <span>
          Business management, simplified.
        </span>
      </footer>

    </div>
  );
}

export default SignUp;
