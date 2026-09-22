import { useEffect, useMemo, useState } from "react";
import "./ProductDemo.css";

const SCREENS = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "BUSINESS OVERVIEW",
    title: "Your business, moving forward.",
  },
  {
    id: "sales",
    label: "Sales",
    eyebrow: "SALES MANAGEMENT",
    title: "Track every sale with clarity.",
  },
  {
    id: "products",
    label: "Products",
    eyebrow: "INVENTORY CONTROL",
    title: "Know what you have in stock.",
  },
  {
    id: "expenses",
    label: "Expenses",
    eyebrow: "EXPENSE TRACKING",
    title: "Keep your spending under control.",
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "BUSINESS REPORTS",
    title: "Understand how your business is performing.",
  },
  {
    id: "settings",
    label: "SETTINGS",
    eyebrow: "ACCOUNT SETTINGS",
    title: "Your business, configured your way.",
  },
];

function DashboardScreen() {
  return (
    <>
      <div className="pd-kpis">
        <div>
          <span>Cash at Hand</span>
          <strong>₦112,300</strong>
          <small>Available balance</small>
        </div>

        <div>
          <span>Today's Sales</span>
          <strong>₦128,500</strong>
          <small className="positive">↑ 12.4%</small>
        </div>

        <div>
          <span>Today's Profit</span>
          <strong>₦42,800</strong>
          <small className="positive">Healthy margin</small>
        </div>

        <div>
          <span>Inventory</span>
          <strong>₦427,000</strong>
          <small>124 items</small>
        </div>
      </div>

      <div className="pd-dashboard-grid">
        <div className="pd-card pd-chart-card">
          <div className="pd-card-head">
            <strong>Sales Trend</strong>
            <span>Last 7 days</span>
          </div>

          <div className="pd-chart">
            <i />
            <i />
            <i />

            <svg viewBox="0 0 600 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pdChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#45e886" stopOpacity=".3" />
                  <stop offset="100%" stopColor="#45e886" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M0 145 C65 135 80 105 125 115 C170 125 185 75 230 92 C275 110 295 52 335 72 C375 92 400 40 435 55 C470 68 515 28 600 35 L600 180 L0 180 Z"
                fill="url(#pdChartFill)"
              />

              <path
                d="M0 145 C65 135 80 105 125 115 C170 125 185 75 230 92 C275 110 295 52 335 72 C375 92 400 40 435 55 C470 68 515 28 600 35"
                fill="none"
                stroke="#45e886"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>

        <div className="pd-card pd-activity">
          <div className="pd-card-head">
            <strong>Recent Activity</strong>
            <span>View all</span>
          </div>

          <DemoActivity title="Sale recorded" detail="Today · 10:42 AM" value="+₦24,500" />
          <DemoActivity title="Expense recorded" detail="Today · 09:18 AM" value="−₦5,000" negative />
          <DemoActivity title="Stock added" detail="Yesterday" value="+12 items" />
        </div>
      </div>
    </>
  );
}

function SalesScreen() {
  return (
    <div className="pd-page-content">
      <div className="pd-stat-row">
        <DemoStat label="Today's Sales" value="₦128,500" change="+12.4%" />
        <DemoStat label="Transactions" value="38" change="+6 today" />
        <DemoStat label="Gross Profit" value="₦42,800" change="33.3% margin" />
      </div>

      <div className="pd-card pd-table-card">
        <div className="pd-card-head">
          <strong>Recent Sales</strong>
          <span>View all sales</span>
        </div>

        <DemoRow name="Rice · 25kg" qty="2" amount="₦48,000" status="Completed" />
        <DemoRow name="Cooking Oil · 5L" qty="4" amount="₦32,000" status="Completed" />
        <DemoRow name="Sugar · 10kg" qty="3" amount="₦18,500" status="Completed" />
        <DemoRow name="Beverages" qty="12" amount="₦30,000" status="Completed" />
      </div>
    </div>
  );
}

