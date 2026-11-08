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
      "customers",
      "invoices",
      "business-targets",
      "credit-debt",
      "exports",
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
      id: "suppliers",
      icon: "⇄",
      label: "Suppliers",
      color: "suppliers",
    },
    {
      id: "transactions",
      icon: "↔",
      label: "Transactions",
      color: "transactions",
    },
    {
      id: "reports",
      icon: "▤",
      label: "Audit History",
      color: "reports",
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
      id: "customers",
      icon: "♙",
      label: "Customers",
      color: "customers",
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
      id: "exports",
      icon: "⇩",
      label: "Exports",
      color: "exports",
      available: true,
    },
    {
  id: "invoices",
  icon: "▧",
  label: "Invoices",
  color: "invoices",
  available: true,
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