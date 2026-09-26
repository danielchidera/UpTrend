import "./Sidebar.css";
import { useEffect, useState } from "react";

function Sidebar({
  activePage,
  setActivePage,
  isOpen,
  setIsOpen,
  onLogout,
}) {
  const [visible, setVisible] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(
    [
      "business-insights",
      "advanced-reports",
      "advanced-inventory",
      "sales-expense-trends",
      "customers",
      "invoices",
      "business-targets",
      "credit-debt",
      "suppliers",
      "exports",
      "branches",
      "users-permissions",
      "audit-history",
      "backups",
    ].includes(activePage)
  );

  const mainNavigation = [
    {
      id: "dashboard",
      icon: "⌂",
      label: "Dashboard",
      color: "dashboard",
    },
    {
      id: "sales",
      icon: "↗",
      label: "Sales",
      badge: "NEW",
      color: "sales",
    },
    {
      id: "record",
      icon: "＋",
      label: "Record Sale",
      color: "record",
    },
    {
      id: "expenses",
      icon: "↓",
      label: "Expenses",
      color: "expenses",
    },
    {
      id: "products",
      icon: "▣",
      label: "Products",
      color: "products",
    },
    {
      id: "reports",
      icon: "▤",
      label: "Reports",
      color: "reports",
    },
    {
      id: "finance",
      icon: "₦",
      label: "Finance",
      color: "finance",
    },
    {
      id: "settings",
      icon: "⚙",
      label: "Settings",
      color: "settings",
    },
  ];

  const businessNavigation = [
    {
      id: "business-insights",
      icon: "✦",
      label: "Business Insights",
      color: "business-insights",
      available: true,
    },
    {
      id: "advanced-reports",
      icon: "▥",
      label: "Advanced Reports",
      color: "advanced-reports",
      available: false,
    },
    {
      id: "advanced-inventory",
      icon: "◆",
      label: "Advanced Inventory",
      color: "advanced-inventory",
      available: true,
    },
    {
      id: "sales-expense-trends",
      icon: "◈",
      label: "Sales & Expense Trends",
      color: "sales-expense-trends",
      available: true,
    },
    {
      id: "customers",
      icon: "♙",
      label: "Customers",
      color: "customers",
      available: true,
    },
    {
      id: "invoices",
      icon: "▧",
      label: "Invoices",
      color: "invoices",
      available: true,
    },
    {
      id: "business-targets",
      icon: "◎",
      label: "Business Targets",
      color: "business-targets",
      available: true,
    },
    {
      id: "credit-debt",
      icon: "₦",
      label: "Credit & Debt",
      color: "credit-debt",
      available: true,
    },
    {
      id: "suppliers",
      icon: "⇄",
      label: "Suppliers",
      color: "suppliers",
      available: true,
    },
    {
      id: "exports",
      icon: "⇩",
      label: "Exports",
      color: "exports",
      available: true,
    },
    {
      id: "branches",
      icon: "⌘",
      label: "Branches",
      color: "branches",
      available: false,
    },
    {
      id: "users-permissions",
      icon: "♙",
      label: "Users & Permissions",
      color: "users-permissions",
      available: false,
    },
    {
      id: "audit-history",
      icon: "◷",
      label: "Audit History",
      color: "audit-history",
      available: false,
    },
    {
      id: "backups",
      icon: "▰",
      label: "Automated Backups",
      color: "backups",
      available: false,
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const isBusinessPage = businessNavigation.some(
      (item) => item.id === activePage
    );

    if (isBusinessPage) {
      setBusinessOpen(true);
    }
  }, [activePage]);

  const handleNavigation = (page) => {
    setActivePage(page);
    setIsOpen(false);
  };

  const handleBusinessNavigation = (item) => {
    if (!item.available) return;

    handleNavigation(item.id);
  };

  const handleLogout = () => {
    setIsOpen(false);

    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`command-sidebar ${
          isOpen ? "open" : ""
        } ${visible ? "sidebar-visible" : ""}`}
      >
        <div className="sidebar-brand">
          <div className="brand-symbol">
            <span>U</span>
            <i />
          </div>

          <div className="brand-copy">
            <strong>UpTrend</strong>
            <span>Business Manager</span>
          </div>

          <button
            className="close-sidebar"
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="business-card">
          <div className="business-logo">
            U
          </div>

          <div>
            <strong>My Business</strong>
            <span>Business account</span>
          </div>

          <div className="online-dot" />
        </div>

        <div className="side-label">
          MAIN MENU
        </div>

        <nav className="command-nav">
          {mainNavigation.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`${
                activePage === item.id
                  ? "selected"
                  : ""
              } nav-${item.color}`}
              onClick={() =>
                handleNavigation(item.id)
              }
              style={{
                animationDelay: `${
                  0.12 + index * 0.07
                }s`,
              }}
            >
              <span className="nav-symbol">
                {item.icon}
              </span>

              <span className="nav-label">
                {item.label}
              </span>

              {item.badge && (
                <span className="nav-alert">
                  {item.badge}
                </span>
              )}

              <span className="nav-active-glow" />
            </button>
          ))}
        </nav>

        <div className="business-navigation">
          <button
            type="button"
            className={`business-menu-toggle ${
              businessOpen ? "open" : ""
            } ${
              businessNavigation.some(
                (item) =>
                  item.id === activePage
              )
                ? "has-active"
                : ""
            }`}
            onClick={() =>
              setBusinessOpen(
                (current) => !current
              )
            }
            aria-expanded={businessOpen}
          >
            <span className="business-menu-icon">
              ◆
            </span>

            <span className="business-menu-copy">
              <strong>Business Plan</strong>
              <small>
                Premium business tools
              </small>
            </span>

            <span className="business-menu-arrow">
              ›
            </span>
          </button>

          <div
            className={`business-menu-panel ${
              businessOpen ? "open" : ""
            }`}
          >
            <div className="business-menu-inner">
              {businessNavigation.map(
                (item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.available}
                    className={`business-nav-item ${
                      activePage === item.id
                        ? "selected"
                        : ""
                    } ${
                      item.available
                        ? "available"
                        : "locked"
                    } nav-${item.color}`}
                    onClick={() =>
                      handleBusinessNavigation(
                        item
                      )
                    }
                    style={{
                      animationDelay: `${
                        index * 0.025
                      }s`,
                    }}
                  >
                    <span className="business-nav-symbol">
                      {item.icon}
                    </span>

                    <span className="business-nav-label">
                      {item.label}
                    </span>

                    {item.available ? (
                      <span className="business-nav-arrow">
                        →
                      </span>
                    ) : (
                      <span className="business-nav-lock">
                        SOON
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="profile">
            <div className="profile-avatar">
              ME
            </div>

            <div>
              <strong>My Account</strong>
              <span>Administrator</span>
            </div>

            <span className="profile-arrow">
              →
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
