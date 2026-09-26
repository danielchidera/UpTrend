import "./SaleReceipt.css";

function SaleReceipt({
  sale,
  onClose,
}) {
  if (!sale) {
    return null;
  }

  const formatMoney = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

  const receiptNumber =
    `UT-${String(sale.id || "")
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-overlay">
      <div className="receipt-modal">

        <div className="receipt-actions no-print">
          <button
            type="button"
            className="receipt-close"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="receipt-print"
            onClick={handlePrint}
          >
            Print / Save PDF
          </button>
        </div>

        <article className="sale-receipt">

          <header className="receipt-header">
            <div className="receipt-brand">
              <div className="receipt-logo">
                U
              </div>

              <div>
                <strong>
                  UpTrend
                </strong>

                <span>
                  Business Management
                </span>
              </div>
            </div>

            <div className="receipt-title">
              <span>
                SALES RECEIPT
              </span>

              <strong>
                {receiptNumber}
              </strong>
            </div>
          </header>

          <div className="receipt-divider" />

          <section className="receipt-meta">
            <div>
              <span>
                DATE
              </span>

              <strong>
                {sale.date}
              </strong>
            </div>

            <div>
              <span>
                STATUS
              </span>

              <strong className="receipt-paid">
                PAID
              </strong>
            </div>
          </section>

          <section className="receipt-items">

            <div className="receipt-table-heading">
              <span>
                ITEM
              </span>

              <span>
                TOTAL
              </span>
            </div>

            <div className="receipt-item">
              <div>
                <strong>
                  {sale.product}
                </strong>

                <span>
                  {sale.quantity} ×{" "}
                  {formatMoney(
                    sale.sellingPrice
                  )}
                </span>
              </div>

              <strong>
                {formatMoney(
                  sale.totalSelling
                )}
              </strong>
            </div>

          </section>

          <section className="receipt-total">
            <span>
              Total Amount
            </span>

            <strong>
              {formatMoney(
                sale.totalSelling
              )}
            </strong>
          </section>

          <section className="receipt-thankyou">
            <div className="receipt-thankyou-icon">
              ✓
            </div>

            <div>
              <strong>
                Thank you for your business
              </strong>

              <span>
                We appreciate your patronage.
              </span>
            </div>
          </section>

          <footer className="receipt-footer">
            <span>
              Powered by UpTrend
            </span>

            <span>
              Business management made simple.
            </span>
          </footer>

        </article>
      </div>
    </div>
  );
}

export default SaleReceipt;
