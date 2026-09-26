import "./AdvancedInventory.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function AdvancedInventory({ subscription }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState("30days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const isBusiness =
    subscription?.plan === "business" &&
    ["active", "trialing"].includes(
      subscription?.status
    );

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString();

  const getToday = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getStartDate = () => {
    if (period === "custom") {
      return customStart || getToday();
    }

    const days =
      period === "7days"
        ? 7
        : period === "90days"
        ? 90
        : 30;

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(
      date.getDate() - days + 1
    );

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const startDate = getStartDate();
  const endDate =
    period === "custom" && customEnd
      ? customEnd
      : getToday();

  useEffect(() => {
    if (!isBusiness) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadInventoryData = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            "Please sign in to view Advanced Inventory."
          );
        }

        const [
          productsResult,
          salesResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("user_id", user.id),

          supabase
            .from("sales")
            .select("*")
            .eq("user_id", user.id)
            .gte("sale_date", startDate)
            .lte("sale_date", endDate)
            .order("sale_date", {
              ascending: false,
            }),
        ]);

        if (productsResult.error) {
          throw productsResult.error;
        }

        if (salesResult.error) {
          throw salesResult.error;
        }

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

        setSales(
          (salesResult.data || []).map(
            (sale) => ({
              id: sale.id,
              productId:
                sale.product_id,
              product:
                sale.product_name,
              quantity: Number(
                sale.quantity || 0
              ),
              totalSelling: Number(
                sale.total_selling || 0
              ),
              grossProfit: Number(
                sale.gross_profit || 0
              ),
              saleDate:
                sale.sale_date,
            })
          )
        );
      } catch (loadError) {
        console.error(
          "Advanced Inventory load error:",
          loadError
        );

        if (mounted) {
          setError(
            loadError?.message ||
              "We couldn't load inventory intelligence."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInventoryData();

    return () => {
      mounted = false;
    };
  }, [isBusiness, startDate, endDate]);

  const inventory = useMemo(() => {
    const productRows = products.map(
      (product) => {
        const productSales =
          sales.filter(
            (sale) =>
              sale.productId ===
                product.id ||
              (
                !sale.productId &&
                sale.product?.toLowerCase() ===
                  product.name?.toLowerCase()
              )
          );

        const unitsSold =
          productSales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.quantity || 0
              ),
            0
          );

        const revenue =
          productSales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.totalSelling || 0
              ),
            0
          );

        const grossProfit =
          productSales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.grossProfit || 0
              ),
            0
          );

        const stockValue =
          product.costPrice *
          product.stock;

        const days =
          period === "7days"
            ? 7
            : period === "90days"
            ? 90
            : period === "custom"
            ? Math.max(
                1,
                Math.ceil(
                  (
                    new Date(
                      `${endDate}T00:00:00`
                    ) -
                    new Date(
                      `${startDate}T00:00:00`
                    )
                  ) /
                    86400000
                ) + 1
              )
            : 30;

        const velocity =
          unitsSold / days;

        const daysOfStock =
          velocity > 0
            ? product.stock / velocity
            : null;

        let movement =
          "No sales";

        if (unitsSold > 0) {
          if (velocity >= 1) {
            movement = "Fast moving";
          } else if (velocity >= 0.25) {
            movement = "Moving";
          } else {
            movement = "Slow moving";
          }
        }

        let stockStatus =
          "Healthy";

        if (product.stock <= 0) {
          stockStatus = "Out of stock";
        } else if (
          product.stock <=
          product.lowStockAt
        ) {
          stockStatus = "Low stock";
        } else if (
          product.stock <=
          product.lowStockAt * 2
        ) {
          stockStatus = "Watch";
        }

        return {
          ...product,
          unitsSold,
          revenue,
          grossProfit,
          stockValue,
          velocity,
          daysOfStock,
          movement,
          stockStatus,
        };
      }
    );

    const totalStockUnits =
      productRows.reduce(
        (sum, product) =>
          sum + product.stock,
        0
      );

    const inventoryValue =
      productRows.reduce(
        (sum, product) =>
          sum + product.stockValue,
        0
      );

    const lowStockProducts =
      productRows.filter(
        (product) =>
          product.stock > 0 &&
          product.stock <=
            product.lowStockAt
      );

    const outOfStockProducts =
      productRows.filter(
        (product) =>
          product.stock <= 0
      );

    const slowMovingProducts =
      productRows.filter(
        (product) =>
          product.movement ===
          "Slow moving"
      );

    const noSalesProducts =
      productRows.filter(
        (product) =>
          product.movement ===
          "No sales"
      );

    const totalUnitsSold =
      productRows.reduce(
        (sum, product) =>
          sum + product.unitsSold,
        0
      );

    const totalRevenue =
      productRows.reduce(
        (sum, product) =>
          sum + product.revenue,
        0
      );

    const totalGrossProfit =
      productRows.reduce(
        (sum, product) =>
          sum + product.grossProfit,
        0
      );

    const lowStockValue =
      lowStockProducts.reduce(
        (sum, product) =>
          sum + product.stockValue,
        0
      );

    const slowMovingValue =
      slowMovingProducts.reduce(
        (sum, product) =>
          sum + product.stockValue,
        0
      );

    const fastMovingProducts =
      [...productRows]
        .filter(
          (product) =>
            product.unitsSold > 0
        )
        .sort(
          (a, b) =>
            b.unitsSold -
            a.unitsSold
        );

    return {
      productRows,
      totalStockUnits,
      inventoryValue,
      lowStockProducts,
      outOfStockProducts,
      slowMovingProducts,
      noSalesProducts,
      totalUnitsSold,
      totalRevenue,
      totalGrossProfit,
      lowStockValue,
      slowMovingValue,
      fastMovingProducts,
    };
  }, [
    products,
    sales,
    period,
    startDate,
    endDate,
  ]);

  if (!isBusiness) {
    return (
      <div className="advanced-inventory-page">
        <section className="advanced-business-gate premium-card">
          <div className="advanced-business-icon">
            ◆
          </div>

          <div className="mini-label">
            BUSINESS INTELLIGENCE
          </div>

          <h2>
            Advanced Inventory
          </h2>

          <p>
            See how your inventory is moving,
            identify stock risks and understand
            where your money is tied up.
          </p>

          <div className="advanced-gate-features">
            <span>✓ Stock movement</span>
            <span>✓ Sales velocity</span>
            <span>✓ Inventory risk</span>
            <span>✓ Product intelligence</span>
          </div>

          <button
            className="advanced-gate-button"
            type="button"
          >
            Upgrade to Business
          </button>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="advanced-inventory-page">
        <div className="advanced-loading premium-card">
          <div className="advanced-loading-icon">
            ◈
          </div>

          <strong>
            Analyzing inventory...
          </strong>

          <span>
            Reading your products and sales
            records.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="advanced-inventory-page">
      <div className="advanced-page-top">
        <div>
          <div className="mini-label">
            BUSINESS INTELLIGENCE
          </div>

          <h2>
            Advanced Inventory
          </h2>

          <p>
            Understand stock movement, inventory
            risk and the products driving your
            business.
          </p>
        </div>

        <div className="advanced-period-controls">
          {[
            ["7days", "7 Days"],
            ["30days", "30 Days"],
            ["90days", "90 Days"],
            ["custom", "Custom"],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                className={
                  period === value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPeriod(value)
                }
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {period === "custom" && (
        <div className="advanced-custom-filter premium-card">
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

      {error && (
        <div className="advanced-error">
          {error}
        </div>
      )}

      <section className="advanced-kpi-grid">
        <div className="advanced-kpi premium-card">
          <span>INVENTORY VALUE</span>
          <strong>
            {formatMoney(
              inventory.inventoryValue
            )}
          </strong>
          <small>
            Current stock at cost
          </small>
        </div>

        <div className="advanced-kpi premium-card">
          <span>STOCK UNITS</span>
          <strong>
            {formatNumber(
              inventory.totalStockUnits
            )}
          </strong>
          <small>
            Units currently available
          </small>
        </div>

        <div className="advanced-kpi premium-card">
          <span>UNITS SOLD</span>
          <strong>
            {formatNumber(
              inventory.totalUnitsSold
            )}
          </strong>
          <small>
            Selected period
          </small>
        </div>

        <div className="advanced-kpi premium-card">
          <span>GROSS PROFIT</span>
          <strong className="advanced-positive">
            {formatMoney(
              inventory.totalGrossProfit
            )}
          </strong>
          <small>
            Selected period
          </small>
        </div>
      </section>

      <section className="advanced-risk-grid">
        <div className="advanced-risk-card premium-card danger">
          <span>OUT OF STOCK</span>
          <strong>
            {inventory.outOfStockProducts.length}
          </strong>
          <small>
            Products with zero stock
          </small>
        </div>

        <div className="advanced-risk-card premium-card warning">
          <span>LOW STOCK</span>
          <strong>
            {inventory.lowStockProducts.length}
          </strong>
          <small>
            Products below threshold
          </small>
        </div>

        <div className="advanced-risk-card premium-card gold">
          <span>SLOW-MOVING VALUE</span>
          <strong>
            {formatMoney(
              inventory.slowMovingValue
            )}
          </strong>
          <small>
            Stock tied in slow movers
          </small>
        </div>

        <div className="advanced-risk-card premium-card">
          <span>NO SALES</span>
          <strong>
            {inventory.noSalesProducts.length}
          </strong>
          <small>
            No recorded sale this period
          </small>
        </div>
      </section>

      <section className="advanced-analysis-grid">
        <div className="advanced-panel premium-card">
          <div className="advanced-panel-heading">
            <div>
              <div className="mini-label">
                STOCK MOVEMENT
              </div>

              <h3>
                Fast-moving products
              </h3>
            </div>

            <span>
              {inventory.fastMovingProducts.length}
            </span>
          </div>

          {inventory.fastMovingProducts.length ===
          0 ? (
            <div className="advanced-empty-small">
              No product sales were recorded in
              this period.
            </div>
          ) : (
            <div className="advanced-product-list">
              {inventory.fastMovingProducts
                .slice(0, 6)
                .map((product) => (
                  <div
                    className="advanced-product-row"
                    key={product.id}
                  >
                    <div className="advanced-product-main">
                      <div className="advanced-product-letter">
                        {product.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          {formatNumber(
                            product.unitsSold
                          )}{" "}
                          units sold
                        </span>
                      </div>
                    </div>

                    <div className="advanced-product-metric">
                      <strong>
                        {product.velocity.toFixed(
                          2
                        )}
                      </strong>

                      <span>
                        units/day
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="advanced-panel premium-card">
          <div className="advanced-panel-heading">
            <div>
              <div className="mini-label">
                INVENTORY RISK
              </div>

              <h3>
                Products needing attention
              </h3>
            </div>

            <span>
              {inventory.outOfStockProducts.length +
                inventory.lowStockProducts.length}
            </span>
          </div>

          {[
            ...inventory.outOfStockProducts,
            ...inventory.lowStockProducts,
          ].length === 0 ? (
            <div className="advanced-empty-small">
              No immediate stock risks detected.
            </div>
          ) : (
            <div className="advanced-product-list">
              {[
                ...inventory.outOfStockProducts,
                ...inventory.lowStockProducts,
              ]
                .slice(0, 6)
                .map((product) => (
                  <div
                    className="advanced-product-row"
                    key={product.id}
                  >
                    <div className="advanced-product-main">
                      <div className="advanced-product-letter">
                        {product.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          {formatNumber(
                            product.stock
                          )}{" "}
                          units remaining
                        </span>
                      </div>
                    </div>

                    <span
                      className={`advanced-status ${product.stockStatus
                        .toLowerCase()
                        .replace(
                          /\s+/g,
                          "-"
                        )}`}
                    >
                      {product.stockStatus}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      <section className="advanced-table-card premium-card">
        <div className="advanced-panel-heading">
          <div>
            <div className="mini-label">
              PRODUCT INTELLIGENCE
            </div>

            <h3>
              Inventory performance
            </h3>
          </div>

          <span>
            {inventory.productRows.length} products
          </span>
        </div>

        {inventory.productRows.length ===
        0 ? (
          <div className="advanced-empty">
            <strong>
              No products available
            </strong>

            <span>
              Add products first to see
              inventory intelligence.
            </span>
          </div>
        ) : (
          <div className="advanced-table-wrap">
            <table className="advanced-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Velocity</th>
                  <th>Movement</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {inventory.productRows
                  .sort(
                    (a, b) =>
                      b.revenue -
                      a.revenue
                  )
                  .map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="advanced-product-main">
                          <div className="advanced-product-letter">
                            {product.name
                              ?.charAt(0)
                              .toUpperCase()}
                          </div>

                          <strong>
                            {product.name}
                          </strong>
                        </div>
                      </td>

                      <td>
                        {formatNumber(
                          product.stock
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          product.unitsSold
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          product.revenue
                        )}
                      </td>

                      <td>
                        <strong className="advanced-positive">
                          {formatMoney(
                            product.grossProfit
                          )}
                        </strong>
                      </td>

                      <td>
                        {product.velocity.toFixed(
                          2
                        )}{" "}
                        /day
                      </td>

                      <td>
                        <span
                          className={`advanced-movement ${product.movement
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )}`}
                        >
                          {product.movement}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`advanced-status ${product.stockStatus
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )}`}
                        >
                          {product.stockStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdvancedInventory;
