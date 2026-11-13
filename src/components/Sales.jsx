import { isBusinessSubscriptionActive } from "../utils/subscription";
import "./Sales.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { saveCachedRecords, getCachedRecords } from "../lib/localDb";
import { logAudit } from "../utils/auditLog";
import { formatMoney } from "../utils/numberFormat";
import SalesInsights, { SalesProductPerformance } from "./SalesInsights";

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function Sales({
  onEditSale,
  saleToOpenId,
  onSaleOpenHandled,
  subscription,
  onUpgrade,
}) {
  const isBusiness = isBusinessSubscriptionActive(subscription);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] =
    useState("today");

  const [historicalAccessOpen, setHistoricalAccessOpen] =
    useState(false);

  const todayKey = localDateKey(new Date());

  const freeHistoryCutoff = useMemo(() => {
    const date = new Date(`${todayKey}T00:00:00`);
    date.setDate(date.getDate() - 7);
    return localDateKey(date);
  }, [todayKey]);

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  const [selectedSale, setSelectedSale] =
    useState(null);

  const [showReturnPanel, setShowReturnPanel] =
    useState(false);

  const [returnQuantity, setReturnQuantity] =
    useState(1);

  const [refundMethod, setRefundMethod] =
    useState("cash");

  const [eligibleRefundDebits, setEligibleRefundDebits] =
    useState([]);

  const [selectedRefundDebitId, setSelectedRefundDebitId] =
    useState("");

  const [refundDebitsLoading, setRefundDebitsLoading] =
    useState(false);

  const [refundDebitsError, setRefundDebitsError] =
    useState("");

  const [returnReason, setReturnReason] =
    useState("");


  const estimatedRefund = useMemo(() => {
    if (!selectedSale) return 0;

    return Number((
      (Number(selectedSale.totalSelling || 0) /
        Math.max(Number(selectedSale.quantity || 1), 1)) *
      Number(returnQuantity || 0)
    ).toFixed(2));
  }, [selectedSale, returnQuantity]);

  useEffect(() => {
    let active = true;

    const loadRefundDebits = async () => {
      if (!showReturnPanel || refundMethod !== "transfer") {
        setEligibleRefundDebits([]);
        setSelectedRefundDebitId("");
        setRefundDebitsError("");
        return;
      }

      setRefundDebitsLoading(true);
      setRefundDebitsError("");
      setSelectedRefundDebitId("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("You must be signed in.");

        const { data: linkedReturns, error: linkedError } =
          await supabase
            .from("uptrend_sale_returns")
            .select("refund_finance_transaction_id")
            .eq("user_id", user.id)
            .not("refund_finance_transaction_id", "is", null);

        if (linkedError) throw linkedError;

        const alreadyLinked = new Set(
          (linkedReturns || [])
            .map((row) => row.refund_finance_transaction_id)
            .filter(Boolean)
        );

        const { data: debits, error: debitError } =
          await supabase
            .from("uptrend_finance_transactions")
            .select("id, amount, category, description, reference, created_at")
            .eq("user_id", user.id)
            .eq("type", "debit")
            .eq("status", "completed")
            .order("created_at", { ascending: false });

        if (debitError) throw debitError;

        if (active) {
          setEligibleRefundDebits(
            (debits || []).filter((debit) =>
              !alreadyLinked.has(debit.id)
            )
          );
        }
      } catch (loadError) {
        if (active) {
          setEligibleRefundDebits([]);
          setRefundDebitsError(
            loadError?.message || "Could not load existing debits."
          );
        }
      } finally {
        if (active) setRefundDebitsLoading(false);
      }
    };

    loadRefundDebits();

    return () => {
      active = false;
    };
  }, [showReturnPanel, refundMethod]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const searchText =
        search.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        sale.product
          ?.toLowerCase()
          .includes(searchText);

      if (!matchesSearch) {
        return false;
      }

      if (dateFilter === "all") {
        return true;
      }

      if (dateFilter === "custom") {
        if (
          customStart &&
          sale.date < customStart
        ) {
          return false;
        }

        if (
          customEnd &&
          sale.date > customEnd
        ) {
          return false;
        }

        return true;
      }

      const today = new Date();
      const todayKey = localDateKey(today);

      if (dateFilter === "today") {
        return sale.date === todayKey;
      }

      const daysAgo =
        dateFilter === "7days"
          ? 7
          : dateFilter === "30days"
          ? 30
          : 0;

      if (daysAgo) {
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - daysAgo + 1);

        return (
          sale.date >= localDateKey(start) &&
          sale.date <= todayKey
        );
      }

      return true;
    });
  }, [
    sales,
    search,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const totals = useMemo(() => {
    const totalSales =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          Math.max(
            0,
            Number(sale.totalSelling || 0) -
              Number(sale.totalRefunded || 0)
          ),
        0
      );

    const grossProfit =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          (
            Number(sale.grossProfit || 0) -
            (
              Number(sale.totalRefunded || 0) -
              Number(sale.costPrice || 0) *
                Number(sale.returnedQuantity || 0)
            )
          ),
        0
      );

    const quantity =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          Number(sale.remainingQuantity ?? sale.quantity ?? 0),
        0
      );

    return {
      totalSales,
      grossProfit,
      quantity,
      transactions:
        filteredSales.length,
    };
  }, [filteredSales]);

  useEffect(() => {
    let mounted = true;

    const loadSales = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = session?.user;

        if (!user) {
          if (mounted) {
            setSales([]);
            setError("No signed-in user found.");
          }
          return;
        }

        // Offline: show the last fully calculated Sales records.
        if (!navigator.onLine) {
          const cachedSales = await getCachedRecords("sales", user.id);

          if (mounted) {
            setSales(cachedSales);
            setError(
              cachedSales.length
                ? "You're offline. Showing your last saved sales."
                : "You're offline and no saved sales are available on this device yet."
            );
          }
          return;
        }

        const { data, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .eq("user_id", user.id)
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (salesError) throw salesError;
        if (!mounted) return;

        const saleRows = data || [];
        let returnRows = [];

        if (saleRows.length > 0) {
          const saleIds = saleRows.map((sale) => sale.id);

          const { data: returns, error: returnsError } = await supabase
            .from("uptrend_sale_returns")
            .select("sale_id, quantity, refund_amount, refund_method, return_date")
            .in("sale_id", saleIds)
            .eq("user_id", user.id);

          if (returnsError) throw returnsError;
          returnRows = returns || [];
        }

        // Load credit debts linked to these sales.
        let debtRows = [];
        let debtPaymentRows = [];

        if (saleRows.length > 0) {
          const saleIds = saleRows.map((sale) => sale.id);

          const { data: debts, error: debtsError } = await supabase
            .from("uptrend_credit_debts")
            .select("id, sale_id, original_amount, status")
            .eq("user_id", user.id)
            .in("sale_id", saleIds);

          if (debtsError) throw debtsError;
          debtRows = debts || [];

          if (debtRows.length > 0) {
            const debtIds = debtRows.map((debt) => debt.id);

            const { data: payments, error: paymentsError } = await supabase
              .from("uptrend_credit_debt_payments")
              .select("debt_id, amount")
              .eq("user_id", user.id)
              .in("debt_id", debtIds);

            if (paymentsError) throw paymentsError;
            debtPaymentRows = payments || [];
          }
        }

        // The payment ledger is the source of truth for collected amounts.
        const ledgerPaid = {};

        debtPaymentRows.forEach((payment) => {
          ledgerPaid[payment.debt_id] =
            (ledgerPaid[payment.debt_id] || 0) +
            Number(payment.amount || 0);
        });

        const debtBySale = {};

        debtRows.forEach((debt) => {
          if (!debt.sale_id || debt.status === "cancelled") return;

          const original = Math.max(Number(debt.original_amount || 0), 0);
          const paid = Math.min(original, ledgerPaid[debt.id] || 0);
          const balance = Math.max(original - paid, 0);

          if (!debtBySale[debt.sale_id]) {
            debtBySale[debt.sale_id] = {
              original: 0,
              paid: 0,
              balance: 0,
              hasDebt: true,
            };
          }

          debtBySale[debt.sale_id].original += original;
          debtBySale[debt.sale_id].paid += paid;
          debtBySale[debt.sale_id].balance += balance;
        });

        Object.values(debtBySale).forEach((debt) => {
          debt.status = debt.balance <= 0 ? "paid" : "outstanding";
        });

        const returnSummary = returnRows.reduce((summary, returnRow) => {
          if (!summary[returnRow.sale_id]) {
            summary[returnRow.sale_id] = {
              returnedQuantity: 0,
              totalRefunded: 0,
            };
          }

          summary[returnRow.sale_id].returnedQuantity += Number(
            returnRow.quantity || 0
          );

          summary[returnRow.sale_id].totalRefunded += Number(
            returnRow.refund_amount || 0
          );

          return summary;
        }, {});

        const mappedSales = saleRows.map((sale) => {
          const summary = returnSummary[sale.id] || {
            returnedQuantity: 0,
            totalRefunded: 0,
          };

          const quantity = Number(sale.quantity || 0);
          const debt = debtBySale[sale.id] || null;

          return {
            id: sale.id,
            debt,
            debtStatus: debt?.status || null,
            debtOriginal: debt?.original || 0,
            debtPaid: debt?.paid || 0,
            debtBalance: debt?.balance || 0,
            date: sale.sale_date,
            productId: sale.product_id,
            product: sale.product_name,
            productName: sale.product_name,
            quantity,
            costPrice: Number(sale.cost_price || 0),
            totalCost: Number(sale.cost_price || 0) * quantity,
            sellingPrice: Number(sale.selling_price || 0),
            totalSelling: Number(sale.total_selling || 0),
            grossProfit: Number(sale.gross_profit || 0),
            paymentMethod: sale.payment_method || "cash",
            financeTransactionId: sale.finance_transaction_id || null,
            createdAt: sale.created_at,
            returnedQuantity: summary.returnedQuantity,
            remainingQuantity: Math.max(
              quantity - summary.returnedQuantity,
              0
            ),
            totalRefunded: summary.totalRefunded,
          };
        });

        if (!mounted) return;

        setSales(mappedSales);

        // Cache the complete calculated records for the next offline session.
        try {
          await saveCachedRecords("sales", user.id, mappedSales);
        } catch (cacheError) {
          console.warn("Could not save Sales cache:", cacheError);
        }
      } catch (loadError) {
        console.error("Failed to load sales:", loadError);

        if (mounted) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            const cachedSales = session?.user
              ? await getCachedRecords("sales", session.user.id)
              : [];

            if (cachedSales.length > 0) {
              setSales(cachedSales);
              setError("Unable to refresh. Showing your last saved sales.");
            } else {
              setError(
                loadError?.message || "Failed to load sales."
              );
            }
          } catch (cacheError) {
            console.error("Failed to load cached sales:", cacheError);
            setError(loadError?.message || "Failed to load sales.");
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSales();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!saleToOpenId || loading) return;

    setSearch("");
    setDateFilter("all");

    const target = filteredSales.find(
      (sale) => String(sale.id) === String(saleToOpenId)
    );

    if (!target) return;

    const elements = Array.from(
      document.querySelectorAll("[data-sale-id]")
    );
    const element = elements.find(
      (item) => item.dataset.saleId === String(saleToOpenId)
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

    onSaleOpenHandled?.();
  }, [
    saleToOpenId,
    loading,
    filteredSales,
    onSaleOpenHandled,
  ]);

  const handleDelete = async (sale) => {
    const confirmed =
      window.confirm(
        `Delete the ${sale.product} sale?`
      );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in to delete a sale."
        );
        return;
      }

      /*
       * Delete the sale through the Supabase
       * transaction RPC.
       *
       * The database function handles the
       * inventory restoration together with
       * deleting the sale.
       */
      const {
        error: deleteError,
      } = await supabase.rpc(
        "delete_sale",
        {
          p_sale_id: sale.id,
        }
      );

      if (deleteError) {
        throw deleteError;
      }

      setSales((current) =>
        current.filter(
          (item) => item.id !== sale.id
        )
      );
    } catch (deleteError) {
      console.error(
        "Failed to delete sale:",
        deleteError
      );

      setError(
        deleteError?.message ||
          "Failed to delete sale."
      );
    }
  };

  const clearFilters = () => {
    setSearch("");
    setDateFilter("today");
    setCustomStart("");
    setCustomEnd("");
  };


  const handleDateFilterChange = (value) => {
    if (!isBusiness && (value === "all" || value === "30days")) {
      setHistoricalAccessOpen(true);
      return;
    }

    setDateFilter(value);
  };

  const handleReturnSale = async () => {
    if (!selectedSale) {
      return;
    }

    const quantity =
      returnQuantity === "" ? 0 : Number(returnQuantity);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > Number(
        selectedSale.remainingQuantity ??
          selectedSale.quantity ??
          0
      )
    ) {
      setError("Enter a valid return quantity.");
      return;
    }

    if (refundMethod === "transfer" && !selectedRefundDebitId) {
      setError("Select the existing completed debit used to refund the customer.");
      return;
    }

    const chosenDebit = refundMethod === "transfer"
      ? eligibleRefundDebits.find((item) => item.id === selectedRefundDebitId)
      : null;

    if (refundMethod === "transfer" && !chosenDebit) {
      setError("That debit is no longer available. Reload the debit list and select another.");
      return;
    }

    if (
      refundMethod === "transfer" &&
      Number(chosenDebit.amount).toFixed(2) !== estimatedRefund.toFixed(2)
    ) {
      setError("The selected debit amount must exactly match the calculated refund.");
      return;
    }

    setError("");

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in to process a return."
        );
        return;
      }

      const { error: returnError } =
        await supabase.rpc(
          "return_uptrend_sale",
          {
            p_sale_id: selectedSale.id,
            p_quantity: quantity,
            p_refund_method: refundMethod,
            p_reason:
              returnReason.trim() || null,
            p_finance_transaction_id:
              refundMethod === "transfer" ? selectedRefundDebitId : null,
          }
        );

      if (returnError) {
        throw returnError;
      }

      await logAudit({
        action: "sale_refunded",
        category: "sales",
        description: `Refunded ${quantity} unit(s) of ${selectedSale.productName || selectedSale.product}`,
        entityType: "sale",
        entityId: selectedSale.id,
        amount: estimatedRefund,
        currency: "NGN",
        details: {
          saleDate: selectedSale.date,
          productId: selectedSale.productId,
          productName: selectedSale.productName || selectedSale.product,
          originalQuantity: selectedSale.quantity,
          returnQuantity: quantity,
          refundAmount: estimatedRefund,
          refundMethod,
          reason: returnReason.trim() || null,
          financeTransactionId:
            refundMethod === "transfer" ? selectedRefundDebitId : null,
        },
      });

      setShowReturnPanel(false);
      setSelectedSale(null);
      setReturnQuantity(1);
      setRefundMethod("cash");
      setReturnReason("");
      setSelectedRefundDebitId("");
      setEligibleRefundDebits([]);
      setRefundDebitsError("");

      const { data: updatedReturns, error: updatedReturnsError } =
        await supabase
          .from("uptrend_sale_returns")
          .select("quantity, refund_amount")
          .eq("sale_id", selectedSale.id)
          .eq("user_id", user.id);

      if (updatedReturnsError) {
        throw updatedReturnsError;
      }

      const returnedQuantity = (updatedReturns || []).reduce(
        (sum, row) => sum + Number(row.quantity || 0),
        0
      );

      const totalRefunded = (updatedReturns || []).reduce(
        (sum, row) => sum + Number(row.refund_amount || 0),
        0
      );

      setSales((current) =>
        current.map((sale) =>
          sale.id === selectedSale.id
            ? {
                ...sale,
                returnedQuantity,
                totalRefunded,
                remainingQuantity: Math.max(
                  Number(sale.quantity || 0) - returnedQuantity,
                  0
                ),
              }
            : sale
        )
      );

      setError("");

    } catch (returnError) {
      console.error(
        "Failed to process sale return:",
        returnError
      );

      setError(
        returnError?.message ||
          "Failed to process the sale return."
      );
    }
  };

  if (loading) {
    return (
      <div className="sales-page">
        <div className="sales-center-card premium-card">
          <div className="sales-center-empty">
            <div>↗</div>
            <strong>Loading sales...</strong>
            <span>
              Fetching your sales records.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sales-page">
      <div className="sales-page-top">
        <div>
          <div className="mini-label">
            TRANSACTION CENTER
          </div>

          <h2>Sales</h2>

          <p>
            Search, review and manage every
            recorded sale.
          </p>
        </div>
      </div>

      {error && (
        <div className="sales-error-message">
          {error}
        </div>
      )}

      <section className="sales-overview">
        <div className="sales-overview-card premium-card">
          <span>FILTERED SALES</span>

          <strong>
            {formatMoney(
              totals.totalSales
            )}
          </strong>

          <small>
            Total sales value
          </small>
        </div>

        <div className="sales-overview-card premium-card">
          <span>GROSS PROFIT</span>

          <strong className="record-profit">
            +
            {formatMoney(
              totals.grossProfit
            )}
          </strong>

          <small>
            Before expenses
          </small>
        </div>

        <div className="sales-overview-card premium-card">
          <span>UNITS SOLD</span>

          <strong>
            {totals.quantity}
          </strong>

          <small>
            Total quantity
          </small>
        </div>

        <div className="sales-overview-card premium-card">
          <span>TRANSACTIONS</span>

          <strong>
            {totals.transactions}
          </strong>

          <small>
            Matching records
          </small>
        </div>
      </section>

      <section className="sales-filter-card premium-card">
        <div className="sales-search">
          <span>⌕</span>

          <input
            type="search"
            placeholder="Search product..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        <div className="sales-filter-buttons">
          {[
            ["all", "All"],
            ["today", "Today"],
            ["7days", "7 Days"],
            ["30days", "30 Days"],
            ["custom", "Custom"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={
                dateFilter === value
                  ? "active"
                  : ""
              }
              onClick={() =>
                handleDateFilterChange(value)
              }
            >
              {label}
            </button>
          ))}
        </div>

        {dateFilter === "custom" && (
          <div className="custom-date-filter">
            <label>
              <span>From</span>

              <input
                type="date"
                value={customStart}
                onChange={(event) => {
                  const value = event.target.value;

                  if (!isBusiness && value && value < freeHistoryCutoff) {
                    setHistoricalAccessOpen(true);
                    return;
                  }

                  setCustomStart(value);
                }}
              />
            </label>

            <label>
              <span>To</span>

              <input
                type="date"
                value={customEnd}
                onChange={(event) => {
                  const value = event.target.value;

                  if (!isBusiness && value && value < freeHistoryCutoff) {
                    setHistoricalAccessOpen(true);
                    return;
                  }

                  setCustomEnd(value);
                }}
              />
            </label>
          </div>
        )}

        {(search ||
          dateFilter !== "all" ||
          customStart ||
          customEnd) && (
          <button
            className="clear-sales-filter"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </section>

      <SalesInsights
        sales={sales}
        dateFilter={dateFilter}
        customStart={customStart}
        customEnd={customEnd}
      />

      <section className="sales-center-card premium-card">
        <div className="panel-heading">
          <div>
            <div className="mini-label">
              SALES LEDGER
            </div>

            <h2>Transactions</h2>
          </div>

          <span className="sales-count">
            {filteredSales.length} result
            {filteredSales.length === 1
              ? ""
              : "s"}
          </span>
        </div>

        {filteredSales.length === 0 ? (
          <div className="sales-center-empty">
            <div>↗</div>

            <strong>
              No matching sales
            </strong>

            <span>
              Try changing your search or
              date filters.
            </span>
          </div>
        ) : (
          <>
            <div className="sales-table-wrap">
              <table className="sales-center-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Sales</th>
                    <th>Gross Profit</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.map(
                    (sale) => (
                      <tr
                        key={sale.id}
                        data-sale-id={sale.id}
                        className={
                          sale.debtStatus === "outstanding"
                            ? "sales-debt-outstanding"
                            : sale.debtStatus === "paid"
                            ? "sales-debt-paid"
                            : ""
                        }
                      >
                        <td>{sale.date}</td>

                        <td>
                          <div className="sales-product-cell">
                            <strong>
                              {sale.product}
                            </strong>

                            {Number(sale.remainingQuantity ?? sale.quantity) === 0 && (
                              <span className="sales-fully-returned">Returned</span>
                            )}

                            {(sale.paymentMethod === "transfer" ||
                              sale.financeTransactionId) && (
                              <span
                                className="sales-linked-icon"
                                title="Linked to bank transfer"
                                aria-label="Linked to bank transfer"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M8.5 12.5l7-7a3 3 0 014.24 4.24l-7 7a3 3 0 01-4.24 0 3 3 0 010-4.24l5.5-5.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M15.5 11.5l-7 7a3 3 0 01-4.24 0 3 3 0 010-4.24l7-7a3 3 0 010 4.24l5.5-5.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <strong>{sale.quantity}</strong>
                          {Number(sale.returnedQuantity || 0) > 0 && (
                            <div className="sales-returned-indicator">
                              <span>
                                {sale.returnedQuantity} returned
                              </span>
                              <small>
                                {sale.remainingQuantity} remaining
                              </small>
                            </div>
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            sale.totalCost
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            sale.totalSelling
                          )}
                        </td>

                        <td>
                          <strong
                            className={
                              Number(
                                sale.grossProfit
                              ) < 0
                                ? "record-loss"
                                : "record-profit"
                            }
                          >
                            {Number(
                              sale.grossProfit
                            ) < 0
                              ? "-"
                              : "+"}

                            {formatMoney(
                              Math.abs(
                                Number(
                                  sale.grossProfit
                                )
                              )
                            )}
                          </strong>
                        </td>

                        <td>
                          <div className="sales-center-actions">
                            <button
                              className="sales-view-button"
                              onClick={() =>
                                setSelectedSale(sale)
                              }
                            >
                              View
                            </button>

                            <button
                              className="sales-edit-button"
                              onClick={() =>
                                onEditSale(
                                  sale
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="sales-delete-button"
                              onClick={() =>
                                handleDelete(
                                  sale
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

            <div className="sales-mobile-list">
              {filteredSales.map(
                (sale) => (
                  <article
                    className={`sales-mobile-card ${
                      sale.debtStatus === "outstanding"
                        ? "sales-debt-outstanding"
                        : sale.debtStatus === "paid"
                        ? "sales-debt-paid"
                        : ""
                    }`}
                    key={sale.id}
                    data-sale-id={sale.id}
                  >
                    <div className="sales-mobile-top">
                      <div className="sales-product-cell">
                        <div>
                          <strong>
                            {sale.product}
                          </strong>

                          {Number(sale.remainingQuantity ?? sale.quantity) === 0 && (
                            <span className="sales-fully-returned">Returned</span>
                          )}

                          {(sale.paymentMethod === "transfer" ||
                            sale.financeTransactionId) && (
                            <span
                              className="sales-linked-icon"
                              title="Linked to bank transfer"
                              aria-label="Linked to bank transfer"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M8.5 12.5l7-7a3 3 0 014.24 4.24l-7 7a3 3 0 01-4.24 0 3 3 0 010-4.24l5.5-5.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M15.5 11.5l-7 7a3 3 0 01-4.24-4.24l7-7a3 3 0 01-4.24 0 3 3 0 010-4.24l5.5-5.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}

                          <span>
                            {sale.date}
                          </span>
                        </div>
                      </div>

                      <strong className="record-profit">
                        +
                        {formatMoney(
                          sale.grossProfit
                        )}
                      </strong>
                    </div>

                    <div className="sales-mobile-details">
                      <div>
                        <span>Quantity</span>

                        <strong>
                          {sale.remainingQuantity ?? sale.quantity}
                        </strong>
                        {Number(sale.returnedQuantity || 0) > 0 && (
                          <small className="sales-returned-indicator">
                            {sale.returnedQuantity} returned
                          </small>
                        )}
                      </div>

                      <div>
                        <span>Sales</span>

                        <strong>
                          {formatMoney(
                            sale.totalSelling
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Cost</span>

                        <strong>
                          {formatMoney(
                            sale.totalCost
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="sales-mobile-actions">
                      <button
                        className="sales-view-button"
                        onClick={() =>
                          setSelectedSale(sale)
                        }
                      >
                        View
                      </button>

                      <button
                        onClick={() =>
                          onEditSale(
                            sale
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="sales-delete-button"
                        onClick={() =>
                          handleDelete(
                            sale
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </>
        )}
      </section>

      <SalesProductPerformance
        sales={sales}
        dateFilter={dateFilter}
        customStart={customStart}
        customEnd={customEnd}
      />
      </div>

      {selectedSale && (
    <div
      className="sales-modal-overlay"
      onClick={() => {
              setSelectedSale(null);
              setShowReturnPanel(false);
            }}
    >
      <div
        className="sales-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sales-modal-header">
          <div>
            <h2>Sale Details</h2>
            <p>Complete information for this sale</p>
          </div>

          <button
            className="sales-modal-close"
            onClick={() => {
              setSelectedSale(null);
              setShowReturnPanel(false);
            }}
          >
            ×
          </button>
        </div>

        <div className="sales-modal-body">
          <div className="sales-receipt-print">
            <div className="sales-receipt-brand">
              <strong>UpTrend</strong>
              <span>Sales Receipt</span>
            </div>

            <div className="sales-receipt-divider"></div>

            <div className="sales-receipt-row">
              <span>Date</span>
              <strong>{selectedSale.date || "—"}</strong>
            </div>

            <div className="sales-receipt-row">
              <span>Product</span>
              <strong>{selectedSale.productName || "—"}</strong>
            </div>

            <div className="sales-receipt-row">
              <span>Quantity</span>
              <strong>{selectedSale.quantity || 0}</strong>
            </div>

            <div className="sales-receipt-row">
              <span>Selling Price</span>
              <strong>
                {formatMoney(selectedSale.sellingPrice)}
              </strong>
            </div>

            <div className="sales-receipt-row">
              <span>Total</span>
              <strong>
                {formatMoney(selectedSale.totalSelling)}
              </strong>
            </div>

            <div className="sales-receipt-row">
              <span>Payment</span>
              <strong>
                {selectedSale.paymentMethod || "Cash"}
              </strong>
            </div>

            {(selectedSale.returnedQuantity || 0) > 0 && (
              <>
                <div className="sales-receipt-divider"></div>

                <div className="sales-receipt-row">
                  <span>Returned</span>
                  <strong>
                    {selectedSale.returnedQuantity}
                  </strong>
                </div>

                <div className="sales-receipt-row">
                  <span>Total Refunded</span>
                  <strong>
                    {formatMoney(
                      selectedSale.totalRefunded
                    )}
                  </strong>
                </div>
              </>
            )}

            <div className="sales-receipt-divider"></div>

            <div className="sales-receipt-total">
              <span>Total Sales</span>
              <strong>
                {formatMoney(selectedSale.totalSelling)}
              </strong>
            </div>

            <p className="sales-receipt-footer">
              Thank you for your business.
            </p>
          </div>

          <div className="sales-detail-grid">
            <div className="sales-detail-item">
              <span>Date</span>
              <strong>{selectedSale.date || "—"}</strong>
            </div>

            <div className="sales-detail-item">
              <span>Product</span>
              <strong>{selectedSale.productName || "—"}</strong>
            </div>

            <div className="sales-detail-item">
              <span>Quantity</span>
              <strong>{selectedSale.quantity}</strong>
            </div>

            <div className="sales-detail-item">
              <span>Cost Price</span>
              <strong>
                ₦{Number(selectedSale.costPrice || 0).toLocaleString()}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Selling Price</span>
              <strong>
                ₦{Number(selectedSale.sellingPrice || 0).toLocaleString()}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Total Sales</span>
              <strong>
                ₦{Number(selectedSale.totalSelling || 0).toLocaleString()}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Gross Profit</span>
              <strong>
                ₦{Number(selectedSale.grossProfit || 0).toLocaleString()}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Payment Method</span>
              <strong>
                {selectedSale.paymentMethod || "Cash"}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Returned</span>
              <strong>
                {selectedSale.returnedQuantity || 0} of{" "}
                {selectedSale.quantity || 0}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Remaining</span>
              <strong>
                {selectedSale.remainingQuantity ??
                  selectedSale.quantity ??
                  0}
              </strong>
            </div>

            <div className="sales-detail-item">
              <span>Total Refunded</span>
              <strong>
                {formatMoney(
                  selectedSale.totalRefunded || 0
                )}
              </strong>
            </div>

            {selectedSale.debt && (
              <>
                <div className="sales-detail-item sales-debt-detail">
                  <span>Original Debt</span>
                  <strong>{formatMoney(selectedSale.debtOriginal)}</strong>
                </div>

                <div className="sales-detail-item sales-debt-detail">
                  <span>Amount Paid</span>
                  <strong>{formatMoney(selectedSale.debtPaid)}</strong>
                </div>

                <div className="sales-detail-item sales-debt-detail">
                  <span>Remaining Debt</span>
                  <strong>{formatMoney(selectedSale.debtBalance)}</strong>
                </div>

                <div className={`sales-detail-item sales-debt-detail ${
                  selectedSale.debtStatus === "paid"
                    ? "sales-debt-status-paid"
                    : "sales-debt-status-outstanding"
                }`}>
                  <span>Debt Status</span>
                  <strong>
                    {selectedSale.debtStatus === "paid"
                      ? "Debt paid"
                      : "Debt outstanding"}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>

        {showReturnPanel && (
          <div className="sales-return-panel">
            <div className="sales-return-panel-header">
              <div>
                <span>RETURN / REFUND</span>
                <strong>Return items from this sale</strong>
              </div>
            </div>

            <div className="sales-return-grid">
              <label>
                <span>Quantity to return</span>
                <input
                  type="number"
                  min="1"
                  max={selectedSale.remainingQuantity ?? selectedSale.quantity}
                  value={returnQuantity}
                  onChange={(event) =>
                    setReturnQuantity(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Refund method</span>
                <select
                  value={refundMethod}
                  onChange={(event) =>
                    setRefundMethod(event.target.value)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              {refundMethod === "transfer" && (
                <label className="sales-return-reason">
                  <span>Choose existing transfer debit</span>
                  {refundDebitsLoading ? (
                    <small>Loading completed debits...</small>
                  ) : refundDebitsError ? (
                    <small>{refundDebitsError}</small>
                  ) : (
                    <select
                      value={selectedRefundDebitId}
                      onChange={(event) =>
                        setSelectedRefundDebitId(event.target.value)
                      }
                    >
                      <option value="">Select a matching debit</option>
                      {eligibleRefundDebits
                        .filter((debit) =>
                          Number(debit.amount).toFixed(2) === estimatedRefund.toFixed(2)
                        )
                        .map((debit) => (
                          <option key={debit.id} value={debit.id}>
                            {formatMoney(debit.amount)} · {debit.category || "Debit"} · {new Date(debit.created_at).toLocaleString()}
                            {debit.description ? ` · ${debit.description}` : ""}
                          </option>
                        ))}
                    </select>
                  )}
                  {!refundDebitsLoading &&
                    !refundDebitsError &&
                    eligibleRefundDebits.filter((debit) =>
                      Number(debit.amount).toFixed(2) === estimatedRefund.toFixed(2)
                    ).length === 0 && (
                      <small>No unused completed debit matches this refund amount.</small>
                    )}
                </label>
              )}

              <label className="sales-return-reason">
                <span>Reason (optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Customer returned item"
                  value={returnReason}
                  onChange={(event) =>
                    setReturnReason(event.target.value)
                  }
                />
              </label>
            </div>

            <div className="sales-return-summary">
              <span>Estimated refund</span>
              <strong>
                {formatMoney(estimatedRefund)}
              </strong>
            </div>

            <div className="sales-return-actions">
              <button
                type="button"
                className="sales-modal-secondary"
                onClick={() => setShowReturnPanel(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="sales-modal-primary"
                onClick={handleReturnSale}
                disabled={
                  refundMethod === "transfer" &&
                  (
                    refundDebitsLoading ||
                    !selectedRefundDebitId ||
                    !eligibleRefundDebits.some((debit) =>
                      debit.id === selectedRefundDebitId &&
                      Number(debit.amount).toFixed(2) === estimatedRefund.toFixed(2)
                    )
                  )
                }
              >
                Confirm Return
              </button>
            </div>
          </div>
        )}

        <div className="sales-modal-footer">
          <button
            className="sales-modal-secondary"
            onClick={() => {
              setSelectedSale(null);
              setShowReturnPanel(false);
            }}
          >
            Close
          </button>

          {Number(
            selectedSale.remainingQuantity ??
              selectedSale.quantity ??
              0
          ) > 0 ? (
            <button
              className="sales-modal-secondary"
              onClick={() => {
                setShowReturnPanel((current) => !current);
                setReturnQuantity(1);
                setRefundMethod("cash");
                setReturnReason("");
              }}
            >
              Return / Refund
            </button>
          ) : (
            <span className="sales-fully-returned">
              Fully Returned
            </span>
          )}

          <button
            className="sales-modal-secondary"
            onClick={() => {
              window.print();
            }}
          >
            Print Receipt
          </button>

          <button
            className="sales-modal-primary"
            onClick={() => {
              setSelectedSale(null);
              setShowReturnPanel(false);
              onEditSale(selectedSale);
            }}
          >
            Edit Sale
          </button>
        </div>
      </div>
    </div>
      )}
    {historicalAccessOpen && !isBusiness && (
      <div
        className="historical-access-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-historical-access-title"
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

          <h2 id="sales-historical-access-title">
            Unlock your sales history
          </h2>

          <p>
            Free accounts can access sales from today and the
            previous 7 days. Upgrade to UpTrend Business to
            access older sales records.
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

    </>
  );
}

export default Sales;