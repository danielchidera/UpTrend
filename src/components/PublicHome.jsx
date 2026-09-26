import "./PublicHome.css";
import UpTrendLogo from "./UpTrendLogo";
import ProductDemo from "./ProductDemo";
import { useEffect, useRef, useState } from "react";

import {
  Store,
  Utensils,
  Warehouse,
  Cross,
  BriefcaseBusiness,
} from "lucide-react";

function Icon({ children, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CheckIcon() {
  return (
    <span className="check-icon">
      <Icon size={13}>
        <path d="m5 12 4 4L19 6" />
      </Icon>
    </span>
  );
}

function DashboardPreview({ onWatchDemo }) {
  return (
    <div className="hero-device-stage">

      {/* Ambient glow */}
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />

      {/* Main dashboard tablet */}
      <div className="hero-tablet-wrap">
        <ProductDemo tablet />
      </div>

      {/* Floating Sales Today card */}
      <div className="hero-sales-card">
        <div className="hero-sales-icon">
          ↗
        </div>

        <div className="hero-sales-copy">
          <span>Sales Today</span>
          <strong>₦142,000</strong>
          <small>↑ 24%</small>
        </div>

        <div className="hero-mini-bars">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      {/* Floating quick actions */}
      <div className="hero-actions-card">
        <button>
          <span>▣</span>
          <strong>Record Sale</strong>
          <b>›</b>
        </button>

        <button>
          <span>＋</span>
          <strong>Add Product</strong>
          <b>›</b>
        </button>

        <button>
          <span>▤</span>
          <strong>View Reports</strong>
          <b>›</b>
        </button>
      </div>

      {/* Mountain / terrain foreground */}
      <div className="hero-mountain">
        <div className="hero-mountain-back" />
        <div className="hero-mountain-front" />
      </div>

      {/* Product tour */}
      <button
        className="hero-demo-overlay"
        onClick={onWatchDemo}
        aria-label="Watch UpTrend product demo"
      >
        <span>▶</span>
        <strong>Watch product tour</strong>
      </button>
    </div>
  );
}

function FeatureItem({ icon, title, children }) {
  return (
    <div className="feature-strip-item">
      <div className="feature-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}

function BusinessType({ icon, children }) {
  return (
    <div className="business-type">
      <div className="business-type-icon">
        {icon}
      </div>

      <span>{children}</span>
    </div>
  );
}

function AppPhonePreview() {
  const phoneScreenRef = useRef(null);

  useEffect(() => {
    const updatePhoneScroll = () => {
      const screen = phoneScreenRef.current;
      const section = document.querySelector(".app-showcase");

      if (!screen || !section) return;

      const rect = section.getBoundingClientRect();

      const maxPhoneScroll =
        screen.scrollHeight - screen.clientHeight;

      if (maxPhoneScroll <= 0) return;

      const scrollDistance =
        section.offsetHeight - window.innerHeight;

      if (scrollDistance <= 0) return;

      const progress =
        Math.min(
          Math.max(-rect.top / scrollDistance, 0),
          1
        );

      screen.scrollTop =
        maxPhoneScroll * progress;
    };

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      window.requestAnimationFrame(() => {
        updatePhoneScroll();
        ticking = false;
      });

      ticking = true;
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("resize", updatePhoneScroll);

    updatePhoneScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        updatePhoneScroll
      );
    };
  }, []);

  return (
    <div className="app-phone-stage">
      <div className="app-phone-glow" />

      <div className="app-phone">

        {/* Dynamic Island */}
        <div className="app-phone-notch" />

        {/* Status bar */}
        <div className="app-phone-status">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>

        {/* =================================================
            SCROLLABLE DASHBOARD SCREEN
        ================================================= */}
        <div
          className="app-phone-screen"
          ref={phoneScreenRef}
        >

          <div className="mobile-dashboard">

            {/* Dashboard header */}
            <div className="mobile-dashboard-header">
              <div className="mobile-dashboard-brand">
                <span>↗</span>

                <div>
                  <strong>UpTrend</strong>
                  <small>Business Management</small>
                </div>
              </div>

              <button className="mobile-menu-button">
                ⋮
              </button>
            </div>

            {/* Business overview */}
            <section className="mobile-overview">

              <span className="mobile-section-label">
                BUSINESS OVERVIEW
              </span>

              <h3>
                Your business,
                <br />
                <span>moving forward.</span>
              </h3>

              <p>
                Track your cash, sales, profit and
                inventory from one place.
              </p>

            </section>

            {/* Cash at hand */}
            <section className="mobile-cash-card">

              <div>
                <span>CASH AT HAND</span>

                <strong>₦148,000</strong>
              </div>

              <div className="mobile-cash-icon">
                ₦
              </div>

              <div className="mobile-cash-breakdown">
                <span>
                  ↑ ₦215,000
                </span>

                <span>
                  ↓ ₦67,000
                </span>
              </div>

            </section>

            {/* Main statistics */}
            <section className="mobile-stat-grid">

              <div className="mobile-stat-card">
                <span>Today's Sales</span>
                <strong>₦142,000</strong>
                <small>Revenue generated today</small>
              </div>

              <div className="mobile-stat-card">
                <span>Today's Profit</span>
                <strong>₦48,500</strong>
                <small>Gross profit today</small>
              </div>

              <div className="mobile-stat-card">
                <span>Today's Expenses</span>
                <strong>₦23,700</strong>
                <small>Business expenses today</small>
              </div>

              <div className="mobile-stat-card">
                <span>Inventory Value</span>
                <strong>₦685,000</strong>
                <small>124 units in stock</small>
              </div>

            </section>

            {/* Money flow */}
            <section className="mobile-dashboard-card">

              <div className="mobile-card-heading">
                <div>
                  <span>MONEY FLOW</span>
                  <h4>Cash position</h4>
                </div>

                <b>● LIVE</b>
              </div>

              <div className="mobile-money-flow">

                <div>
                  <span>↑</span>

                  <small>Cash In</small>

                  <strong>₦215,000</strong>

                  <em>Sales received</em>
                </div>

                <i>→</i>

                <div>
                  <span className="expense-flow">↓</span>

                  <small>Cash Out</small>

                  <strong>₦67,000</strong>

                  <em>Recorded expenses</em>
                </div>

                <i>→</i>

                <div>
                  <span className="balance-flow">₦</span>

                  <small>Cash At Hand</small>

                  <strong>₦148,000</strong>

                  <em>Opening cash + inflow</em>
                </div>

              </div>

            </section>

            {/* Sales performance */}
            <section className="mobile-dashboard-card">

              <div className="mobile-card-heading">

                <div>
                  <span>PERFORMANCE</span>
                  <h4>Sales Performance</h4>
                </div>

                <b>7 DAYS</b>

              </div>

              <div className="mobile-chart">

                <div className="chart-grid-line line-one" />
                <div className="chart-grid-line line-two" />
                <div className="chart-grid-line line-three" />

                <svg
                  viewBox="0 0 500 180"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="mobileChartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#45e886"
                        stopOpacity="0.28"
                      />

                      <stop
                        offset="100%"
                        stopColor="#45e886"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>

                  <path
                    d="
                      M0 145
                      L70 145
                      L140 140
                      L210 150
                      L280 118
                      L350 130
                      L420 50
                      L500 105
                    "
                    fill="none"
                    stroke="#45e886"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="
                      M0 145
                      L70 145
                      L140 140
                      L210 150
                      L280 118
                      L350 130
                      L420 50
                      L500 105
                      L500 180
                      L0 180
                      Z
                    "
                    fill="url(#mobileChartGradient)"
                  />

                  <circle
                    cx="420"
                    cy="50"
                    r="7"
                    fill="#45e886"
                  />

                </svg>

                <div className="mobile-chart-days">
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                </div>

              </div>

              <div className="mobile-chart-summary">

                <div>
                  <span>Total Sales</span>
                  <strong>₦142,000</strong>
                </div>

                <div>
                  <span>Gross Profit</span>
                  <strong>₦48,500</strong>
                </div>

              </div>

            </section>

            {/* Quick actions */}
            <section className="mobile-dashboard-card">

              <div className="mobile-card-heading">
                <div>
                  <span>QUICK ACTIONS</span>
                  <h4>Move faster</h4>
                </div>
              </div>

              <div className="mobile-actions">

                <button>
                  <span>＋</span>

                  <div>
                    <strong>Record Sale</strong>
                    <small>Add a new transaction</small>
                  </div>

                  <b>→</b>
                </button>

                <button>
                  <span>↓</span>

                  <div>
                    <strong>Record Expense</strong>
                    <small>Track business spending</small>
                  </div>

                  <b>→</b>
                </button>

                <button>
                  <span>＋</span>

                  <div>
                    <strong>Add Product</strong>
                    <small>Update your inventory</small>
                  </div>

                  <b>→</b>
                </button>

              </div>

            </section>

            {/* Recent sales */}
            <section className="mobile-dashboard-card">

              <div className="mobile-card-heading">

                <div>
                  <span>TRANSACTIONS</span>
                  <h4>Recent Sales</h4>
                </div>

                <button className="mobile-view-all">
                  View all
                </button>

              </div>

              <div className="mobile-transaction">

                <div className="transaction-avatar">
                  F
                </div>

                <div>
                  <strong>Face Cap</strong>
                  <small>10 mins ago</small>
                </div>

                <div>
                  <strong>₦10,000</strong>
                  <small>+₦3,500 profit</small>
                </div>

              </div>

              <div className="mobile-transaction">

                <div className="transaction-avatar">
                  R
                </div>

                <div>
                  <strong>Rice — 10kg</strong>
                  <small>28 mins ago</small>
                </div>

                <div>
                  <strong>₦24,500</strong>
                  <small>+₦5,200 profit</small>
                </div>

              </div>

              <div className="mobile-transaction">

                <div className="transaction-avatar">
                  S
                </div>

                <div>
                  <strong>Premium Sugar</strong>
                  <small>1 hour ago</small>
                </div>

                <div>
                  <strong>₦18,000</strong>
                  <small>+₦4,100 profit</small>
                </div>

              </div>

            </section>

            {/* Inventory preview */}
            <section className="mobile-dashboard-card mobile-last-card">

              <div className="mobile-card-heading">

                <div>
                  <span>INVENTORY</span>
                  <h4>Stock overview</h4>
                </div>

                <b>124 ITEMS</b>

              </div>

              <div className="mobile-stock-row">
                <span>Rice 10kg</span>
                <strong>42</strong>
                <small>In stock</small>
              </div>

              <div className="mobile-stock-row">
                <span>Sugar 1kg</span>
                <strong>67</strong>
                <small>In stock</small>
              </div>

              <div className="mobile-stock-row">
                <span>Face Cap</span>
                <strong>15</strong>
                <small>Low stock</small>
              </div>

            </section>

          </div>
        </div>

        {/* Home indicator */}
        <div className="mobile-home-indicator" />

      </div>
    </div>
  );
}

function RatingCard() {
  return (
    <div className="rating-card">
      <div className="rating-icon">★</div>

      <div>
        <div className="rating-stars">★★★★★</div>
        <strong>5.0 App Rating</strong>
        <span>Based on verified user reviews</span>
      </div>

      <p>
        “UpTrend has made it so easy for me to manage my business.
        I love how simple everything feels.”
      </p>

      <div className="rating-person">
        <div className="rating-avatar">TA</div>

        <div>
          <strong>Tunde A.</strong>
          <span>Store Owner</span>
        </div>
      </div>
    </div>
  );
}

function StoreButtons() {
  return (
    <div className="store-buttons">
      <a
        className="store-badge-link"
        href="https://play.google.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="Get UpTrend on Google Play"
      >
        <img
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
          alt="Get it on Google Play"
        />
      </a>

      <a
        className="store-badge-link"
        href="#"
        onClick={(event) => event.preventDefault()}
        aria-label="Download UpTrend on the App Store"
      >
        <img
          src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg"
          alt="Download on the App Store"
        />
      </a>
    </div>
  );
}

function PricingCard({
  type,
  price,
  description,
  popular,
  features,
  action,
  onClick,
}) {
  return (
    <article className={`pricing-card ${popular ? "popular" : ""}`}>
      {popular && <div className="popular-label">MOST POPULAR</div>}

      <div className="pricing-card-top">
        <span>{type}</span>
        <p>{description}</p>
      </div>

      <div className="price">
        <strong>{price}</strong>
        <span>/month</span>
      </div>

      <div className="pricing-divider" />

      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      <button onClick={onClick}>{action}</button>
    </article>
  );
}

function Testimonial({ initials, name, role, quote }) {
  return (
    <article className="testimonial-card">
      <div className="quote-mark">“</div>

      <p>{quote}</p>

      <div className="testimonial-person">
        <div className="testimonial-avatar">{initials}</div>

        <div>
          <strong>{name}</strong>
          <span>{role}</span>
        </div>
      </div>
    </article>
  );
}

export default function PublicHome({
  onOpenDashboard,
  onOpenSignUp,
  onOpenSignIn,
}) {
  const [demoOpen, setDemoOpen] = useState(false);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="public-home">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="public-header">
        <div className="public-header-inner">

          <button
            className="public-brand"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            aria-label="UpTrend home"
          >
            <UpTrendLogo />
          </button>

          <nav className="public-nav">

            <button onClick={() => scrollTo("features")}>
              Features
            </button>

            <button onClick={() => scrollTo("pricing")}>
              Pricing
            </button>

            <button onClick={() => scrollTo("experience")}>
              Resources
            </button>

            <button onClick={() => scrollTo("about")}>
              About
            </button>

          </nav>

          <div className="public-actions">

            <button
              className="public-login"
              onClick={onOpenSignIn}
            >
              Log in
            </button>

            <button
              className="public-primary small"
              onClick={onOpenSignUp}
            >
              Sign up
            </button>

          </div>

        </div>
      </header>


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="public-hero">

        <div className="hero-copy">

          <span className="eyebrow">
            <i />
            ALL-IN-ONE BUSINESS MANAGEMENT
          </span>

          <h1>
            From Numbers to
            <br />
            <span>Growth</span>
          </h1>

          <p>
            Manage your sales, inventory, expenses and reports —
            so you can run a smarter business with confidence.
          </p>

          <div className="hero-buttons">

            <button
              className="public-primary hero-download-btn"
              onClick={onOpenSignUp}
            >
              Download
              <span>↓</span>
            </button>

          </div>

          <div className="hero-trust">

            <span>
              <CheckIcon />
              Easy to use
            </span>

            <span>
              <CheckIcon />
              Secure &amp; Reliable
            </span>

            <span>
              <CheckIcon />
              Works offline
            </span>

          </div>

        </div>

        <DashboardPreview
          onWatchDemo={() => setDemoOpen(true)}
        />

      </section>


      {/* =====================================================
          FLOATING DOWNLOAD CARD
      ===================================================== */}

      <div className="floating-download-card">

        <div className="floating-download-brand">

          <div className="floating-download-logo">
            <UpTrendLogo compact />
          </div>

          <div className="floating-download-copy">
            <strong>UpTrend</strong>
            <span>Manage Business. Grow More.</span>
          </div>

        </div>

        <div className="floating-download-action">

          <button onClick={onOpenSignUp}>
            Download
          </button>

          <small>
            Free&nbsp;&nbsp;•&nbsp;&nbsp;Android
          </small>

        </div>

      </div>


      {/* =====================================================
          FEATURES STRIP
      ===================================================== */}

      <section
        className="feature-strip"
        id="features"
      >

        <FeatureItem
          icon={
            <Icon size={25}>
              <path d="M5 7h14v12H5z" />
              <path d="M8 7V5h8v2" />
              <path d="M8 12h8" />
            </Icon>
          }
          title="Sales Management"
        >
          Record sales, track payments and monitor growth in real time.
        </FeatureItem>

        <FeatureItem
          icon={
            <Icon size={25}>
              <path d="m12 3 8 5-8 5-8-5 8-5Z" />
              <path d="m4 12 8 5 8-5" />
              <path d="m4 16 8 5 8-5" />
            </Icon>
          }
          title="Inventory Control"
        >
          Manage your products, stock levels and get low inventory alerts.
        </FeatureItem>

        <FeatureItem
          icon={
            <Icon size={25}>
              <rect
                x="4"
                y="5"
                width="16"
                height="14"
                rx="2"
              />
              <path d="M8 9h8M8 13h5" />
            </Icon>
          }
          title="Expense Tracking"
        >
          Keep track of all business expenses and stay in control of your finances.
        </FeatureItem>

        <FeatureItem
          icon={
            <Icon size={25}>
              <path d="M5 20V10M12 20V5M19 20v-8" />
            </Icon>
          }
          title="Detailed Reports"
        >
          Get powerful insights and reports to make better decisions.
        </FeatureItem>

      </section>


      {/* =====================================================
          TRUSTED BUSINESS TYPES
      ===================================================== */}

      <section
        className="business-section"
        id="experience"
      >

        <div className="business-trust-heading">

          <div className="trusted-heading-line" />

          <div className="trusted-heading-content">

            <span>
              BUILT FOR REAL BUSINESS
            </span>

            <p>
              Trusted by business owners, retailers and growing companies
            </p>

          </div>

          <div className="trusted-heading-line" />

        </div>


        <div className="business-types">

          <BusinessType
            icon={
              <Store
                size={25}
                strokeWidth={1.7}
              />
            }
          >
            Retail Stores
          </BusinessType>


          <BusinessType
            icon={
              <Utensils
                size={25}
                strokeWidth={1.7}
              />
            }
          >
            Restaurants
          </BusinessType>


          <BusinessType
            icon={
              <Warehouse
                size={25}
                strokeWidth={1.7}
              />
            }
          >
            Wholesalers
          </BusinessType>


          <BusinessType
            icon={
              <Cross
                size={25}
                strokeWidth={1.7}
              />
            }
          >
            Pharmacies
          </BusinessType>


          <BusinessType
            icon={
              <BriefcaseBusiness
                size={25}
                strokeWidth={1.7}
              />
            }
          >
            Service Businesses
          </BusinessType>

        </div>


        {/* Google Play rating */}

        <div className="reference-rating">

          <div className="rating-laurel rating-laurel-left">
            ❯
          </div>

          <div className="reference-rating-content">

            <div className="reference-stars">
              ★★★★★
            </div>

            <strong>
              4.9 on Google Play
            </strong>

            <span>
              Trusted by thousands of business owners
            </span>

          </div>

          <div className="rating-laurel rating-laurel-right">
            ❮
          </div>

        </div>

      </section>


      {/* =====================================================
          APP SHOWCASE
      ===================================================== */}

      <section
        className="app-showcase"
        id="about"
      >

        <div className="app-showcase-inner">

          {/* Phone */}

          <div className="app-showcase-visual">

            <div className="app-showcase-glow" />

            <div className="app-showcase-orbit orbit-one" />

            <div className="app-showcase-orbit orbit-two" />

            <AppPhonePreview />

          </div>


          {/* Copy */}

          <div className="app-copy">

            <span className="eyebrow gold">
              REAL BUSINESS RESULTS
            </span>

            <h2>
              One Platform.
              <br />
              <span>Complete Control.</span>
            </h2>

            <p>
              Everything you need to run and grow your business,
              right at your fingertips.
            </p>

            <ul className="app-check-list">

              <li>
                <CheckIcon />
                <span>Track sales in real time</span>
              </li>

              <li>
                <CheckIcon />
                <span>Manage inventory with ease</span>
              </li>

              <li>
                <CheckIcon />
                <span>Monitor expenses and profits</span>
              </li>

              <li>
                <CheckIcon />
                <span>Access reports anytime, anywhere</span>
              </li>

            </ul>

            <StoreButtons />

          </div>

        </div>

      </section>


{/* PRICING */}
<section className="pricing-section" id="pricing">
  <div className="pricing-background-glow pricing-glow-one" />
  <div className="pricing-background-glow pricing-glow-two" />

  <div className="section-heading centered light pricing-heading">
    <span className="section-kicker pricing-kicker">
      SIMPLE PRICING
    </span>

    <h2>
      Simple Pricing for
      <br />
      <span>Growing Businesses</span>
    </h2>

    <p>
      Start free and upgrade when you need more.
      <br />
      No complicated plans. No hidden fees.
    </p>

    <div className="pricing-toggle">
      <button
        className="active"
        onClick={(event) => {
          event.currentTarget.parentElement
            .querySelectorAll("button")
            .forEach((button) => button.classList.remove("active"));

          event.currentTarget.classList.add("active");

          document
            .querySelectorAll(".pricing-price")
            .forEach((price) => {
              price.classList.remove("yearly-active");
            });
        }}
      >
        Monthly
      </button>

      <button
        onClick={(event) => {
          event.currentTarget.parentElement
            .querySelectorAll("button")
            .forEach((button) => button.classList.remove("active"));

          event.currentTarget.classList.add("active");

          document
            .querySelectorAll(".pricing-price")
            .forEach((price) => {
              price.classList.add("yearly-active");
            });
        }}
      >
        Yearly
        <small>Save 20%</small>
      </button>
    </div>
  </div>

  <div className="pricing-grid premium-pricing-grid">

    {/* FREE */}
    <article className="pricing-card premium-pricing-card">

      <div className="pricing-orbit pricing-orbit-one" />

      <div className="pricing-card-top">
        <div className="pricing-plan-icon">
          <span>↗</span>
        </div>

        <span>Free</span>

        <p>
          Everything you need to start
          managing your business.
        </p>
      </div>

      <div className="pricing-price">
        <div className="price-monthly">
          <strong>₦0</strong>
          <span>/month</span>
        </div>

        <div className="price-yearly">
          <strong>₦0</strong>
          <span>/year</span>
        </div>
      </div>

      <div className="pricing-divider" />

      <ul>
        <li>
          <CheckIcon />
          Dashboard &amp; business overview
        </li>

        <li>
          <CheckIcon />
          Record sales
        </li>

        <li>
          <CheckIcon />
          Products &amp; inventory
        </li>

        <li>
          <CheckIcon />
          Expense tracking
        </li>

        <li>
          <CheckIcon />
          Basic reports
        </li>

        <li>
          <CheckIcon />
          Gross-profit tracking
        </li>

        <li>
          <CheckIcon />
          Low-stock alerts
        </li>

        <li>
          <CheckIcon />
          1 user
        </li>

        <li>
          <CheckIcon />
          Mobile &amp; web access
        </li>
      </ul>

      <button
        className="pricing-action"
        onClick={onOpenSignUp}
      >
        Get Started Free
        <span>→</span>
      </button>
    </article>


    {/* BUSINESS */}
    <article className="pricing-card premium-pricing-card premium-business-card">

      <div className="premium-popular">
        BUSINESS
      </div>

      <div className="pricing-card-glow" />

      <div className="pricing-card-top">
        <div className="pricing-plan-icon gold-icon">
          <span>◆</span>
        </div>

        <span>Business</span>

        <p>
          For growing businesses that need
          deeper control, insights and tools.
        </p>
      </div>

      <div className="pricing-price">
        <div className="price-monthly">
          <strong>₦4,900</strong>
          <span>/month</span>
        </div>

        <div className="price-yearly">
          <strong>₦47,040</strong>
          <span>/year</span>
        </div>
      </div>

      <div className="pricing-divider" />

      <ul>
        <li>
          <CheckIcon />
          Everything in Free
        </li>

        <li>
          <CheckIcon />
          Unlimited products
        </li>

        <li>
          <CheckIcon />
          Business Insights
        </li>

        <li>
          <CheckIcon />
          Advanced reports
        </li>

        <li>
          <CheckIcon />
          CSV, Excel &amp; PDF exports
        </li>

        <li>
          <CheckIcon />
          Professional receipts &amp; invoices
        </li>

        <li>
          <CheckIcon />
          Customer management
        </li>

        <li>
          <CheckIcon />
          Credit &amp; debt tracking
        </li>

        <li>
          <CheckIcon />
          Supplier management
        </li>

        <li>
          <CheckIcon />
          Inventory intelligence
        </li>

        <li>
          <CheckIcon />
          Sales &amp; expense trends
        </li>

        <li>
          <CheckIcon />
          Business targets
        </li>

        <li>
          <CheckIcon />
          Multiple users &amp; managers
        </li>

        <li>
          <CheckIcon />
          Multiple branches
        </li>

        <li>
          <CheckIcon />
          Branch inventory &amp; performance
        </li>

        <li>
          <CheckIcon />
          Branch comparison
        </li>

        <li>
          <CheckIcon />
          Advanced permissions
        </li>

        <li>
          <CheckIcon />
          Consolidated reports
        </li>

        <li>
          <CheckIcon />
          Advanced audit history
        </li>

        <li>
          <CheckIcon />
          Automated backups
        </li>

        <li>
          <CheckIcon />
          Priority support
        </li>
      </ul>

      <button
        className="pricing-action gold-action"
        onClick={onOpenSignUp}
      >
        Start 7-Day Free Trial
        <span>→</span>
      </button>
    </article>

  </div>

  <div className="pricing-bottom-note">
    <span>✓</span>
    Start free. Upgrade only when your business needs more.
  </div>
</section>


{/* =====================================================
          TESTIMONIALS
      ===================================================== */}

      <section className="testimonials-section">

        <div className="section-heading centered">

          <span className="section-kicker">
            TRUSTED BY BUSINESS OWNERS
          </span>

          <h2>
            Trusted by Business Owners
            <br />
            <span>Everywhere</span>
          </h2>

          <p>
            Real businesses using UpTrend to stay organized and grow.
          </p>

        </div>


        <div className="testimonials-grid">

          <Testimonial
            initials="EC"
            name="E. Chukwu"
            role="Boutique Owner"
            quote="UpTrend has transformed the way I manage my business. It is simple and very reliable."
          />

          <Testimonial
            initials="PM"
            name="Precious M."
            role="Pharmacy Owner"
            quote="The inventory and report features are exactly what I needed. Highly recommended."
          />

          <Testimonial
            initials="SR"
            name="Samuel R."
            role="Restaurant Owner"
            quote="I can now track my sales and expenses from my phone. UpTrend has made managing much easier."
          />

        </div>

      </section>


      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="final-cta">

        <div>

          <span className="section-kicker">
            START TODAY
          </span>

          <h2>
            Ready to Take Control
            <br />
            of Your Business?
          </h2>

          <p>
            Join business owners who are managing smarter with UpTrend.
          </p>

          <button
            className="public-primary"
            onClick={onOpenSignUp}
          >
            Get Started Free
            <span>→</span>
          </button>

        </div>


        <div className="cta-decoration">

          <span>
            Manage Today.
          </span>

          <strong>
            Grow Tomorrow.
          </strong>

        </div>

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer
        className="public-footer"
        id="footer"
      >

        <div className="footer-main">

          <div className="footer-brand">

            <UpTrendLogo />

            <p>
              Manage today.
              <br />
              Grow tomorrow.
            </p>

          </div>


          <div className="footer-column">

            <h4>Product</h4>

            <button
              onClick={() => scrollTo("features")}
            >
              Features
            </button>

            <button
              onClick={() => scrollTo("pricing")}
            >
              Pricing
            </button>

            <button onClick={onOpenDashboard}>
              Dashboard
            </button>

            <button
              onClick={() => scrollTo("experience")}
            >
              Integrations
            </button>

          </div>


          <div className="footer-column">

            <h4>Company</h4>

            <button
              onClick={() => scrollTo("about")}
            >
              About Us
            </button>

            <button>
              Blog
            </button>

            <button>
              Careers
            </button>

            <button>
              Contact
            </button>

          </div>


          <div className="footer-column">

            <h4>Support</h4>

            <button>
              Help Center
            </button>

            <button>
              FAQs
            </button>

            <button>
              Privacy Policy
            </button>

            <button>
              Terms of Service
            </button>

          </div>


          <div className="footer-column follow">

            <h4>
              Follow Us
            </h4>

            <div className="social-links">

              <button>
                𝕏
              </button>

              <button>
                f
              </button>

              <button>
                ◎
              </button>

              <button>
                in
              </button>

            </div>

          </div>

        </div>


        <div className="footer-bottom">

          <span>
            © {new Date().getFullYear()} UpTrend. All rights reserved.
          </span>

          <button className="language-button">

            🌐 English

            <span>
              ⌄
            </span>

          </button>

        </div>

      </footer>


      {/* =====================================================
          PRODUCT DEMO MODAL
      ===================================================== */}

      {demoOpen && (
        <div
          className="product-demo-modal"
          role="dialog"
          aria-modal="true"
          aria-label="UpTrend product demo"
        >

          <ProductDemo
            fullscreen
            onClose={() => setDemoOpen(false)}
          />

        </div>
      )}

    </main>
  );
}