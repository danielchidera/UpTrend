import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image,
  ExternalLink,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { supabase } from "../lib/supabase";
import "./PublicInvoice.css";

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

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

function getTokenFromUrl() {
  const parts = window.location.pathname
    .split("/")
    .filter(Boolean);

  const invoiceIndex = parts.findIndex(
    (part) => part === "invoice"
  );

  if (invoiceIndex === -1) {
    return "";
  }

  return parts[invoiceIndex + 1] || "";
}

function PublicInvoice() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");

  const token = useMemo(
    getTokenFromUrl,
    []
  );

  useEffect(() => {
    let mounted = true;

    const loadInvoice = async () => {
      if (!token) {
        setError(
          "This invoice link is invalid."
        );

        setLoading(false);
        return;
      }

      try {
        const {
          data: result,
          error: loadError,
        } = await supabase.rpc(
          "get_public_invoice",
          {
            p_token: token,
          }
        );

        if (loadError) {
          throw loadError;
        }

        if (!result?.invoice) {
          throw new Error(
            "This invoice link is no longer available."
          );
        }

        if (mounted) {
          setData(result);
        }
      } catch (loadError) {
        console.error(
          "Public invoice loading error:",
          loadError
        );

        if (mounted) {
          setError(
            "This invoice link is invalid, unavailable, or has been disabled."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInvoice();

    return () => {
      mounted = false;
    };
  }, [token]);

  const generateCanvas = async () => {
    const element = document.querySelector(
      ".public-invoice-document"
    );

    if (!element) {
      throw new Error(
        "Invoice document is not ready."
      );
    }

    return html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#020504",
      logging: false,
    });
  };

  const downloadImage = async () => {
    if (processing || !data) {
      return;
    }

    setProcessing("image");
    setMessage("");

    try {
      const canvas =
        await generateCanvas();

      const blob =
        await new Promise((resolve) =>
          canvas.toBlob(
            resolve,
            "image/png",
            1
          )
        );

      if (!blob) {
        throw new Error(
          "Could not create the image."
        );
      }

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        `${data.invoice.invoice_number}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (downloadError) {
      console.error(
        "Public invoice image error:",
        downloadError
      );

      setMessage(
        "We couldn't prepare the invoice image. Please try again."
      );
    } finally {
      setProcessing("");
    }
  };

  const downloadPdf = async () => {
    if (processing || !data) {
      return;
    }

    setProcessing("pdf");
    setMessage("");

    try {
      const canvas =
        await generateCanvas();

      const imageData =
        canvas.toDataURL(
          "image/jpeg",
          0.95
        );

      const pageWidth = 210;

      const pageHeight =
        (canvas.height * pageWidth) /
        canvas.width;

      const finalHeight =
        Math.min(pageHeight, 287);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(
        imageData,
        "JPEG",
        0,
        5,
        pageWidth,
        finalHeight
      );

      pdf.save(
        `${data.invoice.invoice_number}.pdf`
      );
    } catch (downloadError) {
      console.error(
        "Public invoice PDF error:",
        downloadError
      );

      setMessage(
        "We couldn't prepare the invoice PDF. Please try again."
      );
    } finally {
      setProcessing("");
    }
  };

  if (loading) {
    return (
      <main className="public-invoice-page">
        <section className="public-invoice-state">
          <div className="public-invoice-loader" />
          <span>
            Loading invoice...
          </span>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="public-invoice-page">
        <section className="public-invoice-state public-invoice-error">
          <strong>
            Invoice unavailable
          </strong>

          <p>{error}</p>

          <a
            href="/"
            className="public-invoice-home-link"
          >
            Visit UpTrend
          </a>
        </section>
      </main>
    );
  }

  const {
    invoice,
    customer,
    items = [],
  } = data;

  return (
    <main className="public-invoice-page">
      <div className="public-invoice-shell">

        <header className="public-invoice-header">
          <div>
            <strong>
              UpTrend
            </strong>

            <span>
              Business Management
            </span>
          </div>

          <span className="public-invoice-badge">
            INVOICE
          </span>
        </header>

        <section className="public-invoice-document">

          <div className="public-invoice-meta">

            <div>
              <span>
                Invoice Number
              </span>

              <strong>
                {invoice.invoice_number}
              </strong>
            </div>

            <div>
              <span>
                Status
              </span>

              <strong>
                {getStatusLabel(
                  invoice.status
                )}
              </strong>
            </div>

          </div>

          <div className="public-invoice-customer">

            <div>
              <span>
                Bill To
              </span>

              <strong>
                {customer?.name ||
                  "No customer"}
              </strong>

              {customer?.phone && (
                <small>
                  {customer.phone}
                </small>
              )}

              {customer?.email && (
                <small>
                  {customer.email}
                </small>
              )}

              {customer?.address && (
                <small>
                  {customer.address}
                </small>
              )}
            </div>

            <div>
              <span>
                Issue Date
              </span>

              <strong>
                {formatDate(
                  invoice.issue_date
                )}
              </strong>

              <span className="public-invoice-second-label">
                Due Date
              </span>

              <strong>
                {formatDate(
                  invoice.due_date
                )}
              </strong>
            </div>

          </div>

          <div className="public-invoice-table-wrap">

            <table className="public-invoice-table">

              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.product_name}
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
                      {formatMoney(
                        item.total
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

          </div>

          <div className="public-invoice-total">
            <span>
              Total
            </span>

            <strong>
              {formatMoney(
                invoice.total
              )}
            </strong>
          </div>

          {invoice.notes && (
            <div className="public-invoice-notes">
              <span>
                Notes
              </span>

              <p>
                {invoice.notes}
              </p>
            </div>
          )}

          <div className="public-invoice-powered">
            Powered by UpTrend
          </div>

        </section>

        <div className="public-invoice-actions">

          <button
            type="button"
            onClick={downloadImage}
            disabled={!!processing}
          >
            <Image size={17} />

            {processing === "image"
              ? "Preparing..."
              : "Download Image"}
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={!!processing}
          >
            <FileText size={17} />

            {processing === "pdf"
              ? "Preparing..."
              : "Download PDF"}
          </button>

        </div>

        {message && (
          <div className="public-invoice-message">
            {message}
          </div>
        )}

        <a
          href="/"
          className="public-invoice-brand-link"
        >
          <ExternalLink size={15} />
          Visit UpTrend
        </a>

      </div>
    </main>
  );
}

export default PublicInvoice;
