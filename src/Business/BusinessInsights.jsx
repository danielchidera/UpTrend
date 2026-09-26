import "./BusinessInsights.css";

import { useMemo, useState } from "react";

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateDaysAgo(daysAgo) {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  return getLocalDateKey(date);
}

function getSaleRevenue(sale) {
  return Number(
    sale.totalSelling ??
      sale.totalSales ??
      0
  );
}

function getSaleCost(sale) {
  return Number(
    sale.totalCost ??
      Number(sale.costPrice || 0) *
        Number(sale.quantity || 0)
  );
}

function getSaleProfit(sale) {
  return Number(
    sale.grossProfit ??
      getSaleRevenue(sale) -
        getSaleCost(sale)
  );
}

function percentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
}

function BusinessInsights({
  sales = [],
  products = [],
  expenses = [],
}) {
  const [period, setPeriod] = useState("7");

  const days = Number(period);

  const insights = useMemo(() => {
    const currentStart =
      getDateDaysAgo(days - 1);

    const currentEnd =
      getLocalDateKey(new Date());

    const previousStart =
      getDateDaysAgo(days * 2 - 1);

    const currentSales =
      sales.filter(
        (sale) =>
          sale.date >= currentStart &&
          sale.date <= currentEnd
      );

    const previousSales =
      sales.filter(
        (sale) =>
          sale.date >= previousStart &&
          sale.date < currentStart
      );

    const currentExpenses =
      expenses.filter(
        (expense) =>
          expense.date >= currentStart &&
          expense.date <= currentEnd
      );

    const previousExpenses =
      expenses.filter(
        (expense) =>
          expense.date >= previousStart &&
          expense.date < currentStart
      );

    const currentRevenue =
      currentSales.reduce(
        (sum, sale) =>
          sum + getSaleRevenue(sale),
        0
      );

    const previousRevenue =
      previousSales.reduce(
        (sum, sale) =>
          sum + getSaleRevenue(sale),
        0
      );

    const currentGrossProfit =
      currentSales.reduce(
        (sum, sale) =>
          sum + getSaleProfit(sale),
        0
      );

    const previousGrossProfit =
      previousSales.reduce(
        (sum, sale) =>
          sum + getSaleProfit(sale),
        0
      );

    const currentProductCost =
      currentSales.reduce(
        (sum, sale) =>
          sum + getSaleCost(sale),
        0
      );

    const previousProductCost =
      previousSales.reduce(
        (sum, sale) =>
          sum + getSaleCost(sale),
        0
      );

    const currentExpenseTotal =
      currentExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(expense.amount || 0),
        0
      );

    const previousExpenseTotal =
      previousExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(expense.amount || 0),
        0
      );

    const currentUnitsSold =
      currentSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.quantity || 0
          ),
        0
      );

    const previousUnitsSold =
      previousSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.quantity || 0
          ),
        0
      );

    const averageSale =
      currentSales.length > 0
        ? currentRevenue /
          currentSales.length
        : 0;

    const previousAverageSale =
      previousSales.length > 0
        ? previousRevenue /
          previousSales.length
        : 0;

    const grossMargin =
      currentRevenue > 0
        ? (currentGrossProfit /
            currentRevenue) *
          100
        : 0;

    const previousGrossMargin =
      previousRevenue > 0
        ? (previousGrossProfit /
            previousRevenue) *
          100
        : 0;

    const expenseRatio =
      currentRevenue > 0
        ? (currentExpenseTotal /
            currentRevenue) *
          100
        : 0;

    const previousExpenseRatio =
      previousRevenue > 0
        ? (previousExpenseTotal /
            previousRevenue) *
          100
        : 0;

    const operatingResult =
      currentGrossProfit -
      currentExpenseTotal;

    const previousOperatingResult =
      previousGrossProfit -
      previousExpenseTotal;

    const productMap =
      new Map();

    currentSales.forEach(
      (sale) => {
        const name =
          sale.productName ||
          sale.product ||
          "Unknown Product";

        const existing =
          productMap.get(name) || {
            name,
            quantity: 0,
            revenue: 0,
            profit: 0,
          };

        existing.quantity +=
          Number(
            sale.quantity || 0
          );

        existing.revenue +=
          getSaleRevenue(sale);

        existing.profit +=
          getSaleProfit(sale);

        productMap.set(
          name,
          existing
        );
      }
    );

    const topProducts =
      [...productMap.values()]
        .sort(
          (a, b) =>
            b.revenue - a.revenue
        )
        .slice(0, 5);

    const topProductByProfit =
      [...productMap.values()]
        .sort(
          (a, b) =>
            b.profit - a.profit
        )[0] || null;

    const expenseMap =
      new Map();

    currentExpenses.forEach(
      (expense) => {
        const category =
          expense.category ||
          "Other";

        expenseMap.set(
          category,
          (expenseMap.get(
            category
          ) || 0) +
            Number(
              expense.amount || 0
            )
        );
      }
    );

    const expenseBreakdown =
      [...expenseMap.entries()]
        .map(
          ([category, amount]) => ({
            category,
            amount,
          })
        )
        .sort(
          (a, b) =>
            b.amount - a.amount
        )
        .slice(0, 5);

    const lowStockProducts =
      products
        .filter(
          (product) =>
            Number(
              product.stock || 0
            ) <=
            Number(
              product.lowStockAt || 0
            )
        )
        .sort(
          (a, b) =>
            Number(a.stock || 0) -
            Number(b.stock || 0)
        )
        .slice(0, 5);

    const revenueChange =
      percentageChange(
        currentRevenue,
        previousRevenue
      );

    const profitChange =
      percentageChange(
        currentGrossProfit,
        previousGrossProfit
      );

    const expenseChange =
      percentageChange(
        currentExpenseTotal,
        previousExpenseTotal
      );

    const averageSaleChange =
      percentageChange(
        averageSale,
        previousAverageSale
      );

    const unitsChange =
      percentageChange(
        currentUnitsSold,
        previousUnitsSold
      );

    const operatingChange =
      percentageChange(
        operatingResult,
        previousOperatingResult
      );

    const marginChange =
      grossMargin -
      previousGrossMargin;

    let headline =
      "Your business is ready for its next move.";

    let headlineDetail =
      "Keep recording sales, expenses and inventory activity to build stronger insights.";

    if (
      currentRevenue === 0 &&
      lowStockProducts.length > 0
    ) {
      headline =
        "Inventory needs attention.";

      headlineDetail =
        `${lowStockProducts.length} product${
          lowStockProducts.length === 1
            ? ""
            : "s"
        } ${
          lowStockProducts.length === 1
            ? "is"
            : "are"
        } at or below the low-stock level.`;
    } else if (
      operatingResult < 0
    ) {
      headline =
        "Expenses are above gross profit.";

      headlineDetail =
        `Your current ${days}-day expenses exceed gross profit by ${formatMoney(
          Math.abs(
            operatingResult
          )
        )}.`;
    } else if (
      grossMargin > 0 &&
      marginChange > 2
    ) {
      headline =
        "Your sales are becoming more profitable.";

      headlineDetail =
        `Gross margin is ${grossMargin.toFixed(
          1
        )}%, up ${marginChange.toFixed(
          1
        )} percentage points from the previous period.`;
    } else if (
      revenueChange > 0 &&
      profitChange > 0
    ) {
      headline =
        "Sales and profit are moving upward.";

      headlineDetail =
        `Revenue is up ${Math.abs(
          revenueChange
        ).toFixed(
          0
        )}% and gross profit is up ${Math.abs(
          profitChange
        ).toFixed(
          0
        )}% versus the previous period.`;
    } else if (
      revenueChange < 0
    ) {
      headline =
        "Sales need a closer look.";

      headlineDetail =
        `Revenue is ${Math.abs(
          revenueChange
        ).toFixed(
          0
        )}% lower than the previous ${days} days.`;
    } else if (
      lowStockProducts.length > 0
    ) {
      headline =
        "Inventory needs attention.";

      headlineDetail =
        `${lowStockProducts.length} product${
          lowStockProducts.length ===
          1
            ? ""
            : "s"
        } ${
          lowStockProducts.length ===
          1
            ? "is"
            : "are"
        } at or below the low-stock level.`;
    }

    return {
      currentRevenue,
      previousRevenue,
      currentGrossProfit,
      previousGrossProfit,
      currentProductCost,
      previousProductCost,
      currentExpenseTotal,
      previousExpenseTotal,
      averageSale,
      previousAverageSale,
      currentUnitsSold,
      previousUnitsSold,
      currentSalesCount:
        currentSales.length,
      previousSalesCount:
        previousSales.length,
      grossMargin,
      previousGrossMargin,
      expenseRatio,
      previousExpenseRatio,
      operatingResult,
      previousOperatingResult,
      revenueChange,
      profitChange,
      expenseChange,
      averageSaleChange,
      unitsChange,
      operatingChange,
      marginChange,
      topProducts,
      topProductByProfit,
      expenseBreakdown,
      lowStockProducts,
      headline,
      headlineDetail,
    };
  }, [
    sales,
    products,
    expenses,
    days,
  ]);

  return (
    <section className="business-insights">

      <div className="business-insights-header">

        <div>
          <span className="business-insights-eyebrow">
            BUSINESS INTELLIGENCE
          </span>

          <h2>
            Understand your business.
          </h2>

          <p>
            Turn your everyday sales,
            expenses and inventory data
            into useful decisions.
          </p>
        </div>

        <div className="business-insights-period">

          <button
            type="button"
            className={
              period === "7"
                ? "active"
                : ""
            }
            onClick={() =>
              setPeriod("7")
            }
          >
            7 Days
          </button>

          <button
            type="button"
            className={
              period === "30"
                ? "active"
                : ""
            }
            onClick={() =>
              setPeriod("30")
            }
          >
            30 Days
          </button>

        </div>

      </div>

      <div className="business-insights-highlight">

        <div className="business-insights-mark">
          ✦
        </div>

        <div>
          <span>
            UP TREND
          </span>

          <strong>
            {insights.headline}
          </strong>

          <p>
            {insights.headlineDetail}
          </p>
        </div>

      </div>

      <div className="business-insights-metrics">

        <article>
          <span>REVENUE</span>

          <strong>
            {formatMoney(
              insights.currentRevenue
            )}
          </strong>

          <small
            className={
              insights.revenueChange >=
              0
                ? "positive"
                : "negative"
            }
          >
            {insights.revenueChange >=
            0
              ? "↑"
              : "↓"}{" "}
            {Math.abs(
              insights.revenueChange
            ).toFixed(0)}
            % vs previous period
          </small>
        </article>

        <article>
          <span>GROSS PROFIT</span>

          <strong>
            {formatMoney(
              insights.currentGrossProfit
            )}
          </strong>

          <small
            className={
              insights.profitChange >=
              0
                ? "positive"
                : "negative"
            }
          >
            {insights.profitChange >=
            0
              ? "↑"
              : "↓"}{" "}
            {Math.abs(
              insights.profitChange
            ).toFixed(0)}
            % vs previous period
          </small>
        </article>

        <article>
          <span>GROSS MARGIN</span>

          <strong>
            {insights.grossMargin.toFixed(
              1
            )}
            %
          </strong>

          <small
            className={
              insights.marginChange >=
              0
                ? "positive"
                : "negative"
            }
          >
            {insights.marginChange >=
            0
              ? "↑"
              : "↓"}{" "}
            {Math.abs(
              insights.marginChange
            ).toFixed(1)}
            pp vs previous
          </small>
        </article>

        <article>
          <span>OPERATING RESULT</span>

          <strong
            className={
              insights.operatingResult >=
              0
                ? "positive"
                : "negative"
            }
          >
            {formatMoney(
              insights.operatingResult
            )}
          </strong>

          <small
            className={
              insights.operatingChange >=
              0
                ? "positive"
                : "negative"
            }
          >
            {insights.operatingChange >=
            0
              ? "↑"
              : "↓"}{" "}
            {Math.abs(
              insights.operatingChange
            ).toFixed(0)}
            % vs previous
          </small>
        </article>

      </div>

      <div className="business-insights-grid">

        <div className="business-insights-panel">

          <div className="business-insights-panel-heading">

            <div>
              <span>
                TOP PRODUCTS
              </span>

              <h3>
                What is selling
              </h3>
            </div>

          </div>

          {insights.topProducts
            .length === 0 ? (

            <div className="business-insights-empty">
              No sales in this period yet.
            </div>

          ) : (

            <div className="business-insights-product-list">

              {insights.topProducts.map(
                (product, index) => (
                  <div
                    className="business-insights-product"
                    key={product.name}
                  >

                    <div className="business-insights-rank">
                      {index + 1}
                    </div>

                    <div className="business-insights-product-info">

                      <strong>
                        {product.name}
                      </strong>

                      <span>
                        {product.quantity} unit
                        {product.quantity !==
                        1
                          ? "s"
                          : ""}
                      </span>

                    </div>

                    <div className="business-insights-product-money">

                      <strong>
                        {formatMoney(
                          product.revenue
                        )}
                      </strong>

                      <span>
                        +{formatMoney(
                          product.profit
                        )}
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>

          )}

          {insights.topProductByProfit && (
            <div className="business-insights-summary-row">
              <span>
                Most profitable product
              </span>

              <strong>
                {
                  insights
                    .topProductByProfit
                    .name
                }
              </strong>
            </div>
          )}

        </div>

        <div className="business-insights-panel">

          <div className="business-insights-panel-heading">

            <div>
              <span>
                EXPENSES
              </span>

              <h3>
                Where money goes
              </h3>
            </div>

          </div>

          {insights.expenseBreakdown
            .length === 0 ? (

            <div className="business-insights-empty">
              No expenses in this period.
            </div>

          ) : (

            <div className="business-insights-expense-list">

              {insights.expenseBreakdown.map(
                (item) => (
                  <div
                    className="business-insights-expense"
                    key={item.category}
                  >

                    <div>
                      <strong>
                        {item.category}
                      </strong>

                      <span>
                        {formatMoney(
                          item.amount
                        )}
                      </span>
                    </div>

                    <div className="business-insights-expense-bar">
                      <span
                        style={{
                          width: `${
                            insights.currentExpenseTotal >
                            0
                              ? Math.min(
                                  (item.amount /
                                    insights.currentExpenseTotal) *
                                    100,
                                  100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                  </div>
                )
              )}

            </div>

          )}

          <div className="business-insights-summary-row">
            <span>
              Expense ratio
            </span>

            <strong
              className={
                insights.expenseRatio >
                100
                  ? "negative"
                  : ""
              }
            >
              {insights.expenseRatio.toFixed(
                1
              )}
              %
            </strong>
          </div>

        </div>

      </div>

      <div className="business-insights-bottom">

        <div className="business-insights-panel">

          <div className="business-insights-panel-heading">

            <div>
              <span>
                INVENTORY
              </span>

              <h3>
                Restock attention
              </h3>
            </div>

          </div>

          {insights.lowStockProducts
            .length === 0 ? (

            <div className="business-insights-good">
              <span>✓</span>

              <div>
                <strong>
                  Inventory looks good.
                </strong>

                <p>
                  No products are currently
                  at or below their low-stock
                  level.
                </p>
              </div>
            </div>

          ) : (

            <div className="business-insights-low-stock">

              {insights.lowStockProducts.map(
                (product) => (
                  <div
                    key={product.id}
                  >
                    <strong>
                      {product.name}
                    </strong>

                    <span>
                      {Number(
                        product.stock || 0
                      )} left
                    </span>
                  </div>
                )
              )}

            </div>

          )}

        </div>

        <div className="business-insights-panel business-insights-summary">

          <div className="business-insights-panel-heading">

            <div>
              <span>
                PERIOD SUMMARY
              </span>

              <h3>
                {days}-day snapshot
              </h3>
            </div>

          </div>

          <div className="business-insights-summary-row">
            <span>
              Sales
            </span>

            <strong>
              {insights.currentSalesCount}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Units sold
            </span>

            <strong>
              {insights.currentUnitsSold}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Revenue
            </span>

            <strong>
              {formatMoney(
                insights.currentRevenue
              )}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Product cost
            </span>

            <strong>
              {formatMoney(
                insights.currentProductCost
              )}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Gross Profit
            </span>

            <strong
              className={
                insights.currentGrossProfit >=
                0
                  ? "positive"
                  : "negative"
              }
            >
              {formatMoney(
                insights.currentGrossProfit
              )}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Expenses
            </span>

            <strong>
              {formatMoney(
                insights.currentExpenseTotal
              )}
            </strong>
          </div>

          <div className="business-insights-summary-row">
            <span>
              Operating result
            </span>

            <strong
              className={
                insights.operatingResult >=
                0
                  ? "positive"
                  : "negative"
              }
            >
              {formatMoney(
                insights.operatingResult
              )}
            </strong>
          </div>

        </div>

      </div>

    </section>
  );
}

export default BusinessInsights;
