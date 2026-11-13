
import { useState } from "react";
import "./BusinessUpgradeModal.css";

function BusinessUpgradeModal({
  open,
  onClose,
  userEmail,
  onSimulatePayment,
  onPaystackPayment,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  const isTestAccount =
    userEmail?.trim().toLowerCase() ===
    "booksupdates32@gmail.com";

  const benefits = [
    {
      title: "Extended history",
      text: "Access older sales, expenses and business records.",
    },
    {
      title: "Advanced analytics",
      text: "Understand spending, sales performance and business trends.",
    },
    {
      title: "Recurring expenses",
      text: "Automate regular business expenses on a schedule.",
    },
    {
      title: "Business insights",
      text: "Get deeper information to help you manage and grow.",
    },
  ];

  async function handleSimulatePayment() {
    if (!isTestAccount || loading) return;

    setLoading(true);
    setError("");

    try {
      await onSimulatePayment();
    } catch (err) {
      setError(
        err?.message || "Payment simulation failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePaystackPayment() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await onPaystackPayment();
    } catch (err) {
      setError(
        err?.message || "Could not connect to Paystack. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div
      className="business-upgrade-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-upgrade-title"
    >
      <div className="business-upgrade-modal">

        <button
          type="button"
          className="business-upgrade-close"
          onClick={onClose}
          aria-label="Close"
          disabled={loading}
        >
          ×
        </button>

        <span className="business-upgrade-eyebrow">
          UPTREND BUSINESS
        </span>

        <h2 id="business-upgrade-title">
          Run your business
          <span> with more power.</span>
        </h2>

        <p className="business-upgrade-intro">
          Unlock the tools designed for businesses
          that want deeper control, history and insight.
        </p>

        <div className="business-upgrade-benefits">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="business-upgrade-benefit"
            >
              <span>✓</span>

              <div>
                <strong>{benefit.title}</strong>
                <p>{benefit.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="business-upgrade-plan">
          <div>
            <span>BUSINESS PLAN</span>
            <strong>₦2,000 / 30 days</strong>
          </div>

          <small>
            {isTestAccount
              ? "Test account: temporary simulation is also available."
              : "Upgrade securely through Paystack."}
          </small>
        </div>

        {error && (
          <p role="alert" className="business-upgrade-error">
            {error}
          </p>
        )}

        <button
          type="button"
          className="business-upgrade-primary"
          onClick={handlePaystackPayment}
          disabled={loading}
        >
          {loading ? "Connecting to Paystack..." : "Pay with Paystack"}
        </button>

        {isTestAccount && (
          <button
            type="button"
            className="business-upgrade-primary"
            onClick={handleSimulatePayment}
            disabled={loading}
          >
            {loading ? "Activating Business..." : "Simulate Payment"}
          </button>
        )}

      </div>
    </div>
  );
}

export default BusinessUpgradeModal;
