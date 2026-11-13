
import { useEffect, useMemo, useRef, useState } from "react";
import "./Suppliers.css";
import { supabase } from "../lib/supabase";
import { logAudit } from "../utils/auditLog";

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const todayKey = () => new Date().toISOString().slice(0, 10);

const getSupplierForm = () => ({
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active",
});

const createPurchaseItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  productMode: "existing",
  productId: "",
  newProductName: "",
  quantity: "",
  unitCost: "",
});

const getPurchaseForm = () => ({
  supplierId: "",
  items: [createPurchaseItem()],
  cashAmount: "",
  transferAmount: "",
  transferTransactionId: "",
  purchaseDate: todayKey(),
  dueDate: "",
  notes: "",
});

const getPaymentForm = () => ({
  cashAmount: "",
  transferAmount: "",
  transferTransactionId: "",
  paymentDate: todayKey(),
  reference: "",
  notes: "",
});

const getOpeningDebtForm = () => ({
  amount: "",
  transactionDate: todayKey(),
  notes: "",
});

const getAccountPaymentForm = () => ({
  cashAmount: "",
  transferAmount: "",
  transferTransactionId: "",
  paymentDate: todayKey(),
  reference: "",
  notes: "",
});

/*
 * Calculates cash available up to a particular date.
 * Includes both purchase-linked supplier payments and
 * general supplier account payments.
 */
const getCashAvailable = async (userId) => {
  const [
    financeResult,
    salesResult,
    debtPaymentsResult,
    expensesResult,
    supplierPaymentsResult,
    accountPaymentsResult,
    returnsResult,
    financeTransactionsResult,
  ] = await Promise.all([
    supabase
      .from("finance_settings")
      .select("opening_balance")
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("uptrend_sale_payments")
      .select("amount,payment_method,created_at")
      .eq("user_id", userId),

    supabase
      .from("uptrend_credit_debt_payments")
      .select("amount,payment_method,payment_date,created_at")
      .eq("user_id", userId),

    supabase
      .from("expenses")
      .select("amount,payment_method,expense_date")
      .eq("user_id", userId),

    supabase
      .from("uptrend_supplier_payments")
      .select("amount,payment_method,payment_date,created_at")
      .eq("user_id", userId),

    supabase
      .from("uptrend_supplier_account_transactions")
      .select("amount,transaction_type,payment_method,transaction_date")
      .eq("user_id", userId)
      .eq("transaction_type", "payment")
      .eq("payment_method", "cash"),

    supabase
      .from("uptrend_sale_returns")
      .select("refund_amount,refund_method,return_date")
      .eq("user_id", userId),

    supabase
      .from("uptrend_finance_transactions")
      .select("amount,type,status,category,created_at")
      .eq("user_id", userId),
  ]);

  const results = [
    financeResult,
    salesResult,
    debtPaymentsResult,
    expensesResult,
    supplierPaymentsResult,
    accountPaymentsResult,
    returnsResult,
    financeTransactionsResult,
  ];

  const failed = results.find((result) => result.error);

  if (failed) {
    throw failed.error;
  }

  const endDate = new Date();

  const beforeDate = (value) => {
    if (!value) return false;

    const date = new Date(value);

    return (
      !Number.isNaN(date.getTime()) &&
      date <= endDate
    );
  };

  return (
    Number(financeResult.data?.opening_balance || 0) +

    (financeTransactionsResult.data || []).reduce(
      (sum, item) =>
        item.status === "completed" &&
        item.type === "debit" &&
        String(item.category || "").toLowerCase() === "cash_withdrawal" &&
        beforeDate(item.created_at)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) +

    (salesResult.data || []).reduce(
      (sum, item) =>
        item.payment_method === "cash" &&
        beforeDate(item.created_at)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) +

    (debtPaymentsResult.data || []).reduce(
      (sum, item) =>
        String(item.payment_method || "").toLowerCase() === "cash" &&
        beforeDate(item.payment_date || item.created_at)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) -

    (expensesResult.data || []).reduce(
      (sum, item) =>
        item.payment_method === "cash" &&
        beforeDate(item.expense_date)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) -

    (supplierPaymentsResult.data || []).reduce(
      (sum, item) =>
        item.payment_method === "cash" &&
        beforeDate(item.payment_date || item.created_at)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) -

    (accountPaymentsResult.data || []).reduce(
      (sum, item) =>
        beforeDate(item.transaction_date)
          ? sum + Number(item.amount || 0)
          : sum,
      0
    ) -

    (returnsResult.data || []).reduce(
      (sum, item) =>
        item.refund_method === "cash" &&
        beforeDate(item.return_date)
          ? sum + Number(item.refund_amount || 0)
          : sum,
      0
    )
  );
};

