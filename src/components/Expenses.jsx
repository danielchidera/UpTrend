import { useEffect, useMemo, useState } from "react";
import "./Expenses.css";
import { supabase } from "../lib/supabase";

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

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

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

  useEffect(() => {
    let mounted = true;

    const loadExpenses = async () => {
      setLoadingExpenses(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            setExpenses([]);
            setError(
              "Please sign in to manage your expenses."
            );
          }

          return;
        }

        const {
          data,
          error: fetchError,
        } = await supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (fetchError) {
          throw fetchError;
        }

        if (mounted) {
          setExpenses(
            (data || []).map((expense) => ({
              id: expense.id,
              date: expense.expense_date,
              name: expense.name,
              category: expense.category || "General",
              amount: Number(expense.amount || 0),
              note: expense.note || "",
              createdAt: expense.created_at,
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

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSaved(false);

    const wasEditing = Boolean(editingId);

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
              amount: updatedExpense.amount,
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

      const expensesToInsert =
        expenseForms.map((form) => ({
          user_id: user.id,
          name: form.name.trim(),
          amount: Number(form.amount),
          category: form.category,
          note: form.note.trim(),
          expense_date: form.date,
        }));

      const {
        data: insertedExpenses,
        error: insertError,
      } = await supabase
        .from("expenses")
        .insert(expensesToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      const mappedExpenses =
        (insertedExpenses || []).map(
          (expense) => ({
            id: expense.id,
            date: expense.expense_date,
            name: expense.name,
            category:
              expense.category || "General",
            amount: Number(
              expense.amount || 0
            ),
            note: expense.note || "",
            createdAt:
              expense.created_at,
          })
        );

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
        "We couldn't save the expenses. Please try again."
      );

      return;
    }

    setExpenseForms([
      createEmptyExpense(batchDate),
    ]);

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
        await supabase
          .from("expenses")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setExpenses((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );
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
              {totals.count}
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
                        Expense {index + 1}
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
                          onChange={(event) =>
                            updateExpenseField(
                              index,
                              "date",
                              event.target.value
                            )
                          }
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
                  : `${expenseForms.length} expense${
                      expenseForms.length ===
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
                {batchTotals.count} expense
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

      <section className="expenses-list-card premium-card">
        <div className="panel-heading">
          <div>
            <div className="mini-label">
              EXPENSE HISTORY
            </div>

            <h2>Recorded expenses</h2>
          </div>

          <span className="expenses-count">
            {expenses.length} record
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
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {expenses.map(
                  (expense) => (
                    <tr key={expense.id}>
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
    </div>
  );
}

export default Expenses;