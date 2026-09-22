import { useEffect, useState } from "react";
import "./App.css";

import { supabase } from "./lib/supabase";
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
import PublicHome from "./components/PublicHome";
import Settings from "./components/Settings";
import SignUp from "./components/SignUp";
import SignIn from "./components/SignIn";
import MobileMenu from "./components/MobileMenu";
import ResponsivePreview from "./components/ResponsivePreview";

function AppContent() {
  /* =========================================================
     SUPABASE AUTH STATE
  ========================================================= */

  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseUser, setSupabaseUser] = useState(null);

  /* =========================================================
     PUBLIC / AUTH STATE
  ========================================================= */

  const [publicPage, setPublicPage] = useState("home");
  const [showPublicHome, setShowPublicHome] = useState(true);

  /* =========================================================
     ACTIVE APP PAGE
  ========================================================= */

  const [activePage, setActivePage] = useState("dashboard");

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
          setActivePage("dashboard");
        } else {
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
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        const user = session?.user ?? null;

        setSupabaseUser(user);

        if (user) {
          setShowPublicHome(false);
          setPublicPage("dashboard");
          setActivePage("dashboard");
        } else {
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
      subscription.unsubscribe();
    };
  }, []);

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

        return;
      }

      setSupabaseUser(session.user);
      setShowPublicHome(false);
      setPublicPage("dashboard");
      setActivePage("dashboard");

      setSidebarOpen(false);
      setMobileMenuOpen(false);
    } catch (error) {
      console.error(
        "Unable to verify dashboard access:",
        error
      );

      setShowPublicHome(true);
      setPublicPage("signin");
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
      return;
    }

    setSupabaseUser(session.user);
    setShowPublicHome(false);
    setPublicPage("dashboard");
    setActivePage("dashboard");

    setSidebarOpen(false);
    setMobileMenuOpen(false);
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
      return;
    }

    setSupabaseUser(session.user);
    setShowPublicHome(false);
    setPublicPage("dashboard");
    setActivePage("dashboard");

    setSidebarOpen(false);
    setMobileMenuOpen(false);
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
      setShowPublicHome(true);
      setPublicPage("home");
      setActivePage("dashboard");

      setSidebarOpen(false);
      setMobileMenuOpen(false);
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
  };

  const handleRecordExpense = () => {
    setActivePage("expenses");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
  };

  const handleAddProduct = () => {
    setActivePage("products");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
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
  };

  const goToReports = () => {
    setActivePage("reports");
    setSidebarOpen(false);
    setMobileMenuOpen(false);
  };

  /* =========================================================
     RESPONSIVE DEVELOPMENT PREVIEW
     
     This route intentionally loads before authentication so
     the developer can inspect the real UpTrend application
     inside an exact viewport-size iframe.
  ========================================================= */

  if (window.location.pathname === "/_responsive") {
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
  ========================================================= */

  if (!supabaseUser) {
    if (publicPage === "signup") {
      return (
        <SignUp
          onBackHome={backToPublicHome}
          onRegistered={handleRegistered}
          onSignIn={openSignIn}
        />
      );
    }

    if (publicPage === "signin") {
      return (
        <SignIn
          onBackHome={backToPublicHome}
          onSignUp={openSignUp}
          onSignedIn={handleSignedIn}
        />
      );
    }

    return (
      <PublicHome
        onOpenDashboard={openDashboard}
        onOpenSignUp={openSignUp}
        onOpenSignIn={openSignIn}
      />
    );
  }

  /* =========================================================
     RENDER AUTHENTICATED APP PAGE
  ========================================================= */

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            onRecordSale={handleRecordSale}
            onRecordExpense={handleRecordExpense}
            onAddProduct={handleAddProduct}
            onViewReports={goToReports}
          />
        );

      case "sales":
        return (
          <Sales
            onEditSale={handleEditSale}
          />
        );

      case "record":
        return (
          <RecordSale
            onBack={goToDashboard}
            editingSale={editingSale}
          />
        );

      case "expenses":
        return <Expenses />;

      case "products":
        return <Products />;

      case "reports":
        return <Reports />;

      case "finance":
        return <Finance />;

      case "settings":
        return (
          <Settings
            onLogout={handleLogout}
          />
        );

      default:
        return (
          <Dashboard
            onRecordSale={handleRecordSale}
            onRecordExpense={handleRecordExpense}
            onAddProduct={handleAddProduct}
            onViewReports={goToReports}
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
        setActivePage={setActivePage}
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
        setActivePage={setActivePage}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

    </div>
  );
}

/* =========================================================
   APP ROOT
========================================================= */

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;