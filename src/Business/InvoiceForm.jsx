import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { supabase } from "../lib/supabase";
import { getProducts } from "../utils/uptrendStore";

import "./InvoiceForm.css";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function createInvoiceNumber() {
  const date = getToday().replaceAll("-", "");

  const random = Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase();

  return `INV-${date}-${random}`;
}

function InvoiceForm({
  invoice,
  onClose,
  onSaved,
  initialCustomerId = "",
}) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [loadingCustomers, setLoadingCustomers] =
    useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    issueDate: getToday(),
    dueDate: "",
    notes: "",
  });

  const [items, setItems] = useState([
    {
      id: Date.now(),
      productId: "",
      productName: "",
      quantity: "1",
      unitPrice: "",
    },
  ]);

  useEffect(() => {
    const loadData = async () => {
      setLoadingCustomers(true);
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

        const { data: customerData, error: customerError } =
          await supabase
            .from("uptrend_customers")
            .select(
              "id, name, phone, email"
            )
            .eq("user_id", user.id)
            .order("name", {
              ascending: true,
            });

        if (customerError) {
          throw customerError;
        }

        const productData = getProducts();

        setCustomers(customerData || []);
        setProducts(productData);

        /*
         * When creating an invoice from a customer profile,
         * automatically select that customer.
         *
         * Existing invoice editing still uses the invoice's
         * own customer_id below.
         */
        if (!invoice && initialCustomerId) {
          const customerExists =
            (customerData || []).some(
              (customer) =>
                customer.id === initialCustomerId
            );

          if (customerExists) {
            setForm((current) => ({
              ...current,
              customerId: initialCustomerId,
            }));
          }
        }

        if (invoice) {
          const {
            data: existingItems,
            error: itemsError,
          } = await supabase
            .from("uptrend_invoice_items")
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("created_at", {
              ascending: true,
            });

          if (itemsError) {
            throw itemsError;
          }

          setForm({
            customerId:
              invoice.customer_id || "",
            issueDate:
              invoice.issue_date || getToday(),
            dueDate:
              invoice.due_date || "",
            notes:
              invoice.notes || "",
          });

          const loadedItems =
            (existingItems || []).map(
              (item, index) => {
                const matchingProduct =
                  productData.find(
                    (product) =>
                      String(product.id) ===
                      String(item.product_id)
                  );

                return {
                  id:
                    `${item.id}-${index}`,
                  productId:
                    item.product_id || "",
                  productName:
                    item.product_name || "",
                  quantity:
                    String(item.quantity ?? 1),
                  unitPrice:
                    String(item.unit_price ?? 0),
                  matchingProduct,
                };
              }
            );

          setItems(
            loadedItems.length
              ? loadedItems
              : [
                  {
                    id: Date.now(),
                    productId: "",
                    productName: "",
                    quantity: "1",
                    unitPrice: "",
                  },
                ]
          );
        }
      } catch (loadError) {
        console.error(
          "Invoice form loading error:",
          loadError
        );

        setError(
          loadError?.message ||
            "We couldn't load the invoice data."
        );
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadData();
  }, [invoice]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity =
        Number(item.quantity) || 0;

      const unitPrice =
        Number(item.unitPrice) || 0;

      return (
        sum +
        quantity * unitPrice
      );
    }, 0);
  }, [items]);

  const formatMoney = (value) => {
    return `₦${Number(value || 0).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateItem = (
    itemId,
    field,
    value
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const handleProductChange = (
    itemId,
    productId
  ) => {
    const product = products.find(
      (item) =>
        String(item.id) ===
        String(productId)
    );

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              productName:
                product?.name || "",
              unitPrice:
                product
                  ? String(
                      product.sellingPrice || 0
                    )
                  : "",
            }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id:
          Date.now() +
          Math.random(),
        productId: "",
        productName: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  };

  const removeItem = (itemId) => {
    setItems((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (item) => item.id !== itemId
      );
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!form.customerId) {
      setError(
        "Please select a customer."
      );
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.productName.trim() &&
        Number(item.quantity) > 0 &&
        Number(item.unitPrice) >= 0
    );

    if (validItems.length === 0) {
      setError(
        "Add at least one valid invoice item."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const invoiceNumber =
        invoice?.invoice_number ||
        createInvoiceNumber();

      const invoicePayload = {
        user_id: user.id,
        customer_id: form.customerId,
        invoice_number: invoiceNumber,
        status: invoice?.status || "draft",
        issue_date: form.issueDate,
        due_date:
          form.dueDate || null,
        notes:
          form.notes.trim() || null,
        subtotal,
        total: subtotal,
      };

      let savedInvoice;

      if (invoice) {
        const {
          data: updatedInvoice,
          error: updateError,
        } = await supabase
          .from("uptrend_invoices")
          .update({
            customer_id:
              invoicePayload.customer_id,
            issue_date:
              invoicePayload.issue_date,
            due_date:
              invoicePayload.due_date,
            notes:
              invoicePayload.notes,
            subtotal:
              invoicePayload.subtotal,
            total:
              invoicePayload.total,
          })
          .eq("id", invoice.id)
          .eq("user_id", user.id)
          .select(`
            *,
            customer:uptrend_customers (
              id,
              name,
              phone,
              email
            )
          `)
          .single();

        if (updateError) {
          throw updateError;
        }

        savedInvoice = updatedInvoice;

        const {
          error: deleteItemsError,
        } = await supabase
          .from("uptrend_invoice_items")
          .delete()
          .eq("invoice_id", invoice.id);

        if (deleteItemsError) {
          throw deleteItemsError;
        }
      } else {
        const {
          data: newInvoice,
          error: invoiceError,
        } = await supabase
          .from("uptrend_invoices")
          .insert(invoicePayload)
          .select(`
            *,
            customer:uptrend_customers (
              id,
              name,
              phone,
              email
            )
          `)
          .single();

        if (invoiceError) {
          throw invoiceError;
        }

        savedInvoice = newInvoice;
      }

      const invoiceItems =
        validItems.map((item) => {
          const quantity =
            Number(item.quantity);

          const unitPrice =
            Number(item.unitPrice);

          return {
            invoice_id:
              savedInvoice.id,
            product_id:
              null,
            product_name:
              item.productName.trim(),
            quantity,
            unit_price:
              unitPrice,
            total:
              quantity * unitPrice,
          };
        });

      const {
        error: itemsError,
      } = await supabase
        .from("uptrend_invoice_items")
        .insert(invoiceItems);

      if (itemsError) {
        throw itemsError;
      }

      onSaved(savedInvoice);
    } catch (saveError) {
      console.error(
        "Invoice save error:",
        saveError
      );

      setError(
        saveError?.message ||
          "We couldn't save this invoice."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="invoice-form-overlay">

      <section className="invoice-form-modal">

        <div className="invoice-form-header">

          <div>
            <div className="mini-label">
              {invoice ? "EDIT INVOICE" : "NEW INVOICE"}
            </div>

            <h2>
              {invoice ? "Edit Invoice" : "Create Invoice"}
            </h2>

            <p>
              {invoice
                ? "Update the details of this invoice."
                : "Create a professional invoice for your customer."}
            </p>
          </div>

          <button
            type="button"
            className="invoice-form-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>

        </div>

        {error && (
          <div className="invoice-form-error">
            {error}
          </div>
        )}

        <form
          className="invoice-form"
          onSubmit={handleSubmit}
        >

          <section className="invoice-form-section">

            <div className="invoice-form-section-heading">
              <strong>Invoice details</strong>
              <span>
                Customer and payment dates
              </span>
            </div>

            <div className="invoice-form-grid">

              <label>
                <span>Customer *</span>

                <select
                  value={form.customerId}
                  onChange={(event) =>
                    updateForm(
                      "customerId",
                      event.target.value
                    )
                  }
                  disabled={loadingCustomers}
                >
                  <option value="">
                    {loadingCustomers
                      ? "Loading customers..."
                      : customers.length
                      ? "Select customer"
                      : "No customers available"}
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                      </option>
                    )
                  )}
                </select>

              </label>

              <label>
                <span>Issue date *</span>

                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(event) =>
                    updateForm(
                      "issueDate",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Due date</span>

                <input
                  type="date"
                  value={form.dueDate}
                  min={form.issueDate}
                  onChange={(event) =>
                    updateForm(
                      "dueDate",
                      event.target.value
                    )
                  }
                />
              </label>

            </div>

          </section>

          <section className="invoice-form-section">

            <div className="invoice-form-section-heading invoice-items-heading">

              <div>
                <strong>Invoice items</strong>
                <span>
                  Add products and set the
                  selling price for this invoice.
                </span>
              </div>

              <button
                type="button"
                className="invoice-add-item"
                onClick={addItem}
              >
                <Plus size={15} />
                Add item
              </button>

            </div>

            <div className="invoice-item-list">

              {items.map((item, index) => {

                const lineTotal =
                  (Number(item.quantity) || 0) *
                  (Number(item.unitPrice) || 0);

                return (
                  <div
                    className="invoice-item-row"
                    key={item.id}
                  >

                    <div className="invoice-item-number">
                      {index + 1}
                    </div>

                    <label>
                      <span>Product</span>

                      <select
                        value={
                          item.productId
                        }
                        onChange={(event) =>
                          handleProductChange(
                            item.id,
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select product
                        </option>

                        {products.map(
                          (product) => (
                            <option
                              key={product.id}
                              value={product.id}
                            >
                              {product.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span>Qty</span>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={
                          item.quantity
                        }
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "quantity",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Unit price</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.unitPrice
                        }
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "unitPrice",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <div className="invoice-item-total">
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          lineTotal
                        )}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="invoice-remove-item"
                      onClick={() =>
                        removeItem(item.id)
                      }
                      disabled={
                        items.length === 1
                      }
                      title="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>

                  </div>
                );
              })}

            </div>

          </section>

          <section className="invoice-form-bottom">

            <label className="invoice-notes">
              <span>Notes</span>

              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) =>
                  updateForm(
                    "notes",
                    event.target.value
                  )
                }
                placeholder="Optional note for the customer..."
              />
            </label>

            <div className="invoice-total-card">

              <span>Invoice total</span>

              <strong>
                {formatMoney(subtotal)}
              </strong>

              <small>
                {invoice
                  ? "Changes will be saved to this invoice."
                  : "This invoice will start as Pending."}
              </small>

            </div>

          </section>

          <div className="invoice-form-actions">

            <button
              type="button"
              className="invoice-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="invoice-save-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : invoice
                ? "Save Changes"
                : "Save Invoice"}
            </button>

          </div>

        </form>

      </section>

    </div>
  );
}

export default InvoiceForm;
