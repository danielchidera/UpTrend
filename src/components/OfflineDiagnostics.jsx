import { useState } from "react";
import { runOfflineDiagnostics } from "../lib/offlineDiagnostics";

export default function OfflineDiagnostics({ userId }) {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const runTest = async () => {
    setRunning(true);
    setError("");
    setReport(null);

    try {
      const result = await runOfflineDiagnostics(userId);
      setReport(result);
    } catch (err) {
      setError(err.message || "Diagnostic test failed.");
    } finally {
      setRunning(false);
    }
  };

  const statusColor = (status) => {
    if (status === "PASS") return "#16a34a";
    if (status === "FAIL") return "#dc2626";
    return "#d97706";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h1>UpTrend Offline Diagnostics</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Run automated checks on your local database, cached business
        records, subscription and synchronization readiness.
        These checks do not modify your business records.
      </p>

      <button
        type="button"
        onClick={runTest}
        disabled={running || !userId}
        style={{
          padding: "13px 22px",
          border: 0,
          borderRadius: 10,
          background: "#16a34a",
          color: "#fff",
          fontWeight: 700,
          cursor: running ? "wait" : "pointer",
        }}
      >
        {running ? "Running diagnostics..." : "Run Offline Test"}
      </button>

      {error && (
        <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>
      )}

      {report && (
        <div style={{ marginTop: 24 }}>
          <h2>
            Overall status:{" "}
            <span style={{ color: statusColor(report.overall) }}>
              {report.overall}
            </span>
          </h2>

          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            margin: "16px 0",
          }}>
            {[
              ["Passed", report.summary.passed, "#16a34a"],
              ["Warnings", report.summary.warnings, "#d97706"],
              ["Failed", report.summary.failed, "#dc2626"],
              ["Total", report.summary.total, "var(--text)"],
            ].map(([label, value, color]) => (
              <div key={label} style={{
                flex: "1 1 110px",
                padding: 14,
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {label}
                </div>
                <strong style={{ fontSize: 25, color }}>{value}</strong>
              </div>
            ))}
          </div>

          <h3>Test results</h3>

          <div style={{ display: "grid", gap: 10 }}>
            {report.results.map((item, index) => (
              <div key={`${item.name}-${index}`} style={{
                padding: 14,
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}>
                  <strong>{item.name}</strong>
                  <strong style={{ color: statusColor(item.status) }}>
                    {item.status}
                  </strong>
                </div>
                <p style={{
                  margin: "7px 0 0",
                  color: "var(--muted)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {item.details}
                </p>
              </div>
            ))}
          </div>

          <p style={{
            marginTop: 18,
            color: "var(--muted)",
            fontSize: 12,
          }}>
            Tested: {new Date(report.testedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
