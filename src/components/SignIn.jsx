import { useState } from "react";
import "./SignIn.css";
import UpTrendLogo from "./UpTrendLogo";
import { supabase } from "../lib/supabase";

function SignIn({
  onBackHome,
  onSignUp,
  onSignedIn,
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] =
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

    const email = form.email.trim();

    setError("");

    if (!email || !form.password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        });

      if (signInError) {
        setError(
          signInError.message
        );
        return;
      }

      sessionStorage.setItem(
        "uptrend_public_home",
        "false"
      );

      sessionStorage.setItem(
        "uptrend_public_page",
        "dashboard"
      );

      if (onSignedIn) {
        onSignedIn();
      }
    } catch {
      setError(
        "We couldn't sign you in. Please try again."
      );
    }
  };

  return (
    <div className="signin-page">

      <div className="signin-background-glow" />

      <header className="signin-header">

        <button
          className="signin-logo-button"
          onClick={onBackHome}
          type="button"
        >
          <UpTrendLogo />
        </button>

        <button
          className="signin-home-button"
          onClick={onBackHome}
          type="button"
        >
          ← Back to Home
        </button>

      </header>

      <main className="signin-main">

        <section className="signin-card">

          <div className="signin-heading">

            <div className="signin-eyebrow">
              <span />
              WELCOME BACK
            </div>

            <h1>
              Welcome back to
              <span> UpTrend.</span>
            </h1>

            <p>
              Sign in to continue managing your
              business from your workspace.
            </p>

          </div>

          <form
            className="signin-form"
            onSubmit={handleSubmit}
          >

            <div className="signin-field">

              <label htmlFor="signin-email">
                Email address
              </label>

              <input
                id="signin-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
              />

            </div>

            <div className="signin-field">

              <div className="signin-label-row">
                <label htmlFor="signin-password">
                  Password
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={() =>
                    setError(
                      "Password recovery will be connected with Supabase in Step 7."
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>

              <div className="signin-password-wrap">

                <input
                  id="signin-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="signin-password-toggle"
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

            {error && (
              <div className="signin-error">
                {error}
              </div>
            )}

            <button
              className="signin-submit"
              type="submit"
            >
              Sign in
              <span>→</span>
            </button>

          </form>

          <div className="signin-divider">
            <span />
            <small>New to UpTrend?</small>
            <span />
          </div>

          <button
            className="signin-signup"
            type="button"
            onClick={onSignUp}
          >
            Create an account
          </button>

          <p className="signin-note">
            Your business workspace will be available
            after you sign in.
          </p>

        </section>

      </main>

      <footer className="signin-footer">
        <UpTrendLogo compact />
        <span>
          Business management, simplified.
        </span>
      </footer>

    </div>
  );
}

export default SignIn;
