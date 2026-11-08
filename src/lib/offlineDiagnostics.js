import {
  db,
  getCachedRecords,
  getDashboardSnapshot,
  getCachedSubscription,
} from "./localDb";

export async function runOfflineDiagnostics(userId) {
  const results = [];

  const add = (name, status, details) => {
    results.push({ name, status, details });
  };

  const check = async (name, callback) => {
    try {
      await callback();
    } catch (error) {
      add(name, "FAIL", error.message || String(error));
    }
  };

  if (!userId) {
    return {
      overall: "FAIL",
      results: [{
        name: "User session",
        status: "FAIL",
        details: "A valid user ID is required.",
      }],
    };
  }

  await check("IndexedDB connection", async () => {
    await db.open();
    add(
      "IndexedDB connection",
      db.isOpen() ? "PASS" : "FAIL",
      db.isOpen() ? "Database opened successfully." : "Database is closed."
    );
  });

  const requiredTables = [
    "products",
    "sales",
    "expenses",
    "customers",
    "suppliers",
    "inventoryActivity",
    "financeTransactions",
    "syncQueue",
    "syncMeta",
  ];

  for (const name of requiredTables) {
    await check(`Database table: ${name}`, async () => {
      const exists = db.tables.some((table) => table.name === name);
      add(
        `Database table: ${name}`,
        exists ? "PASS" : "FAIL",
        exists ? "Table exists." : "Table is missing."
      );
    });
  }

  const datasets = [
    {
      table: "products",
      fields: ["id", "name", "stock", "cost_price"],
    },
    {
      table: "customers",
      fields: ["id", "name"],
    },
    {
      table: "financeTransactions",
      fields: [
        "id",
        "type",
        "amount",
        "status",
        "metadata",
        "created_at",
      ],
    },
  ];

  for (const dataset of datasets) {
    await check(`Offline cache: ${dataset.table}`, async () => {
      const records = await getCachedRecords(dataset.table, userId);

      if (!records.length) {
        add(
          `Offline cache: ${dataset.table}`,
          "WARNING",
          "No cached records found for this user."
        );
        return;
      }

      const missing = dataset.fields.filter(
        (field) => !records.some(
          (record) =>
            Object.prototype.hasOwnProperty.call(record, field)
        )
      );

      add(
        `Offline cache: ${dataset.table}`,
        missing.length ? "WARNING" : "PASS",
        `${records.length} records found. ${
          missing.length
            ? `Missing required fields: ${missing.join(", ")}`
            : "Required fields are available."
        }`
      );
    });
  }

  await check("Dashboard snapshot", async () => {
    const snapshot = await getDashboardSnapshot(userId);

    add(
      "Dashboard snapshot",
      snapshot ? "PASS" : "WARNING",
      snapshot
        ? "Saved Dashboard snapshot found."
        : "No saved Dashboard snapshot found."
    );
  });

  await check("Subscription cache", async () => {
    const subscription = await getCachedSubscription(userId);

    add(
      "Subscription cache",
      subscription ? "PASS" : "WARNING",
      subscription
        ? `Saved subscription found: ${subscription.plan || "Unknown plan"}.`
        : "No saved subscription found."
    );
  });

  await check("Sync queue inspection", async () => {
    const queue = await db.syncQueue
      .where("user_id")
      .equals(userId)
      .toArray();

    const pending = queue.filter(
      (item) => item.status === "pending"
    ).length;

    const failed = queue.filter(
      (item) => item.status === "failed"
    ).length;

    add(
      "Sync queue inspection",
      "WARNING",
      `${queue.length} queued operations; ${pending} pending; ${failed} failed. Queue processing is not yet verified.`
    );
  });

  add(
    "Network status",
    navigator.onLine ? "PASS" : "WARNING",
    navigator.onLine
      ? "Browser currently reports an internet connection."
      : "Browser currently reports offline."
  );

  const failures = results.filter(
    (item) => item.status === "FAIL"
  ).length;

  const warnings = results.filter(
    (item) => item.status === "WARNING"
  ).length;

  return {
    overall: failures ? "FAIL" : warnings ? "WARNING" : "PASS",
    summary: {
      passed: results.filter((item) => item.status === "PASS").length,
      warnings,
      failed: failures,
      total: results.length,
    },
    results,
    testedAt: new Date().toISOString(),
  };
}
