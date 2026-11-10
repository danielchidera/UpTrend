import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useRegisterSW } from "virtual:pwa-register/react";

import "./App.css";

import { supabase } from "./lib/supabase";
import {
  saveCachedSubscription,
  getCachedSubscription,
} from "./lib/localDb";
import { ThemeProvider } from "./context/ThemeContext";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import RecordSale from "./components/RecordSale";
import Expenses from "./components/Expenses";
import Products from "./components/Products";
import Sales from "./components/Sales";
import Reports from "./components/Reports";
import Finance from "./components/Finance";
import Transactions from "./components/Transactions";
import Customers from "./Business/Customers";
import Invoices from "./Business/Invoices";
import PublicHome from "./components/PublicHome";
import Settings from "./components/Settings";
import SignUp from "./components/SignUp";
import SignIn from "./components/SignIn";
import MobileMenu from "./components/MobileMenu";
import ResponsivePreview from "./components/ResponsivePreview";
import PublicInvoice from "./Business/PublicInvoice";
import AdvancedInventory from "./Business/AdvancedInventory";
import SalesExpenseTrends from "./Business/SalesExpenseTrends";
import BusinessTargets from "./Business/BusinessTargets";
import CreditDebt from "./Business/CreditDebt";
import Suppliers from "./Business/Suppliers";
import Exports from "./Business/Exports";
import BusinessInsights from "./Business/BusinessInsights";
import BusinessUpgradeModal from "./components/Business/BusinessUpgradeModal";
import OfflineDiagnostics from "./components/OfflineDiagnostics";

/* =========================================================
   REAL URL ROUTES

   These routes are now the source of truth for the
   authenticated application pages.

   The existing activePage state is still preserved because
   the rest of the UpTrend application uses it.
========================================================= */

const pagePathMap = {
  dashboard: "/dashboard",
  sales: "/sales",
  record: "/record-sale",
  expenses: "/expenses",
  products: "/products",
  reports: "/reports",
  finance: "/finance",
  transactions: "/transactions",
  customers: "/customers",
  invoices: "/invoices",
  suppliers: "/suppliers",
  exports: "/exports",
  "business-insights": "/business-insights",
  "advanced-inventory": "/advanced-inventory",
  "sales-expense-trends": "/sales-expense-trends",
  "business-targets": "/business-targets",
  "credit-debt": "/credit-debt",
  settings: "/settings",
  "offline-diagnostics": "/offline-diagnostics",
};

const pathPageMap = Object.fromEntries(
  Object.entries(pagePathMap).map(
    ([page, path]) => [path, page]
  )
);

const protectedPaths = Object.values(pagePathMap);

const publicPaths = [
  "/",
  "/sign-in",
  "/sign-up",
];

/* =========================================================
   PAGE NOT FOUND

   Unknown URLs must never silently open Dashboard.
========================================================= */

