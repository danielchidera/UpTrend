import { useEffect, useMemo, useState } from "react";
import "./BusinessTargets.css";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";

const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const number = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  });

const dateKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const todayKey = () => dateKey(new Date());

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};

const getPeriodDates = (period) => {
  const today = todayKey();
  const date = new Date(`${today}T00:00:00`);

  if (period === "weekly") {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + mondayOffset);

    return {
      start: dateKey(date),
      end: addDays(today, 0),
    };
  }

  if (period === "monthly") {
    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );

    return {
      start: dateKey(start),
      end: today,
    };
  }

  if (period === "quarterly") {
    const quarterStartMonth =
      Math.floor(date.getMonth() / 3) * 3;

    const start = new Date(
      date.getFullYear(),
      quarterStartMonth,
      1
    );

    return {
      start: dateKey(start),
      end: today,
    };
  }

  if (period === "yearly") {
    const start = new Date(
      date.getFullYear(),
      0,
      1
    );

    return {
      start: dateKey(start),
      end: today,
    };
  }

  return {
    start: today,
    end: today,
  };
};

const percent = (actual, target) => {
  if (!target || target <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, (actual / target) * 100)
  );
};

const targetStatus = (actual, target) => {
  if (!target || target <= 0) {
    return {
      label: "Not set",
      className: "neutral",
    };
  }

  if (actual >= target) {
    return {
      label: "Target reached",
      className: "success",
    };
  }

  if (actual >= target * 0.75) {
    return {
      label: "On track",
      className: "warning",
    };
  }

  return {
    label: "Needs attention",
    className: "danger",
  };
};

