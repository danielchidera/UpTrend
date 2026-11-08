import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Reports.css";

const CATEGORY_LABELS = {
  sales: "Sales",
  expenses: "Expenses",
  products: "Products",
  inventory: "Inventory",
  purchases: "Purchases",
  returns: "Returns",
  finance: "Finance",
  invoices: "Invoices",
  customers: "Customers",
  suppliers: "Suppliers",
  backup: "Backup",
  security: "Security",
  system: "System",
};


const getAuditContext = (log) => {
  const details = log.details && typeof log.details === "object"
    ? log.details
    : {};

  const action = String(log.action || "").toLowerCase();
  const category = String(log.category || "").toLowerCase();

  const firstValue = (...values) => {
    const found = values.find((value) =>
      value !== null && value !== undefined && String(value).trim() !== ""
    );
    return found === undefined ? "" : String(found).trim();
  };

  const isIncoming =
    String(details.type || "").toLowerCase() === "credit" ||
    action.includes("received") ||
    action.includes("sale") ||
    action.includes("income");

  const isOutgoing =
    String(details.type || "").toLowerCase() === "debit" ||
    action.includes("sent") ||
    action.includes("transfer") ||
    action.includes("expense") ||
    action.includes("payment") ||
    action.includes("refund") ||
    action.includes("purchase");

  const direction = isIncoming
    ? "INCOMING"
    : isOutgoing
      ? "OUTGOING"
      : "RECORD CHANGE";

  const channel = firstValue(
    details.channel,
    details.source_type,
    details.transaction_channel,
    details.category,
    category,
    log.entity_type
  );

  const source = firstValue(
    details.source,
    details.from,
    details.from_name,
    details.source_name,
    details.payment_source,
    details.customer,
    details.customer_name,
    details.origin
  );

  const destination = firstValue(
    details.destination,
    details.to,
    details.to_name,
    details.destination_name,
    details.recipient,
    details.recipient_name,
    details.supplier,
    details.supplier_name
  );

  return {
    direction,
    channel: channel
      ? channel.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "Not specified",
    endpointLabel: direction === "INCOMING" ? "Source" : "Destination",
    endpoint: direction === "INCOMING" ? source : destination,
  };
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatAmount = (amount, currency = "NGN") => {
  if (amount === null || amount === undefined || amount === "") return null;

  const number = Number(amount);
  if (!Number.isFinite(number)) return null;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${currency || "NGN"} ${number.toLocaleString()}`;
  }
};

// Financial direction determines the audit entry color.
const getAuditFlow = (log) => {
  const action = String(log.action || "").toLowerCase();
  const category = String(log.category || "").toLowerCase();
  const details = log.details || {};

  const outflowActions = [
    "expense",
    "refund",
    "supplier_payment",
    "purchase",
    "debit",
    "outflow",
  ];

  const inflowActions = [
    "sale",
    "income",
    "credit",
    "deposit",
    "received",
    "inflow",
  ];

  if (
    category === "expenses" ||
    category === "purchases" ||
    category === "returns" ||
    outflowActions.some((word) => action.includes(word)) ||
    String(details.type || "").toLowerCase() === "debit"
  ) {
    return "outflow";
  }

  if (
    category === "sales" ||
    inflowActions.some((word) => action.includes(word)) ||
    String(details.type || "").toLowerCase() === "credit"
  ) {
    return "inflow";
  }

  return "neutral";
};

function Reports() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const loadLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in to view audit history.");

      const { data, error: queryError } = await supabase
        .from("uptrend_audit_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (queryError) throw queryError;
      setLogs(data || []);
    } catch (err) {
      console.error("Could not load audit history:", err);
      setError(err.message || "Could not load audit history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesCategory =
        category === "all" || log.category === category;
      const matchesStatus = status === "all" || log.status === status;

      const searchable = [
        log.action,
        log.description,
        log.category,
        log.actor_email,
        log.entity_type,
        log.entity_id,
        log.details ? JSON.stringify(log.details) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        matchesStatus &&
        (!term || searchable.includes(term))
      );
    });
  }, [logs, search, category, status]);

  const successfulCount = logs.filter((log) => log.status === "success").length;
  const warningCount = logs.filter(
    (log) => log.status === "warning" || log.status === "failed"
  ).length;

  const categories = [...new Set(logs.map((log) => log.category).filter(Boolean))];

  return (
    <main className="audit-page">
      <section className="audit-heading">
        <div>
          <span className="audit-eyebrow">BUSINESS ACTIVITY</span>
          <h1>Audit History</h1>
          <p>
            A chronological record of activity across your business.
          </p>
        </div>

        <button
          type="button"
          className="audit-refresh"
          onClick={loadLogs}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="audit-stats" aria-label="Audit summary">
        <article className="audit-stat">
          <span className="audit-stat-icon">▤</span>
          <div>
            <span className="audit-stat-label">Total activities</span>
            <strong>{logs.length}</strong>
          </div>
        </article>
        <article className="audit-stat">
          <span className="audit-stat-icon audit-green">✓</span>
          <div>
            <span className="audit-stat-label">Successful</span>
            <strong>{successfulCount}</strong>
          </div>
        </article>
        <article className="audit-stat">
          <span className="audit-stat-icon audit-amber">!</span>
          <div>
            <span className="audit-stat-label">Warnings / failed</span>
            <strong>{warningCount}</strong>
          </div>
        </article>
      </section>

      <section className="audit-panel">
        <div className="audit-panel-heading">
          <div>
            <h2>Activity log</h2>
            <p>Latest records appear first. Showing up to 500 records.</p>
          </div>
          <span className="audit-record-count">
            {filteredLogs.length} shown
          </span>
        </div>

        <div className="audit-filters">
          <label className="audit-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities..."
              aria-label="Search activities"
            />
          </label>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {CATEGORY_LABELS[item] || item}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="success">Successful</option>
            <option value="warning">Warning</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {error ? (
          <div className="audit-message audit-error">
            <strong>Unable to load history</strong>
            <span>{error}</span>
            <button type="button" onClick={loadLogs}>Try again</button>
          </div>
        ) : loading ? (
          <div className="audit-message">Loading activity history...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="audit-empty">
            <div className="audit-empty-icon">▤</div>
            <h3>{logs.length ? "No matching activities" : "No activity recorded yet"}</h3>
            <p>
              {logs.length
                ? "Try changing your search or filters."
                : "When activity logging is connected, business actions will appear here with their time and details."}
            </p>
            {(search || category !== "all" || status !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setStatus("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="audit-list">
            {filteredLogs.map((log) => {
              const amount = formatAmount(log.amount, log.currency);
              const flow = getAuditFlow(log);
              const auditContext = getAuditContext(log);
              const statusClass = ["success", "warning", "failed", "cancelled"].includes(
                log.status
              )
                ? log.status
                : "neutral";

              return (
                <article
                  className={`audit-entry audit-entry--${flow}`}
                  key={log.id}
                >
                  <div className="audit-entry-marker" aria-hidden="true">
                    <span />
                  </div>
                  <div className="audit-entry-content">
                    <div className="audit-entry-top">
                      <div className="audit-entry-title">
                        <h3>{log.description || log.action || "Activity recorded"}</h3>
                        <span className="audit-category">
                          {CATEGORY_LABELS[log.category] || log.category || "System"}
                        </span>
                      </div>
                      <span className={`audit-status ${statusClass}`}>
                        {log.status || "recorded"}
                      </span>
                    </div>

                    <div className="audit-entry-meta">
                      <span>{formatDate(log.created_at)}</span>
                      {log.actor_email && <span>By {log.actor_email}</span>}
                      {log.entity_type && (
                        <span>
                          {log.entity_type}
                          {log.entity_id ? ` · ${log.entity_id}` : ""}
                        </span>
                      )}
                      {amount && (
                        <strong className={`audit-amount audit-amount--${flow}`}>
                          {amount}
                        </strong>
                      )}
                    </div>

                    <div className={`audit-context audit-context--${flow}`}>
                      <span className="audit-direction">{auditContext.direction}</span>
                      <span className="audit-context-item">
                        <strong>Channel:</strong> {auditContext.channel}
                      </span>
                      <span className="audit-context-item">
                        <strong>{auditContext.endpointLabel}:</strong>{" "}
                        {auditContext.endpoint || "Not specified"}
                      </span>
                    </div>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <details className="audit-details">
                        <summary>View details</summary>
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default Reports;
