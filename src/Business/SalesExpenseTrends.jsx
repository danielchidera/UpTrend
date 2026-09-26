import "./SalesExpenseTrends.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";

const PERIODS = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
];

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const dateKey = (value) =>
  value ? String(value).slice(0, 10) : "";

const todayKey = () =>
  new Date().toISOString().slice(0, 10);

const getStartDate = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString().slice(0, 10);
};

const percentChange = (current, previous) => {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
};

const formatChange = (value) => {
  const rounded = Math.abs(value).toFixed(1);

  if (value > 0) return `+${rounded}%`;
  if (value < 0) return `−${rounded}%`;

  return "0%";
};

function SalesExpenseTrends({
  subscription,
  onUpgrade,
}) {
  const [period, setPeriod] = useState("30d");
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setSales([]);
        setExpenses([]);
        return;
      }

      const [salesResult, expensesResult] =
        await Promise.all([
          supabase
            .from("sales")
            .select("*")
            .eq("user_id", user.id)
            .order("sale_date", {
              ascending: true,
            })
            .order("created_at", {
              ascending: true,
            }),

          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .order("expense_date", {
              ascending: true,
            })
            .order("created_at", {
              ascending: true,
            }),
        ]);

      if (salesResult.error) {
        throw salesResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      setSales(salesResult.data || []);
      setExpenses(expensesResult.data || []);
    } catch (loadError) {
      console.error(
        "Sales and expense trends load failed:",
        loadError
      );

      setError(
        loadError?.message ||
          "Unable to load sales and expense trends."
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

  const analytics = useMemo(() => {
    const selectedPeriod =
      PERIODS.find(
        (item) => item.id === period
      ) || PERIODS[1];

    const currentStart =
      getStartDate(selectedPeriod.days);

    const currentEnd = todayKey();

    const previousEndDate = new Date(
      `${currentStart}T00:00:00`
    );

    previousEndDate.setDate(
      previousEndDate.getDate() - 1
    );

    const previousEnd =
      previousEndDate
        .toISOString()
        .slice(0, 10);

    const previousStartDate = new Date(
      `${previousEnd}T00:00:00`
    );

    previousStartDate.setDate(
      previousStartDate.getDate() -
        (selectedPeriod.days - 1)
    );

    const previousStart =
      previousStartDate
        .toISOString()
        .slice(0, 10);

    const currentSales = sales.filter((sale) => {
      const date = dateKey(sale.sale_date);
      return (
        date >= currentStart &&
        date <= currentEnd
      );
    });

    const currentExpenses = expenses.filter(
      (expense) => {
        const date = dateKey(
          expense.expense_date
        );

        return (
          date >= currentStart &&
          date <= currentEnd
        );
      }
    );

    const previousSales = sales.filter((sale) => {
      const date = dateKey(sale.sale_date);

      return (
        date >= previousStart &&
        date <= previousEnd
      );
    });

    const previousExpenses = expenses.filter(
      (expense) => {
        const date = dateKey(
          expense.expense_date
        );

        return (
          date >= previousStart &&
          date <= previousEnd
        );
      }
    );

    const sumSales = (rows) =>
      rows.reduce(
        (sum, sale) =>
          sum +
          Number(sale.total_selling || 0),
        0
      );

    const sumCost = (rows) =>
      rows.reduce(
        (sum, sale) =>
          sum +
          Number(sale.cost_price || 0) *
            Number(sale.quantity || 0),
        0
      );

    const sumProfit = (rows) =>
      rows.reduce(
        (sum, sale) =>
          sum +
          Number(sale.gross_profit || 0),
        0
      );

    const sumExpenses = (rows) =>
      rows.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const revenue = sumSales(currentSales);
    const productCost = sumCost(currentSales);
    const grossProfit = sumProfit(currentSales);
    const expenseTotal =
      sumExpenses(currentExpenses);

    const previousRevenue =
      sumSales(previousSales);

    const previousGrossProfit =
      sumProfit(previousSales);

    const previousExpenseTotal =
      sumExpenses(previousExpenses);

    const unitsSold = currentSales.reduce(
      (sum, sale) =>
        sum + Number(sale.quantity || 0),
      0
    );

    const previousUnitsSold =
      previousSales.reduce(
        (sum, sale) =>
          sum + Number(sale.quantity || 0),
        0
      );

    const netProfit = Math.max(
      grossProfit - expenseTotal,
      0
    );

    const previousNetProfit = Math.max(
      previousGrossProfit -
        previousExpenses,
      0
    );

    const dayMap = {};

    for (
      let index = 0;
      index < selectedPeriod.days;
      index += 1
    ) {
      const date = new Date(
        `${currentStart}T00:00:00`
      );

      date.setDate(
        date.getDate() + index
      );

      const key = date
        .toISOString()
        .slice(0, 10);

      dayMap[key] = {
        date: key,
        revenue: 0,
        expenses: 0,
        grossProfit: 0,
        units: 0,
      };
    }

    currentSales.forEach((sale) => {
      const key = dateKey(sale.sale_date);

      if (!dayMap[key]) return;

      dayMap[key].revenue += Number(
        sale.total_selling || 0
      );

      dayMap[key].grossProfit += Number(
        sale.gross_profit || 0
      );

      dayMap[key].units += Number(
        sale.quantity || 0
      );
    });

    currentExpenses.forEach((expense) => {
      const key = dateKey(
        expense.expense_date
      );

      if (!dayMap[key]) return;

      dayMap[key].expenses += Number(
        expense.amount || 0
      );
    });

    const daily = Object.values(dayMap);

    const chartMax = Math.max(
      1,
      ...daily.flatMap((day) => [
        day.revenue,
        day.expenses,
        day.grossProfit,
      ])
    );

    const highestSalesDay =
      daily.reduce(
        (best, day) =>
          day.revenue > best.revenue
            ? day
            : best,
        daily[0] || {
          date: "",
          revenue: 0,
        }
      );

    const highestExpenseDay =
      daily.reduce(
        (best, day) =>
          day.expenses > best.expenses
            ? day
            : best,
        daily[0] || {
          date: "",
          expenses: 0,
        }
      );

    const highestProfitDay =
      daily.reduce(
        (best, day) =>
          day.grossProfit >
          best.grossProfit
            ? day
            : best,
        daily[0] || {
          date: "",
          grossProfit: 0,
        }
      );

    const averageDailyRevenue =
      revenue / selectedPeriod.days;

    const averageDailyExpenses =
      expenseTotal / selectedPeriod.days;

    const grossMargin =
      revenue > 0
        ? (grossProfit / revenue) * 100
        : 0;

    return {
      periodLabel: selectedPeriod.label,
      daily,
      chartMax,

      revenue,
      productCost,
      grossProfit,
      expenses: expenseTotal,
      netProfit,
      unitsSold,

      previousRevenue,
      previousGrossProfit,
      previousExpenses: previousExpenseTotal,
      previousNetProfit,
      previousUnitsSold,

      revenueChange: percentChange(
        revenue,
        previousRevenue
      ),

      grossProfitChange: percentChange(
        grossProfit,
        previousGrossProfit
      ),

      expenseChange: percentChange(
        expenseTotal,
        previousExpenseTotal
      ),

      netProfitChange: percentChange(
        netProfit,
        previousNetProfit
      ),

      unitsChange: percentChange(
        unitsSold,
        previousUnitsSold
      ),

      grossMargin,
      averageDailyRevenue,
      averageDailyExpenses,

      highestSalesDay,
      highestExpenseDay,
      highestProfitDay,
    };
  }, [sales, expenses, period]);

  if (loading) {
    return (
      <div className="inner-page sales-trends-page">
        <div className="sales-trends-loading">
          <span />
          <strong>
            Building your business trends…
          </strong>
          <small>
            Analysing sales and expenses.
          </small>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inner-page sales-trends-page">
        <div className="sales-trends-error">
          <strong>
            Trends could not load.
          </strong>

          <small>{error}</small>

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

  return (
    <BusinessGate
      subscription={subscription}
      onUpgrade={onUpgrade}
      feature="Sales & Expense Trends"
    >
      <div className="inner-page sales-trends-page">

        <header className="sales-trends-header">
          <div>
            <div className="sales-trends-kicker">
              <span />
              BUSINESS PERFORMANCE
            </div>

            <h1>
              Sales & Expense Trends
            </h1>

            <p>
              See how revenue, expenses and
              gross profit are moving over time.
            </p>
          </div>

          <div className="sales-trends-periods">
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
          </div>
        </header>

        <section className="sales-trends-summary">
          <article className="trend-summary-card revenue">
            <span>REVENUE</span>

            <strong>
              {money(analytics.revenue)}
            </strong>

            <small>
              {formatChange(
                analytics.revenueChange
              )}{" "}
              vs previous period
            </small>
          </article>

          <article className="trend-summary-card expense">
            <span>EXPENSES</span>

            <strong>
              {money(analytics.expenses)}
            </strong>

            <small>
              {formatChange(
                analytics.expenseChange
              )}{" "}
              vs previous period
            </small>
          </article>

          <article className="trend-summary-card profit">
            <span>GROSS PROFIT</span>

            <strong>
              {money(analytics.grossProfit)}
            </strong>

            <small>
              {formatChange(
                analytics.grossProfitChange
              )}{" "}
              vs previous period
            </small>
          </article>

          <article className="trend-summary-card units">
            <span>UNITS SOLD</span>

            <strong>
              {analytics.unitsSold.toLocaleString(
                "en-NG"
              )}
            </strong>

            <small>
              {formatChange(
                analytics.unitsChange
              )}{" "}
              vs previous period
            </small>
          </article>
        </section>

        <section className="sales-trends-main-grid">

          <div className="sales-trends-panel trend-chart-panel">
            <div className="sales-trends-panel-heading">
              <div>
                <span>FINANCIAL MOVEMENT</span>
                <h2>
                  Revenue vs expenses
                </h2>
              </div>

              <div className="trend-legend">
                <span>
                  <i className="revenue-dot" />
                  Revenue
                </span>

                <span>
                  <i className="expense-dot" />
                  Expenses
                </span>

                <span>
                  <i className="profit-dot" />
                  Gross profit
                </span>
              </div>
            </div>

            <div className="sales-trends-chart">
              {analytics.daily.map((day) => (
                <div
                  className="sales-trend-day"
                  key={day.date}
                >
                  <div className="sales-trend-bars">
                    <div
                      className="trend-bar revenue"
                      style={{
                        height: `${Math.max(
                          day.revenue > 0
                            ? 3
                            : 0,
                          (day.revenue /
                            analytics.chartMax) *
                            100
                        )}%`,
                      }}
                      title={`Revenue: ${money(
                        day.revenue
                      )}`}
                    />

                    <div
                      className="trend-bar expense"
                      style={{
                        height: `${Math.max(
                          day.expenses > 0
                            ? 3
                            : 0,
                          (day.expenses /
                            analytics.chartMax) *
                            100
                        )}%`,
                      }}
                      title={`Expenses: ${money(
                        day.expenses
                      )}`}
                    />

                    <div
                      className="trend-bar profit"
                      style={{
                        height: `${Math.max(
                          day.grossProfit > 0
                            ? 3
                            : 0,
                          (day.grossProfit /
                            analytics.chartMax) *
                            100
                        )}%`,
                      }}
                      title={`Gross profit: ${money(
                        day.grossProfit
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
              ))}
            </div>
          </div>

          <div className="sales-trends-panel">
            <div className="sales-trends-panel-heading">
              <div>
                <span>PERFORMANCE SNAPSHOT</span>
                <h2>
                  What changed
                </h2>
              </div>
            </div>

            <div className="trend-change-list">
              <div>
                <span>Revenue</span>
                <strong>
                  {formatChange(
                    analytics.revenueChange
                  )}
                </strong>
              </div>

              <div>
                <span>Gross profit</span>
                <strong>
                  {formatChange(
                    analytics.grossProfitChange
                  )}
                </strong>
              </div>

              <div>
                <span>Expenses</span>
                <strong>
                  {formatChange(
                    analytics.expenseChange
                  )}
                </strong>
              </div>

              <div>
                <span>Net profit</span>
                <strong>
                  {formatChange(
                    analytics.netProfitChange
                  )}
                </strong>
              </div>

              <div>
                <span>Units sold</span>
                <strong>
                  {formatChange(
                    analytics.unitsChange
                  )}
                </strong>
              </div>
            </div>

            <div className="trend-margin-box">
              <span>GROSS MARGIN</span>
              <strong>
                {analytics.grossMargin.toFixed(
                  1
                )}
                %
              </strong>
            </div>
          </div>
        </section>

        <section className="sales-trends-secondary-grid">

          <div className="sales-trends-panel">
            <div className="sales-trends-panel-heading">
              <div>
                <span>SALES INTELLIGENCE</span>
                <h2>
                  Strongest sales day
                </h2>
              </div>
            </div>

            <div className="trend-highlight">
              <strong>
                {analytics.highestSalesDay
                  .revenue > 0
                  ? money(
                      analytics
                        .highestSalesDay
                        .revenue
                    )
                  : "₦0"}
              </strong>

              <span>
                {analytics.highestSalesDay
                  .date
                  ? new Date(
                      `${analytics.highestSalesDay.date}T00:00:00`
                    ).toLocaleDateString(
                      "en-NG",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }
                    )
                  : "No sales recorded"}
              </span>
            </div>

            <div className="trend-stat-row">
              <span>Average daily revenue</span>
              <strong>
                {money(
                  analytics.averageDailyRevenue
                )}
              </strong>
            </div>
          </div>

          <div className="sales-trends-panel">
            <div className="sales-trends-panel-heading">
              <div>
                <span>EXPENSE INTELLIGENCE</span>
                <h2>
                  Highest expense day
                </h2>
              </div>
            </div>

            <div className="trend-highlight expense-highlight">
              <strong>
                {analytics.highestExpenseDay
                  .expenses > 0
                  ? money(
                      analytics
                        .highestExpenseDay
                        .expenses
                    )
                  : "₦0"}
              </strong>

              <span>
                {analytics.highestExpenseDay
                  .date
                  ? new Date(
                      `${analytics.highestExpenseDay.date}T00:00:00`
                    ).toLocaleDateString(
                      "en-NG",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }
                    )
                  : "No expenses recorded"}
              </span>
            </div>

            <div className="trend-stat-row">
              <span>Average daily expenses</span>
              <strong>
                {money(
                  analytics.averageDailyExpenses
                )}
              </strong>
            </div>
          </div>

          <div className="sales-trends-panel">
            <div className="sales-trends-panel-heading">
              <div>
                <span>PROFIT INTELLIGENCE</span>
                <h2>
                  Strongest profit day
                </h2>
              </div>
            </div>

            <div className="trend-highlight profit-highlight">
              <strong>
                {analytics.highestProfitDay
                  .grossProfit > 0
                  ? money(
                      analytics
                        .highestProfitDay
                        .grossProfit
                    )
                  : "₦0"}
              </strong>

              <span>
                {analytics.highestProfitDay
                  .date
                  ? new Date(
                      `${analytics.highestProfitDay.date}T00:00:00`
                    ).toLocaleDateString(
                      "en-NG",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }
                    )
                  : "No profit recorded"}
              </span>
            </div>

            <div className="trend-stat-row">
              <span>Current net profit</span>
              <strong>
                {money(
                  analytics.netProfit
                )}
              </strong>
            </div>
          </div>

        </section>
      </div>
    </BusinessGate>
  );
}

export default SalesExpenseTrends;
