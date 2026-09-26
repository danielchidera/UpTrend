import { useEffect, useMemo, useState } from "react";
import "./CreditDebt.css";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateKey = (date) => {
  if (!date) return "";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  return value.toISOString().slice(0, 10);
};

const todayKey = () =>
  new Date().toISOString().slice(0, 10);

const getInitialForm = () => ({
  customerId: "",
  description: "",
  originalAmount: "",
  dueDate: "",
  notes: "",
});

function CreditDebt({
  subscription,
  onUpgrade,
}) {
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] =
    useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] =
    useState(false);
  const [showDetails, setShowDetails] =
    useState(false);

  const [editingDebt, setEditingDebt] =
    useState(null);

  const [selectedDebtId, setSelectedDebtId] =
    useState(null);

  const [form, setForm] =
    useState(getInitialForm());

  const [paymentForm, setPaymentForm] =
    useState({
      amount: "",
      paymentDate: todayKey(),
      paymentMethod: "",
      reference: "",
      notes: "",
    });

  const loadData = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [
        debtsResult,
        paymentsResult,
        customersResult,
      ] = await Promise.all([
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
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("uptrend_customers")
          .select(
            "id, name, phone, email"
          )
          .eq("user_id", user.id)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (debtsResult.error) {
        throw debtsResult.error;
      }

      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      setDebts(debtsResult.data || []);
      setPayments(paymentsResult.data || []);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error(
        "Failed to load Credit & Debt:",
        error
      );

      alert(
        error.message ||
          "Unable to load Credit & Debt."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /*
   * Payment totals are calculated from the ledger.
   * The amount_paid column is never trusted as the
   * source of truth for the current balance.
   */
  const paymentTotals = useMemo(() => {
    const totals = {};

    payments.forEach((payment) => {
      if (!totals[payment.debt_id]) {
        totals[payment.debt_id] = 0;
      }

      totals[payment.debt_id] += Number(
        payment.amount || 0
      );
    });

    return totals;
  }, [payments]);

  const customerMap = useMemo(() => {
    return customers.reduce((map, customer) => {
      map[customer.id] = customer;
      return map;
    }, {});
  }, [customers]);

  const enrichedDebts = useMemo(() => {
    const today = todayKey();

    return debts.map((debt) => {
      const originalAmount = Number(
        debt.original_amount || 0
      );

      const paid = Math.min(
        originalAmount,
        Number(paymentTotals[debt.id] || 0)
      );

      const balance = Math.max(
        originalAmount - paid,
        0
      );

      let status = debt.status;

      if (status !== "cancelled") {
        if (
          balance <= 0 &&
          originalAmount > 0
        ) {
          status = "paid";
        } else if (
          debt.due_date &&
          debt.due_date < today
        ) {
          status = "overdue";
        } else if (paid > 0) {
          status = "partially_paid";
        } else {
          status = "pending";
        }
      }

      return {
        ...debt,
        customer:
          customerMap[debt.customer_id] ||
          null,
        originalAmount,
        paid,
        balance,
        calculatedStatus: status,
      };
    });
  }, [
    debts,
    paymentTotals,
    customerMap,
  ]);

  const selectedDebt = useMemo(
    () =>
      enrichedDebts.find(
        (debt) =>
          debt.id === selectedDebtId
      ) || null,
    [enrichedDebts, selectedDebtId]
  );

  const selectedPayments = useMemo(() => {
    if (!selectedDebt) return [];

    return payments
      .filter(
        (payment) =>
          payment.debt_id ===
          selectedDebt.id
      )
      .sort((a, b) => {
        const dateA = dateKey(
          a.payment_date
        );

        const dateB = dateKey(
          b.payment_date
        );

        return dateB.localeCompare(dateA);
      });
  }, [payments, selectedDebt]);

  const overview = useMemo(() => {
    const active = enrichedDebts.filter(
      (debt) =>
        debt.calculatedStatus !==
          "paid" &&
        debt.calculatedStatus !==
          "cancelled"
    );

    const outstanding = active.reduce(
      (sum, debt) =>
        sum + Number(debt.balance || 0),
      0
    );

    const overdue = active
      .filter(
        (debt) =>
          debt.calculatedStatus ===
          "overdue"
      )
      .reduce(
        (sum, debt) =>
          sum + Number(debt.balance || 0),
        0
      );

    const collected = enrichedDebts.reduce(
      (sum, debt) =>
        sum + Number(debt.paid || 0),
      0
    );

    return {
      outstanding,
      overdue,
      collected,
      activeCount: active.length,
    };
  }, [enrichedDebts]);

  const openCreateForm = () => {
    setEditingDebt(null);
    setForm(getInitialForm());
    setShowForm(true);
  };

  const openEditForm = (debt) => {
    setEditingDebt(debt);

    setForm({
      customerId:
        debt.customer_id || "",
      description:
        debt.description || "",
      originalAmount:
        debt.original_amount || "",
      dueDate:
        debt.due_date || "",
      notes:
        debt.notes || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingDebt(null);
    setForm(getInitialForm());
  };

  const saveDebt = async (event) => {
    event.preventDefault();

    const amount = Number(
      form.originalAmount
    );

    if (!form.description.trim()) {
      alert(
        "Enter a debt description."
      );
      return;
    }

    if (!amount || amount <= 0) {
      alert(
        "Enter a valid debt amount."
      );
      return;
    }

    if (
      form.dueDate &&
      form.dueDate < todayKey()
    ) {
      const proceed = window.confirm(
        "This due date is already in the past. Continue?"
      );

      if (!proceed) return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const payload = {
        user_id: user.id,
        customer_id:
          form.customerId || null,
        description:
          form.description.trim(),
        original_amount: amount,
        due_date:
          form.dueDate || null,
        notes:
          form.notes.trim() || null,
      };

      let result;

      if (editingDebt) {
        const alreadyPaid = Number(
          paymentTotals[
            editingDebt.id
          ] || 0
        );

        if (amount < alreadyPaid) {
          throw new Error(
            `The debt amount cannot be less than the ₦${alreadyPaid.toLocaleString(
              "en-NG",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )} already collected.`
          );
        }

        result = await supabase
          .from(
            "uptrend_credit_debts"
          )
          .update(payload)
          .eq(
            "id",
            editingDebt.id
          );
      } else {
        result = await supabase
          .from(
            "uptrend_credit_debts"
          )
          .insert({
            ...payload,
            amount_paid: 0,
            status: "pending",
          });
      }

      if (result.error) {
        throw result.error;
      }

      closeForm();
      await loadData();
    } catch (error) {
      console.error(
        "Failed to save Credit & Debt:",
        error
      );

      alert(
        error.message ||
          "Unable to save the debt."
      );
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (debt) => {
    setSelectedDebtId(debt.id);
    setShowDetails(true);
  };

  const openPaymentForm = (debt) => {
    setSelectedDebtId(debt.id);

    setPaymentForm({
      amount: "",
      paymentDate: todayKey(),
      paymentMethod: "",
      reference: "",
      notes: "",
    });

    setShowPaymentForm(true);
  };

  const closePaymentForm = () => {
    if (paymentSaving) return;

    setShowPaymentForm(false);

    setPaymentForm({
      amount: "",
      paymentDate: todayKey(),
      paymentMethod: "",
      reference: "",
      notes: "",
    });
  };

  const savePayment = async (event) => {
    event.preventDefault();

    if (!selectedDebt) {
      alert("No credit record is selected.");
      return;
    }

    const amount = Number(paymentForm.amount);
    const balance = Number(selectedDebt.balance || 0);

    if (!amount || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > balance) {
      alert(
        `Payment cannot exceed the remaining balance of ${money(balance)}.`
      );
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Select the payment date.");
      return;
    }

    setPaymentSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      /*
       * 1. Record the payment in the payment ledger.
       */
      const { data: paymentData, error: paymentError } =
        await supabase
          .from("uptrend_credit_debt_payments")
          .insert({
            debt_id: selectedDebt.id,
            user_id: user.id,
            amount,
            payment_date: paymentForm.paymentDate,
            payment_method:
              paymentForm.paymentMethod.trim() || null,
            reference:
              paymentForm.reference.trim() || null,
            notes:
              paymentForm.notes.trim() || null,
          })
          .select()
          .single();

      if (paymentError) {
        throw paymentError;
      }

      /*
       * 2. Calculate the new balance from the existing
       *    ledger amount plus this new payment.
       */
      const newPaid =
        Number(selectedDebt.paid || 0) + amount;

      const newBalance = Math.max(
        Number(selectedDebt.originalAmount || 0) - newPaid,
        0
      );

      let newStatus = "partially_paid";

      if (newBalance <= 0) {
        newStatus = "paid";
      } else if (
        selectedDebt.due_date &&
        selectedDebt.due_date < todayKey()
      ) {
        newStatus = "overdue";
      }

      /*
       * 3. Keep the parent debt record synchronized.
       */
      const { error: debtUpdateError } =
        await supabase
          .from("uptrend_credit_debts")
          .update({
            amount_paid: newPaid,
            status: newStatus,
          })
          .eq("id", selectedDebt.id)
          .eq("user_id", user.id);

      if (debtUpdateError) {
        /*
         * The payment was already inserted. Do not silently
         * pretend the entire operation failed.
         */
        console.error(
          "Payment saved but debt update failed:",
          debtUpdateError
        );

        alert(
          `Payment was recorded, but the debt status could not be updated: ${debtUpdateError.message}`
        );

        await loadData();
        closePaymentForm();
        return;
      }

      /*
       * 4. Refresh everything from Supabase.
       */
      closePaymentForm();
      await loadData();

    } catch (error) {
      console.error(
        "Failed to save payment:",
        error
      );

      alert(
        error.message ||
          "Unable to record payment."
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const deleteDebt = async (debt) => {
    const confirmed =
      window.confirm(
        `Delete "${debt.description}"? This will also delete its payment history.`
      );

    if (!confirmed) return;

    try {
      const { error } =
        await supabase
          .from(
            "uptrend_credit_debts"
          )
          .delete()
          .eq("id", debt.id);

      if (error) throw error;

      if (
        selectedDebtId ===
        debt.id
      ) {
        setSelectedDebtId(null);
        setShowDetails(false);
      }

      await loadData();
    } catch (error) {
      console.error(
        "Failed to delete debt:",
        error
      );

      alert(
        error.message ||
          "Unable to delete the debt."
      );
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "partially_paid":
        return "Partially Paid";

      case "paid":
        return "Paid";

      case "overdue":
        return "Overdue";

      case "cancelled":
        return "Cancelled";

      default:
        return "Pending";
    }
  };


  return (
    <BusinessGate subscription={subscription} onUpgrade={onUpgrade}>
      <div className="inner-page credit-debt-page">
        <div className="credit-debt-header">
          <div>
            <span className="business-kicker">BUSINESS PLAN</span>
            <h1>Credit & Debt</h1>
            <p>Track customer debts, payments and outstanding balances.</p>
          </div>

          <button
            className="credit-primary-btn"
            onClick={openCreateForm}
          >
            + New Credit
          </button>
        </div>

        {loading ? (
          <div className="credit-loading">Loading credit records...</div>
        ) : (
          <>
            <div className="credit-overview-grid">
              <div className="credit-stat-card">
                <span>Total Outstanding</span>
                <strong>{money(overview.outstanding)}</strong>
              </div>

              <div className="credit-stat-card overdue">
                <span>Total Overdue</span>
                <strong>{money(overview.overdue)}</strong>
              </div>

              <div className="credit-stat-card collected">
                <span>Total Collected</span>
                <strong>{money(overview.collected)}</strong>
              </div>

              <div className="credit-stat-card">
                <span>Active Debts</span>
                <strong>{overview.activeCount}</strong>
              </div>
            </div>

            <section className="credit-ledger-card">
              <div className="credit-section-heading">
                <div>
                  <h2>Credit Ledger</h2>
                  <p>All customer credit and debt records.</p>
                </div>
                <span className="credit-count">
                  {enrichedDebts.length} record
                  {enrichedDebts.length === 1 ? "" : "s"}
                </span>
              </div>

              {enrichedDebts.length === 0 ? (
                <div className="credit-empty">
                  <div className="credit-empty-icon">₦</div>
                  <h3>No credit records yet</h3>
                  <p>
                    Create a credit record when a customer owes your
                    business money.
                  </p>
                  <button
                    className="credit-primary-btn"
                    onClick={openCreateForm}
                  >
                    + Create Credit
                  </button>
                </div>
              ) : (
                <div className="credit-table-wrap">
                  <table className="credit-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Description</th>
                        <th>Original</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {enrichedDebts.map((debt) => (
                        <tr key={debt.id}>
                          <td>
                            <button
                              className="credit-customer-link"
                              onClick={() => openDetails(debt)}
                            >
                              {debt.customer?.name || "No customer"}
                            </button>
                          </td>

                          <td>{debt.description}</td>

                          <td>{money(debt.originalAmount)}</td>

                          <td>{money(debt.paid)}</td>

                          <td className="credit-balance">
                            {money(debt.balance)}
                          </td>

                          <td>
                            {debt.due_date
                              ? new Date(
                                  `${debt.due_date}T00:00:00`
                                ).toLocaleDateString("en-NG")
                              : "—"}
                          </td>

                          <td>
                            <span
                              className={`credit-status credit-status-${debt.calculatedStatus}`}
                            >
                              {getStatusLabel(debt.calculatedStatus)}
                            </span>
                          </td>

                          <td>
                            <div className="credit-row-actions">
                              <button
                                className="credit-action-btn"
                                onClick={() => openDetails(debt)}
                              >
                                View
                              </button>

                              <button
                                className="credit-action-btn"
                                onClick={() => openEditForm(debt)}
                              >
                                Edit
                              </button>

                              {debt.balance > 0 &&
                                debt.calculatedStatus !== "cancelled" && (
                                  <button
                                    className="credit-pay-btn"
                                    onClick={() =>
                                      openPaymentForm(debt)
                                    }
                                  >
                                    Pay
                                  </button>
                                )}

                              <button
                                className="credit-delete-btn"
                                onClick={() => deleteDebt(debt)}
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
          </>
        )}

        {showForm && (
          <div
            className="credit-modal-backdrop"
            onClick={closeForm}
          >
            <div
              className="credit-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="credit-modal-header">
                <div>
                  <span className="business-kicker">
                    CREDIT RECORD
                  </span>
                  <h2>
                    {editingDebt ? "Edit Credit" : "New Credit"}
                  </h2>
                </div>

                <button
                  className="credit-close-btn"
                  onClick={closeForm}
                >
                  ×
                </button>
              </div>

              <form
                className="credit-form"
                onSubmit={saveDebt}
              >
                <label>
                  Customer
                  <select
                    value={form.customerId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerId: event.target.value,
                      }))
                    }
                  >
                    <option value="">No customer selected</option>
                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Description
                  <input
                    type="text"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="e.g. Goods supplied on credit"
                    required
                  />
                </label>

                <div className="credit-form-grid">
                  <label>
                    Original Amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.originalAmount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          originalAmount: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    Due Date
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label>
                  Notes
                  <textarea
                    rows="4"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional notes..."
                  />
                </label>

                <div className="credit-form-actions">
                  <button
                    type="button"
                    className="credit-secondary-btn"
                    onClick={closeForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="credit-primary-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingDebt
                      ? "Save Changes"
                      : "Create Credit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDetails && selectedDebt && (
          <div
            className="credit-modal-backdrop"
            onClick={() => setShowDetails(false)}
          >
            <div
              className="credit-modal credit-details-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="credit-modal-header">
                <div>
                  <span className="business-kicker">
                    CREDIT DETAILS
                  </span>
                  <h2>{selectedDebt.customer?.name || "No customer"}</h2>
                  <p>{selectedDebt.description}</p>
                </div>

                <button
                  className="credit-close-btn"
                  onClick={() => setShowDetails(false)}
                >
                  ×
                </button>
              </div>

              <div className="credit-detail-summary">
                <div>
                  <span>Original</span>
                  <strong>
                    {money(selectedDebt.originalAmount)}
                  </strong>
                </div>

                <div>
                  <span>Paid</span>
                  <strong>
                    {money(selectedDebt.paid)}
                  </strong>
                </div>

                <div>
                  <span>Balance</span>
                  <strong>
                    {money(selectedDebt.balance)}
                  </strong>
                </div>
              </div>

              <div className="credit-detail-info">
                <div>
                  <span>Status</span>
                  <strong>
                    {getStatusLabel(selectedDebt.calculatedStatus)}
                  </strong>
                </div>

                <div>
                  <span>Due Date</span>
                  <strong>
                    {selectedDebt.due_date
                      ? new Date(
                          `${selectedDebt.due_date}T00:00:00`
                        ).toLocaleDateString("en-NG")
                      : "No due date"}
                  </strong>
                </div>

                {selectedDebt.notes && (
                  <div className="credit-detail-notes">
                    <span>Notes</span>
                    <p>{selectedDebt.notes}</p>
                  </div>
                )}
              </div>

              <div className="credit-payment-history">
                <div className="credit-section-heading">
                  <div>
                    <h3>Payment History</h3>
                    <p>Recorded payments for this credit.</p>
                  </div>

                  {selectedDebt.balance > 0 &&
                    selectedDebt.calculatedStatus !== "cancelled" && (
                      <button
                        className="credit-pay-btn"
                        onClick={() =>
                          openPaymentForm(selectedDebt)
                        }
                      >
                        + Add Payment
                      </button>
                    )}
                </div>

                {selectedPayments.length === 0 ? (
                  <div className="credit-no-payments">
                    No payments recorded yet.
                  </div>
                ) : (
                  <div className="credit-payments-list">
                    {selectedPayments.map((payment) => (
                      <div
                        className="credit-payment-item"
                        key={payment.id}
                      >
                        <div>
                          <strong>
                            {money(payment.amount)}
                          </strong>
                          <span>
                            {new Date(
                              `${payment.payment_date}T00:00:00`
                            ).toLocaleDateString("en-NG")}
                          </span>
                        </div>

                        <div>
                          <span>
                            {payment.payment_method || "No method"}
                          </span>

                          {payment.reference && (
                            <small>
                              Ref: {payment.reference}
                            </small>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="credit-form-actions">
                <button
                  className="credit-secondary-btn"
                  onClick={() => openEditForm(selectedDebt)}
                >
                  Edit Credit
                </button>

                <button
                  className="credit-primary-btn"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showPaymentForm && selectedDebt && (
          <div
            className="credit-modal-backdrop"
            onClick={closePaymentForm}
          >
            <div
              className="credit-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="credit-modal-header">
                <div>
                  <span className="business-kicker">
                    PAYMENT
                  </span>
                  <h2>Add Payment</h2>
                  <p>
                    Balance remaining:{" "}
                    <strong>
                      {money(selectedDebt.balance)}
                    </strong>
                  </p>
                </div>

                <button
                  className="credit-close-btn"
                  onClick={closePaymentForm}
                >
                  ×
                </button>
              </div>

              <form
                className="credit-form"
                onSubmit={savePayment}
              >
                <label>
                  Payment Amount
                  <input
                    type="number"
                    min="0.01"
                    max={selectedDebt.balance}
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <div className="credit-form-grid">
                  <label>
                    Payment Date
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          paymentDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    Payment Method
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          paymentMethod: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select method</option>
                      <option value="Cash">Cash</option>
                      <option value="Transfer">Transfer</option>
                      <option value="POS">POS</option>
                      <option value="Bank">Bank</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>

                <label>
                  Reference
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Optional transaction reference"
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    rows="3"
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional payment notes..."
                  />
                </label>

                <div className="credit-form-actions">
                  <button
                    type="button"
                    className="credit-secondary-btn"
                    onClick={closePaymentForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="credit-primary-btn"
                    disabled={paymentSaving}
                  >
                    {paymentSaving
                      ? "Saving..."
                      : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </BusinessGate>
  );
}

export default CreditDebt;
