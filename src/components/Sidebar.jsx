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

  const navigation = [
    {
      id: "dashboard",
      icon: "⌂",
      label: "Dashboard",
    },
    {
      id: "sales",
      icon: "↗",
      label: "Sales",
      badge: "NEW",
    },
    {
      id: "record",
      icon: "＋",
      label: "Record Sale",
    },
    {
      id: "expenses",
      icon: "↓",
      label: "Expenses",
    },
    {
      id: "products",
      icon: "▣",
      label: "Products",
    },
    {
      id: "reports",
      icon: "▤",
      label: "Reports",
    },
    {
      id: "finance",
      icon: "₦",
      label: "Finance",
    },
    {
      id: "settings",
      icon: "⚙",
      label: "Settings",
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  const handleNavigation = (page) => {
    setActivePage(page);
    setIsOpen(false);
  };

  const handleLogout = () => {
    setIsOpen(false);

    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <>
      {/* ================================================
          MOBILE BACKDROP
      ================================================= */}

      {isOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`command-sidebar ${
          isOpen ? "open" : ""
        } ${visible ? "sidebar-visible" : ""}`}
      >

        {/* ================================================
            BRAND
        ================================================= */}

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

        {/* ================================================
            BUSINESS ACCOUNT
        ================================================= */}

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

        {/* ================================================
            MAIN NAVIGATION
        ================================================= */}

        <div className="side-label">
          MAIN MENU
        </div>

        <nav className="command-nav">

          {navigation.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={
                activePage === item.id
                  ? "selected"
                  : ""
              }
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

        {/* ================================================
            SIDEBAR FOOTER
        ================================================= */}

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