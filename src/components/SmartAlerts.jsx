import "./SmartAlerts.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

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

function getSaleRevenue(sale) {
  return Number(
    sale.total_selling ??
      sale.totalSelling ??
      sale.total_sales ??
      sale.totalSales ??
      0
  );
}

function getSaleCost(sale) {
  return Number(
    sale.total_cost ??
      sale.totalCost ??
      Number(
        sale.cost_price ??
          sale.costPrice ??
          0
      ) *
        Number(
          sale.quantity || 0
        )
  );
}

function getSaleProfit(sale) {
  return Number(
    sale.gross_profit ??
      sale.grossProfit ??
      getSaleRevenue(sale) -
        getSaleCost(sale)
  );
}

function getDebtCustomerName(
  debt,
  customers
) {
  const customer =
    customers.find(
      (item) =>
        item.id ===
        debt.customer_id
    );

  return (
    customer?.name ||
    "Customer"
  );
}

function getDebtStatus(
  debt,
  paid
) {
  const originalAmount =
    Number(
      debt.original_amount || 0
    );

  const balance = Math.max(
    originalAmount - paid,
    0
  );

  if (
    debt.status ===
    "cancelled"
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
    getLocalDateKey(
      new Date()
    );

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

function getSupplierPurchaseStatus(
  purchase,
  paid
) {
  const total = Number(
    purchase.total_amount || 0
  );

  const balance = Math.max(
    total - paid,
    0
  );

  if (
    purchase.status ===
    "cancelled"
  ) {
    return "cancelled";
  }

  if (
    balance <= 0 &&
    total > 0
  ) {
    return "paid";
  }

  const today =
    getLocalDateKey(
      new Date()
    );

  if (
    purchase.due_date &&
    purchase.due_date < today
  ) {
    return paid > 0
      ? "partially_paid_overdue"
      : "overdue";
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

/* =========================================================
   COMPONENT
========================================================= */

function SmartAlerts({
  isOpen = false,
  onAlertsChange,
}) {
  const [refreshKey, setRefreshKey] =
    useState(0);

  const [
    notificationPreferences,
    setNotificationPreferences,
  ] = useState({
    enabled: true,
    inventory: true,
    payments: true,
    salesExpenses: true,
    targets: true,
  });

  const [remoteData, setRemoteData] =
    useState({
      products: [],
      suppliers: [],
      purchases: [],
      supplierPayments: [],
      debts: [],
      payments: [],
      customers: [],
      targets: [],
      remoteSales: [],
      remoteExpenses: [],
      inventoryActivity: [],
    });

  /* =======================================================
     NOTIFICATION PREFERENCES
  ======================================================= */

  useEffect(() => {
    let active = true;

    const loadNotificationPreferences =
      async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) {
          return;
        }

        const saved =
          user?.user_metadata
            ?.notification_preferences || {};

        setNotificationPreferences({
          enabled:
            saved.enabled !== false,
          inventory:
            saved.inventory !== false,
          payments:
            saved.payments !== false,
          salesExpenses:
            saved.salesExpenses !== false,
          targets:
            saved.targets !== false,
        });
      };

    loadNotificationPreferences();

    const handleSettingsChanged =
      () => {
        loadNotificationPreferences();
      };

    window.addEventListener(
      "uptrend:notification-settings-changed",
      handleSettingsChanged
    );

    return () => {
      active = false;

      window.removeEventListener(
        "uptrend:notification-settings-changed",
        handleSettingsChanged
      );
    };
  }, []);

  /* =======================================================
     LOCAL REFRESH EVENTS
  ======================================================= */

  useEffect(() => {
    const refresh = () => {
      setRefreshKey(
        (value) => value + 1
      );
    };

    window.addEventListener(
      "uptrend:inventory-refresh",
      refresh
    );

    window.addEventListener(
      "uptrend:supplier-refresh",
      refresh
    );

    window.addEventListener(
      "uptrend:sales-refresh",
      refresh
    );

    window.addEventListener(
      "uptrend:expenses-refresh",
      refresh
    );

    window.addEventListener(
      "storage",
      refresh
    );

    const interval =
      setInterval(
        refresh,
        30000
      );

    return () => {
      window.removeEventListener(
        "uptrend:inventory-refresh",
        refresh
      );

      window.removeEventListener(
        "uptrend:supplier-refresh",
        refresh
      );

      window.removeEventListener(
        "uptrend:sales-refresh",
        refresh
      );

      window.removeEventListener(
        "uptrend:expenses-refresh",
        refresh
      );

      window.removeEventListener(
        "storage",
        refresh
      );

      clearInterval(
        interval
      );
    };
  }, []);

  /* =======================================================
     SUPABASE REALTIME SUBSCRIPTION

     IMPORTANT:
     This is separate from data loading.

     We do NOT recreate the realtime channel every
     time refreshKey changes.
  ======================================================= */

  useEffect(() => {
    let active = true;
    let channel = null;

    const setupRealtime =
      async () => {
        try {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (
            !active ||
            !user
          ) {
            return;
          }

          channel =
            supabase
              .channel(
                `smart-alerts-${user.id}`
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table: "products",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table:
                    "uptrend_supplier_purchases",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table:
                    "uptrend_supplier_payments",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table:
                    "uptrend_inventory_activity",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table: "sales",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table: "expenses",
                  filter: `user_id=eq.${user.id}`,
                },
                () => {
                  setRefreshKey(
                    (value) =>
                      value + 1
                  );
                }
              )

              .subscribe();
        } catch (error) {
          console.error(
            "Smart Alerts realtime error:",
            error
          );
        }
      };

    setupRealtime();

    return () => {
      active = false;

      if (channel) {
        supabase.removeChannel(
          channel
        );
      }
    };
  }, []);

  /* =======================================================
     LOAD SUPABASE DATA
  ======================================================= */

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
                products: [],
                suppliers: [],
                purchases: [],
                supplierPayments: [],
                debts: [],
                payments: [],
                customers: [],
                targets: [],
                remoteSales: [],
                remoteExpenses: [],
                inventoryActivity: [],
              });
            }

            return;
          }

          const [
            productsResult,
            suppliersResult,
            purchasesResult,
            supplierPaymentsResult,
            debtsResult,
            paymentsResult,
            customersResult,
            targetsResult,
            salesResult,
            expensesResult,
            inventoryActivityResult,
          ] =
            await Promise.all([
              supabase
                .from("products")
                .select(
                  "id, name, cost_price, stock, low_stock_at, supplier_id, last_purchase_date, updated_at"
                )
                .eq(
                  "user_id",
                  user.id
                ),

              supabase
                .from(
                  "uptrend_suppliers"
                )
                .select(
                  "id, name, company_name, status"
                )
                .eq(
                  "user_id",
                  user.id
                ),

              supabase
                .from(
                  "uptrend_supplier_purchases"
                )
                .select("*")
                .eq(
                  "user_id",
                  user.id
                )
                .order(
                  "purchase_date",
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  "uptrend_supplier_payments"
                )
                .select("*")
                .eq(
                  "user_id",
                  user.id
                )
                .order(
                  "payment_date",
                  {
                    ascending:
                      false,
                  }
                ),

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
                    ascending:
                      false,
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

              supabase
                .from(
                  "uptrend_inventory_activity"
                )
                .select("*")
                .eq(
                  "user_id",
                  user.id
                )
                .order(
                  "occurred_at",
                  {
                    ascending:
                      false,
                  }
                )
                .limit(20),
            ]);

          const errors = [
            productsResult.error,
            suppliersResult.error,
            purchasesResult.error,
            supplierPaymentsResult.error,
            debtsResult.error,
            paymentsResult.error,
            customersResult.error,
            targetsResult.error,
            salesResult.error,
            expensesResult.error,
            inventoryActivityResult.error,
          ].filter(Boolean);

          if (errors.length > 0) {
            console.error(
              "Smart Alerts remote data error:",
              errors
            );

            return;
          }

          if (!active) {
            return;
          }

          setRemoteData({
            products:
              productsResult.data ||
              [],

            suppliers:
              suppliersResult.data ||
              [],

            purchases:
              purchasesResult.data ||
              [],

            supplierPayments:
              supplierPaymentsResult.data ||
              [],

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

            inventoryActivity:
              inventoryActivityResult.data ||
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

  /* =======================================================
     BUILD ALERTS
  ======================================================= */

  const alerts = useMemo(() => {
    const today =
      getLocalDateKey(
        new Date()
      );

    const currentStart =
      getDaysAgo(6);

    const previousStart =
      getDaysAgo(13);

    const dueSoonEnd =
      getDaysFromNow(3);

    const products =
      remoteData.products;

    const sales =
      remoteData.remoteSales;

    const expenses =
      remoteData.remoteExpenses;

    const result = [];

    /* =====================================================
       PRODUCT / INVENTORY
    ===================================================== */

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
          const stock =
            Number(
              product.stock || 0
            );

          const threshold =
            Number(
              product.low_stock_at ??
                5
            );

          return (
            stock > 0 &&
            stock <=
              threshold
          );
        })
        .sort(
          (a, b) =>
            Number(
              a.stock || 0
            ) -
            Number(
              b.stock || 0
            )
        );

    if (
      outOfStockProducts.length >
      0
    ) {
      const first =
        outOfStockProducts[0];

      result.push({
        id: "out-of-stock",
        type: "danger",
        icon: "⛔",
        title:
          "Product out of stock",
        message:
          outOfStockProducts.length ===
          1
            ? `${first.name} has reached 0 stock.`
            : `${outOfStockProducts.length} products have reached 0 stock.`,
      });
    }

    if (
      lowStockProducts.length >
      0
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
              )} ${
                Number(
                  first.stock || 0
                ) === 1
                  ? "unit"
                  : "units"
              } left, at or below its low-stock level.`
            : `${lowStockProducts.length} products are at or below their low-stock levels.`,
      });
    }

    /* =====================================================
       RECENT STOCK RECEIVED
    ===================================================== */

    const recentPurchaseActivity =
      remoteData.inventoryActivity.find(
        (item) =>
          item.reason ===
            "purchase" &&
          item.direction === "in"
      );

    if (
      recentPurchaseActivity
    ) {
      const occurredDate =
        String(
          recentPurchaseActivity.occurred_at ||
            ""
        ).slice(0, 10);

      if (
        occurredDate >=
        getDaysAgo(1)
      ) {
        result.push({
          id:
            "recent-stock-received",
          type: "positive",
          icon: "↑",
          title:
            "Stock received",
          message: `${
            recentPurchaseActivity.product_name
          } received +${Number(
            recentPurchaseActivity.quantity ||
              0
          ).toLocaleString(
            "en-NG"
          )} units${
            recentPurchaseActivity.supplier_name
              ? ` from ${recentPurchaseActivity.supplier_name}`
              : ""
          }.`,
        });
      }
    }

    /* =====================================================
       SUPPLIER PAYMENTS
    ===================================================== */

    const supplierPaymentTotals =
      {};

    remoteData.supplierPayments.forEach(
      (payment) => {
        if (
          !supplierPaymentTotals[
            payment.purchase_id
          ]
        ) {
          supplierPaymentTotals[
            payment.purchase_id
          ] = 0;
        }

        supplierPaymentTotals[
          payment.purchase_id
        ] += Number(
          payment.amount || 0
        );
      }
    );

    const enrichedSupplierPurchases =
      remoteData.purchases.map(
        (purchase) => {
          const total =
            Number(
              purchase.total_amount ||
                0
            );

          const paid =
            Math.min(
              total,
              Number(
                supplierPaymentTotals[
                  purchase.id
                ] || 0
              )
            );

          const balance =
            Math.max(
              total - paid,
              0
            );

          return {
            ...purchase,
            paid,
            balance,
            calculatedStatus:
              getSupplierPurchaseStatus(
                purchase,
                paid
              ),
          };
        }
      );

    const overdueSupplierPurchases =
      enrichedSupplierPurchases.filter(
        (purchase) =>
          purchase.balance > 0 &&
          purchase.calculatedStatus ===
            "overdue"
      );

    if (
      overdueSupplierPurchases.length >
      0
    ) {
      const totalOverdue =
        overdueSupplierPurchases.reduce(
          (sum, purchase) =>
            sum +
            Number(
              purchase.balance ||
                0
            ),
          0
        );

      const first =
        overdueSupplierPurchases[0];

      const supplier =
        remoteData.suppliers.find(
          (item) =>
            item.id ===
            first.supplier_id
        );

      result.push({
        id:
          "supplier-overdue",
        type: "danger",
        icon: "₦",
        title:
          "Supplier payment overdue",
        message:
          overdueSupplierPurchases.length ===
          1
            ? `${
                supplier?.name ||
                "A supplier"
              } is owed ${formatMoney(
                first.balance
              )} past the due date.`
            : `${overdueSupplierPurchases.length} supplier purchases are overdue, totaling ${formatMoney(
                totalOverdue
              )}.`,
      });
    }

    const supplierDueToday =
      enrichedSupplierPurchases.filter(
        (purchase) =>
          purchase.balance > 0 &&
          purchase.calculatedStatus !==
            "cancelled" &&
          purchase.calculatedStatus !==
            "paid" &&
          purchase.due_date ===
            today
      );

    if (
      supplierDueToday.length >
      0
    ) {
      const totalDue =
        supplierDueToday.reduce(
          (sum, purchase) =>
            sum +
            Number(
              purchase.balance ||
                0
            ),
          0
        );

      const first =
        supplierDueToday[0];

      const supplier =
        remoteData.suppliers.find(
          (item) =>
            item.id ===
            first.supplier_id
        );

      result.push({
        id:
          "supplier-due-today",
        type: "warning",
        icon: "◷",
        title:
          "Supplier payment due today",
        message:
          supplierDueToday.length ===
          1
            ? `${
                supplier?.name ||
                "A supplier"
              } is due ${formatMoney(
                first.balance
              )} today.`
            : `${supplierDueToday.length} supplier balances are due today, totaling ${formatMoney(
                totalDue
              )}.`,
      });
    }

    const supplierDueSoon =
      enrichedSupplierPurchases.filter(
        (purchase) =>
          purchase.balance > 0 &&
          purchase.calculatedStatus !==
            "cancelled" &&
          purchase.calculatedStatus !==
            "paid" &&
          purchase.due_date &&
          purchase.due_date >
            today &&
          purchase.due_date <=
            dueSoonEnd
      );

    if (
      supplierDueSoon.length >
      0
    ) {
      const totalDueSoon =
        supplierDueSoon.reduce(
          (sum, purchase) =>
            sum +
            Number(
              purchase.balance ||
                0
            ),
          0
        );

      result.push({
        id:
          "supplier-due-soon",
        type: "warning",
        icon: "◷",
        title:
          "Supplier payment due soon",
        message: `${
          supplierDueSoon.length
        } supplier ${
          supplierDueSoon.length ===
          1
            ? "balance is"
            : "balances are"
        } due within 3 days, totaling ${formatMoney(
          totalDueSoon
        )}.`,
      });
    }

    /* =====================================================
       CUSTOMER CREDIT
    ===================================================== */

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

          const paid =
            Math.min(
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
      overdueDebts.length >
      0
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

      result.push({
        id:
          "credit-overdue",
        type: "danger",
        icon: "₦",
        title:
          "Customer credit is overdue",
        message:
          overdueDebts.length ===
          1
            ? `${getDebtCustomerName(
                first,
                remoteData.customers
              )} has ${formatMoney(
                first.balance
              )} outstanding past the due date.`
            : `${overdueDebts.length} credit records are overdue, totaling ${formatMoney(
                totalOverdue
              )}.`,
      });
    }

    const dueTodayDebts =
      enrichedDebts.filter(
        (debt) =>
          debt.balance > 0 &&
          debt.calculatedStatus !==
            "cancelled" &&
          debt.calculatedStatus !==
            "paid" &&
          debt.due_date ===
            today
      );

    if (
      dueTodayDebts.length >
      0
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
        id:
          "credit-due-today",
        type: "warning",
        icon: "◷",
        title:
          "Credit payment due today",
        message:
          dueTodayDebts.length ===
          1
            ? `${getDebtCustomerName(
                dueTodayDebts[0],
                remoteData.customers
              )} has ${formatMoney(
                dueTodayDebts[0]
                  .balance
              )} due today.`
            : `${dueTodayDebts.length} credit records have payments due today, totaling ${formatMoney(
                totalDue
              )}.`,
      });
    }

    const dueSoonDebts =
      enrichedDebts.filter(
        (debt) =>
          debt.balance > 0 &&
          debt.calculatedStatus !==
            "cancelled" &&
          debt.calculatedStatus !==
            "paid" &&
          debt.due_date &&
          debt.due_date >
            today &&
          debt.due_date <=
            dueSoonEnd
      );

    if (
      dueSoonDebts.length >
      0
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
        id:
          "credit-due-soon",
        type: "warning",
        icon: "◷",
        title:
          "Credit payment due soon",
        message: `${
          dueSoonDebts.length
        } credit ${
          dueSoonDebts.length ===
          1
            ? "record is"
            : "records are"
        } due within 3 days, totaling ${formatMoney(
          totalDueSoon
        )}.`,
      });
    }

    /* =====================================================
       SALES / EXPENSES
    ===================================================== */

    const currentSales =
      sales.filter(
        (sale) => {
          const date =
            String(
              sale.sale_date ||
                sale.date ||
                ""
            ).slice(0, 10);

          return (
            date >=
            currentStart
          );
        }
      );

    const previousSales =
      sales.filter(
        (sale) => {
          const date =
            String(
              sale.sale_date ||
                sale.date ||
                ""
            ).slice(0, 10);

          return (
            date >=
              previousStart &&
            date <
              currentStart
          );
        }
      );

    const currentExpenses =
      expenses.filter(
        (expense) => {
          const date =
            String(
              expense.expense_date ||
                expense.date ||
                ""
            ).slice(0, 10);

          return (
            date >=
            currentStart
          );
        }
      );

    const previousExpenses =
      expenses.filter(
        (expense) => {
          const date =
            String(
              expense.expense_date ||
                expense.date ||
                ""
            ).slice(0, 10);

          return (
            date >=
              previousStart &&
            date <
              currentStart
          );
        }
      );

    const currentRevenue =
      currentSales.reduce(
        (sum, sale) =>
          sum +
          getSaleRevenue(
            sale
          ),
        0
      );

    const previousRevenue =
      previousSales.reduce(
        (sum, sale) =>
          sum +
          getSaleRevenue(
            sale
          ),
        0
      );

    const currentGrossProfit =
      currentSales.reduce(
        (sum, sale) =>
          sum +
          getSaleProfit(
            sale
          ),
        0
      );

    const previousGrossProfit =
      previousSales.reduce(
        (sum, sale) =>
          sum +
          getSaleProfit(
            sale
          ),
        0
      );

    const currentExpensesTotal =
      currentExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount ??
              expense.total ??
              0
          ),
        0
      );

    const previousExpensesTotal =
      previousExpenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount ??
              expense.total ??
              0
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

    if (
      currentExpensesTotal >
      currentGrossProfit
    ) {
      const gap =
        currentExpensesTotal -
        currentGrossProfit;

      result.push({
        id:
          "expense-pressure",
        type: "danger",
        icon: "₦",
        title:
          "Expenses exceed gross profit",
        message: `Your last 7 days of expenses are ${formatMoney(
          gap
        )} above gross profit.`,
      });
    }

    if (
      previousRevenue > 0 &&
      revenueChange <= -20
    ) {
      result.push({
        id:
          "sales-decline",
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

    if (
      previousRevenue > 0 &&
      currentRevenue > 0 &&
      marginChange <= -5
    ) {
      result.push({
        id:
          "margin-decline",
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

    if (
      previousExpensesTotal >
        0 &&
      expenseChange >= 20
    ) {
      result.push({
        id:
          "expense-growth",
        type: "warning",
        icon: "↗",
        title:
          "Expenses are rising",
        message: `Expenses are up ${expenseChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    if (
      previousRevenue > 0 &&
      revenueChange >= 20
    ) {
      result.push({
        id:
          "revenue-growth",
        type: "positive",
        icon: "↗",
        title:
          "Revenue is growing",
        message: `Revenue is up ${revenueChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    if (
      previousGrossProfit >
        0 &&
      profitChange >= 20
    ) {
      result.push({
        id:
          "profit-growth",
        type: "positive",
        icon: "✓",
        title:
          "Gross profit is growing",
        message: `Gross profit is up ${profitChange.toFixed(
          0
        )}% compared with the previous 7-day period.`,
      });
    }

    if (
      previousRevenue > 0 &&
      currentRevenue > 0 &&
      marginChange >= 5
    ) {
      result.push({
        id:
          "margin-growth",
        type: "positive",
        icon: "％",
        title:
          "Profit margin improved",
        message: `Gross margin improved by ${marginChange.toFixed(
          1
        )} percentage points.`,
      });
    }

    /* =====================================================
       BUSINESS TARGETS
    ===================================================== */

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
        sales.filter(
          (sale) => {
            const date =
              String(
                sale.sale_date ||
                  sale.date ||
                  ""
              ).slice(0, 10);

            return (
              date >=
                targetStart &&
              date <=
                targetEnd
            );
          }
        );

      const targetExpenses =
        expenses.filter(
          (expense) => {
            const date =
              String(
                expense.expense_date ||
                  expense.date ||
                  ""
              ).slice(0, 10);

            return (
              date >=
                targetStart &&
              date <=
                targetEnd
            );
          }
        );

      const targetRevenue =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            getSaleRevenue(
              sale
            ),
          0
        );

      const targetGrossProfit =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            getSaleProfit(
              sale
            ),
          0
        );

      const targetUnits =
        targetSales.reduce(
          (sum, sale) =>
            sum +
            Number(
              sale.quantity ||
                0
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

      if (
        revenueTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetRevenue,
            revenueTarget
          );

        if (
          progress >= 100
        ) {
          result.push({
            id:
              "target-revenue-reached",
            type: "positive",
            icon: "✓",
            title:
              "Revenue target reached",
            message: `Revenue has reached ${formatMoney(
              targetRevenue
            )} against a target of ${formatMoney(
              revenueTarget
            )}.`,
          });
        } else if (
          progress < 75
        ) {
          result.push({
            id:
              "target-revenue-warning",
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

      if (
        grossProfitTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetGrossProfit,
            grossProfitTarget
          );

        if (
          progress >= 100
        ) {
          result.push({
            id:
              "target-profit-reached",
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
            id:
              "target-profit-warning",
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

      if (
        expenseLimit > 0 &&
        targetExpensesTotal >
          expenseLimit
      ) {
        const excess =
          targetExpensesTotal -
          expenseLimit;

        result.push({
          id:
            "target-expense-limit",
          type: "danger",
          icon: "₦",
          title:
            "Business target expense limit exceeded",
          message: `Expenses are ${formatMoney(
            excess
          )} above the current target limit.`,
        });
      }

      if (
        unitsTarget > 0
      ) {
        const progress =
          getTargetProgress(
            targetUnits,
            unitsTarget
          );

        if (
          progress >= 100
        ) {
          result.push({
            id:
              "target-units-reached",
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
            id:
              "target-units-warning",
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

    /* =====================================================
       APPLY NOTIFICATION PREFERENCES
    ===================================================== */

    if (!notificationPreferences.enabled) {
      return [];
    }

    const filteredAlerts =
      result.filter((alert) => {
        const id = alert.id || "";

        if (
          [
            "out-of-stock",
            "low-stock",
            "recent-stock-received",
          ].includes(id)
        ) {
          return notificationPreferences.inventory;
        }

        if (
          [
            "supplier-overdue",
            "supplier-due-today",
            "supplier-due-soon",
            "credit-overdue",
            "credit-due-today",
            "credit-due-soon",
          ].includes(id)
        ) {
          return notificationPreferences.payments;
        }

        if (
          [
            "expense-pressure",
            "sales-decline",
            "margin-decline",
            "expense-growth",
            "revenue-growth",
            "profit-growth",
            "margin-growth",
          ].includes(id)
        ) {
          return notificationPreferences.salesExpenses;
        }

        if (
          id.startsWith("target-")
        ) {
          return notificationPreferences.targets;
        }

        return true;
      });

    /* =====================================================
       MAXIMUM DISPLAYED ALERTS
    ===================================================== */

    return filteredAlerts.slice(
      0,
      8
    );
  }, [
    remoteData,
    notificationPreferences,
  ]);

  /* =======================================================
     CREATE STABLE NOTIFICATION SIGNATURE
  ======================================================= */

  const notificationSignature =
    useMemo(() => {
      return alerts
        .map(
          (alert) =>
            [
              alert.id,
              alert.type,
              alert.title,
              alert.message,
            ].join("::")
        )
        .join("||");
    }, [alerts]);

  /* =======================================================
     REPORT ALERT STATE TO HEADER
  ======================================================= */

  useEffect(() => {
    if (!onAlertsChange) {
      return;
    }

    onAlertsChange({
      count: alerts.length,
      signature:
        notificationSignature,
    });
  }, [
    alerts.length,
    notificationSignature,
    onAlertsChange,
  ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className={`smart-alerts ${
        isOpen
          ? "smart-alerts-open"
          : "smart-alerts-closed"
      }`}
      aria-hidden={!isOpen}
    >
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

      {alerts.length ===
      0 ? (
        <div className="smart-alerts-empty">

          <div className="smart-alerts-empty-icon">
            ✓
          </div>

          <strong>
            No important alerts
          </strong>

          <p>
            UpTrend will notify you
            when something needs
            attention.
          </p>

        </div>
      ) : (
        <div className="smart-alerts-list">

          {alerts.map(
            (alert) => (
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
            )
          )}

        </div>
      )}
    </div>
  );
}

export default SmartAlerts;