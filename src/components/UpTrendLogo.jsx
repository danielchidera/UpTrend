import "./UpTrendLogo.css";

function UpTrendLogo({ compact = false }) {
  return (
    <div className={`uptrend-logo ${compact ? "compact" : ""}`}>
      <img
        src="/images/uptrend-logo.png"
        alt="UpTrend Business Management"
        className="uptrend-logo-image"
      />
    </div>
  );
}

export default UpTrendLogo;