function PageNotFound({
  authenticated = false,
}) {
  return (
    <div
      className="command-app"
      style={{
        minHeight: "100vh",
      }}
    >
      <main
        className="command-main"
        style={{
          width: "100%",
        }}
      >
        <section
          className="command-content"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "72px",
                lineHeight: 1,
                fontWeight: 800,
                marginBottom: "16px",
              }}
            >
              404
            </div>

            <h1
              style={{
                margin: "0 0 10px",
              }}
            >
              Page Not Found
            </h1>

            <p
              style={{
                margin: "0 0 24px",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              The page you are looking for does not
              exist or the address is incorrect.
            </p>

            <a
              href={
                authenticated
                  ? "/dashboard"
                  : "/"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "42px",
                padding: "0 18px",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: 700,
                background:
                  "var(--green-bright, #22c55e)",
                color: "#ffffff",
              }}
            >
              {authenticated
                ? "Go to Dashboard"
                : "Go to Home"}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  /* =========================================================
     SUPABASE AUTH STATE
  ========================================================= */

  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [welcomePopup, setWelcomePopup] = useState(null);

  /* =========================================================
     UPTREND SUBSCRIPTION STATE

     Every authenticated user has a subscription record.

     Current plans:
       - free
       - business

     Current statuses:
       - active
       - trialing
       - expired
       - cancelled
  ========================================================= */

  const [subscriptionLoading, setSubscriptionLoading] =
    useState(false);

  const [subscription, setSubscription] = useState(null);

  const [businessUpgradeOpen, setBusinessUpgradeOpen] =
    useState(false);

  const handleUpgrade = () => {
    setBusinessUpgradeOpen(true);
  };

  /* =========================================================
     PUBLIC / AUTH STATE
  ========================================================= */

  const [publicPage, setPublicPage] = useState("home");
  const [showPublicHome, setShowPublicHome] = useState(true);

  /* =========================================================
     ACTIVE APP PAGE

     The active page is still kept in state because the
     existing UpTrend components depend on it.

     The browser URL is now the source of truth for which
     page should be active.

     sessionStorage is retained for compatibility and for
     the existing scroll/page persistence system.
  ========================================================= */

  const getSavedActivePage = () => {
    try {
      return (
        sessionStorage.getItem(
          "uptrend_active_page"
        ) || "dashboard"
      );
    } catch {
      return "dashboard";
    }
  };

  const [activePage, setActivePage] = useState(
    getSavedActivePage
  );

  const activePageRef = useRef(
    getSavedActivePage()
  );

  /* =========================================================
     GLOBAL PAGE PERSISTENCE

     Remembers the active page, but NEVER remembers
     or restores the previous scroll position.
  ========================================================= */

  useEffect(() => {
    activePageRef.current = activePage;

    try {
      sessionStorage.setItem(
        "uptrend_active_page",
        activePage
      );
    } catch {}
  }, [activePage]);

  /* =========================================================
     GLOBAL SCROLL RESET

     Refresh any page -> Start at the top.
     Navigate to another page -> Start at the top.
     Browser back/forward -> Start at the top.

     The current URL and active page remain preserved.
  ========================================================= */

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const scrollToTop = () => {
      const commandMain =
        document.querySelector(".command-main");

      const commandContent =
        document.querySelector(".command-content");

      if (commandMain) {
        commandMain.scrollTop = 0;
        commandMain.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant",
        });
      }

      if (commandContent) {
        commandContent.scrollTop = 0;
        commandContent.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant",
        });
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });

      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();

  }, [location.pathname, location.key]);

  /* =========================================================
     INVOICE NAVIGATION FILTER

     Used when opening invoices directly from a customer.
     Example:
       customer + paid
       customer + overdue
       customer + outstanding
  ========================================================= */

  const [invoiceFilter, setInvoiceFilter] = useState({
    customerId: null,
    status: null,
  });

  const [newInvoiceCustomerId, setNewInvoiceCustomerId] =
    useState(null);

  const [customerToOpenId, setCustomerToOpenId] =
    useState(null);

  const [supplierToOpenId, setSupplierToOpenId] =
    useState(null);
  const [supplierToOpenPurchaseId, setSupplierToOpenPurchaseId] =
    useState(null);

  const [saleToOpenId, setSaleToOpenId] = useState(null);
  const [expenseToOpenId, setExpenseToOpenId] = useState(null);

  /* =========================================================
     NAVIGATION STATES

     IMPORTANT:
     sidebarOpen and mobileMenuOpen are SEPARATE.

     The mobile floating menu must NEVER open the
     desktop/sidebar drawer.
  ========================================================= */

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [editingSale, setEditingSale] = useState(() => {
    try {
      const saved = sessionStorage.getItem(
        "uptrend_editing_sale"
      );

      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  /* =========================================================
     LOAD CURRENT USER SUBSCRIPTION

     This reads only the signed-in user's subscription.

     RLS on uptrend_subscriptions protects the table.
  ========================================================= */

  const loadSubscription = async (user) => {
    if (!user?.id) {
      setSubscription(null);
      setSubscriptionLoading(false);
      return;
    }

    setSubscriptionLoading(true);

    const restoreCachedSubscription = async () => {
      const cached = await getCachedSubscription(user.id);
      setSubscription(cached);
      return Boolean(cached);
    };

    try {
      if (!navigator.onLine) {
        await restoreCachedSubscription();
        return;
      }

      const { data, error } = await supabase
        .from("uptrend_subscriptions")
        .select(
          `
            id,
            user_id,
            plan,
            status,
            started_at,
            trial_started_at,
            trial_ends_at,
            expires_at,
            created_at,
            updated_at
          `
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Failed to load UpTrend subscription:",
          error
        );

        const networkFailure =
          !navigator.onLine ||
          /fetch|network|timeout|offline|connection/i.test(
            error.message || ""
          );

        if (networkFailure) {
          await restoreCachedSubscription();
        } else {
          setSubscription(null);
        }

        return;
      }

      if (!data) {
        console.warn(
          "No UpTrend subscription found for user:",
          user.id
        );

        setSubscription(null);
        return;
      }

      setSubscription(data);

      try {
        await saveCachedSubscription(user.id, data);
      } catch (cacheError) {
        console.warn(
          "Subscription cache could not be saved:",
          cacheError
        );
      }
    } catch (error) {
      console.error(
        "Unexpected subscription loading error:",
        error
      );

      const networkFailure =
        !navigator.onLine ||
        /fetch|network|timeout|offline|connection/i.test(
          error?.message || ""
        );

      if (networkFailure) {
        try {
          await restoreCachedSubscription();
        } catch (cacheError) {
          console.warn(
            "Cached subscription could not be restored:",
            cacheError
          );
          setSubscription(null);
        }
      } else {
        setSubscription(null);
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

  /* =========================================================
     LOAD REAL SUPABASE SESSION
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "Supabase session error:",
            error
          );
        }

        if (!mounted) return;

        const user = session?.user ?? null;

        setSupabaseUser(user);

        if (user) {
          setShowPublicHome(false);
          setPublicPage("dashboard");

          /*
           * The URL is now authoritative.

           * If the user directly opens /sales, /reports,
           * /invoices, etc., the routing synchronization
           * effect below will select that page.

           * We therefore do not use sessionStorage here
           * to override an explicitly requested URL.
           */
          const currentPath =
            location.pathname;

          const currentPage =
            pathPageMap[currentPath];

          if (currentPage) {
            setActivePage(currentPage);
          }

          await loadSubscription(user);
        } else {
          setSubscription(null);
          setSubscriptionLoading(false);

          setShowPublicHome(true);
          setPublicPage("home");
        }
      } catch (error) {
        console.error(
          "Failed to load Supabase session:",
          error
        );

        if (!mounted) return;

        setSupabaseUser(null);
        setSubscription(null);
        setSubscriptionLoading(false);

        setShowPublicHome(true);
        setPublicPage("home");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const user = session?.user ?? null;

        setSupabaseUser(user);

        if (user) {
          setShowPublicHome(false);
          setPublicPage("dashboard");

          /*
           * The current browser URL remains authoritative.
           */
          const currentPath =
            window.location.pathname;

          const currentPage =
            pathPageMap[currentPath];

          if (currentPage) {
            setActivePage(currentPage);
          }

          /*
           * Delay the subscription query slightly so that
           * Supabase auth state processing completes first.
           */
          setTimeout(() => {
            if (mounted) {
              loadSubscription(user);
            }
          }, 0);
        } else {
          setSubscription(null);
          setSubscriptionLoading(false);

          /*
           * No Supabase session = public Home.
           */

          setShowPublicHome(true);
          setPublicPage("home");
          setActivePage("dashboard");

          setSidebarOpen(false);
          setMobileMenuOpen(false);
        }
      }
    );

    return () => {
      mounted = false;
      authSubscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     ROUTE / AUTHENTICATION SYNCHRONIZATION

     This is the main routing layer.

     Rules:

       Logged out:
         /             -> Public Home
         /sign-in      -> Sign In
         /sign-up      -> Sign Up
         protected URL -> /sign-in
         unknown URL   -> 404

       Logged in:
         /             -> /dashboard
         /sign-in      -> /dashboard
         /sign-up      -> /dashboard
         protected URL -> matching application page
         unknown URL   -> 404

       Public invoice:
         /invoice/:id  -> PublicInvoice
  ========================================================= */

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const pathname =
      location.pathname;

    /*
     * Public invoice routes are handled separately below.
     */
    if (pathname.startsWith("/invoice/")) {
      return;
    }

    /*
     * Developer responsive preview is intentionally
     * available before authentication.
     */
    if (pathname === "/_responsive") {
      return;
    }

    /*
     * LOGGED OUT ROUTING
     */
    if (!supabaseUser) {
      if (protectedPaths.includes(pathname)) {
        navigate("/sign-in", {
          replace: true,
        });

        return;
      }

      if (pathname === "/") {
        setShowPublicHome(true);
        setPublicPage("home");
        return;
      }

      if (pathname === "/sign-in") {
        setShowPublicHome(true);
        setPublicPage("signin");
        return;
      }

      if (pathname === "/sign-up") {
        setShowPublicHome(true);
        setPublicPage("signup");
        return;
      }

      /*
       * Unknown public URL.
       *
       * We intentionally do not redirect it to Home.
       * It must render the 404 page.
       */
      return;
    }

    /*
     * LOGGED IN ROUTING
     */

    if (pathname === "/") {
      navigate("/dashboard", {
        replace: true,
      });

      return;
    }

    if (
      pathname === "/sign-in" ||
      pathname === "/sign-up"
    ) {
      navigate("/dashboard", {
        replace: true,
      });

      return;
    }

    const page =
      pathPageMap[pathname];

    if (page) {
      setActivePage(page);
      setShowPublicHome(false);
      setPublicPage("dashboard");
    }
  }, [
    authLoading,
    supabaseUser,
    location.pathname,
    navigate,
  ]);

  /* =========================================================
     PUBLIC PAGE PERSISTENCE
  ========================================================= */

  useEffect(() => {
    if (!supabaseUser) return;

    try {
      sessionStorage.setItem(
        "uptrend_public_page",
        publicPage
      );
    } catch {}
  }, [publicPage, supabaseUser]);

  /* =========================================================
     OPEN DASHBOARD

     Only an existing Supabase session can open
     the dashboard.
  ========================================================= */

  const openDashboard = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setShowPublicHome(true);
        setPublicPage("signin");

        try {
          sessionStorage.setItem(
            "uptrend_public_home",
            "true"
          );

          sessionStorage.setItem(
            "uptrend_public_page",
            "signin"
          );
        } catch {}

        navigate("/sign-in");

        return;
      }

      setSupabaseUser(session.user);
      setShowPublicHome(false);
      setPublicPage("dashboard");
      setActivePage("dashboard");

      setSidebarOpen(false);
      setMobileMenuOpen(false);

      navigate("/dashboard");

      await loadSubscription(session.user);
    } catch (error) {
      console.error(
        "Unable to verify dashboard access:",
        error
      );

      setShowPublicHome(true);
      setPublicPage("signin");

      navigate("/sign-in");
    }
  };

  /* =========================================================
     OPEN SIGN UP
  ========================================================= */

  const openSignUp = () => {
    setShowPublicHome(true);
    setPublicPage("signup");

    try {
      sessionStorage.setItem(
        "uptrend_public_home",
        "true"
      );

      sessionStorage.setItem(
        "uptrend_public_page",
        "signup"
      );
    } catch {}

    navigate("/sign-up");
  };

  /* =========================================================
     OPEN SIGN IN
  ========================================================= */

  const openSignIn = () => {
    setShowPublicHome(true);
    setPublicPage("signin");

    try {
      sessionStorage.setItem(
        "uptrend_public_home",
        "true"
      );

      sessionStorage.setItem(
        "uptrend_public_page",
        "signin"
      );
    } catch {}

    navigate("/sign-in");
  };

  /* =========================================================
     BACK TO HOME
  ========================================================= */

  const backToPublicHome = () => {
    setShowPublicHome(true);
    setPublicPage("home");

    try {
      sessionStorage.setItem(
        "uptrend_public_home",
        "true"
      );

      sessionStorage.setItem(
        "uptrend_public_page",
        "home"
      );
    } catch {}

    navigate("/");
  };

  /* =========================================================
     REGISTRATION COMPLETE
  ========================================================= */

  const handleRegistered = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setShowPublicHome(true);
      setPublicPage("signin");

      navigate("/sign-in");

      return;
    }

    setSupabaseUser(session.user);
    setWelcomePopup({
      type: "signup",
      name: String(
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.username ||
        ""
      ).trim().split(/\s+/)[0] || "there",
    });
    setShowPublicHome(false);
    setPublicPage("dashboard");
    setActivePage("dashboard");

    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/dashboard");

    await loadSubscription(session.user);
  };

  /* =========================================================
     SIGN IN COMPLETE
  ========================================================= */

  const handleSignedIn = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.error(
        "Sign in completed without an active Supabase session."
      );

      setShowPublicHome(true);
      setPublicPage("signin");

      navigate("/sign-in");

      return;
    }

    setSupabaseUser(session.user);
    setWelcomePopup({
      type: "signin",
      name: String(
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.username ||
        ""
      ).trim().split(/\s+/)[0] || "there",
    });
    setShowPublicHome(false);
    setPublicPage("dashboard");
    setActivePage("dashboard");

    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/dashboard");

    await loadSubscription(session.user);
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = async () => {
    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Supabase logout error:",
          error
        );
        return;
      }

      sessionStorage.removeItem(
        "uptrend_authenticated"
      );

      sessionStorage.setItem(
        "uptrend_public_home",
        "true"
      );

      sessionStorage.setItem(
        "uptrend_public_page",
        "home"
      );

      setSupabaseUser(null);
      setSubscription(null);
      setSubscriptionLoading(false);
      setShowPublicHome(true);
      setPublicPage("home");
      setActivePage("dashboard");

      setSidebarOpen(false);
      setMobileMenuOpen(false);

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }
  };

  /* =========================================================
     APP NAVIGATION
  ========================================================= */

  const handleRecordSale = () => {
    setEditingSale(null);

    try {
      sessionStorage.removeItem(
        "uptrend_editing_sale"
      );
    } catch {}

    setActivePage("record");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/record-sale");
  };

  const handleRecordExpense = () => {
    setActivePage("expenses");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/expenses");
  };

  const handleAddProduct = () => {
    setActivePage("products");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/products");
  };

  const handleEditSale = (sale) => {
    setEditingSale(sale);

    try {
      sessionStorage.setItem(
        "uptrend_editing_sale",
        JSON.stringify(sale)
      );
    } catch {}

    setActivePage("record");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/record-sale");
  };

  const goToDashboard = () => {
    setEditingSale(null);

    try {
      sessionStorage.removeItem(
        "uptrend_editing_sale"
      );
    } catch {}

    setActivePage("dashboard");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/dashboard");
  };

  const goToReports = () => {
    setActivePage("reports");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/reports");
  };

  /* =========================================================
     OPEN CUSTOMER INVOICES

     Customers can open the invoice page with an optional
     customer and status filter.
  ========================================================= */

  const openCustomerInvoices = ({
    customerId,
    status = null,
  }) => {
    setInvoiceFilter({
      customerId: customerId || null,
      status: status || null,
    });

    setActivePage("invoices");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    /*
     * The filter is established BEFORE the page opens.
     * The URL is changed only after the state is prepared.
     */
    navigate("/invoices");
  };

  const clearInvoiceFilter = () => {
    setInvoiceFilter({
      customerId: null,
      status: null,
    });
  };

  const openNewCustomerInvoice = (customerId) => {
    if (!customerId) {
      return;
    }

    setInvoiceFilter({
      customerId: null,
      status: null,
    });

    setNewInvoiceCustomerId(customerId);
    setActivePage("invoices");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/invoices");
  };

  const clearNewInvoiceCustomer = () => {
    setNewInvoiceCustomerId(null);
  };

  const openCustomerProfile = (customerId) => {
    if (!customerId) {
      return;
    }

    setInvoiceFilter({
      customerId: null,
      status: null,
    });

    setNewInvoiceCustomerId(null);
    setCustomerToOpenId(customerId);
    setActivePage("customers");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/customers");
  };

  const clearCustomerToOpen = () => {
    setCustomerToOpenId(null);
  };

  const openSupplierProfile = (supplierId, purchaseId = null) => {
    if (!supplierId) {
      return;
    }

    setSupplierToOpenId(supplierId);
    setSupplierToOpenPurchaseId(purchaseId);
    setActivePage("suppliers");
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    navigate("/suppliers");
  };

  const clearSupplierToOpen = () => {
    setSupplierToOpenId(null);
    setSupplierToOpenPurchaseId(null);
  };

  const handleRecordSupplierPurchase = () => {
    setActivePage("suppliers");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
    navigate("/suppliers");
  };

  const openSaleRecord = (saleId) => {
    if (!saleId) return;
    setSaleToOpenId(saleId);
    setActivePage("sales");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
    navigate("/sales");
  };

  const clearSaleToOpen = () => {
    setSaleToOpenId(null);
  };

  const openExpenseRecord = (expenseId) => {
    if (!expenseId) return;
    setExpenseToOpenId(expenseId);
    setActivePage("expenses");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
    navigate("/expenses");
  };

  const clearExpenseToOpen = () => {
    setExpenseToOpenId(null);
  };

  const handleSetActivePage = (page) => {
    /*
     * Direct navigation to another page clears any
     * customer invoice filter.
     *
     * When opening invoices through openCustomerInvoices(),
     * the filter is already established before the page opens.
     */
    if (page !== "invoices") {
      clearInvoiceFilter();
    }

    setActivePage(page);
    setSidebarOpen(false);
    setMobileMenuOpen(false);

    const path =
      pagePathMap[page];

    if (path) {
      navigate(path);
    }
  };

  /* =========================================================
     PUBLIC INVOICE VIEWER

     This route is intentionally checked before the
     authentication gate so customers can open a shared
     invoice without having an UpTrend account.
  ========================================================= */

  if (
    location.pathname.startsWith("/invoice/")
  ) {
    return <PublicInvoice />;
  }

  /* =========================================================
     RESPONSIVE DEVELOPMENT PREVIEW

     This route intentionally loads before authentication so
     the developer can inspect the real UpTrend application
     inside an exact viewport-size iframe.
  ========================================================= */

  if (
    location.pathname === "/_responsive"
  ) {
    return <ResponsivePreview />;
  }

  /* =========================================================
     AUTH LOADING
  ========================================================= */

  if (authLoading) {
    return (
      <div className="command-app">
        <main className="command-main">
          <section className="command-content">
            <div
              style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Loading UpTrend...
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* =========================================================
     HARD AUTH GATE

     Public pages are now determined by the actual URL.
  ========================================================= */

  if (!supabaseUser) {
    if (
      location.pathname === "/sign-up"
    ) {
      return (
        <SignUp
          onBackHome={backToPublicHome}
          onRegistered={handleRegistered}
          onSignIn={openSignIn}
        />
      );
    }

    if (
      location.pathname === "/sign-in"
    ) {
      return (
        <SignIn
          onBackHome={backToPublicHome}
          onSignUp={openSignUp}
          onSignedIn={handleSignedIn}
        />
      );
    }

    if (location.pathname === "/") {
      return (
        <PublicHome
          onOpenDashboard={openDashboard}
          onOpenSignUp={openSignUp}
          onOpenSignIn={openSignIn}
        />
      );
    }

    /*
     * Protected URLs should already have been redirected
     * to /sign-in by the routing effect.
     *
     * Any other unknown URL is a genuine 404.
     */
    return (
      <PageNotFound
        authenticated={false}
      />
    );
  }

  /* =========================================================
     SUBSCRIPTION LOADING
  ========================================================= */

  if (subscriptionLoading) {
    return (
      <div className="command-app">
        <main className="command-main">
          <section className="command-content">
            <div
              style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Loading your UpTrend plan...
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* =========================================================
     UNKNOWN AUTHENTICATED ROUTE

     This prevents the old behavior where the default case
     silently rendered Dashboard.
  ========================================================= */

  if (
    !protectedPaths.includes(
      location.pathname
    )
  ) {
    /*
     * /, /sign-in and /sign-up are handled by the routing
     * synchronization effect and redirect to /dashboard.
     *
     * Any other path that reaches this point is unknown.
     */
    return (
      <PageNotFound
        authenticated={true}
      />
    );
  }

  /* =========================================================
     RENDER AUTHENTICATED APP PAGE
  ========================================================= */

  const renderPage = () => {
    switch (activePage) {
      case "offline-diagnostics":
        return <OfflineDiagnostics userId={supabaseUser?.id} />;

      case "dashboard":
        return (
          <Dashboard
            onRecordSale={handleRecordSale}
            onRecordExpense={handleRecordExpense}
            onRecordSupplierPurchase={handleRecordSupplierPurchase}
            onAddProduct={handleAddProduct}
            onViewReports={goToReports}
            subscription={subscription}
            onUpgrade={handleUpgrade}
          />
        );

      case "sales":
        return (
          <Sales
            onEditSale={handleEditSale}
            saleToOpenId={saleToOpenId}
            onSaleOpenHandled={clearSaleToOpen}
            subscription={subscription}
            onUpgrade={handleUpgrade}
          />
        );

      case "record":
        return (
          <RecordSale
            onBack={goToDashboard}
            editingSale={editingSale}
            onEditComplete={() => {
              setEditingSale(null);

              try {
                sessionStorage.removeItem(
                  "uptrend_editing_sale"
                );
              } catch {}
            }}
            subscription={subscription}
            onUpgrade={handleUpgrade}
          />
        );

      case "expenses":
        return (
          <Expenses
            expenseToOpenId={expenseToOpenId}
            onExpenseOpenHandled={clearExpenseToOpen}
            subscription={subscription}
            onUpgrade={handleUpgrade}
          />
        );

      case "products":
        return (
          <Products
            onOpenSupplier={openSupplierProfile}
            subscription={subscription}
            onUpgrade={handleUpgrade}
          />
        );

      case "business-insights":
        return (
          <BusinessInsights
            sales={[]}
            products={[]}
            expenses={[]}
          />
        );

      case "advanced-inventory":
        return (
          <AdvancedInventory
            subscription={subscription}
          />
        );

      case "sales-expense-trends":
        return (
          <SalesExpenseTrends
            subscription={subscription}
          />
        );

      case "business-targets":
        return (
          <BusinessTargets
            subscription={subscription}
          />
        );

      case "credit-debt":
        return (
          <CreditDebt
            subscription={subscription}
          />
        );

      case "suppliers":
        return (
          <Suppliers
            subscription={subscription}
            supplierToOpenId={supplierToOpenId}
            supplierToOpenPurchaseId={supplierToOpenPurchaseId}
            onSupplierOpenHandled={clearSupplierToOpen}
          />
        );

      case "exports":
        return (
          <Exports
            subscription={subscription}
          />
        );

      case "reports":
        return (
          <Reports
            subscription={subscription}
          />
        );

      case "transactions":
        return (
          <Transactions
            onOpenSupplier={openSupplierProfile}
            onOpenSale={openSaleRecord}
            onOpenExpense={openExpenseRecord}
          />
        );

      case "finance":
        return <Finance />;

      case "customers":
        return (
          <Customers
            subscription={subscription}
            onOpenInvoices={openCustomerInvoices}
            onCreateInvoice={openNewCustomerInvoice}
            customerToOpenId={customerToOpenId}
            onCustomerOpenHandled={clearCustomerToOpen}
          />
        );

      case "invoices":
        return (
          <Invoices
            subscription={subscription}
            invoiceFilter={invoiceFilter}
            onClearFilter={clearInvoiceFilter}
            newInvoiceCustomerId={newInvoiceCustomerId}
            onNewInvoiceHandled={clearNewInvoiceCustomer}
            onOpenCustomer={openCustomerProfile}
          />
        );

      case "settings":
        return (
          <Settings
            subscription={subscription}
            onLogout={handleLogout}
          />
        );

      default:
        /*
         * This should no longer be reached for a valid route.
         *
         * We deliberately do NOT fall back to Dashboard here,
         * because doing so would hide routing errors.
         */
        return (
          <PageNotFound
            authenticated={true}
          />
        );
    }
  };

  /* =========================================================
     AUTHENTICATED APPLICATION
  ========================================================= */

  return (
    <div className="command-app">

      {/* DESKTOP / TABLET SIDEBAR
          This has its OWN state. */}
      <Sidebar
        activePage={activePage}
        setActivePage={handleSetActivePage}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={handleLogout}
      />

      <main className="command-main">

        <Header
          activePage={activePage}
          setIsOpen={setSidebarOpen}
          onRecordSale={handleRecordSale}
        />

        <section className="command-content">
          {renderPage()}
        </section>

      </main>

      {/* MOBILE FLOATING POP-UP
          This has a completely SEPARATE state.

          Opening this will NOT open Sidebar. */}
      <MobileMenu
        activePage={activePage}
        setActivePage={handleSetActivePage}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      {/* GLOBAL FLOATING QUICK ACTION DOCK */}
      <nav className="global-quick-dock" aria-label="Quick actions">
        <button type="button" aria-label="Record sale" title="Record Sale"
          onClick={handleRecordSale}>
          <span className="dock-sale"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6M10 21h.01M18 21h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        </button>
        <button type="button" aria-label="Record expense" title="Record Expense"
          onClick={handleRecordExpense}>
          <span className="dock-expense"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8 8h8M8 12h8M8 16h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
        </button>
        <button type="button" aria-label="Suppliers" title="Suppliers"
          onClick={handleRecordSupplierPurchase}>
          <span className="dock-supplier"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z M3 7l9 4 9-4M12 11v10M7.5 5l9 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg></span>
        </button>
      </nav>

      <BusinessUpgradeModal
        open={businessUpgradeOpen}
        onClose={() => setBusinessUpgradeOpen(false)}
      />

      {welcomePopup && (
        <div
          className="uptrend-welcome-overlay"
          onClick={() => setWelcomePopup(null)}
        >
          <div
            className="uptrend-welcome-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="uptrend-welcome-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="uptrend-welcome-close"
              onClick={() => setWelcomePopup(null)}
              aria-label="Close welcome message"
            >
              ×
            </button>

            <div className="uptrend-welcome-icon">✦</div>

            <span className="uptrend-welcome-label">
              {welcomePopup.type === "signup"
                ? "WELCOME TO UPTREND"
                : "SUCCESSFULLY SIGNED IN"}
            </span>

            <h2 id="uptrend-welcome-title">
              {welcomePopup.type === "signup"
                ? `Welcome, ${welcomePopup.name}!`
                : `Welcome back, ${welcomePopup.name}!`}
            </h2>

            <p>
              Your business workspace is ready.
              Let's make today productive and keep your business moving forward.
            </p>

            <button
              type="button"
              className="uptrend-welcome-button"
              onClick={() => setWelcomePopup(null)}
            >
              Let's get started
              <span>→</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================================================
   APP ROOT
========================================================= */

function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "16px",
        right: "16px",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 99999,
        padding: "16px",
        borderRadius: "14px",
        background: "#10251a",
        color: "#ffffff",
        border: "1px solid #3b9b65",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>
        UpTrend update available
      </div>
      <div style={{ fontSize: "13px", marginBottom: "14px", opacity: 0.85 }}>
        A new version is ready. Update now to get the latest features.
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          style={{
            flex: 1,
            padding: "11px",
            border: 0,
            borderRadius: "8px",
            background: "#55d98a",
            color: "#062012",
            fontWeight: 700,
          }}
        >
          Update Now
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          style={{
            padding: "11px 16px",
            border: "1px solid #668675",
            borderRadius: "8px",
            background: "transparent",
            color: "#ffffff",
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}

function App() {
  console.log("VIEWPORT:", {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio
  });
  return (
    <ThemeProvider>
      <PWAUpdatePrompt />
      <AppContent />
    </ThemeProvider>
  );
}

export default App;