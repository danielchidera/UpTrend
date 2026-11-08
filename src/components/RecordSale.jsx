import "./RecordSale.css";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import {
  saveCachedRecords,
  getCachedRecords,
} from "../lib/localDb";
import { logAudit } from "../utils/auditLog";
import SaleReceipt from "../Business/SaleReceipt";

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptySale(date = getToday()) {
  return {
    date,
    productId: "",
    quantity: "1",
    sellingPrice: "",
    paymentMethod: "cash",
    financeTransactionId: "",
  };
}

function RecordSale({
  onBack,
  editingSale,
  onEditComplete,
  subscription,
  onUpgrade,
}) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [financeTransactions, setFinanceTransactions] =
    useState([]);

  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [modalOpen, setModalOpen] = useState(
    Boolean(editingSale)
  );

  const [step, setStep] = useState(1);

  const [sale, setSale] = useState(() =>
    editingSale
      ? {
          date: editingSale.date || getToday(),
          productId: editingSale.productId || "",
          quantity: String(editingSale.quantity || 1),
          sellingPrice: String(
            editingSale.sellingPrice || ""
          ),
          paymentMethod:
            editingSale.paymentMethod || "cash",
          financeTransactionId:
            editingSale.financeTransactionId || "",
        }
      : createEmptySale()
  );

  const [lastRecordedDate, setLastRecordedDate] =
    useState(() =>
      editingSale?.date || getToday()
    );

  const [paymentMode, setPaymentMode] = useState(
    editingSale?.paymentMethod === "transfer"
      ? "transfer"
      : "cash"
  );

  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [receiptSale, setReceiptSale] =
    useState(null);

  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );

  const isEditing = Boolean(editingSale);

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

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === sale.productId
      ),
    [products, sale.productId]
  );

  const quantity =
    Number(sale.quantity) || 0;

  const sellingPrice =
    Number(sale.sellingPrice) || 0;

  const costPrice =
    Number(selectedProduct?.costPrice) || 0;

  const totalCost =
    costPrice * quantity;

  const grossProfit =
    sellingPrice - totalCost;

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

  const availableTransfers = useMemo(() => {
    if (!sellingPrice) {
      return [];
    }

    return financeTransactions.filter(
      (transaction) =>
        Number(transaction.amount) === sellingPrice &&
        !transaction.metadata?.sale_id &&
        !transaction.metadata?.linked_record_id &&
        !transaction.metadata?.linked_record
    );
  }, [
    financeTransactions,
    sellingPrice,
  ]);

  const selectedTransfer = financeTransactions.find(
    (transaction) =>
      transaction.id === sale.financeTransactionId
  );

  const paymentTotal =
    paymentMode === "cash"
      ? Number(cashAmount || 0)
      : paymentMode === "transfer"
        ? Number(transferAmount || 0)
        : Number(cashAmount || 0) +
          Number(transferAmount || 0);

  const saleTotal = Number(sellingPrice);

  const paymentRemaining =
    saleTotal - paymentTotal;

  const isPaymentComplete =
    Number.isFinite(paymentTotal) &&
    Math.abs(paymentRemaining) < 0.01;

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoadingData(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (mounted) {
            setProducts([]);
            setFinanceTransactions([]);
            setError(
              "Your session has expired. Please sign in again."
            );
          }

          return;
        }

        if (!navigator.onLine) {
          const [cachedProducts, cachedCustomers, cachedTransactions] =
            await Promise.all([
              getCachedRecords("products", user.id),
              getCachedRecords("customers", user.id),
              getCachedRecords("financeTransactions", user.id),
            ]);

          if (!mounted) return;

          setProducts(
            cachedProducts.map((product) => ({
              id: product.id,
              name: product.name,
              costPrice: Number(product.cost_price || 0),
              stock: Number(product.stock || 0),
              lowStockAt: Number(product.low_stock_at ?? 5),
            }))
          );

          setCustomers(cachedCustomers);

          setFinanceTransactions(
            cachedTransactions.map((transaction) => ({
              id: transaction.id,
              type: transaction.type,
              amount: Number(transaction.amount || 0),
              status: transaction.status,
              category: transaction.category || "",
              description: transaction.description || "",
              reference: transaction.reference || "",
              createdAt: transaction.created_at,
              metadata: transaction.metadata || {},
            }))
          );

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

        if (!accountId) {
          throw new Error(
            "Unable to load the financial account."
          );
        }

        const [
          productsResult,
          customersResult,
          financeTransactionsResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("uptrend_customers")
            .select("id, name, phone, email")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),

          supabase
            .from("uptrend_finance_transactions")
            .select(
              "id, type, amount, status, category, description, reference, metadata, created_at"
            )
            .eq("user_id", user.id)
            .eq("account_id", accountId)
            .eq("type", "credit")
            .eq("status", "completed")
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (customersResult.error) {
          throw customersResult.error;
        }

        if (financeTransactionsResult.error) {
          throw financeTransactionsResult.error;
        }

        if (!mounted) {
          return;
        }

        const cacheResults = await Promise.allSettled([
          saveCachedRecords("products", user.id, productsResult.data || []),
          saveCachedRecords("customers", user.id, customersResult.data || []),
          saveCachedRecords(
            "financeTransactions",
            user.id,
            financeTransactionsResult.data || []
          ),
        ]);

        cacheResults.forEach((result) => {
          if (result.status === "rejected") {
            console.warn("RecordSale cache save warning:", result.reason);
          }
        });

        if (!mounted) {
          return;
        }

        setProducts(
          (productsResult.data || []).map(
            (product) => ({
              id: product.id,
              name: product.name,
              costPrice: Number(
                product.cost_price || 0
              ),
              stock: Number(
                product.stock || 0
              ),
              lowStockAt: Number(
                product.low_stock_at ?? 5
              ),
            })
          )
        );

        setCustomers(customersResult.data || []);

        setFinanceTransactions(
          (financeTransactionsResult.data || []).map(
            (transaction) => ({
              id: transaction.id,
              type: transaction.type,
              amount: Number(
                transaction.amount || 0
              ),
              status: transaction.status,
              category:
                transaction.category || "",
              description:
                transaction.description || "",
              reference:
                transaction.reference || "",
              createdAt:
                transaction.created_at,
              metadata:
                transaction.metadata || {},
            })
          )
        );
      } catch (loadError) {
        console.error(
          "RecordSale data load error:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your products and bank transactions. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const updateSale = (field, value) => {
    setSale((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSaved(false);
  };

  const openRecorder = () => {
    setError("");
    setSaved(false);
    setStep(1);

    setSale(
      createEmptySale(
        lastRecordedDate || getToday()
      )
    );

    setPaymentMode("cash");
    setCashAmount("");
    setTransferAmount("");
    setCustomerId("");
    setDueDate("");

    setModalOpen(true);
  };

  const closeRecorder = () => {
    setSaved(false);
    setError("");
    setStep(1);
    setPaymentMode("cash");
    setCashAmount("");
    setTransferAmount("");
    setCustomerId("");
    setDueDate("");
    setModalOpen(false);
  };

  const handleProductSelect = (productId) => {
    setSale((current) => ({
      ...current,
      productId,
      sellingPrice: "",
      paymentMethod: "cash",
      financeTransactionId: "",
    }));

    setError("");
  };

  const validateStep = () => {
    if (step === 1) {
      if (!sale.date) {
        return "Please select the sale date.";
      }

      return "";
    }

    if (step === 2) {
      if (!sale.productId) {
        return "Please select a product.";
      }

      if (!selectedProduct) {
        return "Please select a valid product.";
      }

      if (
        Number(selectedProduct.stock) <= 0 &&
        !isEditing
      ) {
        return "This product is currently out of stock.";
      }

      return "";
    }

    if (step === 3) {
      if (!sale.quantity) {
        return "Please enter the quantity sold.";
      }

      if (
        !Number.isFinite(quantity) ||
        quantity < 1
      ) {
        return "Quantity must be at least 1.";
      }

      const availableStock =
        Number(selectedProduct?.stock || 0);

      const oldQuantity =
        isEditing &&
        editingSale?.productId === sale.productId
          ? Number(editingSale.quantity || 0)
          : 0;

      if (
        quantity >
        availableStock + oldQuantity
      ) {
        return `Not enough ${selectedProduct?.name || "product"} in stock.`;
      }

      return "";
    }

    if (step === 4) {
      if (sale.sellingPrice === "") {
        return "Please enter the selling price.";
      }

      if (
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0
      ) {
        return "Selling price cannot be negative.";
      }

      return "";
    }

    if (step === 5) {
      if (!["cash", "transfer", "split"].includes(paymentMode)) {
        return "Please select a payment method.";
      }

      const total = saleTotal;

      console.log("UPTREND PAYMENT DEBUG", {
  paymentMode,
  cashAmount,
  transferAmount,
  saleTotal,
  total,
  paymentTotal,
  paymentRemaining,
});

      if (!Number.isFinite(total) || total <= 0) {
        return "Please enter a valid selling price first.";
      }

      if (paymentMode === "cash") {
        const cash = Number(cashAmount || 0);

        if (!Number.isFinite(cash) || cash <= 0) {
          return "Enter the customer's initial payment.";
        }

        if (cash - total > 0.01) {
          return "Initial payment cannot be greater than the sale total.";
        }

        if (cash < total && !dueDate) {
          return "Please select a due date for the outstanding balance.";
        }

        return "";
      }

      if (paymentMode === "transfer") {
        if (!sale.financeTransactionId) {
          return "Please select the bank transaction received for this sale.";
        }

        if (!selectedTransfer) {
          return "The selected bank transaction could not be found.";
        }

        if (
          selectedTransfer.type !== "credit" ||
          selectedTransfer.status !== "completed"
        ) {
          return "The selected transaction must be a completed money-in transaction.";
        }

        if (
          Math.abs(Number(selectedTransfer.amount) - total) >
          0.01
        ) {
          return "The selected bank transaction amount must match the transfer payment.";
        }

        return "";
      }

      const cash = Number(cashAmount || 0);
      const transfer = Number(transferAmount || 0);

      if (!Number.isFinite(cash) || cash < 0) {
        return "Cash amount cannot be negative.";
      }

      if (!Number.isFinite(transfer) || transfer < 0) {
        return "Transfer amount cannot be negative.";
      }

      if (cash <= 0 || transfer <= 0) {
        return "Enter both a cash amount and a transfer amount.";
      }

      if (cash + transfer > total + 0.01) {
        return "Initial payment cannot be greater than the sale total.";
      }

      if (cash + transfer <= 0) {
        return "Enter the customer's initial payment.";
      }

      if (cash + transfer < total && !dueDate) {
        return "Please select a due date for the outstanding balance.";
      }

      if (!sale.financeTransactionId) {
        return "Please select the bank transaction received for the transfer portion.";
      }

      if (!selectedTransfer) {
        return "The selected bank transaction could not be found.";
      }

      if (
        selectedTransfer.type !== "credit" ||
        selectedTransfer.status !== "completed"
      ) {
        return "The selected transfer must be a completed money-in transaction.";
      }

      if (
        Math.abs(Number(selectedTransfer.amount) - transfer) >
        0.01
      ) {
        return "The selected bank transaction amount must match the transfer portion.";
      }

      return "";
    }

    return "";
  };

  const goNext = () => {
    const validationError =
      validateStep();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");

    if (step < 5) {
      setStep((current) => current + 1);
    }
  };

  const goBackStep = () => {
    setError("");

    if (step > 1) {
      setStep((current) => current - 1);
    }
  };

  const saveSale = async (
    recordAnother = false
  ) => {
    setError("");
    setSaved(false);

    const validationError =
      validateStep();

    if (validationError) {
  console.log("UPTREND VALIDATION ERROR", {
    validationError,
    paymentMode,
    cashAmount,
    transferAmount,
    saleTotal,
    paymentTotal,
    paymentRemaining,
  });

  setError(validationError);
  return;
    }

    if (!selectedProduct) {
      setError(
        "Please select a valid product."
      );
      return;
    }

    if (
      !isBusiness &&
      sale.date &&
      sale.date < freeHistoryCutoff
    ) {
      setHistoricalAccessOpen(true);
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

      if (isEditing) {
        const {
          data: updatedSaleRow,
          error: saleError,
        } = await supabase.rpc(
          "update_sale",
          {
            p_sale_id: editingSale.id,
            p_product_id: selectedProduct.id,
            p_product_name: selectedProduct.name,
            p_quantity: quantity,
            p_cost_price: costPrice,
            p_selling_price: sellingPrice / quantity,
            p_sale_date: sale.date,
          }
        );

        if (saleError) {
          throw saleError;
        }

        if (!updatedSaleRow) {
          throw new Error(
            "The sale was updated, but no updated record was returned."
          );
        }

        await logAudit({
          action: "sale_updated",
          category: "sales",
          description: `Updated sale: ${selectedProduct.name} — ${quantity} unit(s)`,
          entityType: "sale",
          entityId: editingSale.id,
          amount: sellingPrice,
          currency: "NGN",
          details: {
            saleDate: sale.date,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity,
            sellingPrice,
          },
        });

        setSaved(true);
        setLastRecordedDate(sale.date);

        setTimeout(() => {
          onEditComplete?.();
          setModalOpen(false);
          setSaved(false);
        }, 900);

        return;
      }

      let payments = [];

      if (paymentMode === "cash") {
        payments = [
          {
            payment_method: "cash",
            amount: Number(cashAmount),
            finance_transaction_id: null,
          },
        ];
      }

      if (paymentMode === "transfer") {
        payments = [
          {
            payment_method: "transfer",
            amount: Number(transferAmount),
            finance_transaction_id:
              sale.financeTransactionId,
          },
        ];
      }

      if (paymentMode === "split") {
        payments = [
          {
            payment_method: "cash",
            amount: Number(cashAmount),
            finance_transaction_id: null,
          },
          {
            payment_method: "transfer",
            amount: Number(transferAmount),
            finance_transaction_id:
              sale.financeTransactionId,
          },
        ];
      }

      const {
        data: insertedSale,
        error: salesError,
      } = await supabase.rpc(
        "record_sale_with_payments",
        {
          p_product_id: selectedProduct.id,
          p_quantity: quantity,
          p_selling_price: sellingPrice / quantity,
          p_sale_date: sale.date,
          p_payments: payments,
          p_customer_id: customerId || null,
          p_due_date: paymentRemaining > 0 ? dueDate : null,
        }
      );

      if (salesError) {
        throw salesError;
      }

      if (!insertedSale) {
        throw new Error(
          "The sale was not returned after saving."
        );
      }

      const savedResult = Array.isArray(insertedSale)
        ? insertedSale[0]
        : insertedSale;

      const savedSale = savedResult?.sale || savedResult;

      await logAudit({
        action: "sale_recorded",
        category: "sales",
        description: `Recorded sale: ${selectedProduct.name} — ${quantity} unit(s)`,
        entityType: "sale",
        entityId: savedSale?.id ? String(savedSale.id) : null,
        amount: sellingPrice,
        currency: "NGN",
        details: {
          saleDate: sale.date,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity,
          sellingPrice,
          paymentMode,
          payments,
        },
      });

      setSaved(true);
      setLastRecordedDate(sale.date);

      if (recordAnother) {
        setTimeout(() => {
          setSale(
            createEmptySale(sale.date)
          );
          setStep(1);
          setSaved(false);
          setError("");
        }, 700);

        return;
      }

      setTimeout(() => {
        setModalOpen(false);
        setSaved(false);
      }, 900);
    } catch (saveError) {
      console.error(
        "Sale save error:",
        saveError
      );

      setError(
        saveError?.message ||
          "We couldn't record this sale. Please try again."
      );
    }
  };
  if (loadingData) {
    return (
      <div className="record-page">
        <div className="premium-card record-loading">
          Loading your products and transactions...
        </div>
      </div>
    );
  }

  return (
    <div className="record-page">

      <div className="record-page-top">
        <div>
          <div className="mini-label">
            SALES
          </div>

          <h2>
            Record Sales
          </h2>

          <p>
            Record a sale quickly without leaving your workspace.
          </p>
        </div>

        <button
          type="button"
          className="record-back-button"
          onClick={onBack}
        >
          ← Dashboard
        </button>
      </div>

      <section className="record-workspace record-workspace-simple">
        <div className="record-workspace-heading">
          <div>
            <div className="mini-label">SALES</div>
            <h3>Record a sale</h3>
            <p>Quickly add a sale to your records.</p>
          </div>
        </div>

        <div className="record-workspace-main">
          <div className="record-workspace-copy">
            <div className="record-workspace-icon">＋</div>
            <button
              type="button"
              className="record-sale-open-button"
              onClick={openRecorder}
            >
              <span>Start recording sale</span>
              <b>→</b>
            </button>
          </div>
        </div>

        <div className="record-workspace-footer">
          <span className="record-footer-label">LAST SALE</span>
          <strong>{lastRecordedDate}</strong>
        </div>
      </section>

      {error && !modalOpen && (
        <div className="record-error">
          <span>!</span>
          {error}
        </div>
      )}

      {modalOpen && (
        <div
          className="record-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeRecorder();
            }
          }}
        >
          <div
            className="record-sale-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-sale-title"
          >

            <div className="record-modal-header">
              <div>
                <div className="mini-label">
                  {isEditing
                    ? "UPDATE SALE"
                    : "NEW SALE"}
                </div>

                <h3 id="record-sale-title">
                  {isEditing
                    ? "Update Sale"
                    : "Record Sale"}
                </h3>
              </div>

              <button
                type="button"
                className="record-modal-close"
                onClick={closeRecorder}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="record-step-indicator">
              {[1, 2, 3, 4, 5].map(
                (item) => (
                  <div
                    key={item}
                    className={
                      item === step
                        ? "record-step active"
                        : item < step
                          ? "record-step complete"
                          : "record-step"
                    }
                  >
                    <span>
                      {item < step
                        ? "✓"
                        : item}
                    </span>

                    <small>
                      {item === 1 && "Date"}
                      {item === 2 && "Product"}
                      {item === 3 && "Quantity"}
                      {item === 4 && "Price"}
                      {item === 5 && "Payment"}
                    </small>
                  </div>
                )
              )}
            </div>

            <div className="record-modal-body">

              {step === 1 && (
                <div className="record-wizard-step">
                  <div className="record-wizard-icon">
                    📅
                  </div>

                  <h4>
                    When did the sale happen?
                  </h4>

                  <p>
                    Choose the date for this sale.
                  </p>

                  <label className="record-field">
                    <span>
                      Sale date
                    </span>

                    <input
                      type="date"
                      value={sale.date}
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

                        updateSale("date", value);
                      }}
                    />
                  </label>

                  <label className="record-field">
                    <span>Customer (Optional)</span>

                    <select
                      value={customerId}
                      onChange={(event) => {
                        setCustomerId(event.target.value);
                        setError("");
                      }}
                    >
                      <option value="">Walk-in sale / No customer</option>

                      {customers.map((customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.name}
                          {customer.phone
                            ? ` — ${customer.phone}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="record-wizard-info">
                    <span>Customer selection is optional</span>
                    <strong>You can record a walk-in sale without saving customer details.</strong>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="record-wizard-step">
                  <div className="record-wizard-icon">
                    🛍
                  </div>

                  <h4>
                    What did the customer buy?
                  </h4>

                  <p>
                    Select the product from your inventory.
                  </p>

                  <div className="record-product-picker">
                    {products.map(
                      (product) => {
                        const selected =
                          sale.productId ===
                          product.id;

                        const unavailable =
                          Number(
                            product.stock
                          ) <= 0 &&
                          product.id !==
                            editingSale?.productId;

                        return (
                          <button
                            type="button"
                            key={product.id}
                            className={
                              selected
                                ? "record-product-option selected"
                                : "record-product-option"
                            }
                            disabled={
                              unavailable
                            }
                            onClick={() =>
                              handleProductSelect(
                                product.id
                              )
                            }
                          >
                            <span>
                              {selected
                                ? "✓"
                                : "○"}
                            </span>

                            <div>
                              <strong>
                                {product.name}
                              </strong>

                              <small>
                                Stock:{" "}
                                {product.stock}
                              </small>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="record-wizard-step">
                  <div className="record-wizard-icon">
                    #
                  </div>

                  <h4>
                    How many were sold?
                  </h4>

                  <p>
                    Enter the quantity sold.
                  </p>

                  <label className="record-field record-quantity-field">
                    <span>
                      Quantity
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={sale.quantity}
                      onChange={(event) =>
                        updateSale(
                          "quantity",
                          event.target.value
                        )
                      }
                      autoFocus
                    />
                  </label>

                  {selectedProduct && (
                    <div className="record-wizard-info">
                      <span>
                        Available stock
                      </span>

                      <strong>
                        {selectedProduct.stock} units
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="record-wizard-step">
                  <div className="record-wizard-icon">
                    ₦
                  </div>

                  <h4>
                    What was the selling price?
                  </h4>

                  <p>
                    Enter the total amount the customer paid for this sale.
                  </p>

                  <label className="record-field">
                    <span>
                      Selling price
                    </span>

                    <div className="money-input">
                      <b>₦</b>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={sale.sellingPrice}
                        onChange={(event) =>
                          updateSale(
                            "sellingPrice",
                            event.target.value
                          )
                        }
                        autoFocus
                      />
                    </div>
                  </label>

                  {selectedProduct && (
                    <div className="record-wizard-calculation">
                      <div>
                        <span>
                          Cost
                        </span>

                        <strong>
                          {formatMoney(
                            totalCost
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Gross profit
                        </span>

                        <strong
                          className={
                            grossProfit < 0
                              ? "record-loss"
                              : "record-profit"
                          }
                        >
                          {grossProfit < 0
                            ? "-"
                            : "+"}

                          {formatMoney(
                            Math.abs(
                              grossProfit
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="record-wizard-step">
                  <div className="record-wizard-icon">
                    ₦
                  </div>

                  <h4>
                    How did the customer pay?
                  </h4>

                  <p>
                    Enter the customer's initial payment. Any unpaid amount becomes the customer's outstanding balance.
                  </p>

                  <div className="payment-method-options">
                    <button
                      type="button"
                      className={
                        paymentMode === "cash"
                          ? "payment-option active"
                          : "payment-option"
                      }
                      onClick={() => {
                        setPaymentMode("cash");
                        setCashAmount(String(saleTotal));
                        setTransferAmount("");
                        updateSale("paymentMethod", "cash");
                        updateSale("financeTransactionId", "");
                      }}
                    >
                      <strong>
                        Cash
                      </strong>

                      <small>
                        Customer paid physically
                      </small>
                    </button>

                    <button
                      type="button"
                      className={
                        paymentMode === "transfer"
                          ? "payment-option active"
                          : "payment-option"
                      }
                      onClick={() => {
                        setPaymentMode("transfer");
                        setCashAmount("");
                        setTransferAmount(String(saleTotal));
                        updateSale("paymentMethod", "transfer");
                      }}
                    >
                      <strong>
                        Transfer
                      </strong>

                      <small>
                        Customer paid by bank transfer
                      </small>
                    </button>

                    <button
                      type="button"
                      className={
                        paymentMode === "split"
                          ? "payment-option active"
                          : "payment-option"
                      }
                      onClick={() => {
                        setPaymentMode("split");
                        setCashAmount("");
                        setTransferAmount("");
                        updateSale("paymentMethod", "cash");
                        updateSale("financeTransactionId", "");
                      }}
                    >
                      <strong>
                        Cash + Transfer
                      </strong>

                      <small>
                        Customer used both payment methods
                      </small>
                    </button>
                  </div>

                  {paymentMode === "cash" && (
                    <div className="transfer-link-box">
                      <label>
                        <span>Initial payment from customer</span>

                        <div className="money-input">
                          <b>₦</b>
                          <input
                            type="number"
                            min="0"
                            max={saleTotal}
                            step="1"
                            placeholder="Enter amount paid now"
                            value={cashAmount}
                            onChange={(event) => {
                              setCashAmount(event.target.value);
                              setError("");
                            }}
                            autoFocus
                          />
                        </div>
                      </label>

                      <small>
                        Enter the amount the customer is paying now.
                        The remaining amount becomes their outstanding balance.
                      </small>
                    </div>
                  )}

                  {paymentMode === "split" && (
                    <div className="transfer-link-box">
                      <div className="split-payment-fields">
                        <label>
                          <span>
                            Cash amount
                          </span>

                          <div className="money-input">
                            <b>₦</b>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={cashAmount}
                              onChange={(event) => {
                                setCashAmount(event.target.value);
                                setError("");
                              }}
                            />
                          </div>
                        </label>

                        <label>
                          <span>
                            Transfer amount
                          </span>

                          <div className="money-input">
                            <b>₦</b>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={transferAmount}
                              onChange={(event) => {
                                setTransferAmount(
                                  event.target.value
                                );
                                updateSale(
                                  "financeTransactionId",
                                  ""
                                );
                                setError("");
                              }}
                            />
                          </div>
                        </label>
                      </div>

                      <div className="split-payment-summary">
                        <div>
                          <span>
                            Sale total
                          </span>

                          <strong>
                            {formatMoney(sellingPrice)}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Paid
                          </span>

                          <strong>
                            {formatMoney(paymentTotal)}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Remaining
                          </span>

                          <strong
                            className={
                              paymentRemaining === 0
                                ? "record-profit"
                                : "record-loss"
                            }
                          >
                            {formatMoney(
                              Math.abs(paymentRemaining)
                            )}
                          </strong>
                        </div>
                      </div>

                      {Number(transferAmount) > 0 && (
                        <label>
                          <span>
                            Bank transaction for transfer portion
                          </span>

                          <select
                            value={
                              sale.financeTransactionId
                            }
                            onChange={(event) =>
                              updateSale(
                                "financeTransactionId",
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Select matching transaction
                            </option>

                            {financeTransactions
                              .filter(
                                (transaction) =>
                                  Math.abs(
                                    Number(transaction.amount) -
                                      Number(transferAmount)
                                  ) < 0.01 &&
                                  !transaction.metadata?.sale_id &&
                                  !transaction.metadata?.linked_record_id &&
                                  !transaction.metadata?.linked_record
                              )
                              .map((transaction) => (
                                <option
                                  key={transaction.id}
                                  value={transaction.id}
                                >
                                  {formatMoney(
                                    transaction.amount
                                  )}{" "}
                                  —{" "}
                                  {transaction.description ||
                                    transaction.reference ||
                                    "Money received"}{" "}
                                  —{" "}
                                  {new Date(
                                    transaction.createdAt
                                  ).toLocaleString(
                                    "en-NG",
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }
                                  )}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}

                      {Number(transferAmount) > 0 &&
                        financeTransactions.filter(
                          (transaction) =>
                            Math.abs(
                              Number(transaction.amount) -
                                Number(transferAmount)
                            ) < 0.01
                        ).length === 0 && (
                          <small className="transfer-empty">
                            No completed bank transaction matches the
                            transfer amount. Receive the transfer in
                            Transactions first, then return here.
                          </small>
                        )}

                      {selectedTransfer &&
                        paymentMode === "split" && (
                          <div className="transfer-selected">
                            <span>
                              ✓ Transfer Linked
                            </span>

                            <strong>
                              {formatMoney(
                                selectedTransfer.amount
                              )}
                            </strong>
                          </div>
                        )}
                    </div>
                  )}

                  {paymentMode === "transfer" && (
                    <div className="transfer-link-box">
                      <label>
                        <span>Initial transfer payment</span>

                        <div className="money-input">
                          <b>₦</b>
                          <input
                            type="number"
                            min="0"
                            max={saleTotal}
                            step="1"
                            placeholder="Enter amount paid now"
                            value={transferAmount}
                            onChange={(event) => {
                              setTransferAmount(event.target.value);
                              updateSale("financeTransactionId", "");
                            }}
                            autoFocus
                          />
                        </div>
                      </label>

                      <label>
                        <span>
                          Received bank transaction
                        </span>

                        <select
                          value={
                            sale.financeTransactionId
                          }
                          onChange={(event) =>
                            updateSale(
                              "financeTransactionId",
                              event.target.value
                            )
                          }
                        >
                          <option value="">
                            Select matching transaction
                          </option>

                          {financeTransactions
                            .filter(
                              (transaction) =>
                                Math.abs(
                                  Number(transaction.amount) -
                                    sellingPrice
                                ) < 0.01 &&
                                !transaction.metadata?.sale_id &&
                                !transaction.metadata?.linked_record_id &&
                                !transaction.metadata?.linked_record
                            )
                            .map((transaction) => (
                              <option
                                key={transaction.id}
                                value={transaction.id}
                              >
                                {formatMoney(
                                  transaction.amount
                                )}{" "}
                                —{" "}
                                {transaction.description ||
                                  transaction.reference ||
                                  "Money received"}{" "}
                                —{" "}
                                {new Date(
                                  transaction.createdAt
                                ).toLocaleString(
                                  "en-NG",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }
                                )}
                              </option>
                            ))}
                        </select>
                      </label>

                      {selectedTransfer && (
                        <div className="transfer-selected">
                          <span>
                            ✓ Linked
                          </span>

                          <strong>
                            {formatMoney(
                              selectedTransfer.amount
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="record-wizard-calculation customer-payment-summary">
                    <div>
                      <span>Sale total</span>
                      <strong>{formatMoney(saleTotal)}</strong>
                    </div>

                    <div>
                      <span>Initial payment</span>
                      <strong>{formatMoney(paymentTotal)}</strong>
                    </div>

                    <div>
                      <span>Outstanding</span>
                      <strong className={paymentRemaining > 0 ? "record-loss" : "record-profit"}>
                        {formatMoney(Math.max(paymentRemaining, 0))}
                      </strong>
                    </div>
                  </div>

                  {paymentRemaining > 0 && (
                    <label className="record-field">
                      <span>Payment due date</span>
                      <input
                        type="date"
                        value={dueDate}
                        min={sale.date || getToday()}
                        onChange={(event) => {
                          setDueDate(event.target.value);
                          setError("");
                        }}
                      />
                    </label>
                  )}

                  <div className="payment-total-preview">
                    <span>
                      Sale total
                    </span>

                    <strong>
                      {formatMoney(sellingPrice)}
                    </strong>

                    {paymentMode === "split" && (
                      <span
                        className={
                          isPaymentComplete
                            ? "payment-complete"
                            : "payment-incomplete"
                        }
                      >
                        {isPaymentComplete
                          ? "Payment complete"
                          : `₦${Math.abs(
                              paymentRemaining
                            ).toLocaleString()} remaining`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="record-error">
                  <span>!</span>
                  {error}
                </div>
              )}

            </div>

            <div className="record-modal-footer">

              <button
                type="button"
                className="record-cancel"
                onClick={
                  step === 1
                    ? closeRecorder
                    : goBackStep
                }
              >
                {step === 1
                  ? "Cancel"
                  : "← Back"}
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  className="record-submit"
                  onClick={goNext}
                >
                  Continue
                  <b>→</b>
                </button>
              ) : (
                <div className="record-final-actions">

                  {!isEditing && (
                    <button
                      type="button"
                      className="record-secondary-submit"
                      onClick={() =>
                        saveSale(true)
                      }
                    >
                      Record Another Sale
                    </button>
                  )}

                  <button
                    type="button"
                    className="record-submit"
                    onClick={() =>
                      saveSale(false)
                    }
                  >
                    {isEditing
                      ? "Update Sale"
                      : "Save Sale"}

                    <b>✓</b>
                  </button>

                </div>
              )}

            </div>

            {saved && (
              <div className="record-success">
                <span>✓</span>

                {isEditing
                  ? "Sale updated successfully."
                  : "Sale recorded successfully."}
              </div>
            )}

          </div>
        </div>
      )}

      {isBusiness && receiptSale && (
        <SaleReceipt
          sale={receiptSale}
          onClose={() =>
            setReceiptSale(null)
          }
        />
      )}

    {historicalAccessOpen && !isBusiness && (
      <div
        className="historical-access-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recordsale-historical-access-title"
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

          <h2 id="recordsale-historical-access-title">
            Unlock backdated sales
          </h2>

          <p>
            Free accounts can record and edit sales from today
            and the previous 7 days. Upgrade to UpTrend Business
            to record or edit older sales.
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

export default RecordSale;
