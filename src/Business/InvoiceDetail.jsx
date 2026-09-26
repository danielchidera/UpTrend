import { useEffect, useState } from "react";
import {
  CalendarDays,
  Pencil,
  X,
  UserRound,
  FileText,
  Send,
  CheckCircle2,
  Ban,
  Share2,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import InvoiceShareMenu from "./InvoiceShareMenu";

import "./InvoiceDetail.css";

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value) {
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
}

function getStatusLabel(status) {
  const labels = {
    draft: "Pending",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
  };

  return labels[status] || "Pending";
}

function InvoiceDetail({
  invoice,
  onClose,
  onEdit,
  onStatusChange,
  onOpenCustomer,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] =
    useState(false);

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      setError("");

      try {
        const { data, error: itemsError } =
          await supabase
            .from("uptrend_invoice_items")
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("created_at", {
              ascending: true,
            });

        if (itemsError) {
          throw itemsError;
        }

        setItems(data || []);
      } catch (loadError) {
        console.error(
          "Invoice detail loading error:",
          loadError
        );

        setError(
          "We couldn't load the invoice items."
        );
      } finally {
        setLoading(false);
      }
    };

    if (invoice?.id) {
      loadItems();
    }
  }, [invoice]);

  if (!invoice) {
    return null;
  }

  const updateStatus = async (
    nextStatus,
    confirmationMessage
  ) => {
    if (statusLoading) {
      return;
    }

    if (confirmationMessage) {
      const confirmed = window.confirm(
        confirmationMessage
      );

      if (!confirmed) {
        return;
      }
    }

    setStatusLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const { data, error: updateError } =
        await supabase
          .from("uptrend_invoices")
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

      if (updateError) {
        throw updateError;
      }

      const updatedInvoice = {
        ...invoice,
        ...data,
      };

      if (onStatusChange) {
        onStatusChange(updatedInvoice);
      }
    } catch (statusError) {
      console.error(
        "Invoice status update error:",
        statusError
      );

      setError(
        statusError?.message ||
          "We couldn't update the invoice status."
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const renderStatusActions = () => {
    const status = invoice.status || "draft";

    if (status === "draft") {
      return (
        <div className="invoice-status-actions">
          <button
            type="button"
            className="invoice-status-action invoice-status-send"
            disabled={statusLoading}
            onClick={() =>
              updateStatus(
                "sent",
                "Mark this invoice as Sent?"
              )
            }
          >
            <Send size={15} />
            {statusLoading
              ? "Updating..."
              : "Mark as Sent"}
          </button>

          <button
            type="button"
            className="invoice-status-action invoice-status-cancel"
            disabled={statusLoading}
            onClick={() =>
              updateStatus(
                "cancelled",
                "Cancel this invoice? This will mark it as Cancelled."
              )
            }
          >
            <Ban size={15} />
            Cancel Invoice
          </button>
        </div>
      );
    }

    if (
      status === "sent" ||
      status === "overdue"
    ) {
      return (
        <div className="invoice-status-actions">
          <button
            type="button"
            className="invoice-status-action invoice-status-paid"
            disabled={statusLoading}
            onClick={() =>
              updateStatus(
                "paid",
                "Mark this invoice as Paid?"
              )
            }
          >
            <CheckCircle2 size={15} />
            {statusLoading
              ? "Updating..."
              : "Mark as Paid"}
          </button>

          <button
            type="button"
            className="invoice-status-action invoice-status-cancel"
            disabled={statusLoading}
            onClick={() =>
              updateStatus(
                "cancelled",
                "Cancel this invoice? This will mark it as Cancelled."
              )
            }
          >
            <Ban size={15} />
            Cancel Invoice
          </button>
        </div>
      );
    }

    if (status === "paid") {
      return (
        <div className="invoice-status-complete">
          <CheckCircle2 size={16} />
          This invoice has been paid.
        </div>
      );
    }

    if (status === "cancelled") {
      return (
        <div className="invoice-status-complete invoice-status-cancelled-message">
          <Ban size={16} />
          This invoice has been cancelled.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="invoice-detail-overlay">
      <section className="invoice-detail-modal">

        <header className="invoice-detail-header">

          <div>
            <div className="mini-label">
              INVOICE
            </div>

            <h2>
              {invoice.invoice_number}
            </h2>

            <span
              className={`invoice-detail-status invoice-detail-status-${invoice.status || "draft"}`}
            >
              {getStatusLabel(invoice.status)}
            </span>
          </div>

          <button
            type="button"
            className="invoice-detail-close"
            onClick={onClose}
            aria-label="Close invoice"
          >
            <X size={19} />
          </button>

        </header>

        <div className="invoice-detail-body">

          {error && (
            <div className="invoice-detail-error">
              {error}
            </div>
          )}

          <section className="invoice-detail-info-grid">

            <div className="invoice-detail-info-card">
              <div className="invoice-detail-info-icon">
                <UserRound size={17} />
              </div>

              <div>
                <span>Customer</span>

                {invoice.customer?.id ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCustomer?.(
                        invoice.customer.id
                      )
                    }
                    title="View customer profile"
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      color: "inherit",
                      font: "inherit",
                      fontWeight: 700,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {invoice.customer.name}
                  </button>
                ) : (
                  <strong>
                    No customer
                  </strong>
                )}

                {invoice.customer?.phone && (
                  <small>
                    {invoice.customer.phone}
                  </small>
                )}

                {invoice.customer?.email && (
                  <small>
                    {invoice.customer.email}
                  </small>
                )}
              </div>
            </div>

            <div className="invoice-detail-info-card">
              <div className="invoice-detail-info-icon">
                <CalendarDays size={17} />
              </div>

              <div>
                <span>Issue date</span>

                <strong>
                  {formatDate(
                    invoice.issue_date
                  )}
                </strong>
              </div>
            </div>

            <div className="invoice-detail-info-card">
              <div className="invoice-detail-info-icon">
                <CalendarDays size={17} />
              </div>

              <div>
                <span>Due date</span>

                <strong>
                  {formatDate(
                    invoice.due_date
                  )}
                </strong>
              </div>
            </div>

          </section>

          <section className="invoice-detail-status-card">

            <div className="invoice-detail-status-heading">
              <div>
                <span>Invoice status</span>

                <strong>
                  {getStatusLabel(
                    invoice.status
                  )}
                </strong>
              </div>
            </div>

            {renderStatusActions()}

          </section>

          <section className="invoice-detail-items-card">

            <div className="invoice-detail-section-title">
              <div>
                <FileText size={17} />

                <strong>
                  Invoice items
                </strong>
              </div>

              <span>
                {items.length}{" "}
                {items.length === 1
                  ? "item"
                  : "items"}
              </span>
            </div>

            {loading ? (
              <div className="invoice-detail-loading">
                Loading invoice items...
              </div>
            ) : items.length === 0 ? (
              <div className="invoice-detail-loading">
                No invoice items found.
              </div>
            ) : (
              <div className="invoice-detail-table-wrap">

                <table className="invoice-detail-table">

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (item, index) => (
                        <tr
                          key={item.id}
                        >
                          <td>
                            {index + 1}
                          </td>

                          <td>
                            <strong>
                              {
                                item.product_name
                              }
                            </strong>
                          </td>

                          <td>
                            {Number(
                              item.quantity
                            ).toLocaleString(
                              "en-NG"
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              item.unit_price
                            )}
                          </td>

                          <td>
                            <strong>
                              {formatMoney(
                                item.total
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>
            )}

          </section>

          <section className="invoice-detail-summary">

            <div className="invoice-detail-notes">

              {invoice.notes && (
                <>
                  <span>Notes</span>

                  <p>
                    {invoice.notes}
                  </p>
                </>
              )}

            </div>

            <div className="invoice-detail-total">

              <span>Total</span>

              <strong>
                {formatMoney(
                  invoice.total
                )}
              </strong>

            </div>

          </section>

        </div>

        <footer className="invoice-detail-footer">

          <button
            type="button"
            className="invoice-detail-secondary invoice-detail-share"
            onClick={() =>
              setShowShareMenu(true)
            }
            disabled={
              statusLoading ||
              loading
            }
          >
            <Share2 size={16} />
            Share
          </button>

          <button
            type="button"
            className="invoice-detail-secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="invoice-detail-edit"
            onClick={() => onEdit(invoice)}
            disabled={statusLoading}
          >
            <Pencil size={16} />
            Edit Invoice
          </button>

        </footer>

      </section>

      {showShareMenu && (
        <InvoiceShareMenu
          invoice={invoice}
          items={items}
          onClose={() =>
            setShowShareMenu(false)
          }
        />
      )}

    </div>
  );
}

export default InvoiceDetail;
