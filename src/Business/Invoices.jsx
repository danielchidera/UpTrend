import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  FileText,
  Pencil,
  Trash2,
  X,
  Filter,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";
import "./Invoices.css";
import InvoiceForm from "./InvoiceForm";
import InvoiceDetail from "./InvoiceDetail";

function Invoices({
  subscription,
  onUpgrade,
  invoiceFilter,
  onClearFilter,
  newInvoiceCustomerId,
  onNewInvoiceHandled,
  onOpenCustomer,
}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const isBusiness =
    subscription?.plan === "business" &&
    (
      subscription?.status === "active" ||
      subscription?.status === "trialing"
    );

  const loadInvoices = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setInvoices([]);
        return;
      }

      const { data, error: loadError } =
        await supabase
          .from("uptrend_invoices")
          .select(`
            *,
            customer:uptrend_customers (
              id,
              name,
              phone,
              email
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

      if (loadError) {
        throw loadError;
      }

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      const invoicesWithOverdue =
        (data || []).map((invoice) => {
          const shouldBeOverdue =
            invoice.due_date &&
            invoice.due_date < today &&
            (
              invoice.status === "draft" ||
              invoice.status === "sent"
            );

          return shouldBeOverdue
            ? {
                ...invoice,
                status: "overdue",
              }
            : invoice;
        });

      const overdueInvoices =
        invoicesWithOverdue.filter(
          (invoice, index) =>
            invoice.status === "overdue" &&
            data?.[index]?.status !== "overdue"
        );

      if (overdueInvoices.length > 0) {
        await Promise.all(
          overdueInvoices.map((invoice) =>
            supabase
              .from("uptrend_invoices")
              .update({
                status: "overdue",
                updated_at:
                  new Date().toISOString(),
              })
              .eq("id", invoice.id)
              .eq("user_id", user.id)
          )
        );
      }

      setInvoices(invoicesWithOverdue);
    } catch (loadError) {
      console.error(
        "Invoice loading error:",
        loadError
      );

      setError(
        "We couldn't load your invoices. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isBusiness) {
      setLoading(false);
      return;
    }

    loadInvoices();
  }, [isBusiness]);

  /*
   * Open a new invoice directly for a selected customer.
   *
   * This is triggered by:
   * Customers → Customer Profile → Create Invoice
   */
  useEffect(() => {
    if (
      !isBusiness ||
      !newInvoiceCustomerId
    ) {
      return;
    }

    setEditingInvoice(null);
    setShowForm(true);

    onNewInvoiceHandled?.();
  }, [
    isBusiness,
    newInvoiceCustomerId,
    onNewInvoiceHandled,
  ]);

  const activeCustomerId =
    invoiceFilter?.customerId || null;

  const activeStatus =
    invoiceFilter?.status || null;

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      /*
       * Customer filter
       */
      if (
        activeCustomerId &&
        invoice.customer_id !== activeCustomerId
      ) {
        return false;
      }

      /*
       * Status filter
       *
       * "outstanding" means invoices that still have
       * an amount due: draft, sent or overdue.
       */
      if (activeStatus === "outstanding") {
        if (
          invoice.status !== "draft" &&
          invoice.status !== "sent" &&
          invoice.status !== "overdue"
        ) {
          return false;
        }
      } else if (
        activeStatus &&
        invoice.status !== activeStatus
      ) {
        return false;
      }

      /*
       * Existing text search
       */
      if (!query) {
        return true;
      }

      const statusLabel =
        invoice.status === "draft"
          ? "pending"
          : invoice.status;

      return (
        invoice.invoice_number
          ?.toLowerCase()
          .includes(query) ||
        invoice.customer?.name
          ?.toLowerCase()
          .includes(query) ||
        statusLabel
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [
    invoices,
    search,
    activeCustomerId,
    activeStatus,
  ]);

  const formatMoney = (value) => {
    return `₦${Number(value || 0).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusClass = (status) => {
    return `invoice-status invoice-status-${
      status || "draft"
    }`;
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: "Pending",
      sent: "Sent",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    return labels[status] || "Pending";
  };

  const getFilterLabel = () => {
    if (activeStatus === "outstanding") {
      return "Outstanding invoices";
    }

    if (activeStatus) {
      return `${getStatusLabel(activeStatus)} invoices`;
    }

    if (activeCustomerId) {
      return "Customer invoices";
    }

    return "Filtered invoices";
  };

  const handleEdit = (invoice) => {
    setSelectedInvoice(null);
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleStatusChange = (updatedInvoice) => {
    setInvoices((current) =>
      current.map((item) =>
        item.id === updatedInvoice.id
          ? {
              ...item,
              ...updatedInvoice,
            }
          : item
      )
    );

    setSelectedInvoice((current) =>
      current?.id === updatedInvoice.id
        ? {
            ...current,
            ...updatedInvoice,
          }
        : current
    );
  };

  const handleDelete = async (invoice) => {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoice_number}?`
    );

    if (!confirmed) {
      return;
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

      const { error: deleteError } =
        await supabase
          .from("uptrend_invoices")
          .delete()
          .eq("id", invoice.id)
          .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setInvoices((current) =>
        current.filter(
          (item) => item.id !== invoice.id
        )
      );

      setSelectedInvoice((current) =>
        current?.id === invoice.id
          ? null
          : current
      );
    } catch (deleteError) {
      console.error(
        "Invoice delete error:",
        deleteError
      );

      setError(
        deleteError?.message ||
          "We couldn't delete this invoice."
      );
    }
  };

  if (!isBusiness) {
    return (
      <div className="invoices-page">
        <BusinessGate
          title="Invoice Management"
          description="Create professional invoices, track payments and keep your customer billing organized."
          onUpgrade={onUpgrade}
        >
          <div />
        </BusinessGate>
      </div>
    );
  }

  return (
    <div className="invoices-page">

      <div className="invoices-page-top">

        <div>
          <div className="mini-label">
            BUSINESS
          </div>

          <h2>Invoices</h2>

          <p>
            Create and manage professional customer
            invoices.
          </p>
        </div>

        <button
          type="button"
          className="invoices-add-button"
          onClick={() => {
            setEditingInvoice(null);
            setShowForm(true);
          }}
        >
          <Plus size={17} />
          New Invoice
        </button>

      </div>

      {error && (
        <div className="invoices-error">
          {error}
        </div>
      )}

      {activeCustomerId && (
        <div className="invoices-active-filter">
          <div className="invoices-active-filter-info">
            <Filter size={15} />

            <span>
              {getFilterLabel()}
            </span>

            {activeStatus === "outstanding" && (
              <strong>
                Unpaid
              </strong>
            )}

            {activeStatus &&
              activeStatus !== "outstanding" && (
                <strong>
                  {getStatusLabel(
                    activeStatus
                  )}
                </strong>
              )}
          </div>

          <button
            type="button"
            onClick={onClearFilter}
            title="Clear invoice filter"
          >
            <X size={14} />
            Clear filter
          </button>
        </div>
      )}

      <section className="invoices-toolbar premium-card">

        <div className="invoices-count">

          <FileText size={18} />

          <strong>
            {filteredInvoices.length}
          </strong>

          <span>
            invoice
            {filteredInvoices.length === 1
              ? ""
              : "s"}
          </span>

        </div>

        <div className="invoices-search">

          <Search size={17} />

          <input
            type="search"
            placeholder="Search invoices..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

      </section>

      {loading ? (
        <section className="invoices-empty premium-card">
          Loading invoices...
        </section>
      ) : filteredInvoices.length === 0 ? (

        <section className="invoices-empty premium-card">

          <div className="invoices-empty-icon">
            <FileText size={25} />
          </div>

          <h3>
            {search
              ? "No invoices found"
              : activeCustomerId
                ? "No matching invoices"
                : "No invoices yet"}
          </h3>

          <p>
            {search
              ? "Try a different search."
              : activeCustomerId
                ? "This customer has no invoices matching the selected filter."
                : "Create your first invoice to start tracking customer billing."}
          </p>

          {!search && !activeCustomerId && (
            <button
              type="button"
              className="invoices-add-button"
              onClick={() => {
                setEditingInvoice(null);
                setShowForm(true);
              }}
            >
              <Plus size={17} />
              New Invoice
            </button>
          )}

        </section>

      ) : (

        <section className="invoices-table-card premium-card">

          <div className="invoices-table-wrap">

            <table className="invoices-table">

              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredInvoices.map((invoice) => (

                  <tr key={invoice.id}>

                    <td>
                      <button
                        type="button"
                        className="invoice-number-button"
                        onClick={() =>
                          setSelectedInvoice(invoice)
                        }
                        title="View invoice"
                      >
                        {invoice.invoice_number}
                      </button>
                    </td>

                    <td>
                      {invoice.customer?.id ? (
                        <button
                          type="button"
                          className="invoice-customer-button"
                          onClick={() =>
                            onOpenCustomer?.(
                              invoice.customer.id
                            )
                          }
                          title="View customer profile"
                        >
                          {invoice.customer.name}
                        </button>
                      ) : (
                        "No customer"
                      )}
                    </td>

                    <td>
                      {formatDate(
                        invoice.issue_date
                      )}
                    </td>

                    <td>
                      {formatDate(
                        invoice.due_date
                      )}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          invoice.status
                        )}
                      >
                        {getStatusLabel(
                          invoice.status
                        )}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatMoney(
                          invoice.total
                        )}
                      </strong>
                    </td>

                    <td>

                      <div className="invoice-actions">

                        <button
                          type="button"
                          title="Edit invoice"
                          onClick={() =>
                            handleEdit(invoice)
                          }
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          title="Delete invoice"
                          onClick={() =>
                            handleDelete(invoice)
                          }
                        >
                          <Trash2 size={15} />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>

      )}

      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={() =>
            setSelectedInvoice(null)
          }
          onEdit={handleEdit}
          onStatusChange={handleStatusChange}
          onOpenCustomer={onOpenCustomer}
        />
      )}

      {showForm && (
        <InvoiceForm
          invoice={editingInvoice}
          initialCustomerId={
            !editingInvoice
              ? newInvoiceCustomerId || ""
              : ""
          }
          onClose={() => {
            setShowForm(false);
            setEditingInvoice(null);
          }}
          onSaved={(savedInvoice) => {
            setInvoices((current) => {
              if (editingInvoice) {
                return current.map((item) =>
                  item.id === savedInvoice.id
                    ? savedInvoice
                    : item
                );
              }

              return [
                savedInvoice,
                ...current,
              ];
            });

            setShowForm(false);
            setEditingInvoice(null);
          }}
        />
      )}

    </div>
  );
}

export default Invoices;
