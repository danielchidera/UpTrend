import "./BusinessUpgradeModal.css";

function BusinessUpgradeModal({
  open,
  onClose,
}) {
  if (!open) {
    return null;
  }

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
                <strong>
                  {benefit.title}
                </strong>

                <p>
                  {benefit.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="business-upgrade-plan">

          <div>
            <span>BUSINESS PLAN</span>
            <strong>Coming soon</strong>
          </div>

          <small>
            Secure upgrade and payment will be
            connected here.
          </small>

        </div>

        <button
          type="button"
          className="business-upgrade-primary"
          onClick={onClose}
        >
          Got it
        </button>

      </div>
    </div>
  );
}

export default BusinessUpgradeModal;
