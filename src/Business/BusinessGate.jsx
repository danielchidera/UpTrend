import { LockKeyhole, Sparkles } from "lucide-react";

function BusinessGate({
  subscription,
  children,
  title = "Business feature",
  description =
    "Upgrade to UpTrend Business to unlock this feature.",
  onUpgrade,
}) {
  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );

  if (isBusiness) {
    return children;
  }

  return (
    <section
      style={{
        border: "1px solid rgba(214, 174, 67, 0.28)",
        borderRadius: "18px",
        padding: "28px",
        background:
          "linear-gradient(145deg, rgba(18,29,23,.98), rgba(5,8,6,1))",
        boxShadow:
          "0 20px 60px rgba(0,0,0,.35), 0 0 40px rgba(214,174,67,.06)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          margin: "0 auto 16px",
          borderRadius: "14px",
          display: "grid",
          placeItems: "center",
          background: "rgba(214,174,67,.10)",
          color: "#d6ae43",
        }}
      >
        <LockKeyhole size={21} />
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
          padding: "5px 9px",
          borderRadius: "999px",
          background: "rgba(214,174,67,.10)",
          color: "#d6ae43",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}
      >
        <Sparkles size={12} />
        Business
      </div>

      <h3
        style={{
          margin: "0 0 8px",
          color: "#fff",
          fontSize: "18px",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          maxWidth: "460px",
          margin: "0 auto 20px",
          color: "rgba(255,255,255,.62)",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            border: 0,
            borderRadius: "11px",
            padding: "11px 18px",
            background:
              "linear-gradient(135deg, #d6ae43, #f0cc67)",
            color: "#171007",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Upgrade to Business
        </button>
      )}
    </section>
  );
}

export default BusinessGate;
