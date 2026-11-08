import "./Transactions.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../utils/auditLog";

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatTransactionStatus = (status) => {
  const labels = {
    completed: "Completed",
    pending: "Pending",
    failed: "Failed",
    reversed: "Reversed",
  };

  return labels[status] || status || "Unknown";
};

const formatTransactionDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function Transactions({ onOpenSupplier, onOpenSale, onOpenExpense }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] =
    useState(null);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [availableCash, setAvailableCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setTransactions([]);
        setOpeningBalance(0);
        setSelectedTransaction(null);
        return;
      }

      const accountResult = await supabase.rpc(
        "get_or_create_uptrend_finance_account"
      );

      if (accountResult.error) {
        throw accountResult.error;
      }

      const accountId =
        accountResult.data?.id ||
        accountResult.data?.[0]?.id;

      const opening =
        Number(
          accountResult.data?.opening_balance ??
          accountResult.data?.[0]?.opening_balance ??
          0
        );

      setOpeningBalance(opening);

      const [
        { data, error: transactionError },
        { data: linkedExpenses, error: expensesError },
        { data: linkedSales, error: salesError },
        { data: supplierPayments, error: supplierPaymentsError },
        { data: supplierPurchases, error: supplierPurchasesError },
        { data: suppliers, error: suppliersError },
        { data: supplierBatches, error: supplierBatchesError },
      ] = await Promise.all([
        supabase
          .from("uptrend_finance_transactions")
          .select(
            "id,type,amount,status,category,description,reference,external_reference,metadata,created_at,updated_at"
          )
          .eq("user_id", user.id)
          .eq("account_id", accountId)
          .order("created_at", {
            ascending: true,
          }),
        supabase
          .from("expenses")
          .select("id,name,finance_transaction_id")
          .eq("user_id", user.id)
          .not("finance_transaction_id", "is", null),
        supabase
          .from("sales")
          .select("id,product_name,finance_transaction_id")
          .eq("user_id", user.id)
          .not("finance_transaction_id", "is", null),
        supabase
          .from("uptrend_supplier_payments")
          .select("id,purchase_id,supplier_id,amount,payment_date,payment_method,reference,finance_transaction_id")
          .eq("user_id", user.id)
          .not("finance_transaction_id", "is", null),
        supabase
          .from("uptrend_supplier_purchases")
          .select("id,supplier_id,product_name,description")
          .eq("user_id", user.id),
        supabase
          .from("uptrend_suppliers")
          .select("id,name")
          .eq("user_id", user.id),
        supabase
          .from("uptrend_supplier_purchase_batches")
          .select("id,supplier_id,total_amount,purchase_date,finance_transaction_id")
          .eq("user_id", user.id)
          .not("finance_transaction_id", "is", null),
      ]);

      const [
        cashSalesResult,
        cashExpensesResult,
        cashSalePaymentsResult,
        cashSupplierPaymentsResult,
        cashReturnsResult,
        cashDebtsResult,
        cashDebtPaymentsResult,
        cashFinanceResult,
      ] = await Promise.all([
        supabase.from("sales")
          .select("id,total_selling,payment_method")
          .eq("user_id", user.id),

        supabase.from("expenses")
          .select("amount,payment_method")
          .eq("user_id", user.id),

        supabase.from("uptrend_sale_payments")
          .select("sale_id,amount,payment_method,created_at")
          .eq("user_id", user.id),

        supabase.from("uptrend_supplier_payments")
          .select("amount,payment_method")
          .eq("user_id", user.id),

        supabase.from("uptrend_sale_returns")
          .select("refund_amount,refund_method")
          .eq("user_id", user.id),

        supabase.from("uptrend_credit_debts")
          .select("id,sale_id")
          .eq("user_id", user.id),

        supabase.from("uptrend_credit_debt_payments")
          .select("debt_id,amount,payment_method,created_at,payment_date")
          .eq("user_id", user.id),

        supabase.from("finance_settings")
          .select("opening_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const cashQueryErrors = [
        cashSalesResult,
        cashExpensesResult,
        cashSalePaymentsResult,
        cashSupplierPaymentsResult,
        cashReturnsResult,
        cashDebtsResult,
        cashDebtPaymentsResult,
        cashFinanceResult,
      ];

      const cashQueryError = cashQueryErrors.find(
        (result) => result.error
      )?.error;

      if (cashQueryError) throw cashQueryError;

      if (transactionError) {
        throw transactionError;
      }

      if (expensesError) {
        throw expensesError;
      }
      if (salesError) throw salesError;
      if (supplierPaymentsError) throw supplierPaymentsError;
      if (supplierPurchasesError) throw supplierPurchasesError;
      if (suppliersError) throw suppliersError;
      if (supplierBatchesError) throw supplierBatchesError;

      // Calculate physical cash using the same ledger rules as Dashboard.
      const cashSales = cashSalesResult.data || [];
      const cashExpenses = cashExpensesResult.data || [];
      const cashSalePayments = cashSalePaymentsResult.data || [];
      const cashSupplierPayments = cashSupplierPaymentsResult.data || [];
      const cashReturns = cashReturnsResult.data || [];
      const cashDebts = cashDebtsResult.data || [];
      const cashDebtPayments = cashDebtPaymentsResult.data || [];

      const cashBySale = new Map();

      cashSalePayments.forEach((payment) => {
        if (payment.payment_method !== "cash") return;

        cashBySale.set(
          payment.sale_id,
          (cashBySale.get(payment.sale_id) || 0) +
            Number(payment.amount || 0)
        );
      });

      const totalCashSales = cashSales.reduce((sum, sale) => {
        if (cashBySale.has(sale.id)) {
          return sum + Number(cashBySale.get(sale.id) || 0);
        }

        return sale.payment_method === "cash"
          ? sum + Number(sale.total_selling || 0)
          : sum;
      }, 0);

      const totalCashExpenses = cashExpenses
        .filter((item) => item.payment_method === "cash")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const totalCashSupplierPayments = cashSupplierPayments
        .filter((item) => item.payment_method === "cash")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const totalCashRefunds = cashReturns
        .filter((item) => item.refund_method === "cash")
        .reduce((sum, item) => sum + Number(item.refund_amount || 0), 0);

      const debtsById = new Map(
        cashDebts.map((debt) => [debt.id, debt])
      );

      const totalCashDebtRepayments = cashDebtPayments.reduce(
        (sum, payment) => {
          const method = String(payment.payment_method || "")
            .trim()
            .toLowerCase();

          if (method !== "cash" && method !== "") return sum;

          const debt = debtsById.get(payment.debt_id);

          if (debt?.sale_id && payment.created_at) {
            const paymentTime = new Date(payment.created_at).getTime();

            const duplicate = Number.isFinite(paymentTime) &&
              cashSalePayments.some((salePayment) => {
                if (salePayment.sale_id !== debt.sale_id) return false;

                const salePaymentTime = new Date(
                  salePayment.created_at
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

            if (duplicate) return sum;
          }

          return sum + Number(payment.amount || 0);
        },
        0
      );

      const existingCashDeposits = (data || [])
        .filter(
          (transaction) =>
            transaction.status === "completed" &&
            transaction.type === "credit" &&
            String(transaction.category || "").toLowerCase() === "cash_deposit"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

      const existingCashWithdrawals = (data || [])
        .filter(
          (transaction) =>
            transaction.status === "completed" &&
            transaction.type === "debit" &&
            String(transaction.category || "").toLowerCase() === "cash_withdrawal"
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        );

      const cashOpeningBalance = Number(
        cashFinanceResult.data?.opening_balance || 0
      );

      const calculatedCash =
        cashOpeningBalance +
        totalCashSales +
        totalCashDebtRepayments +
        existingCashWithdrawals -
        totalCashExpenses -
        totalCashSupplierPayments -
        totalCashRefunds -
        existingCashDeposits;

      setAvailableCash(calculatedCash);

      const purchasesById = new Map(
        (supplierPurchases || []).map((purchase) => [
          purchase.id,
          purchase,
        ])
      );
      const suppliersById = new Map(
        (suppliers || []).map((supplier) => [
          supplier.id,
          supplier,
        ])
      );
      const supplierPaymentsByTransaction = new Map(
        (supplierPayments || []).map((payment) => {
          const purchase = purchasesById.get(payment.purchase_id);
          const supplier = suppliersById.get(payment.supplier_id);
          const purchaseName =
            purchase?.product_name ||
            purchase?.description ||
            "Supplier purchase";

          return [
            payment.finance_transaction_id,
            {
              ...payment,
              supplierId: payment.supplier_id,
              purchaseId: payment.purchase_id,
              supplierName: supplier?.name || "Supplier",
              purchaseName,
              linkedDetails: [
                `Supplier: ${supplier?.name || "Supplier"}`,
                `Purchase: ${purchaseName}`,
                `Payment date: ${payment.payment_date || "—"}`,
                `Payment method: ${payment.payment_method || "—"}`,
                payment.reference ? `Reference: ${payment.reference}` : "",
              ].filter(Boolean).join(" • "),
            },
          ];
        })
      );

      const supplierBatchesByTransaction = new Map(
        (supplierBatches || []).map((batch) => {
          const supplier = suppliersById.get(batch.supplier_id);
          return [
            batch.finance_transaction_id,
            {
              supplierId: batch.supplier_id,
              supplierName: supplier?.name || "Supplier",
              purchaseId: null,
              linkedDetails: `Supplier: ${supplier?.name || "Supplier"} • Batch purchase • Date: ${batch.purchase_date || "—"} • Total: ${Number(batch.total_amount || 0).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}`,
            },
          ];
        })
      );

      const expensesByTransaction = new Map(
        (linkedExpenses || []).map((expense) => [
          expense.finance_transaction_id,
          expense,
        ])
      );

      const salesByTransaction = new Map(
        (linkedSales || []).map((sale) => [
          sale.finance_transaction_id,
          sale,
        ])
      );

      let runningBalance = Number(openingBalance || 0);

      const mapped = (data || []).map((transaction) => {
        const amount = Number(transaction.amount || 0);

        if (transaction.status === "completed") {
          runningBalance +=
            transaction.type === "credit"
              ? amount
              : -amount;
        }

        return {
          id: transaction.id,
          date: transaction.created_at,
          type: transaction.type,
          description:
            transaction.description ||
            "Financial transaction",
          category:
            transaction.category ||
            "Uncategorized",
          reference:
            transaction.reference ||
            transaction.external_reference ||
            "—",
          externalReference:
            transaction.external_reference || "",
          amount,
          status: transaction.status,
          balance: runningBalance,
          linked: Boolean(
            transaction.metadata?.linked_record ||
            expensesByTransaction.has(transaction.id) ||
            salesByTransaction.has(transaction.id) ||
            supplierPaymentsByTransaction.has(transaction.id) ||
            supplierBatchesByTransaction.has(transaction.id)
          ),
          saleId: salesByTransaction.get(transaction.id)?.id || null,
          expenseId: expensesByTransaction.get(transaction.id)?.id || null,
          linkedLabel:
            supplierPaymentsByTransaction.has(transaction.id)
              ? `Supplier payment: ${
                  supplierPaymentsByTransaction.get(transaction.id).supplierName
                }`
              : supplierBatchesByTransaction.has(transaction.id)
                ? `Supplier batch purchase: ${
                    supplierBatchesByTransaction.get(transaction.id).supplierName
                  }`
              : transaction.metadata?.linked_record_label ||
                (expensesByTransaction.has(transaction.id)
                  ? `Expense: ${
                      expensesByTransaction.get(transaction.id).name ||
                      "Recorded expense"
                    }`
                  : salesByTransaction.has(transaction.id)
                    ? `Sale: ${
                        salesByTransaction.get(transaction.id).product_name ||
                        "Recorded sale"
                      }`
                    : ""),
          linkedDetails:
            supplierPaymentsByTransaction.get(transaction.id)?.linkedDetails ||
            supplierBatchesByTransaction.get(transaction.id)?.linkedDetails || "",
          supplierPayment:
            supplierPaymentsByTransaction.get(transaction.id) ||
            supplierBatchesByTransaction.get(transaction.id) || null,
          metadata: transaction.metadata || {},
        };
      });

      const ordered = mapped.reverse();

      setTransactions(ordered);

      setSelectedTransaction((current) => {
        if (!current) {
          return ordered[0] || null;
        }

        return (
          ordered.find(
            (item) => item.id === current.id
          ) || ordered[0] || null
        );
      });
    } catch (loadError) {
      console.error(
        "Transactions load failed:",
        loadError
      );

      setError(
        loadError?.message ||
          "Unable to load transactions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const totals = useMemo(() => {
    const completed = transactions.filter(
      (item) => item.status === "completed"
    );

    const moneyIn = completed
      .filter((item) => item.type === "credit")
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const moneyOut = completed
      .filter((item) => item.type === "debit")
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const balance = Number(openingBalance || 0) + moneyIn - moneyOut;

    return {
      moneyIn,
      moneyOut,
      balance,
    };
  }, [transactions, openingBalance]);

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "credit" &&
          item.type === "credit") ||
        (filter === "debit" &&
          item.type === "debit");

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "transfers" &&
          String(item.category || "").toLowerCase() === "transfer") ||
        (typeFilter === "linked" && item.linked) ||
        (typeFilter === "other" &&
          String(item.category || "").toLowerCase() !== "transfer" &&
          !item.linked);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").toLowerCase() === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      const matchesSearch =
        !query ||
        [
          item.description,
          item.category,
          item.reference,
          item.externalReference,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      return (
        matchesFilter &&
        matchesType &&
        matchesCategory &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    transactions,
    filter,
    search,
    typeFilter,
    categoryFilter,
    statusFilter,
  ]);

  const chartData = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let index = 13; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);

      days.push({
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
        }),
        moneyIn: 0,
        moneyOut: 0,
      });
    }

    const dayMap = new Map(
      days.map((day) => [day.key, day])
    );

    transactions.forEach((transaction) => {
      if (transaction.status !== "completed") return;

      const date = new Date(transaction.date);

      if (Number.isNaN(date.getTime())) return;

      const key = date.toISOString().slice(0, 10);
      const day = dayMap.get(key);

      if (!day) return;

      const amount = Number(transaction.amount || 0);

      if (transaction.type === "credit") {
        day.moneyIn += amount;
      } else if (transaction.type === "debit") {
        day.moneyOut += amount;
      }
    });

    const maxFlow = Math.max(
      1,
      ...days.flatMap((day) => [
        day.moneyIn,
        day.moneyOut,
      ])
    );

    return days.map((day) => ({
      ...day,
      inHeight:
        day.moneyIn > 0
          ? Math.max(4, (day.moneyIn / maxFlow) * 100)
          : 0,
      outHeight:
        day.moneyOut > 0
          ? Math.max(4, (day.moneyOut / maxFlow) * 100)
          : 0,
    }));
  }, [transactions]);

  const handleDepositCash = async () => {
    if (availableCash <= 0) {
      window.alert("There is no available cash to deposit.");
      return;
    }

    const amountInput = window.prompt(
      `Cash available: ${money(availableCash)}\n\nEnter deposit amount or type ALL to deposit everything:`
    );

    if (amountInput === null) return;

    const amount =
      amountInput.trim().toUpperCase() === "ALL"
        ? availableCash
        : Number(amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid deposit amount.");
      return;
    }

    if (amount > availableCash + 0.001) {
      window.alert(
        `You cannot deposit more than your available cash of ${money(availableCash)}.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm cash deposit?\n\nAmount: ${money(amount)}\n\nThis will reduce Cash at Hand and increase your bank balance by the same amount.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error: transactionError } = await supabase.rpc(
        "record_uptrend_manual_financial_transaction",
        {
          p_type: "credit",
          p_amount: amount,
          p_category: "cash_deposit",
          p_description: "Cash deposited into bank",
          p_reference: null,
        }
      );

      if (transactionError) throw transactionError;

      await logAudit({
        action: "cash_deposited_to_bank",
        category: "finance",
        description: `Deposited ${money(amount)} cash into bank`,
        amount,
        currency: "NGN",
        details: {
          type: "credit",
          category: "cash_deposit",
          source: "Cash at Hand",
          destination: "Bank account",
          linked: false,
          linkStatus: "not_linked",
        },
      });

      window.alert(`Successfully deposited ${money(amount)} into the bank.`);

      await loadTransactions();
    } catch (depositError) {
      console.error("Cash deposit failed:", depositError);
      setError(
        depositError?.message || "Unable to deposit cash into bank."
      );
    }
  };

  const handleWithdrawToCash = async () => {
    const bankBalance = Number(totals.balance || 0);

    if (bankBalance <= 0) {
      window.alert("There is no available bank balance to withdraw.");
      return;
    }

    const amountInput = window.prompt(
      `Available bank balance: ${money(bankBalance)}\n\nEnter amount to withdraw into Cash at Hand:`
    );

    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid withdrawal amount.");
      return;
    }

    if (amount > bankBalance + 0.001) {
      window.alert(
        `You cannot withdraw more than the available bank balance of ${money(bankBalance)}.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm Bank to Cash transfer?\n\nAmount: ${money(amount)}\n\nYour bank balance will reduce and Cash at Hand will increase by the same amount. This is an internal transfer, not income.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error: transactionError } = await supabase.rpc(
        "record_uptrend_manual_financial_transaction",
        {
          p_type: "debit",
          p_amount: amount,
          p_category: "cash_withdrawal",
          p_description: "Cash withdrawn from bank",
          p_reference: null,
        }
      );

      if (transactionError) throw transactionError;

      await logAudit({
        action: "cash_withdrawn_from_bank",
        category: "finance",
        description: `Withdrew ${money(amount)} from bank into Cash at Hand`,
        amount,
        currency: "NGN",
        details: {
          type: "debit",
          category: "cash_withdrawal",
          source: "Bank account",
          destination: "Cash at Hand",
          internalTransfer: true,
        },
      });

      window.alert(
        `Successfully transferred ${money(amount)} from bank to Cash at Hand.`
      );

      await loadTransactions();
    } catch (withdrawError) {
      console.error("Bank to cash withdrawal failed:", withdrawError);
      setError(
        withdrawError?.message || "Unable to transfer money from bank to cash."
      );
    }
  };

  const handleReceive = async () => {
    const amountInput = window.prompt("Enter amount received:");
    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid amount greater than zero.");
      return;
    }

    const categoryOptions = [
      ["sales", "Sales"],
      ["other_income", "Other Income"],
      ["cash_starting_balance", "Cash Starting Balance"],
      ["capital_owner_funding", "Capital / Owner Funding"],
      ["loan", "Loan"],
      ["transfer", "Transfer"],
      ["other", "Other"],
    ];

    const categoryList = categoryOptions
      .map(([value, label], index) => `${index + 1}. ${label}`)
      .join("\n");

    const categoryChoice = window.prompt(
      `Select Money In category:\n\n${categoryList}\n\nEnter the number:`
    );

    if (categoryChoice === null) return;

    const categoryIndex = Number(categoryChoice) - 1;
    const selectedCategory = categoryOptions[categoryIndex];

    if (!selectedCategory) {
      window.alert("Invalid category selection.");
      return;
    }

    const category = selectedCategory[0];

    const description = window.prompt("Enter description (optional):");
    const reference = window.prompt("Enter reference (optional):");

    try {
      setError("");

      const { error: transactionError } = await supabase.rpc(
        "record_uptrend_manual_financial_transaction",
        {
          p_type: "credit",
          p_amount: amount,
          p_category: category.trim(),
          p_description: description?.trim() || null,
          p_reference: reference?.trim() || null,
        }
      );

      if (transactionError) throw transactionError;

      await logAudit({
        action: "money_received",
        category: "finance",
        description: `Received ${money(amount)}`,
        amount,
        currency: "NGN",
        details: {
          type: "credit",
          category,
          source: "Source not specified",
          destination: "Business funds",
          linked: false,
          linkStatus: "not_linked",
          relation: null,
          description: description?.trim() || null,
          reference: reference?.trim() || null,
        },
      });

      await loadTransactions();
    } catch (transactionError) {
      console.error("Money In transaction failed:", transactionError);
      setError(
        transactionError?.message || "Unable to record money received."
      );
    }
  };

  const handleLinkTransaction = async () => {
    if (!selectedTransaction) return;

    if (selectedTransaction.linked) {
      const linkedSupplierPayment = selectedTransaction.supplierPayment;
      if (
        linkedSupplierPayment?.supplierId &&
        linkedSupplierPayment?.purchaseId &&
        onOpenSupplier
      ) {
        onOpenSupplier(
          linkedSupplierPayment.supplierId,
          linkedSupplierPayment.purchaseId
        );
        setSelectedTransaction(null);
      } else if (selectedTransaction.saleId && onOpenSale) {
        onOpenSale(selectedTransaction.saleId);
        setSelectedTransaction(null);
      } else if (selectedTransaction.expenseId && onOpenExpense) {
        onOpenExpense(selectedTransaction.expenseId);
        setSelectedTransaction(null);
      }
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
        throw new Error("You must be signed in.");
      }

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(
          "id,product_name,quantity,selling_price,sale_date,payment_method,finance_transaction_id"
        )
        .eq("user_id", user.id)
        .eq("payment_method", "transfer")
        .is("finance_transaction_id", null)
        .order("created_at", {
          ascending: false,
        });

      if (salesError) throw salesError;

      const eligibleSales = (sales || []).filter(
        (sale) =>
          Math.abs(
            Number(sale.selling_price || 0) -
              Number(selectedTransaction.amount || 0)
          ) <= 0.005
      );

      if (eligibleSales.length === 0) {
        window.alert(
          "No unlinked transfer sale matches this transaction amount."
        );
        return;
      }

      const options = eligibleSales
        .map(
          (sale, index) =>
            `${index + 1}. ${sale.product_name || "Sale"} — ${money(
              sale.selling_price
            )} — ${formatTransactionDate(sale.sale_date)}`
        )
        .join("\n");

      const choice = window.prompt(
        `Select the sale to link:\n\n${options}\n\nEnter the number:`
      );

      if (choice === null) return;

      const index = Number(choice) - 1;
      const selectedSale = eligibleSales[index];

      if (!selectedSale) {
        window.alert("Invalid sale selection.");
        return;
      }

      const { error: linkError } = await supabase.rpc(
        "link_uptrend_finance_transaction_to_sale",
        {
          p_transaction_id: selectedTransaction.id,
          p_sale_id: selectedSale.id,
        }
      );

      if (linkError) throw linkError;

      await logAudit({
        action: "transaction_linked",
        category: "finance",
        description: `Linked transaction to sale ${selectedSale.product_name || selectedSale.id}`,
        entityType: "finance_transaction",
        entityId: selectedTransaction.id,
        amount: selectedTransaction.amount,
        currency: "NGN",
        details: {
          transactionId: selectedTransaction.id,
          saleId: selectedSale.id,
          saleProduct: selectedSale.product_name || null,
          transactionType: selectedTransaction.type,
          transactionCategory: selectedTransaction.category,
          source: "Finance transaction",
          destination: `Sale: ${selectedSale.product_name || selectedSale.id}`,
          linked: true,
          linkStatus: "linked",
          relation: "finance_transaction_to_sale",
        },
      });

      await loadTransactions();
    } catch (linkError) {
      console.error(
        "Transaction linking failed:",
        linkError
      );

      setError(
        linkError?.message ||
          "Unable to link transaction."
      );
    }
  };

  const handleSend = async () => {
    const amountInput = window.prompt("Enter amount sent:");
    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid amount greater than zero.");
      return;
    }

    const categoryOptions = [
      ["expenses", "Expenses"],
      ["goods_purchase", "Goods Purchase"],
      ["supplier_payment", "Supplier Payment"],
      ["savings", "Savings"],
      ["transfer", "Transfer"],
      ["other", "Other"],
    ];

    const categoryList = categoryOptions
      .map(([value, label], index) => `${index + 1}. ${label}`)
      .join("\n");

    const categoryChoice = window.prompt(
      `Select Money Out category:\n\n${categoryList}\n\nEnter the number:`
    );

    if (categoryChoice === null) return;

    const categoryIndex = Number(categoryChoice) - 1;
    const selectedCategory = categoryOptions[categoryIndex];

    if (!selectedCategory) {
      window.alert("Invalid category selection.");
      return;
    }

    const category = selectedCategory[0];

    const description = window.prompt("Enter description (optional):");
    const destination = window.prompt("Who or what was the money sent to? (optional):");
    const reference = window.prompt("Enter reference (optional):");

    try {
      setError("");

      const { error: transactionError } = await supabase.rpc(
        "record_uptrend_manual_financial_transaction",
        {
          p_type: "debit",
          p_amount: amount,
          p_category: category.trim(),
          p_description: description?.trim() || null,
          p_reference: reference?.trim() || null,
        }
      );

      if (transactionError) throw transactionError;

      await logAudit({
        action: "money_sent",
        category: "finance",
        description: `Sent ${money(amount)}`,
        amount,
        currency: "NGN",
        details: {
          type: "debit",
          category,
          source: "Business funds",
          destination: destination?.trim() || null,
          linked: false,
          linkStatus: "not_linked",
          relation: null,
          description: description?.trim() || null,
          reference: reference?.trim() || null,
        },
      });

      await loadTransactions();
    } catch (transactionError) {
      console.error("Money Out transaction failed:", transactionError);
      setError(
        transactionError?.message || "Unable to record money sent."
      );
    }
  };

  return (
    <div className="inner-page transactions-page">
      <header className="transactions-header">
        <div>
          <div className="transactions-kicker">
            <span />
            BANK ACTIVITY
          </div>

          <h1>Bank Transactions</h1>

          <p>
            Track money coming into and going out of your business.
          </p>
        </div>

        <div className="transactions-header-actions">
          <button
            type="button"
            className="transactions-more"
            aria-label="More transaction actions"
          >
            •••
          </button>
        </div>
      </header>

      <section className="transactions-summary">
        <article className="transaction-stat balance">

          <div className="transaction-stat-top">
            <div className="transaction-stat-icon">
              ▰
            </div>
          </div>

          <div className="transaction-balance-content">
            <span>Available Balance</span>

            <strong>
              {money(totals.balance)}
            </strong>

            <small>
              Current bank account balance
            </small>
          </div>

          <div className="transaction-balance-actions">

            <button
              type="button"
              className="transactions-button receive"
              onClick={handleReceive}
            >
              <span>＋</span>
              Add Money
            </button>

            <button
              type="button"
              className="transactions-button send"
              onClick={handleSend}
            >
              <span>→</span>
              Send Money
            </button>

            <button
              type="button"
              className="transactions-button deposit"
              onClick={handleDepositCash}
            >
              <span>↓</span>
              Deposit Cash
            </button>

            <button
              type="button"
              className="transactions-button deposit"
              onClick={handleWithdrawToCash}
            >
              <span>↑</span>
              Withdraw to Cash
            </button>

          </div>

        </article>

      </section>

      <section className="transactions-workspace">
        <div className="transactions-list-panel">
          <div className="transactions-list-toolbar">
            <div className="transactions-tabs">
              {[
                ["all", "All Transactions"],
                ["credit", "Money In"],
                ["debit", "Money Out"],

              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="transactions-filters">
              <label className="transactions-search">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder="Search bank transactions..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
              >
                <option value="all">All Types</option>
                <option value="transfers">Transfers</option>
                <option value="linked">Linked Records</option>
                <option value="other">Other</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="all">All Categories</option>
                <option value="sales">Sales</option>
                <option value="expenses">Expenses</option>
                <option value="goods_purchase">Goods Purchase</option>
                <option value="supplier_payment">Supplier Payment</option>
                <option value="savings">Savings</option>
                <option value="other_income">Other Income</option>
                <option value="cash_starting_balance">
                  Cash Starting Balance
                </option>
                <option value="capital_owner_funding">
                  Capital / Owner Funding
                </option>
                <option value="loan">Loan</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="reversed">Reversed</option>
              </select>

              <button
                type="button"
                className="transactions-filter-button"
                aria-label="More filters"
              >
                ⌁
              </button>
            </div>
          </div>

          <div className="transactions-table-wrap">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9">
                      Loading transactions...
                    </td>
                  </tr>
                ) : (
                  visibleTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={[
                      selectedTransaction?.id === transaction.id
                        ? "selected"
                        : "",
                      transaction.linked
                        ? "linked"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      setSelectedTransaction(transaction)
                    }
                  >
                    <td>{formatTransactionDate(transaction.date)}</td>

                    <td>
                      <span
                        className={`transaction-type ${transaction.type}`}
                      >
                        <i>
                          {transaction.type === "credit"
                            ? "↓"
                            : transaction.type === "debit"
                            ? "↑"
                            : "⇄"}
                        </i>

                        {transaction.type === "credit"
                          ? "Money In"
                          : transaction.type === "debit"
                          ? "Money Out"
                          : "Transfer"}

                        {transaction.linked && (
                          <span
                            className="transaction-linked-icon"
                            title="Linked transaction"
                            aria-label="Linked transaction"
                          >
                            🔗
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="transaction-description">
                      {transaction.description}
                    </td>

                    <td>{transaction.category}</td>

                    <td>{transaction.reference}</td>

                    <td
                      className={`transaction-amount ${transaction.type}`}
                    >
                      {transaction.type === "credit" ? "+" : "−"}
                      {money(transaction.amount)}
                    </td>

                    <td>
                      <span
                        className={`transaction-status ${transaction.status}`}
                      >
                        ● {formatTransactionStatus(transaction.status)}
                      </span>
                    </td>

                    <td>{money(transaction.balance)}</td>

                    <td>
                      <button
                        type="button"
                        className="transaction-row-more"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedTransaction(transaction);
                        }}
                      >
                        •••
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>

            {!loading &&
              visibleTransactions.length === 0 && (
                <div className="transactions-empty">
                  {error ||
                    "No transactions match your search."}
                </div>
              )}
          </div>

          <div className="transactions-pagination">
            <span>
              Showing {visibleTransactions.length} of{" "}
              {transactions.length} transactions
            </span>

            <div>
              <button type="button">‹</button>
              <button type="button" className="active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button">…</button>
              <button type="button">13</button>
              <button type="button">›</button>
            </div>

            <select defaultValue="10">
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>
        </div>

        <aside className="transaction-details-panel">
          <div className="transaction-details-heading">
            <div>
              <span>TRANSACTION DETAILS</span>
              <h2>Movement details</h2>
            </div>

            <button
              type="button"
              aria-label="Close transaction details"
              onClick={() => setSelectedTransaction(null)}
            >
              ×
            </button>
          </div>

          {selectedTransaction ? (
            <>
              <div
                className={`transaction-detail-hero ${selectedTransaction.type}`}
              >
                <div className="transaction-detail-icon">
                  {selectedTransaction.type === "credit"
                    ? "↓"
                    : selectedTransaction.type === "debit"
                    ? "↑"
                    : "⇄"}
                </div>

                <div>
                  <span>
                    {selectedTransaction.type === "credit"
                      ? "Money In"
                      : selectedTransaction.type === "debit"
                      ? "Money Out"
                      : "Transfer"}
                  </span>

                  <strong>
                    {selectedTransaction.type === "credit"
                      ? "+"
                      : selectedTransaction.type === "debit"
                      ? "−"
                      : ""}
                    {money(selectedTransaction.amount)}
                  </strong>

                  <small>● {formatTransactionStatus(selectedTransaction.status)}</small>
                </div>
              </div>

              <div className="transaction-detail-list">
                <div>
                  <span>Date</span>
                  <strong>{formatTransactionDate(selectedTransaction.date)}</strong>
                </div>

                <div>
                  <span>Description</span>
                  <strong>
                    {selectedTransaction.description}
                  </strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>{selectedTransaction.category}</strong>
                </div>

                <div>
                  <span>Reference</span>
                  <strong>{selectedTransaction.reference}</strong>
                </div>
              </div>

              <div
                className={`transaction-link-card ${
                  selectedTransaction.linked
                    ? "linked"
                    : "unlinked"
                }`}
              >
                <span>
                  {selectedTransaction.linked
                    ? "LINKED RECORD"
                    : "UNLINKED TRANSACTION"}
                </span>

                <strong>
                  {selectedTransaction.linked
                    ? selectedTransaction.linkedLabel
                    : "This bank movement is not linked to another record."}
                </strong>

                <small>
                  {selectedTransaction.linked
                    ? selectedTransaction.linkedDetails ||
                      "This bank transaction is connected to another UpTrend record."
                    : "This transaction can be connected to the related sale or expense."}
                </small>

                <button
                  type="button"
                  onClick={handleLinkTransaction}
                >
                  {selectedTransaction.linked
                    ? "View linked record"
                    : "Link transaction"}
                </button>
              </div>

              <div className="transaction-balance-detail">
                <div>
                  <span>Previous Balance</span>
                  <strong>
                    {money(
                      selectedTransaction.balance -
                        (selectedTransaction.type === "credit"
                          ? selectedTransaction.amount
                          : -selectedTransaction.amount)
                    )}
                  </strong>
                </div>

                <div>
                  <span>New Balance</span>
                  <strong>
                    {money(selectedTransaction.balance)}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="transaction-details-empty">
              Select a transaction to view its details.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default Transactions;