function ProductsScreen() {
  return (
    <div className="pd-page-content">
      <div className="pd-stat-row">
        <DemoStat label="Products" value="124" change="Total items" />
        <DemoStat label="Low Stock" value="8" change="Needs attention" warning />
        <DemoStat label="Inventory Value" value="₦427,000" change="At cost" />
      </div>

      <div className="pd-card pd-table-card">
        <div className="pd-card-head">
          <strong>Inventory</strong>
          <span>Manage products</span>
        </div>

        <DemoProduct name="Premium Rice" stock="42" cost="₦18,500" />
        <DemoProduct name="Cooking Oil" stock="18" cost="₦7,200" />
        <DemoProduct name="Granulated Sugar" stock="7" cost="₦5,800" low />
        <DemoProduct name="Beverages" stock="57" cost="₦3,400" />
      </div>
    </div>
  );
}

function ExpensesScreen() {
  return (
    <div className="pd-page-content">
      <div className="pd-stat-row">
        <DemoStat label="Today's Expenses" value="₦16,000" change="3 entries" />
        <DemoStat label="This Month" value="₦184,500" change="Operating costs" />
        <DemoStat label="Remaining" value="₦8,500" change="After gross profit" />
      </div>

      <div className="pd-card pd-table-card">
        <div className="pd-card-head">
          <strong>Recent Expenses</strong>
          <span>View expenses</span>
        </div>

        <DemoExpense name="Transportation" category="Logistics" amount="₦5,000" />
        <DemoExpense name="Electricity" category="Utilities" amount="₦7,500" />
        <DemoExpense name="Packaging" category="Operations" amount="₦3,500" />
      </div>
    </div>
  );
}

function ReportsScreen() {
  return (
    <div className="pd-page-content">
      <div className="pd-report-banner">
        <div>
          <span>BUSINESS PERFORMANCE</span>
          <strong>September 2026</strong>
        </div>

        <button>Generate Report</button>
      </div>

      <div className="pd-stat-row">
        <DemoStat label="Total Sales" value="₦1.84m" change="+18.2%" />
        <DemoStat label="Gross Profit" value="₦604k" change="32.8%" />
        <DemoStat label="Expenses" value="₦184k" change="−4.6%" />
      </div>

      <div className="pd-report-bars">
        <span style={{ height: "42%" }} />
        <span style={{ height: "55%" }} />
        <span style={{ height: "48%" }} />
        <span style={{ height: "68%" }} />
        <span style={{ height: "62%" }} />
        <span style={{ height: "82%" }} />
        <span style={{ height: "94%" }} />
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div className="pd-page-content">
      <div className="pd-settings-grid">
        <div className="pd-setting-card">
          <span>BUSINESS PROFILE</span>
          <strong>Business information</strong>
          <p>Manage your business name, contact details and profile.</p>
          <button>Edit profile</button>
        </div>

        <div className="pd-setting-card">
          <span>ACCOUNT</span>
          <strong>Account preferences</strong>
          <p>Control your account and application preferences.</p>
          <button>Manage account</button>
        </div>

        <div className="pd-setting-card">
          <span>SECURITY</span>
          <strong>Security settings</strong>
          <p>Manage password, sessions and account security.</p>
          <button>Open security</button>
        </div>

        <div className="pd-setting-card">
          <span>APPEARANCE</span>
          <strong>Theme preferences</strong>
          <p>Choose how UpTrend looks across your devices.</p>
          <button>Customize</button>
        </div>
      </div>
    </div>
  );
}

function DemoActivity({ title, detail, value, negative }) {
  return (
    <div className="pd-activity-row">
      <span className={`pd-activity-icon ${negative ? "negative" : ""}`}>
        {negative ? "−" : "₦"}
      </span>

      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>

      <b className={negative ? "negative-text" : ""}>{value}</b>
    </div>
  );
}

function DemoStat({ label, value, change, warning }) {
  return (
    <div className="pd-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={warning ? "warning-text" : "positive"}>{change}</small>
    </div>
  );
}