function BusinessTargets({
  subscription,
  onUpgrade,
}) {
  const [targets, setTargets] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTarget, setSelectedTarget] =
    useState(null);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    periodType: "monthly",
    startDate: "",
    endDate: "",
    revenueTarget: "",
    grossProfitTarget: "",
    expenseLimit: "",
    unitsTarget: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [
        targetsResult,
        salesResult,
        expensesResult,
      ] = await Promise.all([
        supabase
          .from("uptrend_business_targets")
          .select("*")
          .eq("user_id", user.id)
          .order("start_date", {
            ascending: false,
          }),

        supabase
          .from("sales")
          .select("*")
          .eq("user_id", user.id)
          .order("sale_date", {
            ascending: true,
          }),

        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .order("expense_date", {
            ascending: true,
          }),
      ]);

      if (targetsResult.error) {
        throw targetsResult.error;
      }

      if (salesResult.error) {
        throw salesResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      setTargets(targetsResult.data || []);
      setSales(salesResult.data || []);
      setExpenses(expensesResult.data || []);
    } catch (error) {
      console.error(
        "Failed to load Business Targets:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTarget = useMemo(() => {
    if (!targets.length) return null;

    const today = todayKey();

    return (
      targets.find(
        (target) =>
          target.start_date <= today &&
          target.end_date >= today
      ) || targets[0]
    );
  }, [targets]);

  useEffect(() => {
    if (activeTarget) {
      setSelectedTarget(activeTarget.id);
    }
  }, [activeTarget]);

  const currentTarget =
    targets.find(
      (target) => target.id === selectedTarget
    ) || activeTarget;

  const performance = useMemo(() => {
    if (!currentTarget) {
      return {
        revenue: 0,
        productCost: 0,
        grossProfit: 0,
        expenses: 0,
        units: 0,
      };
    }

    const start = currentTarget.start_date;
    const end = currentTarget.end_date;

    const periodSales = sales.filter((sale) => {
      const date = dateKey(sale.sale_date);
      return date >= start && date <= end;
    });

    const periodExpenses = expenses.filter((expense) => {
      const date = dateKey(expense.expense_date);
      return date >= start && date <= end;
    });

    const revenue = periodSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total_selling || 0),
      0
    );

    const productCost = periodSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total_cost || 0),
      0
    );

    const grossProfit = periodSales.reduce(
      (sum, sale) =>
        sum + Number(sale.gross_profit || 0),
      0
    );

    const expenseTotal = periodExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount ??
            expense.total ??
            0
        ),
      0
    );

    const units = periodSales.reduce(
      (sum, sale) =>
        sum + Number(sale.quantity || 0),
      0
    );

    return {
      revenue,
      productCost,
      grossProfit,
      expenses: expenseTotal,
      units,
    };
  }, [
    currentTarget,
    sales,
    expenses,
  ]);

  const metrics = useMemo(() => {
    if (!currentTarget) return [];

    return [
      {
        key: "revenue",
        label: "Revenue",
        actual: performance.revenue,
        target: Number(
          currentTarget.revenue_target || 0
        ),
        format: money,
      },
      {
        key: "grossProfit",
        label: "Gross Profit",
        actual: performance.grossProfit,
        target: Number(
          currentTarget.gross_profit_target || 0
        ),
        format: money,
      },
      {
        key: "expenses",
        label: "Expenses",
        actual: performance.expenses,
        target: Number(
          currentTarget.expense_limit || 0
        ),
        format: money,
        inverse: true,
      },
      {
        key: "units",
        label: "Units Sold",
        actual: performance.units,
        target: Number(
          currentTarget.units_target || 0
        ),
        format: number,
      },
    ];
  }, [currentTarget, performance]);

  const openCreateForm = () => {
    const dates = getPeriodDates("monthly");

    setForm({
      periodType: "monthly",
      startDate: dates.start,
      endDate: dates.end,
      revenueTarget: "",
      grossProfitTarget: "",
      expenseLimit: "",
      unitsTarget: "",
      notes: "",
    });

    setShowForm(true);
  };

  const openEditForm = () => {
    if (!currentTarget) return;

    setForm({
      periodType:
        currentTarget.period_type,
      startDate:
        currentTarget.start_date,
      endDate:
        currentTarget.end_date,
      revenueTarget:
        currentTarget.revenue_target || "",
      grossProfitTarget:
        currentTarget.gross_profit_target || "",
      expenseLimit:
        currentTarget.expense_limit || "",
      unitsTarget:
        currentTarget.units_target || "",
      notes:
        currentTarget.notes || "",
    });

    setShowForm(true);
  };

  const handlePeriodChange = (value) => {
    if (value === "custom") {
      setForm((current) => ({
        ...current,
        periodType: value,
      }));
      return;
    }

    const dates = getPeriodDates(value);

    setForm((current) => ({
      ...current,
      periodType: value,
      startDate: dates.start,
      endDate: dates.end,
    }));
  };

  const saveTarget = async (event) => {
    event.preventDefault();

    if (!form.startDate || !form.endDate) {
      return;
    }

    if (form.endDate < form.startDate) {
      alert(
        "The target end date cannot be before the start date."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) return;

      const payload = {
        user_id: user.id,
        period_type: form.periodType,
        start_date: form.startDate,
        end_date: form.endDate,
        revenue_target:
          Number(form.revenueTarget) || 0,
        gross_profit_target:
          Number(form.grossProfitTarget) || 0,
        expense_limit:
          Number(form.expenseLimit) || 0,
        units_target:
          Number(form.unitsTarget) || 0,
        notes: form.notes.trim() || null,
      };

      let result;

      if (currentTarget && showForm) {
        result = await supabase
          .from("uptrend_business_targets")
          .update(payload)
          .eq("id", currentTarget.id);
      } else {
        result = await supabase
          .from("uptrend_business_targets")
          .insert(payload);
      }

      if (result.error) {
        throw result.error;
      }

      setShowForm(false);

      await loadData();
    } catch (error) {
      console.error(
        "Failed to save Business Target:",
        error
      );

      alert(
        error.message ||
          "Unable to save Business Target."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTarget = async () => {
    if (!currentTarget) return;

    const confirmed = window.confirm(
      "Delete this Business Target?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("uptrend_business_targets")
        .delete()
        .eq("id", currentTarget.id);

      if (error) throw error;

      setSelectedTarget(null);

      await loadData();
    } catch (error) {
      console.error(
        "Failed to delete Business Target:",
        error
      );

      alert(
        error.message ||
          "Unable to delete Business Target."
      );
    }
  };

  return (
    <BusinessGate
      subscription={subscription}
      onUpgrade={onUpgrade}
      title="Business Targets"
      description="Set measurable targets and track your business performance against them."
    >
      <div className="inner-page business-targets-page">
        <header className="targets-header">
          <div>
            <span className="targets-eyebrow">
              BUSINESS PERFORMANCE
            </span>

            <h1>Business Targets</h1>

            <p>
              Set targets for revenue, gross profit,
              expenses and units sold, then track
              real performance from your business data.
            </p>
          </div>

          <div className="targets-header-actions">
            {currentTarget && (
              <button
                type="button"
                className="targets-secondary-button"
                onClick={openEditForm}
              >
                Edit Target
              </button>
            )}

            <button
              type="button"
              className="targets-primary-button"
              onClick={openCreateForm}
            >
              + New Target
            </button>
          </div>
        </header>

        {loading ? (
          <div className="targets-loading">
            Loading Business Targets...
          </div>
        ) : (
          <>
            {targets.length > 0 && (
              <div className="targets-selector-row">
                <div>
                  <span className="targets-field-label">
                    TARGET PERIOD
                  </span>

                  <select
                    value={selectedTarget || ""}
                    onChange={(event) =>
                      setSelectedTarget(
                        event.target.value
                      )
                    }
                  >
                    {targets.map((target) => (
                      <option
                        key={target.id}
                        value={target.id}
                      >
                        {target.start_date} →{" "}
                        {target.end_date}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="target-period-badge">
                  {currentTarget?.period_type ||
                    "period"}
                </div>
              </div>
            )}

            {!currentTarget ? (
              <section className="targets-empty">
                <div className="targets-empty-icon">
                  ◎
                </div>

                <h2>No Business Target Yet</h2>

                <p>
                  Create your first target to start
                  measuring your business performance.
                </p>

                <button
                  type="button"
                  className="targets-primary-button"
                  onClick={openCreateForm}
                >
                  Create Your First Target
                </button>
              </section>
            ) : (
              <>
                <section className="target-period-card">
                  <div>
                    <span>
                      CURRENT TARGET PERIOD
                    </span>

                    <strong>
                      {currentTarget.start_date}
                      {" → "}
                      {currentTarget.end_date}
                    </strong>
                  </div>

                  <div className="target-period-status">
                    {metrics.some(
                      (metric) =>
                        metric.target > 0 &&
                        percent(
                          metric.actual,
                          metric.target
                        ) >= 100
                    )
                      ? "Progress underway"
                      : "Tracking performance"}
                  </div>
                </section>

                <section className="target-metrics-grid">
                  {metrics.map((metric) => {
                    const progress = percent(
                      metric.actual,
                      metric.target
                    );

                    const status = targetStatus(
                      metric.actual,
                      metric.target
                    );

                    const remaining = Math.max(
                      metric.target -
                        metric.actual,
                      0
                    );

                    return (
                      <article
                        key={metric.key}
                        className={`target-card ${status.className}`}
                      >
                        <div className="target-card-top">
                          <span>
                            {metric.label}
                          </span>

                          <span
                            className={`target-status ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="target-value">
                          {metric.format(
                            metric.actual
                          )}
                        </div>

                        <div className="target-goal">
                          Target:{" "}
                          {metric.format(
                            metric.target
                          )}
                        </div>

                        <div className="target-progress">
                          <span
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>

                        <div className="target-progress-meta">
                          <strong>
                            {Math.round(
                              progress
                            )}
                            %
                          </strong>

                          <span>
                            {metric.inverse
                              ? metric.actual <=
                                metric.target
                                ? "Within limit"
                                : `${metric.format(
                                    Math.abs(
                                      metric.target -
                                        metric.actual
                                    )
                                  )} over limit`
                              : remaining > 0
                              ? `${metric.format(
                                  remaining
                                )} remaining`
                              : "Target reached"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </section>

                <section className="targets-summary-grid">
                  <div className="target-summary-card">
                    <span>
                      GROSS PROFIT
                    </span>
                    <strong>
                      {money(
                        performance.grossProfit
                      )}
                    </strong>
                    <small>
                      Revenue less product cost
                    </small>
                  </div>

                  <div className="target-summary-card">
                    <span>
                      OPERATING RESULT
                    </span>
                    <strong>
                      {money(
                        Math.max(
                          performance.grossProfit -
                            performance.expenses,
                          0
                        )
                      )}
                    </strong>
                    <small>
                      Gross profit less expenses
                    </small>
                  </div>

                  <div className="target-summary-card">
                    <span>
                      UNITS SOLD
                    </span>
                    <strong>
                      {number(
                        performance.units
                      )}
                    </strong>
                    <small>
                      Across the selected period
                    </small>
                  </div>

                  <div className="target-summary-card">
                    <span>
                      EXPENSE LIMIT
                    </span>
                    <strong>
                      {money(
                        currentTarget.expense_limit
                      )}
                    </strong>
                    <small>
                      Planned operating expense ceiling
                    </small>
                  </div>
                </section>

                {currentTarget.notes && (
                  <section className="target-notes">
                    <span>TARGET NOTES</span>
                    <p>
                      {currentTarget.notes}
                    </p>
                  </section>
                )}

                <div className="target-management">
                  <button
                    type="button"
                    className="target-delete-button"
                    onClick={deleteTarget}
                  >
                    Delete Target
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {showForm && (
          <div className="target-modal-backdrop">
            <div className="target-modal">
              <div className="target-modal-header">
                <div>
                  <span>
                    BUSINESS PLAN
                  </span>

                  <h2>
                    {currentTarget
                      ? "Edit Target"
                      : "New Business Target"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={saveTarget}>
                <div className="target-form-grid">
                  <label>
                    <span>Period</span>

                    <select
                      value={form.periodType}
                      onChange={(event) =>
                        handlePeriodChange(
                          event.target.value
                        )
                      }
                    >
                      {PERIODS.map((period) => (
                        <option
                          key={period.value}
                          value={period.value}
                        >
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Start date</span>

                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          startDate:
                            event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>End date</span>

                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          endDate:
                            event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Revenue target
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.revenueTarget
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          revenueTarget:
                            event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    <span>
                      Gross profit target
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.grossProfitTarget
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          grossProfitTarget:
                            event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    <span>
                      Expense limit
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.expenseLimit
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          expenseLimit:
                            event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    <span>
                      Units target
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.unitsTarget
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unitsTarget:
                            event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </label>
                </div>

                <label className="target-form-notes">
                  <span>Notes</span>

                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      }))
                    }
                    placeholder="Optional notes about this target..."
                    rows="4"
                  />
                </label>

                <div className="target-form-actions">
                  <button
                    type="button"
                    className="targets-secondary-button"
                    onClick={() =>
                      setShowForm(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="targets-primary-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : currentTarget
                      ? "Save Changes"
                      : "Create Target"}
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

export default BusinessTargets;
