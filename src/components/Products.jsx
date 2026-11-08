import "./Products.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  saveCachedRecords,
  getCachedRecords,
} from "../lib/localDb";

function Products({ onOpenSupplier, subscription, onUpgrade }) {
  const [products, setProducts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getLocalDateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const loadInventory = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setProducts([]);
        setSuppliers([]);
        setError("Please sign in to view your inventory.");
        return;
      }

      if (!navigator.onLine) {
        const [cachedProducts, cachedSuppliers] = await Promise.all([
          getCachedRecords("products", user.id),
          getCachedRecords("suppliers", user.id),
        ]);

        setProducts(cachedProducts.map((product) => ({
          id: product.id,
          name: product.name,
          costPrice: Number(product.cost_price || 0),
          stock: Number(product.stock || 0),
          lowStockAt: Number(product.low_stock_at ?? 5),
          supplierId: product.supplier_id || "",
          lastPurchaseDate: product.last_purchase_date || "",
          updatedAt: product.updated_at || "",
        })));

        setSuppliers(cachedSuppliers);
        setError("You're offline. Showing your last saved inventory.");
        return;
      }

      const [productsResult, suppliersResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, cost_price, stock, low_stock_at, supplier_id, last_purchase_date, updated_at")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),

        supabase
          .from("uptrend_suppliers")
          .select("id, name, company_name, status")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      await Promise.all([
        saveCachedRecords("products", user.id, productsResult.data || []),
        saveCachedRecords("suppliers", user.id, suppliersResult.data || []),
      ]);

      setProducts((productsResult.data || []).map((product) => ({
        id: product.id,
        name: product.name,
        costPrice: Number(product.cost_price || 0),
        stock: Number(product.stock || 0),
        lowStockAt: Number(product.low_stock_at ?? 5),
        supplierId: product.supplier_id || "",
        lastPurchaseDate: product.last_purchase_date || "",
        updatedAt: product.updated_at || "",
      })));

      setSuppliers(suppliersResult.data || []);
    } catch (loadError) {
      console.error("Products inventory load error:", loadError);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) throw loadError;

        const [cachedProducts, cachedSuppliers] = await Promise.all([
          getCachedRecords("products", user.id),
          getCachedRecords("suppliers", user.id),
        ]);

        if (cachedProducts.length > 0 || cachedSuppliers.length > 0) {
          setProducts(cachedProducts.map((product) => ({
            id: product.id,
            name: product.name,
            costPrice: Number(product.cost_price || 0),
            stock: Number(product.stock || 0),
            lowStockAt: Number(product.low_stock_at ?? 5),
            supplierId: product.supplier_id || "",
            lastPurchaseDate: product.last_purchase_date || "",
            updatedAt: product.updated_at || "",
          })));

          setSuppliers(cachedSuppliers);
          setError("Couldn't reach the server. Showing your last saved inventory.");
        } else {
          setError("We couldn't load your inventory. Please connect to the internet and try again.");
        }
      } catch (cacheError) {
        console.error("Products cache load error:", cacheError);
        setError("We couldn't load your inventory. Please try again.");
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadActivity = async (showLoader = true) => {
    if (showLoader) setActivityLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setActivity([]);
        return;
      }

      if (!navigator.onLine) {
        const cachedActivity = await getCachedRecords("inventoryActivity", user.id);

        setActivity(
          cachedActivity
            .sort((a, b) =>
              String(b.created_at || "").localeCompare(String(a.created_at || ""))
            )
            .slice(0, isBusiness ? 500 : 100)
        );
        return;
      }

      const { data, error: activityError } = await supabase
        .from("uptrend_inventory_activity")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("occurred_at", { ascending: false })
        .limit(isBusiness ? 500 : 100);

      if (activityError) throw activityError;

      await saveCachedRecords("inventoryActivity", user.id, data || []);
      setActivity(data || []);
    } catch (activityError) {
      console.error("Inventory activity load error:", activityError);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user) {
          const cachedActivity = await getCachedRecords("inventoryActivity", user.id);

          setActivity(
            cachedActivity
              .sort((a, b) =>
                String(b.created_at || "").localeCompare(String(a.created_at || ""))
              )
              .slice(0, isBusiness ? 500 : 100)
          );
        }
      } catch (cacheError) {
        console.error("Inventory activity cache load error:", cacheError);
      }
    } finally {
      if (showLoader) setActivityLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let channel;

    const start = async () => {
      await Promise.all([loadInventory(), loadActivity()]);

      if (!mounted) return;

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) return;

      channel = supabase
        .channel(`uptrend-inventory-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "uptrend_inventory_activity",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await Promise.all([
              loadInventory(false),
              loadActivity(false),
            ]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `user_id=eq.${user.id}`,
          },
          () => loadInventory(false)
        )
        .subscribe();
    };

    start();

    const refresh = () => {
      loadInventory(false);
      loadActivity(false);
    };

    window.addEventListener("uptrend:inventory-refresh", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("uptrend:inventory-refresh", refresh);

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isBusiness]);

  const supplierMap = useMemo(() => {
    return suppliers.reduce((map, supplier) => {
      map[supplier.id] = supplier;
      return map;
    }, {});
  }, [suppliers]);

  const totals = useMemo(() => {
    const inventoryValue = products.reduce(
      (total, product) =>
        total + Number(product.costPrice) * Number(product.stock),
      0
    );

    const stockUnits = products.reduce(
      (total, product) => total + Number(product.stock),
      0
    );

    const lowStock = products.filter(
      (product) =>
        Number(product.stock) > 0 &&
        Number(product.stock) <= Number(product.lowStockAt)
    ).length;

    const outOfStock = products.filter(
      (product) => Number(product.stock) <= 0
    ).length;

    return {
      inventoryValue,
      stockUnits,
      lowStock,
      outOfStock,
    };
  }, [products]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "in") {
      return activity.filter((item) => item.direction === "in");
    }

    if (activityFilter === "out") {
      return activity.filter((item) => item.direction === "out");
    }

    return activity;
  }, [activity, activityFilter]);

  const inventoryAnalytics = useMemo(() => {
    const movements = (activity || [])
      .map((item) => {
        const reason = String(item.reason || "").toLowerCase();

        let movementType = null;

        if (
          reason.includes("purchase_deleted") ||
          reason.includes("sale_edited_quantity_increased")
        ) {
          movementType = "out";
        } else if (
          reason.includes("purchase") ||
          reason.includes("product_returned") ||
          reason.includes("sale_deleted") ||
          reason.includes("sale_edited_quantity_decreased")
        ) {
          movementType = "in";
        } else if (item.direction === "in") {
          movementType = "in";
        } else if (item.direction === "out") {
          movementType = "out";
        }

        return {
          ...item,
          movementType,
          quantity: Math.abs(Number(item.quantity || 0)),
          date: getLocalDateKey(
            item.occurred_at ||
            item.created_at
          ),
        };
      })
      .filter(
        (item) =>
          item.movementType &&
          item.quantity > 0 &&
          item.date
      );

    const totalValue = products.reduce(
      (sum, product) =>
        sum +
        Number(product.costPrice || 0) *
          Number(product.stock || 0),
      0
    );

    const averageProductValue = products.length
      ? totalValue / products.length
      : 0;

    const highestValueProduct =
      products
        .map((product) => ({
          product,
          value:
            Number(product.costPrice || 0) *
            Number(product.stock || 0),
        }))
        .sort((a, b) => b.value - a.value)[0] || null;

    const stockIn = movements
      .filter((item) => item.movementType === "in")
      .reduce((sum, item) => sum + item.quantity, 0);

    const stockOut = movements
      .filter((item) => item.movementType === "out")
      .reduce((sum, item) => sum + item.quantity, 0);

    const netMovement = stockIn - stockOut;

    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));

      const key = getLocalDateKey(date);

      return {
        key,
        date: key,
        label: date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
        }),
        in: 0,
        out: 0,
      };
    });

    const dayMap = new Map(days.map((day) => [day.key, day]));

    movements.forEach((item) => {
      const day = dayMap.get(item.date);
      if (!day) return;

      if (item.movementType === "in") {
        day.in += item.quantity;
      } else if (item.movementType === "out") {
        day.out += item.quantity;
      }
    });

    const recent7Movement = days
      .slice(7)
      .reduce(
        (sum, day) => sum + day.in + day.out,
        0
      );

    const previous7Movement = days
      .slice(0, 7)
      .reduce(
        (sum, day) => sum + day.in + day.out,
        0
      );

    const movementChange =
      previous7Movement > 0
        ? ((recent7Movement - previous7Movement) /
            previous7Movement) * 100
        : recent7Movement > 0
          ? 100
          : 0;

      const movementMap = {};

      movements.forEach((item) => {
        const productId = item.product_id;
        if (!productId) return;

        if (!movementMap[productId]) {
          movementMap[productId] = {
            inUnits: 0,
            outUnits: 0,
            activityCount: 0,
            lastMovement: null,
          };
        }

        const entry = movementMap[productId];
        const quantity = Math.abs(Number(item.quantity || 0));

        if (item.movementType === "in") {
          entry.inUnits += quantity;
        } else if (item.movementType === "out") {
          entry.outUnits += quantity;
        }

        entry.activityCount += 1;

        if (
          !entry.lastMovement ||
          item.date > entry.lastMovement
        ) {
          entry.lastMovement = item.date;
        }
      });

      const productMovement = products.map((product) => {
        const movement =
          movementMap[product.id] || {
            inUnits: 0,
            outUnits: 0,
            activityCount: 0,
            lastMovement: null,
          };

        const totalMovement =
          movement.inUnits + movement.outUnits;

        const movementVelocity =
          movement.outUnits > 0
            ? movement.outUnits / 14
            : 0;

        const stock =
          Number(product.stock || 0);

        const stockCoverageDays =
          movementVelocity > 0
            ? stock / movementVelocity
            : null;

        return {
          ...product,
          ...movement,
          totalMovement,
          movementVelocity,
          stockCoverageDays,
          netMovement:
            movement.inUnits - movement.outUnits,
        };
      });


      const fastMovers = [...productMovement]
        .filter((product) => product.movementVelocity > 0)
        .sort(
          (a, b) =>
            b.movementVelocity - a.movementVelocity ||
            b.activityCount - a.activityCount
        )
        .slice(0, 5);

      const slowMovers = [...productMovement]
        .filter(
          (product) =>
            product.stock > 0 &&
            product.movementVelocity > 0
        )
        .sort(
          (a, b) =>
            a.movementVelocity - b.movementVelocity ||
            a.activityCount - b.activityCount
        )
        .slice(0, 5);

      const inactiveProducts = productMovement
        .filter(
          (product) =>
            Number(product.stock || 0) > 0 &&
            product.activityCount === 0
        )
        .slice(0, 5);

      const topProducts = [...productMovement]
        .filter(
          (product) =>
            product.inUnits > 0 ||
            product.outUnits > 0
        )
        .sort(
          (a, b) =>
            b.movementVelocity - a.movementVelocity ||
            b.totalMovement - a.totalMovement ||
            b.activityCount - a.activityCount
        )
        .slice(0, 6)
        .map((product) => ({
          ...product,
          units: product.totalMovement,
          in: product.inUnits,
          out: product.outUnits,
        }));


      const restockProducts = productMovement
        .filter(
          (product) =>
            Number(product.stock || 0) <=
            Number(product.lowStockAt || 0)
        )
        .map((product) => {
          const stock = Number(product.stock || 0);
          const threshold = Number(product.lowStockAt || 0);
          const outUnits = Number(product.outUnits || 0);

          const velocityTarget = Math.max(
            threshold,
            Math.ceil(outUnits / 2)
          );

          const suggestedQuantity = Math.max(
            velocityTarget * 2 - stock,
            threshold > 0 ? threshold - stock : 1
          );

          return {
            ...product,
            stock,
            threshold,
            outUnits,
            suggestedQuantity,
            estimatedCost:
              suggestedQuantity *
              Number(product.costPrice || 0),
            urgency:
              stock <= 0
                ? "critical"
                : outUnits > threshold * 2 ||
                    stock <= threshold / 2
                  ? "urgent"
                  : "watch",
          };
        })
        .sort((a, b) => {
          const priority = {
            critical: 0,
            urgent: 1,
            watch: 2,
          };

          return (
            priority[a.urgency] -
              priority[b.urgency] ||
            b.outUnits - a.outUnits
          );
        })
        .slice(0, 8);
    const supplierAnalysis = Object.values(
      products.reduce((map, product) => {
        const supplierId =
          product.supplierId || "unassigned";

        if (!map[supplierId]) {
          const supplier =
            supplierMap[supplierId];

          map[supplierId] = {
            id: supplierId,
            name:
              supplier?.name ||
              "Unassigned",
            products: 0,
            units: 0,
            value: 0,
          };
        }

        map[supplierId].products += 1;

        map[supplierId].units += Number(
          product.stock || 0
        );

        map[supplierId].value +=
          Number(product.costPrice || 0) *
          Number(product.stock || 0);

        return map;
      }, {})
    ).sort((a, b) => b.value - a.value);

    const lowStockCount = products.filter(
      (product) =>
        Number(product.stock || 0) > 0 &&
        Number(product.stock || 0) <=
          Number(product.lowStockAt || 0)
    ).length;

    const outOfStockCount = products.filter(
      (product) =>
        Number(product.stock || 0) <= 0
    ).length;

    const healthScore = products.length
      ? Math.max(
          0,
          Math.round(
            (1 -
              (lowStockCount +
                outOfStockCount) /
                products.length) *
              100
          )
        )
      : 0;

    const healthLabel =
      healthScore >= 80
        ? "Healthy"
        : healthScore >= 60
          ? "Needs attention"
          : "At risk";

    let recommendation =
      "Inventory is currently stable.";

    if (outOfStockCount > 0) {
      recommendation =
        `${outOfStockCount} product${
          outOfStockCount === 1 ? "" : "s"
        } are out of stock. Replenishment should be your first priority.`;
    } else if (
      restockProducts.length > 0 &&
      fastMovers.length > 0
    ) {
      recommendation =
        "Fast-moving products are approaching their stock thresholds. Replenish before sales are affected.";
    } else if (inactiveProducts.length > 0) {
      recommendation =
        "Some products have no recorded movement. Review whether they are tying up capital.";
    } else if (movementChange > 15) {
      recommendation =
        "Stock-out activity is increasing. Keep replenishment speed under review.";
    }

    return {
      totalValue,
      averageProductValue,
      highestValueProduct,
      stockIn,
      stockOut,
      netMovement,
      days,
      movementChange,
      fastMovers,
      slowMovers,
      inactiveProducts,
      topProducts,
      restockProducts,
      supplierAnalysis,
      healthScore,
      healthLabel,
      recommendation,
    };
  }, [products, activity, supplierMap]);

  const getStockStatus = (product) => {
    const stock = Number(product.stock || 0);
    const lowStockAt = Number(product.lowStockAt ?? 5);

    if (stock <= 0) {
      return {
        label: "Out of stock",
        className: "stock-low",
      };
    }

    if (stock <= lowStockAt) {
      return {
        label: "Low stock",
        className: "stock-watch",
      };
    }

    return {
      label: "In stock",
      className: "stock-good",
    };
  };

  const getActivityTitle = (item) => {
    switch (item.reason) {
      case "purchase":
        return "Stock purchased";
      case "purchase_deleted":
        return "Purchase deleted";
      case "product_returned":
        return "Product returned";
      case "sale_deleted":
        return "Sale deleted";
      case "sale_edited_quantity_increased":
        return "Sale quantity increased";
      case "sale_edited_quantity_decreased":
        return "Sale quantity decreased";
      case "sale_edited_product_changed":
        return "Sale product changed";
      case "product_deleted":
        return "Product deleted";
      default:
        return item.direction === "in" ? "Stock in" : "Stock out";
    }
  };

  const getActivityDescription = (item) => {
    if (item.description) return item.description;

    switch (item.reason) {
      case "purchase":
        return "Inventory increased from a purchase.";
      case "purchase_deleted":
        return "A purchase was removed from inventory.";
      case "product_returned":
        return "A returned product was added back to inventory.";
      case "sale_deleted":
        return "Inventory was restored after a sale was deleted.";
      case "sale_edited_quantity_increased":
        return "Inventory decreased because the sale quantity increased.";
      case "sale_edited_quantity_decreased":
        return "Inventory was restored because the sale quantity decreased.";
      case "sale_edited_product_changed":
        return "Inventory changed because the product on a sale was edited.";
      case "product_deleted":
        return "A product was removed from the inventory.";
      default:
        return item.direction === "in"
          ? "Inventory increased."
          : "Inventory decreased.";
    }
  };

  const renderActivityMeta = (item) => {
    const meta = getActivityContext(item);

    if (!meta) return null;

    return (
      <div className="inventory-activity-meta">
        {meta}
      </div>
    );
  };

  const getActivityContext = (item) => {
    if (item.supplier_name && item.total_cost != null) {
      return (
        <>
          <span>Supplier: {item.supplier_name}</span>
          <span>
            {item.reason === "purchase_deleted"
              ? "Purchase value: "
              : "Purchase cost: "}
            {formatMoney(item.total_cost)}
          </span>
        </>
      );
    }

    if (item.reason === "product_returned" && item.sale_value != null) {
      return <span>Refund amount: {formatMoney(item.sale_value)}</span>;
    }

    if (item.sale_value != null) {
      return <span>Sale value: {formatMoney(item.sale_value)}</span>;
    }

    return null;
  };

  return (
    <div className="products-page">
      <div className="products-page-top">
        <div>
          <div className="mini-label">INVENTORY CONTROL</div>
          <h2>Products & Stock</h2>
          <p>
            View your current inventory and follow every stock movement from
            purchases, sales and inventory changes.
          </p>
        </div>
      </div>

      {error && (
        <div className="products-error" role="alert">
          <strong>Inventory notice</strong>
          <span>{error}</span>
          <button onClick={() => loadInventory()}>Retry</button>
        </div>
      )}

      {totals.outOfStock > 0 && (
        <div className="inventory-alert inventory-alert-danger">
          <div className="inventory-alert-icon">!</div>
          <div>
            <strong>
              {totals.outOfStock} product
              {totals.outOfStock === 1 ? " is" : "s are"} out of stock
            </strong>
            <span>
              Restock from Suppliers before recording another sale for these
              products.
            </span>
          </div>
        </div>
      )}

      {totals.outOfStock === 0 && totals.lowStock > 0 && (
        <div className="inventory-alert inventory-alert-warning">
          <div className="inventory-alert-icon">!</div>
          <div>
            <strong>
              {totals.lowStock} product
              {totals.lowStock === 1 ? " needs" : "s need"} restocking
            </strong>
            <span>
              These products are at or below their low-stock levels.
            </span>
          </div>
        </div>
      )}

      <section className="inventory-overview">
        <div className="inventory-stat premium-card">
          <div className="inventory-stat-icon">▣</div>
          <div>
            <span>Products</span>
            <strong>{products.length}</strong>
            <small>Current product catalog</small>
          </div>
        </div>

        <div className="inventory-stat premium-card">
          <div className="inventory-stat-icon">#</div>
          <div>
            <span>Stock Units</span>
            <strong>{totals.stockUnits.toLocaleString("en-NG")}</strong>
            <small>Total units available</small>
          </div>
        </div>

        <div className="inventory-stat premium-card">
          <div className="inventory-stat-icon">₦</div>
          <div>
            <span>Inventory Value</span>
            <strong>{formatMoney(totals.inventoryValue)}</strong>
            <small>Current stock at cost</small>
          </div>
        </div>

        <div className="inventory-stat premium-card">
          <div className="inventory-stat-icon warning">!</div>
          <div>
            <span>Needs Attention</span>
            <strong>{totals.lowStock + totals.outOfStock}</strong>
            <small>Low or out of stock</small>
          </div>
        </div>
      </section>

      <section className="products-list-card premium-card">
        <div className="panel-heading">
          <div>
            <div className="mini-label">CURRENT INVENTORY</div>
            <h2>Stock on Hand</h2>
          </div>

          <span className="products-count">
            {products.length} product{products.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="products-empty">
            <div className="products-loading-mark">◌</div>
            <strong>Loading inventory</strong>
            <span>Checking your current stock.</span>
          </div>
        ) : products.length === 0 ? (
          <div className="products-empty">
            <div>▣</div>
            <strong>No inventory yet</strong>
            <span>
              Products appear here automatically when you record a purchase
              from the Suppliers page.
            </span>
          </div>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Cost</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Supplier</th>
                  <th>Last Purchase</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const status = getStockStatus(product);
                  const supplier = supplierMap[product.supplierId];

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-letter">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{product.name}</strong>
                            <small>
                              Alert at {product.lowStockAt} unit
                              {product.lowStockAt === 1 ? "" : "s"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{formatMoney(product.costPrice)}</td>

                      <td>
                        <strong className="stock-number">
                          {product.stock.toLocaleString("en-NG")}
                        </strong>
                      </td>

                      <td>
                        <span className={`stock-badge ${status.className}`}>
                          <i />
                          {status.label}
                        </span>
                      </td>

                      <td>
                        {supplier ? (
                          onOpenSupplier ? (
                            <button
                              type="button"
                              className="product-supplier-link"
                              onClick={() => onOpenSupplier(supplier.id)}
                            >
                              <strong>{supplier.name}</strong>
                              {supplier.company_name && (
                                <small>{supplier.company_name}</small>
                              )}
                            </button>
                          ) : (
                            <div className="product-supplier-link static">
                              <strong>{supplier.name}</strong>
                              {supplier.company_name && (
                                <small>{supplier.company_name}</small>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="product-no-supplier">No supplier</span>
                        )}
                      </td>

                      <td>
                        {product.lastPurchaseDate ? (
                          <span className="product-purchase-date">
                            {formatDate(product.lastPurchaseDate)}
                          </span>
                        ) : (
                          <span className="product-no-supplier">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isBusiness ? (
        <section className="products-business-section">
          <div className="products-business-heading">
            <div>
              <div className="mini-label">BUSINESS INTELLIGENCE</div>
              <h2>Inventory Command Center</h2>
              <p>
                Understand inventory health, capital exposure, movement,
                replenishment pressure and supplier concentration.
              </p>
            </div>

            <div className="business-command-status">
              <span className="business-badge">BUSINESS</span>

              <span className="business-health-pill">
                <i />
                {inventoryAnalytics.healthLabel}
              </span>
            </div>
          </div>

          <div className="inventory-command-grid">
            <article className="inventory-command-hero">
              <div className="command-hero-top">
                <div>
                  <span className="command-eyebrow">
                    INVENTORY HEALTH
                  </span>

                  <h3>
                    {inventoryAnalytics.healthScore}
                    <small>%</small>
                  </h3>

                  <p>
                    A combined view of products currently below
                    their stock thresholds and products with no
                    available stock.
                  </p>
                </div>

                <div
                  className="inventory-health-ring"
                  style={{
                    "--health": `${inventoryAnalytics.healthScore}%`,
                  }}
                >
                  <span>
                    {inventoryAnalytics.healthScore}
                  </span>
                </div>
              </div>

              <div className="command-health-stats">
                <div>
                  <span>Products</span>
                  <strong>{products.length}</strong>
                </div>

                <div>
                  <span>Low Stock</span>
                  <strong>
                    {inventoryAnalytics.restockProducts.length}
                  </strong>
                </div>

                <div>
                  <span>Out of Stock</span>
                  <strong>
                    {products.filter(
                      (product) =>
                        Number(product.stock || 0) <= 0
                    ).length}
                  </strong>
                </div>
              </div>
            </article>

            <article className="inventory-command-value">
              <span className="command-eyebrow">
                CAPITAL POSITION
              </span>

              <strong>
                {formatMoney(inventoryAnalytics.totalValue)}
              </strong>

              <p>
                Current capital tied up in inventory at recorded
                cost price.
              </p>

              <div className="capital-breakdown">
                <div>
                  <span>Average product value</span>
                  <b>
                    {formatMoney(
                      inventoryAnalytics.averageProductValue
                    )}
                  </b>
                </div>

                <div>
                  <span>Highest-value product</span>
                  <b>
                    {inventoryAnalytics.highestValueProduct
                      ? formatMoney(
                          inventoryAnalytics.highestValueProduct.value
                        )
                      : "₦0"}
                  </b>
                </div>

                <div>
                  <span>Net movement</span>
                  <b>
                    {inventoryAnalytics.netMovement >= 0
                      ? "+"
                      : ""}
                    {inventoryAnalytics.netMovement.toLocaleString(
                      "en-NG"
                    )} units
                  </b>
                </div>
              </div>
            </article>
          </div>

          <div className="inventory-command-kpis">
            <div className="business-kpi business-kpi-green">
              <span>STOCK IN</span>
              <strong>
                {inventoryAnalytics.stockIn.toLocaleString("en-NG")}
              </strong>
              <small>Recorded incoming units</small>
            </div>

            <div className="business-kpi business-kpi-red">
              <span>STOCK OUT</span>
              <strong>
                {inventoryAnalytics.stockOut.toLocaleString("en-NG")}
              </strong>
              <small>Recorded outgoing units</small>
            </div>

            <div className="business-kpi business-kpi-gold">
              <span>RESTOCK QUEUE</span>
              <strong>
                {inventoryAnalytics.restockProducts.length}
              </strong>
              <small>Products requiring attention</small>
            </div>

            <div className="business-kpi business-kpi-blue">
              <span>14-DAY MOVEMENT</span>
              <strong>
                {inventoryAnalytics.days
                  .reduce(
                    (sum, day) =>
                      sum + day.in + day.out,
                    0
                  )
                  .toLocaleString("en-NG")}
              </strong>
              <small>Total units moved in the last 14 days</small>
            </div>
          </div>

          <article className="inventory-command-wide">
            <div className="inventory-analysis-header">
              <div>
                <div className="mini-label">MOVEMENT INTELLIGENCE</div>
                <h3>14-Day Stock Movement</h3>
                <p>
                  Daily incoming and outgoing inventory activity.
                </p>
              </div>

              <div className="movement-summary">
                <span>
                  {inventoryAnalytics.movementChange >= 0
                    ? "+"
                    : ""}
                  {inventoryAnalytics.movementChange.toFixed(0)}%
                </span>
                <small>Recent 7 days vs previous 7</small>
              </div>
            </div>

            <div className="inventory-trend-chart">
              <div className="trend-grid-lines">
                <span />
                <span />
                <span />
                <span />
              </div>

              {inventoryAnalytics.days.map((day) => {
                const maximum = Math.max(
                  ...inventoryAnalytics.days.map(
                    (item) =>
                      Math.max(
                        item.in,
                        item.out
                      )
                  ),
                  1
                );

                return (
                  <div
                    className="inventory-trend-day"
                    key={day.date}
                  >
                    <div className="trend-bars">
                      <span
                        className="trend-in"
                        style={{
                          height: `${Math.max(
                            3,
                            (day.in / maximum) * 100
                          )}%`,
                        }}
                        title={`Stock In: ${day.in}`}
                      />

                      <span
                        className="trend-out"
                        style={{
                          height: `${Math.max(
                            3,
                            (day.out / maximum) * 100
                          )}%`,
                        }}
                        title={`Stock Out: ${day.out}`}
                      />
                    </div>

                    <small>{day.label}</small>
                  </div>
                );
              })}
            </div>

            <div className="trend-legend">
              <span>
                <i className="trend-dot trend-dot-in" />
                Stock In
              </span>

              <span>
                <i className="trend-dot trend-dot-out" />
                Stock Out
              </span>

              <strong>
                {inventoryAnalytics.netMovement >= 0
                  ? "+"
                  : ""}
                {inventoryAnalytics.netMovement.toLocaleString(
                  "en-NG"
                )} net units
              </strong>
            </div>
          </article>

          <div className="inventory-business-grid">
            <article className="inventory-analysis-card">
              <div className="inventory-analysis-header">
                <div>
                  <div className="mini-label">FAST MOVERS</div>
                  <h3>Products moving fastest</h3>
                </div>
              </div>

              <div className="business-ranking-list">
                {inventoryAnalytics.fastMovers.length === 0 ? (
                  <div className="business-mini-empty">
                    No outgoing product movement recorded yet.
                  </div>
                ) : (
                  inventoryAnalytics.fastMovers.map(
                    (product, index) => (
                      <div
                        className="business-ranking-row"
                        key={product.id}
                      >
                        <span className="ranking-number">
                          #{index + 1}
                        </span>

                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {product.stock.toLocaleString(
                              "en-NG"
                            )} units currently available
                          </small>
                        </div>

                        <b>
                          {product.outUnits.toLocaleString(
                            "en-NG"
                          )} out
                        </b>
                      </div>
                    )
                  )
                )}
              </div>
            </article>

            <article className="inventory-analysis-card">
              <div className="inventory-analysis-header">
                <div>
                  <div className="mini-label">SLOW / IDLE STOCK</div>
                  <h3>Products needing review</h3>
                </div>
              </div>

              <div className="business-ranking-list">
                {inventoryAnalytics.inactiveProducts.length > 0 ? (
                  inventoryAnalytics.inactiveProducts.map(
                    (product, index) => (
                      <div
                        className="business-ranking-row"
                        key={product.id}
                      >
                        <span className="ranking-number muted">
                          IDLE
                        </span>

                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {product.stock.toLocaleString(
                              "en-NG"
                            )} units with no recorded movement
                          </small>
                        </div>

                        <b>
                          {formatMoney(
                            Number(product.stock || 0) *
                              Number(product.costPrice || 0)
                          )}
                        </b>
                      </div>
                    )
                  )
                ) : inventoryAnalytics.slowMovers.length === 0 ? (
                  <div className="business-mini-empty">
                    No slow or inactive products to review.
                  </div>
                ) : (
                  inventoryAnalytics.slowMovers.map(
                    (product) => (
                      <div
                        className="business-ranking-row"
                        key={product.id}
                      >
                        <span className="ranking-number muted">
                          WATCH
                        </span>

                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            Lower recorded movement
                          </small>
                        </div>

                        <b>
                          {product.outUnits.toLocaleString(
                            "en-NG"
                          )} out
                        </b>
                      </div>
                    )
                  )
                )}
              </div>
            </article>
          </div>

          <article className="inventory-command-wide">
            <div className="inventory-analysis-header">
              <div>
                <div className="mini-label">
                  RESTOCK INTELLIGENCE
                </div>
                <h3>Replenishment queue</h3>
                <p>
                  Suggested quantities are based on each product's
                  configured low-stock threshold.
                </p>
              </div>

              <span className="analysis-count">
                {inventoryAnalytics.restockProducts.length} ITEMS
              </span>
            </div>

            {inventoryAnalytics.restockProducts.length === 0 ? (
              <div className="business-success-state">
                <strong>Inventory is above configured thresholds.</strong>
                <span>No immediate replenishment pressure detected.</span>
              </div>
            ) : (
              <div className="business-restock-list">
                {inventoryAnalytics.restockProducts.map(
                  (product) => {
                    const supplier =
                      supplierMap[product.supplierId];

                    return (
                      <div
                        className="business-restock-row"
                        key={product.id}
                      >
                        <div className="restock-status">
                          <i
                            className={`restock-dot ${product.urgency}`}
                          />

                          <div>
                            <strong>{product.name}</strong>
                            <span>
                              {product.stock.toLocaleString(
                                "en-NG"
                              )} on hand · threshold{" "}
                              {product.threshold.toLocaleString(
                                "en-NG"
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="restock-recommendation">
                          <strong>
                            +{product.suggestedQuantity.toLocaleString(
                              "en-NG"
                            )}
                          </strong>
                          <span>suggested units</span>
                        </div>

                        <div className="restock-cost">
                          <strong>
                            {formatMoney(
                              product.estimatedCost
                            )}
                          </strong>
                          <span>estimated cost</span>
                        </div>

                        {supplier && onOpenSupplier ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenSupplier(supplier.id)
                            }
                          >
                            Supplier
                          </button>
                        ) : (
                          <span className="no-supplier-label">
                            No supplier
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </article>

          <div className="inventory-business-grid">
            <article className="inventory-analysis-card">
              <div className="inventory-analysis-header">
                <div>
                  <div className="mini-label">SUPPLIER EXPOSURE</div>
                  <h3>Inventory concentration</h3>
                </div>
              </div>

              <div className="supplier-exposure-list">
                {inventoryAnalytics.supplierAnalysis
                  .slice(0, 6)
                  .map((supplier) => (
                    <div
                      className="supplier-exposure-row"
                      key={supplier.id}
                    >
                      <div>
                        <strong>{supplier.name}</strong>
                        <span>
                          {supplier.products} product
                          {supplier.products === 1 ? "" : "s"} ·{" "}
                          {supplier.units.toLocaleString(
                            "en-NG"
                          )} units
                        </span>
                      </div>

                      <div className="supplier-exposure-value">
                        <strong>
                          {formatMoney(supplier.value)}
                        </strong>
                        <small>inventory value</small>
                      </div>
                    </div>
                  ))}
              </div>
            </article>

            <article className="inventory-analysis-card">
              <div className="inventory-analysis-header">
                <div>
                  <div className="mini-label">PRODUCT PERFORMANCE</div>
                  <h3>Most active products</h3>
                </div>
              </div>

              <div className="business-ranking-list">
                {inventoryAnalytics.topProducts.length === 0 ? (
                  <div className="business-mini-empty">
                    Product performance will appear as inventory
                    movements accumulate.
                  </div>
                ) : (
                  inventoryAnalytics.topProducts.map(
                    (product, index) => (
                      <div
                        className="business-ranking-row"
                        key={product.id}
                      >
                        <span className="ranking-number">
                          #{index + 1}
                        </span>

                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {product.in.toLocaleString("en-NG")} in ·{" "}
                            {product.out.toLocaleString("en-NG")} out ·{" "}
                            {Number(product.stock || 0).toLocaleString("en-NG")} in stock
                          </small>
                        </div>

                        <b>
                          {product.movementVelocity
                            ? `${product.movementVelocity.toFixed(1)}/day`
                            : "—"}
                        </b>

                        <small>
                          {product.stockCoverageDays != null
                            ? `${Math.round(product.stockCoverageDays)}d cover`
                            : "No velocity"}
                        </small>
                      </div>
                    )
                  )
                )}
              </div>
            </article>
            </div>

          <article className="inventory-command-wide">
            <div className="inventory-analysis-header">
              <div>
                <div className="mini-label">EXTENDED HISTORY</div>
                <h3>Business Inventory History</h3>
                <p>
                  Business users can review a deeper inventory
                  movement history.
                </p>
              </div>

              <span className="history-depth-badge">
                EXTENDED
              </span>
            </div>

            <div className="business-history-table-wrap">
              <table className="business-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Movement</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {activity.slice(0, 500).map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.occurred_at)}</td>
                      <td>
                        <strong>{item.product_name || "—"}</strong>
                      </td>
                      <td>
                        <span
                          className={`history-movement ${
                            item.direction === "in"
                              ? "in"
                              : "out"
                          }`}
                        >
                          {item.direction === "in"
                            ? "STOCK IN"
                            : "STOCK OUT"}
                        </span>
                      </td>
                      <td>
                        {Number(
                          item.quantity || 0
                        ).toLocaleString("en-NG")}
                      </td>
                      <td>{getActivityTitle(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : (
        <section className="products-business-banner premium-card">
          <div>
            <div className="mini-label">BUSINESS INVENTORY</div>
            <strong>Unlock deeper inventory intelligence</strong>
            <p>
              Get extended inventory history, movement trends,
              restock intelligence, supplier analysis, advanced
              valuation and product performance insights.
            </p>
          </div>

          <button
            type="button"
            onClick={onUpgrade}
          >
            Explore Business
          </button>
        </section>
      )}

      <section className="inventory-activity-card premium-card">
        <div className="activity-heading">
          <div>
            <div className="mini-label">AUDIT TRAIL</div>
            <h2>Inventory Activity</h2>
            <p>
              Follow stock-in and stock-out movements, including products returned by customers.
            </p>
          </div>

          <div className="activity-filters" role="tablist">
            <button
              className={activityFilter === "all" ? "active" : ""}
              onClick={() => setActivityFilter("all")}
            >
              All
            </button>
            <button
              className={activityFilter === "in" ? "active" : ""}
              onClick={() => setActivityFilter("in")}
            >
              Stock In
            </button>
            <button
              className={activityFilter === "out" ? "active" : ""}
              onClick={() => setActivityFilter("out")}
            >
              Stock Out
            </button>
          </div>
        </div>

        {activityLoading ? (
          <div className="activity-empty">
            <div className="activity-empty-icon">◌</div>
            <strong>Loading activity</strong>
            <span>Checking recent inventory movements.</span>
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="activity-empty">
            <div className="activity-empty-icon">↕</div>
            <strong>No inventory activity yet</strong>
            <span>
              Purchases, sales, and customer returns will appear here automatically.
            </span>
          </div>
        ) : (
          <div className="activity-list">
            {filteredActivity.map((item) => {
              const incoming = item.direction === "in";

              return (
                <article
                  className={`activity-item ${
                    incoming ? "activity-in" : "activity-out"
                  }`}
                  key={item.id}
                >
                  <div className="activity-marker">
                    <span>{incoming ? "↑" : "↓"}</span>
                  </div>

                  <div className="activity-main">
                    <div className="activity-date-row">
                      <time>{formatDate(item.occurred_at)}</time>
                      {formatDateTime(item.created_at) && (
                        <span>{formatDateTime(item.created_at)}</span>
                      )}
                    </div>

                    <div className="activity-product-row">
                      <strong>{item.product_name}</strong>
                      <b className="activity-quantity">
                        {incoming ? "+" : "−"}
                        {Number(item.quantity || 0).toLocaleString("en-NG")}
                        <span> units</span>
                      </b>
                    </div>

                    <p>{getActivityTitle(item)}</p>

                    <div className="activity-meta">
                      <span>{getActivityDescription(item)}</span>
                      {renderActivityMeta(item)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Products;
