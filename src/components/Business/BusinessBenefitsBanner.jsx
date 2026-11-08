import "./BusinessBenefitsBanner.css";

function BusinessBenefitsBanner({
  onUpgrade,
  compact = false,
}) {
  const benefits = [
    {
      icon: "◷",
      title: "Extended history",
      text: "Access older sales and expense records.",
    },
    {
      icon: "◈",
      title: "Advanced analytics",
      text: "Understand sales and expense performance.",
    },
    {
      icon: "↻",
      title: "Recurring expenses",
      text: "Automate regular business expenses.",
    },
    {
      icon: "▥",
      title: "Business insights",
      text: "Get deeper information about your business.",
    },
  ];

  return (
    <section
      className={`business-benefits-banner${
        compact ? " business-benefits-banner--compact" : ""
      }`}
    >
      <div className="business-benefits-glow" />

      <div className="business-benefits-content">
        <div className="business-benefits-copy">
          <span className="business-benefits-eyebrow">
            UPTREND BUSINESS
          </span>

          <h2>
            Get more from
            <span> your business.</span>
          </h2>

          <p>
            Unlock powerful tools that help you understand,
            manage and grow your business with UpTrend.
          </p>
        </div>

        <div className="business-benefits-list">
          {benefits.map((benefit) => (
            <div
              className="business-benefit"
              key={benefit.title}
            >
              <div className="business-benefit-icon">
                {benefit.icon}
              </div>

              <div>
                <strong>{benefit.title}</strong>
                <span>{benefit.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="business-benefits-action">
          <button
            type="button"
            onClick={() => onUpgrade?.()}
          >
            See Business benefits
            <span>→</span>
          </button>

          <small>
            Upgrade when you're ready. Your existing data stays
            with you.
          </small>
        </div>
      </div>
    </section>
  );
}

export default BusinessBenefitsBanner;
