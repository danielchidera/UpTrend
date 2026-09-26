import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import BusinessGate from "./BusinessGate";
import "./Exports.css";

/* =========================================================
   DATE HELPERS

   IMPORTANT:
   Business date fields are treated as DATE strings.

   We intentionally do NOT use:
     new Date("YYYY-MM-DD")

   for database date-only values, because timezone
   conversion can shift the displayed business date.
========================================================= */

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return getLocalDateKey();
}

function getDateDaysAgo(days) {
  const date = new Date();

  date.setHours(12, 0, 0, 0);
  date.setDate(
    date.getDate() - days
  );

  return getLocalDateKey(date);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  /*
   * Preserve YYYY-MM-DD exactly.
   */
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  return String(value);
}

function isDateOnly(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

/* =========================================================
   TABLE CONFIGURATION

   These are the actual UpTrend tables discovered in the
   existing application.
========================================================= */

const EXPORT_TABLES = {
  sales: {
    key: "sales",
    label: "Sales",
    table: "sales",
    dateFields: [
      "sale_date",
      "date",
    ],
  },

  expenses: {
    key: "expenses",
    label: "Expenses",
    table: "expenses",
    dateFields: [
      "expense_date",
      "date",
    ],
  },

  products: {
    key: "products",
    label: "Products / Inventory",
    table: "products",
    dateFields: [],
  },

  customers: {
    key: "customers",
    label: "Customers",
    table: "uptrend_customers",
    dateFields: [
      "created_at",
    ],
  },

  invoices: {
    key: "invoices",
    label: "Invoices",
    table: "uptrend_invoices",
    dateFields: [
      "invoice_date",
      "issue_date",
      "due_date",
      "created_at",
    ],
  },

  invoiceItems: {
    key: "invoiceItems",
    label: "Invoice Items",
    table: "uptrend_invoice_items",
    dateFields: [
      "created_at",
    ],
  },

  suppliers: {
    key: "suppliers",
    label: "Suppliers",
    table: "uptrend_suppliers",
    dateFields: [
      "created_at",
    ],
  },

  supplierPurchases: {
    key: "supplierPurchases",
    label: "Supplier Purchases",
    table: "uptrend_supplier_purchases",
    dateFields: [
      "purchase_date",
      "due_date",
      "created_at",
    ],
  },

  supplierPayments: {
    key: "supplierPayments",
    label: "Supplier Payments",
    table: "uptrend_supplier_payments",
    dateFields: [
      "payment_date",
      "created_at",
    ],
  },

  creditDebt: {
    key: "creditDebt",
    label: "Credit / Debt",
    table: "uptrend_credit_debts",
    dateFields: [
      "date",
      "due_date",
      "created_at",
    ],
  },

  creditDebtPayments: {
    key: "creditDebtPayments",
    label: "Credit / Debt Payments",
    table: "uptrend_credit_debt_payments",
    dateFields: [
      "payment_date",
      "created_at",
    ],
  },

  finance: {
    key: "finance",
    label: "Finance Settings",
    table: "finance_settings",
    dateFields: [
      "created_at",
      "updated_at",
    ],
  },

  businessTargets: {
    key: "businessTargets",
    label: "Business Targets",
    table: "uptrend_business_targets",
    dateFields: [
      "start_date",
      "end_date",
      "created_at",
    ],
  },
};

const EXPORT_ORDER = [
  "sales",
  "expenses",
  "products",
  "customers",
  "invoices",
  "invoiceItems",
  "suppliers",
  "supplierPurchases",
  "supplierPayments",
  "creditDebt",
  "creditDebtPayments",
  "finance",
  "businessTargets",
];

/* =========================================================
   INITIAL SELECTION

   Business exports default to the main business datasets.
========================================================= */

const DEFAULT_SELECTED = [
  "sales",
  "expenses",
  "products",
  "customers",
  "invoices",
  "suppliers",
  "supplierPurchases",
  "supplierPayments",
  "creditDebt",
  "creditDebtPayments",
  "finance",
  "businessTargets",
];

/* =========================================================
   GENERIC DATE MATCHING

   Date-only values are compared as strings.

   Timestamp values are reduced to their date portion
   without changing the actual calendar date represented
   in the database value.
========================================================= */

function getRecordDateValue(
  record,
  dateFields = []
) {
  for (const field of dateFields) {
    const value = record?.[field];

    if (!value) {
      continue;
    }

    if (isDateOnly(value)) {
      return value;
    }

    const text = String(value);

    /*
     * For timestamps, preserve the calendar date contained
     * in the database representation.
     */
    const match =
      text.match(
        /^(\d{4}-\d{2}-\d{2})/
      );

    if (match) {
      return match[1];
    }
  }

  return null;
}

function filterRowsByDate(
  rows,
  config,
  startDate,
  endDate
) {
  if (
    !Array.isArray(rows) ||
    !startDate ||
    !endDate
  ) {
    return rows || [];
  }

  /*
   * Products and some configuration records are not
   * naturally period-based. Those remain available
   * regardless of the selected reporting period.
   */
  if (!config.dateFields?.length) {
    return rows || [];
  }

  return rows.filter((row) => {
    const date = getRecordDateValue(
      row,
      config.dateFields
    );

    if (!date) {
      return true;
    }

    return (
      date >= startDate &&
      date <= endDate
    );
  });
}

/* =========================================================
   SUPABASE LOADER
========================================================= */

async function loadExportData() {
  const {
    data: {
      user,
    },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error(
      "You must be signed in to export business data."
    );
  }

  const results = {};

  for (const key of EXPORT_ORDER) {
    const config =
      EXPORT_TABLES[key];

    /*
     * Invoice items belong to invoices.
     *
     * uptrend_invoice_items does NOT have a user_id column,
     * so ownership must be established through the user's
     * invoices instead of filtering invoice items directly
     * by user_id.
     */
    if (key === "invoiceItems") {
      const invoices =
        results.invoices || [];

      const invoiceIds =
        invoices
          .map(
            (invoice) =>
              invoice?.id
          )
          .filter(Boolean);

      if (!invoiceIds.length) {
        results[key] = [];
        continue;
      }

      const {
        data,
        error,
      } = await supabase
        .from(config.table)
        .select("*")
        .in(
          "invoice_id",
          invoiceIds
        );

      if (error) {
        throw new Error(
          `Unable to load ${config.label}: ${error.message}`
        );
      }

      results[key] = data || [];
      continue;
    }

    const { data, error } =
      await supabase
        .from(config.table)
        .select("*")
        .eq("user_id", user.id);

    if (error) {
      throw new Error(
        `Unable to load ${config.label}: ${error.message}`
      );
    }

    results[key] = data || [];
  }

  return results;
}

/* =========================================================
   MONEY
========================================================= */

function formatMoney(value) {
  return `₦${Number(
    value || 0
  ).toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

/* =========================================================
   SALES / FINANCIAL SUMMARY

   Uses the same core fields already used by Reports.
========================================================= */

function getSaleRevenue(sale) {
  return Number(
    sale?.total_selling ??
      sale?.totalSelling ??
      sale?.total_sales ??
      sale?.totalSales ??
      0
  );
}

function getSaleCost(sale) {
  if (
    sale?.total_cost !== undefined &&
    sale?.total_cost !== null
  ) {
    return Number(
      sale.total_cost || 0
    );
  }

  if (
    sale?.totalCost !== undefined &&
    sale?.totalCost !== null
  ) {
    return Number(
      sale.totalCost || 0
    );
  }

  return (
    Number(
      sale?.cost_price ??
        sale?.costPrice ??
        0
    ) *
    Number(
      sale?.quantity || 0
    )
  );
}

function getSaleProfit(sale) {
  if (
    sale?.gross_profit !== undefined &&
    sale?.gross_profit !== null
  ) {
    return Number(
      sale.gross_profit || 0
    );
  }

  if (
    sale?.grossProfit !== undefined &&
    sale?.grossProfit !== null
  ) {
    return Number(
      sale.grossProfit || 0
    );
  }

  return (
    getSaleRevenue(sale) -
    getSaleCost(sale)
  );
}

function calculateSummary(
  sales,
  expenses
) {
  const revenue =
    sales.reduce(
      (sum, sale) =>
        sum +
        getSaleRevenue(sale),
      0
    );

  const productCost =
    sales.reduce(
      (sum, sale) =>
        sum +
        getSaleCost(sale),
      0
    );

  const grossProfit =
    sales.reduce(
      (sum, sale) =>
        sum +
        getSaleProfit(sale),
      0
    );

  const expenseTotal =
    expenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense?.amount || 0
        ),
      0
    );

  /*
   * This follows UpTrend's existing financial rule:
   *
   * Gross profit covers expenses first.
   * Any excess expense becomes remaining expense.
   * Net profit never becomes negative.
   */
  const netProfit =
    Math.max(
      grossProfit -
        expenseTotal,
      0
    );

  const remainingExpenses =
    Math.max(
      expenseTotal -
        grossProfit,
      0
    );

  return {
    revenue,
    productCost,
    grossProfit,
    expenses: expenseTotal,
    netProfit,
    remainingExpenses,
    transactions:
      sales.length,
  };
}

/* =========================================================
   EXPORT ENGINE
========================================================= */

function getExportTimestamp() {
  const now = new Date();

  const date = getLocalDateKey(now);

  const hours = String(
    now.getHours()
  ).padStart(2, "0");

  const minutes = String(
    now.getMinutes()
  ).padStart(2, "0");

  const seconds = String(
    now.getSeconds()
  ).padStart(2, "0");

  return `${date} ${hours}:${minutes}:${seconds}`;
}

function getDatasetRows(
  rows = []
) {
  if (!Array.isArray(rows)) {
    return [];
  }

  if (!rows.length) {
    return [];
  }

  const keys = [];

  rows.forEach((row) => {
    Object.keys(row || {}).forEach(
      (key) => {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      }
    );
  });

  return [
    keys,
    ...rows.map((row) =>
      keys.map(
        (key) =>
          row?.[key] ?? ""
      )
    ),
  ];
}

function getDatasetLabel(key) {
  return (
    EXPORT_TABLES[key]?.label ||
    key
  );
}

function cleanFilenamePart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getExportFilename(
  format,
  startDate,
  endDate
) {
  const start =
    cleanFilenamePart(startDate);

  const end =
    cleanFilenamePart(endDate);

  return `UpTrend-Export-${start}-${end}.${format}`;
}

function downloadBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  /*
   * Give the browser a moment to begin
   * the download before releasing the URL.
   */
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/* =========================================================
   CSV EXPORT

   One CSV contains every selected dataset.
   Each dataset gets its own clearly labelled section.
========================================================= */

function buildCsv(
  selectedKeys,
  selectedData,
  startDate,
  endDate
) {
  const rows = [];

  rows.push([
    "UPTREND BUSINESS EXPORT",
  ]);

  rows.push([
    "Report Period",
    `${startDate} to ${endDate}`,
  ]);

  rows.push([
    "Exported At",
    getExportTimestamp(),
  ]);

  rows.push([]);

  selectedKeys.forEach((key) => {
    const label =
      getDatasetLabel(key);

    rows.push([
      label.toUpperCase(),
    ]);

    const datasetRows =
      getDatasetRows(
        selectedData[key] || []
      );

    if (!datasetRows.length) {
      rows.push([
        "No records in selected period",
      ]);
    } else {
      datasetRows.forEach(
        (row) =>
          rows.push(row)
      );
    }

    rows.push([]);
  });

  const csv = rows
    .map((row) =>
      row
        .map(escapeCsv)
        .join(",")
    )
    .join("\r\n");

  return `\ufeff${csv}`;
}

/* =========================================================
   EXCEL EXPORT

   Creates a genuine XLSX workbook.

   Each selected dataset receives its own worksheet.
========================================================= */

function buildExcelWorkbook(
  selectedKeys,
  selectedData,
  startDate,
  endDate
) {
  const workbook =
    XLSX.utils.book_new();

  /*
   * Summary sheet
   */
  const summaryRows = [
    [
      "UPTREND BUSINESS EXPORT",
    ],
    [],
    [
      "Report Period",
      startDate,
      endDate,
    ],
    [
      "Exported At",
      getExportTimestamp(),
    ],
    [],
    [
      "Dataset",
      "Records",
    ],
  ];

  selectedKeys.forEach(
    (key) => {
      summaryRows.push([
        getDatasetLabel(key),
        (
          selectedData[key] ||
          []
        ).length,
      ]);
    }
  );

  const summarySheet =
    XLSX.utils.aoa_to_sheet(
      summaryRows
    );

  summarySheet["!cols"] = [
    { wch: 30 },
    { wch: 22 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Summary"
  );

  /*
   * Individual data sheets.
   *
   * Excel worksheet names have a maximum
   * length of 31 characters.
   */
  const usedSheetNames =
    new Set(["Summary"]);

  selectedKeys.forEach(
    (key) => {
      const rows =
        getDatasetRows(
          selectedData[key] || []
        );

      const sheetRows =
        rows.length
          ? rows
          : [
              [
                "No records in selected period",
              ],
            ];

      const worksheet =
        XLSX.utils.aoa_to_sheet(
          sheetRows
        );

      const baseName =
        getDatasetLabel(key)
          .replace(
            /[\\/?*[\]:]/g,
            ""
          )
          .slice(0, 31) ||
        key.slice(0, 31);

      let sheetName =
        baseName;

      let counter = 2;

      while (
        usedSheetNames.has(
          sheetName
        )
      ) {
        const suffix =
          ` ${counter}`;

        sheetName =
          `${baseName.slice(
            0,
            31 - suffix.length
          )}${suffix}`;

        counter += 1;
      }

      usedSheetNames.add(
        sheetName
      );

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sheetName
      );
    }
  );

  return workbook;
}

/* =========================================================
   PDF HELPERS
========================================================= */

function pdfValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function pdfTable(
  doc,
  headers,
  rows,
  state
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const left = 36;

  const right = 36;

  const usableWidth =
    pageWidth -
    left -
    right;

  const columnCount =
    Math.max(
      headers.length,
      1
    );

  const columnWidth =
    usableWidth /
    columnCount;

  const lineHeight = 11;

  const rowHeight = 24;

  const ensureSpace = (
    required = rowHeight
  ) => {
    if (
      state.y + required >
      pageHeight - 42
    ) {
      doc.addPage();
      state.y = 42;
    }
  };

  ensureSpace(30);

  /*
   * Header
   */
  doc.setFillColor(
    238,
    238,
    238
  );

  doc.rect(
    left,
    state.y - 14,
    usableWidth,
    22,
    "F"
  );

  doc.setFontSize(7);
  doc.setFont(
    "helvetica",
    "bold"
  );

  headers.forEach(
    (header, index) => {
      const x =
        left +
        index *
          columnWidth +
        3;

      doc.text(
        String(header).slice(
          0,
          22
        ),
        x,
        state.y
      );
    }
  );

  state.y += 22;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(6);

  rows.forEach(
    (row) => {
      ensureSpace(
        rowHeight
      );

      row.forEach(
        (value, index) => {
          const x =
            left +
            index *
              columnWidth +
            3;

          const valueText =
            pdfValue(value);

          const lines =
            doc.splitTextToSize(
              valueText,
              Math.max(
                columnWidth - 6,
                20
              )
            );

          doc.text(
            lines
              .slice(0, 2),
            x,
            state.y
          );
        }
      );

      doc.setDrawColor(
        220,
        220,
        220
      );

      doc.line(
        left,
        state.y + 6,
        left +
          usableWidth,
        state.y + 6
      );

      state.y +=
        rowHeight;
    }
  );
}

function buildPdf(
  selectedKeys,
  selectedData,
  startDate,
  endDate,
  summary
) {
  const doc =
    new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const state = {
    y: 42,
  };

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(20);

  doc.text(
    "UPTREND BUSINESS EXPORT",
    36,
    state.y
  );

  state.y += 22;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(9);

  doc.text(
    `Report period: ${startDate} to ${endDate}`,
    36,
    state.y
  );

  state.y += 14;

  doc.text(
    `Exported at: ${getExportTimestamp()}`,
    36,
    state.y
  );

  state.y += 24;

  /*
   * Financial summary
   */
  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.text(
    "Financial Summary",
    36,
    state.y
  );

  state.y += 18;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(8);

  const summaryItems = [
    [
      "Revenue",
      formatMoney(
        summary.revenue
      ),
    ],
    [
      "Product Cost",
      formatMoney(
        summary.productCost
      ),
    ],
    [
      "Gross Profit",
      formatMoney(
        summary.grossProfit
      ),
    ],
    [
      "Expenses",
      formatMoney(
        summary.expenses
      ),
    ],
    [
      "Remaining Expenses",
      formatMoney(
        summary.remainingExpenses
      ),
    ],
    [
      "Net Profit",
      formatMoney(
        summary.netProfit
      ),
    ],
  ];

  summaryItems.forEach(
    ([label, value]) => {
      doc.text(
        `${label}: ${value}`,
        36,
        state.y
      );

      state.y += 12;
    }
  );

  state.y += 12;

  /*
   * Selected datasets
   */
  selectedKeys.forEach(
    (key) => {
      const label =
        getDatasetLabel(key);

      const rawRows =
        selectedData[key] || [];

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(11);

      if (
        state.y >
        doc.internal.pageSize.getHeight() -
          70
      ) {
        doc.addPage();
        state.y = 42;
      }

      doc.text(
        label,
        36,
        state.y
      );

      state.y += 18;

      const table =
        getDatasetRows(
          rawRows
        );

      if (!table.length) {
        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.text(
          "No records in selected period.",
          36,
          state.y
        );

        state.y += 24;

        return;
      }

      const [
        headers,
        ...rows
      ] = table;

      /*
       * PDF tables with a very large number
       * of columns are difficult to read.
       *
       * We preserve all data in CSV/Excel.
       * PDF displays the first 8 columns.
       */
      const maxPdfColumns =
        8;

      const visibleHeaders =
        headers.slice(
          0,
          maxPdfColumns
        );

      const visibleRows =
        rows.map(
          (row) =>
            row.slice(
              0,
              maxPdfColumns
            )
        );

      pdfTable(
        doc,
        visibleHeaders,
        visibleRows,
        state
      );

      state.y += 18;
    }
  );

  /*
   * Page numbers
   */
  const pageCount =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= pageCount;
    page += 1
  ) {
    doc.setPage(page);

    const height =
      doc.internal.pageSize.getHeight();

    doc.setFontSize(7);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `UpTrend • Page ${page} of ${pageCount}`,
      pageWidth - 140,
      height - 20
    );
  }

  return doc;
}

/* =========================================================
   COMPONENT
========================================================= */

function Exports({
  subscription,
}) {
  const [data, setData] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [period, setPeriod] =
    useState("30days");

  const [startDate, setStartDate] =
    useState(
      getDateDaysAgo(29)
    );

  const [endDate, setEndDate] =
    useState(getToday());

  const [selected, setSelected] =
    useState(
      DEFAULT_SELECTED
    );

  const [format, setFormat] =
    useState("csv");

  const [exporting, setExporting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const result =
          await loadExportData();

        if (mounted) {
          setData(result);
        }
      } catch (loadError) {
        console.error(
          "Exports data load failed:",
          loadError
        );

        if (mounted) {
          setError(
            loadError?.message ||
              "Unable to load export data."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedData =
    useMemo(() => {
      const result = {};

      for (const key of selected) {
        const config =
          EXPORT_TABLES[key];

        if (!config) {
          continue;
        }

        result[key] =
          filterRowsByDate(
            data[key] || [],
            config,
            startDate,
            endDate
          );
      }

      return result;
    }, [
      data,
      selected,
      startDate,
      endDate,
    ]);

  const sales =
    selectedData.sales ||
    filterRowsByDate(
      data.sales || [],
      EXPORT_TABLES.sales,
      startDate,
      endDate
    );

  const expenses =
    selectedData.expenses ||
    filterRowsByDate(
      data.expenses || [],
      EXPORT_TABLES.expenses,
      startDate,
      endDate
    );

  const summary =
    useMemo(
      () =>
        calculateSummary(
          sales,
          expenses
        ),
      [sales, expenses]
    );

  const totalSelectedRows =
    Object.values(
      selectedData
    ).reduce(
      (sum, rows) =>
        sum +
        (Array.isArray(rows)
          ? rows.length
          : 0),
      0
    );

  const applyPeriod = (
    value
  ) => {
    setPeriod(value);
    setMessage("");

    const today =
      getToday();

    if (value === "7days") {
      setStartDate(
        getDateDaysAgo(6)
      );
      setEndDate(today);
    }

    if (value === "30days") {
      setStartDate(
        getDateDaysAgo(29)
      );
      setEndDate(today);
    }

    if (value === "90days") {
      setStartDate(
        getDateDaysAgo(89)
      );
      setEndDate(today);
    }
  };

  const toggleDataset = (
    key
  ) => {
    setMessage("");

    setSelected((current) =>
      current.includes(key)
        ? current.filter(
            (item) =>
              item !== key
          )
        : [
            ...current,
            key,
          ]
    );
  };

  const selectAll = () => {
    setSelected(
      [...EXPORT_ORDER]
    );
    setMessage("");
  };

  const clearAll = () => {
    setSelected([]);
    setMessage("");
  };

  const hasSelection =
    selected.length > 0;

  const periodLabel =
    `${startDate} → ${endDate}`;

  /* =======================================================
     RUN EXPORT
  ======================================================= */

  const handleExport = () => {
    if (!hasSelection) {
      setMessage(
        "Select at least one dataset before exporting."
      );

      return;
    }

    if (
      !startDate ||
      !endDate ||
      startDate > endDate
    ) {
      setMessage(
        "Please select a valid date range."
      );

      return;
    }

    setExporting(true);
    setMessage("");

    /*
     * Let the UI render the loading state before
     * the browser performs the export work.
     */
    setTimeout(() => {
      try {
        if (format === "csv") {
          const csv =
            buildCsv(
              selected,
              selectedData,
              startDate,
              endDate
            );

          const blob =
            new Blob(
              [csv],
              {
                type:
                  "text/csv;charset=utf-8;",
              }
            );

          downloadBlob(
            blob,
            getExportFilename(
              "csv",
              startDate,
              endDate
            )
          );
        }

        if (format === "xlsx") {
          const workbook =
            buildExcelWorkbook(
              selected,
              selectedData,
              startDate,
              endDate
            );

          const workbookBuffer =
            XLSX.write(
              workbook,
              {
                bookType: "xlsx",
                type: "array",
              }
            );

          const blob =
            new Blob(
              [workbookBuffer],
              {
                type:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              }
            );

          downloadBlob(
            blob,
            getExportFilename(
              "xlsx",
              startDate,
              endDate
            )
          );
        }

        if (format === "pdf") {
          const pdf =
            buildPdf(
              selected,
              selectedData,
              startDate,
              endDate,
              summary
            );

          pdf.save(
            getExportFilename(
              "pdf",
              startDate,
              endDate
            )
          );
        }

        setMessage(
          `Export completed successfully: ${format.toUpperCase()} • ${periodLabel}`
        );
      } catch (exportError) {
        console.error(
          "Business export failed:",
          exportError
        );

        setMessage(
          exportError?.message ||
            "The export could not be completed."
        );
      } finally {
        setExporting(false);
      }
    }, 50);
  };

  if (loading) {
    return (
      <BusinessGate
        subscription={subscription}
        title="Business Exports"
        description="Export your UpTrend business data."
      >
        <div className="exports-page">
          <div className="premium-card exports-loading">
            Loading your business data...
          </div>
        </div>
      </BusinessGate>
    );
  }

  if (error) {
    return (
      <BusinessGate
        subscription={subscription}
        title="Business Exports"
        description="Export your UpTrend business data."
      >
        <div className="exports-page">
          <div className="premium-card exports-error">
            {error}
          </div>
        </div>
      </BusinessGate>
    );
  }

  return (
    <BusinessGate
      subscription={subscription}
      title="Business Exports"
      description="Export your business records in CSV, Excel or PDF format."
    >
      <div className="exports-page">

        <section className="exports-hero premium-card">

          <div>
            <div className="mini-label">
              BUSINESS TOOLS
            </div>

            <h2>
              Export Center
            </h2>

            <p>
              Choose exactly what you want
              to export, select the reporting
              period and choose your file
              format.
            </p>
          </div>

          <div className="exports-hero-stat">
            <span>
              SELECTED RECORDS
            </span>

            <strong>
              {totalSelectedRows.toLocaleString(
                "en-NG"
              )}
            </strong>

            <small>
              {selected.length} datasets
            </small>
          </div>

        </section>

        <section className="exports-period premium-card">

          <div className="exports-section-heading">
            <div>
              <span>
                DATE RANGE
              </span>

              <h3>
                Choose export period
              </h3>
            </div>

            <strong>
              {periodLabel}
            </strong>
          </div>

          <div className="exports-period-buttons">

            <button
              type="button"
              className={
                period === "7days"
                  ? "active"
                  : ""
              }
              onClick={() =>
                applyPeriod(
                  "7days"
                )
              }
            >
              7 Days
            </button>

            <button
              type="button"
              className={
                period === "30days"
                  ? "active"
                  : ""
              }
              onClick={() =>
                applyPeriod(
                  "30days"
                )
              }
            >
              30 Days
            </button>

            <button
              type="button"
              className={
                period === "90days"
                  ? "active"
                  : ""
              }
              onClick={() =>
                applyPeriod(
                  "90days"
                )
              }
            >
              90 Days
            </button>

            <button
              type="button"
              className={
                period === "custom"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setPeriod(
                  "custom"
                )
              }
            >
              Custom
            </button>

          </div>

          <div className="exports-date-fields">

            <label>
              <span>
                From
              </span>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) => {
                  setPeriod(
                    "custom"
                  );
                  setStartDate(
                    event.target
                      .value
                  );
                  setMessage("");
                }}
              />
            </label>

            <label>
              <span>
                To
              </span>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={(
                  event
                ) => {
                  setPeriod(
                    "custom"
                  );
                  setEndDate(
                    event.target
                      .value
                  );
                  setMessage("");
                }}
              />
            </label>

          </div>

        </section>

        <section className="exports-datasets premium-card">

          <div className="exports-section-heading">

            <div>
              <span>
                DATASETS
              </span>

              <h3>
                What do you want to export?
              </h3>
            </div>

            <div className="exports-selection-actions">

              <button
                type="button"
                onClick={
                  selectAll
                }
              >
                Select All
              </button>

              <button
                type="button"
                onClick={
                  clearAll
                }
              >
                Clear All
              </button>

            </div>

          </div>

          <div className="exports-dataset-grid">

            {EXPORT_ORDER.map(
              (key) => {
                const config =
                  EXPORT_TABLES[
                    key
                  ];

                const checked =
                  selected.includes(
                    key
                  );

                return (
                  <button
                    type="button"
                    key={key}
                    className={
                      checked
                        ? "exports-dataset active"
                        : "exports-dataset"
                    }
                    onClick={() =>
                      toggleDataset(
                        key
                      )
                    }
                  >
                    <span
                      className="exports-check"
                    >
                      {checked
                        ? "✓"
                        : ""}
                    </span>

                    <span>
                      <strong>
                        {
                          config.label
                        }
                      </strong>

                      <small>
                        {(
                          selectedData[
                            key
                          ] ||
                          []
                        ).length.toLocaleString(
                          "en-NG"
                        )}{" "}
                        records
                      </small>
                    </span>
                  </button>
                );
              }
            )}

          </div>

        </section>

        <section className="exports-format premium-card">

          <div className="exports-section-heading">

            <div>
              <span>
                FILE FORMAT
              </span>

              <h3>
                How should we export it?
              </h3>
            </div>

          </div>

          <div className="exports-format-grid">

            <button
              type="button"
              className={
                format === "csv"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFormat(
                  "csv"
                )
              }
            >
              <strong>
                CSV
              </strong>

              <span>
                Spreadsheet-ready data
              </span>
            </button>

            <button
              type="button"
              className={
                format === "xlsx"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFormat(
                  "xlsx"
                )
              }
            >
              <strong>
                Excel
              </strong>

              <span>
                Real .xlsx workbook
              </span>
            </button>

            <button
              type="button"
              className={
                format === "pdf"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFormat(
                  "pdf"
                )
              }
            >
              <strong>
                PDF
              </strong>

              <span>
                Professional document
              </span>
            </button>

          </div>

        </section>

        <section className="exports-summary premium-card">

          <div>
            <span>
              SELECTED PERIOD
            </span>

            <strong>
              {periodLabel}
            </strong>
          </div>

          <div>
            <span>
              REVENUE
            </span>

            <strong>
              {formatMoney(
                summary.revenue
              )}
            </strong>
          </div>

          <div>
            <span>
              GROSS PROFIT
            </span>

            <strong>
              {formatMoney(
                summary.grossProfit
              )}
            </strong>
          </div>

          <div>
            <span>
              EXPENSES
            </span>

            <strong>
              {formatMoney(
                summary.expenses
              )}
            </strong>
          </div>

          <div>
            <span>
              NET PROFIT
            </span>

            <strong>
              {formatMoney(
                summary.netProfit
              )}
            </strong>
          </div>

        </section>

        <section className="exports-action-card premium-card">

          <div>
            <span>
              READY TO EXPORT
            </span>

            <h3>
              {selected.length
                ? `${selected.length} datasets selected`
                : "Select at least one dataset"}
            </h3>

            <p>
              Period:{" "}
              {periodLabel}
            </p>
          </div>

          <button
            type="button"
            disabled={
              exporting ||
              !hasSelection
            }
            onClick={
              handleExport
            }
          >
            {exporting
              ? "Preparing export..."
              : `Export ${format.toUpperCase()}`}
          </button>

        </section>

        {message && (
          <div className="exports-message premium-card">
            {message}
          </div>
        )}

      </div>
    </BusinessGate>
  );
}

export default Exports;
