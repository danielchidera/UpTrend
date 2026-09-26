import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  FileText,
  CircleDollarSign,
  Eye,
  Receipt,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";
import "./Customers.css";

function Customers({
  subscription,
  onUpgrade,
  onOpenInvoices,
  onCreateInvoice,
  customerToOpenId,
  onCustomerOpenHandled,
}) {
  const [customers, setCustomers] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );

  const loadCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCustomers([]);
        setCustomerInvoices([]);
        return;
      }

      const [
        customersResult,
        invoicesResult,
      ] = await Promise.all([
        supabase
          .from("uptrend_customers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("uptrend_invoices")
          .select(
            "id, customer_id, invoice_number, status, total, issue_date, due_date"
          )
          .eq("user_id", user.id),
      ]);

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      setCustomers(
        customersResult.data || []
      );

      setCustomerInvoices(
        invoicesResult.data || []
      );
    } catch (loadError) {
      console.error(
        "Customer loading error:",
        loadError
      );

      setError(
        "We couldn't load your customers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      !isBusiness ||
      !customerToOpenId ||
      customers.length === 0
    ) {
      return;
    }

    const customer = customers.find(
      (item) =>
        String(item.id) ===
        String(customerToOpenId)
    );

    if (!customer) {
      return;
    }

    setSelectedCustomer(customer);
    onCustomerOpenHandled?.();
  }, [
    isBusiness,
    customerToOpenId,
    customers,
    onCustomerOpenHandled,
  ]);

  const getCustomerStats = (customerId) => {
    const invoices =
      customerInvoices.filter(
        (invoice) =>
          invoice.customer_id ===
          customerId &&
          invoice.status !== "cancelled"
      );

    const billed = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.total || 0),
      0
    );

    const paid = invoices
      .filter(
        (invoice) =>
          invoice.status === "paid"
      )
      .reduce(
        (sum, invoice) =>
          sum + Number(invoice.total || 0),
        0
      );

    const outstanding = invoices
      .filter(
        (invoice) =>
          invoice.status === "draft" ||
          invoice.status === "sent" ||
          invoice.status === "overdue"
      )
      .reduce(
        (sum, invoice) =>
          sum + Number(invoice.total || 0),
        0
      );

    const overdue = invoices.filter(
      (invoice) =>
        invoice.status === "overdue"
    ).length;

    return {
      count: invoices.length,
      billed,
      paid,
      outstanding,
      overdue,
    };
  };

  const filteredCustomers = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        customer.name
          ?.toLowerCase()
          .includes(query) ||
        customer.phone
          ?.toLowerCase()
          .includes(query) ||
        customer.email
          ?.toLowerCase()
          .includes(query)
    );
  }, [customers, search]);

  const formatMoney = (value) => {
    return `₦${Number(value || 0).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const openAddForm = () => {
    setEditingCustomer(null);

    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });

    setError("");
    setShowForm(true);
  };

  const openEditForm = (customer) => {
    setEditingCustomer(customer);

    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingCustomer(null);
  };

  const updateField = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name =
      form.name.trim();

    if (!name) {
      setError(
        "Customer name is required."
      );

      return;
    }

    setSaving(true);
    setError("");

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
        name,
        phone:
          form.phone.trim() || null,
        email:
          form.email.trim() || null,
        address:
          form.address.trim() || null,
        notes:
          form.notes.trim() || null,
      };

      if (editingCustomer) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("uptrend_customers")
          .update(payload)
          .eq(
            "id",
            editingCustomer.id
          )
          .eq(
            "user_id",
            user.id
          )
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setCustomers(
          (current) =>
            current.map(
              (customer) =>
                customer.id ===
                editingCustomer.id
                  ? data
                  : customer
            )
        );
      } else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from("uptrend_customers")
          .insert({
            user_id: user.id,
            ...payload,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        setCustomers(
          (current) => [
            data,
            ...current,
          ]
        );
      }

      closeForm();
    } catch (saveError) {
      console.error(
        "Customer save error:",
        saveError
      );

      setError(
        saveError?.message ||
          "We couldn't save this customer."
      );
    } finally {
      setSaving(false);
    }
  };

  const openCustomerDetail = (customer) => {
    setSelectedCustomer(customer);
  };

  const closeCustomerDetail = () => {
    setSelectedCustomer(null);
  };

  const getCustomerInvoices = (customerId) => {
    return customerInvoices
      .filter(
        (invoice) =>
          invoice.customer_id === customerId &&
          invoice.status !== "cancelled"
      )
      .sort((a, b) => {
        const dateA = new Date(
          `${a.issue_date || "1970-01-01"}T00:00:00`
        ).getTime();

        const dateB = new Date(
          `${b.issue_date || "1970-01-01"}T00:00:00`
        ).getTime();

        return dateB - dateA;
      });
  };

  const handleDelete = async (
    customer
  ) => {
    const stats =
      getCustomerStats(
        customer.id
      );

    if (stats.count > 0) {
      const confirmed =
        window.confirm(
          `${customer.name} has ${stats.count} invoice${
            stats.count === 1
              ? ""
              : "s"
          }. Deleting this customer will leave those invoices without a customer. Continue?`
        );

      if (!confirmed) {
        return;
      }
    } else {
      const confirmed =
        window.confirm(
          `Delete ${customer.name}?`
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("uptrend_customers")
        .delete()
        .eq(
          "id",
          customer.id
        )
        .eq(
          "user_id",
          user.id
        );

      if (deleteError) {
        throw deleteError;
      }

      setCustomers(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              customer.id
          )
      );
    } catch (deleteError) {
      console.error(
        "Customer delete error:",
        deleteError
      );

      setError(
        deleteError?.message ||
          "We couldn't delete this customer."
      );
    }
  };

  if (!isBusiness) {
    return (
      <div className="customers-page">
        <BusinessGate
          title="Customer Management"
          description="Manage your customers, contact details and business relationships from one place."
          onUpgrade={onUpgrade}
        >
          <div />
        </BusinessGate>
      </div>
    );
  }

  return (
    <div className="customers-page">

      <div className="customers-page-top">
        <div>
          <div className="mini-label">
            BUSINESS
          </div>

          <h2>
            Customers
          </h2>

          <p>
            Keep your customer information organized in one place.
          </p>
        </div>

        <button
          type="button"
          className="customers-add-button"
          onClick={openAddForm}
        >
          <Plus size={17} />
          Add Customer
        </button>
      </div>

      {error && (
        <div className="customers-error">
          {error}
        </div>
      )}

      <section className="customers-toolbar premium-card">

        <div className="customers-count">
          <Users size={18} />

          <strong>
            {customers.length}
          </strong>

          <span>
            customer
            {customers.length === 1
              ? ""
              : "s"}
          </span>
        </div>

        <div className="customers-search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Search customers..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

      </section>

      {loading ? (
        <section className="customers-empty premium-card">
          Loading customers...
        </section>
      ) : filteredCustomers.length === 0 ? (
        <section className="customers-empty premium-card">

          <div className="customers-empty-icon">
            <Users size={25} />
          </div>

          <h3>
            {search
              ? "No customers found"
              : "No customers yet"}
          </h3>

          <p>
            {search
              ? "Try a different search."
              : "Add your first customer to start building your customer list."}
          </p>

          {!search && (
            <button
              type="button"
              onClick={openAddForm}
              className="customers-add-button"
            >
              <Plus size={17} />
              Add Customer
            </button>
          )}

        </section>
      ) : (
        <section className="customers-grid">

          {filteredCustomers.map(
            (customer) => {
              const stats =
                getCustomerStats(
                  customer.id
                );

              return (
                <article
                  className="customer-card premium-card"
                  key={customer.id}
                >

                  <div className="customer-card-top">

                    <div className="customer-avatar">
                      {customer.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="customer-card-actions">

                      <button
                        type="button"
                        onClick={() =>
                          openCustomerDetail(
                            customer
                          )
                        }
                        title="View customer"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(
                            customer
                          )
                        }
                        title="Edit customer"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            customer
                          )
                        }
                        title="Delete customer"
                      >
                        <Trash2 size={15} />
                      </button>

                    </div>

                  </div>

                  <h3>
                    {customer.name}
                  </h3>

                  {customer.phone && (
                    <span>
                      {customer.phone}
                    </span>
                  )}

                  {customer.email && (
                    <span>
                      {customer.email}
                    </span>
                  )}

                  {customer.address && (
                    <span>
                      {customer.address}
                    </span>
                  )}

                  <div className="customer-financials">

                    <button
                      type="button"
                      className="customer-financial-item"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId: customer.id,
                        })
                      }
                      title="View this customer's invoices"
                    >
                      <span>
                        <FileText size={13} />
                        Invoices
                      </span>

                      <strong>
                        {stats.count}
                      </strong>
                    </button>

                    <button
                      type="button"
                      className="customer-financial-item"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId: customer.id,
                        })
                      }
                      title="View billed invoices"
                    >
                      <span>
                        Billed
                      </span>

                      <strong>
                        {formatMoney(
                          stats.billed
                        )}
                      </strong>
                    </button>

                    <button
                      type="button"
                      className="customer-financial-item"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId: customer.id,
                          status: "paid",
                        })
                      }
                      title="View paid invoices"
                    >
                      <span>
                        Paid
                      </span>

                      <strong className="customer-paid">
                        {formatMoney(
                          stats.paid
                        )}
                      </strong>
                    </button>

                    <button
                      type="button"
                      className="customer-financial-item"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId: customer.id,
                          status: "outstanding",
                        })
                      }
                      title="View outstanding invoices"
                    >
                      <span>
                        Outstanding
                      </span>

                      <strong
                        className={
                          stats.outstanding > 0
                            ? "customer-outstanding"
                            : ""
                        }
                      >
                        {formatMoney(
                          stats.outstanding
                        )}
                      </strong>
                    </button>

                  </div>

                  {stats.overdue > 0 && (
                    <button
                      type="button"
                      className="customer-overdue"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId: customer.id,
                          status: "overdue",
                        })
                      }
                      title="View overdue invoices"
                    >
                      <CircleDollarSign size={14} />

                      {stats.overdue} overdue invoice
                      {stats.overdue === 1
                        ? ""
                        : "s"}
                    </button>
                  )}

                  {customer.notes && (
                    <p>
                      {customer.notes}
                    </p>
                  )}

                </article>
              );
            }
          )}

        </section>
      )}

      {selectedCustomer && (
        <div
          className="customer-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Customer details"
        >
          <div className="customer-detail-card">

            <div className="customer-detail-header">

              <div className="customer-detail-identity">

                <div className="customer-detail-avatar">
                  {selectedCustomer.name
                    ?.charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <div className="mini-label">
                    CUSTOMER PROFILE
                  </div>

                  <h3>
                    {selectedCustomer.name}
                  </h3>

                  <span>
                    Customer since{" "}
                    {selectedCustomer.created_at
                      ? new Date(
                          selectedCustomer.created_at
                        ).toLocaleDateString(
                          "en-NG",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : "—"}
                  </span>
                </div>

              </div>

              <button
                type="button"
                onClick={closeCustomerDetail}
                className="customer-detail-close"
                title="Close customer details"
              >
                <X size={18} />
              </button>

            </div>

            <div className="customer-detail-contact">

              {selectedCustomer.phone && (
                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedCustomer.phone}
                  </strong>
                </div>
              )}

              {selectedCustomer.email && (
                <div>
                  <span>Email</span>
                  <strong>
                    {selectedCustomer.email}
                  </strong>
                </div>
              )}

              {selectedCustomer.address && (
                <div>
                  <span>Address</span>
                  <strong>
                    {selectedCustomer.address}
                  </strong>
                </div>
              )}

            </div>

            {(() => {
              const detailStats =
                getCustomerStats(
                  selectedCustomer.id
                );

              const detailInvoices =
                getCustomerInvoices(
                  selectedCustomer.id
                );

              return (
                <>
                  <div className="customer-detail-stats">

                    <button
                      type="button"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId:
                            selectedCustomer.id,
                        })
                      }
                    >
                      <span>Invoices</span>
                      <strong>
                        {detailStats.count}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId:
                            selectedCustomer.id,
                        })
                      }
                    >
                      <span>Billed</span>
                      <strong>
                        {formatMoney(
                          detailStats.billed
                        )}
                      </strong>
                    </button>

                    <button
                      type="button"
                      className="detail-stat-paid"
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId:
                            selectedCustomer.id,
                          status: "paid",
                        })
                      }
                    >
                      <span>Paid</span>
                      <strong>
                        {formatMoney(
                          detailStats.paid
                        )}
                      </strong>
                    </button>

                    <button
                      type="button"
                      className={
                        detailStats.outstanding > 0
                          ? "detail-stat-outstanding"
                          : ""
                      }
                      onClick={() =>
                        onOpenInvoices?.({
                          customerId:
                            selectedCustomer.id,
                          status: "outstanding",
                        })
                      }
                    >
                      <span>Outstanding</span>
                      <strong>
                        {formatMoney(
                          detailStats.outstanding
                        )}
                      </strong>
                    </button>

                  </div>

                  <div className="customer-detail-section">

                    <div className="customer-detail-section-header">

                      <div>
                        <div className="mini-label">
                          BILLING
                        </div>

                        <h4>
                          Recent invoices
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenInvoices?.({
                            customerId:
                              selectedCustomer.id,
                          })
                        }
                      >
                        View all
                      </button>

                    </div>

                    {detailInvoices.length === 0 ? (
                      <div className="customer-detail-empty">
                        <FileText size={20} />

                        <span>
                          No invoices for this customer yet.
                        </span>
                      </div>
                    ) : (
                      <div className="customer-detail-invoices">

                        {detailInvoices
                          .slice(0, 5)
                          .map((invoice) => (
                            <button
                              type="button"
                              className="customer-detail-invoice"
                              key={invoice.id}
                              onClick={() =>
                                onOpenInvoices?.({
                                  customerId:
                                    selectedCustomer.id,
                                })
                              }
                            >

                              <div>
                                <strong>
                                  {invoice.invoice_number}
                                </strong>

                                <span>
                                  {invoice.issue_date
                                    ? new Date(
                                        `${invoice.issue_date}T00:00:00`
                                      ).toLocaleDateString(
                                        "en-NG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        }
                                      )
                                    : "—"}
                                </span>
                              </div>

                              <div>
                                <strong>
                                  {formatMoney(
                                    invoice.total
                                  )}
                                </strong>

                                <span
                                  className={`customer-detail-status customer-detail-status-${invoice.status}`}
                                >
                                  {invoice.status === "draft"
                                    ? "Pending"
                                    : invoice.status
                                      ?.charAt(0)
                                      .toUpperCase() +
                                        invoice.status?.slice(1)}
                                </span>
                              </div>

                            </button>
                          ))}

                      </div>
                    )}

                  </div>

                  {selectedCustomer.notes && (
                    <div className="customer-detail-notes">

                      <div className="mini-label">
                        NOTES
                      </div>

                      <p>
                        {selectedCustomer.notes}
                      </p>

                    </div>
                  )}

                  <div className="customer-detail-actions">

                    <button
                      type="button"
                      className="customer-create-invoice-button"
                      onClick={() => {
                        closeCustomerDetail();
                        onCreateInvoice?.(
                          selectedCustomer.id
                        );
                      }}
                    >
                      <Receipt size={15} />
                      Create Invoice
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeCustomerDetail();
                        openEditForm(
                          selectedCustomer
                        );
                      }}
                    >
                      <Pencil size={15} />
                      Edit Customer
                    </button>

                    {detailStats.overdue > 0 && (
                      <button
                        type="button"
                        className="customer-detail-overdue-button"
                        onClick={() =>
                          onOpenInvoices?.({
                            customerId:
                              selectedCustomer.id,
                            status: "overdue",
                          })
                        }
                      >
                        <CircleDollarSign size={15} />
                        View {detailStats.overdue} Overdue
                      </button>
                    )}

                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}

      {showForm && (
        <div className="customer-modal">

          <div className="customer-modal-card">

            <div className="customer-modal-header">

              <div>
                <div className="mini-label">
                  {editingCustomer
                    ? "EDIT CUSTOMER"
                    : "NEW CUSTOMER"}
                </div>

                <h3>
                  {editingCustomer
                    ? "Update customer"
                    : "Add customer"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="customer-form"
            >

              <label>
                <span>
                  Customer name *
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="Enter customer name"
                  autoFocus
                />
              </label>

              <div className="customer-form-grid">

                <label>
                  <span>
                    Phone
                  </span>

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="080..."
                  />
                </label>

                <label>
                  <span>
                    Email
                  </span>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="customer@example.com"
                  />
                </label>

              </div>

              <label>
                <span>
                  Address
                </span>

                <input
                  value={form.address}
                  onChange={(event) =>
                    updateField(
                      "address",
                      event.target.value
                    )
                  }
                  placeholder="Customer address"
                />
              </label>

              <label>
                <span>
                  Notes
                </span>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Optional notes"
                  rows="4"
                />
              </label>

              <div className="customer-form-actions">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingCustomer
                      ? "Update Customer"
                      : "Save Customer"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Customers;
