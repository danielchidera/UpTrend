import "./SmartAlerts.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const PRODUCTS_KEY = "uptrend_products";
const SALES_KEY = "uptrend_sales";
const EXPENSES_KEY = "uptrend_expenses";

function readArray(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDaysAgo(days) {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(
    date.getDate() - days
  );

  return getLocalDateKey(date);
}

function getDaysFromNow(days) {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(
    date.getDate() + days
  );

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

function formatMoney(value) {
  return `₦${Number(
    value || 0
  ).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function percentageChange(
  current,
  previous
) {
  if (previous === 0) {
    return 0;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
}

function getDebtCustomerName(
  debt,
  customers
) {
  const customer = customers.find(
    (item) =>
      item.id === debt.customer_id
  );

  return customer?.name || "Customer";
}

function getDebtStatus(
  debt,
  paid
) {
  const originalAmount = Number(
    debt.original_amount || 0
  );

  const balance = Math.max(
    originalAmount - paid,
    0
  );

  if (
    debt.status === "cancelled"
  ) {
    return "cancelled";
  }

  if (
    balance <= 0 &&
    originalAmount > 0
  ) {
    return "paid";
  }

  const today =
    getLocalDateKey(new Date());

  if (
    debt.due_date &&
    debt.due_date < today
  ) {
    return "overdue";
  }

  if (paid > 0) {
    return "partially_paid";
  }

  return "pending";
}

function getTargetProgress(
  actual,
  target
) {
  if (!target || target <= 0) {
    return 0;
  }

  return (
    (actual / target) *
    100
  );
}

function SmartAlerts() {
  const [refreshKey, setRefreshKey] =
    useState(0);

  const [remoteData, setRemoteData] =
    useState({
      debts: [],
      payments: [],
      customers: [],
      targets: [],
      remoteSales: [],
      remoteExpenses: [],
    });

  useEffect(() => {
    const refresh = () => {
      setRefreshKey(
        (value) => value + 1
      );
    };

    window.addEventListener(
      "storage",
      refresh
    );

    const interval = setInterval(
      refresh,
      30000
    );

    return () => {
      window.removeEventListener(
        "storage",
        refresh
      );

      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadRemoteAlertsData =
      async () => {
        try {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (!user) {
            if (active) {
              setRemoteData({
                debts: [],
                payments: [],
                customers: [],
                targets: [],
                remoteSales: [],
                remoteExpenses: [],
              });
            }

            return;
          }

          const [
            debtsResult,
            paymentsResult,
            customersResult,
            targetsResult,
            salesResult,
            expensesResult,
          ] = await Promise.all([
            supabase
              .from(
                "uptrend_credit_debts"
              )
              .select("*")
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from(
                "uptrend_credit_debt_payments"
              )
              .select("*")
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from(
                "uptrend_customers"
              )
              .select(
                "id, name"
              )
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from(
                "uptrend_business_targets"
              )
              .select("*")
              .eq(
                "user_id",
                user.id
              )
              .order(
                "start_date",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("sales")
              .select("*")
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from("expenses")
              .select("*")
              .eq(
                "user_id",
                user.id
              ),
          ]);

          if (
            debtsResult.error ||
            paymentsResult.error ||
            customersResult.error ||
            targetsResult.error ||
            salesResult.error ||
            expensesResult.error
          ) {
            console.error(
              "Smart Alerts remote data error:",
              debtsResult.error ||
                paymentsResult.error ||
                customersResult.error ||
                targetsResult.error ||
                salesResult.error ||
                expensesResult.error
            );

            return;
          }

          if (!active) return;

          setRemoteData({
            debts:
              debtsResult.data ||
              [],
            payments:
              paymentsResult.data ||
              [],
            customers:
              customersResult.data ||
              [],
            targets:
              targetsResult.data ||
              [],
            remoteSales:
              salesResult.data ||
              [],
            remoteExpenses:
              expensesResult.data ||
              [],
          });
        } catch (error) {
          console.error(
            "Failed to load Smart Alerts data:",
            error
          );
        }
      };

    loadRemoteAlertsData();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const alerts = useMemo(() => {
    const products =
      readArray(PRODUCTS_KEY);

    const sales =
      readArray(SALES_KEY);

    const expenses =
      readArray(EXPENSES_KEY);

    const currentStart =
      getDaysAgo(6);

    const previousStart =
      getDaysAgo(13);

    const today =
      getLocalDateKey(new Date());

    const dueSoonEnd =
      getDaysFromNow(3);

    const currentSales =
      sales.filter(
        (sale) =>
          sale.date >= currentStart
      );

    const previousSales =
      sales.filter(
        (sale) =>
          sale.date >=
            previousStart &&
          sale.date < currentStart
      );

    const currentExpenses =
      expenses.filter(
        (expense) =>
          expense.date >=
          currentStart
      );

    const previousExpenses =
      expenses.filter(
        (expense) =>
          expense.date >=
            previousStart &&
          expense.date < currentStart
      );

    const outOfStockProducts =
      products.filter(
        (product) =>
          Number(
            product.stock || 0
          ) <= 0
      );

    const lowStockProducts =
      products
        .filter((product) => {
          const stock = Number(
            product.stock || 0
          );

          const threshold =
            Number(
              product.lowStockAt || 0
            );

          return (
            stock > 0 &&
            stock <= threshold
          );
        })
        .sort(
          (a, b) =>
            Number(a.stock || 0) -
            Number(b.stock || 0)
        );

    const currentRevenue =
      currentSales.reduce(
        (sum, sale) =>
          sum +
          getSaleRevenue(sale),
        0
      );

    const previousRevenue =
      previousSales.reduce(
        (sum, sale) =>
          sum +
          getSaleRevenue(sale),
        0
      );

    const currentGrossProfit =
      currentSales.reduce(
        (sum, sale) =>
          sum +
          getSaleProfit(sale),
        0
      );

    const previousGrossProfit =
      previousSales.reduce(
        (sum, sale) =>
          sum +
          getSaleProfit(sale),
        0
      );

    const currentExpensesTotal =
      currentExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    const previousExpensesTotal =
      previousExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    const currentMargin =
      currentRevenue > 0
        ? (currentGrossProfit /
            currentRevenue) *
          100
        : 0;

    const previousMargin =
      previousRevenue > 0
        ? (previousGrossProfit /
            previousRevenue) *
          100
        : 0;

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
        currentExpensesTotal,
        previousExpensesTotal
      );

    const marginChange =
      currentMargin -
      previousMargin;

    const result = [];

    // =====================================================
    // CRITICAL: OUT OF STOCK
    // =====================================================

    if (
      outOfStockProducts.length > 0
    ) {
      const first =
        outOfStockProducts[0];

      result.push({
        id: "out-of-stock",
        type: "danger",
        icon: "⛔",
        title: "Product out of stock",
        message:
          outOfStockProducts.length ===
          1
            ? `${first.name} has reached 0 stock.`
            : `${outOfStockProducts.length} products have reached 0 stock.`,
      });
    }

    // =====================================================
    // CRITICAL: EXPENSES ABOVE GROSS PROFIT
    // =====================================================

    if (
      currentExpensesTotal >
      currentGrossProfit
    ) {
      const gap =
        currentExpensesTotal -
        currentGrossProfit;

      result.push({
        id: "expense-pressure",
        type: "danger",
        icon: "₦",
        title:
          "Expenses exceed gross profit",
        message: `Your last 7 days of expenses are ${formatMoney(
          gap
        )} above gross profit.`,
      });
    }

    // =====================================================
    // CRITICAL: OVERDUE CREDIT
    // =====================================================

    const paymentTotals = {};

    remoteData.payments.forEach(
      (payment) => {
        if (
          !paymentTotals[
            payment.debt_id
          ]
        ) {
          paymentTotals[
            payment.debt_id
          ] = 0;
        }

        paymentTotals[
          payment.debt_id
        ] += Number(
          payment.amount || 0
        );
      }
    );

    const enrichedDebts =
      remoteData.debts.map(
        (debt) => {
          const originalAmount =
            Number(
              debt.original_amount ||
                0
            );

          const paid = Math.min(
            originalAmount,
            Number(
              paymentTotals[
                debt.id
              ] || 0
            )
          );

          const balance =
            Math.max(
              originalAmount -
                paid,
              0
            );

          return {
            ...debt,
            paid,
            balance,
            calculatedStatus:
              getDebtStatus(
                debt,
                paid
              ),
          };
        }
      );

    const overdueDebts =
      enrichedDebts.filter(
        (debt) =>
          debt.calculatedStatus ===
            "overdue" &&
          debt.balance > 0
      );

    if (
      overdueDebts.length > 0
    ) {
      const totalOverdue =
        overdueDebts.reduce(
          (sum, debt) =>
            sum +
            Number(
              debt.balance || 0
            ),
          0
        );

      const first =
        overdueDebts[0];

      const customerName =
        getDebtCustomerName(
          first,
          remoteData.customers
        );

      result.push({
        id: "credit-overdue",
        type: "danger",
        icon: "₦",
        title:
          "Customer credit is overdue",
        message:
          overdueDebts.length === 1
            ? `${customerName} has ${formatMoney(
                first.balance
              )} outstanding past the due date.`
            : `${overdueDebts.length} credit records are overdue, totaling ${formatMoney(
                totalOverdue
              )}.`,
      });
    }

    // =====================================================
    // WARNING: LOW STOCK
    // =====================================================

    if (
      lowStockProducts.length > 0
    ) {
      const first =
        lowStockProducts[0];

      result.push({
        id: "low-stock",
        type: "warning",
        icon: "📦",
        title:
          "Inventory needs attention",
        message:
          lowStockProducts.length ===
          1
            ? `${first.name} has ${Number(
                first.stock || 0
              )} unit${
                Number(
                  first.stock || 0
                ) === 1
                  ? ""
                  : "s"
              } left, at or below its low-stock level.`
            : `${lowStockProducts.length} products are at or below their low-stock levels.`,
      });
    }

    // =====================================================
    // WARNING: CREDIT DUE TODAY
    // =====================================================

    const dueTodayDebts =
      enrichedDebts.filter(
        (debt) =>
          debt.balance > 0 &&
          debt.calculatedStatus !==
            "cancelled" &&
          debt.calculatedStatus !==
            "paid" &&
          debt.due_date === today
      );

    if (
      dueTodayDebts.length > 0
    ) {
      const totalDue =
        dueTodayDebts.reduce(
          (sum, debt) =>
            sum +
            Number(
              debt.balance || 0
            ),
          0
        );

      result.push({
        id: "credit-due-today",
        type: "warning",
        icon: "◷",
        title:
          "Credit payment due today",
        message:
          dueTodayDebts.length === 1
            ? `${getDebtCustomerName(
                dueTodayDebts[0],
                remoteData.customers
              )} has ${formatMoney(
                dueTodayDebts[0].balance
              )} due today.`
            : `${dueTodayDebts.length} credit records have payments due today, totaling ${formatMoney(
                totalDue
              )}.`,
      });
    }

    // =====================================================
    // WARNING: CREDIT DUE SOON
    // =====================================================

    const dueSoonDebts =
      enrichedDebts.filter(
        (debt) =>
          debt.balance > 0 &&
          debt.calculatedStatus !==
            "cancelled" &&
          debt.calculatedStatus !==
            "paid" &&
          debt.due_date &&
          debt.due_date > today &&
          debt.due_date <=
            dueSoonEnd
      );

    if (
      dueSoonDebts.length > 0
    ) {
      const totalDueSoon =
        dueSoonDebts.reduce(
          (sum, debt) =>
            sum +
            Number(
              debt.balance || 0
            ),
          0
        );

      result.push({
        id: "credit-due-soon",
        type: "warning",
        icon: "◷",
        title:
          "Credit payment due soon",
        message:
          dueSoonDebts.length === 1
            ? `${getDebtCustomerName(
                dueSoonDebts[0],
                remoteData.customers
              )} has ${formatMoney(
                dueSoonDebts[0].balance
              )} due within 3 days.`
            : `${dueSoonDebts.length} credit records are due within 3 days, totaling ${formatMoney(
                totalDueSoon
              )}.`,
      });
    }

    // =====================================================
    // POSITIVE: RECENTLY FULLY PAID CREDIT
    // =====================================================

    const recentlyPaidDebts =
      enrichedDebts.filter(
        (debt) => {
          if (
            debt.balance > 0 ||
            debt.calculatedStatus !==
              "paid"
          ) {
            return false;
          }

          const debtPayments =
            remoteData.payments
              .filter(
                (payment) =>
                  payment.debt_id ===
                  debt.id
              )
              .sort((a, b) =>
                String(
                  b.payment_date || ""
                ).localeCompare(
                  String(
                    a.payment_date || ""
                  )
                )
              );

          if (
            debtPayments.length ===
            0
          ) {
            return false;
          }

          const latestPayment =
            debtPayments[0];

          return (
            latestPayment.payment_date >=
            getDaysAgo(3)
          );
        }
      );

    if (
      recentlyPaidDebts.length > 0
    ) {
      const first =
        recentlyPaidDebts[0];

      result.push({
        id: "credit-paid-recently",
        type: "positive",
        icon: "✓",
        title:
          "Credit fully paid",
        message:
          recentlyPaidDebts.length ===
          1
            ? `${getDebtCustomerName(
                first,
                remoteData.customers
              )} has fully settled a credit record.`
            : `${recentlyPaidDebts.length} credit records have been fully settled recently.`,
      });
    }

    // =====================================================
    // WARNING: SALES DECLINE
    // =====================================================

    if (
      previousRevenue > 0 &&
      revenueChange <= -20
    ) {
      result.push({
        id: "sales-decline",
        type: "warning",
        icon: "↘",
        title:
          "Sales have slowed",
        message: `Revenue is down ${Math.abs(
          revenueChange
        ).toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    // =====================================================
    // WARNING: MARGIN DETERIORATION
    // =====================================================

    if (
      previousRevenue > 0 &&
      currentRevenue > 0 &&
      marginChange <= -5
    ) {
      result.push({
        id: "margin-decline",
        type: "warning",
        icon: "％",
        title:
          "Gross margin is falling",
        message: `Gross margin has fallen ${Math.abs(
          marginChange
        ).toFixed(
          1
        )} percentage points compared with the previous period.`,
      });
    }

    // =====================================================
    // WARNING: EXPENSE ACCELERATION
    // =====================================================

    if (
      previousExpensesTotal > 0 &&
      expenseChange >= 20
    ) {
      result.push({
        id: "expense-growth",
        type: "warning",
        icon: "↗",
        title:
          "Expenses are rising",
        message: `Expenses are up ${expenseChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    // =====================================================
    // BUSINESS TARGETS
    // =====================================================

    const activeTarget =
      remoteData.targets.find(
        (target) =>
          target.start_date <=
            today &&
          target.end_date >=
            today
      ) ||
      remoteData.targets[0] ||
      null;

    if (activeTarget) {
      const targetStart =
        activeTarget.start_date;

      const targetEnd =
        activeTarget.end_date;

      const targetSales =
        remoteData.remoteSales.filter(
          (sale) => {
            const date =
              String(
                sale.sale_date || ""
              ).slice(0, 10);

            return (
              date >= targetStart &&
              date <= targetEnd
            );
          }
        );

      const targetExpenses =
        remoteData.remoteExpenses.filter(
          (expense) => {
            const date =
              String(
                expense.expense_date ||
                  ""
              ).slice(0, 10);

            return (
              date >= targetStart &&
              date <= targetEnd
            );
          }
        );

      const targetRevenue =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.total_selling ||
                0
            ),
          0
        );

      const targetGrossProfit =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.gross_profit ||
                0
            ),
          0
        );

      const targetUnits =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.quantity || 0
            ),
          0
        );

      const targetExpensesTotal =
        targetExpenses.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount ??
                expense.total ??
                0
            ),
          0
        );

      const revenueTarget =
        Number(
          activeTarget.revenue_target ||
            0
        );

      const grossProfitTarget =
        Number(
          activeTarget.gross_profit_target ||
            0
        );

      const expenseLimit =
        Number(
          activeTarget.expense_limit ||
            0
        );

      const unitsTarget =
        Number(
          activeTarget.units_target ||
            0
        );

      // ---------------------------------------------
      // Revenue target
      // ---------------------------------------------

      if (
        revenueTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetRevenue,
            revenueTarget
          );

        if (progress >= 100) {
          result.push({
            id: "target-revenue-reached",
            type: "positive",
            icon: "✓",
            title:
              "Revenue target reached",
            message: `Your revenue has reached ${formatMoney(
              targetRevenue
            )} against a target of ${formatMoney(
              revenueTarget
            )}.`,
          });
        } else if (
          progress < 75
        ) {
          result.push({
            id: "target-revenue-warning",
            type: "warning",
            icon: "◎",
            title:
              "Revenue target needs attention",
            message: `Revenue is at ${progress.toFixed(
              0
            )}% of the current target.`,
          });
        }
      }

      // ---------------------------------------------
      // Gross profit target
      // ---------------------------------------------

      if (
        grossProfitTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetGrossProfit,
            grossProfitTarget
          );

        if (progress >= 100) {
          result.push({
            id: "target-profit-reached",
            type: "positive",
            icon: "✓",
            title:
              "Gross profit target reached",
            message: `Gross profit has reached ${formatMoney(
              targetGrossProfit
            )} against a target of ${formatMoney(
              grossProfitTarget
            )}.`,
          });
        } else if (
          progress < 75
        ) {
          result.push({
            id: "target-profit-warning",
            type: "warning",
            icon: "◎",
            title:
              "Gross profit target needs attention",
            message: `Gross profit is at ${progress.toFixed(
              0
            )}% of the current target.`,
          });
        }
      }

      // ---------------------------------------------
      // Expense limit
      // ---------------------------------------------

      if (
        expenseLimit > 0 &&
        targetExpensesTotal >
          expenseLimit
      ) {
        const excess =
          targetExpensesTotal -
          expenseLimit;

        result.push({
          id: "target-expense-limit",
          type: "danger",
          icon: "₦",
          title:
            "Business target expense limit exceeded",
          message: `Expenses are ${formatMoney(
            excess
          )} above the current target limit.`,
        });
      }

      // ---------------------------------------------
      // Units target
      // ---------------------------------------------

      if (
        unitsTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetUnits,
            unitsTarget
          );

        if (progress >= 100) {
          result.push({
            id: "target-units-reached",
            type: "positive",
            icon: "✓",
            title:
              "Units target reached",
            message: `${targetUnits.toLocaleString(
              "en-NG"
            )} units have been sold against the current target.`,
          });
        } else if (
          progress < 75
        ) {
          result.push({
            id: "target-units-warning",
            type: "warning",
            icon: "◎",
            title:
              "Units target needs attention",
            message: `Units sold are at ${progress.toFixed(
              0
            )}% of the current target.`,
          });
        }
      }
    }

    // =====================================================
    // POSITIVE: REVENUE GROWTH
    // =====================================================

    if (
      previousRevenue > 0 &&
      revenueChange >= 20
    ) {
      result.push({
        id: "revenue-growth",
        type: "positive",
        icon: "↗",
        title:
          "Revenue is growing",
        message: `Revenue is up ${revenueChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    // =====================================================
    // POSITIVE: PROFIT GROWTH
    // =====================================================

    if (
      previousGrossProfit > 0 &&
      profitChange >= 20
    ) {
      result.push({
        id: "profit-growth",
        type: "positive",
        icon: "✓",
        title:
          "Gross profit is growing",
        message: `Gross profit is up ${profitChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    // =====================================================
    // POSITIVE: MARGIN IMPROVEMENT
    // =====================================================

    if (
      previousRevenue > 0 &&
      currentRevenue > 0 &&
      marginChange >= 5
    ) {
      result.push({
        id: "margin-growth",
        type: "positive",
        icon: "％",
        title:
          "Profit margin improved",
        message: `Gross margin improved by ${marginChange.toFixed(
          1
        )} percentage points.`,
      });
    }

    // Keep the notification center focused.
    return result.slice(0, 8);
  }, [
    refreshKey,
    remoteData,
  ]);

  return (
    <div className="smart-alerts">

      <div className="smart-alerts-header">

        <div>
          <span>
            SMART ALERTS
          </span>

          <h3>
            Notifications
          </h3>
        </div>

        <div className="smart-alerts-count">
          {alerts.length}
        </div>

      </div>

      {alerts.length === 0 ? (
        <div className="smart-alerts-empty">

          <div className="smart-alerts-empty-icon">
            ✓
          </div>

          <strong>
            No important alerts
          </strong>

          <p>
            UpTrend will notify you when
            something needs attention.
          </p>

        </div>
      ) : (

        <div className="smart-alerts-list">

          {alerts.map((alert) => (

            <article
              className={`smart-alert smart-alert-${alert.type}`}
              key={alert.id}
            >

              <div className="smart-alert-icon">
                {alert.icon}
              </div>

              <div className="smart-alert-copy">

                <strong>
                  {alert.title}
                </strong>

                <p>
                  {alert.message}
                </p>

              </div>

            </article>

          ))}

        </div>

      )}

    </div>
  );
}

export default SmartAlerts;