function DemoRow({ name, qty, amount, status }) {
  return (
    <div className="pd-table-row">
      <div>
        <strong>{name}</strong>
        <small>{qty} units</small>
      </div>

      <span>{amount}</span>
      <em>{status}</em>
    </div>
  );
}

function DemoProduct({ name, stock, cost, low }) {
  return (
    <div className="pd-table-row">
      <div>
        <strong>{name}</strong>
        <small>Cost price · {cost}</small>
      </div>

      <span className={low ? "warning-text" : ""}>{stock} units</span>
      <em>{low ? "Low stock" : "In stock"}</em>
    </div>
  );
}

function DemoExpense({ name, category, amount }) {
  return (
    <div className="pd-table-row">
      <div>
        <strong>{name}</strong>
        <small>{category}</small>
      </div>

      <span className="negative-text">−{amount}</span>
      <em>Recorded</em>
    </div>
  );
}

function DemoScreen({ screen }) {
  switch (screen.id) {
    case "sales":
      return <SalesScreen />;
    case "products":
      return <ProductsScreen />;
    case "expenses":
      return <ExpensesScreen />;
    case "reports":
      return <ReportsScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return <DashboardScreen />;
  }
}

function DemoShell({ screen, compact = false }) {
  return (
    <div className={`pd-shell ${compact ? "compact" : ""}`}>
      <aside className="pd-sidebar">
        <div className="pd-brand">
          <span>↗</span>
          <strong>UpTrend</strong>
        </div>

        {SCREENS.map((item) => (
          <div
            key={item.id}
            className={`pd-nav ${item.id === screen.id ? "active" : ""}`}
          >
            <span>
              {item.id === "dashboard"
                ? "▦"
                : item.id === "sales"
                  ? "₦"
                  : item.id === "products"
                    ? "▣"
                    : item.id === "expenses"
                      ? "◫"
                      : item.id === "reports"
                        ? "▥"
                        : "⚙"}
            </span>

            {item.label}
          </div>
        ))}
      </aside>

      <section className="pd-main">
        <div className="pd-topbar">
          <div>
            <span>{screen.eyebrow}</span>
            <strong>{screen.title}</strong>
          </div>

          <button>+ Record Sale</button>
        </div>

        <DemoScreen screen={screen} />
      </section>
    </div>
  );
}

function ProductDemo({
  fullscreen = false,
  tablet = false,
  onClose,
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const screen = useMemo(() => SCREENS[index], [index]);

  useEffect(() => {
    if (!playing) return undefined;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SCREENS.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, [playing]);

  const previous = () => {
    setIndex((current) => (current - 1 + SCREENS.length) % SCREENS.length);
  };

  const next = () => {
    setIndex((current) => (current + 1) % SCREENS.length);
  };

  return (
    <div
  className={`product-demo ${
    fullscreen ? "product-demo-fullscreen" : ""
  } ${tablet ? "product-demo-tablet" : ""}`}
>
      {fullscreen && (
        <div className="pd-demo-header">
          <div>
            <span>UPTREND PRODUCT TOUR</span>
            <strong>{screen.label}</strong>
          </div>

          <button className="pd-close" onClick={onClose} aria-label="Close demo">
            ×
          </button>
        </div>
      )}

      <div className="pd-demo-device">
        <div className="pd-browser">
          <div className="pd-browser-dots">
            <i />
            <i />
            <i />
          </div>

          <div className="pd-browser-address">
            app.uptrend.business
          </div>

          <span className="pd-browser-user">Business Owner</span>
        </div>

        <div className="pd-screen-wrap">
          <DemoShell screen={screen} />
        </div>
      </div>

      <div className="pd-demo-controls">
        <div className="pd-demo-sections">
          {SCREENS.map((item, itemIndex) => (
            <button
              key={item.id}
              className={itemIndex === index ? "active" : ""}
              onClick={() => {
                setIndex(itemIndex);
                setPlaying(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pd-demo-buttons">
          <button onClick={previous}>‹</button>

          <button
            className="pd-play"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>

          <button onClick={next}>›</button>
        </div>
      </div>
    </div>
  );
}

export default ProductDemo;
