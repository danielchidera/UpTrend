import { useEffect, useMemo, useState } from "react";
import "./Suppliers.css";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const todayKey = () => new Date().toISOString().slice(0, 10);

const getSupplierForm = () => ({
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active",
});

const getPurchaseForm = () => ({
  supplierId: "",
  productId: "",
  newProductName: "",
  quantity: "",
  unitCost: "",
  purchaseDate: todayKey(),
  dueDate: "",
  notes: "",
});

const getPaymentForm = () => ({
  amount: "",
  paymentDate: todayKey(),
  paymentMethod: "",
  reference: "",
  notes: "",
});

function Suppliers({
  subscription,
  onUpgrade,
  supplierToOpenId,
  onSupplierOpenHandled,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);

  const [supplierForm, setSupplierForm] = useState(getSupplierForm());
  const [purchaseForm, setPurchaseForm] = useState(getPurchaseForm());
  const [purchaseProductMode, setPurchaseProductMode] =
    useState("existing");
  const [paymentForm, setPaymentForm] = useState(getPaymentForm());

  const loadData = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const [
        { data: supplierData, error: supplierError },
        { data: productData, error: productError },
        { data: purchaseData, error: purchaseError },
        { data: paymentData, error: paymentError },
      ] = await Promise.all([
        supabase
          .from("uptrend_suppliers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select("id, name, cost_price, stock, low_stock_at")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),

        supabase
          .from("uptrend_supplier_purchases")
          .select("*")
          .eq("user_id", user.id)
          .order("purchase_date", { ascending: false }),

        supabase
          .from("uptrend_supplier_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("payment_date", { ascending: false }),
      ]);

      if (supplierError) throw supplierError;
      if (productError) throw productError;
      if (purchaseError) throw purchaseError;
      if (paymentError) throw paymentError;

      setSuppliers(supplierData || []);
      setProducts(productData || []);
      setPurchases(purchaseData || []);
      setPayments(paymentData || []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      alert(error.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!supplierToOpenId || loading) return;

    const supplier = suppliers.find(
      (item) => item.id === supplierToOpenId
    );

    if (supplier) {
      openDetails(supplier);
    }

    if (onSupplierOpenHandled) {
      onSupplierOpenHandled();
    }
  }, [
    supplierToOpenId,
    loading,
    suppliers,
    onSupplierOpenHandled,
  ]);

  const supplierMap = useMemo(() => {
    return suppliers.reduce((map, supplier) => {
      map[supplier.id] = supplier;
      return map;
    }, {});
  }, [suppliers]);

  const paymentTotals = useMemo(() => {
    return payments.reduce((totals, payment) => {
      if (!totals[payment.purchase_id]) {
        totals[payment.purchase_id] = 0;
      }

      totals[payment.purchase_id] += Number(payment.amount || 0);

      return totals;
    }, {});
  }, [payments]);

  const enrichedPurchases = useMemo(() => {
    const today = todayKey();

    return purchases.map((purchase) => {
      const totalAmount = Number(purchase.total_amount || 0);

      const paid = Math.min(
        totalAmount,
        Number(paymentTotals[purchase.id] || 0)
      );

      const balance = Math.max(totalAmount - paid, 0);

      let calculatedStatus = purchase.status;

      if (purchase.status !== "cancelled") {
        if (balance <= 0 && totalAmount > 0) {
          calculatedStatus = "paid";
        } else if (
          purchase.due_date &&
          purchase.due_date < today
        ) {
          calculatedStatus =
            paid > 0 ? "partially_paid" : "overdue";
        } else if (paid > 0) {
          calculatedStatus = "partially_paid";
        } else {
          calculatedStatus = "pending";
        }
      }

      return {
        ...purchase,
        supplier: supplierMap[purchase.supplier_id] || null,
        totalAmount,
        paid,
        balance,
        calculatedStatus,
      };
    });
  }, [purchases, paymentTotals, supplierMap]);

  const enrichedSuppliers = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierPurchases = enrichedPurchases.filter(
        (purchase) => purchase.supplier_id === supplier.id
      );

      const totalPurchases = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.totalAmount,
        0
      );

      const totalPaid = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.paid,
        0
      );

      const outstanding = supplierPurchases.reduce(
        (sum, purchase) => sum + purchase.balance,
        0
      );

      const overdue = supplierPurchases.reduce(
        (sum, purchase) =>
          sum +
          (purchase.calculatedStatus === "overdue"
            ? purchase.balance
            : 0),
        0
      );

      return {
        ...supplier,
        purchaseCount: supplierPurchases.length,
        totalPurchases,
        totalPaid,
        outstanding,
        overdue,
      };
    });
  }, [suppliers, enrichedPurchases]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedSuppliers.filter((supplier) => {
      const matchesSearch =
        !query ||
        supplier.name?.toLowerCase().includes(query) ||
        supplier.company_name?.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        supplier.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enrichedSuppliers, search, statusFilter]);

  const overview = useMemo(() => {
    const activeSuppliers = suppliers.filter(
      (supplier) => supplier.status === "active"
    ).length;

    const totalPurchases = enrichedPurchases.reduce(
      (sum, purchase) => sum + purchase.totalAmount,
      0
    );

    const totalPaid = enrichedPurchases.reduce(
      (sum, purchase) => sum + purchase.paid,
      0
    );

    const outstanding = enrichedPurchases.reduce(
      (sum, purchase) => sum + purchase.balance,
      0
    );

    const overdue = enrichedPurchases.reduce(
      (sum, purchase) =>
        sum +
        (purchase.calculatedStatus === "overdue"
          ? purchase.balance
          : 0),
      0
    );

    return {
      activeSuppliers,
      totalPurchases,
      totalPaid,
      outstanding,
      overdue,
    };
  }, [suppliers, enrichedPurchases]);

  const selectedSupplier = useMemo(
    () =>
      enrichedSuppliers.find(
        (supplier) => supplier.id === selectedSupplierId
      ) || null,
    [enrichedSuppliers, selectedSupplierId]
  );

  const selectedPurchaseProduct = useMemo(
    () =>
      products.find(
        (product) => product.id === purchaseForm.productId
      ) || null,
    [products, purchaseForm.productId]
  );

  const purchaseQuantity = Number(purchaseForm.quantity || 0);
  const purchaseUnitCost = Number(purchaseForm.unitCost || 0);
  const calculatedPurchaseTotal =
    purchaseQuantity > 0 && purchaseUnitCost > 0
      ? purchaseQuantity * purchaseUnitCost
      : 0;

  const selectedPurchase = useMemo(
    () =>
      enrichedPurchases.find(
        (purchase) => purchase.id === selectedPurchaseId
      ) || null,
    [enrichedPurchases, selectedPurchaseId]
  );

  const selectedSupplierPurchases = useMemo(() => {
    if (!selectedSupplier) return [];

    return enrichedPurchases.filter(
      (purchase) =>
        purchase.supplier_id === selectedSupplier.id
    );
  }, [enrichedPurchases, selectedSupplier]);

  const selectedPurchasePayments = useMemo(() => {
    if (!selectedPurchase) return [];

    return payments
      .filter(
        (payment) =>
          payment.purchase_id === selectedPurchase.id
      )
      .sort((a, b) =>
        String(b.payment_date).localeCompare(
          String(a.payment_date)
        )
      );
  }, [payments, selectedPurchase]);

  const openSupplierForm = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);

      setSupplierForm({
        name: supplier.name || "",
        companyName: supplier.company_name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        notes: supplier.notes || "",
        status: supplier.status || "active",
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm(getSupplierForm());
    }

    setShowSupplierForm(true);
  };

  const closeSupplierForm = () => {
    setShowSupplierForm(false);
    setEditingSupplier(null);
    setSupplierForm(getSupplierForm());
  };

  const saveSupplier = async (event) => {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      alert("Enter the supplier name.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const payload = {
        name: supplierForm.name.trim(),
        company_name:
          supplierForm.companyName.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        address: supplierForm.address.trim() || null,
        notes: supplierForm.notes.trim() || null,
        status: supplierForm.status,
      };

      let error;

      if (editingSupplier) {
        ({ error } = await supabase
          .from("uptrend_suppliers")
          .update(payload)
          .eq("id", editingSupplier.id)
          .eq("user_id", user.id));
      } else {
        ({ error } = await supabase
          .from("uptrend_suppliers")
          .insert({
            ...payload,
            user_id: user.id,
          }));
      }

      if (error) throw error;

      closeSupplierForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save supplier:", error);
      alert(error.message || "Unable to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (supplier) => {
    const purchaseCount = enrichedPurchases.filter(
      (purchase) => purchase.supplier_id === supplier.id
    ).length;

    const message =
      purchaseCount > 0
        ? `Delete "${supplier.name}"? This supplier has ${purchaseCount} purchase record(s), which will also be deleted.`
        : `Delete "${supplier.name}"?`;

    if (!window.confirm(message)) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error } = await supabase
        .from("uptrend_suppliers")
        .delete()
        .eq("id", supplier.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (selectedSupplierId === supplier.id) {
        setSelectedSupplierId(null);
        setShowDetails(false);
      }

      await loadData();
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      alert(error.message || "Unable to delete supplier.");
    }
  };

  const openDetails = (supplier) => {
    setSelectedSupplierId(supplier.id);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedSupplierId(null);
  };

  const openPurchaseForm = (supplier = null) => {
    setPurchaseForm({
      ...getPurchaseForm(),
      supplierId:
        supplier?.id ||
        selectedSupplier?.id ||
        "",
    });

    setPurchaseProductMode("existing");
    setShowPurchaseForm(true);
  };

  const closePurchaseForm = () => {
    setShowPurchaseForm(false);
    setPurchaseForm(getPurchaseForm());
    setPurchaseProductMode("existing");
  };

  const openPaymentForm = (purchase) => {
    if (!purchase) return;

    if (Number(purchase.balance || 0) <= 0) {
      alert("This purchase has no outstanding balance.");
      return;
    }

    setShowDetails(true);
    setSelectedPurchaseId(purchase.id);
    setPaymentForm(getPaymentForm());
    setShowPaymentForm(true);
  };

  const openPaymentHistory = (purchase) => {
    if (!purchase) return;

    setShowDetails(true);
    setShowPaymentForm(false);
    setSelectedPurchaseId(purchase.id);
  };

  const closePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedPurchaseId(null);
    setPaymentForm(getPaymentForm());
  };


  const savePurchase = async (event) => {
    event.preventDefault();

    const quantity = Number(purchaseForm.quantity);
    const unitCost = Number(purchaseForm.unitCost);

    if (!purchaseForm.supplierId) {
      alert("Select a supplier.");
      return;
    }

    if (purchaseProductMode === "existing") {
      if (!purchaseForm.productId) {
        alert("Select an existing product.");
        return;
      }
    } else {
      if (!purchaseForm.newProductName.trim()) {
        alert("Enter the new product name.");
        return;
      }
    }

    if (!quantity || quantity <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    if (!unitCost || unitCost <= 0) {
      alert("Enter a valid cost price.");
      return;
    }

    if (!purchaseForm.purchaseDate) {
      alert("Select the purchase date.");
      return;
    }

    setPurchaseSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { data, error } = await supabase.rpc(
        "record_supplier_purchase",
        {
          p_supplier_id: purchaseForm.supplierId,

          p_product_id:
            purchaseProductMode === "existing"
              ? purchaseForm.productId
              : null,

          p_new_product_name:
            purchaseProductMode === "new"
              ? purchaseForm.newProductName.trim()
              : null,

          p_quantity: quantity,
          p_unit_cost: unitCost,
          p_purchase_date: purchaseForm.purchaseDate,
          p_due_date: purchaseForm.dueDate || null,
          p_notes: purchaseForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      console.log("Supplier purchase recorded:", data);

      closePurchaseForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save purchase:", error);
      alert(
        error.message ||
          "Unable to record supplier purchase."
      );
    } finally {
      setPurchaseSaving(false);
    }
  };

  const savePayment = async (event) => {
    event.preventDefault();

    if (!selectedPurchase) {
      alert("No purchase is selected.");
      return;
    }

    const amount = Number(paymentForm.amount);
    const balance = Number(selectedPurchase.balance || 0);

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

      if (!user) throw new Error("Your session has expired.");

      const { error } = await supabase
        .from("uptrend_supplier_payments")
        .insert({
          purchase_id: selectedPurchase.id,
          supplier_id: selectedPurchase.supplier_id,
          user_id: user.id,
          amount,
          payment_date: paymentForm.paymentDate,
          payment_method:
            paymentForm.paymentMethod.trim() || null,
          reference:
            paymentForm.reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
        });

      if (error) throw error;

      closePaymentForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save supplier payment:", error);
      alert(error.message || "Unable to record supplier payment.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const deletePurchase = async (purchase) => {
    if (
      !window.confirm(
        `Delete "${
          purchase.product_name ||
          purchase.description ||
          "this purchase"
        }"? Its payment history will also be deleted.`
      )
    ) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Your session has expired.");

      const { error } = await supabase
        .from("uptrend_supplier_purchases")
        .delete()
        .eq("id", purchase.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (selectedPurchaseId === purchase.id) {
        setSelectedPurchaseId(null);
      }

      await loadData();
    } catch (error) {
      console.error("Failed to delete purchase:", error);
      alert(error.message || "Unable to delete purchase.");
    }
  };

  const statusLabel = (status) => {
    const labels = {
      pending: "Pending",
      partially_paid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    return labels[status] || status;
  };

  return (
    <BusinessGate
      subscription={subscription}
      onUpgrade={onUpgrade}
      title="Suppliers"
      description="Manage suppliers, purchases, balances and supplier payments."
    >
      <div className="inner-page suppliers-page">

        <div className="suppliers-header">
          <div>
            <span className="suppliers-eyebrow">
              BUSINESS MANAGEMENT
            </span>

            <h1>Suppliers</h1>

            <p>
              Manage supplier relationships, purchases and
              outstanding balances.
            </p>
          </div>

          <div className="suppliers-header-actions">
            <button
              className="supplier-secondary-btn"
              onClick={() => openPurchaseForm()}
            >
              + Purchase
            </button>

            <button
              className="supplier-primary-btn"
              onClick={() => openSupplierForm()}
            >
              + Add Supplier
            </button>
          </div>
        </div>

        <section className="supplier-overview">

          <div className="supplier-stat-card">
            <span>Active Suppliers</span>
            <strong>{overview.activeSuppliers}</strong>
            <small>Current supplier relationships</small>
          </div>

          <div className="supplier-stat-card">
            <span>Total Purchases</span>
            <strong>{money(overview.totalPurchases)}</strong>
            <small>Total supplier purchases</small>
          </div>

          <div className="supplier-stat-card">
            <span>Total Paid</span>
            <strong>{money(overview.totalPaid)}</strong>
            <small>Recorded supplier payments</small>
          </div>

          <div className="supplier-stat-card supplier-stat-warning">
            <span>Outstanding</span>
            <strong>{money(overview.outstanding)}</strong>
            <small>Amount still owed</small>
          </div>

          <div className="supplier-stat-card supplier-stat-danger">
            <span>Overdue</span>
            <strong>{money(overview.overdue)}</strong>
            <small>Overdue supplier balances</small>
          </div>

        </section>

        <section className="suppliers-toolbar">

          <div className="supplier-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="supplier-filters">
            {["all", "active", "inactive"].map((status) => (
              <button
                key={status}
                className={
                  statusFilter === status ? "active" : ""
                }
                onClick={() => setStatusFilter(status)}
              >
                {status === "all"
                  ? "All"
                  : status === "active"
                  ? "Active"
                  : "Inactive"}
              </button>
            ))}
          </div>

        </section>

        <section className="suppliers-section">

          <div className="section-heading">
            <div>
              <h2>Supplier Directory</h2>
              <p>
                {filteredSuppliers.length} supplier
                {filteredSuppliers.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="supplier-empty">
              Loading suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="supplier-empty">
              <strong>No suppliers found</strong>

              <span>
                Add your first supplier to start tracking
                supplier purchases and balances.
              </span>

              <button
                className="supplier-primary-btn"
                onClick={() => openSupplierForm()}
              >
                + Add Supplier
              </button>
            </div>
          ) : (
            <div className="supplier-table-wrap">

              <table className="supplier-table">

                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Purchases</th>
                    <th>Total Purchased</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>

                      <td>
                        <button
                          className="supplier-name-button"
                          onClick={() => openDetails(supplier)}
                        >
                          <strong>{supplier.name}</strong>

                          {supplier.company_name && (
                            <small>
                              {supplier.company_name}
                            </small>
                          )}
                        </button>
                      </td>

                      <td>{supplier.purchaseCount}</td>

                      <td>
                        {money(supplier.totalPurchases)}
                      </td>

                      <td>
                        {money(supplier.totalPaid)}
                      </td>

                      <td>
                        <strong
                          className={
                            supplier.outstanding > 0
                              ? "supplier-balance"
                              : "supplier-paid"
                          }
                        >
                          {money(supplier.outstanding)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`supplier-status ${supplier.status}`}
                        >
                          {supplier.status === "active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="supplier-row-actions">

                          <button
                            onClick={() => openDetails(supplier)}
                          >
                            View
                          </button>

                          <button
                            onClick={() =>
                              openSupplierForm(supplier)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="danger"
                            onClick={() =>
                              deleteSupplier(supplier)
                            }
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


        {showSupplierForm && (
          <div className="supplier-modal-backdrop">
            <div className="supplier-modal">

              <div className="supplier-modal-header">
                <div>
                  <span>SUPPLIER</span>

                  <h2>
                    {editingSupplier
                      ? "Edit Supplier"
                      : "Add Supplier"}
                  </h2>
                </div>

                <button
                  className="supplier-close"
                  onClick={closeSupplierForm}
                >
                  ×
                </button>
              </div>

              <form onSubmit={saveSupplier}>

                <div className="supplier-form-grid">

                  <label>
                    Supplier Name *
                    <input
                      value={supplierForm.name}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. John Supplies"
                    />
                  </label>

                  <label>
                    Company Name
                    <input
                      value={supplierForm.companyName}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          companyName: event.target.value,
                        }))
                      }
                      placeholder="Company name"
                    />
                  </label>

                  <label>
                    Phone
                    <input
                      value={supplierForm.phone}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="Phone number"
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="Email address"
                    />
                  </label>

                  <label className="supplier-form-full">
                    Address
                    <input
                      value={supplierForm.address}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Supplier address"
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={supplierForm.status}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>

                  <label className="supplier-form-full">
                    Notes
                    <textarea
                      value={supplierForm.notes}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Additional notes..."
                      rows="4"
                    />
                  </label>

                </div>

                <div className="supplier-form-actions">

                  <button
                    type="button"
                    className="supplier-secondary-btn"
                    onClick={closeSupplierForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="supplier-primary-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingSupplier
                      ? "Save Changes"
                      : "Add Supplier"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

        {showPurchaseForm && (
          <div className="supplier-modal-backdrop">
            <div className="supplier-modal">

              <div className="supplier-modal-header">
                <div>
                  <span>PURCHASE</span>
                  <h2>Record Supplier Purchase</h2>
                </div>

                <button
                  className="supplier-close"
                  onClick={closePurchaseForm}
                >
                  ×
                </button>
              </div>

              <form onSubmit={savePurchase}>

                <div className="supplier-form-grid">

                  <label className="supplier-form-full">
                    Supplier *
                    <select
                      value={purchaseForm.supplierId}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          supplierId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select supplier
                      </option>

                      {suppliers
                        .filter(
                          (supplier) =>
                            supplier.status === "active"
                        )
                        .map((supplier) => (
                          <option
                            key={supplier.id}
                            value={supplier.id}
                          >
                            {supplier.name}
                            {supplier.company_name
                              ? ` — ${supplier.company_name}`
                              : ""}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="supplier-form-full">
                    <div className="supplier-product-mode-header">
                      <span>Product *</span>

                      <div className="supplier-product-mode-toggle">
                        <button
                          type="button"
                          className={
                            purchaseProductMode === "existing"
                              ? "active"
                              : ""
                          }
                          onClick={() => {
                            setPurchaseProductMode("existing");
                            setPurchaseForm((current) => ({
                              ...current,
                              newProductName: "",
                            }));
                          }}
                        >
                          Existing Product
                        </button>

                        <button
                          type="button"
                          className={
                            purchaseProductMode === "new"
                              ? "active"
                              : ""
                          }
                          onClick={() => {
                            setPurchaseProductMode("new");
                            setPurchaseForm((current) => ({
                              ...current,
                              productId: "",
                            }));
                          }}
                        >
                          + New Product
                        </button>
                      </div>
                    </div>

                    {purchaseProductMode === "existing" ? (
                      <select
                        value={purchaseForm.productId}
                        onChange={(event) => {
                          const productId = event.target.value;

                          const product = products.find(
                            (item) => item.id === productId
                          );

                          setPurchaseForm((current) => ({
                            ...current,
                            productId,
                            unitCost:
                              product &&
                              Number(product.cost_price || 0) > 0
                                ? String(product.cost_price)
                                : current.unitCost,
                          }));
                        }}
                      >
                        <option value="">
                          Select existing product
                        </option>

                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                          >
                            {product.name}
                            {" — Stock: "}
                            {Number(product.stock || 0)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={purchaseForm.newProductName}
                        onChange={(event) =>
                          setPurchaseForm((current) => ({
                            ...current,
                            newProductName: event.target.value,
                          }))
                        }
                        placeholder="Enter new product name"
                      />
                    )}
                  </div>

                  <div className="supplier-product-mode-note supplier-form-full">
                    {purchaseProductMode === "existing" ? (
                      <span>
                        Select a product already in your inventory.
                        The purchased quantity will be added to its
                        existing stock.
                      </span>
                    ) : (
                      <span>
                        A new product will be created automatically
                        and its initial stock will be set to the
                        quantity purchased.
                      </span>
                    )}
                  </div>

                  <label>
                    Quantity *
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={purchaseForm.quantity}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      placeholder="e.g. 20"
                    />
                  </label>

                  <label>
                    Cost Price Per Unit *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.unitCost}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          unitCost: event.target.value,
                        }))
                      }
                      placeholder="e.g. 2000"
                    />
                  </label>

                  <div className="supplier-calculated-total">
                    <span>Total Purchase</span>
                    <strong>
                      {money(calculatedPurchaseTotal)}
                    </strong>
                    <small>
                      {purchaseQuantity || 0} ×{" "}
                      {money(purchaseUnitCost)}
                    </small>
                  </div>

                  <label>
                    Purchase Date *
                    <input
                      type="date"
                      value={purchaseForm.purchaseDate}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          purchaseDate: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Due Date
                    <input
                      type="date"
                      value={purchaseForm.dueDate}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="supplier-form-full">
                    Notes
                    <textarea
                      value={purchaseForm.notes}
                      onChange={(event) =>
                        setPurchaseForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Purchase notes..."
                      rows="4"
                    />
                  </label>

                </div>

                <div className="supplier-form-actions">

                  <button
                    type="button"
                    className="supplier-secondary-btn"
                    onClick={closePurchaseForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="supplier-primary-btn"
                    disabled={purchaseSaving}
                  >
                    {purchaseSaving
                      ? "Saving..."
                      : "Record Purchase"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

        {showPaymentForm && selectedPurchase && (
          <div className="supplier-modal-backdrop">
            <div className="supplier-modal supplier-payment-modal">

              <div className="supplier-modal-header">
                <div>
                  <span>SUPPLIER PAYMENT</span>
                  <h2>Record Payment</h2>

                  <small>
                    Remaining:{" "}
                    {money(selectedPurchase.balance)}
                  </small>
                </div>

                <button
                  className="supplier-close"
                  onClick={closePaymentForm}
                >
                  ×
                </button>
              </div>

              <form onSubmit={savePayment}>

                <div className="supplier-payment-summary">

                  <div>
                    <span>Purchase</span>
                    <strong>
                      {selectedPurchase.product_name ||
                        selectedPurchase.description ||
                        "Purchase"}
                    </strong>
                  </div>

                  <div>
                    <span>Supplier</span>
                    <strong>
                      {selectedPurchase.supplier?.name ||
                        "Unknown supplier"}
                    </strong>
                  </div>

                  <div>
                    <span>Outstanding</span>
                    <strong>
                      {money(selectedPurchase.balance)}
                    </strong>
                  </div>

                </div>

                <div className="supplier-form-grid">

                  <label>
                    Amount *
                    <input
                      type="number"
                      min="0"
                      max={selectedPurchase.balance}
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    Payment Date *
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          paymentDate: event.target.value,
                        }))
                      }
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
                      <option value="">
                        Select method
                      </option>
                      <option value="cash">Cash</option>
                      <option value="transfer">
                        Bank Transfer
                      </option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label>
                    Reference
                    <input
                      value={paymentForm.reference}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                      placeholder="Transaction reference"
                    />
                  </label>

                  <label className="supplier-form-full">
                    Notes
                    <textarea
                      value={paymentForm.notes}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Payment notes..."
                      rows="3"
                    />
                  </label>

                </div>

                <div className="supplier-form-actions">

                  <button
                    type="button"
                    className="supplier-secondary-btn"
                    onClick={closePaymentForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="supplier-primary-btn"
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

        {showDetails && selectedSupplier && (
          <div className="supplier-modal-backdrop">
            <div className="supplier-modal supplier-details-modal">

              <div className="supplier-modal-header">
                <div>
                  <span>SUPPLIER PROFILE</span>

                  <h2>{selectedSupplier.name}</h2>

                  {selectedSupplier.company_name && (
                    <small>
                      {selectedSupplier.company_name}
                    </small>
                  )}
                </div>

                <button
                  className="supplier-close"
                  onClick={closeDetails}
                >
                  ×
                </button>
              </div>

              <div className="supplier-profile-grid">

                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedSupplier.phone || "—"}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedSupplier.email || "—"}
                  </strong>
                </div>

                <div>
                  <span>Address</span>
                  <strong>
                    {selectedSupplier.address || "—"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {selectedSupplier.status === "active"
                      ? "Active"
                      : "Inactive"}
                  </strong>
                </div>

              </div>

              <div className="supplier-detail-stats">

                <div>
                  <span>Purchased</span>
                  <strong>
                    {money(selectedSupplier.totalPurchases)}
                  </strong>
                </div>

                <div>
                  <span>Paid</span>
                  <strong>
                    {money(selectedSupplier.totalPaid)}
                  </strong>
                </div>

                <div>
                  <span>Outstanding</span>
                  <strong>
                    {money(selectedSupplier.outstanding)}
                  </strong>
                </div>

                <div>
                  <span>Overdue</span>
                  <strong>
                    {money(selectedSupplier.overdue)}
                  </strong>
                </div>

              </div>

              <div className="supplier-detail-actions">

                <button
                  className="supplier-primary-btn"
                  onClick={() =>
                    openPurchaseForm(selectedSupplier)
                  }
                >
                  + Record Purchase
                </button>

                <button
                  className="supplier-secondary-btn"
                  onClick={() =>
                    openSupplierForm(selectedSupplier)
                  }
                >
                  Edit Supplier
                </button>

              </div>

              <div className="supplier-history">

                <div className="section-heading">
                  <div>
                    <h3>Purchase History</h3>
                    <p>
                      {selectedSupplierPurchases.length} record
                      {selectedSupplierPurchases.length === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>
                </div>

                {selectedSupplierPurchases.length === 0 ? (
                  <div className="supplier-empty compact">
                    No purchases recorded yet.
                  </div>
                ) : (
                  <div className="supplier-purchase-list">

                    {selectedSupplierPurchases.map(
                      (purchase) => (
                        <div
                          className="supplier-purchase-card"
                          key={purchase.id}
                        >

                          <div className="supplier-purchase-main">
                            <strong>
                              {purchase.product_name ||
                                purchase.description ||
                                "Purchase"}
                            </strong>

                            <span>
                              {purchase.purchase_date}
                              {" • "}
                              {Number(purchase.quantity || 0)} units
                            </span>
                          </div>

                          <div className="supplier-purchase-money">
                            <span>
                              Total{" "}
                              {money(purchase.totalAmount)}
                            </span>

                            <span>
                              Paid {money(purchase.paid)}
                            </span>

                            <strong>
                              Balance{" "}
                              {money(purchase.balance)}
                            </strong>
                          </div>

                          <div className="supplier-purchase-actions">

                            <span
                              className={`supplier-status purchase-${purchase.calculatedStatus}`}
                            >
                              {statusLabel(
                                purchase.calculatedStatus
                              )}
                            </span>

                            {purchase.balance > 0 && (
                              <button
                                className="supplier-pay-btn"
                                onClick={() =>
                                  openPaymentForm(purchase)
                                }
                              >
                                Pay
                              </button>
                            )}

                            <button
                              className="supplier-view-btn"
                              onClick={() =>
                                openPaymentHistory(purchase)
                              }
                            >
                              History
                            </button>

                            <button
                              className="supplier-delete-btn"
                              onClick={() =>
                                deletePurchase(purchase)
                              }
                            >
                              Delete
                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>


              {selectedPurchase && (
                <div className="supplier-payment-history">

                  <div className="section-heading">
                    <div>
                      <h3>Payment History</h3>
                      <p>
                        {selectedPurchase.description}
                      </p>
                    </div>

                    <button
                      className="supplier-close-history"
                      onClick={() =>
                        setSelectedPurchaseId(null)
                      }
                    >
                      Close
                    </button>
                  </div>

                  {selectedPurchasePayments.length === 0 ? (
                    <div className="supplier-empty compact">
                      No payments recorded yet.
                    </div>
                  ) : (
                    <div className="supplier-payment-list">

                      {selectedPurchasePayments.map(
                        (payment) => (
                          <div
                            className="supplier-payment-row"
                            key={payment.id}
                          >

                            <div>
                              <strong>
                                {money(payment.amount)}
                              </strong>

                              <span>
                                {payment.payment_date}
                              </span>
                            </div>

                            <div>
                              <span>
                                {payment.payment_method ||
                                  "—"}
                              </span>

                              <small>
                                {payment.reference ||
                                  "No reference"}
                              </small>
                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </BusinessGate>
  );
}

export default Suppliers;
