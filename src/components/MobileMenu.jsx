import { useEffect } from "react";
import "./MobileMenu.css";

function MobileMenu({
  activePage,
  setActivePage,
  isOpen,
  setIsOpen,
}) {
  const navigation = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "⌂",
    },
    {
      id: "sales",
      label: "Sales",
      icon: "↗",
    },
    {
      id: "record",
      label: "Record Sale",
      icon: "+",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: "↓",
    },
    {
      id: "products",
      label: "Products",
      icon: "▣",
    },
    {
      id: "reports",
      label: "Reports",
      icon: "▤",
    },
    {
      id: "finance",
      label: "Finance",
      icon: "₦",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "⚙",
    },
  ];

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [setIsOpen]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNavigation = (page) => {
    setActivePage(page);
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`mobile-menu-panel ${
          isOpen ? "open" : ""
        }`}
        aria-hidden={!isOpen}
      >
        <div className="mobile-menu-header">
          <div>
            <span className="mobile-menu-eyebrow">
              UPTREND
            </span>

            <strong>
              Navigation
            </strong>
          </div>

          <button
            type="button"
            className="mobile-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="mobile-menu-list">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-menu-item ${
                activePage === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleNavigation(item.id)
              }
            >
              <span className="mobile-menu-icon">
                {item.icon}
              </span>

              <span className="mobile-menu-label">
                {item.label}
              </span>

              <span className="mobile-menu-arrow">
                →
              </span>
            </button>
          ))}
        </div>
      </aside>

      <button
        type="button"
        className={`mobile-menu-trigger ${
          isOpen ? "active" : ""
        }`}
        onClick={() =>
          setIsOpen((current) => !current)
        }
        aria-label={
          isOpen
            ? "Close navigation"
            : "Open navigation"
        }
        aria-expanded={isOpen}
      >
        <span className="mobile-menu-trigger-lines">
          <i />
          <i />
          <i />
        </span>
      </button>
    </>
  );
}

export default MobileMenu;
