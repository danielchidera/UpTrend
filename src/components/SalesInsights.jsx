import "./Reports.css";
import "./SalesInsights.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatMoney } from "../utils/numberFormat";
import { calculateFinancialSummary } from "../utils/financeStore";

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function SalesInsights({ sales, dateFilter, customStart, customEnd }) {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadExpenses() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (active) setExpenses([]);
          return;
        }

        const { data, error } = await supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;

        if (active) {
          setExpenses((data || []).map((item) => ({
            ...item,
            date: item.date || item.expense_date || item.created_at?.slice(0, 10) || "",
            amount: Number(item.amount ?? item.total_amount ?? 0),
          })));
        }
      } catch (error) {
        console.error("Failed to load Sales insights expenses:", error);
        if (active) setExpenses([]);
      }
    }

    loadExpenses();
    return () => { active = false; };
  }, []);

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const todayKey = dateKey(today);

    if (dateFilter === "today") {
      return { startDate: todayKey, endDate: todayKey };
    }
    if (dateFilter === "custom") {
      return {
        startDate: customStart || "",
        endDate: customEnd || "9999-12-31",
      };
    }
    if (dateFilter === "7days" || dateFilter === "30days") {
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (dateFilter === "7days" ? 6 : 29));
      return { startDate: dateKey(start), endDate: todayKey };
    }
    return { startDate: "", endDate: "9999-12-31" };
  }, [dateFilter, customStart, customEnd]);

  const periodSales = useMemo(() => sales.filter((sale) =>
    (!startDate || sale.date >= startDate) &&
    (!endDate || sale.date <= endDate)
  ), [sales, startDate, endDate]);

  const periodExpenses = useMemo(() => expenses.filter((expense) =>
    (!startDate || expense.date >= startDate) &&
    (!endDate || expense.date <= endDate)
  ), [expenses, startDate, endDate]);

  const totals = useMemo(() => calculateFinancialSummary(
    periodSales,
    periodExpenses,
    { openingBalance: 0 }
  ), [periodSales, periodExpenses]);

  const products = useMemo(() => {
    const grouped = new Map();
    periodSales.forEach((sale) => {
      const key = sale.productId || sale.product || sale.productName || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: sale.productName || sale.product || "Product",
          units: 0,
          revenue: 0,
          profit: 0,
        });
      }
      const item = grouped.get(key);
      item.units += Number(sale.quantity || 0);
      item.revenue += Number(sale.totalSelling || 0);
      item.profit += Number(sale.grossProfit || 0);
    });
    return [...grouped.values()].sort((a, b) => b.units - a.units);
  }, [periodSales]);

  return (
    <div className="reports-page sales-insights">
      <div className="reports-main-grid">
        <section className="report-summary-card premium-card">
          <div className="panel-heading">
            <div>
              <div className="mini-label">PROFITABILITY</div>
              <h2>Financial summary</h2>
            </div>
          </div>
          <div className="report-summary-lines">
            <div><span>Revenue</span><strong>{formatMoney(totals.revenue || 0)}</strong></div>
            <div><span>Product cost</span><strong>- {formatMoney(totals.productCost || 0)}</strong></div>
            <div><span>Gross profit</span><strong className="record-profit">+ {formatMoney(totals.grossProfit || 0)}</strong></div>
            <div><span>Expenses</span><strong className="expense-report-value">- {formatMoney(totals.expenses || 0)}</strong></div>
            <div className="report-remaining-line">
              <span>Remaining expenses</span>
              <strong className={Number(totals.remainingExpenses || 0) > 0 ? "record-loss" : "record-profit"}>
                {formatMoney(totals.remainingExpenses || 0)}
              </strong>
            </div>
            <div><span>Net profit</span><strong className={Number(totals.netProfit || 0) < 0 ? "record-loss" : "record-profit"}>{formatMoney(totals.netProfit || 0)}</strong></div>
            <div className="report-total-line"><span>Total</span><strong>{formatMoney(totals.cashAtHand || 0)}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function SalesProductPerformance({ sales, dateFilter, customStart, customEnd }) {
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const todayKey = dateKey(today);

    if (dateFilter === "today") {
      return { startDate: todayKey, endDate: todayKey };
    }
    if (dateFilter === "custom") {
      return {
        startDate: customStart || "",
        endDate: customEnd || "9999-12-31",
      };
    }
    if (dateFilter === "7days" || dateFilter === "30days") {
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (dateFilter === "7days" ? 6 : 29));
      return { startDate: dateKey(start), endDate: todayKey };
    }
    return { startDate: "", endDate: "9999-12-31" };
  }, [dateFilter, customStart, customEnd]);

  const periodSales = useMemo(() => sales.filter((sale) =>
    (!startDate || sale.date >= startDate) &&
    (!endDate || sale.date <= endDate)
  ), [sales, startDate, endDate]);

  const products = useMemo(() => {
    const grouped = new Map();
    periodSales.forEach((sale) => {
      const key = sale.productId || sale.product || sale.productName || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: sale.productName || sale.product || "Product",
          units: 0,
          revenue: 0,
          profit: 0,
        });
      }
      const item = grouped.get(key);
      item.units += Number(sale.quantity || 0);
      item.revenue += Number(sale.totalSelling || 0);
      item.profit += Number(sale.grossProfit || 0);
    });
    return [...grouped.values()].sort((a, b) => b.units - a.units);
  }, [periodSales]);

  return (
    <div className="reports-page sales-insights sales-product-performance">
      <div className="reports-performance-grid">
        <section className="report-products-card premium-card">
          <div className="panel-heading">
            <div>
              <div className="mini-label">PRODUCT PERFORMANCE</div>
              <h2>Best-selling products</h2>
            </div>
          </div>
          {products.length === 0 ? (
            <div className="report-no-data">No product sales in this period.</div>
          ) : (
            <div className="report-product-list">
              {products.slice(0, 5).map((product, index) => (
                <div className="report-product-row" key={product.name}>
                  <div className="report-rank">{index + 1}</div>
                  <div className="report-product-name">
                    <strong>{product.name}</strong>
                    <span>{product.units} units sold</span>
                  </div>
                  <div className="report-product-money">
                    <strong>{formatMoney(product.revenue)}</strong>
                    <span>{formatMoney(product.profit)} profit</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SalesInsights;
