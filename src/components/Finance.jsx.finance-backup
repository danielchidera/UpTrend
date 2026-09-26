import "./Finance.css";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  calculateFinancialSummary,
} from "../utils/financeStore";

function Finance() {
  const [sales, setSales] = useState([]);

  const [expenses, setExpenses] =
    useState([]);

  const [finance, setFinance] =
    useState({
      openingBalance: 0,
    });

  const [openingInput, setOpeningInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadData = async () => {
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
        setSales([]);
        setExpenses([]);

        setFinance({
          openingBalance: 0,
        });

        setOpeningInput("");
        return;
      }

      const [
        salesResult,
        expensesResult,
        financeResult,
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
      ]);

      if (salesResult.error) {
        throw salesResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      if (financeResult.error) {
        throw financeResult.error;
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

            createdAt:
              sale.created_at,
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

      setSales(mappedSales);
      setExpenses(mappedExpenses);

      setFinance({
        openingBalance,
      });

      setOpeningInput(
        openingBalance
          ? String(openingBalance)
          : ""
      );
    } catch (loadError) {
      console.error(
        "Finance data load failed:",
        loadError
      );

      setError(
        loadError?.message ||
          "Unable to load financial data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleFocus = () => {
      loadData();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "storage",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "storage",
        handleFocus
      );
    };
  }, []);

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;

  const financial = useMemo(
    () =>
      calculateFinancialSummary(
        sales,
        expenses,
        finance
      ),
    [sales, expenses, finance]
  );

  /*
   * Finance uses the same profit rule as Reports:
   *
   * Gross Profit = Revenue - Product Cost
   *
   * Net Profit cannot go below zero.
   * Any expenses above gross profit are shown
   * separately as Remaining Expenses.
   */
  const displayedNetProfit = Math.max(
    Number(financial.grossProfit || 0) -
      Number(financial.expenses || 0),
    0
  );

  const remainingExpenses = Math.max(
    Number(financial.expenses || 0) -
      Number(financial.grossProfit || 0),
    0
  );

  const saveOpeningBalance =
    async (event) => {
      event.preventDefault();

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
          .upsert(
            {
              user_id: user.id,
              opening_balance:
                amount,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "user_id",
            }
          );

        if (saveError) {
          throw saveError;
        }

        setFinance({
          openingBalance:
            amount,
        });

        setOpeningInput(
          String(amount)
        );
      } catch (saveError) {
        console.error(
          "Opening balance save failed:",
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
      <div className="inner-page finance-page">
        <div className="finance-panel">
          Loading finance...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inner-page finance-page">
        <div className="finance-panel">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="inner-page finance-page">

      <div className="inner-page-header">
        <div>

          <span className="eyebrow">
            FINANCIAL CONTROL
          </span>

          <h1>
            Finance
          </h1>

          <p>
            Understand exactly where your business
            money is coming from and where it is going.
          </p>

        </div>
      </div>

      <section className="finance-hero-card">

        <div>

          <span className="finance-label">
            CURRENT CASH AT HAND
          </span>

          <strong className="finance-balance">
            {formatMoney(
              financial.cashAtHand
            )}
          </strong>

          <p>
            Opening cash + sales received −
            recorded expenses
          </p>

        </div>

        <div className="finance-flow-mini">

          <div>
            <span>
              Opening Cash
            </span>

            <strong>
              {formatMoney(
                financial.openingBalance
              )}
            </strong>
          </div>

          <div>
            <span>
              Cash In
            </span>

            <strong>
              {formatMoney(
                financial.cashIn
              )}
            </strong>
          </div>

          <div>
            <span>
              Cash Out
            </span>

            <strong>
              {formatMoney(
                financial.cashOut
              )}
            </strong>
          </div>

        </div>

      </section>

      <section className="finance-panel">

        <div className="finance-section-heading">

          <div>

            <span className="eyebrow">
              STARTING POSITION
            </span>

            <h2>
              Opening Business Cash
            </h2>

          </div>

        </div>

        <form
          className="finance-opening-form"
          onSubmit={
            saveOpeningBalance
          }
        >

          <div>

            <label>
              Cash available before UpTrend
              tracking
            </label>

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
              placeholder="50000"
            />

          </div>

          <button type="submit">
            Save Opening Balance
          </button>

        </form>

      </section>

      <section className="finance-summary-grid">

        <article className="finance-summary-card">

          <span>
            Opening Balance
          </span>

          <strong>
            {formatMoney(
              financial.openingBalance
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Total Revenue
          </span>

          <strong>
            {formatMoney(
              financial.revenue
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Product Cost
          </span>

          <strong>
            {formatMoney(
              financial.productCost
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Gross Profit
          </span>

          <strong>
            {formatMoney(
              financial.grossProfit
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Expenses
          </span>

          <strong>
            {formatMoney(
              financial.expenses
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Expenses Not Covered
          </span>

          <strong
            className={
              remainingExpenses > 0
                ? "record-loss"
                : "record-profit"
            }
          >
            {formatMoney(
              remainingExpenses
            )}
          </strong>

        </article>

        <article className="finance-summary-card">

          <span>
            Net Profit
          </span>

          <strong>
            {formatMoney(
              displayedNetProfit
            )}
          </strong>

        </article>

      </section>

      <section className="finance-panel finance-explanation">

        <div className="finance-section-heading">

          <div>

            <span className="eyebrow">
              FINANCIAL POSITION
            </span>

            <h2>
              Cash vs Profit
            </h2>

          </div>

        </div>

        <div className="finance-explanation-grid">

          <div>

            <span>
              Cash At Hand
            </span>

            <strong>
              {formatMoney(
                financial.cashAtHand
              )}
            </strong>

            <p>
              Opening cash plus recorded
              sales receipts minus recorded
              expenses.
            </p>

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

            <p>
              Revenue minus the cost of
              products sold.
            </p>

          </div>

          <div>

            <span>
              Net Profit
            </span>

            <strong>
              {formatMoney(
                displayedNetProfit
              )}
            </strong>

            <p>
              Gross profit after recorded
              business expenses. It does not
              display below zero.
            </p>

          </div>

        </div>

      </section>

      <section className="finance-panel">

        <div className="finance-section-heading">

          <div>

            <span className="eyebrow">
              CARRY FORWARD
            </span>

            <h2>
              Closing Position
            </h2>

          </div>

        </div>

        <div className="finance-explanation-grid">

          <div>

            <span>
              Closing Cash
            </span>

            <strong>
              {formatMoney(
                financial.closingBalance
              )}
            </strong>

            <p>
              Current calculated cash position
              at the end of the tracked period.
            </p>

          </div>

          <div>

            <span>
              Next Opening Balance
            </span>

            <strong>
              {formatMoney(
                financial.nextOpeningBalance
              )}
            </strong>

            <p>
              This is the balance available to
              carry into the next financial period.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Finance;
