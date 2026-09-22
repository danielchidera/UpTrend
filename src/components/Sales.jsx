import "./Sales.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function Sales({ onEditSale }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] =
    useState("all");

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

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

      const saleDate = new Date(
        `${sale.date}T00:00:00`
      );

      if (dateFilter === "today") {
        return (
          sale.date ===
          today
            .toISOString()
            .split("T")[0]
        );
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

        start.setDate(
          start.getDate() - daysAgo + 1
        );

        return saleDate >= start;
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
          Number(
            sale.totalSelling || 0
          ),
        0
      );

    const grossProfit =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.grossProfit || 0
          ),
        0
      );

    const quantity =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          Number(sale.quantity || 0),
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
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            setSales([]);
            setError("No signed-in user found.");
          }
          return;
        }

        const { data, error: salesError } =
          await supabase
            .from("sales")
            .select("*")
            .eq("user_id", user.id)
            .order("sale_date", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            });

        if (salesError) {
          throw salesError;
        }

        if (!mounted) {
          return;
        }

        setSales(
          (data || []).map((sale) => ({
            id: sale.id,
            date: sale.sale_date,
            productId: sale.product_id,
            product: sale.product_name,
            productName: sale.product_name,
            quantity: Number(
              sale.quantity || 0
            ),
            costPrice: Number(
              sale.cost_price || 0
            ),
            totalCost:
              Number(
                sale.cost_price || 0
              ) *
              Number(
                sale.quantity || 0
              ),
            sellingPrice: Number(
              sale.selling_price || 0
            ),
            totalSelling: Number(
              sale.total_selling || 0
            ),
            grossProfit: Number(
              sale.gross_profit || 0
            ),
            createdAt: sale.created_at,
          }))
        );
      } catch (loadError) {
        console.error(
          "Failed to load sales:",
          loadError
        );

        if (mounted) {
          setError(
            loadError?.message ||
              "Failed to load sales."
          );
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
    setDateFilter("all");
    setCustomStart("");
    setCustomEnd("");
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
                setDateFilter(value)
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
                onChange={(event) =>
                  setCustomStart(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span>To</span>

              <input
                type="date"
                value={customEnd}
                onChange={(event) =>
                  setCustomEnd(
                    event.target.value
                  )
                }
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
                      <tr key={sale.id}>
                        <td>{sale.date}</td>

                        <td>
                          <div className="sales-product-cell">
                            <div className="sales-product-letter">
                              {sale.product
                                ?.charAt(0)
                                .toUpperCase()}
                            </div>

                            <strong>
                              {sale.product}
                            </strong>
                          </div>
                        </td>

                        <td>
                          {sale.quantity}
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
                    className="sales-mobile-card"
                    key={sale.id}
                  >
                    <div className="sales-mobile-top">
                      <div className="sales-product-cell">
                        <div className="sales-product-letter">
                          {sale.product
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {sale.product}
                          </strong>

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
                          {sale.quantity}
                        </strong>
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
    </div>
  );
}

export default Sales;