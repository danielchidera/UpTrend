import { useRef, useState } from "react";
import {
  Image,
  FileText,
  Link2,
  Copy,
  X,
  Share2,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { supabase } from "../lib/supabase";
import "./InvoiceShareMenu.css";

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

function InvoiceShareMenu({
  invoice,
  items,
  onClose,
}) {
  const invoicePreviewRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const generateCanvas = async () => {
    if (!invoicePreviewRef.current) {
      throw new Error(
        "Invoice preview is not ready."
      );
    }

    return html2canvas(
      invoicePreviewRef.current,
      {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020504",
        logging: false,
      }
    );
  };

  const downloadBlob = (
    blob,
    filename
  ) => {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const shareFile = async (
    file,
    fallbackDownload = true
  ) => {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      await navigator.share({
        title: `Invoice ${invoice.invoice_number}`,
        text: `Invoice ${invoice.invoice_number} from UpTrend`,
        files: [file],
      });

      return;
    }

    if (fallbackDownload) {
      downloadBlob(
        file,
        file.name
      );

      setMessage(
        "Your phone does not support direct file sharing here. The file was saved instead."
      );
    }
  };

  /* =========================================================
     CREATE / REUSE PERSISTENT PUBLIC INVOICE LINK
  ========================================================= */

  const getPublicInvoiceLink = async () => {
    if (!invoice?.id) {
      throw new Error(
        "Invoice information is missing."
      );
    }

    /*
     * First look for an existing link.
     *
     * Because invoice_id is unique, every invoice
     * keeps the same public link permanently.
     */
    const {
      data: existingLink,
      error: existingError,
    } = await supabase
      .from("uptrend_invoice_public_links")
      .select("token, active")
      .eq("invoice_id", invoice.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (
      existingLink?.token &&
      existingLink.active
    ) {
      return `${window.location.origin}/invoice/${existingLink.token}`;
    }

    /*
     * No active link exists.
     *
     * Supabase generates the secure random token
     * using the database default.
     */
    const {
      data: createdLink,
      error: createError,
    } = await supabase
      .from("uptrend_invoice_public_links")
      .insert({
        invoice_id: invoice.id,
        active: true,
      })
      .select("token")
      .single();

    if (!createError && createdLink?.token) {
      return `${window.location.origin}/invoice/${createdLink.token}`;
    }

    /*
     * Another request may have created the link
     * at almost the same time.
     *
     * Retrieve it instead of generating another one.
     */
    const {
      data: retryLink,
      error: retryError,
    } = await supabase
      .from("uptrend_invoice_public_links")
      .select("token, active")
      .eq("invoice_id", invoice.id)
      .maybeSingle();

    if (retryError) {
      throw retryError;
    }

    if (
      retryLink?.token &&
      retryLink.active
    ) {
      return `${window.location.origin}/invoice/${retryLink.token}`;
    }

    throw (
      createError ||
      new Error(
        "We couldn't create the invoice link."
      )
    );
  };

  /* =========================================================
     SHARE AS LINK
  ========================================================= */

  const handleShareLink = async () => {
    if (processing) {
      return;
    }

    setProcessing(true);
    setMessage("");

    try {
      const publicLink =
        await getPublicInvoiceLink();

      /*
       * Use the native phone share sheet when
       * the browser supports Web Share.
       */
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text: `Invoice ${invoice.invoice_number} from UpTrend`,
          url: publicLink,
        });

        return;
      }

      /*
       * Fallback for browsers without native sharing.
       */
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          publicLink
        );

        setMessage(
          "Invoice link copied to your clipboard."
        );

        return;
      }

      setMessage(
        publicLink
      );
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.error(
          "Invoice link sharing error:",
          error
        );

        setMessage(
          "We couldn't create the invoice link. Please try again."
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  /* =========================================================
     COPY LINK
  ========================================================= */

  const handleCopyLink = async () => {
    if (processing) {
      return;
    }

    setProcessing(true);
    setMessage("");

    try {
      const publicLink =
        await getPublicInvoiceLink();

      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          publicLink
        );

        setMessage(
          "Invoice link copied successfully."
        );

        return;
      }

      /*
       * Older-browser fallback.
       */
      const textArea =
        document.createElement(
          "textarea"
        );

      textArea.value = publicLink;

      textArea.style.position =
        "fixed";
      textArea.style.left =
        "-999999px";
      textArea.style.top =
        "0";

      document.body.appendChild(
        textArea
      );

      textArea.focus();
      textArea.select();

      const copied =
        document.execCommand(
          "copy"
        );

      textArea.remove();

      if (!copied) {
        throw new Error(
          "Clipboard access failed."
        );
      }

      setMessage(
        "Invoice link copied successfully."
      );
    } catch (error) {
      console.error(
        "Invoice link copy error:",
        error
      );

      setMessage(
        "We couldn't copy the invoice link. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  /* =========================================================
     SHARE IMAGE
  ========================================================= */

  const handleShareImage = async () => {
    if (processing) {
      return;
    }

    setProcessing(true);
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
          "Could not create the invoice image."
        );
      }

      const file = new File(
        [blob],
        `${invoice.invoice_number}.png`,
        {
          type: "image/png",
        }
      );

      await shareFile(file);
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.error(
          "Invoice image sharing error:",
          error
        );

        setMessage(
          "We couldn't prepare the invoice image. Please try again."
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  /* =========================================================
     SHARE PDF
  ========================================================= */

  const handleSharePdf = async () => {
    if (processing) {
      return;
    }

    setProcessing(true);
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

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const maxHeight = 287;

      const finalHeight =
        Math.min(
          pageHeight,
          maxHeight
        );

      pdf.addImage(
        imageData,
        "JPEG",
        0,
        5,
        pageWidth,
        finalHeight
      );

      const blob =
        pdf.output("blob");

      const file = new File(
        [blob],
        `${invoice.invoice_number}.pdf`,
        {
          type: "application/pdf",
        }
      );

      await shareFile(file);
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.error(
          "Invoice PDF sharing error:",
          error
        );

        setMessage(
          "We couldn't prepare the invoice PDF. Please try again."
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="invoice-share-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section className="invoice-share-sheet">

        <header className="invoice-share-header">

          <div>
            <span>
              INVOICE
            </span>

            <h3>
              Share Invoice
            </h3>

            <p>
              Choose how you want to share
              this invoice.
            </p>
          </div>

          <button
            type="button"
            className="invoice-share-close"
            onClick={onClose}
            disabled={processing}
            aria-label="Close share menu"
          >
            <X size={19} />
          </button>

        </header>

        <div className="invoice-share-options">

          <button
            type="button"
            className="invoice-share-option"
            onClick={
              handleShareImage
            }
            disabled={processing}
          >
            <span className="invoice-share-option-icon image">
              <Image size={20} />
            </span>

            <span className="invoice-share-option-copy">
              <strong>
                Share as Image
              </strong>

              <small>
                Send the invoice as a picture
              </small>
            </span>

            <Share2 size={17} />
          </button>

          <button
            type="button"
            className="invoice-share-option"
            onClick={
              handleSharePdf
            }
            disabled={processing}
          >
            <span className="invoice-share-option-icon pdf">
              <FileText size={20} />
            </span>

            <span className="invoice-share-option-copy">
              <strong>
                Share as PDF
              </strong>

              <small>
                Send a professional PDF invoice
              </small>
            </span>

            <Share2 size={17} />
          </button>

          <button
            type="button"
            className="invoice-share-option"
            onClick={
              handleShareLink
            }
            disabled={processing}
          >
            <span className="invoice-share-option-icon link">
              <Link2 size={20} />
            </span>

            <span className="invoice-share-option-copy">
              <strong>
                Share as Link
              </strong>

              <small>
                Secure persistent invoice link
              </small>
            </span>

            <Share2 size={17} />
          </button>

          <button
            type="button"
            className="invoice-share-copy"
            onClick={
              handleCopyLink
            }
            disabled={processing}
          >
            <Copy size={16} />

            Copy Invoice Link
          </button>

        </div>

        {processing && (
          <div className="invoice-share-processing">
            {processing === true
              ? "Preparing your invoice..."
              : processing === "image"
              ? "Preparing your invoice image..."
              : processing === "pdf"
              ? "Preparing your invoice PDF..."
              : "Preparing your invoice link..."}
          </div>
        )}

        {message && (
          <div className="invoice-share-message">
            {message}
          </div>
        )}

        <button
          type="button"
          className="invoice-share-cancel"
          onClick={onClose}
          disabled={processing}
        >
          Cancel
        </button>

        <div
          ref={invoicePreviewRef}
          className="invoice-share-print-preview"
          aria-hidden="true"
        >

          <div className="invoice-share-brand">

            <div>
              <strong>
                UpTrend
              </strong>

              <span>
                Business Management
              </span>
            </div>

            <div className="invoice-share-preview-label">
              INVOICE
            </div>

          </div>

          <div className="invoice-share-preview-top">

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

          <div className="invoice-share-preview-customer">

            <div>
              <span>
                Bill To
              </span>

              <strong>
                {invoice.customer?.name ||
                  "No customer"}
              </strong>

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

            <div>

              <span>
                Issue Date
              </span>

              <strong>
                {formatDate(
                  invoice.issue_date
                )}
              </strong>

              <span>
                Due Date
              </span>

              <strong>
                {formatDate(
                  invoice.due_date
                )}
              </strong>

            </div>

          </div>

          <table>

            <thead>
              <tr>
                <th>
                  Item
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map(
                (item) => (
                  <tr
                    key={item.id}
                  >
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
                )
              )}
            </tbody>

          </table>

          <div className="invoice-share-preview-total">

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
            <div className="invoice-share-preview-notes">

              <span>
                Notes
              </span>

              <p>
                {invoice.notes}
              </p>

            </div>
          )}

          <div className="invoice-share-preview-footer">
            Powered by UpTrend
          </div>

        </div>

      </section>
    </div>
  );
}

export default InvoiceShareMenu;