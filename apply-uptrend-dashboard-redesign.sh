#!/bin/sh
set -eu

cd /home/UpTrend

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/sdcard/Download/UpTrend-before-dashboard-redesign-$STAMP.tar.gz"

echo "=== UPTREND DASHBOARD REDESIGN — SAFE BACKUP ==="
tar -czf "$BACKUP" .
echo "Backup: $BACKUP"

mkdir -p src/components

cat > src/components/Dashboard.jsx <<'EOF'
import { useEffect, useMemo, useState } from "react";
import { getSales, getProducts } from "../utils/uptrendStore";
import {
  getFinance,
  saveFinance,
  calculateCashFlow,
} from "../utils/financeStore";
import "./Dashboard.css";

const EXPENSES_KEY = "uptrend_expenses";

function Dashboard({ onRecordSale, onRecordExpense, onAddProduct, onViewReports = () => {} }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [finance, setFinance] = useState(getFinance());
  const [openingInput, setOpeningInput] = useState(
    String(getFinance().openingBalance || "")
  );
  const [showOpeningForm, setShowOpeningForm] = useState(false);

  const loadData = () => {
    setSales(getSales());
    setProducts(getProducts());

    try {
      const saved = localStorage.getItem(EXPENSES_KEY);
      setExpenses(saved ? JSON.parse(saved) : []);
    } catch {
      setExpenses([]);
    }

    const currentFinance = getFinance();
    setFinance(currentFinance);
    setOpeningInput(String(currentFinance.openingBalance || ""));
  };

  useEffect(() => {
    loadData();
    window.addEventListener("focus", loadData);
    window.addEventListener("storage", loadData);
    return () => {
      window.removeEventListener("focus", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateKey(new Date());

  const cashFlow = useMemo(
    () => calculateCashFlow(sales, expenses, finance),
    [sales, expenses, finance]
  );

  const todaySales = sales
    .filter((sale) => sale.date === today)
    .reduce((sum, sale) => sum + Number(sale.totalSelling || 0), 0);

  const todayProfit = sales
    .filter((sale) => sale.date === today)
    .reduce((sum, sale) => sum + Number(sale.grossProfit || 0), 0);

  const grossProfit = sales.reduce(
    (sum, sale) => sum + Number(sale.grossProfit || 0),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const netProfit = grossProfit - totalExpenses;

  const stockUnits = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum +
      Number(product.stock || 0) * Number(product.costPrice || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.stock || 0) <= Number(product.lowStockAt || 0)
  );

  const recentSales = [...sales]
    .sort((a, b) => {
      const aDate = new Date(`${a.date}T${a.time || "00:00"}`);
      const bDate = new Date(`${b.date}T${b.time || "00:00"}`);
      return bDate - aDate;
    })
    .slice(0, 5);

  const chartData = useMemo(() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const dateKey = getLocalDateKey(date);
      const amount = sales
        .filter((sale) => sale.date === dateKey)
        .reduce((sum, sale) => sum + Number(sale.totalSelling || 0), 0);
      result.push({
        date: dateKey,
        label: date.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        amount,
      });
    }
    return result;
  }, [sales]);

  const chartMax = Math.max(...chartData.map((day) => day.amount), 1);
  const chartPoints = chartData.map((day, index) => ({
    ...day,
    x: (index / Math.max(chartData.length - 1, 1)) * 100,
    y: 88 - (day.amount / chartMax) * 68,
  }));

  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    "0,88",
    ...chartPoints.map((point) => `${point.x},${point.y}`),
    "100,88",
  ].join(" ");

  const productMix = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const name = sale.productName || sale.product || "Other";
      map.set(name, (map.get(name) || 0) + Number(sale.totalSelling || 0));
    });
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    return entries.map(([name, value]) => ({
      name,
      value,
      percent: total ? Math.round((value / total) * 100) : 0,
    }));
  }, [sales]);

  const dateLabel = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const saveOpeningBalance = (event) => {
    event.preventDefault();
    const amount = Number(openingInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    const updated = { ...finance, openingBalance: amount };
    saveFinance(updated);
    setFinance(updated);
    setShowOpeningForm(false);
    loadData();
  };

  const expenseCountToday = expenses.filter((expense) => expense.date === today).length;
  const salesCountToday = sales.filter((sale) => sale.date === today).length;

  return (
    <div className="dashboard-page modern-dashboard">
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="dashboard-kicker">DASHBOARD</span>
          <h1>
            Good to see you again,
            <span>Chiaha!</span>
          </h1>
          <p>Track. Manage. Grow. All in one place.</p>
        </div>

        <div className="welcome-date-card">
          <span>Today</span>
          <strong>{dateLabel}</strong>
        </div>
      </section>

      <section className="modern-kpi-grid">
        <article className="modern-kpi sales-kpi">
          <div className="kpi-icon">▥</div>
          <div>
            <span>Total Sales</span>
            <strong>{formatMoney(todaySales)}</strong>
            <small>+ today</small>
          </div>
          <div className="kpi-spark">↗</div>
        </article>

        <article className="modern-kpi profit-kpi">
          <div className="kpi-icon">↗</div>
          <div>
            <span>Net Profit</span>
            <strong>{formatMoney(netProfit)}</strong>
            <small>After expenses</small>
          </div>
          <div className="kpi-spark">↗</div>
        </article>

        <article className="modern-kpi inventory-kpi">
          <div className="kpi-icon">□</div>
          <div>
            <span>Inventory Value</span>
            <strong>{formatMoney(inventoryValue)}</strong>
            <small>{stockUnits} units in stock</small>
          </div>
          <div className="kpi-spark">↗</div>
        </article>

        <article className="modern-kpi cash-kpi">
          <div className="kpi-icon">▰</div>
          <div>
            <span>Cash at Hand</span>
            <strong>{formatMoney(cashFlow.balance)}</strong>
            <small>Available balance</small>
          </div>
          <button
            type="button"
            className="kpi-edit"
            onClick={() => setShowOpeningForm((value) => !value)}
            aria-label="Edit opening balance"
          >
            ⚙
          </button>
        </article>
      </section>

      {showOpeningForm && (
        <form className="opening-balance-modern" onSubmit={saveOpeningBalance}>
          <div>
            <span>OPENING CASH</span>
            <strong>Set the starting cash used by your dashboard.</strong>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={openingInput}
            onChange={(event) => setOpeningInput(event.target.value)}
            placeholder="Starting cash"
          />
          <button type="submit">Save</button>
        </form>
      )}

      <section className="dashboard-modern-grid">
        <div className="modern-card sales-overview-card">
          <div className="modern-card-heading">
            <div>
              <span>PERFORMANCE</span>
              <h2>Sales &amp; Profit Overview</h2>
              <p>Your business performance over the last 30 days.</p>
            </div>
            <button className="period-chip" type="button">Last 30 Days⌄</button>
          </div>

          <div className="chart-legend">
            <span><i className="legend-sales" /> Sales</span>
            <span><i className="legend-profit" /> Profit</span>
          </div>

          <div className="modern-sales-chart">
            <div className="chart-y-labels">
              <span>{formatMoney(chartMax)}</span>
              <span>{formatMoney(chartMax * 0.66)}</span>
              <span>{formatMoney(chartMax * 0.33)}</span>
              <span>₦0</span>
            </div>
            <div className="chart-stage">
              <div className="chart-grid-lines"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="modernChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,145,70,.24)" />
                    <stop offset="100%" stopColor="rgba(255,145,70,0)" />
                  </linearGradient>
                </defs>
                <polygon points={areaPoints} fill="url(#modernChartFill)" />
                <polyline points={linePoints} />
              </svg>
              <div className="chart-x-labels">
                {chartData.filter((_, index) => index % 5 === 0).map((day) => (
                  <span key={day.date}>{day.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-summary">
            <div><span>Today's Sales</span><strong>{formatMoney(todaySales)}</strong></div>
            <div><span>Today's Profit</span><strong>{formatMoney(todayProfit)}</strong></div>
            <div><span>Gross Profit</span><strong>{formatMoney(grossProfit)}</strong></div>
          </div>
        </div>

        <div className="modern-card activity-card">
          <div className="modern-card-heading compact">
            <div>
              <span>LIVE FEED</span>
              <h2>Today's Activity</h2>
            </div>
            <button type="button">View all →</button>
          </div>

          <div className="activity-list">
            <div className="activity-row">
              <div className="activity-icon sale">↗</div>
              <div><strong>{salesCountToday} Sales recorded</strong><span>Today's sales activity</span></div>
            </div>
            <div className="activity-row">
              <div className="activity-icon expense">−</div>
              <div><strong>{expenseCountToday} Expenses added</strong><span>Today's expense activity</span></div>
            </div>
            <div className="activity-row">
              <div className="activity-icon stock">□</div>
              <div><strong>{lowStockProducts.length} Low-stock alerts</strong><span>Inventory needs attention</span></div>
            </div>
            <div className="activity-row">
              <div className="activity-icon product">+</div>
              <div><strong>{products.length} Products</strong><span>Products in your catalogue</span></div>
            </div>
          </div>
        </div>

        <div className="modern-card product-mix-card">
          <div className="modern-card-heading compact">
            <div>
              <span>PRODUCT MIX</span>
              <h2>Sales by Product</h2>
            </div>
            <button type="button">View all →</button>
          </div>

          {productMix.length === 0 ? (
            <div className="modern-empty">Record sales to see your product mix.</div>
          ) : (
            <div className="mix-layout">
              <div
                className="mix-donut"
                style={{
                  background: `conic-gradient(#ff9146 0 ${productMix[0]?.percent || 0}%, #5b8cff ${productMix[0]?.percent || 0}% ${(productMix[0]?.percent || 0) + (productMix[1]?.percent || 0)}%, #8c6cff ${(productMix[0]?.percent || 0) + (productMix[1]?.percent || 0)}% ${(productMix[0]?.percent || 0) + (productMix[1]?.percent || 0) + (productMix[2]?.percent || 0)}%, #9aa5b1 ${(productMix[0]?.percent || 0) + (productMix[1]?.percent || 0) + (productMix[2]?.percent || 0)}% 100%)`,
                }}
              >
                <div><strong>Sales</strong><span>Mix</span></div>
              </div>
              <div className="mix-list">
                {productMix.map((item, index) => (
                  <div key={item.name}>
                    <i className={`mix-dot mix-${index}`} />
                    <span>{item.name}</span>
                    <strong>{item.percent}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modern-card quick-actions-card">
          <div className="modern-card-heading compact">
            <div>
              <span>ACTION CENTER</span>
              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="modern-actions">
            <button onClick={onRecordSale} className="modern-action primary">
              <span>▥</span><div><strong>Record Sale</strong><small>Add a new sale</small></div><b>→</b>
            </button>
            <button onClick={onRecordExpense} className="modern-action">
              <span>▤</span><div><strong>Record Expense</strong><small>Track spending</small></div><b>→</b>
            </button>
            <button onClick={onAddProduct} className="modern-action">
              <span>□</span><div><strong>Add Product</strong><small>Update inventory</small></div><b>→</b>
            </button>
            <button onClick={onViewReports} className="modern-action">
              <span>◔</span><div><strong>View Reports</strong><small>Analyze performance</small></div><b>→</b>
            </button>
          </div>
        </div>

        <div className="modern-card recent-sales-modern">
          <div className="modern-card-heading compact">
            <div>
              <span>TRANSACTIONS</span>
              <h2>Recent Sales</h2>
            </div>
            <button type="button">View all →</button>
          </div>

          <div className="modern-table-wrap">
            <table className="modern-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Total</th><th>Time</th></tr></thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr><td colSpan="4" className="table-empty">No sales recorded yet.</td></tr>
                ) : recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td><div className="table-product"><span>{(sale.productName || sale.product || "S").charAt(0).toUpperCase()}</span><strong>{sale.productName || sale.product || "Sale"}</strong></div></td>
                    <td>{sale.quantity}</td>
                    <td><strong>{formatMoney(sale.totalSelling)}</strong></td>
                    <td>{sale.time || sale.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modern-card low-stock-modern">
          <div className="modern-card-heading compact">
            <div>
              <span>INVENTORY</span>
              <h2>Low Stock Alert</h2>
            </div>
            <button type="button" onClick={onAddProduct}>Manage →</button>
          </div>

          <div className="modern-table-wrap">
            <table className="modern-table">
              <thead><tr><th>Product</th><th>Current</th><th>Threshold</th><th>Status</th></tr></thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr><td colSpan="4" className="table-empty">All stock levels are healthy.</td></tr>
                ) : lowStockProducts.slice(0, 5).map((product) => (
                  <tr key={product.id}>
                    <td><strong>{product.name}</strong></td>
                    <td>{product.stock}</td>
                    <td>{product.lowStockAt}</td>
                    <td><span className={`stock-status ${Number(product.stock) === 0 ? "critical" : "low"}`}>{Number(product.stock) === 0 ? "Out" : "Low"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="threshold-note">Threshold = the stock level that triggers a low-stock alert.</p>
        </div>
      </section>

      <aside className="dashboard-promo">
        <div>
          <span>UPTREND BUSINESS MANAGER</span>
          <strong>Smarter tools for bigger goals.</strong>
          <p>Manage sales, inventory and finances from one place.</p>
        </div>
        <button type="button">Stay productive →</button>
      </aside>
    </div>
  );
}

export default Dashboard;
EOF

cat > src/components/Header.jsx <<'EOF'
import { useEffect, useState } from "react";
import "./Header.css";

function Header({ activePage, setIsOpen, onRecordSale }) {
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("uptrend_theme") === "dark"
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const pageTitles = {
    dashboard: "Dashboard",
    sales: "Sales",
    record: "Record Sale",
    expenses: "Expenses",
    products: "Products",
    reports: "Reports",
    finance: "Finance",
  };

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("uptrend-dark", dark);
    localStorage.setItem("uptrend_theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleTheme = () => setDark((value) => !value);

  return (
    <header className={`command-header modern-header ${loaded ? "header-loaded" : ""}`}>
      <div className="header-left">
        <button className="mobile-menu" onClick={() => setIsOpen(true)} aria-label="Open menu">
          <span /><span /><span />
        </button>

        <div className="modern-search">
          <span>⌕</span>
          <input placeholder="Search products, sales, expenses..." aria-label="Search" />
          <kbd>Ctrl K</kbd>
        </div>
      </div>

      <div className="header-actions modern-header-actions">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? "☀" : "◐"}
        </button>

        <div className="header-popover-wrap">
          <button
            className="modern-icon-button notification-button"
            onClick={() => {
              setShowNotifications((value) => !value);
              setShowProfile(false);
            }}
            aria-label="Notifications"
          >
            ♢
            <i>3</i>
          </button>

          {showNotifications && (
            <div className="header-popover notification-popover">
              <div className="popover-title"><strong>Notifications</strong><span>3 new</span></div>
              <div className="popover-item"><b>Sales</b><span>Recent sales activity is available.</span></div>
              <div className="popover-item"><b>Inventory</b><span>Check products with low stock.</span></div>
              <div className="popover-item"><b>Business</b><span>Your dashboard is up to date.</span></div>
              <button className="popover-footer">View all notifications →</button>
            </div>
          )}
        </div>

        <div className="header-popover-wrap">
          <button
            className="profile-trigger"
            onClick={() => {
              setShowProfile((value) => !value);
              setShowNotifications(false);
            }}
            aria-label="Open profile menu"
          >
            <span className="profile-avatar-modern">CD</span>
            <span className="profile-copy"><strong>Chiaha Daniel</strong><small>Business Owner</small></span>
            <span>⌄</span>
          </button>

          {showProfile && (
            <div className="header-popover profile-popover">
              <div className="profile-popover-head"><span className="profile-avatar-modern large">CD</span><div><strong>Chiaha Daniel</strong><small>Business Owner</small></div></div>
              <button>View profile</button>
              <button>Account settings</button>
              <button className="logout-option">Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
EOF

cat > src/components/Sidebar.jsx <<'EOF'
import { useEffect, useState } from "react";
import "./Sidebar.css";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "sales", label: "Sales", icon: "▥" },
  { id: "record", label: "Record Sale", icon: "+" },
  { id: "expenses", label: "Expenses", icon: "▤" },
  { id: "products", label: "Products", icon: "□" },
  { id: "reports", label: "Reports", icon: "◔" },
  { id: "finance", label: "Finance", icon: "▰" },
  { id: "customers", label: "Customers", icon: "♙" },
];

function Sidebar({ activePage, setActivePage, isOpen, setIsOpen }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigation = (page) => {
    if (page === "customers") return;
    setActivePage(page);
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && <div className="mobile-backdrop" onClick={() => setIsOpen(false)} />}
      <aside className={`command-sidebar modern-sidebar ${isOpen ? "open" : ""} ${visible ? "sidebar-visible" : ""}`}>
        <div className="sidebar-brand modern-brand">
          <div className="brand-symbol-gold"><span>↗</span><i /></div>
          <div className="brand-copy"><strong>UpTrend</strong><span>Business Manager</span></div>
          <button className="close-sidebar" onClick={() => setIsOpen(false)} aria-label="Close menu">×</button>
        </div>

        <div className="sidebar-divider" />

        <div className="side-label">MAIN MENU</div>
        <nav className="command-nav">
          {navigation.map((item, index) => (
            <button
              key={item.id}
              className={activePage === item.id ? "selected" : ""}
              onClick={() => handleNavigation(item.id)}
              style={{ animationDelay: `${0.08 + index * 0.04}s` }}
            >
              <span className="nav-symbol">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === "sales" && <span className="nav-mini-badge">NEW</span>}
              <span className="nav-active-glow" />
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-promo">
          <span>UPTREND</span>
          <strong>Build a better business.</strong>
          <p>Tools, insights and growth in one place.</p>
          <button type="button">Explore →</button>
        </div>

        <div className="sidebar-footer">
          <button className="settings-link" type="button">
            <span className="nav-symbol">⚙</span>
            <span>Settings</span>
          </button>
          <div className="profile">
            <div className="profile-avatar">CD</div>
            <div><strong>Chiaha Daniel</strong><span>Business Owner</span></div>
            <span className="profile-arrow">→</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
EOF

cat > src/components/Dashboard.css <<'EOF'
.modern-dashboard {
  --accent: #ff9146;
  --accent-2: #ffb27a;
  --blue: #5b8cff;
  --purple: #8c6cff;
  --cyan: #37c9d9;
  --text: #172033;
  --muted: #6d7483;
  --surface: rgba(255,255,255,.9);
  --surface-2: #f7f8fb;
  --border: #e7eaf0;
  --shadow: 0 18px 45px rgba(26,35,52,.08);
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 34px 70px;
  color: var(--text);
}
.dashboard-welcome { min-height: 190px; border-radius: 24px; padding: 30px 34px; display:flex; justify-content:space-between; align-items:flex-end; overflow:hidden; position:relative; background:linear-gradient(115deg,#fff 0%,#fff 43%,rgba(255,255,255,.76) 58%,rgba(237,240,246,.8) 100%); border:1px solid var(--border); box-shadow:var(--shadow); margin-bottom:18px; }
.dashboard-welcome:after { content:""; position:absolute; right:0; top:0; width:48%; height:100%; background:linear-gradient(135deg,transparent 0%,rgba(255,145,70,.08) 65%,rgba(255,145,70,.18) 100%); pointer-events:none; }
.welcome-copy,.welcome-date-card{position:relative;z-index:1}.dashboard-kicker,.modern-card-heading>div>span,.modern-card-heading>div>span:first-child{font-size:10px;letter-spacing:.24em;font-weight:800;color:#8b93a2}.welcome-copy h1{margin:9px 0 7px;font-size:39px;line-height:1.05;letter-spacing:-.04em}.welcome-copy h1 span{display:block;color:var(--accent)}.welcome-copy p{margin:0;color:var(--muted);font-size:15px}.welcome-date-card{min-width:225px;padding:18px 20px;border:1px solid rgba(20,28,42,.1);border-radius:16px;background:rgba(255,255,255,.76);backdrop-filter:blur(10px)}.welcome-date-card span{display:block;font-size:11px;color:var(--muted);margin-bottom:7px}.welcome-date-card strong{font-size:14px}
.modern-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.modern-kpi{min-height:126px;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px;display:flex;align-items:center;gap:15px;box-shadow:var(--shadow);position:relative;overflow:hidden}.modern-kpi:after{content:"";position:absolute;right:-28px;bottom:-38px;width:110px;height:110px;border-radius:50%;background:rgba(255,145,70,.08)}.kpi-icon{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:24px;font-weight:800;color:#fff;background:var(--accent);flex:0 0 auto}.profit-kpi .kpi-icon{background:var(--blue)}.inventory-kpi .kpi-icon{background:var(--purple)}.cash-kpi .kpi-icon{background:#ef6f78}.modern-kpi span{display:block;font-size:12px;color:var(--muted)}.modern-kpi strong{display:block;font-size:24px;margin:5px 0 4px;letter-spacing:-.03em}.modern-kpi small{color:#4d9b73;font-size:11px}.kpi-spark{margin-left:auto;color:var(--accent);font-size:27px}.kpi-edit{position:absolute;right:14px;top:14px;border:0;background:transparent;color:#7d8490;cursor:pointer}
.opening-balance-modern{display:grid;grid-template-columns:1fr 210px 90px;gap:12px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px 16px;margin:-6px 0 18px;box-shadow:var(--shadow)}.opening-balance-modern span{display:block;font-size:9px;letter-spacing:.18em;font-weight:800;color:#8b93a2}.opening-balance-modern strong{font-size:13px}.opening-balance-modern input{height:42px;border:1px solid var(--border);border-radius:10px;padding:0 12px}.opening-balance-modern button{height:42px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:800}
.dashboard-modern-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(330px,.85fr);gap:16px}.modern-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow);padding:22px;min-width:0}.modern-card-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.modern-card-heading.compact{align-items:center}.modern-card-heading h2{margin:5px 0 0;font-size:19px;letter-spacing:-.025em}.modern-card-heading p{margin:5px 0 0;color:var(--muted);font-size:12px}.modern-card-heading button,.period-chip{border:0;background:transparent;color:var(--accent);font-weight:700;cursor:pointer}.period-chip{border:1px solid var(--border)!important;padding:9px 12px;border-radius:10px;color:#4b5565!important;background:#fff!important}
.sales-overview-card{grid-column:1;grid-row:1 / span 2}.chart-legend{display:flex;justify-content:flex-end;gap:18px;margin:18px 0 4px;font-size:11px;color:var(--muted)}.chart-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}.legend-sales{background:var(--accent)}.legend-profit{background:var(--blue)}
.modern-sales-chart{display:flex;height:280px;padding-top:12px}.chart-y-labels{width:75px;display:flex;flex-direction:column;justify-content:space-between;padding:5px 12px 35px 0;text-align:right;color:#8a92a0;font-size:10px}.chart-stage{flex:1;position:relative}.chart-grid-lines{position:absolute;inset:0 0 35px;display:flex;flex-direction:column;justify-content:space-between}.chart-grid-lines i{height:1px;background:#edf0f4}.chart-stage svg{position:absolute;left:0;right:0;top:0;width:100%;height:calc(100% - 35px);overflow:visible}.chart-stage polyline{fill:none;stroke:var(--accent);stroke-width:1.4;vector-effect:non-scaling-stroke}.chart-x-labels{position:absolute;left:0;right:0;bottom:7px;display:flex;justify-content:space-between;color:#8a92a0;font-size:10px}.chart-summary{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--border);padding-top:14px;gap:10px}.chart-summary span{display:block;font-size:10px;color:var(--muted)}.chart-summary strong{display:block;margin-top:4px;font-size:15px}
.activity-card{grid-column:2;grid-row:1}.activity-list{margin-top:18px}.activity-row{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--border)}.activity-row:last-child{border-bottom:0}.activity-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-weight:800;flex:0 0 auto;background:#fff2e9;color:var(--accent)}.activity-icon.expense{background:#fff0f1;color:#e76b72}.activity-icon.stock{background:#eeeaff;color:var(--purple)}.activity-icon.product{background:#e9f8fb;color:#26a9bb}.activity-row strong{display:block;font-size:12px}.activity-row span{display:block;margin-top:3px;color:var(--muted);font-size:10px}
.product-mix-card{grid-column:2;grid-row:2}.mix-layout{display:flex;align-items:center;gap:20px;margin-top:18px}.mix-donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto}.mix-donut>div{width:90px;height:90px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center}.mix-donut strong,.mix-donut span{display:block}.mix-donut span{font-size:9px;color:var(--muted)}.mix-list{flex:1}.mix-list>div{display:grid;grid-template-columns:12px 1fr auto;gap:7px;align-items:center;margin:12px 0;font-size:11px}.mix-list strong{font-size:11px}.mix-dot{width:9px;height:9px;border-radius:50%;background:var(--accent)}.mix-1{background:var(--blue)}.mix-2{background:var(--purple)}.mix-3{background:#9aa5b1}
.quick-actions-card{grid-column:2;grid-row:3}.modern-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.modern-action{min-height:94px;border:1px solid var(--border);border-radius:14px;background:#fff;text-align:left;padding:14px;display:grid;grid-template-columns:34px 1fr 18px;gap:9px;align-items:center;cursor:pointer;transition:.2s}.modern-action:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(25,35,55,.08)}.modern-action.primary{background:linear-gradient(135deg,#ffb27a,#ff9146);border-color:transparent;color:#fff}.modern-action>span{font-size:21px}.modern-action strong{display:block;font-size:12px}.modern-action small{display:block;color:inherit;opacity:.7;margin-top:3px;font-size:9px}.modern-action b{font-size:16px}
.recent-sales-modern{grid-column:1;grid-row:3}.low-stock-modern{grid-column:1;grid-row:4}.modern-table-wrap{overflow:auto;margin-top:14px}.modern-table{width:100%;border-collapse:collapse;min-width:560px}.modern-table th{text-align:left;font-size:10px;color:#8a92a0;background:#f7f8fb;padding:11px 10px}.modern-table td{padding:12px 10px;border-bottom:1px solid #eef0f4;font-size:11px}.modern-table tr:last-child td{border-bottom:0}.table-product{display:flex;align-items:center;gap:9px}.table-product span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:#fff1e7;color:var(--accent);font-weight:800}.table-product strong{font-size:11px}.table-empty{text-align:center!important;color:var(--muted);padding:28px!important}.stock-status{display:inline-flex;padding:5px 8px;border-radius:8px;font-size:9px;font-weight:800}.stock-status.low{background:#fff0df;color:#c76b20}.stock-status.critical{background:#ffe8ea;color:#cf4c59}.threshold-note{font-size:10px;color:var(--muted);margin:12px 0 0}.dashboard-promo{margin-top:16px;border-radius:20px;min-height:100px;padding:22px 26px;background:linear-gradient(110deg,#162132,#263247);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;box-shadow:var(--shadow)}.dashboard-promo span{font-size:9px;letter-spacing:.18em;color:#aeb7c6}.dashboard-promo strong{display:block;font-size:20px;margin-top:5px}.dashboard-promo p{margin:4px 0 0;color:#aeb7c6;font-size:11px}.dashboard-promo button{border:0;background:var(--accent);color:#fff;border-radius:11px;padding:12px 16px;font-weight:800}
@media(max-width:1100px){.modern-kpi-grid{grid-template-columns:repeat(2,1fr)}.dashboard-modern-grid{grid-template-columns:1fr}.sales-overview-card,.activity-card,.product-mix-card,.quick-actions-card,.recent-sales-modern,.low-stock-modern{grid-column:auto;grid-row:auto}}
@media(max-width:700px){.modern-dashboard{padding:18px 14px 85px}.dashboard-welcome{padding:22px;min-height:0;display:block}.welcome-copy h1{font-size:30px}.welcome-date-card{margin-top:18px}.modern-kpi-grid{grid-template-columns:1fr 1fr}.modern-kpi{padding:14px;min-height:112px}.kpi-icon{width:42px;height:42px}.modern-kpi strong{font-size:17px}.modern-sales-chart{height:230px}.chart-y-labels{width:58px}.mix-layout{flex-direction:column}.dashboard-promo{display:block}.dashboard-promo button{margin-top:12px}.opening-balance-modern{grid-template-columns:1fr}.modern-actions{grid-template-columns:1fr}.chart-summary{grid-template-columns:1fr 1fr 1fr}}
EOF

cat > src/components/Header.css <<'EOF'
.modern-header{height:78px!important;background:rgba(255,255,255,.94)!important;border-bottom:1px solid #e7eaf0!important;box-shadow:none!important;padding:0 30px!important;color:#172033!important;backdrop-filter:blur(16px);position:sticky;top:0;z-index:50}.modern-search{width:min(520px,55vw);height:43px;border:1px solid #dfe3ea;border-radius:14px;background:#f5f7fa;display:flex;align-items:center;padding:0 13px;gap:9px;color:#7d8490}.modern-search>span{font-size:24px;line-height:1}.modern-search input{border:0;outline:0;background:transparent;flex:1;font:inherit;font-size:12px;color:#172033}.modern-search kbd{font-size:9px;border:1px solid #d7dce4;background:#fff;border-radius:5px;padding:3px 5px;color:#8b93a2}.modern-header-actions{gap:10px}.theme-toggle,.modern-icon-button{width:40px;height:40px;border-radius:12px;border:1px solid #e1e5eb;background:#fff;color:#313a48;display:grid;place-items:center;cursor:pointer}.theme-toggle{font-size:17px}.modern-icon-button{position:relative;font-size:20px}.notification-button i{position:absolute;right:-2px;top:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#ff9146;color:#fff;font-style:normal;font-size:9px;display:grid;place-items:center}.header-popover-wrap{position:relative}.profile-trigger{display:flex;align-items:center;gap:9px;border:0;background:transparent;padding:3px 0 3px 8px;cursor:pointer;color:#172033}.profile-avatar-modern{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#172033;color:#fff;font-weight:800;font-size:12px}.profile-avatar-modern.large{width:44px;height:44px}.profile-copy{text-align:left}.profile-copy strong,.profile-copy small{display:block}.profile-copy strong{font-size:12px}.profile-copy small{font-size:9px;color:#7d8490;margin-top:2px}.header-popover{position:absolute;right:0;top:52px;width:290px;background:#fff;border:1px solid #e1e5eb;border-radius:16px;box-shadow:0 18px 50px rgba(20,30,45,.16);padding:10px;overflow:hidden}.popover-title{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #eef0f4;font-size:12px}.popover-title span{color:#ff9146;font-size:10px}.popover-item{padding:11px 10px;border-bottom:1px solid #f0f2f5}.popover-item b,.popover-item span{display:block}.popover-item b{font-size:11px}.popover-item span{font-size:10px;color:#7d8490;margin-top:3px}.popover-footer,.profile-popover button{width:100%;border:0;background:transparent;text-align:left;padding:11px 10px;cursor:pointer;font-size:11px;color:#293343}.popover-footer{color:#ff9146!important;font-weight:800}.profile-popover-head{display:flex;gap:10px;align-items:center;padding:10px;border-bottom:1px solid #eef0f4}.profile-popover-head strong,.profile-popover-head small{display:block}.profile-popover-head strong{font-size:12px}.profile-popover-head small{font-size:10px;color:#7d8490;margin-top:2px}.profile-popover button:hover{background:#f7f8fa;border-radius:8px}.profile-popover .logout-option{color:#d85a63}
@media(max-width:700px){.modern-header{padding:0 14px!important;height:68px!important}.modern-search{width:calc(100vw - 125px);height:39px}.modern-search kbd{display:none}.profile-copy{display:none}.profile-trigger>span:last-child{display:none}.header-popover{right:-5px;width:270px}.modern-header-actions{gap:5px}}
EOF

cat > src/components/Sidebar.css <<'EOF'
.modern-sidebar{background:#0e1724!important;color:#fff!important;border-right:0!important;width:244px!important;padding:24px 14px 18px!important;box-shadow:12px 0 40px rgba(14,23,36,.06)}.modern-brand{padding:0 10px 17px!important;align-items:center}.brand-symbol-gold{width:45px;height:45px;position:relative;display:grid;place-items:center;color:#ffb06f;font-size:28px;font-weight:900}.brand-symbol-gold:before{content:"";position:absolute;inset:5px;border:2px solid #ff9146;border-radius:12px 12px 15px 4px;transform:skewY(-8deg)}.brand-symbol-gold span{position:relative;z-index:1}.brand-symbol-gold i{position:absolute;bottom:3px;left:7px;width:30px;height:3px;background:linear-gradient(90deg,#ff9146,#ffd1a8);border-radius:4px}.modern-brand .brand-copy strong{font-size:20px!important;letter-spacing:-.03em}.modern-brand .brand-copy span{font-size:9px!important;color:#8d99aa!important}.sidebar-divider{height:1px;background:rgba(255,255,255,.08);margin:0 9px 24px}.modern-sidebar .side-label{font-size:8px!important;letter-spacing:.22em;color:#68768a!important;padding:0 12px 10px!important}.modern-sidebar .command-nav{gap:4px!important}.modern-sidebar .command-nav button{min-height:46px!important;border-radius:11px!important;color:#aab4c2!important;padding:0 12px!important}.modern-sidebar .command-nav button.selected{background:linear-gradient(90deg,#ff9146,#ffad70)!important;color:#101722!important;box-shadow:0 8px 20px rgba(255,145,70,.22)}.modern-sidebar .command-nav button:hover:not(.selected){background:rgba(255,255,255,.05)!important;color:#fff!important}.modern-sidebar .nav-symbol{width:28px!important;font-size:17px!important;color:inherit!important}.modern-sidebar .nav-label{font-size:12px!important}.modern-sidebar .nav-mini-badge{margin-left:auto;font-size:7px;padding:3px 5px;border-radius:5px;background:rgba(255,145,70,.14);color:#ffab73}.sidebar-spacer{flex:1;min-height:18px}.sidebar-promo{margin:15px 6px;padding:18px;border-radius:15px;border:1px solid rgba(255,145,70,.38);background:linear-gradient(145deg,#172234,#101a28);overflow:hidden}.sidebar-promo span{font-size:8px;letter-spacing:.18em;color:#ffae77}.sidebar-promo strong{display:block;font-size:16px;margin-top:7px;line-height:1.1}.sidebar-promo p{font-size:9px;line-height:1.5;color:#8e9aac;margin:7px 0 12px}.sidebar-promo button{border:0;border-radius:9px;padding:8px 11px;background:#ff9146;color:#fff;font-size:9px;font-weight:800}.modern-sidebar .sidebar-footer{padding:10px 4px 0!important}.modern-sidebar .settings-link{height:40px!important;color:#aab4c2!important;font-size:11px!important;border-radius:10px}.modern-sidebar .settings-link:hover{background:rgba(255,255,255,.05)!important;color:#fff!important}.modern-sidebar .profile{border-top:1px solid rgba(255,255,255,.08);margin-top:7px;padding-top:14px!important}.modern-sidebar .profile-avatar{background:#ff9146!important;color:#101722!important;font-weight:900}.modern-sidebar .profile strong{font-size:10px!important}.modern-sidebar .profile span{font-size:8px!important;color:#78869a!important}.modern-sidebar .profile-arrow{color:#738095!important}
html.uptrend-dark .modern-header{background:#101925!important;border-color:#253142!important;color:#fff!important}html.uptrend-dark .modern-search{background:#182230;border-color:#2a3748}html.uptrend-dark .modern-search input{color:#fff}html.uptrend-dark .modern-search kbd,html.uptrend-dark .theme-toggle,html.uptrend-dark .modern-icon-button{background:#182230;border-color:#2a3748;color:#fff}html.uptrend-dark .profile-trigger{color:#fff}html.uptrend-dark .header-popover{background:#121d2b;border-color:#2a3748;color:#fff}html.uptrend-dark .popover-item,html.uptrend-dark .popover-title,html.uptrend-dark .profile-popover-head{border-color:#2a3748}html.uptrend-dark .popover-item span,html.uptrend-dark .profile-popover-head small{color:#94a0b2}html.uptrend-dark .profile-popover button{color:#e6ebf2}html.uptrend-dark .modern-dashboard{background:#0f1825;color:#eef3f8;--text:#eef3f8;--muted:#9ba7b7;--surface:rgba(20,31,44,.96);--surface-2:#162130;--border:#273548;--shadow:0 18px 45px rgba(0,0,0,.22)}html.uptrend-dark .dashboard-welcome{background:linear-gradient(115deg,#111b29,#182536);border-color:#29384b}html.uptrend-dark .welcome-date-card,html.uptrend-dark .period-chip{background:#162230!important;border-color:#2a394c!important;color:#dfe6ef!important}html.uptrend-dark .modern-table th{background:#172333}html.uptrend-dark .modern-table td{border-color:#273548}html.uptrend-dark .modern-action{background:#162230;border-color:#2a394c;color:#eef3f8}html.uptrend-dark .mix-donut>div{background:#14202e}html.uptrend-dark .chart-grid-lines i{background:#263447}
@media(max-width:900px){.modern-sidebar{width:270px!important}}
EOF

python3 - <<'PY'
from pathlib import Path
p=Path("src/App.jsx")
s=p.read_text()
s=s.replace('onAddProduct={handleAddProduct}\\n    />','onAddProduct={handleAddProduct}\\n      onViewReports={() => { setActivePage("reports"); setSidebarOpen(false); }}\\n    />')
p.write_text(s)
if "onViewReports" not in s:
    raise SystemExit("Could not wire the Reports action into App.jsx")
PY

echo "=== BUILD TEST ==="
npm run build

echo "=== SUCCESS ==="
echo "Dashboard redesign applied."
echo "Backup: $BACKUP"
