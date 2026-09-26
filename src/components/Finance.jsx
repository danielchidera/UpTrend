import "./Finance.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateFinancialSummary } from "../utils/financeStore";

const PERIODS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const dateKey = (value) => (value ? String(value).slice(0, 10) : "");
const todayKey = () => new Date().toISOString().slice(0, 10);

const startOfPeriod = (period) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "today") return today;

  const days = { "7d": 6, "30d": 29, "90d": 89 }[period];
  if (!days) return null;

  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
};

const inRange = (date, period) => {
  if (period === "all") return true;

  const start = startOfPeriod(period);
  if (!start) return true;

  const key = dateKey(date);

  return (
    key >= start.toISOString().slice(0, 10) &&
    key <= todayKey()
  );
};

const percent = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

function Finance() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [finance, setFinance] = useState({
    openingBalance: 0,
  });

  const [openingInput, setOpeningInput] = useState("");
  const [period, setPeriod] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setSales([]);
        setExpenses([]);
        setFinance({ openingBalance: 0 });
        setOpeningInput("");
        return;
      }

      const [salesResult, expensesResult, financeResult] =
        await Promise.all([
          supabase
            .from("sales")
            .select("*")
            .eq("user_id", user.id)
            .order("sale_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("finance_settings")
            .select("opening_balance")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (financeResult.error) throw financeResult.error;

      const mappedSales = (salesResult.data || []).map((sale) => ({
        id: sale.id,
        date: sale.sale_date,
        productId: sale.product_id || "",
        product: sale.product_name,
        productName: sale.product_name,
        quantity: Number(sale.quantity || 0),
        costPrice: Number(sale.cost_price || 0),
        totalCost:
          Number(sale.cost_price || 0) *
          Number(sale.quantity || 0),
        sellingPrice: Number(sale.selling_price || 0),
        totalSelling: Number(sale.total_selling || 0),
        grossProfit: Number(sale.gross_profit || 0),
        createdAt: sale.created_at,
      }));

      const mappedExpenses = (expensesResult.data || []).map(
        (expense) => ({
          id: expense.id,
          name: expense.name,
          amount: Number(expense.amount || 0),
          category: expense.category || "Uncategorized",
          note: expense.note || "",
          date: expense.expense_date,
          createdAt: expense.created_at,
        })
      );

      const openingBalance = Number(
        financeResult.data?.opening_balance || 0
      );

      setSales(mappedSales);
      setExpenses(mappedExpenses);
      setFinance({ openingBalance });

      setOpeningInput(
        openingBalance ? String(openingBalance) : ""
      );
    } catch (loadError) {
      console.error("Finance data load failed:", loadError);

      setError(
        loadError?.message ||
          "Unable to load financial data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData();

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleFocus);
    };
  }, []);

  const filteredData = useMemo(() => {
    if (period !== "custom") {
      return {
        sales: sales.filter((sale) =>
          inRange(sale.date, period)
        ),
        expenses: expenses.filter((expense) =>
          inRange(expense.date, period)
        ),
      };
    }

    const start = customStart || "0000-01-01";
    const end = customEnd || todayKey();

    return {
      sales: sales.filter((sale) => {
        const key = dateKey(sale.date);
        return key >= start && key <= end;
      }),
      expenses: expenses.filter((expense) => {
        const key = dateKey(expense.date);
        return key >= start && key <= end;
      }),
    };
  }, [
    sales,
    expenses,
    period,
    customStart,
    customEnd,
  ]);

  const financial = useMemo(
    () =>
      calculateFinancialSummary(
        filteredData.sales,
        filteredData.expenses,
        finance
      ),
    [
      filteredData.sales,
      filteredData.expenses,
      finance,
    ]
  );

  const displayedNetProfit = Math.max(
    Number(financial.grossProfit || 0) -
      Number(financial.expenses || 0),
    0
  );

  const remainingExpenses = Math.max(
    Number(financial.expenses || 0) -
      Number(financial.grossProfit || 0),
    0
  );

  const analytics = useMemo(() => {
    const revenue = filteredData.sales.reduce(
      (sum, sale) =>
        sum + Number(sale.totalSelling || 0),
      0
    );

    const productCost = filteredData.sales.reduce(
      (sum, sale) =>
        sum + Number(sale.totalCost || 0),
      0
    );

    const grossProfit = filteredData.sales.reduce(
      (sum, sale) =>
        sum + Number(sale.grossProfit || 0),
      0
    );

    const expensesTotal = filteredData.expenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0
    );

    const expenseCategories = {};

    filteredData.expenses.forEach((expense) => {
      const category =
        expense.category || "Uncategorized";

      expenseCategories[category] =
        (expenseCategories[category] || 0) +
        Number(expense.amount || 0);
    });

    const categoryRows = Object.entries(
      expenseCategories
    )
      .map(([name, amount]) => ({
        name,
        amount,
        share: percent(amount, expensesTotal),
      }))
      .sort((a, b) => b.amount - a.amount);

    const transactionCount =
      filteredData.sales.length;

    const unitsSold = filteredData.sales.reduce(
      (sum, sale) =>
        sum + Number(sale.quantity || 0),
      0
    );

    const grossMargin =
      revenue > 0
        ? (grossProfit / revenue) * 100
        : 0;

    const expenseRatio =
      revenue > 0
        ? (expensesTotal / revenue) * 100
        : 0;

    const netMargin =
      revenue > 0
        ? (displayedNetProfit / revenue) * 100
        : 0;

    const dayMap = {};

    filteredData.sales.forEach((sale) => {
      const key = dateKey(sale.date);

      if (!key) return;

      if (!dayMap[key]) {
        dayMap[key] = {
          date: key,
          revenue: 0,
          expenses: 0,
          grossProfit: 0,
        };
      }

      dayMap[key].revenue += Number(
        sale.totalSelling || 0
      );

      dayMap[key].grossProfit += Number(
        sale.grossProfit || 0
      );
    });

    filteredData.expenses.forEach((expense) => {
      const key = dateKey(expense.date);

      if (!key) return;

      if (!dayMap[key]) {
        dayMap[key] = {
          date: key,
          revenue: 0,
          expenses: 0,
          grossProfit: 0,
        };
      }

      dayMap[key].expenses += Number(
        expense.amount || 0
      );
    });

    const daily = Object.values(dayMap).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    const chartDays = daily.slice(-14);

    const chartMax = Math.max(
      1,
      ...chartDays.flatMap((day) => [
        day.revenue,
        day.expenses,
      ])
    );

    const recent = [
      ...filteredData.sales.map((sale) => ({
        id: `sale-${sale.id}`,
        type: "sale",
        label:
          sale.productName || "Sale",
        date: sale.date,
        amount: Number(
          sale.totalSelling || 0
        ),
        createdAt: sale.createdAt,
      })),

      ...filteredData.expenses.map(
        (expense) => ({
          id: `expense-${expense.id}`,
          type: "expense",
          label:
            expense.name ||
            expense.category ||
            "Expense",
          date: expense.date,
          amount: Number(
            expense.amount || 0
          ),
          createdAt: expense.createdAt,
        })
      ),
    ]
      .sort((a, b) => {
        const dateCompare =
          dateKey(b.date).localeCompare(
            dateKey(a.date)
          );

        if (dateCompare !== 0)
          return dateCompare;

        return String(
          b.createdAt || ""
        ).localeCompare(
          String(a.createdAt || "")
        );
      })
      .slice(0, 8);

    return {
      revenue,
      productCost,
      grossProfit,
      expenses: expensesTotal,
      transactionCount,
      unitsSold,
      categoryRows,
      grossMargin,
      expenseRatio,
      netMargin,
      chartDays,
      chartMax,
      recent,
    };
  }, [filteredData, displayedNetProfit]);

  const saveOpeningBalance = async (event) => {
    event.preventDefault();

    const amount = Number(openingInput);

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return;
    }

    try {
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error(
          "You must be signed in."
        );
      }

      const { error: saveError } =
        await supabase
          .from("finance_settings")
          .upsert(
            {
              user_id: user.id,
              opening_balance: amount,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "user_id",
            }
          );

      if (saveError) throw saveError;

      setFinance({
        openingBalance: amount,
      });

      setOpeningInput(String(amount));
    } catch (saveError) {
      console.error(
        "Opening balance save failed:",
        saveError
      );

      setError(
        saveError?.message ||
          "Unable to save opening balance."
      );
    }
  };

  const periodLabel = useMemo(() => {
    if (period === "custom") {
      if (customStart && customEnd) {
        return `${customStart} → ${customEnd}`;
      }

      return "Custom period";
    }

    return (
      PERIODS.find(
        (item) => item.id === period
      )?.label || "30 days"
    );
  }, [period, customStart, customEnd]);

  if (loading) {
    return (
      <div className="inner-page finance-page">
        <div className="finance-loading">
          <span className="finance-loading-dot" />

          <strong>
            Building your financial picture…
          </strong>

          <span>
            Loading sales, expenses and cash
            position.
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inner-page finance-page">
        <div className="finance-error">
          <strong>
            Finance could not load.
          </strong>

          <span>{error}</span>

          <button
            type="button"
            onClick={loadData}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const healthState =
    remainingExpenses > 0
      ? {
          label: "Expenses are ahead",
          tone: "warning",
          text: `${money(
            remainingExpenses
          )} of recorded expenses are not covered by gross profit in this period.`,
        }
      : displayedNetProfit > 0
      ? {
          label:
            "Positive operating position",
          tone: "positive",
          text: `${money(
            displayedNetProfit
          )} remains after recorded expenses.`,
        }
      : {
          label: "Break-even position",
          tone: "neutral",
          text:
            "Gross profit is currently fully absorbed by recorded expenses.",
        };

  return (
    <div className="inner-page finance-page">
      <header className="finance-header">
        <div>
          <div className="finance-kicker">
            <span />
            FINANCIAL CONTROL CENTER
          </div>

          <h1>Finance</h1>

          <p>
            See the movement of your money,
            understand your margins, and know
            the financial position of your
            business at a glance.
          </p>
        </div>

        <div className="finance-header-status">
          <span
            className={`finance-status-dot ${healthState.tone}`}
          />

          <div>
            <strong>
              {healthState.label}
            </strong>

            <span>{periodLabel}</span>
          </div>
        </div>
      </header>

      <section className="finance-command-bar">
        <div className="finance-period-title">
          <span>VIEWING</span>
          <strong>{periodLabel}</strong>
        </div>

        <div className="finance-periods">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                period === item.id
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(item.id)
              }
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            className={
              period === "custom"
                ? "active"
                : ""
            }
            onClick={() =>
              setPeriod("custom")
            }
          >
            Custom
          </button>
        </div>

        {period === "custom" && (
          <div className="finance-custom-dates">
            <input
              type="date"
              value={customStart}
              onChange={(event) =>
                setCustomStart(
                  event.target.value
                )
              }
            />

            <span>to</span>

            <input
              type="date"
              value={customEnd}
              onChange={(event) =>
                setCustomEnd(
                  event.target.value
                )
              }
            />
          </div>
        )}
      </section>

      <section className="finance-cash-hero">
        <div className="finance-cash-main">
          <div className="finance-card-label">
            CURRENT CASH AT HAND
          </div>

          <div className="finance-cash-number">
            {money(financial.cashAtHand)}
          </div>

          <p>
            Opening cash + money received from
            sales − recorded expenses.
          </p>

          <div className="finance-cash-meter">
            <div
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    4,
                    percent(
                      financial.cashAtHand,
                      Math.max(
                        financial.openingBalance +
                          financial.cashIn,
                        1
                      )
                    )
                  )
                )}%`,
              }}
            />
          </div>

          <span className="finance-meter-caption">
            Live calculated cash position
          </span>
        </div>

        <div className="finance-flow-stack">
          <div className="finance-flow-row">
            <span>
              <i className="finance-flow-icon opening">
                ○
              </i>
              Opening cash
            </span>

            <strong>
              {money(
                financial.openingBalance
              )}
            </strong>
          </div>

          <div className="finance-flow-row positive-flow">
            <span>
              <i className="finance-flow-icon in">
                ↑
              </i>
              Cash in
            </span>

            <strong>
              +{money(financial.cashIn)}
            </strong>
          </div>

          <div className="finance-flow-row negative-flow">
            <span>
              <i className="finance-flow-icon out">
                ↓
              </i>
              Cash out
            </span>

            <strong>
              −{money(financial.cashOut)}
            </strong>
          </div>

          <div className="finance-flow-total">
            <span>Closing cash</span>

            <strong>
              {money(
                financial.closingBalance
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="finance-kpi-grid">
        <article className="finance-kpi-card revenue">
          <span>Revenue</span>

          <strong>
            {money(analytics.revenue)}
          </strong>

          <small>
            {analytics.transactionCount} sales
            transactions
          </small>
        </article>

        <article className="finance-kpi-card cost">
          <span>Product Cost</span>

          <strong>
            {money(analytics.productCost)}
          </strong>

          <small>
            {analytics.unitsSold.toLocaleString(
              "en-NG"
            )}{" "}
            units sold
          </small>
        </article>

        <article className="finance-kpi-card profit">
          <span>Gross Profit</span>

          <strong>
            {money(analytics.grossProfit)}
          </strong>

          <small>
            {analytics.grossMargin.toFixed(
              1
            )}
            % gross margin
          </small>
        </article>

        <article className="finance-kpi-card expense">
          <span>Expenses</span>

          <strong>
            {money(analytics.expenses)}
          </strong>

          <small>
            {analytics.expenseRatio.toFixed(
              1
            )}
            % of revenue
          </small>
        </article>

        <article className="finance-kpi-card net">
          <span>Net Profit</span>

          <strong>
            {money(displayedNetProfit)}
          </strong>

          <small>
            {analytics.netMargin.toFixed(
              1
            )}
            % net margin
          </small>
        </article>

        <article
          className={`finance-kpi-card ${
            remainingExpenses > 0
              ? "danger"
              : "covered"
          }`}
        >
          <span>
            Expenses Not Covered
          </span>

          <strong>
            {money(remainingExpenses)}
          </strong>

          <small>
            {remainingExpenses > 0
              ? "Needs attention"
              : "Fully covered"}
          </small>
        </article>
      </section>

      <section className="finance-main-grid">
        <div className="finance-panel finance-trend-panel">
          <div className="finance-panel-heading">
            <div>
              <span>
                FINANCIAL MOVEMENT
              </span>

              <h2>
                Revenue vs expenses
              </h2>
            </div>

            <div className="finance-legend">
              <span>
                <i className="legend-revenue" />
                Revenue
              </span>

              <span>
                <i className="legend-expense" />
                Expenses
              </span>
            </div>
          </div>

          <div className="finance-chart">
            {analytics.chartDays.length ===
            0 ? (
              <div className="finance-empty-chart">
                No financial movement in this
                period.
              </div>
            ) : (
              analytics.chartDays.map((day) => (
                <div
                  className="finance-chart-day"
                  key={day.date}
                >
                  <div className="finance-bars">
                    <div
                      className="finance-bar revenue-bar"
                      style={{
                        height: `${Math.max(
                          4,
                          (day.revenue /
                            analytics.chartMax) *
                            100
                        )}%`,
                      }}
                      title={`Revenue ${money(
                        day.revenue
                      )}`}
                    />

                    <div
                      className="finance-bar expense-bar"
                      style={{
                        height: `${Math.max(
                          4,
                          (day.expenses /
                            analytics.chartMax) *
                            100
                        )}%`,
                      }}
                      title={`Expenses ${money(
                        day.expenses
                      )}`}
                    />
                  </div>

                  <span>
                    {new Date(
                      `${day.date}T00:00:00`
                    ).toLocaleDateString(
                      "en-NG",
                      {
                        day: "2-digit",
                        month: "short",
                      }
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="finance-panel finance-health-panel">
          <div className="finance-panel-heading">
            <div>
              <span>
                FINANCIAL HEALTH
              </span>

              <h2>
                What the numbers say
              </h2>
            </div>
          </div>

          <div
            className={`finance-health-callout ${healthState.tone}`}
          >
            <div className="finance-health-symbol">
              {healthState.tone ===
              "positive"
                ? "✓"
                : healthState.tone ===
                  "warning"
                ? "!"
                : "•"}
            </div>

            <div>
              <strong>
                {healthState.label}
              </strong>

              <p>
                {healthState.text}
              </p>
            </div>
          </div>

          <div className="finance-health-list">
            <div>
              <span>Gross margin</span>

              <strong>
                {analytics.grossMargin.toFixed(
                  1
                )}
                %
              </strong>

              <em>
                Revenue kept after product
                cost
              </em>
            </div>

            <div>
              <span>Expense ratio</span>

              <strong>
                {analytics.expenseRatio.toFixed(
                  1
                )}
                %
              </strong>

              <em>
                Revenue consumed by expenses
              </em>
            </div>

            <div>
              <span>Net margin</span>

              <strong>
                {analytics.netMargin.toFixed(
                  1
                )}
                %
              </strong>

              <em>
                Profit remaining after
                expenses
              </em>
            </div>
          </div>
        </div>
      </section>

      <section className="finance-main-grid lower">
        <div className="finance-panel">
          <div className="finance-panel-heading">
            <div>
              <span>
                EXPENSE INTELLIGENCE
              </span>

              <h2>
                Where your money is going
              </h2>
            </div>

            <strong className="finance-panel-total">
              {money(analytics.expenses)}
            </strong>
          </div>

          <div className="finance-category-list">
            {analytics.categoryRows.length ===
            0 ? (
              <div className="finance-empty">
                No expenses recorded in this
                period.
              </div>
            ) : (
              analytics.categoryRows
                .slice(0, 6)
                .map((row) => (
                  <div
                    className="finance-category-row"
                    key={row.name}
                  >
                    <div className="finance-category-top">
                      <span>{row.name}</span>

                      <strong>
                        {money(row.amount)}
                      </strong>
                    </div>

                    <div className="finance-progress">
                      <div
                        style={{
                          width: `${row.share}%`,
                        }}
                      />
                    </div>

                    <small>
                      {row.share}% of total
                      expenses
                    </small>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="finance-panel">
          <div className="finance-panel-heading">
            <div>
              <span>
                RECENT ACTIVITY
              </span>

              <h2>
                Latest money movement
              </h2>
            </div>
          </div>

          <div className="finance-activity-list">
            {analytics.recent.length ===
            0 ? (
              <div className="finance-empty">
                No activity recorded in this
                period.
              </div>
            ) : (
              analytics.recent.map((item) => (
                <div
                  className="finance-activity-row"
                  key={item.id}
                >
                  <div
                    className={`finance-activity-icon ${item.type}`}
                  >
                    {item.type === "sale"
                      ? "↑"
                      : "↓"}
                  </div>

                  <div className="finance-activity-info">
                    <strong>
                      {item.label}
                    </strong>

                    <span>
                      {item.date ||
                        "No date"}
                    </span>
                  </div>

                  <strong
                    className={
                      item.type === "sale"
                        ? "activity-in"
                        : "activity-out"
                    }
                  >
                    {item.type === "sale"
                      ? "+"
                      : "−"}
                    {money(item.amount)}
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="finance-panel finance-position-panel">
        <div className="finance-panel-heading">
          <div>
            <span>CARRY FORWARD</span>

            <h2>
              Opening → movement → closing
            </h2>
          </div>

          <div className="finance-position-badge">
            {periodLabel}
          </div>
        </div>

        <div className="finance-position-flow">
          <div>
            <span>Opening balance</span>

            <strong>
              {money(
                financial.openingBalance
              )}
            </strong>

            <small>
              Starting cash
            </small>
          </div>

          <b>+</b>

          <div>
            <span>Cash in</span>

            <strong>
              {money(financial.cashIn)}
            </strong>

            <small>
              Recorded sales receipts
            </small>
          </div>

          <b>−</b>

          <div>
            <span>Cash out</span>

            <strong>
              {money(financial.cashOut)}
            </strong>

            <small>
              Recorded expenses
            </small>
          </div>

          <b>=</b>

          <div className="closing">
            <span>Closing cash</span>

            <strong>
              {money(
                financial.closingBalance
              )}
            </strong>

            <small>
              Next period starting position
            </small>
          </div>
        </div>
      </section>

      <section className="finance-opening-panel">
        <div>
          <span className="finance-kicker">
            <span />
            STARTING POSITION
          </span>

          <h2>
            Set your opening business cash
          </h2>

          <p>
            Use this when you begin tracking a
            business that already has cash
            available. It becomes the starting
            point for your cash position.
          </p>
        </div>

        <form onSubmit={saveOpeningBalance}>
          <label htmlFor="finance-opening">
            Opening cash
          </label>

          <div className="finance-opening-input-row">
            <span>₦</span>

            <input
              id="finance-opening"
              type="number"
              min="0"
              step="0.01"
              value={openingInput}
              onChange={(event) =>
                setOpeningInput(
                  event.target.value
                )
              }
              placeholder="50000"
            />

            <button type="submit">
              Save balance
            </button>
          </div>

          <small>
            Current saved opening balance:{" "}
            {money(
              financial.openingBalance
            )}
          </small>
        </form>
      </section>
    </div>
  );
}

export default Finance;
