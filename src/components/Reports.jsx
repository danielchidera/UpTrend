import "./Reports.css";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import ReportExportTools from "../Business/ReportExportTools";

import {
  calculateFinancialSummary,
} from "../utils/financeStore";

function getLocalDateKey(date) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return getLocalDateKey(
    new Date()
  );
}

function getDateDaysAgo(days) {
  const date = new Date();

  date.setDate(
    date.getDate() - days
  );

  return getLocalDateKey(date);
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function Reports({
  subscription,
}) {
  const [sales, setSales] =
    useState([]);

  const [expenses, setExpenses] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [finance, setFinance] =
    useState({
      openingBalance: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [period, setPeriod] =
    useState("30days");

  const [startDate, setStartDate] =
    useState(
      getDateDaysAgo(29)
    );

  const [endDate, setEndDate] =
    useState(getToday());

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
        setExpenses([]);
        setProducts([]);
        setFinance({
          openingBalance: 0,
        });
        return;
      }

      const [
        salesResult,
        expensesResult,
        productsResult,
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
          .from("products")
          .select("*")
          .eq("user_id", user.id)
          .order("name", {
            ascending: true,
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

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
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

      const openingBalance =
        Number(
          financeResult.data
            ?.opening_balance || 0
        );

      setSales(mappedSales);

      setExpenses(mappedExpenses);

      setProducts(mappedProducts);

      setFinance({
        openingBalance,
      });
    } catch (loadError) {
      console.error(
        "Reports data load failed:",
        loadError
      );

      setError(
        loadError?.message ||
          "Unable to load report data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleFocus = () => {
      loadData();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "storage",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "storage",
        handleFocus
      );
    };
  }, []);

  const filteredSales =
    useMemo(
      () =>
        sales.filter(
          (sale) =>
            sale.date >=
              startDate &&
            sale.date <=
              endDate
        ),
      [
        sales,
        startDate,
        endDate,
      ]
    );

  const filteredExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            expense.date >=
              startDate &&
            expense.date <=
              endDate
        ),
      [
        expenses,
        startDate,
        endDate,
      ]
    );

  const totals = useMemo(
    () =>
      calculateFinancialSummary(
        filteredSales,
        filteredExpenses,
        {
          openingBalance: 0,
        }
      ),
    [
      filteredSales,
      filteredExpenses,
    ]
  );

  const reportNetProfit =
    Number(
      totals.netProfit || 0
    );

  const remainingExpenses =
    Number(
      totals.remainingExpenses || 0
    );

  const overallFinancial =
    useMemo(
      () =>
        calculateFinancialSummary(
          sales,
          expenses,
          finance
        ),
      [
        sales,
        expenses,
        finance,
      ]
    );

  const productPerformance =
    useMemo(() => {
      const map = {};

      filteredSales.forEach(
        (sale) => {
          const id =
            sale.productId ||
            sale.product ||
            sale.productName;

          if (!map[id]) {
            map[id] = {
              name:
                sale.productName ||
                sale.product ||
                "Product",

              units: 0,

              revenue: 0,

              profit: 0,
            };
          }

          map[id].units +=
            Number(
              sale.quantity || 0
            );

          map[id].revenue +=
            Number(
              sale.totalSelling ||
                0
            );

          map[id].profit +=
            Number(
              sale.grossProfit ||
                0
            );
        }
      );

      return Object.values(map).sort(
        (a, b) =>
          b.units - a.units
      );
    }, [filteredSales]);

  const bestSeller =
    productPerformance[0];

  const slowProducts =
    products
      .filter((product) => {
        const sold =
          productPerformance.find(
            (item) =>
              item.name ===
              product.name
          );

        return (
          !sold ||
          sold.units <= 2
        );
      })
      .slice(0, 5);

  const dailyPerformance =
    useMemo(() => {
      const days = [];

      const start =
        new Date(
          `${startDate}T00:00:00`
        );

      const end =
        new Date(
          `${endDate}T00:00:00`
        );

      const cursor =
        new Date(start);

      while (
        cursor <= end
      ) {
        const date =
          getLocalDateKey(
            cursor
          );

        const daySales =
          filteredSales
            .filter(
              (sale) =>
                sale.date ===
                date
            )
            .reduce(
              (sum, sale) =>
                sum +
                Number(
                  sale.totalSelling ||
                    0
                ),
              0
            );

        days.push({
          date,
          value: daySales,
        });

        cursor.setDate(
          cursor.getDate() + 1
        );
      }

      return days.slice(-14);
    }, [
      filteredSales,
      startDate,
      endDate,
    ]);

  const maxDailySales =
    Math.max(
      ...dailyPerformance.map(
        (day) => day.value
      ),
      1
    );

  /* =====================================================
     ADVANCED REPORTS ANALYTICS
  ===================================================== */

  const selectedPeriodDays =
    Math.max(
      Math.round(
        (
          new Date(`${endDate}T00:00:00`) -
          new Date(`${startDate}T00:00:00`)
        ) / 86400000
      ) + 1,
      1
    );

  const previousEndDate =
    shiftDateKey(startDate, -1);

  const previousStartDate =
    shiftDateKey(
      startDate,
      -selectedPeriodDays
    );

  const previousSales =
    useMemo(
      () =>
        sales.filter(
          (sale) =>
            sale.date >= previousStartDate &&
            sale.date <= previousEndDate
        ),
      [
        sales,
        previousStartDate,
        previousEndDate,
      ]
    );

  const previousExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            expense.date >= previousStartDate &&
            expense.date <= previousEndDate
        ),
      [
        expenses,
        previousStartDate,
        previousEndDate,
      ]
    );

  const previousTotals =
    useMemo(
      () =>
        calculateFinancialSummary(
          previousSales,
          previousExpenses,
          {
            openingBalance: 0,
          }
        ),
      [
        previousSales,
        previousExpenses,
      ]
    );

  const currentUnits =
    filteredSales.reduce(
      (sum, sale) =>
        sum +
        Number(sale.quantity || 0),
      0
    );

  const previousUnits =
    previousSales.reduce(
      (sum, sale) =>
        sum +
        Number(sale.quantity || 0),
      0
    );

  const getPercentageChange =
    (current, previous) => {
      const currentValue =
        Number(current || 0);

      const previousValue =
        Number(previous || 0);

      if (previousValue === 0) {
        if (currentValue === 0) {
          return 0;
        }

        return 100;
      }

      return (
        ((currentValue - previousValue) /
          Math.abs(previousValue)) *
        100
      );
    };

  const revenueChange =
    getPercentageChange(
      totals.revenue,
      previousTotals.revenue
    );

  const grossProfitChange =
    getPercentageChange(
      totals.grossProfit,
      previousTotals.grossProfit
    );

  const expenseChange =
    getPercentageChange(
      totals.expenses,
      previousTotals.expenses
    );

  const unitsChange =
    getPercentageChange(
      currentUnits,
      previousUnits
    );

  const averageTransactionValue =
    filteredSales.length > 0
      ? totals.revenue /
        filteredSales.length
      : 0;

  const averageUnitsPerSale =
    filteredSales.length > 0
      ? currentUnits /
        filteredSales.length
      : 0;

  const productProfitability =
    useMemo(
      () =>
        [...productPerformance]
          .map((product) => ({
            ...product,
            margin:
              product.revenue > 0
                ? (
                    product.profit /
                    product.revenue
                  ) * 100
                : 0,
          }))
          .sort(
            (a, b) =>
              b.profit - a.profit
          ),
      [productPerformance]
    );

  const topRevenueProduct =
    [...productPerformance].sort(
      (a, b) =>
        b.revenue - a.revenue
    )[0];

  const topProfitProduct =
    [...productPerformance].sort(
      (a, b) =>
        b.profit - a.profit
    )[0];

  const lowMarginProducts =
    [...productProfitability]
      .filter(
        (product) =>
          product.revenue > 0
      )
      .sort(
        (a, b) =>
          a.margin - b.margin
      )
      .slice(0, 5);

  const expenseAnalysis =
    useMemo(() => {
      const categoryMap = {};

      filteredExpenses.forEach(
        (expense) => {
          const category =
            expense.category ||
            "Uncategorized";

          categoryMap[category] =
            (categoryMap[category] || 0) +
            Number(expense.amount || 0);
        }
      );

      const categories =
        Object.entries(
          categoryMap
        )
          .map(
            ([name, amount]) => ({
              name,
              amount,
            })
          )
          .sort(
            (a, b) =>
              b.amount - a.amount
          );

      return {
        categories,
        largestCategory:
          categories[0] || null,
        expenseRatio:
          totals.revenue > 0
            ? (
                totals.expenses /
                totals.revenue
              ) * 100
            : 0,
      };
    }, [
      filteredExpenses,
      totals.revenue,
      totals.expenses,
    ]);

  const inventoryAnalysis =
    useMemo(() => {
      const inventoryValue =
        products.reduce(
          (sum, product) =>
            sum +
            Number(product.stock || 0) *
              Number(
                product.costPrice || 0
              ),
          0
        );

      const lowStock =
        products.filter(
          (product) =>
            Number(product.stock || 0) <=
            Number(
              product.lowStockAt || 0
            )
        );

      const slowMoving =
        products.filter(
          (product) => {
            const sold =
              productPerformance.find(
                (item) =>
                  item.name ===
                  product.name
              );

            return (
              !sold ||
              Number(sold.units || 0) <=
                2
            );
          }
        );

      return {
        inventoryValue,
        totalUnits:
          products.reduce(
            (sum, product) =>
              sum +
              Number(
                product.stock || 0
              ),
            0
          ),
        lowStock,
        slowMoving,
      };
    }, [
      products,
      productPerformance,
    ]);

  const dailyFinancialPerformance =
    useMemo(() => {
      const days = [];

      const start =
        new Date(
          `${startDate}T00:00:00`
        );

      const end =
        new Date(
          `${endDate}T00:00:00`
        );

      const cursor =
        new Date(start);

      while (cursor <= end) {
        const date =
          getLocalDateKey(cursor);

        const daySales =
          filteredSales.filter(
            (sale) =>
              sale.date === date
          );

        const dayExpenses =
          filteredExpenses.filter(
            (expense) =>
              expense.date === date
          );

        const revenue =
          daySales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.totalSelling || 0
              ),
            0
          );

        const grossProfit =
          daySales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.grossProfit || 0
              ),
            0
          );

        const expensesValue =
          dayExpenses.reduce(
            (sum, expense) =>
              sum +
              Number(
                expense.amount || 0
              ),
            0
          );

        days.push({
          date,
          revenue,
          grossProfit,
          expenses:
            expensesValue,
          netResult:
            grossProfit -
            expensesValue,
        });

        cursor.setDate(
          cursor.getDate() + 1
        );
      }

      return days.slice(-14);
    }, [
      filteredSales,
      filteredExpenses,
      startDate,
      endDate,
    ]);

  const formatChange =
    (value) => {
      const number =
        Number(value || 0);

      if (!Number.isFinite(number)) {
        return "0.0%";
      }

      return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
    };

  const changeClass =
    (value) =>
      Number(value || 0) >= 0
        ? "comparison-positive"
        : "comparison-negative";

  const formatMoney =
    (value) =>
      `₦${Number(
        value || 0
      ).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }
      )}`;

  const applyPeriod =
    (value) => {
      setPeriod(value);

      const today =
        getToday();

      if (
        value === "7days"
      ) {
        setStartDate(
          getDateDaysAgo(6)
        );

        setEndDate(today);
      }

      if (
        value === "30days"
      ) {
        setStartDate(
          getDateDaysAgo(29)
        );

        setEndDate(today);
      }

      if (
        value === "90days"
      ) {
        setStartDate(
          getDateDaysAgo(89)
        );

        setEndDate(today);
      }
    };

  if (loading) {
    return (
      <div className="reports-page">
        <div className="premium-card report-no-data">
          Loading reports...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-page">
        <div className="premium-card report-no-data">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">

      <div className="reports-page-top">

        <div>

          <div className="mini-label">
            BUSINESS INTELLIGENCE
          </div>

          <h2>
            Reports
          </h2>

          <p>
            Understand your revenue,
            profit, expenses and
            product performance.
          </p>

        </div>

      </div>

      <section className="report-period-card premium-card">

        <div className="report-period-buttons">

          <button
            className={
              period ===
              "7days"
                ? "active"
                : ""
            }
            onClick={() =>
              applyPeriod(
                "7days"
              )
            }
          >
            7 Days
          </button>

          <button
            className={
              period ===
              "30days"
                ? "active"
                : ""
            }
            onClick={() =>
              applyPeriod(
                "30days"
              )
            }
          >
            30 Days
          </button>

          <button
            className={
              period ===
              "90days"
                ? "active"
                : ""
            }
            onClick={() =>
              applyPeriod(
                "90days"
              )
            }
          >
            90 Days
          </button>

          <button
            className={
              period ===
              "custom"
                ? "active"
                : ""
            }
            onClick={() =>
              setPeriod(
                "custom"
              )
            }
          >
            Custom
          </button>

        </div>

        <div className="report-custom-dates">

          <label>

            <span>
              From
            </span>

            <input
              type="date"
              value={
                startDate
              }
              onChange={(
                event
              ) => {
                setPeriod(
                  "custom"
                );

                setStartDate(
                  event.target
                    .value
                );
              }}
            />

          </label>

          <label>

            <span>
              To
            </span>

            <input
              type="date"
              value={
                endDate
              }
              onChange={(
                event
              ) => {
                setPeriod(
                  "custom"
                );

                setEndDate(
                  event.target
                    .value
                );
              }}
            />

          </label>

        </div>

      </section>

      <section className="report-kpi-grid">

        <div className="report-kpi premium-card">

          <span>
            REVENUE
          </span>

          <strong>
            {formatMoney(
              totals.revenue
            )}
          </strong>

          <small>
            Total sales value
          </small>

        </div>

        <div className="report-kpi premium-card">

          <span>
            GROSS PROFIT
          </span>

          <strong className="record-profit">
            {totals.grossProfit >=
            0
              ? "+"
              : "-"}

            {formatMoney(
              Math.abs(
                totals.grossProfit
              )
            )}
          </strong>

          <small>
            Revenue minus product
            cost
          </small>

        </div>

        <div className="report-kpi premium-card">

          <span>
            EXPENSES
          </span>

          <strong className="expense-report-value">
            {formatMoney(
              totals.expenses
            )}
          </strong>

          <small>
            Business operating
            costs
          </small>

        </div>

        <div className="report-kpi premium-card">

          <span>
            NET PROFIT
          </span>

          <strong
            className={
              reportNetProfit > 0
                ? "record-profit"
                : reportNetProfit < 0
                  ? "record-loss"
                  : ""
            }
          >
            {reportNetProfit > 0
              ? "+ "
              : reportNetProfit < 0
                ? "- "
                : ""}

            {formatMoney(
              Math.abs(reportNetProfit)
            )}
          </strong>

          <small>
            Gross profit after expenses
          </small>

        </div>

      </section>

      <div className="reports-main-grid">

        <section className="report-chart-card premium-card">

          <div className="panel-heading">

            <div>

              <div className="mini-label">
                SALES TREND
              </div>

              <h2>
                Revenue performance
              </h2>

            </div>

            <span className="report-range-label">
              {startDate} →{" "}
              {endDate}
            </span>

          </div>

          <div className="report-bars">

            {dailyPerformance.length ===
            0 ? (

              <div className="report-no-data">
                No sales data for
                this period.
              </div>

            ) : (

              dailyPerformance.map(
                (day) => {
                  const height =
                    Math.max(
                      (day.value /
                        maxDailySales) *
                        100,
                      day.value
                        ? 4
                        : 1
                    );

                  return (
                    <div
                      className="report-bar-column"
                      key={
                        day.date
                      }
                    >

                      <div className="report-bar-value">
                        {day.value
                          ? formatMoney(
                              day.value
                            )
                          : ""}
                      </div>

                      <div className="report-bar-track">

                        <div
                          className="report-bar"
                          style={{
                            height:
                              `${height}%`,
                          }}
                        />

                      </div>

                      <span>
                        {day.date.slice(
                          5
                        )}
                      </span>

                    </div>
                  );
                }
              )
            )}

          </div>

        </section>

        <section className="report-summary-card premium-card">

          <div className="panel-heading">

            <div>

              <div className="mini-label">
                PROFITABILITY
              </div>

              <h2>
                Financial summary
              </h2>

            </div>

          </div>

          <div className="report-summary-lines">

            <div>
              <span>
                Revenue
              </span>

              <strong>
                {formatMoney(
                  totals.revenue
                )}
              </strong>
            </div>

            <div>
              <span>
                Product cost
              </span>

              <strong>
                -{" "}
                {formatMoney(
                  totals.productCost
                )}
              </strong>
            </div>

            <div>
              <span>
                Gross profit
              </span>

              <strong className="record-profit">
                +{" "}
                {formatMoney(
                  totals.grossProfit
                )}
              </strong>
            </div>

            <div>
              <span>
                Expenses
              </span>

              <strong className="expense-report-value">
                -{" "}
                {formatMoney(
                  totals.expenses
                )}
              </strong>
            </div>

            <div className="report-remaining-line">

              <span>
                Remaining expenses
              </span>

              <strong
                className={
                  remainingExpenses > 0
                    ? "record-loss"
                    : "record-profit"
                }
              >
                {remainingExpenses > 0
                  ? "- "
                  : ""}

                {formatMoney(
                  remainingExpenses
                )}
              </strong>

            </div>

            <div className="report-net-line">

              <span>
                Net profit
              </span>

              <strong
                className={
                  reportNetProfit > 0
                    ? "record-profit"
                    : reportNetProfit < 0
                      ? "record-loss"
                      : ""
                }
              >
                {reportNetProfit > 0
                  ? "+ "
                  : reportNetProfit < 0
                    ? "- "
                    : ""}

                {formatMoney(
                  Math.abs(reportNetProfit)
                )}
              </strong>

            </div>

          </div>

          <div className="report-margin">

            <div>

              <span>
                Gross margin
              </span>

              <strong>
                {(
                  totals.revenue >
                  0
                    ? (
                        totals.grossProfit /
                        totals.revenue
                      ) *
                      100
                    : 0
                ).toFixed(1)}
                %
              </strong>

            </div>

            <div className="report-margin-track">

              <div
                style={{
                  width: `${
                    Math.min(
                      Math.max(
                        totals.revenue >
                          0
                          ? (
                              totals.grossProfit /
                              totals.revenue
                            ) *
                            100
                          : 0,
                        0
                      ),
                      100
                    )
                  }%`,
                }}
              />

            </div>

          </div>

        </section>

      </div>

      <div className="reports-performance-grid">

        <section className="report-products-card premium-card">

          <div className="panel-heading">

            <div>

              <div className="mini-label">
                PRODUCT PERFORMANCE
              </div>

              <h2>
                Best-selling products
              </h2>

            </div>

          </div>

          {productPerformance.length ===
          0 ? (

            <div className="report-no-data">
              No product sales in
              this period.
            </div>

          ) : (

            <div className="report-product-list">

              {productPerformance
                .slice(0, 5)
                .map(
                  (
                    product,
                    index
                  ) => (

                    <div
                      className="report-product-row"
                      key={
                        product.name
                      }
                    >

                      <div className="report-rank">
                        {index + 1}
                      </div>

                      <div className="report-product-name">

                        <strong>
                          {
                            product.name
                          }
                        </strong>

                        <span>
                          {
                            product.units
                          }{" "}
                          units sold
                        </span>

                      </div>

                      <div className="report-product-money">

                        <strong>
                          {formatMoney(
                            product.revenue
                          )}
                        </strong>

                        <span>
                          +
                          {formatMoney(
                            product.profit
                          )}{" "}
                          profit
                        </span>

                      </div>

                    </div>

                  )
                )}

            </div>

          )}

        </section>

        <section className="report-insights-card premium-card">

          <div className="panel-heading">

            <div>

              <div className="mini-label">
                BUSINESS INSIGHTS
              </div>

              <h2>
                What to watch
              </h2>

            </div>

          </div>

          <div className="report-insight-list">

            <div className="report-insight">

              <div className="report-insight-icon">
                ↑
              </div>

              <div>

                <strong>
                  Top performer
                </strong>

                <p>
                  {bestSeller
                    ? `${bestSeller.name} is your best-selling product with ${bestSeller.units} units sold.`
                    : "Record sales to identify your best-performing product."}
                </p>

              </div>

            </div>

            <div className="report-insight">

              <div className="report-insight-icon">
                ₦
              </div>

              <div>

                <strong>
                  Profit margin
                </strong>

                <p>
                  Your current gross
                  margin is{" "}
                  {(
                    totals.revenue >
                    0
                      ? (
                          totals.grossProfit /
                          totals.revenue
                        ) *
                        100
                      : 0
                  ).toFixed(1)}
                  % for this period.
                </p>

              </div>

            </div>

            <div className="report-insight">

              <div className="report-insight-icon warning">
                !
              </div>

              <div>

                <strong>
                  Slow-moving stock
                </strong>

                <p>
                  {slowProducts.length
                    ? slowProducts
                        .map(
                          (
                            product
                          ) =>
                            product.name
                        )
                        .join(
                          ", "
                        )
                    : "No slow-moving products identified."}
                </p>

              </div>

            </div>

            <div className="report-insight">

              <div className="report-insight-icon">
                ₦
              </div>

              <div>

                <strong>
                  Current cash
                </strong>

                <p>
                  Current tracked
                  cash position is{" "}
                  {formatMoney(
                    overallFinancial.cashAtHand
                  )}.
                </p>

              </div>

            </div>

          </div>

        </section>

      </div>


      {/* =================================================
          ADVANCED REPORTS
      ================================================= */}

      <section className="advanced-report-section">

        <div className="advanced-section-heading">
          <div>
            <div className="mini-label">
              ADVANCED ANALYSIS
            </div>

            <h2>
              Deeper business performance
            </h2>

            <p>
              Compare periods, understand profitability,
              monitor expenses and connect performance
              with inventory.
            </p>
          </div>
        </div>

        <div className="advanced-report-grid">

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  PERIOD COMPARISON
                </div>

                <h3>
                  Current vs previous period
                </h3>
              </div>

              <span>
                {previousStartDate} → {previousEndDate}
              </span>
            </div>

            <div className="advanced-metric-grid">

              <article>
                <span>REVENUE</span>
                <strong>
                  {formatChange(
                    revenueChange
                  )}
                </strong>
                <small>
                  {formatMoney(
                    previousTotals.revenue
                  )} previous
                </small>
              </article>

              <article>
                <span>GROSS PROFIT</span>
                <strong>
                  {formatChange(
                    grossProfitChange
                  )}
                </strong>
                <small>
                  {formatMoney(
                    previousTotals.grossProfit
                  )} previous
                </small>
              </article>

              <article>
                <span>EXPENSES</span>
                <strong
                  className={
                    changeClass(
                      expenseChange
                    )
                  }
                >
                  {formatChange(
                    expenseChange
                  )}
                </strong>
                <small>
                  {formatMoney(
                    previousTotals.expenses
                  )} previous
                </small>
              </article>

              <article>
                <span>UNITS SOLD</span>
                <strong>
                  {formatChange(
                    unitsChange
                  )}
                </strong>
                <small>
                  {previousUnits.toLocaleString(
                    "en-NG"
                  )} previous
                </small>
              </article>

            </div>

          </section>

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  SALES ANALYSIS
                </div>

                <h3>
                  Transaction performance
                </h3>
              </div>
            </div>

            <div className="advanced-stat-list">

              <div>
                <span>Transactions</span>
                <strong>
                  {filteredSales.length.toLocaleString(
                    "en-NG"
                  )}
                </strong>
              </div>

              <div>
                <span>Units sold</span>
                <strong>
                  {currentUnits.toLocaleString(
                    "en-NG"
                  )}
                </strong>
              </div>

              <div>
                <span>Average transaction</span>
                <strong>
                  {formatMoney(
                    averageTransactionValue
                  )}
                </strong>
              </div>

              <div>
                <span>Average units / sale</span>
                <strong>
                  {averageUnitsPerSale.toFixed(
                    1
                  )}
                </strong>
              </div>

              <div>
                <span>Product cost</span>
                <strong>
                  {formatMoney(
                    totals.productCost
                  )}
                </strong>
              </div>

              <div>
                <span>Gross margin</span>
                <strong>
                  {(
                    totals.revenue > 0
                      ? (
                          totals.grossProfit /
                          totals.revenue
                        ) * 100
                      : 0
                  ).toFixed(1)}%
                </strong>
              </div>

            </div>

          </section>

        </div>

        <div className="advanced-report-grid">

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  PRODUCT PROFITABILITY
                </div>

                <h3>
                  Where profit comes from
                </h3>
              </div>
            </div>

            <div className="advanced-highlight-grid">

              <article>
                <span>TOP BY UNITS</span>

                <strong>
                  {bestSeller
                    ? bestSeller.name
                    : "No sales"}
                </strong>

                <small>
                  {bestSeller
                    ? `${bestSeller.units} units sold`
                    : "Record sales to identify a leader."}
                </small>
              </article>

              <article>
                <span>TOP BY REVENUE</span>

                <strong>
                  {topRevenueProduct
                    ? topRevenueProduct.name
                    : "No sales"}
                </strong>

                <small>
                  {topRevenueProduct
                    ? formatMoney(
                        topRevenueProduct.revenue
                      )
                    : "No revenue recorded."}
                </small>
              </article>

              <article>
                <span>TOP BY PROFIT</span>

                <strong>
                  {topProfitProduct
                    ? topProfitProduct.name
                    : "No sales"}
                </strong>

                <small>
                  {topProfitProduct
                    ? `+${formatMoney(
                        topProfitProduct.profit
                      )} gross profit`
                    : "No profit recorded."}
                </small>
              </article>

            </div>

            <div className="advanced-list">

              {lowMarginProducts.length === 0 ? (

                <div className="advanced-empty">
                  No product margin data for this period.
                </div>

              ) : (

                lowMarginProducts.map(
                  (product) => (
                    <div
                      className="advanced-list-row"
                      key={`margin-${product.name}`}
                    >
                      <div>
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          {formatMoney(
                            product.revenue
                          )} revenue
                        </span>
                      </div>

                      <strong
                        className={
                          product.margin < 0
                            ? "comparison-negative"
                            : ""
                        }
                      >
                        {product.margin.toFixed(
                          1
                        )}%
                      </strong>
                    </div>
                  )
                )

              )}

            </div>

          </section>

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  EXPENSE ANALYSIS
                </div>

                <h3>
                  Where money is going
                </h3>
              </div>
            </div>

            <div className="expense-analysis-summary">

              <div>
                <span>Total expenses</span>
                <strong className="expense-report-value">
                  {formatMoney(
                    totals.expenses
                  )}
                </strong>
              </div>

              <div>
                <span>Expense ratio</span>
                <strong>
                  {expenseAnalysis.expenseRatio.toFixed(
                    1
                  )}%
                </strong>
              </div>

              <div>
                <span>Largest category</span>
                <strong>
                  {expenseAnalysis.largestCategory
                    ? expenseAnalysis.largestCategory.name
                    : "None"}
                </strong>
              </div>

            </div>

            <div className="advanced-list">

              {expenseAnalysis.categories.length === 0 ? (

                <div className="advanced-empty">
                  No expenses recorded for this period.
                </div>

              ) : (

                expenseAnalysis.categories
                  .slice(0, 5)
                  .map(
                    (category) => (
                      <div
                        className="advanced-list-row"
                        key={`expense-${category.name}`}
                      >
                        <div>
                          <strong>
                            {category.name}
                          </strong>

                          <span>
                            {totals.expenses > 0
                              ? (
                                  (
                                    category.amount /
                                    totals.expenses
                                  ) *
                                  100
                                ).toFixed(1)
                              : 0}% of expenses
                          </span>
                        </div>

                        <strong className="expense-report-value">
                          {formatMoney(
                            category.amount
                          )}
                        </strong>
                      </div>
                    )
                  )

              )}

            </div>

          </section>

        </div>

        <section className="advanced-report-card premium-card">

          <div className="advanced-card-heading">
            <div>
              <div className="mini-label">
                DAILY FINANCIAL PERFORMANCE
              </div>

              <h3>
                Revenue, profit and expenses by day
              </h3>
            </div>

            <span>
              Last 14 days in selected period
            </span>
          </div>

          <div className="daily-financial-table">

            <div className="daily-financial-header">
              <span>Date</span>
              <span>Revenue</span>
              <span>Gross profit</span>
              <span>Expenses</span>
              <span>Net result</span>
            </div>

            {dailyFinancialPerformance.length === 0 ? (

              <div className="advanced-empty">
                No financial activity for this period.
              </div>

            ) : (

              dailyFinancialPerformance.map(
                (day) => (
                  <div
                    className="daily-financial-row"
                    key={`daily-${day.date}`}
                  >
                    <span>
                      {day.date}
                    </span>

                    <strong>
                      {formatMoney(
                        day.revenue
                      )}
                    </strong>

                    <strong className="record-profit">
                      {day.grossProfit >= 0
                        ? "+"
                        : "-"}
                      {formatMoney(
                        Math.abs(
                          day.grossProfit
                        )
                      )}
                    </strong>

                    <strong className="expense-report-value">
                      {formatMoney(
                        day.expenses
                      )}
                    </strong>

                    <strong
                      className={
                        day.netResult >= 0
                          ? "comparison-positive"
                          : "comparison-negative"
                      }
                    >
                      {day.netResult >= 0
                        ? "+"
                        : "-"}
                      {formatMoney(
                        Math.abs(
                          day.netResult
                        )
                      )}
                    </strong>
                  </div>
                )
              )

            )}

          </div>

        </section>

        <div className="advanced-report-grid">

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  INVENTORY INTELLIGENCE
                </div>

                <h3>
                  Stock position
                </h3>
              </div>
            </div>

            <div className="inventory-intelligence-grid">

              <article>
                <span>STOCK UNITS</span>
                <strong>
                  {inventoryAnalysis.totalUnits.toLocaleString(
                    "en-NG"
                  )}
                </strong>
              </article>

              <article>
                <span>INVENTORY VALUE</span>
                <strong>
                  {formatMoney(
                    inventoryAnalysis.inventoryValue
                  )}
                </strong>
              </article>

              <article>
                <span>LOW STOCK</span>
                <strong
                  className={
                    inventoryAnalysis.lowStock.length
                      ? "comparison-negative"
                      : "comparison-positive"
                  }
                >
                  {inventoryAnalysis.lowStock.length}
                </strong>
              </article>

              <article>
                <span>SLOW MOVING</span>
                <strong>
                  {inventoryAnalysis.slowMoving.length}
                </strong>
              </article>

            </div>

          </section>

          <section className="advanced-report-card premium-card">

            <div className="advanced-card-heading">
              <div>
                <div className="mini-label">
                  REPORT POSITION
                </div>

                <h3>
                  Period result
                </h3>
              </div>
            </div>

            <div className="advanced-result-box">

              <div>
                <span>
                  Net profit
                </span>

                <strong
                  className={
                    reportNetProfit > 0
                      ? "comparison-positive"
                      : "comparison-negative"
                  }
                >
                  {reportNetProfit > 0
                    ? "+"
                    : ""}

                  {formatMoney(
                    reportNetProfit
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Remaining expenses
                </span>

                <strong
                  className={
                    remainingExpenses > 0
                      ? "comparison-negative"
                      : "comparison-positive"
                  }
                >
                  {remainingExpenses > 0
                    ? "-"
                    : ""}

                  {formatMoney(
                    remainingExpenses
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Current cash
                </span>

                <strong>
                  {formatMoney(
                    overallFinancial.cashAtHand
                  )}
                </strong>
              </div>

            </div>

          </section>

        </div>

      </section>

      <ReportExportTools
        sales={sales}
        expenses={expenses}
        products={products}
        filteredSales={filteredSales}
        filteredExpenses={filteredExpenses}
        totals={totals}
        startDate={startDate}
        endDate={endDate}
        subscription={subscription}
      />

      <section className="report-period-footer premium-card">

        <span>
          REPORT PERIOD
        </span>

        <strong>
          {startDate} →{" "}
          {endDate}
        </strong>

        <small>
          {filteredSales.length}{" "}
          sales •{" "}
          {filteredExpenses.length}{" "}
          expenses •{" "}
          {totals.revenue > 0
            ? `${formatMoney(
                totals.revenue
              )} revenue`
            : "₦0 revenue"}
        </small>

      </section>

    </div>
  );
}

export default Reports;