import { useMemo } from "react";
import BusinessGate from "./BusinessGate";

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getExpenseTotal(expenses) {
  return expenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount || 0),
    0
  );
}

function getPeriodStats(sales, expenses) {
  const revenue = sales.reduce(
    (sum, sale) =>
      sum + getSaleRevenue(sale),
    0
  );

  const productCost = sales.reduce(
    (sum, sale) =>
      sum + getSaleCost(sale),
    0
  );

  const grossProfit =
    sales.reduce(
      (sum, sale) =>
        sum + getSaleProfit(sale),
      0
    );

  const expensesTotal =
    getExpenseTotal(expenses);

  const netProfit = Math.max(
    grossProfit - expensesTotal,
    0
  );

  const remainingExpenses =
    Math.max(
      expensesTotal - grossProfit,
      0
    );

  return {
    revenue,
    productCost,
    grossProfit,
    expenses: expensesTotal,
    netProfit,
    remainingExpenses,
    transactions: sales.length,
  };
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

function escapeCsv(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row.map(escapeCsv).join(",")
    )
    .join("\n");

  const blob = new Blob(
    [`\ufeff${csv}`],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function ReportExportTools({
  sales = [],
  expenses = [],
  products = [],
  filteredSales = [],
  filteredExpenses = [],
  totals,
  startDate,
  endDate,
  subscription,
}) {
  const comparison = useMemo(() => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start || !end) {
      return {
        current: getPeriodStats(
          filteredSales,
          filteredExpenses
        ),
        previous: getPeriodStats([], []),
        days: 0,
      };
    }

    const millisecondsPerDay =
      24 * 60 * 60 * 1000;

    const days =
      Math.max(
        1,
        Math.floor(
          (end.getTime() -
            start.getTime()) /
            millisecondsPerDay
        ) + 1
      );

    const previousEnd =
      new Date(start);

    previousEnd.setDate(
      previousEnd.getDate() - 1
    );

    const previousStart =
      new Date(previousEnd);

    previousStart.setDate(
      previousStart.getDate() -
        (days - 1)
    );

    const previousStartKey =
      getDateKey(previousStart);

    const previousEndKey =
      getDateKey(previousEnd);

    const previousSales =
      sales.filter(
        (sale) =>
          sale.date >= previousStartKey &&
          sale.date <= previousEndKey
      );

    const previousExpenses =
      expenses.filter(
        (expense) =>
          expense.date >= previousStartKey &&
          expense.date <= previousEndKey
      );

    return {
      current: getPeriodStats(
        filteredSales,
        filteredExpenses
      ),
      previous: getPeriodStats(
        previousSales,
        previousExpenses
      ),
      days,
      previousStartKey,
      previousEndKey,
    };
  }, [
    sales,
    expenses,
    filteredSales,
    filteredExpenses,
    startDate,
    endDate,
  ]);

  const exportCsv = () => {
    const rows = [
      ["UPTREND BUSINESS REPORT"],
      [],
      ["Report Period", `${startDate} to ${endDate}`],
      [],
      ["FINANCIAL SUMMARY"],
      ["Revenue", totals.revenue],
      ["Product Cost", totals.productCost],
      ["Gross Profit", totals.grossProfit],
      ["Expenses", totals.expenses],
      [
        "Remaining Expenses",
        totals.remainingExpenses,
      ],
      ["Net Profit", totals.netProfit],
      [],
      ["PERIOD COMPARISON"],
      [
        "Metric",
        "Current Period",
        "Previous Period",
        "Change %",
      ],
      [
        "Revenue",
        comparison.current.revenue,
        comparison.previous.revenue,
        percentageChange(
          comparison.current.revenue,
          comparison.previous.revenue
        ).toFixed(1),
      ],
      [
        "Gross Profit",
        comparison.current.grossProfit,
        comparison.previous.grossProfit,
        percentageChange(
          comparison.current.grossProfit,
          comparison.previous.grossProfit
        ).toFixed(1),
      ],
      [
        "Expenses",
        comparison.current.expenses,
        comparison.previous.expenses,
        percentageChange(
          comparison.current.expenses,
          comparison.previous.expenses
        ).toFixed(1),
      ],
      [
        "Transactions",
        comparison.current.transactions,
        comparison.previous.transactions,
        percentageChange(
          comparison.current.transactions,
          comparison.previous.transactions
        ).toFixed(1),
      ],
      [],
      ["SALES"],
      [
        "Date",
        "Product",
        "Quantity",
        "Selling Price",
        "Product Cost",
        "Gross Profit",
      ],
    ];

    filteredSales.forEach((sale) => {
      rows.push([
        sale.date,
        sale.productName ||
          sale.product ||
          "Product",
        sale.quantity,
        sale.sellingPrice,
        getSaleCost(sale),
        getSaleProfit(sale),
      ]);
    });

    rows.push(
      [],
      ["EXPENSES"],
      [
        "Date",
        "Name",
        "Category",
        "Amount",
        "Note",
      ]
    );

    filteredExpenses.forEach(
      (expense) => {
        rows.push([
          expense.date,
          expense.name,
          expense.category,
          expense.amount,
          expense.note,
        ]);
      }
    );

    rows.push(
      [],
      ["INVENTORY"],
      [
        "Product",
        "Stock",
        "Cost Price",
        "Inventory Value",
        "Low Stock Level",
      ]
    );

    products.forEach((product) => {
      rows.push([
        product.name,
        product.stock,
        product.costPrice,
        Number(product.stock || 0) *
          Number(product.costPrice || 0),
        product.lowStockAt,
      ]);
    });

    const filename =
      `UpTrend-Report-${startDate}-${endDate}.csv`;

    downloadCsv(filename, rows);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <BusinessGate
      subscription={subscription}
      title="Advanced Reports & Exports"
      description="Upgrade to UpTrend Business to export professional reports, print or save reports as PDF, and compare reporting periods."
    >
      <section className="advanced-report-tools">

      <div className="advanced-report-tools-copy">
        <span>
          BUSINESS TOOLS
        </span>

        <strong>
          Export & compare your report
        </strong>

        <p>
          Download your report for Excel
          or print it as a professional
          business document.
        </p>
      </div>

      <div className="advanced-report-actions">

        <button
          type="button"
          className="report-export-button"
          onClick={exportCsv}
        >
          <span>↓</span>
          Export CSV
        </button>

        <button
          type="button"
          className="report-print-button"
          onClick={printReport}
        >
          <span>⎙</span>
          Print / PDF
        </button>

      </div>

      <div className="report-comparison">

        <div className="report-comparison-heading">
          <span>
            PERIOD COMPARISON
          </span>

          <small>
            {comparison.days}-day period
          </small>
        </div>

        <div className="report-comparison-grid">

          <article>
            <span>REVENUE</span>

            <strong>
              {formatMoney(
                comparison.current.revenue
              )}
            </strong>

            <small
              className={
                comparison.current.revenue >=
                comparison.previous.revenue
                  ? "comparison-positive"
                  : "comparison-negative"
              }
            >
              {comparison.current.revenue >=
              comparison.previous.revenue
                ? "↑"
                : "↓"}{" "}
              {Math.abs(
                percentageChange(
                  comparison.current.revenue,
                  comparison.previous.revenue
                )
              ).toFixed(1)}
              %
            </small>
          </article>

          <article>
            <span>GROSS PROFIT</span>

            <strong>
              {formatMoney(
                comparison.current.grossProfit
              )}
            </strong>

            <small
              className={
                comparison.current.grossProfit >=
                comparison.previous.grossProfit
                  ? "comparison-positive"
                  : "comparison-negative"
              }
            >
              {comparison.current.grossProfit >=
              comparison.previous.grossProfit
                ? "↑"
                : "↓"}{" "}
              {Math.abs(
                percentageChange(
                  comparison.current.grossProfit,
                  comparison.previous.grossProfit
                )
              ).toFixed(1)}
              %
            </small>
          </article>

          <article>
            <span>EXPENSES</span>

            <strong>
              {formatMoney(
                comparison.current.expenses
              )}
            </strong>

            <small
              className={
                comparison.current.expenses <=
                comparison.previous.expenses
                  ? "comparison-positive"
                  : "comparison-negative"
              }
            >
              {comparison.current.expenses <=
              comparison.previous.expenses
                ? "↓"
                : "↑"}{" "}
              {Math.abs(
                percentageChange(
                  comparison.current.expenses,
                  comparison.previous.expenses
                )
              ).toFixed(1)}
              %
            </small>
          </article>

          <article>
            <span>TRANSACTIONS</span>

            <strong>
              {comparison.current.transactions}
            </strong>

            <small
              className={
                comparison.current.transactions >=
                comparison.previous.transactions
                  ? "comparison-positive"
                  : "comparison-negative"
              }
            >
              {comparison.current.transactions >=
              comparison.previous.transactions
                ? "↑"
                : "↓"}{" "}
              {Math.abs(
                percentageChange(
                  comparison.current.transactions,
                  comparison.previous.transactions
                )
              ).toFixed(1)}
              %
            </small>
          </article>

        </div>

      </div>

      </section>
    </BusinessGate>
  );
}

export default ReportExportTools;
