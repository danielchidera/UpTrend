import { isBusinessSubscriptionActive } from "../utils/subscription";
import { useEffect, useMemo, useState } from "react";
import "./Expenses.css";
import BusinessBenefitsBanner from "./Business/BusinessBenefitsBanner";
import { supabase } from "../lib/supabase";
import { formatMoney, formatNumber } from "../utils/numberFormat";
import { logAudit } from "../utils/auditLog";
import { saveCachedRecords, getCachedRecords } from "../lib/localDb";

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptyExpense(date) {
  return {
    date: date || getToday(),
    name: "",
    category: "General",
    amount: "",
    note: "",
    paymentMethod: "cash",
    financeTransactionId: "",
  };
}

function getSavedExpenseDraft() {
  try {
    const saved = sessionStorage.getItem(
      "uptrend_expense_draft"
    );

    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function Expenses({
  expenseToOpenId,
  onExpenseOpenHandled,
  subscription,
  onUpgrade,
}) {
  const [expenses, setExpenses] = useState([]);
  const [availableDebits, setAvailableDebits] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  const isBusiness = isBusinessSubscriptionActive(subscription);

  const [historicalAccessOpen, setHistoricalAccessOpen] =
    useState(false);

  const todayKey = getToday();

  const freeHistoryCutoff = useMemo(() => {
    const date = new Date(`${todayKey}T00:00:00`);
    date.setDate(date.getDate() - 7);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, [todayKey]);

  const [batchDate, setBatchDate] = useState(() => {
    const draft = getSavedExpenseDraft();

    return draft?.batchDate || getToday();
  });

  const [expenseForms, setExpenseForms] = useState(() => {
    const draft = getSavedExpenseDraft();

    if (
      draft &&
      Array.isArray(draft.expenseForms) &&
      draft.expenseForms.length > 0
    ) {
      return draft.expenseForms;
    }

    return [createEmptyExpense(getToday())];
  });

  const [editingId, setEditingId] = useState(null);

  const [showForm, setShowForm] = useState(() => {
    const draft = getSavedExpenseDraft();

    return Boolean(draft?.showForm);
  });

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loadingRecurringExpenses, setLoadingRecurringExpenses] =
    useState(false);

  const [showRecurringForm, setShowRecurringForm] =
    useState(false);

  const [recurringForm, setRecurringForm] = useState({
    name: "",
    category: "General",
    amount: "",
    note: "",
    paymentMethod: "cash",
    frequency: "monthly",
    startDate: getToday(),
    timeOfDay: "09:00",
  });

  const [recurringError, setRecurringError] = useState("");

  useEffect(() => {
    if (!showForm) return;

    window.dispatchEvent(new CustomEvent("uptrend:open-context-tour", {
      detail: {
        page: "expenses",
        context: "expense-entry",
        steps: [
          { target: ".expense-form-card", title: "Record Expenses", text: "Use this form to record one expense or enter multiple expenses together. Complete the required fields before saving." },
          { target: ".expense-form-heading", title: "Expense Form", text: "The heading identifies whether you are recording new expenses or editing an existing expense. Use the close button to leave the form." },
          { target: ".expense-form-card > div:nth-child(2)", title: "Recording Date", text: "For a new batch, choose the date that applies to the expenses. New expense rows use this date by default. Free accounts can use today and the previous seven days; older dates require UpTrend Business." },
          { target: ".expense-form-grid .expense-field:nth-child(1)", title: "Expense Date", text: "Choose the date the expense occurred. This is the date used in your expense records." },
          { target: ".expense-form-grid .expense-field:nth-child(2)", title: "Expense Name", text: "Enter a clear name describing what the business paid for, such as Transport, Shop Rent or Electricity." },
          { target: ".expense-form-grid .expense-field:nth-child(3)", title: "Expense Category", text: "Choose the category that best describes the expense. Categories help organise and analyse your business spending." },
          { target: ".expense-form-grid .expense-field:nth-child(4)", title: "Amount", text: "Enter the amount paid in naira. The amount is required and must be a valid non-negative number. When editing an existing expense, this field is locked." },
          { target: ".expense-form-grid .expense-field:nth-child(5)", title: "Payment Method", text: "Choose Cash if the expense was paid from cash, or Bank transfer if it was paid through your bank account. The choice determines whether a bank debit must be linked." },
          { target: ".expense-form-grid .expense-field:nth-child(6)", title: "Matching Bank Debit", text: "For a bank transfer, select the completed bank debit that matches this expense amount. Each debit can only be linked once, and the amount must match exactly." },
          { target: ".expense-field-full", title: "Optional Note", text: "Add any extra explanation, reference or detail that will help you identify the expense later. This field is optional." },
          { target: ".expense-form-footer", title: "Save and Manage Expense Rows", text: "Add Another creates an additional expense row. Cancel closes the form and clears the current entry. Save All Expenses submits the batch. When editing, Update Expense saves the changes to the selected record." },
          { target: ".expense-form-footer .expense-save", title: "Save Expenses", text: "Before saving, UpTrend checks required fields, amounts, historical-date access and bank debit matching. Correct any validation message before submitting." },
          { target: ".expense-form-card > div:last-child", title: "Batch Total", text: "This summary displays the number of expense rows in the batch and their combined amount. It updates as you add or change expenses." }
        ]
      }
    }));
  }, [showForm]);

  useEffect(() => {
    if (!showRecurringForm) return;

    window.dispatchEvent(new CustomEvent("uptrend:open-context-tour", {
      detail: {
        page: "expenses",
        context: "recurring-expense-form",
        steps: [
          { target: ".recurring-expense-form", title: "Recurring Expense Setup", text: "Create a schedule for a regular business cost. Complete the details so UpTrend knows what expense to record and when it becomes due." },
          { target: ".recurring-expense-form .expense-field:nth-child(1)", title: "Expense Name", text: "Enter the name of the regular cost, such as Shop Rent, Staff Salary or Internet Subscription." },
          { target: ".recurring-expense-form .expense-field:nth-child(2)", title: "Category", text: "Select the category that best describes this recurring cost. This helps organise your expense reports." },
          { target: ".recurring-expense-form .expense-field:nth-child(3)", title: "Amount", text: "Enter the amount expected for each occurrence of this expense." },
          { target: ".recurring-expense-form .expense-field:nth-child(4)", title: "Frequency", text: "Choose Daily, Weekly, Monthly or Yearly to define how often the expense repeats." },
          { target: ".recurring-expense-form .expense-field:nth-child(5)", title: "Start Date", text: "Choose the date the recurring expense schedule should begin. This date also becomes its initial next due date." },
          { target: ".recurring-expense-form .expense-field:nth-child(6)", title: "Time to Record", text: "Choose the time of day the scheduled expense should be recorded." },
          { target: ".recurring-expense-form .expense-field:nth-child(7)", title: "Payment Method", text: "Choose whether this regular expense is paid using cash or bank transfer." },
          { target: ".recurring-expense-form .expense-field-full", title: "Optional Note", text: "Add extra information about the recurring expense. This field is optional." },
          { target: ".recurring-expense-form .expense-form-footer", title: "Save Recurring Expense", text: "Save Recurring Expense creates the schedule. Cancel closes the form without saving it. The schedule will appear in your recurring expenses list." }
        ]
      }
    }));
  }, [showRecurringForm]);


  useEffect(() => {
    let mounted = true;

    const loadExpenses = async () => {
      setLoadingExpenses(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (mounted) {
            setExpenses([]);
            setError(
              "Please sign in to manage your expenses."
            );
          }

          return;
        }

        if (!navigator.onLine) {
          const [cachedExpenses, cachedDebits] = await Promise.all([
            getCachedRecords("expenses", user.id),
            getCachedRecords("expenseDebits", user.id),
          ]);

          if (mounted) {
            setExpenses(cachedExpenses.map((expense) => ({
              id: expense.id,
              date: expense.expense_date,
              name: expense.name,
              category: expense.category || "General",
              amount: Number(expense.amount || 0),
              note: expense.note || "",
              paymentMethod: expense.payment_method || "cash",
              financeTransactionId: expense.finance_transaction_id || null,
              createdAt: expense.created_at,
            })));

            setAvailableDebits(cachedDebits.map((transaction) => ({
              id: transaction.id,
              amount: Number(transaction.amount || 0),
              description: transaction.description || "",
              category: transaction.category || "",
              reference: transaction.reference || "",
              createdAt: transaction.created_at,
            })));
          }

          return;
        }

        const [
          expensesResult,
          debitsResult,
          saleLinksResult,
          supplierLinksResult,
          supplierBatchLinksResult,
          refundLinksResult,
        ] = await Promise.all([
          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("uptrend_finance_transactions")
            .select("id,type,amount,status,description,category,reference,created_at")
            .eq("user_id", user.id)
            .eq("type", "debit")
            .eq("status", "completed")
            .order("created_at", { ascending: false }),

          supabase
            .from("uptrend_sale_payments")
            .select("finance_transaction_id")
            .eq("user_id", user.id)
            .not("finance_transaction_id", "is", null),

          supabase
            .from("uptrend_supplier_payments")
            .select("finance_transaction_id")
            .eq("user_id", user.id)
            .not("finance_transaction_id", "is", null),

          supabase
            .from("uptrend_supplier_purchase_batches")
            .select("finance_transaction_id")
            .eq("user_id", user.id)
            .not("finance_transaction_id", "is", null),

          supabase
            .from("uptrend_sale_returns")
            .select("refund_finance_transaction_id")
            .eq("user_id", user.id)
            .not("refund_finance_transaction_id", "is", null),
        ]);

        const results = [
          expensesResult,
          debitsResult,
          saleLinksResult,
          supplierLinksResult,
          supplierBatchLinksResult,
          refundLinksResult,
        ];

        const failedResult = results.find((result) => result.error);
        if (failedResult) {
          throw failedResult.error;
        }

        const usedTransactionIds = new Set([
          ...(saleLinksResult.data || []).map(
            (item) => item.finance_transaction_id
          ),
          ...(supplierLinksResult.data || []).map(
            (item) => item.finance_transaction_id
          ),
          ...(supplierBatchLinksResult.data || []).map(
            (item) => item.finance_transaction_id
          ),
          ...(refundLinksResult.data || []).map(
            (item) => item.refund_finance_transaction_id
          ),
          ...(expensesResult.data || [])
            .map((item) => item.finance_transaction_id)
            .filter(Boolean),
        ]);

        const availableDebitRecords = (debitsResult.data || []).filter(
          (transaction) => !usedTransactionIds.has(transaction.id)
        );

        const cacheResults = await Promise.allSettled([
          saveCachedRecords("expenses", user.id, expensesResult.data || []),
          saveCachedRecords("expenseDebits", user.id, availableDebitRecords),
        ]);

        cacheResults.forEach((result) => {
          if (result.status === "rejected") {
            console.warn("Expense cache update failed:", result.reason);
          }
        });

        if (mounted) {
          setExpenses(
            (expensesResult.data || []).map((expense) => ({
              id: expense.id,
              date: expense.expense_date,
              name: expense.name,
              category: expense.category || "General",
              amount: Number(expense.amount || 0),
              note: expense.note || "",
              paymentMethod: expense.payment_method || "cash",
              financeTransactionId: expense.finance_transaction_id || null,
              createdAt: expense.created_at,
            }))
          );

          setAvailableDebits(
            availableDebitRecords.map((transaction) => ({
                id: transaction.id,
                amount: Number(transaction.amount || 0),
                description: transaction.description || "",
                category: transaction.category || "",
                reference: transaction.reference || "",
                createdAt: transaction.created_at,
              }))
          );
        }
      } catch (loadError) {
        console.error("Expenses load error:", loadError);

        if (mounted) {
          setError(
            "We couldn't load your expenses. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoadingExpenses(false);
        }
      }
    };

    loadExpenses();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isBusiness) {
      setRecurringExpenses([]);
      return;
    }

    let mounted = true;

    const loadRecurringExpenses = async () => {
      setLoadingRecurringExpenses(true);
      setRecurringError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          return;
        }

        if (!navigator.onLine) {
          const cachedRecurring = await getCachedRecords(
            "recurringExpenses",
            user.id
          );

          if (mounted) {
            setRecurringExpenses(
              cachedRecurring.sort((a, b) =>
                String(a.next_due_date || "").localeCompare(
                  String(b.next_due_date || "")
                )
              )
            );
          }

          return;
        }

        const { data, error: loadError } = await supabase
          .from("uptrend_recurring_expenses")
          .select("*")
          .eq("user_id", user.id)
          .order("next_due_date", {
            ascending: true,
          });

        if (loadError) {
          throw loadError;
        }

        const cacheResult = await Promise.allSettled([
          saveCachedRecords("recurringExpenses", user.id, data || []),
        ]);

        if (cacheResult[0].status === "rejected") {
          console.warn("Recurring expense cache update failed:", cacheResult[0].reason);
        }

        if (mounted) {
          setRecurringExpenses(data || []);
        }
      } catch (loadError) {
        console.error(
          "Recurring expenses load error:",
          loadError
        );

        if (mounted) {
          setRecurringError(
            "We couldn't load your recurring expenses."
          );
        }
      } finally {
        if (mounted) {
          setLoadingRecurringExpenses(false);
        }
      }
    };

    loadRecurringExpenses();

    return () => {
      mounted = false;
    };
  }, [isBusiness]);

  useEffect(() => {
    if (!expenseToOpenId || loadingExpenses) return;

    const target = expenses.find(
      (expense) => String(expense.id) === String(expenseToOpenId)
    );

    if (!target) return;

    const element = Array.from(
      document.querySelectorAll("[data-expense-id]")
    ).find(
      (item) => item.dataset.expenseId === String(expenseToOpenId)
    );

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    element.classList.add("linked-record-highlight");

    window.setTimeout(() => {
      element.classList.remove("linked-record-highlight");
    }, 1600);

    onExpenseOpenHandled?.();
  }, [
    expenseToOpenId,
    loadingExpenses,
    expenses,
    onExpenseOpenHandled,
  ]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "uptrend_expense_draft",
        JSON.stringify({
          expenseForms,
          batchDate,
          editingId,
          showForm,
        })
      );
    } catch {}
  }, [
    expenseForms,
    batchDate,
    editingId,
    showForm,
  ]);

  const totals = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0
    );

    return {
      total,
      count: expenses.length,
    };
  }, [expenses]);

  const batchTotals = useMemo(() => {
    const total = expenseForms.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0
    );

    return {
      total,
      count: expenseForms.length,
    };
  }, [expenseForms]);

  const categoryAnalysis = useMemo(() => {
    const categoryMap = new Map();

    expenses.forEach((expense) => {
      const category = expense.category || "General";
      const amount = Number(expense.amount || 0);

      categoryMap.set(
        category,
        (categoryMap.get(category) || 0) + amount
      );
    });

    const categories = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = categories.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const highestExpense = expenses.reduce(
      (highest, expense) =>
        Number(expense.amount || 0) >
        Number(highest?.amount || 0)
          ? expense
          : highest,
      null
    );

    const average =
      expenses.length > 0
        ? total / expenses.length
        : 0;

    return {
      categories,
      total,
      average,
      highestExpense,
      topCategory: categories[0] || null,
    };
  }, [expenses]);

  const expensePerformanceAnalysis = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`);

    const getDateKey = (offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() - offset);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const currentPeriodStart = getDateKey(6);
    const previousPeriodStart = getDateKey(13);
    const previousPeriodEnd = getDateKey(7);

    const currentPeriodTotal = expenses
      .filter(
        (expense) =>
          expense.date >= currentPeriodStart &&
          expense.date <= todayKey
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    const previousPeriodTotal = expenses
      .filter(
        (expense) =>
          expense.date >= previousPeriodStart &&
          expense.date <= previousPeriodEnd
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );

    let percentageChange = 0;

    if (previousPeriodTotal > 0) {
      percentageChange =
        ((currentPeriodTotal - previousPeriodTotal) /
          previousPeriodTotal) *
        100;
    } else if (currentPeriodTotal > 0) {
      percentageChange = 100;
    }

    let direction = "stable";

    if (percentageChange > 5) {
      direction = "up";
    } else if (percentageChange < -5) {
      direction = "down";
    }

    const dailyTrend = Array.from(
      { length: 7 },
      (_, index) => {
        const dateKey = getDateKey(6 - index);

        const total = expenses
          .filter(
            (expense) =>
              expense.date === dateKey
          )
          .reduce(
            (sum, expense) =>
              sum + Number(expense.amount || 0),
            0
          );

        const date = new Date(`${dateKey}T00:00:00`);

        return {
          date: dateKey,
          label: date.toLocaleDateString(
            undefined,
            { weekday: "short" }
          ),
          total,
        };
      }
    );

    return {
      currentPeriodTotal,
      previousPeriodTotal,
      percentageChange,
      direction,
      dailyTrend,
    };
  }, [expenses, todayKey]);

  const updateExpenseField = (
    index,
    field,
    value
  ) => {
    setExpenseForms((current) =>
      current.map((expense, expenseIndex) =>
        expenseIndex === index
          ? {
              ...expense,
              [field]: value,
              ...(field === "amount" || field === "paymentMethod"
                ? { financeTransactionId: "" }
                : {}),
            }
          : expense
      )
    );

    if (field === "date") {
      setBatchDate(value);
    }

    setError("");
    setSaved(false);
  };

  const addExpense = () => {
    setExpenseForms((current) => [
      ...current,
      createEmptyExpense(batchDate),
    ]);

    setError("");
    setSaved(false);
  };

  const removeExpenseRow = (index) => {
    if (expenseForms.length === 1) {
      return;
    }

    setExpenseForms((current) =>
      current.filter(
        (_, rowIndex) => rowIndex !== index
      )
    );

    setError("");
    setSaved(false);
  };

  const resetForm = () => {
    setExpenseForms([
      createEmptyExpense(batchDate),
    ]);

    setEditingId(null);
    setShowForm(false);
    setError("");
    setSaved(false);
  };

  const startNewExpenseSession = () => {
    setEditingId(null);

    setExpenseForms([
      createEmptyExpense(batchDate),
    ]);

    setShowForm(true);
    setError("");
    setSaved(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const getNextRecurringDate = (
    startDate,
    frequency
  ) => {
    const date = new Date(`${startDate}T00:00:00`);

    if (frequency === "daily") {
      date.setDate(date.getDate() + 1);
    } else if (frequency === "weekly") {
      date.setDate(date.getDate() + 7);
    } else if (frequency === "monthly") {
      date.setMonth(date.getMonth() + 1);
    } else if (frequency === "yearly") {
      date.setFullYear(date.getFullYear() + 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const updateRecurringField = (
    field,
    value
  ) => {
    setRecurringForm((current) => ({
      ...current,
      [field]: value,
    }));

    setRecurringError("");
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      name: "",
      category: "General",
      amount: "",
      note: "",
      paymentMethod: "cash",
      frequency: "monthly",
      startDate: getToday(),
      timeOfDay: "09:00",
    });

    setRecurringError("");
    setShowRecurringForm(false);
  };

  const handleRecurringSubmit = async (event) => {
    event.preventDefault();

    if (!isBusiness) {
      setHistoricalAccessOpen(true);
      return;
    }

    const name = recurringForm.name.trim();
    const amount = Number(recurringForm.amount);

    if (
      !name ||
      !recurringForm.startDate ||
      !recurringForm.amount
    ) {
      setRecurringError(
        "Please complete all required fields."
      );
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setRecurringError(
        "Please enter a valid recurring expense amount."
      );
      return;
    }

    try {
      setRecurringError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRecurringError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      const { data, error: insertError } =
        await supabase
          .from("uptrend_recurring_expenses")
          .insert({
            user_id: user.id,
            name,
            category:
              recurringForm.category || "General",
            amount,
            note: recurringForm.note.trim(),
            payment_method:
              recurringForm.paymentMethod || "cash",
            frequency: recurringForm.frequency,
            start_date: recurringForm.startDate,
            next_due_date: recurringForm.startDate,
            time_of_day: recurringForm.timeOfDay,
            active: true,
          })
          .select("*")
          .single();

      if (insertError) {
        throw insertError;
      }

      setRecurringExpenses((current) =>
        [...current, data].sort(
          (a, b) =>
            String(a.next_due_date).localeCompare(
              String(b.next_due_date)
            )
        )
      );

      setRecurringForm({
        name: "",
        category: "General",
        amount: "",
        note: "",
        paymentMethod: "cash",
        frequency: "monthly",
        startDate: getToday(),
        timeOfDay: "09:00",
      });

      setShowRecurringForm(false);

      await logAudit({
        action: "recurring_expense_created",
        category: "expenses",
        description: `Created recurring expense: ${data.name}`,
        entityType: "recurring_expense",
        entityId: data.id,
        amount: Number(data.amount || 0),
        currency: "NGN",
        details: {
          name: data.name,
          category: data.category || "General",
          frequency: data.frequency,
          startDate: data.start_date,
          nextDueDate: data.next_due_date,
          timeOfDay: data.time_of_day,
          paymentMethod: data.payment_method || "cash",
          active: Boolean(data.active),
          source: "Recurring expenses",
          destination: `Expense: ${data.name}`,
        },
      });
    } catch (saveError) {
      console.error(
        "Recurring expense save error:",
        saveError
      );

      setRecurringError(
        "We couldn't save the recurring expense. Please try again."
      );
    }
  };

  const toggleRecurringExpense = async (recurringExpense) => {
    if (!isBusiness) {
      setHistoricalAccessOpen(true);
      return;
    }

    try {
      const { data, error: updateError } =
        await supabase
          .from("uptrend_recurring_expenses")
          .update({
            active: !recurringExpense.active,
          })
          .eq("id", recurringExpense.id)
          .select("*")
          .single();

      if (updateError) {
        throw updateError;
      }

      setRecurringExpenses((current) =>
        current.map((item) =>
          item.id === recurringExpense.id
            ? data
            : item
        )
      );

      await logAudit({
        action: data.active
          ? "recurring_expense_resumed"
          : "recurring_expense_paused",
        category: "expenses",
        description: `${data.active ? "Resumed" : "Paused"} recurring expense: ${data.name}`,
        entityType: "recurring_expense",
        entityId: data.id,
        amount: Number(data.amount || 0),
        currency: "NGN",
        details: {
          name: data.name,
          category: data.category || "General",
          frequency: data.frequency,
          startDate: data.start_date,
          nextDueDate: data.next_due_date,
          timeOfDay: data.time_of_day,
          paymentMethod: data.payment_method || "cash",
          active: Boolean(data.active),
          source: "Recurring expenses",
        },
      });
    } catch (updateError) {
      console.error(
        "Recurring expense update error:",
        updateError
      );

      setRecurringError(
        "We couldn't update this recurring expense."
      );
    }
  };

  const deleteRecurringExpense = async (id) => {
    const recurringExpense = recurringExpenses.find(
      (item) => item.id === id
    );

    if (!isBusiness) {
      setHistoricalAccessOpen(true);
      return;
    }

    const confirmed = window.confirm(
      "Delete this recurring expense?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const { error: deleteError } =
        await supabase
          .from("uptrend_recurring_expenses")
          .delete()
          .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setRecurringExpenses((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );

      if (recurringExpense) {
        await logAudit({
          action: "recurring_expense_deleted",
          category: "expenses",
          description: `Deleted recurring expense: ${recurringExpense.name}`,
          entityType: "recurring_expense",
          entityId: recurringExpense.id,
          amount: Number(recurringExpense.amount || 0),
          currency: "NGN",
          details: {
            name: recurringExpense.name,
            category: recurringExpense.category || "General",
            frequency: recurringExpense.frequency,
            startDate: recurringExpense.start_date,
            nextDueDate: recurringExpense.next_due_date,
            timeOfDay: recurringExpense.time_of_day,
            paymentMethod: recurringExpense.payment_method || "cash",
            active: Boolean(recurringExpense.active),
            source: "Recurring expenses",
          },
        });
      }
    } catch (deleteError) {
      console.error(
        "Recurring expense delete error:",
        deleteError
      );

      setRecurringError(
        "We couldn't delete this recurring expense."
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSaved(false);

    const wasEditing = Boolean(editingId);

    const hasRestrictedHistoricalDate =
      expenseForms.some(
        (expense) =>
          expense.date &&
          expense.date < freeHistoryCutoff
      );

    if (!isBusiness && hasRestrictedHistoricalDate) {
      setHistoricalAccessOpen(true);
      return;
    }

    if (editingId) {
      const form = expenseForms[0];

      if (
        !form ||
        !form.date ||
        !form.name.trim() ||
        !form.amount
      ) {
        setError(
          "Please complete all required fields."
        );

        return;
      }

      const amount = Number(form.amount);

      if (
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        setError(
          "Please enter a valid expense amount."
        );

        return;
      }

      const existingExpense = expenses.find(
        (item) => item.id === editingId
      );

      const updatedExpense = {
        id: editingId,
        date: form.date,
        name: form.name.trim(),
        category: form.category,
        amount,
        note: form.note.trim(),
        createdAt:
          existingExpense?.createdAt ||
          new Date().toISOString(),
      };

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError(
            "Your session has expired. Please sign in again."
          );
          return;
        }

        const { error: updateError } =
          await supabase
            .from("expenses")
            .update({
              name: updatedExpense.name,
              category: updatedExpense.category,
              note: updatedExpense.note,
              expense_date: updatedExpense.date,
            })
            .eq("id", editingId)
            .eq("user_id", user.id);

        if (updateError) {
          throw updateError;
        }

        setExpenses((current) =>
          current.map((item) =>
            item.id === editingId
              ? updatedExpense
              : item
          )
        );

        await logAudit({
          action: "expense_updated",
          category: "expenses",
          description: `Updated expense: ${updatedExpense.name}`,
          entityType: "expense",
          entityId: editingId,
          amount: updatedExpense.amount,
          currency: "NGN",
          details: {
            name: updatedExpense.name,
            category: updatedExpense.category,
            date: updatedExpense.date,
            note: updatedExpense.note,
            paymentMethod: existingExpense?.paymentMethod || "cash",
            financeTransactionId: existingExpense?.financeTransactionId || null,
            linked: Boolean(existingExpense?.financeTransactionId),
            linkStatus: existingExpense?.financeTransactionId ? "linked" : "not_linked",
            relation: existingExpense?.financeTransactionId
              ? "expense_to_finance_transaction"
              : null,
            source: existingExpense?.financeTransactionId
              ? "Finance transaction"
              : "Payment source not linked",
            destination: `Expense: ${updatedExpense.name}`,
          },
        });
      } catch (saveError) {
        console.error(
          "Expense update error:",
          saveError
        );

        setError(
          "We couldn't update this expense. Please try again."
        );

        return;
      }

      setBatchDate(form.date);

      setEditingId(null);

      setExpenseForms([
        createEmptyExpense(form.date),
      ]);

      setSaved(true);

      try {
        sessionStorage.removeItem(
          "uptrend_expense_draft"
        );
      } catch {}

      return;
    }

    const invalidIndex = expenseForms.findIndex(
      (expense) =>
        !expense.date ||
        !expense.name.trim() ||
        !expense.amount
    );

    if (invalidIndex !== -1) {
      setError(
        `Please complete all required fields for expense ${
          invalidIndex + 1
        }.`
      );

      return;
    }

    const invalidAmountIndex =
      expenseForms.findIndex((expense) => {
        const amount = Number(expense.amount);

        return (
          !Number.isFinite(amount) ||
          amount < 0
        );
      });

    if (invalidAmountIndex !== -1) {
      setError(
        `Please enter a valid amount for expense ${
          invalidAmountIndex + 1
        }.`
      );

      return;
    }

    const missingTransferIndex = expenseForms.findIndex(
      (expense) =>
        (expense.paymentMethod || "cash") === "transfer" &&
        !expense.financeTransactionId
    );

    if (missingTransferIndex !== -1) {
      setError(
        `Select the matching bank debit for expense ${missingTransferIndex + 1}.`
      );
      return;
    }

    const invalidTransferIndex = expenseForms.findIndex(
      (expense) =>
        (expense.paymentMethod || "cash") === "transfer" &&
        !availableDebits.some(
          (transaction) =>
            transaction.id === expense.financeTransactionId &&
            transaction.amount === Number(expense.amount)
        )
    );

    if (invalidTransferIndex !== -1) {
      setError(
        `The selected bank debit for expense ${invalidTransferIndex + 1} does not match its amount. Please select it again.`
      );
      return;
    }

    const savedExpenseCount =
      expenseForms.length;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      const mappedExpenses = [];

      for (const form of expenseForms) {
        const { data: expenseId, error: rpcError } =
          await supabase.rpc("record_uptrend_expense", {
            p_name: form.name.trim(),
            p_amount: Number(form.amount),
            p_category: form.category,
            p_note: form.note.trim(),
            p_expense_date: form.date,
            p_payment_method: form.paymentMethod || "cash",
            p_finance_transaction_id:
              (form.paymentMethod || "cash") === "transfer"
                ? form.financeTransactionId
                : null,
          });

        if (rpcError) {
          throw rpcError;
        }

        const {
          data: insertedExpense,
          error: fetchError,
        } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", expenseId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        mappedExpenses.push({
          id: insertedExpense.id,
          date: insertedExpense.expense_date,
          name: insertedExpense.name,
          category: insertedExpense.category || "General",
          amount: Number(insertedExpense.amount || 0),
          note: insertedExpense.note || "",
          paymentMethod: insertedExpense.payment_method || "cash",
          financeTransactionId:
            insertedExpense.finance_transaction_id || null,
          createdAt: insertedExpense.created_at,
        });

        await logAudit({
          action: "expense_recorded",
          category: "expenses",
          description: `Recorded expense: ${insertedExpense.name}`,
          entityType: "expense",
          entityId: insertedExpense.id,
          amount: Number(insertedExpense.amount || 0),
          currency: "NGN",
          details: {
            name: insertedExpense.name,
            category: insertedExpense.category || "General",
            date: insertedExpense.expense_date,
            note: insertedExpense.note || "",
            paymentMethod: insertedExpense.payment_method || "cash",
            financeTransactionId:
              insertedExpense.finance_transaction_id || null,
            linked: Boolean(insertedExpense.finance_transaction_id),
            linkStatus: insertedExpense.finance_transaction_id ? "linked" : "not_linked",
            relation: insertedExpense.finance_transaction_id
              ? "expense_to_finance_transaction"
              : null,
            source: insertedExpense.finance_transaction_id
              ? "Finance transaction"
              : "Business funds",
            destination: `Expense: ${insertedExpense.name}`,
          },
        });
      }

      setExpenses((current) => [
        ...mappedExpenses,
        ...current,
      ]);
    } catch (saveError) {
      console.error(
        "Expense save error:",
        saveError
      );

      setError(
        saveError?.message ||
        "We couldn't save the expenses. Please try again."
      );

      return;
    }

    setExpenseForms([
      createEmptyExpense(batchDate),
    ]);

    setEditingId(null);
    setShowForm(false);

    setSaved(true);

    try {
      sessionStorage.removeItem(
        "uptrend_expense_draft"
      );
    } catch {}
  };

  const handleEdit = (expense) => {
    setBatchDate(expense.date);

    setExpenseForms([
      {
        date: expense.date,
        name: expense.name,
        category:
          expense.category || "General",
        amount: String(expense.amount),
        note: expense.note || "",
        paymentMethod: expense.paymentMethod || "cash",
        financeTransactionId: expense.financeTransactionId || "",
      },
    ]);

    setEditingId(expense.id);
    setShowForm(true);
    setError("");
    setSaved(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    const expense = expenses.find(
      (item) => item.id === id
    );

    if (!expense) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the ${expense.name} expense?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      const { error: deleteError } =
        await supabase.rpc("delete_uptrend_expense", {
          p_expense_id: id,
        });

      if (deleteError) {
        throw deleteError;
      }

      setExpenses((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );

      await logAudit({
        action: "expense_deleted",
        category: "expenses",
        description: `Deleted expense: ${expense.name}`,
        entityType: "expense",
        entityId: id,
        amount: expense.amount,
        currency: "NGN",
        details: {
          name: expense.name,
          category: expense.category,
          date: expense.date,
          note: expense.note,
          paymentMethod: expense.paymentMethod || "cash",
          financeTransactionId: expense.financeTransactionId || null,
          linked: Boolean(expense.financeTransactionId),
          linkStatus: expense.financeTransactionId ? "linked" : "not_linked",
          relation: expense.financeTransactionId
            ? "expense_to_finance_transaction"
            : null,
          source: expense.financeTransactionId
            ? "Finance transaction"
            : "Business funds",
          destination: `Expense: ${expense.name}`,
        },
      });
    } catch (deleteError) {
      console.error(
        "Expense delete error:",
        deleteError
      );

      setError(
        "We couldn't delete this expense. Please try again."
      );

      return;
    }

    if (editingId === id) {
      setEditingId(null);

      setExpenseForms([
        createEmptyExpense(batchDate),
      ]);

      setShowForm(false);
    }
  };

  if (loadingExpenses) {
    return (
      <div className="expenses-page">
        <div
          className="premium-card"
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          Loading your expenses...
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-page">
      <div className="expenses-page-top">
        <div>
          <div className="mini-label">
            CASH OUTFLOW
          </div>

          <h2>Expenses</h2>

          <p>
            Record and track the money
            your business spends.
          </p>
        </div>

        <button
          className="expense-add-button"
          onClick={
            startNewExpenseSession
          }
        >
          <span>+</span>
          Record Expense
        </button>
      </div>

      {!isBusiness && (
        <BusinessBenefitsBanner
          onUpgrade={onUpgrade}
        />
      )}

      <section className="expense-overview">
        <div className="expense-stat premium-card">
          <div className="expense-stat-icon">
            ↓
          </div>

          <div>
            <span>Total Expenses</span>

            <strong>
              {formatMoney(totals.total)}
            </strong>

            <small>
              All recorded expenses
            </small>
          </div>
        </div>

        <div className="expense-stat premium-card">
          <div className="expense-stat-icon">
            #
          </div>

          <div>
            <span>Transactions</span>

            <strong>
              {formatNumber(totals.count)}
            </strong>

            <small>
              Expense records
            </small>
          </div>
        </div>

        <div className="expense-stat premium-card">
          <div className="expense-stat-icon">
            ₦
          </div>

          <div>
            <span>Business Outflow</span>

            <strong>
              {formatMoney(totals.total)}
            </strong>

            <small>
              Money leaving the business
            </small>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="expense-form-card premium-card">
          <div className="expense-form-heading">
            <div>
              <div className="mini-label">
                {editingId
                  ? "UPDATE EXPENSE"
                  : "EXPENSE BATCH"}
              </div>

              <h3>
                {editingId
                  ? "Edit expense"
                  : "Record expenses"}
              </h3>

              {!editingId && (
                <p>
                  Add everything you need
                  before saving.
                </p>
              )}
            </div>

            <button
              type="button"
              className="expense-close"
              onClick={resetForm}
            >
              ×
            </button>
          </div>

          {!editingId && (
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 16px",
                borderRadius: "14px",
                background:
                  "rgba(124, 58, 237, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    letterSpacing: "0.08em",
                    opacity: "0.65",
                  }}
                >
                  RECORDING DATE
                </span>

                <strong>
                  {batchDate}
                </strong>
              </div>

              <span>
                New expenses will use
                this date.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gap: "16px",
              }}
            >
              {expenseForms.map(
                (expense, index) => (
                  <div
                    key={`expense-row-${index}`}
                    className="premium-card"
                    style={{
                      padding: "20px",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                        marginBottom:
                          "18px",
                      }}
                    >
                      <strong>
                        Expense {formatNumber(index + 1)}
                      </strong>

                      {!editingId &&
                        expenseForms.length >
                          1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeExpenseRow(
                                index
                              )
                            }
                            style={{
                              border: "0",
                              background:
                                "transparent",
                              cursor:
                                "pointer",
                              fontWeight:
                                "700",
                            }}
                          >
                            Remove
                          </button>
                        )}
                    </div>

                    <div className="expense-form-grid">
                      <label className="expense-field">
                        <span>Date</span>

                        <input
                          type="date"
                          value={expense.date}
                          onChange={(event) => {
                            const value = event.target.value;

                            if (
                              !isBusiness &&
                              value &&
                              value < freeHistoryCutoff
                            ) {
                              setHistoricalAccessOpen(true);
                              return;
                            }

                            updateExpenseField(
                              index,
                              "date",
                              value
                            );
                          }}
                        />
                      </label>

                      <label className="expense-field">
                        <span>
                          Expense name
                        </span>

                        <input
                          type="text"
                          placeholder="e.g. Transport"
                          value={expense.name}
                          onChange={(event) =>
                            updateExpenseField(
                              index,
                              "name",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className="expense-field">
                        <span>Category</span>

                        <select
                          value={
                            expense.category
                          }
                          onChange={(event) =>
                            updateExpenseField(
                              index,
                              "category",
                              event.target.value
                            )
                          }
                        >
                          <option>
                            General
                          </option>

                          <option>
                            Transport
                          </option>

                          <option>
                            Purchases
                          </option>

                          <option>
                            Food
                          </option>

                          <option>
                            Rent
                          </option>

                          <option>
                            Utilities
                          </option>

                          <option>
                            Marketing
                          </option>

                          <option>
                            Salary
                          </option>

                          <option>
                            Savings
                          </option>

                          <option>
                            Other
                          </option>
                        </select>
                      </label>

                      <label className="expense-field">
                        <span>Amount</span>

                        <div className="expense-money-input">
                          <b>₦</b>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            disabled={Boolean(editingId)}
                            value={
                              expense.amount
                            }
                            onChange={(event) =>
                              updateExpenseField(
                                index,
                                "amount",
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </label>

                      <label className="expense-field">
                        <span>Payment method</span>
                        <select
                          value={expense.paymentMethod || "cash"}
                          disabled={Boolean(editingId)}
                          onChange={(event) =>
                            updateExpenseField(
                              index,
                              "paymentMethod",
                              event.target.value
                            )
                          }
                        >
                          <option value="cash">Cash</option>
                          <option value="transfer">Bank transfer</option>
                        </select>
                      </label>

                      {(expense.paymentMethod || "cash") === "transfer" && (
                        <label className="expense-field">
                          <span>Matching bank debit</span>
                          <select
                            value={expense.financeTransactionId || ""}
                            disabled={Boolean(editingId)}
                            onChange={(event) =>
                              updateExpenseField(
                                index,
                                "financeTransactionId",
                                event.target.value
                              )
                            }
                          >
                            <option value="">Select matching debit</option>
                            {availableDebits
                              .filter(
                                (transaction) =>
                                  transaction.amount === Number(expense.amount) &&
                                  !expenseForms.some(
                                    (other, otherIndex) =>
                                      otherIndex !== index &&
                                      other.financeTransactionId === transaction.id
                                  )
                              )
                              .map((transaction) => (
                                <option key={transaction.id} value={transaction.id}>
                                  {formatMoney(transaction.amount)} —{" "}
                                  {transaction.description ||
                                    transaction.category ||
                                    transaction.reference ||
                                    new Date(transaction.createdAt).toLocaleString()}
                                </option>
                              ))}
                          </select>
                          {availableDebits.filter(
                            (transaction) =>
                              transaction.amount === Number(expense.amount) &&
                              !expenseForms.some(
                                (other, otherIndex) =>
                                  otherIndex !== index &&
                                  other.financeTransactionId === transaction.id
                              )
                          ).length === 0 && (
                            <small>
                              No unused completed bank debit matches this amount.
                            </small>
                          )}
                        </label>
                      )}

                      <label className="expense-field expense-field-full">
                        <span>Note</span>

                        <textarea
                          placeholder="Optional note..."
                          value={
                            expense.note
                          }
                          onChange={(event) =>
                            updateExpenseField(
                              index,
                              "note",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )
              )}
            </div>

            {error && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background:
                    "rgba(220, 38, 38, 0.08)",
                  color: "#dc2626",
                  fontWeight: "600",
                }}
              >
                {error}
              </div>
            )}

            {saved && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background:
                    "rgba(22, 163, 74, 0.08)",
                  color: "#16a34a",
                  fontWeight: "600",
                }}
              >
                ✓{" "}
                {wasEditing
                  ? "Expense updated successfully."
                  : `${formatNumber(savedExpenseCount)} expense${
                      savedExpenseCount ===
                      1
                        ? ""
                        : "s"
                    } saved successfully.`}
              </div>
            )}

            <div className="expense-form-footer">
              <p>
                {editingId
                  ? "Update the expense and save the change."
                  : "Add all your expenses first. They will be saved together when you press Save All Expenses."}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  justifyContent:
                    "flex-end",
                }}
              >
                {!editingId && (
                  <button
                    type="button"
                    className="expense-cancel"
                    onClick={addExpense}
                  >
                    + Add Another
                  </button>
                )}

                <button
                  type="button"
                  className="expense-cancel"
                  onClick={resetForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="expense-save"
                >
                  {editingId
                    ? "Update Expense"
                    : `Save All Expenses${
                        expenseForms.length >
                        1
                          ? ` (${expenseForms.length})`
                          : ""
                      }`}

                  <span>→</span>
                </button>
              </div>
            </div>
          </form>

          {!editingId && (
            <div
              style={{
                marginTop: "18px",
                padding: "16px",
                borderRadius: "14px",
                background:
                  "rgba(124, 58, 237, 0.06)",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <span>Batch total</span>

              <strong>
                {formatNumber(batchTotals.count)} expense
                {batchTotals.count === 1
                  ? ""
                  : "s"}{" "}
                •{" "}
                {formatMoney(
                  batchTotals.total
                )}
              </strong>
            </div>
          )}
        </section>
      )}

      {isBusiness && expenses.length > 0 && (
        <section className="expense-business-analysis premium-card">
          <div className="panel-heading">
            <div>
              <div className="mini-label">
                BUSINESS ANALYSIS
              </div>

              <h2>Expense category analysis</h2>

              <p>
                See where your business spending is going
                across your expense categories.
              </p>
            </div>

            <span className="expenses-count">
              Business
            </span>
          </div>

          <div className="expense-analysis-summary">
            <div className="expense-analysis-stat">
              <span>Total spending</span>
              <strong>
                {formatMoney(categoryAnalysis.total)}
              </strong>
            </div>

            <div className="expense-analysis-stat">
              <span>Average expense</span>
              <strong>
                {formatMoney(categoryAnalysis.average)}
              </strong>
            </div>

            <div className="expense-analysis-stat">
              <span>Top category</span>
              <strong>
                {categoryAnalysis.topCategory?.category || "—"}
              </strong>
            </div>

            <div className="expense-analysis-stat">
              <span>Largest expense</span>
              <strong>
                {categoryAnalysis.highestExpense
                  ? formatMoney(
                      Number(
                        categoryAnalysis.highestExpense.amount || 0
                      )
                    )
                  : "—"}
              </strong>
            </div>
          </div>

          <div className="expense-category-analysis">
            <div className="expense-category-analysis-heading">
              <strong>Spending by category</strong>
              <span>
                {formatNumber(categoryAnalysis.categories.length)}{" "}
                categor
                {categoryAnalysis.categories.length === 1
                  ? "y"
                  : "ies"}
              </span>
            </div>

            <div className="expense-category-list">
              {categoryAnalysis.categories.map((item) => {
                const percentage =
                  categoryAnalysis.total > 0
                    ? (item.amount / categoryAnalysis.total) * 100
                    : 0;

                return (
                  <div
                    key={item.category}
                    className="expense-category-analysis-row"
                  >
                    <div className="expense-category-analysis-top">
                      <strong>{item.category}</strong>

                      <span>
                        {formatMoney(item.amount)} ·{" "}
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="expense-category-analysis-bar">
                      <span
                        style={{
                          width: `${Math.min(
                            percentage,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {isBusiness && expenses.length > 0 && (
        <section className="expense-performance-card premium-card">
          <div className="panel-heading">
            <div>
              <div className="mini-label">
                BUSINESS INSIGHTS
              </div>

              <h2>Expense performance</h2>

              <p>
                Understand how your spending is changing
                over the last 7 days.
              </p>
            </div>

            <span className="expenses-count">
              Last 7 days
            </span>
          </div>

          <div className="expense-performance-grid">
            <div className="expense-performance-stat">
              <span>This 7 days</span>
              <strong>
                {formatMoney(
                  expensePerformanceAnalysis.currentPeriodTotal
                )}
              </strong>
            </div>

            <div className="expense-performance-stat">
              <span>Previous 7 days</span>
              <strong>
                {formatMoney(
                  expensePerformanceAnalysis.previousPeriodTotal
                )}
              </strong>
            </div>

            <div className="expense-performance-stat">
              <span>Change</span>
              <strong>
                {expensePerformanceAnalysis.percentageChange > 0
                  ? "+"
                  : ""}
                {expensePerformanceAnalysis.percentageChange.toFixed(1)}%
              </strong>

              <small>
                {expensePerformanceAnalysis.direction === "up"
                  ? "Spending increased"
                  : expensePerformanceAnalysis.direction === "down"
                    ? "Spending decreased"
                    : "Spending is stable"}
              </small>
            </div>
          </div>

          <div className="expense-trend">
            <div className="expense-trend-heading">
              <strong>7-day spending trend</strong>
              <span>
                Daily expense activity
              </span>
            </div>

            <div className="expense-trend-chart">
              {expensePerformanceAnalysis.dailyTrend.map(
                (item) => {
                  const max =
                    Math.max(
                      ...expensePerformanceAnalysis.dailyTrend.map(
                        (day) => day.total
                      ),
                      1
                    );

                  const height =
                    (item.total / max) * 100;

                  return (
                    <div
                      key={item.date}
                      className="expense-trend-column"
                    >
                      <div className="expense-trend-value">
                        {item.total > 0
                          ? formatMoney(item.total)
                          : "—"}
                      </div>

                      <div className="expense-trend-bar-wrap">
                        <span
                          className="expense-trend-bar"
                          style={{
                            height: `${Math.max(
                              height,
                              item.total > 0 ? 8 : 2
                            )}%`,
                          }}
                        />
                      </div>

                      <span className="expense-trend-label">
                        {item.label}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </section>
      )}

      {isBusiness && (
        <section className="recurring-expenses-card premium-card">
          <div className="panel-heading">
            <div>
              <div className="mini-label">
                BUSINESS FEATURE
              </div>

              <h2>Recurring expenses</h2>

              <p>
                Keep regular business costs on a schedule.
              </p>
            </div>

            <button
              type="button"
              className="expense-add-button"
              onClick={() => {
                setShowRecurringForm(
                  (current) => !current
                );
                setRecurringError("");
              }}
            >
              <span>+</span>
              {showRecurringForm
                ? "Close"
                : "Add Recurring Expense"}
            </button>
          </div>

          {showRecurringForm && (
            <form
              className="recurring-expense-form"
              onSubmit={handleRecurringSubmit}
            >
              <div className="expense-form-grid">
                <label className="expense-field">
                  <span>Expense name</span>

                  <input
                    type="text"
                    placeholder="e.g. Shop rent"
                    value={recurringForm.name}
                    onChange={(event) =>
                      updateRecurringField(
                        "name",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="expense-field">
                  <span>Category</span>

                  <select
                    value={recurringForm.category}
                    onChange={(event) =>
                      updateRecurringField(
                        "category",
                        event.target.value
                      )
                    }
                  >
                    <option>General</option>
                    <option>Transport</option>
                    <option>Purchases</option>
                    <option>Food</option>
                    <option>Rent</option>
                    <option>Utilities</option>
                    <option>Marketing</option>
                    <option>Salary</option>
                    <option>Savings</option>
                    <option>Other</option>
                  </select>
                </label>

                <label className="expense-field">
                  <span>Amount</span>

                  <div className="expense-money-input">
                    <b>₦</b>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={recurringForm.amount}
                      onChange={(event) =>
                        updateRecurringField(
                          "amount",
                          event.target.value
                        )
                      }
                    />
                  </div>
                </label>

                <label className="expense-field">
                  <span>Frequency</span>

                  <select
                    value={recurringForm.frequency}
                    onChange={(event) =>
                      updateRecurringField(
                        "frequency",
                        event.target.value
                      )
                    }
                  >
                    <option value="daily">
                      Daily
                    </option>

                    <option value="weekly">
                      Weekly
                    </option>

                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="yearly">
                      Yearly
                    </option>
                  </select>
                </label>

                <label className="expense-field">
                  <span>Start date</span>

                  <input
                    type="date"
                    value={recurringForm.startDate}
                    onChange={(event) =>
                      updateRecurringField(
                        "startDate",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="expense-field">
                  <span>Time to record</span>

                  <input
                    type="time"
                    value={recurringForm.timeOfDay}
                    onChange={(event) =>
                      updateRecurringField(
                        "timeOfDay",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="expense-field">
                  <span>Payment method</span>

                  <select
                    value={recurringForm.paymentMethod}
                    onChange={(event) =>
                      updateRecurringField(
                        "paymentMethod",
                        event.target.value
                      )
                    }
                  >
                    <option value="cash">
                      Cash
                    </option>

                    <option value="transfer">
                      Bank transfer
                    </option>
                  </select>
                </label>

                <label className="expense-field expense-field-full">
                  <span>Note</span>

                  <textarea
                    placeholder="Optional note..."
                    value={recurringForm.note}
                    onChange={(event) =>
                      updateRecurringField(
                        "note",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              {recurringError && (
                <div className="recurring-expense-error">
                  {recurringError}
                </div>
              )}

              <div className="expense-form-footer">
                <p>
                  UpTrend will use this schedule to record
                  the expense when it becomes due.
                </p>

                <div>
                  <button
                    type="button"
                    className="expense-cancel"
                    onClick={resetRecurringForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="expense-save"
                  >
                    Save Recurring Expense
                    <span>→</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {loadingRecurringExpenses ? (
            <div className="recurring-expense-empty">
              Loading recurring expenses...
            </div>
          ) : recurringExpenses.length === 0 ? (
            !showRecurringForm && (
              <div className="recurring-expense-empty">
                <strong>
                  No recurring expenses yet.
                </strong>

                <span>
                  Add rent, salaries, subscriptions,
                  utilities, or other regular costs.
                </span>
              </div>
            )
          ) : (
            <div className="recurring-expense-list">
              {recurringExpenses.map(
                (recurringExpense) => (
                  <div
                    key={recurringExpense.id}
                    className="recurring-expense-row"
                  >
                    <div>
                      <strong>
                        {recurringExpense.name}
                      </strong>

                      <span>
                        {recurringExpense.category}
                        {" · "}
                        {recurringExpense.frequency}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatMoney(
                          Number(
                            recurringExpense.amount || 0
                          )
                        )}
                      </strong>

                      <span>
                        Next: {recurringExpense.next_due_date}
                        {" · "}
                        {recurringExpense.time_of_day?.slice(0, 5) || "09:00"}
                      </span>
                    </div>

                    <div className="recurring-expense-actions">
                      <button
                        type="button"
                        onClick={() =>
                          toggleRecurringExpense(
                            recurringExpense
                          )
                        }
                      >
                        {recurringExpense.active
                          ? "Active"
                          : "Paused"}
                      </button>

                      <button
                        type="button"
                        className="expense-delete"
                        onClick={() =>
                          deleteRecurringExpense(
                            recurringExpense.id
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}

      <section className="expenses-list-card premium-card">
        <div className="panel-heading">
          <div>
            <div className="mini-label">
              EXPENSE HISTORY
            </div>

            <h2>Recorded expenses</h2>
          </div>

          <span className="expenses-count">
            {formatNumber(expenses.length)} record
            {expenses.length === 1
              ? ""
              : "s"}
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="expenses-empty">
            <div>↓</div>

            <strong>
              No expenses recorded
            </strong>

            <span>
              Your business expenses
              will appear here after
              your first record.
            </span>

            <button
              onClick={
                startNewExpenseSession
              }
            >
              + Record Expense
            </button>
          </div>
        ) : (
          <div className="expenses-table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th>Link status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {expenses.map(
                  (expense) => (
                    <tr key={expense.id} data-expense-id={expense.id}>
                      <td>{expense.date}</td>

                      <td>
                        <strong>
                          {expense.name}
                        </strong>
                      </td>

                      <td>
                        <span className="expense-category">
                          {expense.category}
                        </span>
                      </td>

                      <td>
                        <span className="expense-note">
                          {expense.note ||
                            "—"}
                        </span>
                      </td>

                      <td>
                        <strong className="expense-amount">
                          -
                          {formatMoney(
                            expense.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        {expense.financeTransactionId ? (
                          <span
                            className="transaction-linked-icon"
                            title="Linked transaction"
                            aria-label="Linked transaction"
                          >
                            🔗
                          </span>
                        ) : (
                          <span
                            className="expense-link-empty"
                            aria-label="Not linked"
                            title="Not linked"
                          >
                            ...
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="expense-actions">
                          <button
                            onClick={() =>
                              handleEdit(
                                expense
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="expense-delete"
                            onClick={() =>
                              handleDelete(
                                expense.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {historicalAccessOpen && !isBusiness && (
        <div
          className="historical-access-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expenses-historical-access-title"
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

            <h2 id="expenses-historical-access-title">
              Unlock your expense history
            </h2>

            <p>
              Free accounts can record and edit expenses from
              today and the previous 7 days. Upgrade to
              UpTrend Business to work with older expenses.
            </p>

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

export default Expenses;