function Suppliers({
  subscription,
  onUpgrade,
  supplierToOpenId,
  supplierToOpenPurchaseId,
  onSupplierOpenHandled,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchaseBatches, setPurchaseBatches] = useState([]);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [financeTransactions, setFinanceTransactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [openingDebtSaving, setOpeningDebtSaving] = useState(false);
  const [accountPaymentSaving, setAccountPaymentSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showOpeningDebtForm, setShowOpeningDebtForm] = useState(false);
  const [showAccountPaymentForm, setShowAccountPaymentForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [pendingPurchaseHighlightId, setPendingPurchaseHighlightId] = useState(null);
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState(null);
  const highlightedPurchaseRef = useRef(null);

  const [supplierForm, setSupplierForm] = useState(getSupplierForm());
  const [purchaseForm, setPurchaseForm] = useState(getPurchaseForm());
  const [paymentForm, setPaymentForm] = useState(getPaymentForm());
  const [openingDebtForm, setOpeningDebtForm] = useState(getOpeningDebtForm());
  const [accountPaymentForm, setAccountPaymentForm] = useState(getAccountPaymentForm());


  useEffect(() => {
    const openTour = (context, steps) => {
      window.dispatchEvent(
        new CustomEvent("uptrend:open-context-tour", {
          detail: {
            page: "suppliers",
            context,
            steps,
          },
        })
      );
    };

    if (showSupplierForm) {
      openTour("supplier-form", [
        { target: ".supplier-modal-header", title: editingSupplier ? "Edit Supplier" : "Add Supplier", text: "Use this form to register a new supplier or update an existing supplier's information." },
        { target: ".supplier-form-grid label:nth-child(1)", title: "Supplier Name", text: "Enter the supplier's personal or trading name. This is the required field used to identify the supplier." },
        { target: ".supplier-form-grid label:nth-child(2)", title: "Company Name", text: "Enter the registered or trading company name, if different from the supplier's name." },
        { target: ".supplier-form-grid label:nth-child(3)", title: "Phone Number", text: "Enter a phone number you can use to contact the supplier." },
        { target: ".supplier-form-grid label:nth-child(4)", title: "Email Address", text: "Enter the supplier's email address. It must be a valid email format." },
        { target: ".supplier-form-full:nth-of-type(1)", title: "Supplier Address", text: "Enter the supplier's business or contact address." },
        { target: ".supplier-form-grid label:nth-child(6)", title: "Supplier Status", text: "Choose Active if you currently do business with this supplier. Choose Inactive if the supplier should no longer appear among available suppliers for new purchases." },
        { target: ".supplier-form-grid label:last-child", title: "Additional Notes", text: "Add useful information about the supplier that you may need to refer to later." },
        { target: ".supplier-form-actions", title: "Save or Cancel", text: "Cancel closes the form without saving. Add Supplier creates the supplier record; Save Changes updates the existing record." }
      ]);
    }

    if (showPurchaseForm) {
      openTour("supplier-purchase", [
        { target: ".supplier-modal-header", title: "Record Multiple Purchases", text: "Use this form to record one delivery containing several products from the same supplier. Each item is recorded as a purchase and increases inventory." },
        { target: ".supplier-batch-form > label:first-child", title: "Choose Supplier", text: "Select the active supplier who delivered these goods. All items in this batch will be linked to this supplier." },
        { target: ".supplier-batch-items", title: "Purchase Items", text: "Add every product included in the delivery. You can combine existing products and newly introduced products in one batch." },
        { target: ".supplier-batch-item", title: "Individual Purchase Item", text: "Each item has its own product selection, quantity, unit cost and calculated total. Add another item for every additional product in the delivery." },
        { target: ".supplier-batch-mode-toggle", title: "Existing or New Product", text: "Choose Existing Product to add stock to a product already in your inventory. Choose New Product to introduce a product that does not yet exist." },
        { target: ".supplier-batch-item select", title: "Select Existing Product", text: "Choose the product being delivered. The available stock and current cost are displayed when an existing product is selected." },
        { target: ".selected-product-info", title: "Current Product Information", text: "Review the product's current stock quantity and recorded cost price before entering the new delivery." },
        { target: ".supplier-batch-item input", title: "New Product Details", text: "When New Product is selected, enter the name of the product you are introducing." },
        { target: ".supplier-batch-item-grid", title: "Quantity and Unit Cost", text: "Enter a whole-number quantity and the cost of one unit. Both values must be greater than zero." },
        { target: ".supplier-batch-item-total", title: "Item Total", text: "UpTrend calculates this item's purchase value by multiplying quantity by cost per unit." },
        { target: ".supplier-batch-add-btn", title: "Add Another Item", text: "Add another product to the same delivery. You can also remove an item if it was added by mistake." },
        { target: ".supplier-batch-summary", title: "Batch Summary", text: "Review the total number of items, total units, combined purchase cost and remaining balance for the entire delivery." },
        { target: ".supplier-batch-payment", title: "Initial Payment", text: "Enter the amount already paid for the batch. You can pay by cash, bank transfer or a combination of both. Leave both amounts at zero if the purchase is unpaid." },
        { target: ".supplier-batch-payment-grid", title: "Cash and Transfer Amounts", text: "Enter the cash portion and transfer portion separately. Their combined amount cannot exceed the total purchase cost." },
        { target: ".supplier-batch-transfer-select", title: "Match Bank Debit", text: "If you enter a transfer amount, select the existing bank debit for exactly that amount. UpTrend links the debit rather than creating another bank transaction." },
        { target: ".supplier-payment-preview", title: "Payment Preview", text: "Check the cash amount, transfer amount, total paid and remaining balance before saving the batch." },
        { target: ".supplier-batch-form > label:nth-last-child(3)", title: "Purchase Date", text: "Select the date the goods were purchased or received. This date is used in purchase records." },
        { target: ".supplier-batch-form > label:nth-last-child(2)", title: "Due Date", text: "Enter the date payment is due, if applicable. UpTrend uses this date to identify overdue purchase balances." },
        { target: ".supplier-batch-form > label:last-child", title: "Purchase Notes", text: "Add optional delivery details or other notes that should be stored with this batch." },
        { target: ".supplier-batch-footer", title: "Record All Purchases", text: "Cancel closes the form. Record All Purchases saves the batch. Check the supplier, products, quantities, costs and payment details before submitting." }
      ]);
    }

    if (showPaymentForm && selectedPurchase) {
      openTour("purchase-payment", [
        { target: ".supplier-modal-header", title: "Record Purchase Payment", text: "Use this form to pay some or all of the outstanding balance on the selected supplier purchase." },
        { target: ".supplier-payment-summary", title: "Purchase Summary", text: "Confirm the purchase, supplier and outstanding amount before recording payment." },
        { target: ".supplier-form-grid label:nth-child(1)", title: "Cash Amount", text: "Enter the amount paid in cash. The amount cannot exceed the remaining purchase balance." },
        { target: ".supplier-form-grid label:nth-child(2)", title: "Transfer Amount", text: "Enter the amount paid by bank transfer. If you enter a transfer, you must link its matching recorded bank debit." },
        { target: ".supplier-form-grid label.supplier-form-full", title: "Matching Bank Debit", text: "Select the existing bank debit matching the transfer amount. Linking it prevents the same bank transaction from being recorded twice." },
        { target: ".supplier-payment-preview", title: "Payment Preview", text: "Review the cash, transfer, total payment and remaining balance after this payment." },
        { target: ".supplier-form-grid label:nth-last-child(3)", title: "Payment Date", text: "Select the date the supplier payment was made." },
        { target: ".supplier-form-grid label:nth-last-child(2)", title: "Payment Reference", text: "Enter an optional transaction reference to make this payment easier to identify later." },
        { target: ".supplier-form-grid label:last-child", title: "Payment Notes", text: "Add optional information about this payment." },
        { target: ".supplier-form-actions", title: "Save Payment", text: "Cancel closes the form. Record Payment saves the payment and updates the purchase's outstanding balance and payment status." }
      ]);
    }

    if (showOpeningDebtForm) {
      openTour("supplier-opening-debt", [
        { target: ".supplier-modal-header", title: "Record Existing Debt", text: "Use this form to enter an amount your business already owed this supplier before recording it in UpTrend. This does not create a purchase or add inventory." },
        { target: ".supplier-payment-summary", title: "Supplier and Current Balance", text: "Confirm the supplier and review the existing outstanding balance before adding the opening debt." },
        { target: ".supplier-form-grid label:nth-child(2)", title: "Existing Amount Owed", text: "Enter the amount already owed to this supplier. The amount must be greater than zero." },
        { target: ".supplier-form-grid label:nth-child(3)", title: "Debt Date", text: "Select the date this existing debt relates to." },
        { target: ".supplier-form-grid label:last-child", title: "Debt Notes", text: "Add optional details explaining the debt or its origin." },
        { target: ".supplier-form-actions", title: "Record Existing Debt", text: "Cancel closes the form. Record Existing Debt saves the opening debt to the supplier account ledger without changing inventory." }
      ]);
    }

    if (showAccountPaymentForm) {
      openTour("supplier-account-payment", [
        { target: ".supplier-modal-header", title: "Pay Supplier Account", text: "This form records a general payment against the supplier's combined outstanding balance. Use purchase-specific payment history when paying an individual purchase." },
        { target: ".supplier-payment-summary", title: "Supplier Balance", text: "Review the supplier, current outstanding balance and estimated balance after the payment." },
        { target: ".supplier-form-grid label:nth-child(1)", title: "Cash Amount", text: "Enter the cash portion of the payment. UpTrend checks that sufficient cash is available and that the payment does not exceed the outstanding balance." },
        { target: ".supplier-form-grid label:nth-child(2)", title: "Transfer Amount", text: "Enter the bank transfer portion. A matching existing bank debit must be selected." },
        { target: ".supplier-form-grid label.supplier-form-full", title: "Match Bank Debit", text: "Select the existing bank debit for the exact transfer amount. UpTrend links the debit instead of recording it a second time." },
        { target: ".supplier-payment-preview", title: "Payment Preview", text: "Review cash, transfer, total payment and remaining supplier balance." },
        { target: ".supplier-form-grid label:nth-last-child(3)", title: "Payment Date", text: "Select the date the payment was made." },
        { target: ".supplier-form-grid label:nth-last-child(2)", title: "Payment Reference", text: "Enter an optional payment or bank transaction reference." },
        { target: ".supplier-form-grid label:last-child", title: "Payment Notes", text: "Add optional details about the payment." },
        { target: ".supplier-form-actions", title: "Record Account Payment", text: "Cancel closes the form. Record Account Payment saves the payment and reduces the supplier's outstanding account balance." }
      ]);
    }
  }, [
    showSupplierForm,
    showPurchaseForm,
    showPaymentForm,
    showOpeningDebtForm,
    showAccountPaymentForm,
    editingSupplier,
    selectedPurchaseId
  ]);

  const loadData = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const [
        { data: supplierData, error: supplierError },
        { data: productData, error: productError },
        { data: purchaseData, error: purchaseError },
        { data: paymentData, error: paymentError },
        { data: purchaseBatchData, error: purchaseBatchError },
        { data: accountTransactionData, error: accountTransactionError },
        { data: financeTransactionData, error: financeTransactionError },
      ] = await Promise.all([
        supabase
          .from("uptrend_suppliers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select("id, name, cost_price, stock, low_stock_at")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),

        supabase
          .from("uptrend_supplier_purchases")
          .select("*")
          .eq("user_id", user.id)
          .order("purchase_date", { ascending: false }),

        supabase
          .from("uptrend_supplier_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("payment_date", { ascending: false }),

        supabase
          .from("uptrend_supplier_purchase_batches")
          .select("*")
          .eq("user_id", user.id)
          .order("purchase_date", { ascending: false }),

        supabase
          .from("uptrend_supplier_account_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false }),

        supabase
          .from("uptrend_finance_transactions")
          .select("id, amount, type, status, description, reference, created_at")
          .eq("user_id", user.id)
          .eq("type", "debit")
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
      ]);

      if (supplierError) throw supplierError;
      if (productError) throw productError;
      if (purchaseError) throw purchaseError;
      if (paymentError) throw paymentError;
      if (purchaseBatchError) throw purchaseBatchError;
      if (accountTransactionError) throw accountTransactionError;
      if (financeTransactionError) throw financeTransactionError;

      setSuppliers(supplierData || []);
      setProducts(productData || []);
      setPurchases(purchaseData || []);
      setPayments(paymentData || []);
      setPurchaseBatches(purchaseBatchData || []);
      setAccountTransactions(accountTransactionData || []);
      setFinanceTransactions(financeTransactionData || []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      alert(error.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!supplierToOpenId || loading) return;

    const supplier = suppliers.find(
      (item) => item.id === supplierToOpenId
    );

    if (supplier) {
      openDetails(supplier);

      if (supplierToOpenPurchaseId) {
        const purchase = enrichedPurchases.find(
          (item) =>
            item.id === supplierToOpenPurchaseId &&
            item.supplier_id === supplier.id
        );

        if (purchase) {
          setPendingPurchaseHighlightId(purchase.id);
          openPaymentHistory(purchase);
        }
      }
    }

    if (onSupplierOpenHandled) {
      onSupplierOpenHandled();
    }
  }, [
    supplierToOpenId,
    supplierToOpenPurchaseId,
    loading,
    suppliers,
    onSupplierOpenHandled,
  ]);

  useEffect(() => {
    if (
      !pendingPurchaseHighlightId ||
      selectedPurchaseId !== pendingPurchaseHighlightId ||
      !highlightedPurchaseRef.current
    ) {
      return;
    }

    const purchaseId = pendingPurchaseHighlightId;

    highlightedPurchaseRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedPurchaseId(purchaseId);
    setPendingPurchaseHighlightId(null);

    const timeoutId = window.setTimeout(() => {
      setHighlightedPurchaseId((current) =>
        current === purchaseId ? null : current
      );
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [pendingPurchaseHighlightId, selectedPurchaseId]);

  const supplierMap = useMemo(() => {
    return suppliers.reduce((map, supplier) => {
      map[supplier.id] = supplier;
      return map;
    }, {});
  }, [suppliers]);

  const paymentTotals = useMemo(() => {
    return payments.reduce((totals, payment) => {
      if (!totals[payment.purchase_id]) {
        totals[payment.purchase_id] = 0;
      }

      totals[payment.purchase_id] += Number(payment.amount || 0);

      return totals;
    }, {});
  }, [payments]);

  const enrichedPurchases = useMemo(() => {
    const today = todayKey();

    return purchases.map((purchase) => {
      const totalAmount = Number(purchase.total_amount || 0);

      const paid = Math.min(
        totalAmount,
        Number(paymentTotals[purchase.id] || 0)
      );

      const balance = Math.max(totalAmount - paid, 0);

      let calculatedStatus = purchase.status;

      if (purchase.status !== "cancelled") {
        if (balance <= 0 && totalAmount > 0) {
          calculatedStatus = "paid";
        } else if (purchase.due_date && purchase.due_date < today) {
          calculatedStatus = paid > 0 ? "partially_paid" : "overdue";
        } else if (paid > 0) {
          calculatedStatus = "partially_paid";
        } else {
          calculatedStatus = "pending";
        }
      }

      return {
        ...purchase,
        supplier: supplierMap[purchase.supplier_id] || null,
        totalAmount,
        paid,
        balance,
        calculatedStatus,
      };
    });
  }, [purchases, paymentTotals, supplierMap]);

  const enrichedSuppliers = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierPurchases = enrichedPurchases.filter(
        (purchase) => purchase.supplier_id === supplier.id
      );

      const supplierAccountTransactions = accountTransactions.filter(
        (transaction) => transaction.supplier_id === supplier.id
      );

      const totalPurchases = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.totalAmount,
        0
      );

      const purchasePaid = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.paid,
        0
      );

      const purchaseOutstanding = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.balance,
        0
      );

      const openingDebt = supplierAccountTransactions.reduce(
        (sum, transaction) =>
          transaction.transaction_type === "opening_debt"
            ? sum + Number(transaction.amount || 0)
            : sum,
        0
      );

      const accountPaid = supplierAccountTransactions.reduce(
        (sum, transaction) =>
          transaction.transaction_type === "payment"
            ? sum + Number(transaction.amount || 0)
            : sum,
        0
      );

      const accountOutstanding = openingDebt - accountPaid;

      const totalPaid = purchasePaid + accountPaid;

      const outstanding = purchaseOutstanding + accountOutstanding;

      const overdue = supplierPurchases.reduce(
        (sum, purchase) =>
          sum +
          (purchase.calculatedStatus === "overdue"
            ? purchase.balance
            : 0),
        0
      );

      return {
        ...supplier,
        purchaseCount: supplierPurchases.length,
        totalPurchases,
        purchasePaid,
        purchaseOutstanding,
        openingDebt,
        accountPaid,
        accountOutstanding,
        totalPaid,
        outstanding,
        overdue,
      };
    });
  }, [suppliers, enrichedPurchases, accountTransactions]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedSuppliers.filter((supplier) => {
      const matchesSearch =
        !query ||
        supplier.name?.toLowerCase().includes(query) ||
        supplier.company_name?.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        supplier.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enrichedSuppliers, search, statusFilter]);

  const overview = useMemo(() => {
    const activeSuppliers = suppliers.filter(
      (supplier) => supplier.status === "active"
    ).length;

    const totalPurchases = enrichedSuppliers.reduce(
      (sum, supplier) => sum + supplier.totalPurchases,
      0
    );

    const totalPaid = enrichedSuppliers.reduce(
      (sum, supplier) => sum + supplier.totalPaid,
      0
    );

    const outstanding = enrichedSuppliers.reduce(
      (sum, supplier) => sum + supplier.outstanding,
      0
    );

    const overdue = enrichedSuppliers.reduce(
      (sum, supplier) => sum + supplier.overdue,
      0
    );

    return {
      activeSuppliers,
      totalPurchases,
      totalPaid,
      outstanding,
      overdue,
    };
  }, [suppliers, enrichedSuppliers]);

  const selectedSupplier = useMemo(
    () =>
      enrichedSuppliers.find(
        (supplier) => supplier.id === selectedSupplierId
      ) || null,
    [enrichedSuppliers, selectedSupplierId]
  );

  const purchaseItems = purchaseForm.items || [];

  const purchaseItemTotals = purchaseItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unitCost || 0);

    return quantity > 0 && unitCost > 0
      ? Math.round(quantity * unitCost * 100) / 100
      : 0;
  });

  const calculatedPurchaseTotal = Math.round(
    purchaseItemTotals.reduce((sum, amount) => sum + amount, 0) * 100
  ) / 100;

  const purchaseQuantity = purchaseItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const purchaseCashAmount = Number(purchaseForm.cashAmount || 0);
  const purchaseTransferAmount = Number(purchaseForm.transferAmount || 0);
  const purchaseInitialPayment = purchaseCashAmount + purchaseTransferAmount;

  const calculatedPurchaseBalance = Math.max(
    calculatedPurchaseTotal - purchaseInitialPayment,
    0
  );

  const availablePurchaseTransferTransactions =
    financeTransactions.filter((transaction) => {
      const linkedToPurchase = payments.some(
        (payment) =>
          payment.finance_transaction_id === transaction.id
      );

      const linkedToAccount = accountTransactions.some(
        (item) =>
          item.finance_transaction_id === transaction.id
      );

      const linkedToBatch = purchaseBatches.some(
        (batch) =>
          batch.finance_transaction_id === transaction.id
      );

      return !linkedToPurchase && !linkedToAccount && !linkedToBatch;
    });

  const selectedPurchase = useMemo(
    () =>
      enrichedPurchases.find(
        (purchase) => purchase.id === selectedPurchaseId
      ) || null,
    [enrichedPurchases, selectedPurchaseId]
  );

  const selectedSupplierPurchases = useMemo(() => {
    if (!selectedSupplier) return [];

    return enrichedPurchases.filter(
      (purchase) => purchase.supplier_id === selectedSupplier.id
    );
  }, [enrichedPurchases, selectedSupplier]);

  const selectedSupplierAccountTransactions = useMemo(() => {
    if (!selectedSupplier) return [];

    return accountTransactions
      .filter(
        (transaction) =>
          transaction.supplier_id === selectedSupplier.id
      )
      .sort((a, b) =>
        String(b.transaction_date).localeCompare(
          String(a.transaction_date)
        )
      );
  }, [accountTransactions, selectedSupplier]);

  const selectedPurchasePayments = useMemo(() => {
    if (!selectedPurchase) return [];

    return payments
      .filter(
        (payment) => payment.purchase_id === selectedPurchase.id
      )
      .sort((a, b) =>
        String(b.payment_date).localeCompare(
          String(a.payment_date)
        )
      );
  }, [payments, selectedPurchase]);

  const openSupplierForm = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);

      setSupplierForm({
        name: supplier.name || "",
        companyName: supplier.company_name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        notes: supplier.notes || "",
        status: supplier.status || "active",
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm(getSupplierForm());
    }

    setShowSupplierForm(true);
  };

  const closeSupplierForm = () => {
    setShowSupplierForm(false);
    setEditingSupplier(null);
    setSupplierForm(getSupplierForm());
  };

  const saveSupplier = async (event) => {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      alert("Enter the supplier name.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const payload = {
        name: supplierForm.name.trim(),
        company_name: supplierForm.companyName.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        address: supplierForm.address.trim() || null,
        notes: supplierForm.notes.trim() || null,
        status: supplierForm.status,
      };

      let error;

      if (editingSupplier) {
        ({ error } = await supabase
          .from("uptrend_suppliers")
          .update(payload)
          .eq("id", editingSupplier.id)
          .eq("user_id", user.id));
      } else {
        ({ error } = await supabase
          .from("uptrend_suppliers")
          .insert({
            ...payload,
            user_id: user.id,
          }));
      }

      if (error) throw error;

      await logAudit({
        action: editingSupplier ? "supplier_updated" : "supplier_created",
        category: "suppliers",
        description: `${editingSupplier ? "Updated" : "Added"} supplier: ${payload.name}`,
        entityType: "supplier",
        entityId: editingSupplier?.id || null,
        details: {
          supplierName: payload.name,
          companyName: payload.company_name,
          status: payload.status,
        },
      });

      closeSupplierForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save supplier:", error);
      alert(error.message || "Unable to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (supplier) => {
    const purchaseCount = enrichedPurchases.filter(
      (purchase) => purchase.supplier_id === supplier.id
    ).length;

    const accountCount = accountTransactions.filter(
      (transaction) => transaction.supplier_id === supplier.id
    ).length;

    const message =
      purchaseCount > 0 || accountCount > 0
        ? `Delete "${supplier.name}"? This supplier has ${purchaseCount} purchase record(s) and ${accountCount} account ledger record(s), which will also be deleted.`
        : `Delete "${supplier.name}"?`;

    if (!window.confirm(message)) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error } = await supabase
        .from("uptrend_suppliers")
        .delete()
        .eq("id", supplier.id)
        .eq("user_id", user.id);

      if (error) throw error;

      await logAudit({
        action: "supplier_deleted",
        category: "suppliers",
        description: `Deleted supplier: ${supplier.name}`,
        entityType: "supplier",
        entityId: supplier.id,
        details: {
          supplierName: supplier.name,
          associatedPurchaseCount: purchaseCount,
          accountLedgerRecordCount: accountCount,
        },
      });

      if (selectedSupplierId === supplier.id) {
        setSelectedSupplierId(null);
        setShowDetails(false);
      }

      await loadData();
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      alert(error.message || "Unable to delete supplier.");
    }
  };

  const openDetails = (supplier) => {
    setSelectedSupplierId(supplier.id);
    setSelectedPurchaseId(null);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedSupplierId(null);
    setSelectedPurchaseId(null);
  };

  const openPurchaseForm = (supplier = null) => {
    setPurchaseForm({
      ...getPurchaseForm(),
      supplierId: supplier?.id || selectedSupplier?.id || "",
    });

    setShowPurchaseForm(true);
  };

  const closePurchaseForm = () => {
    setShowPurchaseForm(false);
    setPurchaseForm(getPurchaseForm());
  };

  const openPaymentForm = (purchase) => {
    if (!purchase) return;

    if (Number(purchase.balance || 0) <= 0) {
      alert("This purchase has no outstanding balance.");
      return;
    }

    setShowDetails(true);
    setSelectedPurchaseId(purchase.id);
    setPaymentForm(getPaymentForm());
    setShowPaymentForm(true);
  };

  const openPaymentHistory = (purchase) => {
    if (!purchase) return;

    setShowDetails(true);
    setShowPaymentForm(false);
    setSelectedPurchaseId(purchase.id);
  };

  const closePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedPurchaseId(null);
    setPaymentForm(getPaymentForm());
  };

  const openOpeningDebtForm = () => {
    if (!selectedSupplier) return;

    setOpeningDebtForm(getOpeningDebtForm());
    setShowOpeningDebtForm(true);
  };

  const closeOpeningDebtForm = () => {
    setShowOpeningDebtForm(false);
    setOpeningDebtForm(getOpeningDebtForm());
  };

  const openAccountPaymentForm = () => {
    if (!selectedSupplier) return;

    if (Number(selectedSupplier.outstanding || 0) <= 0) {
      alert("This supplier has no outstanding balance.");
      return;
    }

    setAccountPaymentForm(getAccountPaymentForm());
    setShowAccountPaymentForm(true);
  };

  const closeAccountPaymentForm = () => {
    setShowAccountPaymentForm(false);
    setAccountPaymentForm(getAccountPaymentForm());
  };

  const saveOpeningDebt = async (event) => {
    event.preventDefault();

    if (!selectedSupplier) {
      alert("Select a supplier first.");
      return;
    }

    const amount = Number(openingDebtForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid opening debt amount.");
      return;
    }

    if (!openingDebtForm.transactionDate) {
      alert("Select the opening debt date.");
      return;
    }

    setOpeningDebtSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "record_supplier_opening_debt",
        {
          p_supplier_id: selectedSupplier.id,
          p_amount: amount,
          p_transaction_date: openingDebtForm.transactionDate,
          p_notes: openingDebtForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      await logAudit({
        action: "supplier_opening_debt_recorded",
        category: "suppliers",
        description: `Recorded opening debt of ${money(amount)} for ${selectedSupplier.name}`,
        entityType: "supplier",
        entityId: selectedSupplier.id,
        amount,
        currency: "NGN",
        details: {
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          transactionDate: openingDebtForm.transactionDate,
          notes: openingDebtForm.notes.trim() || null,
          accountTransactionId: data?.id || null,
        },
      });

      closeOpeningDebtForm();
      await loadData();
    } catch (error) {
      console.error("Failed to record supplier opening debt:", error);
      alert(error.message || "Unable to record opening debt.");
    } finally {
      setOpeningDebtSaving(false);
    }
  };

  const saveAccountPayment = async (event) => {
    event.preventDefault();

    if (!selectedSupplier) {
      alert("Select a supplier first.");
      return;
    }

    const cashAmount = Number(accountPaymentForm.cashAmount || 0);
    const transferAmount = Number(accountPaymentForm.transferAmount || 0);
    const totalPayment = cashAmount + transferAmount;

    if (cashAmount < 0 || transferAmount < 0) {
      alert("Payment amounts cannot be negative.");
      return;
    }

    if (totalPayment <= 0) {
      alert("Enter a cash amount, transfer amount, or both.");
      return;
    }

    if (totalPayment > Number(selectedSupplier.outstanding || 0)) {
      alert(
        `Payment cannot exceed the supplier's outstanding balance of ${money(
          selectedSupplier.outstanding
        )}.`
      );
      return;
    }

    if (!accountPaymentForm.paymentDate) {
      alert("Select the payment date.");
      return;
    }

    if (transferAmount > 0) {
      const selectedTransfer = availablePurchaseTransferTransactions.find(
        (transaction) =>
          transaction.id === accountPaymentForm.transferTransactionId &&
          Number(transaction.amount) === transferAmount
      );

      if (!selectedTransfer) {
        alert(
          "Select an unlinked bank debit matching the transfer amount."
        );
        return;
      }
    } else if (accountPaymentForm.transferTransactionId) {
      alert("Remove the bank transaction or enter a transfer amount.");
      return;
    }

    setAccountPaymentSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      if (cashAmount > 0) {
        const cashAvailable = await getCashAvailable(user.id);

        if (cashAmount > cashAvailable) {
          throw new Error(
            "Insufficient Cash Balance\n\n" +
              `Available cash: ${money(cashAvailable)}\n` +
              `Cash payment requested: ${money(cashAmount)}\n\n` +
              "You cannot make this payment because your available cash is insufficient."
          );
        }
      }

      const { data, error } = await supabase.rpc(
        "record_supplier_account_payment",
        {
          p_supplier_id: selectedSupplier.id,
          p_cash_amount: cashAmount,
          p_transfer_amount: transferAmount,
          p_transfer_transaction_id:
            transferAmount > 0
              ? accountPaymentForm.transferTransactionId
              : null,
          p_payment_date: accountPaymentForm.paymentDate,
          p_reference: accountPaymentForm.reference.trim() || null,
          p_notes: accountPaymentForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      await logAudit({
        action: "supplier_account_payment_recorded",
        category: "payments",
        description: `Recorded general supplier account payment of ${money(totalPayment)} to ${selectedSupplier.name}`,
        entityType: "supplier",
        entityId: selectedSupplier.id,
        amount: totalPayment,
        currency: "NGN",
        details: {
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          cashAmount,
          transferAmount,
          paymentDate: accountPaymentForm.paymentDate,
          financeTransactionId:
            accountPaymentForm.transferTransactionId || null,
          reference: accountPaymentForm.reference.trim() || null,
          notes: accountPaymentForm.notes.trim() || null,
          previousBalance: data?.previous_balance ?? null,
          remainingBalance: data?.remaining_balance ?? null,
        },
      });

      closeAccountPaymentForm();
      await loadData();
    } catch (error) {
      console.error("Failed to record supplier account payment:", error);
      alert(error.message || "Unable to record supplier account payment.");
    } finally {
      setAccountPaymentSaving(false);
    }
  };

  const savePurchase = async (event) => {
    event.preventDefault();

    const items = purchaseForm.items || [];
    const cashAmount = Number(purchaseForm.cashAmount || 0);
    const transferAmount = Number(purchaseForm.transferAmount || 0);
    const initialPayment = cashAmount + transferAmount;

    if (!purchaseForm.supplierId) {
      alert("Select a supplier.");
      return;
    }

    if (items.length === 0) {
      alert("Add at least one purchase item.");
      return;
    }

    let total = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      if (item.productMode === "existing" && !item.productId) {
        alert(`Select an existing product for Item ${index + 1}.`);
        return;
      }

      if (
        item.productMode === "new" &&
        !String(item.newProductName || "").trim()
      ) {
        alert(`Enter the new product name for Item ${index + 1}.`);
        return;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        alert(`Enter a valid whole-number quantity for Item ${index + 1}.`);
        return;
      }

      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        alert(`Enter a valid unit cost for Item ${index + 1}.`);
        return;
      }

      total += Math.round(quantity * unitCost * 100) / 100;
    }

    total = Math.round(total * 100) / 100;

    if (cashAmount < 0 || transferAmount < 0) {
      alert("Payment amounts cannot be negative.");
      return;
    }

    if (initialPayment > total) {
      alert(
        `Initial payment cannot exceed the batch purchase total of ${money(total)}.`
      );
      return;
    }

    if (transferAmount > 0 && !purchaseForm.transferTransactionId) {
      alert("Select the bank debit used for the transfer payment.");
      return;
    }

    if (purchaseForm.transferTransactionId && transferAmount <= 0) {
      alert("Enter the transfer amount for the selected bank debit.");
      return;
    }

    if (purchaseForm.transferTransactionId) {
      const selectedTransaction = financeTransactions.find(
        (transaction) =>
          transaction.id === purchaseForm.transferTransactionId
      );

      if (!selectedTransaction) {
        alert("The selected bank transaction could not be found.");
        return;
      }

      if (Number(selectedTransaction.amount) !== transferAmount) {
        alert(
          `Transfer amount must match the bank debit amount of ${money(selectedTransaction.amount)}.`
        );
        return;
      }

      if (
        !availablePurchaseTransferTransactions.some(
          (transaction) =>
            transaction.id === purchaseForm.transferTransactionId
        )
      ) {
        alert("This bank debit has already been linked to another payment.");
        return;
      }
    }

    if (!purchaseForm.purchaseDate) {
      alert("Select the purchase date.");
      return;
    }

    setPurchaseSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("Your session has expired.");
      }

      if (cashAmount > 0) {
        const cashAvailable = await getCashAvailable(user.id);

        if (cashAmount > cashAvailable) {
          throw new Error(
            "Insufficient Cash Balance\n\n" +
              `Available cash: ${money(cashAvailable)}\n` +
              `Cash payment requested: ${money(cashAmount)}`
          );
        }
      }

      const batchItems = items.map((item) => ({
        product_id:
          item.productMode === "existing" ? item.productId : null,
        new_product_name:
          item.productMode === "new"
            ? item.newProductName.trim()
            : null,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unitCost),
      }));

      const { data, error } = await supabase.rpc(
        "record_supplier_purchase_batch",
        {
          p_supplier_id: purchaseForm.supplierId,
          p_items: batchItems,
          p_cash_amount: cashAmount,
          p_transfer_amount: transferAmount,
          p_transfer_transaction_id:
            purchaseForm.transferTransactionId || null,
          p_purchase_date: purchaseForm.purchaseDate,
          p_due_date: purchaseForm.dueDate || null,
          p_notes: purchaseForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      const batchResult = Array.isArray(data) ? data[0] : data;
      const createdPurchases = batchResult?.purchases || [];

      if (!batchResult?.success || createdPurchases.length !== items.length) {
        throw new Error(
          "The batch response was incomplete. Please refresh and verify the purchase records before retrying."
        );
      }

      const supplierForPurchase = suppliers.find(
        (supplier) => supplier.id === purchaseForm.supplierId
      );

      for (let index = 0; index < createdPurchases.length; index += 1) {
        const createdPurchase = createdPurchases[index];
        const item = items[index];

        const productForPurchase = products.find(
          (product) => product.id === item.productId
        );

        const productName =
          item.productMode === "new"
            ? item.newProductName.trim()
            : productForPurchase?.name ||
              createdPurchase.product_name ||
              "product";

        await logAudit({
          action: "supplier_purchase_recorded",
          category: "purchases",
          description: `Recorded purchase of ${productName} from ${supplierForPurchase?.name || "supplier"}`,
          entityType: "supplier_purchase",
          entityId: createdPurchase.id,
          amount: Number(createdPurchase.total_amount || 0),
          currency: "NGN",
          details: {
            batchId: batchResult.batch_id,
            supplierId: purchaseForm.supplierId,
            supplierName: supplierForPurchase?.name || null,
            productId: createdPurchase.product_id || item.productId || null,
            productName,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            purchaseDate: purchaseForm.purchaseDate,
            dueDate: purchaseForm.dueDate || null,
            initialPayment,
          },
        });
      }

      if (initialPayment > 0) {
        await logAudit({
          action: "supplier_payment_recorded",
          category: "payments",
          description: `Recorded batch payment of ${money(initialPayment)} for ${createdPurchases.length} supplier purchase item(s)`,
          entityType: "supplier_purchase_batch",
          entityId: batchResult.batch_id,
          amount: initialPayment,
          currency: "NGN",
          details: {
            batchId: batchResult.batch_id,
            supplierId: purchaseForm.supplierId,
            cashAmount,
            transferAmount,
            paymentDate: purchaseForm.purchaseDate,
            financeTransactionId:
              purchaseForm.transferTransactionId || null,
            itemCount: createdPurchases.length,
            paymentType: "batch_initial",
          },
        });
      }

      closePurchaseForm();
      await loadData();
      alert(`${createdPurchases.length} purchase item(s) recorded successfully.`);
    } catch (error) {
      console.error("Failed to save purchase batch:", error);
      alert(error.message || "Unable to record supplier purchase batch.");
    } finally {
      setPurchaseSaving(false);
    }
  };

  const savePayment = async (event) => {
    event.preventDefault();

    if (!selectedPurchase) {
      alert("No purchase is selected.");
      return;
    }

    const cashAmount = Number(paymentForm.cashAmount || 0);
    const transferAmount = Number(paymentForm.transferAmount || 0);
    const totalPayment = cashAmount + transferAmount;
    const balance = Number(selectedPurchase.balance || 0);

    if (cashAmount < 0 || transferAmount < 0) {
      alert("Payment amounts cannot be negative.");
      return;
    }

    if (totalPayment <= 0) {
      alert("Enter a cash amount, transfer amount, or both.");
      return;
    }

    if (totalPayment > balance) {
      alert(
        `Payment cannot exceed the remaining balance of ${money(balance)}.`
      );
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Select the payment date.");
      return;
    }

    if (transferAmount > 0) {
      const selectedTransfer = availablePurchaseTransferTransactions.find(
        (transaction) =>
          transaction.id === paymentForm.transferTransactionId &&
          Number(transaction.amount) === transferAmount
      );

      if (!selectedTransfer) {
        alert(
          "Select an unlinked bank debit matching the transfer amount."
        );
        return;
      }
    }

    setPaymentSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      if (cashAmount > 0) {
        const cashAvailable = await getCashAvailable(user.id);

        if (cashAmount > cashAvailable) {
          throw new Error(
            "Insufficient Cash Balance\n\n" +
              `Available cash: ${money(cashAvailable)}\n` +
              `Cash payment requested: ${money(cashAmount)}`
          );
        }
      }

      const { error } = await supabase.rpc(
        "record_supplier_payment",
        {
          p_purchase_id: selectedPurchase.id,
          p_cash_amount: cashAmount,
          p_transfer_amount: transferAmount,
          p_transfer_transaction_id:
            transferAmount > 0
              ? paymentForm.transferTransactionId
              : null,
          p_payment_date: paymentForm.paymentDate,
          p_reference: paymentForm.reference.trim() || null,
          p_notes: paymentForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      await logAudit({
        action: "supplier_payment_recorded",
        category: "payments",
        description: `Recorded supplier payment of ${money(totalPayment)}`,
        entityType: "supplier_purchase",
        entityId: selectedPurchase.id,
        amount: totalPayment,
        currency: "NGN",
        details: {
          supplierId: selectedPurchase.supplier_id,
          supplierName: selectedPurchase.supplier?.name || null,
          purchaseId: selectedPurchase.id,
          purchaseDescription:
            selectedPurchase.product_name ||
            selectedPurchase.description ||
            "Purchase",
          cashAmount,
          transferAmount,
          paymentDate: paymentForm.paymentDate,
          financeTransactionId:
            paymentForm.transferTransactionId || null,
          reference: paymentForm.reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
          paymentType: "regular",
        },
      });

      closePaymentForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save supplier payment:", error);
      alert(error.message || "Unable to save supplier payment.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const deletePurchase = async (purchase) => {
    if (
      !window.confirm(
        `Delete "${
          purchase.product_name ||
          purchase.description ||
          "this purchase"
        }"? Its payment history will also be deleted.`
      )
    ) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error } = await supabase
        .from("uptrend_supplier_purchases")
        .delete()
        .eq("id", purchase.id)
        .eq("user_id", user.id);

      if (error) throw error;

      await logAudit({
        action: "supplier_purchase_deleted",
        category: "purchases",
        description: `Deleted supplier purchase: ${
          purchase.product_name ||
          purchase.description ||
          "Purchase"
        }`,
        entityType: "supplier_purchase",
        entityId: purchase.id,
        amount: purchase.totalAmount,
        currency: "NGN",
        details: {
          supplierId: purchase.supplier_id,
          supplierName: purchase.supplier?.name || null,
          productName:
            purchase.product_name ||
            purchase.description ||
            null,
          quantity: purchase.quantity,
          paymentHistoryDeleted: true,
        },
      });

      if (selectedPurchaseId === purchase.id) {
        setSelectedPurchaseId(null);
      }

      await loadData();
    } catch (error) {
      console.error("Failed to delete purchase:", error);
      alert(error.message || "Unable to delete purchase.");
    }
  };

  const statusLabel = (status) => {
    const labels = {
      pending: "Pending",
      partially_paid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    return labels[status] || status;
  };

  return (
    <div className="inner-page suppliers-page">

      <div className="suppliers-header">
        <div>
          <span className="suppliers-eyebrow">
            PURCHASING & GOODS IN
          </span>

          <h1>Suppliers</h1>

          <p>
            Manage suppliers, record incoming stock and
            track what you owe.
          </p>
        </div>

        <div className="suppliers-header-actions">
          <button
            className="supplier-secondary-btn"
            onClick={() => openPurchaseForm()}
          >
            + Purchase
          </button>

          <button
            className="supplier-primary-btn"
            onClick={() => openSupplierForm()}
          >
            + Add Supplier
          </button>
        </div>
      </div>

      <section className="supplier-overview">

        <div className="supplier-stat-card">
          <span>Active Suppliers</span>
          <strong>{overview.activeSuppliers}</strong>
          <small>Current supplier relationships</small>
        </div>

        <div className="supplier-stat-card">
          <span>Total Purchases</span>
          <strong>{money(overview.totalPurchases)}</strong>
          <small>Total goods purchased</small>
        </div>

        <div className="supplier-stat-card">
          <span>Total Paid</span>
          <strong>{money(overview.totalPaid)}</strong>
          <small>Payments made to suppliers</small>
        </div>

        <div className="supplier-stat-card supplier-stat-warning">
          <span>Outstanding</span>
          <strong>{money(overview.outstanding)}</strong>
          <small>Amount still owed</small>
        </div>

        <div className="supplier-stat-card supplier-stat-danger">
          <span>Overdue</span>
          <strong>{money(overview.overdue)}</strong>
          <small>Overdue purchase balances</small>
        </div>

      </section>

      <section className="suppliers-toolbar">

        <div className="supplier-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="supplier-filters">
          {["all", "active", "inactive"].map((status) => (
            <button
              key={status}
              className={statusFilter === status ? "active" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all"
                ? "All"
                : status === "active"
                ? "Active"
                : "Inactive"}
            </button>
          ))}
        </div>

      </section>

      <section className="suppliers-section">

        <div className="section-heading">
          <div>
            <span className="section-kicker">SUPPLIER DIRECTORY</span>
            <h2>Suppliers</h2>

            <p>
              {filteredSuppliers.length} supplier
              {filteredSuppliers.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            className="supplier-section-purchase-btn"
            onClick={() => openPurchaseForm()}
          >
            + Record Purchase
          </button>
        </div>

        {loading ? (
          <div className="supplier-empty">
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="supplier-empty">
            <strong>No suppliers found</strong>

            <span>
              Add your first supplier to start recording
              purchases and tracking supplier balances.
            </span>

            <button
              className="supplier-primary-btn"
              onClick={() => openSupplierForm()}
            >
              + Add Supplier
            </button>
          </div>
        ) : (
          <div className="supplier-table-wrap">

            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Purchases</th>
                  <th>Total Purchased</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <button
                        className="supplier-name-button"
                        onClick={() => openDetails(supplier)}
                      >
                        <strong>{supplier.name}</strong>

                        {supplier.company_name && (
                          <small>{supplier.company_name}</small>
                        )}
                      </button>
                    </td>

                    <td>{supplier.purchaseCount}</td>
                    <td>{money(supplier.totalPurchases)}</td>
                    <td>{money(supplier.totalPaid)}</td>

                    <td>
                      <strong
                        className={
                          supplier.outstanding > 0
                            ? "supplier-balance"
                            : "supplier-paid"
                        }
                      >
                        {money(supplier.outstanding)}
                      </strong>
                    </td>

                    <td>
                      <span className={`supplier-status ${supplier.status}`}>
                        {supplier.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="supplier-row-actions">
                        <button onClick={() => openDetails(supplier)}>
                          View
                        </button>

                        <button onClick={() => openSupplierForm(supplier)}>
                          Edit
                        </button>

                        <button
                          className="danger"
                          onClick={() => deleteSupplier(supplier)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}

      </section>

      {showSupplierForm && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal">

            <div className="supplier-modal-header">
              <div>
                <span>SUPPLIER</span>
                <h2>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
              </div>

              <button className="supplier-close" onClick={closeSupplierForm}>
                ×
              </button>
            </div>

            <form onSubmit={saveSupplier}>
              <div className="supplier-form-grid">

                <label>
                  Supplier Name *
                  <input
                    value={supplierForm.name}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. John Supplies"
                  />
                </label>

                <label>
                  Company Name
                  <input
                    value={supplierForm.companyName}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        companyName: event.target.value,
                      }))
                    }
                    placeholder="Company name"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={supplierForm.phone}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="Phone number"
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Email address"
                  />
                </label>

                <label className="supplier-form-full">
                  Address
                  <input
                    value={supplierForm.address}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    placeholder="Supplier address"
                  />
                </label>

                <label>
                  Status
                  <select
                    value={supplierForm.status}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="supplier-form-full">
                  Notes
                  <textarea
                    value={supplierForm.notes}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Additional notes..."
                    rows="4"
                  />
                </label>

              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={closeSupplierForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingSupplier
                    ? "Save Changes"
                    : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPurchaseForm && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal supplier-purchase-modal supplier-batch-modal">
            <div className="supplier-modal-header">
              <div>
                <span>GOODS IN / PURCHASE</span>
                <h2>Record Multiple Purchases</h2>
                <small>Add several products from one supplier in a single transaction.</small>
              </div>
              <button type="button" className="supplier-close" onClick={closePurchaseForm}>×</button>
            </div>

            <form onSubmit={savePurchase}>
              <div className="supplier-form-grid supplier-batch-form">
                <label className="supplier-form-full">
                  Supplier *
                  <select
                    value={purchaseForm.supplierId}
                    onChange={(event) =>
                      setPurchaseForm((current) => ({
                        ...current,
                        supplierId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers
                      .filter((supplier) => supplier.status === "active")
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}{supplier.company_name ? ` — ${supplier.company_name}` : ""}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="supplier-form-full supplier-batch-items">
                  <div className="supplier-batch-section-heading">
                    <div>
                      <h3>Purchase Items</h3>
                      <p>Add every product included in this supplier delivery.</p>
                    </div>
                    <span>{purchaseItems.length} item{purchaseItems.length === 1 ? "" : "s"}</span>
                  </div>

                  {purchaseItems.map((item, index) => {
                    const selectedProduct = products.find(
                      (product) => product.id === item.productId
                    );
                    const itemTotal = purchaseItemTotals[index] || 0;

                    const updateItem = (changes) => {
                      setPurchaseForm((current) => ({
                        ...current,
                        items: current.items.map((row) =>
                          row.id === item.id ? { ...row, ...changes } : row
                        ),
                      }));
                    };

                    return (
                      <div className="supplier-batch-item" key={item.id}>
                        <div className="supplier-batch-item-header">
                          <div className="supplier-batch-item-title">
                            <span>ITEM {index + 1}</span>
                            <strong>{item.productMode === "new"
                              ? (item.newProductName || "New product")
                              : (selectedProduct?.name || "Select a product")}</strong>
                          </div>
                          {purchaseItems.length > 1 && (
                            <button
                              type="button"
                              className="supplier-batch-item-remove"
                              onClick={() =>
                                setPurchaseForm((current) => ({
                                  ...current,
                                  items: current.items.filter((row) => row.id !== item.id),
                                }))
                              }
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="supplier-batch-mode-toggle">
                          <button
                            type="button"
                            className={item.productMode === "existing" ? "active" : ""}
                            onClick={() => updateItem({
                              productMode: "existing",
                              newProductName: "",
                            })}
                          >
                            Existing Product
                          </button>
                          <button
                            type="button"
                            className={item.productMode === "new" ? "active" : ""}
                            onClick={() => updateItem({
                              productMode: "new",
                              productId: "",
                              unitCost: "",
                            })}
                          >
                            + New Product
                          </button>
                        </div>

                        {item.productMode === "existing" ? (
                          <>
                            <label>
                              Select Product *
                              <select
                                value={item.productId}
                                onChange={(event) => {
                                  const product = products.find(
                                    (row) => row.id === event.target.value
                                  );
                                  updateItem({
                                    productId: event.target.value,
                                    unitCost: product && Number(product.cost_price || 0) > 0
                                      ? String(product.cost_price)
                                      : item.unitCost,
                                  });
                                }}
                                required
                              >
                                <option value="">Choose existing product</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} — Stock: {Number(product.stock || 0)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {selectedProduct && (
                              <div className="selected-product-info">
                                <div>
                                  <span>Current Stock</span>
                                  <strong>{Number(selectedProduct.stock || 0)}</strong>
                                </div>
                                <div>
                                  <span>Current Cost</span>
                                  <strong>{money(selectedProduct.cost_price)}</strong>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <label>
                            New Product Name *
                            <input
                              value={item.newProductName}
                              onChange={(event) => updateItem({
                                newProductName: event.target.value,
                              })}
                              placeholder="Enter new product name"
                              required
                            />
                          </label>
                        )}

                        <div className="supplier-batch-item-grid">
                          <label>
                            Quantity *
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(event) => updateItem({ quantity: event.target.value })}
                              placeholder="e.g. 20"
                              required
                            />
                          </label>
                          <label>
                            Cost Per Unit *
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(event) => updateItem({ unitCost: event.target.value })}
                              placeholder="e.g. 2000"
                              required
                            />
                          </label>
                        </div>

                        <div className="supplier-batch-item-total">
                          <span>Item Total</span>
                          <strong>{money(itemTotal)}</strong>
                          <small>{Number(item.quantity || 0)} units × {money(item.unitCost || 0)}</small>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="supplier-batch-add-btn"
                    onClick={() =>
                      setPurchaseForm((current) => ({
                        ...current,
                        items: [
                          ...current.items,
                          {
                            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            productMode: "existing",
                            productId: "",
                            newProductName: "",
                            quantity: "",
                            unitCost: "",
                          },
                        ],
                      }))
                    }
                  >
                    + Add Another Item
                  </button>
                </div>

                <div className="supplier-batch-summary supplier-form-full">
                  <div className="supplier-batch-section-heading">
                    <div>
                      <h3>Batch Summary</h3>
                      <p>Combined value of all items being recorded.</p>
                    </div>
                  </div>
                  <div className="supplier-batch-summary-grid">
                    <div>
                      <span>Total Items</span>
                      <strong>{purchaseItems.length}</strong>
                    </div>
                    <div>
                      <span>Total Units</span>
                      <strong>{purchaseQuantity}</strong>
                    </div>
                    <div>
                      <span>Total Purchase Cost</span>
                      <strong>{money(calculatedPurchaseTotal)}</strong>
                    </div>
                    <div>
                      <span>Remaining Balance</span>
                      <strong>{money(calculatedPurchaseBalance)}</strong>
                    </div>
                  </div>
                </div>

                <div className="supplier-batch-payment supplier-form-full">
                  <div className="supplier-batch-section-heading">
                    <div>
                      <h3>Initial Payment</h3>
                      <p>Enter the combined payment made for this entire batch. Leave both amounts at zero if unpaid.</p>
                    </div>
                  </div>

                  <div className="supplier-batch-payment-grid">
                    <label>
                      Cash Amount
                      <input
                        type="number"
                        min="0"
                        max={calculatedPurchaseTotal || undefined}
                        step="0.01"
                        value={purchaseForm.cashAmount}
                        onChange={(event) => setPurchaseForm((current) => ({
                          ...current,
                          cashAmount: event.target.value,
                        }))}
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      Transfer Amount
                      <input
                        type="number"
                        min="0"
                        max={calculatedPurchaseTotal || undefined}
                        step="0.01"
                        value={purchaseForm.transferAmount}
                        onChange={(event) => setPurchaseForm((current) => ({
                          ...current,
                          transferAmount: event.target.value,
                          transferTransactionId: event.target.value ? current.transferTransactionId : "",
                        }))}
                        placeholder="0.00"
                      />
                    </label>
                  </div>

                  {purchaseTransferAmount > 0 && (
                    <label className="supplier-batch-transfer-select">
                      Matching Bank Debit *
                      <select
                        value={purchaseForm.transferTransactionId}
                        onChange={(event) => setPurchaseForm((current) => ({
                          ...current,
                          transferTransactionId: event.target.value,
                        }))}
                        required
                      >
                        <option value="">Select the bank debit for the full transfer amount</option>
                        {availablePurchaseTransferTransactions
                          .filter((transaction) =>
                            Math.abs(Number(transaction.amount) - purchaseTransferAmount) < 0.005
                          )
                          .map((transaction) => (
                            <option key={transaction.id} value={transaction.id}>
                              {money(transaction.amount)} — {transaction.description || transaction.reference || "Bank debit"} — {new Date(transaction.created_at).toLocaleDateString("en-NG")}
                            </option>
                          ))}
                      </select>
                      <small className="supplier-field-help">
                        The selected bank debit must match the full transfer amount.
                      </small>
                    </label>
                  )}

                  <div className="supplier-payment-preview">
                    <div>
                      <span>Cash</span>
                      <strong>{money(purchaseCashAmount)}</strong>
                    </div>
                    <div>
                      <span>Transfer</span>
                      <strong>{money(purchaseTransferAmount)}</strong>
                    </div>
                    <div>
                      <span>Total Paid</span>
                      <strong className="paid">{money(purchaseInitialPayment)}</strong>
                    </div>
                    <div>
                      <span>Balance Due</span>
                      <strong className={calculatedPurchaseBalance > 0 ? "balance" : "cleared"}>
                        {money(calculatedPurchaseBalance)}
                      </strong>
                    </div>
                  </div>
                </div>

                <label>
                  Purchase Date *
                  <input
                    type="date"
                    value={purchaseForm.purchaseDate}
                    onChange={(event) => setPurchaseForm((current) => ({
                      ...current,
                      purchaseDate: event.target.value,
                    }))}
                    required
                  />
                </label>

                <label>
                  Due Date
                  <input
                    type="date"
                    value={purchaseForm.dueDate}
                    onChange={(event) => setPurchaseForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))}
                  />
                  <small className="supplier-field-help">Used to determine overdue balances.</small>
                </label>

                <label className="supplier-form-full">
                  Notes
                  <textarea
                    value={purchaseForm.notes}
                    onChange={(event) => setPurchaseForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))}
                    placeholder="Notes for this supplier delivery..."
                    rows="3"
                  />
                </label>
              </div>

              <div className="supplier-form-actions supplier-batch-footer">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={closePurchaseForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={purchaseSaving}
                >
                  {purchaseSaving ? "Recording Batch..." : "Record All Purchases"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentForm && selectedPurchase && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal supplier-payment-modal">

            <div className="supplier-modal-header">
              <div>
                <span>SUPPLIER PAYMENT</span>
                <h2>Record Payment</h2>
                <small>Remaining: {money(selectedPurchase.balance)}</small>
              </div>

              <button className="supplier-close" onClick={closePaymentForm}>
                ×
              </button>
            </div>

            <form onSubmit={savePayment}>
              <div className="supplier-payment-summary">
                <div>
                  <span>Purchase</span>
                  <strong>
                    {selectedPurchase.product_name ||
                      selectedPurchase.description ||
                      "Purchase"}
                  </strong>
                </div>

                <div>
                  <span>Supplier</span>
                  <strong>
                    {selectedPurchase.supplier?.name || "Unknown supplier"}
                  </strong>
                </div>

                <div>
                  <span>Outstanding</span>
                  <strong>{money(selectedPurchase.balance)}</strong>
                </div>
              </div>

              <div className="supplier-form-grid">
                <label>
                  Cash Amount
                  <input
                    type="number"
                    min="0"
                    max={selectedPurchase.balance}
                    step="0.01"
                    value={paymentForm.cashAmount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        cashAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Transfer Amount
                  <input
                    type="number"
                    min="0"
                    max={selectedPurchase.balance}
                    step="0.01"
                    value={paymentForm.transferAmount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        transferAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                {Number(paymentForm.transferAmount || 0) > 0 && (
                  <label className="supplier-form-full">
                    Bank Transfer Transaction *
                    <select
                      value={paymentForm.transferTransactionId}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          transferTransactionId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select the bank debit already recorded
                      </option>

                      {availablePurchaseTransferTransactions
                        .filter(
                          (transaction) =>
                            Number(transaction.amount) ===
                            Number(paymentForm.transferAmount)
                        )
                        .map((transaction) => (
                          <option key={transaction.id} value={transaction.id}>
                            {money(transaction.amount)}
                            {" — "}
                            {transaction.description ||
                              transaction.reference ||
                              "Bank debit"}
                            {" — "}
                            {new Date(transaction.created_at).toLocaleDateString("en-NG")}
                          </option>
                        ))}
                    </select>

                    <small className="supplier-field-help">
                      Link the existing bank debit. This will not create another transaction.
                    </small>
                  </label>
                )}

                <div className="supplier-payment-preview">
                  <div>
                    <span>Cash</span>
                    <strong>{money(paymentForm.cashAmount)}</strong>
                  </div>

                  <div>
                    <span>Transfer</span>
                    <strong>{money(paymentForm.transferAmount)}</strong>
                  </div>

                  <div>
                    <span>Total Payment</span>
                    <strong className="paid">
                      {money(
                        Number(paymentForm.cashAmount || 0) +
                          Number(paymentForm.transferAmount || 0)
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Remaining</span>
                    <strong className="balance">
                      {money(
                        Math.max(
                          Number(selectedPurchase.balance || 0) -
                            Number(paymentForm.cashAmount || 0) -
                            Number(paymentForm.transferAmount || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                </div>

                <label>
                  Payment Date *
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Reference
                  <input
                    value={paymentForm.reference}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Transaction reference"
                  />
                </label>

                <label className="supplier-form-full">
                  Notes
                  <textarea
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Payment notes..."
                    rows="3"
                  />
                </label>
              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={closePaymentForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={paymentSaving}
                >
                  {paymentSaving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOpeningDebtForm && selectedSupplier && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal supplier-opening-debt-modal">

            <div className="supplier-modal-header">
              <div>
                <span>SUPPLIER ACCOUNT</span>
                <h2>Record Existing Debt</h2>
                <small>
                  This records an amount already owed. It will not create a purchase or add stock.
                </small>
              </div>

              <button
                className="supplier-close"
                onClick={closeOpeningDebtForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveOpeningDebt}>
              <div className="supplier-form-grid">

                <div className="supplier-form-full supplier-payment-summary">
                  <div>
                    <span>Supplier</span>
                    <strong>{selectedSupplier.name}</strong>
                  </div>

                  <div>
                    <span>Current Outstanding</span>
                    <strong>{money(selectedSupplier.outstanding)}</strong>
                  </div>
                </div>

                <label className="supplier-form-full">
                  Existing Amount Owed *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={openingDebtForm.amount}
                    onChange={(event) =>
                      setOpeningDebtForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="e.g. 150000"
                  />
                </label>

                <label className="supplier-form-full">
                  Debt Date *
                  <input
                    type="date"
                    value={openingDebtForm.transactionDate}
                    onChange={(event) =>
                      setOpeningDebtForm((current) => ({
                        ...current,
                        transactionDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="supplier-form-full">
                  Notes
                  <textarea
                    value={openingDebtForm.notes}
                    onChange={(event) =>
                      setOpeningDebtForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional details about this existing debt..."
                    rows="3"
                  />
                </label>
              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={closeOpeningDebtForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={openingDebtSaving}
                >
                  {openingDebtSaving ? "Saving..." : "Record Existing Debt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccountPaymentForm && selectedSupplier && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal supplier-account-payment-modal">

            <div className="supplier-modal-header">
              <div>
                <span>SUPPLIER ACCOUNT</span>
                <h2>Pay Supplier Account</h2>
                <small>
                  This payment reduces the supplier's combined outstanding balance.
                </small>
              </div>

              <button
                className="supplier-close"
                onClick={closeAccountPaymentForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveAccountPayment}>
              <div className="supplier-payment-summary">
                <div>
                  <span>Supplier</span>
                  <strong>{selectedSupplier.name}</strong>
                </div>

                <div>
                  <span>Current Outstanding</span>
                  <strong>{money(selectedSupplier.outstanding)}</strong>
                </div>

                <div>
                  <span>After This Payment</span>
                  <strong>
                    {money(
                      Math.max(
                        Number(selectedSupplier.outstanding || 0) -
                          Number(accountPaymentForm.cashAmount || 0) -
                          Number(accountPaymentForm.transferAmount || 0),
                        0
                      )
                    )}
                  </strong>
                </div>
              </div>

              <div className="supplier-form-grid">
                <label>
                  Cash Amount
                  <input
                    type="number"
                    min="0"
                    max={selectedSupplier.outstanding}
                    step="0.01"
                    value={accountPaymentForm.cashAmount}
                    onChange={(event) =>
                      setAccountPaymentForm((current) => ({
                        ...current,
                        cashAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Transfer Amount
                  <input
                    type="number"
                    min="0"
                    max={selectedSupplier.outstanding}
                    step="0.01"
                    value={accountPaymentForm.transferAmount}
                    onChange={(event) =>
                      setAccountPaymentForm((current) => ({
                        ...current,
                        transferAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                {Number(accountPaymentForm.transferAmount || 0) > 0 && (
                  <label className="supplier-form-full">
                    Bank Transfer Transaction *
                    <select
                      value={accountPaymentForm.transferTransactionId}
                      onChange={(event) =>
                        setAccountPaymentForm((current) => ({
                          ...current,
                          transferTransactionId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select the bank debit already recorded
                      </option>

                      {availablePurchaseTransferTransactions
                        .filter(
                          (transaction) =>
                            Number(transaction.amount) ===
                            Number(accountPaymentForm.transferAmount)
                        )
                        .map((transaction) => (
                          <option key={transaction.id} value={transaction.id}>
                            {money(transaction.amount)}
                            {" — "}
                            {transaction.description ||
                              transaction.reference ||
                              "Bank debit"}
                            {" — "}
                            {new Date(transaction.created_at).toLocaleDateString("en-NG")}
                          </option>
                        ))}
                    </select>

                    <small className="supplier-field-help">
                      Select the matching bank debit. It will not be recorded twice.
                    </small>
                  </label>
                )}

                <div className="supplier-payment-preview">
                  <div>
                    <span>Cash</span>
                    <strong>{money(accountPaymentForm.cashAmount)}</strong>
                  </div>

                  <div>
                    <span>Transfer</span>
                    <strong>{money(accountPaymentForm.transferAmount)}</strong>
                  </div>

                  <div>
                    <span>Total Payment</span>
                    <strong className="paid">
                      {money(
                        Number(accountPaymentForm.cashAmount || 0) +
                          Number(accountPaymentForm.transferAmount || 0)
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Remaining Balance</span>
                    <strong className="balance">
                      {money(
                        Math.max(
                          Number(selectedSupplier.outstanding || 0) -
                            Number(accountPaymentForm.cashAmount || 0) -
                            Number(accountPaymentForm.transferAmount || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                </div>

                <label>
                  Payment Date *
                  <input
                    type="date"
                    value={accountPaymentForm.paymentDate}
                    onChange={(event) =>
                      setAccountPaymentForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Reference
                  <input
                    value={accountPaymentForm.reference}
                    onChange={(event) =>
                      setAccountPaymentForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Transaction reference"
                  />
                </label>

                <label className="supplier-form-full">
                  Notes
                  <textarea
                    value={accountPaymentForm.notes}
                    onChange={(event) =>
                      setAccountPaymentForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Payment notes..."
                    rows="3"
                  />
                </label>
              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={closeAccountPaymentForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={accountPaymentSaving}
                >
                  {accountPaymentSaving ? "Saving..." : "Record Account Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails &&
        selectedSupplier &&
        !showPaymentForm &&
        !showOpeningDebtForm &&
        !showAccountPaymentForm && (
          <div className="supplier-modal-backdrop">
            <div className="supplier-modal supplier-details-modal">

              <div className="supplier-modal-header">
                <div>
                  <span>SUPPLIER PROFILE</span>
                  <h2>{selectedSupplier.name}</h2>

                  {selectedSupplier.company_name && (
                    <small>{selectedSupplier.company_name}</small>
                  )}
                </div>

                <button className="supplier-close" onClick={closeDetails}>
                  ×
                </button>
              </div>

              <div className="supplier-profile-grid">
                <div>
                  <span>Phone</span>
                  <strong>{selectedSupplier.phone || "—"}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{selectedSupplier.email || "—"}</strong>
                </div>

                <div>
                  <span>Address</span>
                  <strong>{selectedSupplier.address || "—"}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {selectedSupplier.status === "active" ? "Active" : "Inactive"}
                  </strong>
                </div>
              </div>

              <div className="supplier-detail-stats">
                <div>
                  <span>Purchased</span>
                  <strong>{money(selectedSupplier.totalPurchases)}</strong>
                </div>

                <div>
                  <span>Paid</span>
                  <strong>{money(selectedSupplier.totalPaid)}</strong>
                </div>

                <div>
                  <span>Outstanding</span>
                  <strong>{money(selectedSupplier.outstanding)}</strong>
                </div>

                <div>
                  <span>Overdue</span>
                  <strong>{money(selectedSupplier.overdue)}</strong>
                </div>
              </div>

              <div className="supplier-account-summary">
                <div>
                  <span>Existing Debt</span>
                  <strong>{money(selectedSupplier.openingDebt)}</strong>
                </div>

                <div>
                  <span>Account Payments</span>
                  <strong>{money(selectedSupplier.accountPaid)}</strong>
                </div>

                <div>
                  <span>Existing Debt Balance</span>
                  <strong>{money(selectedSupplier.accountOutstanding)}</strong>
                </div>

                <div>
                  <span>Purchase Balance</span>
                  <strong>{money(selectedSupplier.purchaseOutstanding)}</strong>
                </div>
              </div>

              <div className="supplier-detail-actions">
                <button
                  className="supplier-primary-btn"
                  onClick={() => openPurchaseForm(selectedSupplier)}
                >
                  + Record Purchase
                </button>

                <button
                  className="supplier-secondary-btn"
                  onClick={openOpeningDebtForm}
                >
                  + Record Existing Debt
                </button>

                <button
                  className="supplier-secondary-btn"
                  onClick={openAccountPaymentForm}
                  disabled={Number(selectedSupplier.outstanding || 0) <= 0}
                >
                  Pay Supplier Account
                </button>

                <button
                  className="supplier-secondary-btn"
                  onClick={() => openSupplierForm(selectedSupplier)}
                >
                  Edit Supplier
                </button>
              </div>

              <div className="supplier-account-ledger">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">ACCOUNT ACTIVITY</span>
                    <h3>Supplier Account Ledger</h3>
                    <p>
                      Opening debt and general payments. Purchase-linked payments remain in purchase history.
                    </p>
                  </div>
                </div>

                {selectedSupplierAccountTransactions.length === 0 ? (
                  <div className="supplier-empty compact">
                    No opening debt or account payments recorded yet.
                  </div>
                ) : (
                  <div className="supplier-account-ledger-list">
                    {selectedSupplierAccountTransactions.map((transaction) => {
                      const isOpeningDebt =
                        transaction.transaction_type === "opening_debt";

                      return (
                        <div
                          className="supplier-account-ledger-row"
                          key={transaction.id}
                        >
                          <div>
                            <strong>
                              {isOpeningDebt ? "Opening Debt" : "Account Payment"}
                            </strong>

                            <span>{transaction.transaction_date}</span>

                            {transaction.payment_method && (
                              <small>
                                {transaction.payment_method}
                              </small>
                            )}

                            {transaction.reference && (
                              <small>
                                Reference: {transaction.reference}
                              </small>
                            )}

                            {transaction.notes && (
                              <small>{transaction.notes}</small>
                            )}

                            {transaction.finance_transaction_id && (
                              <small className="supplier-linked-debit">
                                Linked bank debit
                              </small>
                            )}
                          </div>

                          <strong className={isOpeningDebt ? "credit" : "debit"}>
                            {isOpeningDebt ? "+" : "−"}
                            {money(transaction.amount)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="supplier-history">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">GOODS IN</span>
                    <h3>Purchase History</h3>

                    <p>
                      {selectedSupplierPurchases.length} record
                      {selectedSupplierPurchases.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {selectedSupplierPurchases.length === 0 ? (
                  <div className="supplier-empty compact">
                    No purchases recorded yet.
                  </div>
                ) : (
                  <div className="supplier-purchase-list">
                    {selectedSupplierPurchases.map((purchase) => (
                      <div
                        className={`supplier-purchase-card ${
                          highlightedPurchaseId === purchase.id
                            ? "supplier-purchase-card-highlight"
                            : ""
                        }`}
                        key={purchase.id}
                        ref={
                          pendingPurchaseHighlightId === purchase.id ||
                          highlightedPurchaseId === purchase.id
                            ? highlightedPurchaseRef
                            : null
                        }
                      >
                        <div className="supplier-purchase-main">
                          <div className="supplier-purchase-title-row">
                            <span className="supplier-stock-in-badge">
                              STOCK IN
                            </span>

                            <strong>
                              {purchase.product_name ||
                                purchase.description ||
                                "Purchase"}
                            </strong>
                          </div>

                          <span>
                            {purchase.purchase_date}
                            {" • "}
                            {Number(purchase.quantity || 0)} units
                          </span>

                          <small>
                            Unit cost: {money(purchase.unit_cost)}
                          </small>
                        </div>

                        <div className="supplier-purchase-money">
                          <span>Total {money(purchase.totalAmount)}</span>
                          <span>Paid {money(purchase.paid)}</span>
                          <strong>Balance {money(purchase.balance)}</strong>
                        </div>

                        <div className="supplier-purchase-actions">
                          <span
                            className={`supplier-status purchase-${purchase.calculatedStatus}`}
                          >
                            {statusLabel(purchase.calculatedStatus)}
                          </span>

                          {purchase.balance > 0 && (
                            <button
                              className="supplier-pay-btn"
                              onClick={() => openPaymentForm(purchase)}
                            >
                              Pay
                            </button>
                          )}

                          <button
                            className="supplier-view-btn"
                            onClick={() => openPaymentHistory(purchase)}
                          >
                            History
                          </button>

                          <button
                            className="supplier-delete-btn"
                            onClick={() => deletePurchase(purchase)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPurchase && (
                <div className="supplier-payment-history">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">PAYMENTS</span>
                      <h3>Payment History</h3>

                      <p>
                        {selectedPurchase.product_name ||
                          selectedPurchase.description ||
                          "Purchase"}
                      </p>
                    </div>

                    <button
                      className="supplier-close-history"
                      onClick={() => setSelectedPurchaseId(null)}
                    >
                      Close
                    </button>
                  </div>

                  {selectedPurchasePayments.length === 0 ? (
                    <div className="supplier-empty compact">
                      No payments recorded yet.
                    </div>
                  ) : (
                    <div className="supplier-payment-list">
                      {selectedPurchasePayments.map((payment) => (
                        <div className="supplier-payment-row" key={payment.id}>
                          <div>
                            <strong>{money(payment.amount)}</strong>
                            <span>{payment.payment_date}</span>
                          </div>

                          <div>
                            <span>{payment.payment_method || "—"}</span>
                            <small>{payment.reference || "No reference"}</small>

                            {payment.finance_transaction_id && (
                              <small className="supplier-linked-debit">
                                {(() => {
                                  const linkedDebit = financeTransactions.find(
                                    (transaction) =>
                                      transaction.id === payment.finance_transaction_id
                                  );

                                  return linkedDebit
                                    ? `Linked bank debit: ${
                                        linkedDebit.description || "Bank transaction"
                                      } • ${money(linkedDebit.amount)} • ${
                                        linkedDebit.created_at
                                          ? new Date(
                                              linkedDebit.created_at
                                            ).toLocaleDateString("en-NG")
                                          : "Date unavailable"
                                      }`
                                    : "Linked bank debit recorded";
                                })()}
                              </small>
                            )}

                            {payment.purchase_batch_id && (
                              <small className="supplier-linked-debit">
                                {(() => {
                                  const batch = purchaseBatches.find(
                                    (item) => item.id === payment.purchase_batch_id
                                  );
                                  const batchDebit = batch?.finance_transaction_id
                                    ? financeTransactions.find(
                                        (transaction) =>
                                          transaction.id === batch.finance_transaction_id
                                      )
                                    : null;

                                  if (!batch?.finance_transaction_id) {
                                    return "Part of a batch purchase";
                                  }

                                  return batchDebit
                                    ? `Batch bank debit: ${
                                        batchDebit.description || "Bank transaction"
                                      } • ${money(batchDebit.amount)} • ${
                                        batchDebit.created_at
                                          ? new Date(batchDebit.created_at).toLocaleDateString("en-NG")
                                          : "Date unavailable"
                                      }`
                                    : "Batch bank debit linked";
                                })()}
                              </small>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

    </div>
  );
}

export default Suppliers;
