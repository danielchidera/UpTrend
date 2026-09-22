import "./Dashboard.css";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import {
  calculateFinancialSummary,
} from "../utils/financeStore";

function Dashboard({
  onRecordSale,
  onRecordExpense,
  onAddProduct,
}) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [finance, setFinance] =
    useState({
      openingBalance: 0,
    });

  const [openingInput, setOpeningInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showOpeningForm, setShowOpeningForm] =
    useState(false);

  const loadData = async () => {
    try {
      setError("");

      const {
        data: {
          user,
        },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        setSales([]);
        setProducts([]);
        setExpenses([]);

        setFinance({
          openingBalance: 0,
        });

        setOpeningInput("");
        return;
      }

      const [
        salesResult,
        productsResult,
        expensesResult,
        financeResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .eq("user_id", user.id)
          .order("sale_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("products")
          .select("*")
          .eq("user_id", user.id)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .order("expense_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("finance_settings")
          .select("opening_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (salesResult.error) {
        throw salesResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      if (financeResult.error) {
        throw financeResult.error;
      }

      const mappedSales =
        (salesResult.data || []).map(
          (sale) => ({
            id: sale.id,

            date:
              sale.sale_date,

            productId:
              sale.product_id || "",

            product:
              sale.product_name,

            productName:
              sale.product_name,

            quantity:
              Number(
                sale.quantity || 0
              ),

            costPrice:
              Number(
                sale.cost_price || 0
              ),

            totalCost:
              Number(
                sale.cost_price || 0
              ) *
              Number(
                sale.quantity || 0
              ),

            sellingPrice:
              Number(
                sale.selling_price || 0
              ),

            totalSelling:
              Number(
                sale.total_selling || 0
              ),

            grossProfit:
              Number(
                sale.gross_profit || 0
              ),

            createdAt:
              sale.created_at,

            time:
              sale.created_at
                ? new Date(
                    sale.created_at
                  ).toLocaleTimeString(
                    "en-NG",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                : "",
          })
        );

      const mappedProducts =
        (productsResult.data || []).map(
          (product) => ({
            id: product.id,

            name:
              product.name,

            costPrice:
              Number(
                product.cost_price || 0
              ),

            stock:
              Number(
                product.stock || 0
              ),

            lowStockAt:
              Number(
                product.low_stock_at || 0
              ),

            createdAt:
              product.created_at,

            updatedAt:
              product.updated_at,
          })
        );

      const mappedExpenses =
        (expensesResult.data || []).map(
          (expense) => ({
            id: expense.id,

            name:
              expense.name,

            amount:
              Number(
                expense.amount || 0
              ),

            category:
              expense.category || "",

            note:
              expense.note || "",

            date:
              expense.expense_date,

            createdAt:
              expense.created_at,
          })
        );

      const openingBalance =
        Number(
          financeResult.data
            ?.opening_balance || 0
        );

      setSales(mappedSales);
      setProducts(mappedProducts);
      setExpenses(mappedExpenses);

      setFinance({
        openingBalance,
      });

      setOpeningInput(
        openingBalance
          ? String(openingBalance)
          : ""
      );
    } catch (loadError) {
      console.error(
        "Dashboard data load failed:",
        loadError
      );

      setError(
        loadError?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const refresh = () => {
      loadData();
    };

    window.addEventListener(
      "focus",
      refresh
    );

    window.addEventListener(
      "storage",
      refresh
    );

    return () => {
      window.removeEventListener(
        "focus",
        refresh
      );

      window.removeEventListener(
        "storage",
        refresh
      );
    };
  }, []);

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;

  const financial = useMemo(
    () =>
      calculateFinancialSummary(
        sales,
        expenses,
        finance
      ),
    [sales, expenses, finance]
  );

  const getLocalDateKey = (date) => {
    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today =
    getLocalDateKey(new Date());

  const todaySales = sales
    .filter(
      (sale) =>
        sale.date === today
    )
    .reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.totalSelling || 0
        ),
      0
    );

  const todayProfit = sales
    .filter(
      (sale) =>
        sale.date === today
    )
    .reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.grossProfit || 0
        ),
      0
    );

  const stockUnits =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.stock || 0
        ),
      0
    );

  const inventoryValue =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.stock || 0
        ) *
        Number(
          product.costPrice || 0
        ),
      0
    );

  const lowStock =
    products.filter(
      (product) =>
        Number(
          product.stock || 0
        ) <=
        Number(
          product.lowStockAt || 0
        )
    ).length;

  const recentSales = [
    ...sales,
  ]
    .sort((a, b) => {
      const aDate = new Date(
        `${a.date}T${
          a.time || "00:00"
        }`
      );

      const bDate = new Date(
        `${b.date}T${
          b.time || "00:00"
        }`
      );

      return bDate - aDate;
    })
    .slice(0, 5);

  const chartData = useMemo(() => {
    const result = [];

    for (
      let i = 6;
      i >= 0;
      i--
    ) {
      const date = new Date();

      date.setHours(
        0,
        0,
        0,
        0
      );

      date.setDate(
        date.getDate() - i
      );

      const dateKey =
        getLocalDateKey(date);

      const amount = sales
        .filter(
          (sale) =>
            sale.date === dateKey
        )
        .reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.totalSelling || 0
            ),
          0
        );

      result.push({
        date: dateKey,
        label:
          date.toLocaleDateString(
            "en-NG",
            {
              weekday: "short",
            }
          ),
        amount,
      });
    }

    return result;
  }, [sales]);

  const chartMax = Math.max(
    ...chartData.map(
      (day) => day.amount
    ),
    1
  );

  const chartPoints =
    chartData.map(
      (day, index) => {
        const x =
          (index / 6) * 100;

        const y =
          88 -
          (day.amount /
            chartMax) *
            68;

        return {
          ...day,
          x,
          y,
        };
      }
    );

  const linePoints =
    chartPoints
      .map(
        (point) =>
          `${point.x},${point.y}`
      )
      .join(" ");

  const areaPoints = [
    "0,88",
    ...chartPoints.map(
      (point) =>
        `${point.x},${point.y}`
    ),
    "100,88",
  ].join(" ");

  const saveOpeningBalance =
    async (event) => {
      event.preventDefault();

      const amount =
        Number(openingInput);

      if (
        !Number.isFinite(
          amount
        ) ||
        amount < 0
      ) {
        return;
      }

      try {
        setError("");

        const {
          data: {
            user,
          },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error(
            "You must be signed in."
          );
        }

        const {
          error: saveError,
        } = await supabase
          .from("finance_settings")
          .upsert(
            {
              user_id: user.id,
              opening_balance:
                amount,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "user_id",
            }
          );

        if (saveError) {
          throw saveError;
        }

        const updated = {
          openingBalance:
            amount,
        };

        setFinance(updated);
        setOpeningInput(
          String(amount)
        );
        setShowOpeningForm(false);

        await loadData();
      } catch (saveError) {
        console.error(
          "Dashboard opening balance save failed:",
          saveError
        );

        setError(
          saveError?.message ||
            "Unable to save opening balance."
        );
      }
    };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-panel">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-panel">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      <section className="dashboard-hero">

        <div className="dashboard-hero-copy">

          <span className="eyebrow">
            BUSINESS OVERVIEW
          </span>

          <h1>
            Your business,
            <br />
            <span>
              moving forward.
            </span>
          </h1>

          <p>
            Track your cash, sales, profit
            and inventory from one place.
          </p>

        </div>

        <div className="hero-balance-card">

          <div className="hero-balance-top">

            <span>
              CASH AT HAND
            </span>

            <button
              type="button"
              className="hero-balance-edit"
              onClick={() =>
                setShowOpeningForm(
                  (value) =>
                    !value
                )
              }
            >
              ⚙
            </button>

          </div>

          <strong>
            {formatMoney(
              financial.cashAtHand
            )}
          </strong>

          <div className="hero-balance-flow">

            <span>
              ↑{" "}
              {formatMoney(
                financial.cashIn
              )}
            </span>

            <span>
              ↓{" "}
              {formatMoney(
                financial.cashOut
              )}
            </span>

          </div>

          {showOpeningForm && (
            <form
              className="opening-balance-form"
              onSubmit={
                saveOpeningBalance
              }
            >
              <label>
                OPENING BUSINESS CASH
              </label>

              <div className="opening-balance-row">

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    openingInput
                  }
                  onChange={(event) =>
                    setOpeningInput(
                      event.target.value
                    )
                  }
                  placeholder="Enter opening cash"
                />

                <button type="submit">
                  Save
                </button>

              </div>
            </form>
          )}

        </div>

      </section>

      <section className="dashboard-kpi-grid">

        <article className="dashboard-kpi-card">
          <span>
            Today's Sales
          </span>

          <strong>
            {formatMoney(
              todaySales
            )}
          </strong>

          <small>
            Revenue generated today
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <span>
            Today's Profit
          </span>

          <strong>
            {formatMoney(
              todayProfit
            )}
          </strong>

          <small>
            Gross profit today
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <span>
            Today's Expenses
          </span>

          <strong>
            {formatMoney(
              expenses
                .filter(
                  (expense) =>
                    expense.date === today
                )
                .reduce(
                  (sum, expense) =>
                    sum +
                    Number(
                      expense.amount || 0
                    ),
                  0
                )
            )}
          </strong>

          <small>
            Business expenses recorded today
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <span>
            Inventory Value
          </span>

          <strong>
            {formatMoney(
              inventoryValue
            )}
          </strong>

          <small>
            {stockUnits} units in stock
          </small>
        </article>

      </section>

      <section className="dashboard-money-flow">

        <div className="section-heading">

          <div>
            <span className="eyebrow">
              MONEY FLOW
            </span>

            <h2>
              Cash position
            </h2>
          </div>

          <span className="live-pill">
            ● LIVE
          </span>

        </div>

        <div className="money-flow-grid">

          <div className="money-flow-item money-flow-in">

            <div className="money-flow-icon">
              ↑
            </div>

            <div>
              <span>
                Cash In
              </span>

              <strong>
                {formatMoney(
                  financial.cashIn
                )}
              </strong>

              <small>
                Sales received
              </small>
            </div>

          </div>

          <div className="money-flow-arrow">
            →
          </div>

          <div className="money-flow-item money-flow-out">

            <div className="money-flow-icon">
              ↓
            </div>

            <div>
              <span>
                Cash Out
              </span>

              <strong>
                {formatMoney(
                  financial.cashOut
                )}
              </strong>

              <small>
                Recorded expenses
              </small>
            </div>

          </div>

          <div className="money-flow-arrow">
            →
          </div>

          <div className="money-flow-item money-flow-balance">

            <div className="money-flow-icon">
              ₦
            </div>

            <div>
              <span>
                Cash At Hand
              </span>

              <strong>
                {formatMoney(
                  financial.cashAtHand
                )}
              </strong>

              <small>
                Opening cash + inflow − outflow
              </small>
            </div>

          </div>

        </div>

      </section>

      <section className="dashboard-main-grid">

        <div className="dashboard-panel performance-panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                PERFORMANCE
              </span>

              <h2>
                Sales Performance
              </h2>
            </div>

            <span className="panel-period">
              7 DAYS
            </span>

          </div>

          <div className="real-sales-chart">

            <div className="real-chart-grid">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <svg
              className="real-chart-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >

              <defs>
                <linearGradient
                  id="uptrendChartFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="rgba(91,217,143,0.22)"
                  />

                  <stop
                    offset="100%"
                    stopColor="rgba(91,217,143,0)"
                  />
                </linearGradient>
              </defs>

              <polygon
                className="real-chart-area"
                points={areaPoints}
              />

              <polyline
                className="real-chart-line"
                points={linePoints}
              />

            </svg>

            <div className="real-chart-points">

              {chartPoints.map(
                (point) => (
                  <span
                    key={point.date}
                    className="real-chart-point"
                    style={{
                      left:
                        `${point.x}%`,
                      top:
                        `${point.y}%`,
                    }}
                    title={`${point.label}: ${formatMoney(
                      point.amount
                    )}`}
                  />
                )
              )}

            </div>

            <div className="real-chart-labels">

              {chartData.map(
                (day) => (
                  <span
                    key={day.date}
                  >
                    {day.label}
                  </span>
                )
              )}

            </div>

          </div>

          <div className="performance-summary">

            <div>
              <span>
                Total Sales
              </span>

              <strong>
                {formatMoney(
                  financial.revenue
                )}
              </strong>
            </div>

            <div>
              <span>
                Gross Profit
              </span>

              <strong>
                {formatMoney(
                  financial.grossProfit
                )}
              </strong>
            </div>

          </div>

        </div>

        <div className="dashboard-panel quick-panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                QUICK ACTIONS
              </span>

              <h2>
                Move faster
              </h2>
            </div>

          </div>

          <div className="quick-action-list">

            <button
              type="button"
              onClick={
                onRecordSale
              }
              className="quick-action primary"
            >
              <span>＋</span>

              <div>
                <strong>
                  Record Sale
                </strong>

                <small>
                  Add a new transaction
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={
                onRecordExpense
              }
              className="quick-action"
            >
              <span>↓</span>

              <div>
                <strong>
                  Record Expense
                </strong>

                <small>
                  Track business spending
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={
                onAddProduct
              }
              className="quick-action"
            >
              <span>＋</span>

              <div>
                <strong>
                  Add Product
                </strong>

                <small>
                  Update your inventory
                </small>
              </div>

              <b>→</b>
            </button>

          </div>

        </div>

      </section>

      <section className="dashboard-bottom-grid">

        <div className="dashboard-panel recent-sales-panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                TRANSACTIONS
              </span>

              <h2>
                Recent Sales
              </h2>
            </div>

          </div>

          {recentSales.length === 0 ? (

            <div className="empty-dashboard-state">

              <div>＋</div>

              <strong>
                No sales recorded yet
              </strong>

              <span>
                Your latest transactions
                will appear here.
              </span>

            </div>

          ) : (

            <div className="recent-sales-list">

              {recentSales.map(
                (sale) => (

                  <div
                    className="recent-sale-row"
                    key={sale.id}
                  >

                    <div className="recent-sale-product">

                      <div className="recent-sale-avatar">
                        {(
                          sale.productName ||
                          "S"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>

                        <strong>
                          {sale.productName ||
                            "Sale"}
                        </strong>

                        <span>
                          {sale.quantity}{" "}
                          unit
                          {Number(
                            sale.quantity
                          ) !== 1
                            ? "s"
                            : ""}
                        </span>

                      </div>

                    </div>

                    <div className="recent-sale-value">

                      <strong>
                        {formatMoney(
                          sale.totalSelling
                        )}
                      </strong>

                      <span>
                        +
                        {formatMoney(
                          sale.grossProfit
                        )}
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>

        <div className="dashboard-panel health-panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                BUSINESS HEALTH
              </span>

              <h2>
                Overview
              </h2>
            </div>

          </div>

          <div className="health-score">

            <div className="health-ring">

              <span>
                {lowStock === 0 &&
                financial.netProfit >= 0 &&
                sales.length > 0
                  ? "GOOD"
                  : "WATCH"}
              </span>

            </div>

            <div>

              <strong>
                {lowStock === 0 &&
                financial.netProfit >= 0 &&
                sales.length > 0
                  ? "Business is healthy"
                  : "Needs attention"}
              </strong>

              <p>
                {lowStock > 0
                  ? `${lowStock} product${
                      lowStock > 1
                        ? "s"
                        : ""
                    } need${
                      lowStock === 1
                        ? "s"
                        : ""
                    } restocking.`
                  : "Inventory levels are looking good."}
              </p>

            </div>

          </div>

          <div className="health-metrics">

            <div>
              <span>
                Products
              </span>

              <strong>
                {products.length}
              </strong>
            </div>

            <div>
              <span>
                Low Stock
              </span>

              <strong>
                {lowStock}
              </strong>
            </div>

            <div>
              <span>
                Expenses
              </span>

              <strong>
                {formatMoney(
                  financial.expenses
                )}
              </strong>
            </div>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Dashboard;
