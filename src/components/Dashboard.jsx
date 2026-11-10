import "./Dashboard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Banknote,
  Users,
  Receipt,
  Package,
  TrendingUp,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import {
  saveDashboardSnapshot,
  getDashboardSnapshot,
} from "../lib/localDb";
import { formatMoney, formatNumber } from "../utils/numberFormat";
import { logAudit } from "../utils/auditLog";
import BusinessGate from "../Business/BusinessGate";

function Dashboard({
  onRecordSale,
  onRecordExpense,
  onAddProduct,
  subscription,
  onUpgrade,
}) {
  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [salePayments, setSalePayments] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [saleReturns, setSaleReturns] = useState([]);
  const [customerDebts, setCustomerDebts] = useState([]);
  const [customerDebtPayments, setCustomerDebtPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [financeTransactions, setFinanceTransactions] = useState([]);
  const [inventoryActivity, setInventoryActivity] = useState([]);

  const [finance, setFinance] =
    useState({
      openingBalance: 0,
    });

  const [bankOpeningBalance, setBankOpeningBalance] =
    useState(0);

  const [openingCashSet, setOpeningCashSet] =
    useState(false);

  const [openingInput, setOpeningInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showOpeningForm, setShowOpeningForm] =
    useState(false);
  const [showAllCustomerDebts, setShowAllCustomerDebts] =
    useState(false);

  const lineChartScrollRef = useRef(null);
  const barChartScrollRef = useRef(null);
  const loadData = async () => {
    try {
      setError("");

      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      const user = session?.user;

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

        setOpeningCashSet(false);
        setOpeningInput("");
        return;
      }

      if (!navigator.onLine) {
        const snapshot = await getDashboardSnapshot(user.id);

        if (!snapshot) {
          throw new Error(
            "You're offline and no saved Dashboard data is available on this device yet."
          );
        }

        setSales(snapshot.sales || []);
        setProducts(snapshot.products || []);
        setExpenses(snapshot.expenses || []);
        setSalePayments(snapshot.salePayments || []);
        setSupplierPayments(snapshot.supplierPayments || []);
        setSaleReturns(snapshot.saleReturns || []);
        setCustomerDebts(snapshot.customerDebts || []);
        setCustomerDebtPayments(snapshot.customerDebtPayments || []);
        setCustomers(snapshot.customers || []);
        setFinanceTransactions(snapshot.financeTransactions || []);
        setInventoryActivity(snapshot.inventoryActivity || []);

        setBankOpeningBalance(
          Number(snapshot.bankOpeningBalance || 0)
        );

        setFinance({
          openingBalance: Number(snapshot.openingBalance || 0),
        });

        setOpeningCashSet(Boolean(snapshot.openingCashSet));

        setOpeningInput(
          snapshot.openingBalance
            ? String(snapshot.openingBalance)
            : ""
        );

        return;
      }

      const [
        salesResult,
        productsResult,
        expensesResult,
        financeResult,
        salePaymentsResult,
        supplierPaymentsResult,
        saleReturnsResult,
        inventoryActivityResult,
        customerDebtsResult,
        customerDebtPaymentsResult,
        customersResult,
        financeAccountResult,
        financeTransactionsResult,
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

        supabase
          .from("uptrend_sale_payments")
          .select(
            "sale_id,amount,payment_method,finance_transaction_id,created_at"
          )
          .eq("user_id", user.id),

        supabase
          .from("uptrend_supplier_payments")
          .select(
            "purchase_id,amount,payment_method,finance_transaction_id,payment_date,created_at"
          )
          .eq("user_id", user.id),

        supabase
          .from("uptrend_sale_returns")
          .select(
            "sale_id,quantity,refund_amount,refund_method,refund_finance_transaction_id,return_date"
          )
          .eq("user_id", user.id),

        supabase
          .from("uptrend_inventory_activity")
          .select(
            "id,product_id,product_name,direction,quantity,unit_cost,total_cost,sale_value,stock_before,stock_after,occurred_at,created_at"
          )
          .eq("user_id", user.id)
          .order("occurred_at", {
            ascending: true,
          }),

        supabase
          .from("uptrend_credit_debts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("uptrend_credit_debt_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("payment_date", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("uptrend_customers")
          .select("id,name,phone,email")
          .eq("user_id", user.id)
          .order("name", {
            ascending: true,
          }),

        supabase.rpc(
          "get_or_create_uptrend_finance_account"
        ),

        supabase
          .from("uptrend_finance_transactions")
          .select(
            "id,type,amount,status,category,description,reference,created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          }),
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

      if (salePaymentsResult.error) {
        throw salePaymentsResult.error;
      }

      if (supplierPaymentsResult.error) {
        throw supplierPaymentsResult.error;
      }

      if (saleReturnsResult.error) {
        throw saleReturnsResult.error;
      }

      if (customerDebtsResult.error) {
        throw customerDebtsResult.error;
      }

      if (customerDebtPaymentsResult.error) {
        throw customerDebtPaymentsResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (financeAccountResult.error) {
        throw financeAccountResult.error;
      }

      if (financeTransactionsResult.error) {
        throw financeTransactionsResult.error;
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

            paymentMethod:
              sale.payment_method || "",

            financeTransactionId:
              sale.finance_transaction_id || null,

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

            paymentMethod:
              expense.payment_method || "cash",

            financeTransactionId:
              expense.finance_transaction_id || null,

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

      setOpeningCashSet(
        financeResult.data !== null
      );

      const account =
        Array.isArray(financeAccountResult.data)
          ? financeAccountResult.data[0]
          : financeAccountResult.data;

      const mappedSalePayments =
        (salePaymentsResult.data || []).map(
          (payment) => ({
            saleId: payment.sale_id,
            amount: Number(payment.amount || 0),
            paymentMethod:
              payment.payment_method || "",
            financeTransactionId:
              payment.finance_transaction_id || null,
            date:
              payment.created_at || "",
          })
        );

      const mappedSupplierPayments =
        (supplierPaymentsResult.data || []).map(
          (payment) => ({
            purchaseId: payment.purchase_id,
            amount: Number(payment.amount || 0),
            paymentMethod:
              payment.payment_method || "",
            financeTransactionId:
              payment.finance_transaction_id || null,
            date:
              payment.payment_date ||
              payment.created_at ||
              "",
          })
        );

      const mappedSaleReturns =
        (saleReturnsResult.data || []).map(
          (item) => ({
            saleId: item.sale_id,
            amount: Number(
              item.refund_amount || 0
            ),
            quantity: Number(
              item.quantity || 0
            ),
            date: item.return_date || "",
            refundMethod:
              item.refund_method || "",
            financeTransactionId:
              item.refund_finance_transaction_id ||
              null,
          })
        );

      const mappedFinanceTransactions =
        (financeTransactionsResult.data || []).map(
          (transaction) => ({
            id: transaction.id,
            type: transaction.type,
            amount: Number(
              transaction.amount || 0
            ),
            status: transaction.status,
            category: transaction.category,
            description: transaction.description,
            reference: transaction.reference,
            createdAt: transaction.created_at,
          })
        );

      const mappedInventoryActivity =
        (inventoryActivityResult.data || []).map(
          (activity) => ({
            id: activity.id,
            productId: activity.product_id,
            productName:
              activity.product_name || "",
            direction:
              activity.direction || "",
            quantity:
              Number(activity.quantity || 0),
            unitCost:
              Number(activity.unit_cost || 0),
            totalCost:
              Number(activity.total_cost || 0),
            saleValue:
              Number(activity.sale_value || 0),
            stockBefore:
              Number(activity.stock_before || 0),
            stockAfter:
              Number(activity.stock_after || 0),
            occurredAt:
              activity.occurred_at,
            createdAt:
              activity.created_at,
          })
        );

      setSales(mappedSales);
      setProducts(mappedProducts);
      setExpenses(mappedExpenses);
      setSalePayments(mappedSalePayments);
      setSupplierPayments(
        mappedSupplierPayments
      );
      setSaleReturns(mappedSaleReturns);

      setCustomerDebts(
        customerDebtsResult.data || []
      );

      setCustomerDebtPayments(
        customerDebtPaymentsResult.data || []
      );

      setCustomers(
        customersResult.data || []
      );

      setFinanceTransactions(
        mappedFinanceTransactions
      );

      setInventoryActivity(
        mappedInventoryActivity
      );

      setBankOpeningBalance(
        Number(
          account?.opening_balance || 0
        )
      );

      setFinance({
        openingBalance,
      });

      setOpeningInput(
        openingBalance
          ? String(openingBalance)
          : ""
      );

      try {
        await saveDashboardSnapshot(user.id, {
          sales: mappedSales,
          products: mappedProducts,
          expenses: mappedExpenses,
          salePayments: mappedSalePayments,
          supplierPayments: mappedSupplierPayments,
          saleReturns: mappedSaleReturns,
          customerDebts: customerDebtsResult.data || [],
          customerDebtPayments: customerDebtPaymentsResult.data || [],
          customers: customersResult.data || [],
          financeTransactions: mappedFinanceTransactions,
          inventoryActivity: mappedInventoryActivity,
          openingBalance,
          openingCashSet: financeResult.data !== null,
          bankOpeningBalance: Number(account?.opening_balance || 0),
        });
      } catch (cacheError) {
        console.warn("Dashboard snapshot could not be saved:", cacheError);
      }
    } catch (loadError) {
      console.error(
        "Dashboard data load failed:",
        loadError
      );

      let restored = false;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const snapshot = await getDashboardSnapshot(
            session.user.id
          );

          if (snapshot) {
            setSales(snapshot.sales || []);
            setProducts(snapshot.products || []);
            setExpenses(snapshot.expenses || []);
            setSalePayments(snapshot.salePayments || []);
            setSupplierPayments(snapshot.supplierPayments || []);
            setSaleReturns(snapshot.saleReturns || []);
            setCustomerDebts(snapshot.customerDebts || []);
            setCustomerDebtPayments(snapshot.customerDebtPayments || []);
            setCustomers(snapshot.customers || []);
            setFinanceTransactions(snapshot.financeTransactions || []);
            setInventoryActivity(snapshot.inventoryActivity || []);

            setBankOpeningBalance(
              Number(snapshot.bankOpeningBalance || 0)
            );

            setFinance({
              openingBalance: Number(snapshot.openingBalance || 0),
            });

            setOpeningCashSet(Boolean(snapshot.openingCashSet));

            setOpeningInput(
              snapshot.openingBalance
                ? String(snapshot.openingBalance)
                : ""
            );

            restored = true;

            console.warn(
              "Dashboard is showing previously saved data. It may not include the latest changes."
            );
          }
        }
      } catch (cacheError) {
        console.warn(
          "Could not restore saved Dashboard data:",
          cacheError
        );
      }

      if (!restored) {
        setError(
          loadError?.message ||
            "Unable to load dashboard data."
        );
      }
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


  const returnsBySale = useMemo(() => {
    const result = new Map();

    saleReturns.forEach((item) => {
      const current = result.get(item.saleId) || {
        amount: 0,
        quantity: 0,
      };

      current.amount += Number(item.amount || 0);
      current.quantity += Number(item.quantity || 0);

      result.set(item.saleId, current);
    });

    return result;
  }, [saleReturns]);

  const getNetSale = (sale) => {
    const returned = returnsBySale.get(sale.id) || {
      amount: 0,
      quantity: 0,
    };

    const returnedCost =
      Number(sale.costPrice || 0) *
      Number(returned.quantity || 0);

    return {
      revenue: Math.max(
        0,
        Number(sale.totalSelling || 0) -
          Number(returned.amount || 0)
      ),
      profit:
        Number(sale.grossProfit || 0) -
        (Number(returned.amount || 0) - returnedCost),
      returnedAmount: Number(returned.amount || 0),
      returnedQuantity: Number(returned.quantity || 0),
    };
  };

  const financial = useMemo(() => {
    const completedBankTransactions =
      financeTransactions.filter(
        (transaction) =>
          transaction.status === "completed"
      );

    const bankCredits =
      completedBankTransactions
        .filter(
          (transaction) =>
            transaction.type === "credit"
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Number(
              transaction.amount || 0
            ),
          0
        );

    const bankDebits =
      completedBankTransactions
        .filter(
          (transaction) =>
            transaction.type === "debit"
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Number(
              transaction.amount || 0
            ),
          0
        );

    const cashBySale = new Map();

    salePayments.forEach((payment) => {
      if (
        payment.paymentMethod !== "cash"
      ) {
        return;
      }

      cashBySale.set(
        payment.saleId,
        (cashBySale.get(payment.saleId) || 0) +
          Number(payment.amount || 0)
      );
    });

    const cashSales =
      sales.reduce((sum, sale) => {
        if (cashBySale.has(sale.id)) {
          return (
            sum +
            Number(
              cashBySale.get(sale.id) || 0
            )
          );
        }

        return sale.paymentMethod === "cash"
          ? sum +
            Number(
              sale.totalSelling || 0
            )
          : sum;
      }, 0);

    const cashExpenses =
      expenses
        .filter(
          (expense) =>
            expense.paymentMethod === "cash"
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        );

    const cashSupplierPayments =
      supplierPayments
        .filter(
          (payment) =>
            payment.paymentMethod ===
            "cash"
        )
        .reduce(
          (sum, payment) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        );

    const cashRefunds =
      saleReturns
        .filter(
          (item) =>
            item.refundMethod ===
            "cash"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount || 0
            ),
          0
        );

    // A debt payment is an initial sale payment if the same
    // sale, amount and exact creation timestamp exist in both ledgers.
    // Keep the sale-ledger entry and exclude the duplicate debt entry.
    const isDuplicateInitialDebtPayment = (payment) => {
      const debt = customerDebts.find(
        (item) => item.id === payment.debt_id
      );

      if (!debt?.sale_id || !payment.created_at) {
        return false;
      }

      const paymentTime = new Date(payment.created_at).getTime();

      if (!Number.isFinite(paymentTime)) {
        return false;
      }

      return salePayments.some((salePayment) => {
        if (salePayment.saleId !== debt.sale_id) {
          return false;
        }

        const salePaymentTime = new Date(salePayment.date).getTime();

        return (
          Number.isFinite(salePaymentTime) &&
          salePaymentTime === paymentTime &&
          Math.abs(
            Number(salePayment.amount || 0) -
            Number(payment.amount || 0)
          ) < 0.001
        );
      });
    };

    const cashDebtRepayments = customerDebtPayments.reduce(
      (sum, payment) => {
        const method = String(
          payment.payment_method || ""
        ).trim().toLowerCase();

        // Blank payment methods default to cash.
        if (
          (method !== "cash" && method !== "") ||
          isDuplicateInitialDebtPayment(payment)
        ) {
          return sum;
        }

        return sum + Number(payment.amount || 0);
      },
      0
    );

    const bankDebtRepayments = customerDebtPayments.reduce(
      (sum, payment) => {
        const method = String(
          payment.payment_method || ""
        ).trim().toLowerCase();

        if (
          !["bank", "transfer", "pos"].includes(method) ||
          isDuplicateInitialDebtPayment(payment)
        ) {
          return sum;
        }

        // This table has no finance_transaction_id column, so only
        // suppress an extra credit when amount AND timestamp match exactly.
        const paymentTime = new Date(
          payment.created_at || payment.payment_date
        ).getTime();

        const alreadyInFinanceLedger =
          Number.isFinite(paymentTime) &&
          financeTransactions.some((transaction) => {
            if (
              transaction.status !== "completed" ||
              transaction.type !== "credit" ||
              Math.abs(
                Number(transaction.amount || 0) -
                Number(payment.amount || 0)
              ) >= 0.001
            ) {
              return false;
            }

            const transactionTime = new Date(
              transaction.createdAt
            ).getTime();

            return (
              Number.isFinite(transactionTime) &&
              transactionTime === paymentTime
            );
          });

        return alreadyInFinanceLedger
          ? sum
          : sum + Number(payment.amount || 0);
      },
      0
    );

    const cashIn =
      cashSales + cashDebtRepayments;

    const cashOut =
      cashExpenses +
      cashSupplierPayments +
      cashRefunds;

    const cashDeposits = completedBankTransactions
      .filter(
        (transaction) =>
          transaction.type === "credit" &&
          String(transaction.category || "").toLowerCase() === "cash_deposit"
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

    const cashWithdrawals = completedBankTransactions
      .filter(
        (transaction) =>
          transaction.type === "debit" &&
          String(transaction.category || "").toLowerCase() === "cash_withdrawal"
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

    const cashAtHand =
      Number(finance.openingBalance || 0) +
      cashIn +
      cashWithdrawals -
      cashOut -
      cashDeposits;

    const cashInBank =
      bankCredits +
      bankDebtRepayments -
      bankDebits;

    const totalMoney =
      cashAtHand + cashInBank;

    const revenue =
      sales.reduce(
        (sum, sale) =>
          sum + getNetSale(sale).revenue,
        0
      );

    const grossProfit =
      sales.reduce(
        (sum, sale) =>
          sum + getNetSale(sale).profit,
        0
      );

    const totalExpenses =
      expenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    return {
      openingCash:
        Number(
          finance.openingBalance || 0
        ),

      cashIn,
      cashOut,
      cashAtHand,

      bankOpeningBalance:
        Number(
          bankOpeningBalance || 0
        ),

      bankCredits,
      bankDebits,
      cashInBank,
      totalMoney,

      revenue,
      grossProfit,

      expenses:
        totalExpenses,

      netProfit:
        grossProfit -
        totalExpenses,

      cashSales,
      cashExpenses,
      cashSupplierPayments,
      cashRefunds,
    };
  }, [
    sales,
    expenses,
    finance,
    salePayments,
    supplierPayments,
    saleReturns,
    financeTransactions,
    bankOpeningBalance,
    returnsBySale,
    customerDebts,
    customerDebtPayments,
  ]);

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

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const today =
    getLocalDateKey(new Date());

  const [historicalAccessOpen, setHistoricalAccessOpen] =
    useState(false);

  const freeHistoryCutoff = useMemo(() => {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() - 7);
    return getLocalDateKey(date);
  }, [today]);

  const handleSelectedDateChange = (nextDate) => {
    if (!isBusiness && nextDate < freeHistoryCutoff) {
      setHistoricalAccessOpen(true);
      return;
    }

    setSelectedDate(nextDate);
  };

  const todaySalesFromSales = sales
    .filter((sale) => sale.date === selectedDate)
    .reduce(
      (sum, sale) =>
        sum + Number(sale.totalSelling || 0),
      0
    );

  const sameDayReturns = saleReturns.filter((item) => {
    const originalSale = sales.find(
      (sale) => sale.id === item.saleId
    );

    return (
      item.date === selectedDate
    );
  });

  const todayRefunds = sameDayReturns.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const todayReturnedCost = sameDayReturns.reduce((sum, item) => {
    const originalSale = sales.find(
      (sale) => sale.id === item.saleId
    );

    return sum +
      Number(originalSale?.costPrice || 0) *
      Number(item.quantity || 0);
  }, 0);

  const todaySales = Math.max(
    0,
    todaySalesFromSales - todayRefunds
  );

  const todayProfit =
    sales
      .filter((sale) => sale.date === selectedDate)
      .reduce(
        (sum, sale) =>
          sum + Number(sale.grossProfit || 0),
        0
      ) -
    (todayRefunds - todayReturnedCost);


  const selectedDateInventory = useMemo(() => {
    // Use actual product stock for today's inventory valuation.
    if (selectedDate === today) {
      return products.reduce(
        (result, product) => {
          const stock = Number(product.stock || 0);
          const cost = Number(product.costPrice || 0);

          result.units += stock;
          result.value += stock * cost;

          return result;
        },
        { value: 0, units: 0 }
      );
    }

    // Reconstruct historical inventory from activity snapshots.
    const endOfSelectedDate =
      new Date(`${selectedDate}T23:59:59.999`);

    const latestByProduct = new Map();

    inventoryActivity.forEach((activity) => {
      if (!activity.productId) return;

      const occurredAt = new Date(
        activity.occurredAt || activity.createdAt
      );

      if (
        Number.isNaN(occurredAt.getTime()) ||
        occurredAt > endOfSelectedDate
      ) {
        return;
      }

      const existing = latestByProduct.get(activity.productId);

      const existingTime = existing
        ? new Date(existing.occurredAt || existing.createdAt).getTime()
        : -Infinity;

      if (occurredAt.getTime() >= existingTime) {
        latestByProduct.set(activity.productId, activity);
      }
    });

    let value = 0;
    let units = 0;

    latestByProduct.forEach((activity) => {
      const stock = Number(activity.stockAfter ?? 0);
      const cost = Number(activity.unitCost ?? 0);

      units += stock;
      value += stock * cost;
    });

    return { value, units };
  }, [inventoryActivity, products, selectedDate, today]);

  const inventoryValue =
    selectedDateInventory.value;

  const stockUnits =
    selectedDateInventory.units;

  const selectedDateBalance = useMemo(() => {
    const endOfSelectedDate =
      new Date(`${selectedDate}T23:59:59.999`);

    const isOnOrBeforeSelectedDate = (value) => {
      if (!value) return false;

      const date = new Date(value);

      return (
        !Number.isNaN(date.getTime()) &&
        date <= endOfSelectedDate
      );
    };

    // CASH
    // Cash comes directly from payment/expense ledgers.
    const selectedCashSales = salePayments.reduce(
      (sum, payment) => {
        if (
          payment.paymentMethod !== "cash" ||
          !isOnOrBeforeSelectedDate(payment.date)
        ) {
          return sum;
        }

        return sum + Number(payment.amount || 0);
      },
      0
    );


const selectedCashDebtPayments =
  customerDebtPayments.reduce((sum, payment) => {
    const method = String(
      payment.payment_method || ""
    ).toLowerCase();

    if (
      (method !== "cash" && method !== "") ||
      !isOnOrBeforeSelectedDate(
        payment.payment_date || payment.created_at
      )
    ) {
      return sum;
    }

    const debt = customerDebts.find(
      (item) => item.id === payment.debt_id
    );

    // Exclude an initial payment duplicated in the sale ledger.
    // Match by sale, amount, and a short creation-time window.
    const paymentTime = new Date(
      payment.created_at || payment.payment_date
    ).getTime();

    const isInitialPayment =
      Boolean(debt?.sale_id) &&
      Number.isFinite(paymentTime) &&
      salePayments.some((salePayment) => {
        if (salePayment.saleId !== debt.sale_id) {
          return false;
        }

        const salePaymentTime = new Date(
          salePayment.date
        ).getTime();

        return (
          Number.isFinite(salePaymentTime) &&
          salePaymentTime === paymentTime &&
          Math.abs(
            Number(salePayment.amount || 0) -
            Number(payment.amount || 0)
          ) < 0.001
        );
      });

    return isInitialPayment
      ? sum
      : sum + Number(payment.amount || 0);
  }, 0);


    const selectedCashExpenses = expenses.reduce(
      (sum, expense) => {
        if (
          expense.paymentMethod !== "cash" ||
          !isOnOrBeforeSelectedDate(expense.date)
        ) {
          return sum;
        }

        return sum + Number(expense.amount || 0);
      },
      0
    );

    const selectedCashSupplierPayments =
      supplierPayments.reduce(
        (sum, payment) => {
          if (
            payment.paymentMethod !== "cash" ||
            !isOnOrBeforeSelectedDate(payment.date)
          ) {
            return sum;
          }

          return sum + Number(payment.amount || 0);
        },
        0
      );

    const selectedCashRefunds = saleReturns.reduce(
      (sum, refund) => {
        if (
          refund.refundMethod !== "cash" ||
          !isOnOrBeforeSelectedDate(refund.date)
        ) {
          return sum;
        }

        return sum + Number(refund.amount || 0);
      },
      0
    );

    const selectedCashDeposits = financeTransactions
      .filter(
        (transaction) =>
          transaction.status === "completed" &&
          transaction.type === "credit" &&
          String(transaction.category || "").toLowerCase() === "cash_deposit" &&
          isOnOrBeforeSelectedDate(transaction.createdAt)
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

    const selectedCashWithdrawals = financeTransactions
      .filter(
        (transaction) =>
          transaction.status === "completed" &&
          transaction.type === "debit" &&
          String(transaction.category || "").toLowerCase() === "cash_withdrawal" &&
          isOnOrBeforeSelectedDate(transaction.createdAt)
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

    const closingCash =
      Number(finance.openingBalance || 0) +
      selectedCashSales +
      selectedCashDebtPayments +
      selectedCashWithdrawals -
      selectedCashExpenses -
      selectedCashSupplierPayments -
      selectedCashRefunds -
      selectedCashDeposits;

    // BANK
    // Sale transfers are already represented by their linked
    // finance transactions, so they are NOT added again here.
    const selectedBankCredits =
      financeTransactions
        .filter(
          (transaction) =>
            transaction.status === "completed" &&
            transaction.type === "credit" &&
            isOnOrBeforeSelectedDate(
              transaction.createdAt
            )
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

    const selectedBankDebits =
      financeTransactions
        .filter(
          (transaction) =>
            transaction.status === "completed" &&
            transaction.type === "debit" &&
            isOnOrBeforeSelectedDate(
              transaction.createdAt
            )
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

    const selectedBankDebtPayments =
      customerDebtPayments.reduce((sum, payment) => {
        const method = String(
          payment.payment_method || ""
        ).trim().toLowerCase();

        const isBankPayment =
          method === "bank" ||
          method === "transfer" ||
          method === "pos";

        if (
          !isBankPayment ||
          !isOnOrBeforeSelectedDate(
            payment.payment_date || payment.created_at
          )
        ) {
          return sum;
        }

        // Do not add a debt repayment separately if a completed
        // finance transaction already represents the same amount
        // near the payment's recorded timestamp.
        const paymentTime = new Date(
          payment.created_at || payment.payment_date
        ).getTime();

        const alreadyInFinanceLedger =
          Number.isFinite(paymentTime) &&
          financeTransactions.some((transaction) => {
            if (
              transaction.status !== "completed" ||
              transaction.type !== "credit" ||
              Math.abs(
                Number(transaction.amount || 0) -
                Number(payment.amount || 0)
              ) >= 0.001
            ) {
              return false;
            }

            const transactionTime = new Date(
              transaction.createdAt
            ).getTime();

            return (
              Number.isFinite(transactionTime) &&
              Math.abs(transactionTime - paymentTime) <= 120000
            );
          });

        return alreadyInFinanceLedger
          ? sum
          : sum + Number(payment.amount || 0);
      }, 0);

    const closingBank =
      Number(bankOpeningBalance || 0) +
      selectedBankCredits +
      selectedBankDebtPayments -
      selectedBankDebits;

    return {
      cash: closingCash,
      bank: closingBank,
      total: closingCash + closingBank,
    };
  }, [
    selectedDate,
    salePayments,
    customerDebtPayments,
    expenses,
    supplierPayments,
    saleReturns,
    financeTransactions,
    finance,
    bankOpeningBalance,
    customerDebts,
  ]);

  const selectedDateDebtData = useMemo(() => {
    const selectedEnd = new Date(
      `${selectedDate}T23:59:59.999`
    );

    const toDate = (value) => {
      if (!value) return null;

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    };

    const paymentTotalsByDebt = new Map();

    customerDebtPayments.forEach((payment) => {
      const paymentDate = toDate(
        payment.payment_date
      );

      if (
        !paymentDate ||
        paymentDate > selectedEnd
      ) {
        return;
      }

      const current =
        paymentTotalsByDebt.get(
          payment.debt_id
        ) || 0;

      paymentTotalsByDebt.set(
        payment.debt_id,
        current +
          Number(payment.amount || 0)
      );
    });

    const customerMap = new Map(
      customers.map((customer) => [
        customer.id,
        customer,
      ])
    );

    const activeDebts = [];

    customerDebts.forEach((debt) => {
      const createdAt = toDate(
        debt.created_at
      );

      if (
        !createdAt ||
        createdAt > selectedEnd
      ) {
        return;
      }

      if (debt.status === "cancelled") {
        return;
      }

      const originalAmount = Number(
        debt.original_amount || 0
      );

      const paid = Math.min(
        originalAmount,
        Number(
          paymentTotalsByDebt.get(debt.id) || 0
        )
      );

      const outstanding = Math.max(
        originalAmount - paid,
        0
      );

      if (outstanding <= 0) {
        return;
      }

      let status = "Pending";

      if (
        debt.due_date &&
        debt.due_date < selectedDate
      ) {
        status = "Overdue";
      }

      activeDebts.push({
        ...debt,
        customer:
          customerMap.get(
            debt.customer_id
          ) || null,
        originalAmount,
        paid,
        outstanding,
        status,
      });
    });

    activeDebts.sort(
      (a, b) =>
        Number(b.outstanding || 0) -
        Number(a.outstanding || 0)
    );

    const totalOutstanding =
      activeDebts.reduce(
        (sum, debt) =>
          sum +
          Number(
            debt.outstanding || 0
          ),
        0
      );

    return {
      debts: activeDebts,
      totalOutstanding,
    };
  }, [
    selectedDate,
    customerDebts,
    customerDebtPayments,
    customers,
  ]);

  const selectedDateCustomerDebt =
    selectedDateDebtData.totalOutstanding;

  const selectedDateCollected = useMemo(() => {
    const localDateKey = (value) => {
      if (!value) return "";

      const raw = String(value);

      // A database DATE value is already the correct local calendar day.
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) {
        return raw;
      }

      const date = new Date(raw);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    };

    // Only count sale payments received on the selected day.
    const salesCollected = salePayments
      .filter(
        (payment) =>
          localDateKey(payment.date) === selectedDate
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.amount || 0),
        0
      );

    // Only count debt payments received on the selected day.
    // Exclude the initial payment when it is also recorded in
    // the sale-payment ledger for the same sale and timestamp.
    const debtPaymentsCollected = customerDebtPayments
      .filter((payment) => {
        const paymentDate = localDateKey(
          payment.payment_date || payment.created_at
        );

        if (paymentDate !== selectedDate) {
          return false;
        }

        const debt = customerDebts.find(
          (item) => item.id === payment.debt_id
        );

        if (!debt?.sale_id || !payment.created_at || !debt.created_at) {
          return true;
        }

        const paymentTime = new Date(payment.created_at).getTime();
        const debtCreatedTime = new Date(debt.created_at).getTime();

        if (
          !Number.isFinite(paymentTime) ||
          !Number.isFinite(debtCreatedTime) ||
          paymentTime !== debtCreatedTime
        ) {
          return true;
        }

        return !salePayments.some((salePayment) => {
          if (salePayment.saleId !== debt.sale_id) {
            return false;
          }

          const salePaymentTime = new Date(
            salePayment.date
          ).getTime();

          return (
            Number.isFinite(salePaymentTime) &&
            salePaymentTime === paymentTime &&
            Math.abs(
              Number(salePayment.amount || 0) -
              Number(payment.amount || 0)
            ) < 0.001
          );
        });
      })
      .reduce(
        (sum, payment) =>
          sum + Number(payment.amount || 0),
        0
      );

    return salesCollected + debtPaymentsCollected;
  }, [
    selectedDate,
    salePayments,
    customerDebtPayments,
    customerDebts,
  ]);

  const topCustomerDebts =
    selectedDateDebtData.debts.slice(0, 5);

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

  const recentExpenses = [...expenses]
    .sort((a, b) => {
      const aDate = new Date(
        `${a.date}T00:00:00`
      );

      const bDate = new Date(
        `${b.date}T00:00:00`
      );

      return bDate - aDate;
    })
    .slice(0, 5);


  const recentBankTransactions = financeTransactions
  .filter(
    (transaction) =>
      transaction.status === "completed" &&
      ["credit", "debit"].includes(
        String(transaction.type || "").toLowerCase()
      )
  )
  .slice(0, 5);


  const chartData = useMemo(() => {
    const result = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordedDates = [
      ...sales.map((sale) => sale.date),
      ...expenses.map((expense) => expense.date),
    ].filter(Boolean).sort();

    const firstDate = recordedDates.length
      ? new Date(`${recordedDates[0]}T00:00:00`)
      : new Date(today);

    if (!recordedDates.length) {
      firstDate.setDate(today.getDate() - 6);
    }

    const totalDays = Math.max(
      1,
      Math.floor((today - firstDate) / 86400000) + 1
    );

    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const dateKey =
        getLocalDateKey(date);

      const salesAmount = sales
        .filter((sale) => sale.date === dateKey)
        .reduce(
          (sum, sale) => sum + Number(sale.totalSelling || 0),
          0
        );

      const refundsAmount = saleReturns
        .filter((item) => {
          const originalSale = sales.find(
            (sale) => sale.id === item.saleId
          );

          return (
            originalSale?.date === dateKey &&
            item.date === originalSale.date
          );
        })
        .reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

      const amount = Math.max(
        0,
        salesAmount - refundsAmount
      );

      const expensesAmount = expenses
        .filter((expense) => expense.date === dateKey)
        .reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0
        );

      result.push({
        date: dateKey,
        label: date.toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
        }),
        amount,
        expensesAmount,
      });
    }

    return result;
  }, [sales, saleReturns, expenses]);

  const chartMax = Math.max(
    ...chartData.map((day) => day.amount),
    1
  );

  const comparisonMax = Math.max(
    ...chartData.flatMap((day) => [
      day.amount,
      day.expensesAmount,
    ]),
    1
  );

  const comparisonAxisMax = Math.ceil(comparisonMax / 5) * 5 || 5;
  const chartAxisMax = comparisonAxisMax;

  const formatAxisMoney = (value) => {
    if (value >= 1000000) {
      return `₦${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}m`;
    }
    if (value >= 1000) {
      return `₦${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`;
    }
    return `₦${Math.round(value)}`;
  };

  const chartAxisTicks = Array.from(
    { length: 6 },
    (_, index) => chartAxisMax * (5 - index) / 5
  );

  const comparisonAxisTicks = Array.from(
    { length: 6 },
    (_, index) => comparisonAxisMax * (5 - index) / 5
  );

  const chartPoints =
    chartData.map(
      (day, index) => {
        const x =
          chartData.length > 1
            ? (index / (chartData.length - 1)) * 100
            : 50;

        const y =
          88 -
          (day.amount /
            chartAxisMax) *
            68;

        return {
          ...day,
          x,
          y,
        };
      }
    );

  const expenseChartPoints = chartPoints.map((point) => ({
    ...point,
    y: 88 - (point.expensesAmount / chartAxisMax) * 68,
  }));

  const linePath = chartPoints.reduce((path, point, index, points) => {
    if (index === 0) {
      return `M ${point.x},${point.y}`;
    }

    const previous = points[index - 1];
    const beforePrevious = points[index - 2] || previous;
    const next = points[index + 1] || point;

    const control1X =
      previous.x + (point.x - beforePrevious.x) / 6;
    const control1Y =
      previous.y + (point.y - beforePrevious.y) / 6;
    const control2X =
      point.x - (next.x - previous.x) / 6;
    const control2Y =
      point.y - (next.y - previous.y) / 6;

    return `${path} C ${control1X},${control1Y} ${control2X},${control2Y} ${point.x},${point.y}`;
  }, "");

  const expenseLinePath = chartPoints
    .map((point, index) => {
      const y = 88 - (point.expensesAmount / chartAxisMax) * 68;
      return `${index === 0 ? "M" : "L"} ${point.x},${y}`;
    })
    .join(" ");

  const areaPath = chartPoints.length
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x},88 L ${chartPoints[0].x},88 Z`
    : "";

  useEffect(() => {
    const element = lineChartScrollRef.current;
    if (element) {
      element.scrollLeft = element.scrollWidth;
    }
  }, [chartData.length]);

  const saveOpeningBalance =
    async (event) => {
      event.preventDefault();

      if (openingCashSet) {
        setShowOpeningForm(false);
        return;
      }

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

      if (
        !window.confirm(
          `Confirm your starting cash: ₦${amount.toLocaleString("en-NG")}. This will be your one-time opening cash for this record book. Check the amount carefully. It cannot be changed here after saving; correcting it will require resetting the record book. Continue?`
        )
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
          .insert({
            user_id: user.id,
            opening_balance: amount,
            updated_at: new Date().toISOString(),
          });

        if (saveError) {
          throw saveError;
        }

        await logAudit({
          action: "opening_cash_set",
          category: "finance",
          description: `Set opening business cash to ${formatMoney(amount)}`,
          amount,
          currency: "NGN",
          details: {
            openingBalance: amount,
            setting: "one_time_opening_cash",
          },
        });

        const updated = {
          openingBalance:
            amount,
        };

        setFinance(updated);
        setOpeningCashSet(true);
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

          <label className="dashboard-date-filter">
            Viewing date
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(event) => handleSelectedDateChange(event.target.value)}
            />
          </label>

        </div>

        <div className="hero-balance-card">

          <div className="hero-balance-top">

            <span>
              CURRENT BALANCE
            </span>

            {!openingCashSet && (
              <button
                type="button"
                className="hero-balance-edit"
                onClick={() =>
                  setShowOpeningForm((value) => !value)
                }
              >
                ⚙
              </button>
            )}

            {openingCashSet && (
              <span className="opening-cash-locked">
                OPENING CASH SET
              </span>
            )}

          </div>

          <strong>
            {formatMoney(
              selectedDateBalance.total
            )}
          </strong>

          <div className="hero-balance-flow">

            <span>
              Cash{" "}
              {formatMoney(
                selectedDateBalance.cash
              )}
            </span>

            <span>
              Bank{" "}
              {formatMoney(
                selectedDateBalance.bank
              )}
            </span>

          </div>

          {!openingCashSet && showOpeningForm && (
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
          <div className="dashboard-kpi-icon">
            <ShoppingCart size={19} />
          </div>

          <span>
            Total Sales
          </span>

          <strong>
            {formatMoney(
              todaySales
            )}
          </strong>

          <small>
            Sales for the selected date
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-icon">
            <Banknote size={19} />
          </div>

          <span>
            Collected
          </span>

          <strong>
            {formatMoney(
              selectedDateCollected
            )}
          </strong>

          <small>
            Actual money received
          </small>
        </article>

        <article className="dashboard-kpi-card dashboard-kpi-debt">
          <div className="dashboard-kpi-icon">
            <Users size={19} />
          </div>

          <span>
            Customer Debt
          </span>

          <strong>
            {formatMoney(
              selectedDateCustomerDebt
            )}
          </strong>

          <small>
            Outstanding from customers
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-icon">
            <Receipt size={19} />
          </div>

          <span>
            Expenses
          </span>

          <strong>
            {formatMoney(
              expenses
                .filter(
                  (expense) =>
                    expense.date === selectedDate
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
            Expenses for the selected date
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-icon">
            <Package size={19} />
          </div>

          <span>
            Inventory Value
          </span>

          <strong>
            {formatMoney(
              inventoryValue
            )}
          </strong>

          <small>
            {formatNumber(stockUnits)} units in stock
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-icon">
            <TrendingUp size={19} />
          </div>

          <span>
            Profit
          </span>

          <strong>
            {formatMoney(
              todayProfit
            )}
          </strong>

          <small>
            Gross profit for the selected date
          </small>
        </article>

      </section>



      {/* CUSTOMER FINANCE */}
      <section className="dashboard-customer-finance">
        <div className="dashboard-customer-finance-header">
          <div>
            <span className="eyebrow">CUSTOMER FINANCE</span>
            <h2>Top Customer Debts</h2>
          </div>

          {selectedDateDebtData.debts.length > 5 && (
            <button
              type="button"
              className="dashboard-view-all-btn"
              onClick={() => setShowAllCustomerDebts(true)}
            >
              View All
            </button>
          )}
        </div>

        {topCustomerDebts.length === 0 ? (
          <div className="dashboard-empty-finance">
            <Users size={22} />
            <span>No outstanding customer debts for this date.</span>
          </div>
        ) : (
          <div className="dashboard-debt-table-wrap">
            <table className="dashboard-debt-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Latest Sale</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {topCustomerDebts.map((debt) => {
                  const customer = customers.find(
                    (item) => item.id === debt.customer_id
                  );

                  const linkedSale = debt.sale_id
                    ? sales.find((sale) => sale.id === debt.sale_id)
                    : null;

                  return (
                    <tr key={debt.id}>
                      <td>
                        <div className="dashboard-debt-customer">
                          <strong>
                            {customer?.name ||
                              debt.customer_name ||
                              "Customer"}
                          </strong>

                          {customer?.phone && (
                            <span>{customer.phone}</span>
                          )}
                        </div>
                      </td>

                      <td>
                        {linkedSale?.productName ||
                          debt.description ||
                          "Sale"}
                      </td>

                      <td className="dashboard-debt-outstanding">
                        {formatMoney(debt.outstanding)}
                      </td>

                      <td>
                        {debt.due_date
                          ? new Date(
                              debt.due_date
                            ).toLocaleDateString()
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={`dashboard-debt-status ${
                            debt.status === "Overdue"
                              ? "is-overdue"
                              : "is-pending"
                          }`}
                        >
                          {debt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ALL CUSTOMER DEBTS MODAL */}
      {showAllCustomerDebts && (
        <div
          className="dashboard-finance-modal-backdrop"
          onClick={() => setShowAllCustomerDebts(false)}
        >
          <div
            className="dashboard-finance-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-finance-modal-header">
              <div>
                <span className="eyebrow">CUSTOMER FINANCE</span>
                <h2>All Customer Debts</h2>
              </div>

              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setShowAllCustomerDebts(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="dashboard-debt-table-wrap">
              <table className="dashboard-debt-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Latest Sale</th>
                    <th>Outstanding</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedDateDebtData.debts.map((debt) => {
                    const customer = customers.find(
                      (item) => item.id === debt.customer_id
                    );

                    const linkedSale = debt.sale_id
                      ? sales.find((sale) => sale.id === debt.sale_id)
                      : null;

                    return (
                      <tr key={debt.id}>
                        <td>
                          <div className="dashboard-debt-customer">
                            <strong>
                              {customer?.name ||
                                debt.customer_name ||
                                "Customer"}
                            </strong>

                            {customer?.phone && (
                              <span>{customer.phone}</span>
                            )}
                          </div>
                        </td>

                        <td>
                          {linkedSale?.productName ||
                            debt.description ||
                            "Sale"}
                        </td>

                        <td className="dashboard-debt-outstanding">
                          {formatMoney(debt.outstanding)}
                        </td>

                        <td>
                          {debt.due_date
                            ? new Date(
                                debt.due_date
                              ).toLocaleDateString()
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={`dashboard-debt-status ${
                              debt.status === "Overdue"
                                ? "is-overdue"
                                : "is-pending"
                            }`}
                          >
                            {debt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <section className="dashboard-recent-sales-row">

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

                        {(() => {
                          const returned = returnsBySale.get(sale.id);

                          if (!returned || returned.quantity <= 0) {
                            return null;
                          }

                          const fullyReturned =
                            returned.quantity >= sale.quantity;

                          return (
                            <span
                              className="sales-returned-indicator"
                              style={{
                                display: "inline-block",
                                marginTop: "4px",
                                color: "#dc2626",
                                fontWeight: 700,
                              }}
                            >
                              {fullyReturned
                                ? "Fully returned · Refunded"
                                : `Partially returned · ${returned.quantity} returned`}
                            </span>
                          );
                        })()}

                      </div>

                    </div>

                    <div className="recent-sale-value">

                      <strong>
                        {formatMoney(
                          getNetSale(sale).revenue
                        )}
                      </strong>

                      <span>
                        {getNetSale(sale).profit >= 0 ? "+" : ""}
                        {formatMoney(
                          getNetSale(sale).profit
                        )}
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>





<div className="dashboard-panel recent-transactions-panel">
  <div className="panel-heading">
    <div>
      <span className="eyebrow">BANK ACTIVITY</span>
      <h2>Recent Transactions</h2>
    </div>
  </div>

  {recentBankTransactions.length === 0 ? (
    <div className="empty-dashboard-state">
      <div>＋</div>
      <strong>No transactions yet</strong>
      <span>Your latest bank credits and debits will appear here.</span>
    </div>
  ) : (
    <div className="recent-transactions-list">
      {recentBankTransactions.map((transaction) => {
        const isCredit =
          String(transaction.type || "").toLowerCase() === "credit";

        return (
          <div
            className="recent-transaction-row"
            key={transaction.id}
          >
            <div className={`recent-transaction-icon ${isCredit ? "is-credit" : "is-debit"}`}>
              {isCredit ? "↓" : "↑"}
            </div>

            <div className="recent-transaction-details">
              <strong>
                {transaction.description ||
                  transaction.category ||
                  (isCredit ? "Bank credit" : "Bank debit")}
              </strong>

              <span>
                {transaction.createdAt
                  ? new Date(
                      transaction.createdAt
                    ).toLocaleDateString("en-NG")
                  : "Recent transaction"}
                {" · "}
                {isCredit ? "Money in" : "Money out"}
              </span>
            </div>

            <strong className={`recent-transaction-amount ${isCredit ? "is-credit" : "is-debit"}`}>
              {isCredit ? "+" : "−"}
              {formatMoney(transaction.amount)}
            </strong>
          </div>
        );
      })}
    </div>
  )}
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

          <div
            className="chart-timeline-scroll"
            ref={lineChartScrollRef}
          >
            <div
              className="chart-timeline-content"
              style={{
                width: `${Math.max(1, chartData.length) * 72}px`,
              }}
            >
          <BusinessGate
            subscription={subscription}
            title="Sales Performance"
            description="See your sales performance and expense trends over time with UpTrend Business."
            onUpgrade={onUpgrade}
          >
            {isBusiness ? (
          <div className="real-sales-chart">

            <div className="real-chart-grid">
              {chartAxisTicks.map((tick, index) => (
                <span key={index}>
                  <small>{formatAxisMoney(tick)}</small>
                </span>
              ))}
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

              <path
                className="real-chart-area"
                d={areaPath}
              />

              <path
                className="real-chart-line"
                d={linePath}
                pathLength="1"
              />

              <path
                d={expenseLinePath}
                fill="none"
                stroke="#ef5350"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
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
                  >
                    <span className="chart-value-label sales-value-label">
                      {formatAxisMoney(point.amount)}
                    </span>
                  </span>
                )
              )}

              {expenseChartPoints.map((point) => (
                <span
                  key={`expense-${point.date}`}
                  className="real-chart-point expense-chart-point"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                  title={`Expenses ${point.label}: ${formatMoney(point.expensesAmount)}`}
                >
                  <span className="chart-value-label expense-value-label">
                    {formatAxisMoney(point.expensesAmount)}
                  </span>
                </span>
              ))}

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

            ) : (
              <div />
            )}
          </BusinessGate>

          <BusinessGate
            subscription={subscription}
            title="Sales vs Expenses"
            description="Compare your daily sales and expenses to understand your business performance with UpTrend Business."
            onUpgrade={onUpgrade}
          >
          <section className="daily-comparison">
            <div className="daily-comparison-heading">
              <div>
                <span className="eyebrow">DAILY BREAKDOWN</span>
                <h3>Sales vs expenses</h3>
              </div>
              <div className="daily-chart-legend">
                <span><i className="legend-sales" />Sales</span>
                <span><i className="legend-expenses" />Expenses</span>
              </div>
            </div>

            <div className="comparison-chart">
              <div className="comparison-axis">
                {comparisonAxisTicks.map((tick, index) => (
                  <span key={index}>{formatAxisMoney(tick)}</span>
                ))}
              </div>

              <div className="comparison-plot">
                <div className="comparison-grid">
                  {comparisonAxisTicks.map((tick, index) => (
                    <span key={index} />
                  ))}
                </div>

                <div
                  className="comparison-bars"
                  style={{
                    gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))`,
                  }}
                >
                  {chartData.map((day) => (
                    <div className="comparison-day" key={day.date}>
                      <div className="comparison-bar-pair">
                        <span
                          className="comparison-bar bar-sales"
                          data-value={formatAxisMoney(day.amount)}
                          style={{
                            height: `${Math.max(0, day.amount / comparisonAxisMax * 100)}%`,
                          }}
                          title={`Sales ${day.label}: ${formatMoney(day.amount)}`}
                        />
                        <span
                          className="comparison-bar bar-expenses"
                          data-value={formatAxisMoney(day.expensesAmount)}
                          style={{
                            height: `${Math.max(0, day.expensesAmount / comparisonAxisMax * 100)}%`,
                          }}
                          title={`Expenses ${day.label}: ${formatMoney(day.expensesAmount)}`}
                        />
                      </div>
                      <small>{day.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          </BusinessGate>
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







      </section>




      {historicalAccessOpen && !isBusiness && (
        <div
          className="historical-access-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="historical-access-title"
        >
          <div className="historical-access-modal">
            <button
              type="button"
              className="historical-access-close"
              aria-label="Close"
              onClick={() => setHistoricalAccessOpen(false)}
            >
              ×
            </button>

            <div className="historical-access-icon">
              <span>✦</span>
            </div>

            <span className="historical-access-eyebrow">
              UPTREND BUSINESS
            </span>

            <h2 id="historical-access-title">
              Unlock your historical data
            </h2>

            <p>
              Free accounts can view today and the previous 7 days.
              Upgrade to UpTrend Business to explore older sales,
              expenses, inventory and balance history.
            </p>

            <div className="historical-access-date">
              <span>Requested date</span>
              <strong>
  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  )}
</strong>
            </div>

            <button
              type="button"
              className="historical-access-upgrade"
              onClick={() => {
                setHistoricalAccessOpen(false);
                onUpgrade?.();
              }}
            >
              Upgrade to Business
            </button>

            <button
              type="button"
              className="historical-access-later"
              onClick={() => setHistoricalAccessOpen(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


export default Dashboard;
