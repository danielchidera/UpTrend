import Dexie from "dexie";

export const db = new Dexie("UpTrendLocalDB");

db.version(1).stores({
  products: "id, user_id, name, updated_at",
  sales: "id, user_id, created_at, updated_at",
  expenses: "id, user_id, expense_date, updated_at",
  customers: "id, user_id, name, updated_at",
  suppliers: "id, user_id, name, updated_at",

  invoices: "id, user_id, customer_id, updated_at",
  invoiceItems: "id, invoice_id",

  supplierPurchases: "id, user_id, supplier_id, product_id, purchase_date",
  supplierPayments: "id, user_id, purchase_id, payment_date",
  supplierAccountTransactions: "id, user_id, supplier_id, transaction_date",

  inventoryActivity: "id, user_id, product_id, created_at",
  salePayments: "id, user_id, created_at",
  saleReturns: "id, user_id, return_date",

  creditDebts: "id, user_id, updated_at",
  creditDebtPayments: "id, user_id, created_at",

  financeTransactions: "id, user_id, created_at",
  financeSettings: "id, user_id",
  recurringExpenses: "id, user_id, updated_at",
  businessTargets: "id, user_id, updated_at",

  syncQueue: "++id, &operation_id, user_id, table_name, record_id, status, created_at",
  syncMeta: "key"
});

// Version 2 preserves every existing table and adds expense debit caching.
db.version(2).stores({
  products: "id, user_id, name, updated_at",
  sales: "id, user_id, created_at, updated_at",
  expenses: "id, user_id, expense_date, updated_at",
  customers: "id, user_id, name, updated_at",
  suppliers: "id, user_id, name, updated_at",
  invoices: "id, user_id, customer_id, updated_at",
  invoiceItems: "id, invoice_id",
  supplierPurchases: "id, user_id, supplier_id, product_id, purchase_date",
  supplierPayments: "id, user_id, purchase_id, payment_date",
  supplierAccountTransactions: "id, user_id, supplier_id, transaction_date",
  inventoryActivity: "id, user_id, product_id, created_at",
  salePayments: "id, user_id, created_at",
  saleReturns: "id, user_id, return_date",
  creditDebts: "id, user_id, updated_at",
  creditDebtPayments: "id, user_id, created_at",
  financeTransactions: "id, user_id, created_at",
  financeSettings: "id, user_id",
  recurringExpenses: "id, user_id, updated_at, next_due_date",
  businessTargets: "id, user_id, updated_at",
  syncQueue: "++id, &operation_id, user_id, table_name, record_id, status, created_at",
  syncMeta: "key",
  expenseDebits: "id, user_id, created_at"
});

const CACHE_TABLES = [
  "products",
  "suppliers",
  "expenses",
  "expenseDebits",
  "recurringExpenses",
  "inventoryActivity",
  "sales",
  "customers",
  "financeTransactions",
];

export async function saveCachedRecords(tableName, userId, records) {
  if (!CACHE_TABLES.includes(tableName)) {
    throw new Error(`Caching is not enabled for ${tableName}.`);
  }

  if (!userId) {
    throw new Error("A user ID is required to save cached records.");
  }

  if (!Array.isArray(records)) {
    throw new Error("Cached records must be an array.");
  }

  await db.open();

  const table = db.table(tableName);

  const userRecords = records.map((record) => ({
    ...record,
    user_id: userId,
  }));

  await db.transaction("rw", table, async () => {
    await table.where("user_id").equals(userId).delete();

    if (userRecords.length > 0) {
      await table.bulkPut(userRecords);
    }
  });

  return userRecords.length;
}

export async function getCachedRecords(tableName, userId) {
  if (!CACHE_TABLES.includes(tableName)) {
    throw new Error(`Caching is not enabled for ${tableName}.`);
  }

  if (!userId) {
    return [];
  }

  await db.open();

  return db.table(tableName)
    .where("user_id")
    .equals(userId)
    .toArray();
}

export async function testLocalDatabase() {
  await db.open();

  return {
    database: db.name,
    tables: db.tables.map((table) => table.name),
    isOpen: db.isOpen(),
  };
}

export async function runLocalDatabaseTest() {
  const result = await testLocalDatabase();

  await db.products.put({
    id: "offline-test-001",
    name: "Offline Test Product",
    stock: 5,
  });

  const saved = await db.products.get("offline-test-001");

  await db.products.delete("offline-test-001");

  return {
    ...result,
    writeWorks: Boolean(saved),
    readWorks: Boolean(saved),
    deleteWorks: !(await db.products.get("offline-test-001")),
  };
}


export async function saveDashboardSnapshot(userId, snapshot) {
  if (!userId) {
    throw new Error("A user ID is required to save the Dashboard.");
  }

  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("A valid Dashboard snapshot is required.");
  }

  await db.open();

  const key = `dashboard:${userId}`;

  await db.syncMeta.put({
    key,
    user_id: userId,
    snapshot,
    updated_at: new Date().toISOString(),
  });

  return true;
}

export async function getDashboardSnapshot(userId) {
  if (!userId) return null;

  await db.open();

  const saved = await db.syncMeta.get(`dashboard:${userId}`);

  if (!saved || saved.user_id !== userId) {
    return null;
  }

  return saved.snapshot || null;
}

export async function saveCachedSubscription(userId, subscription) {
  if (!userId || !subscription) {
    throw new Error("A user ID and subscription are required.");
  }

  await db.open();

  const key = `subscription:${userId}`;

  await db.syncMeta.put({
    key,
    user_id: userId,
    subscription,
    updated_at: new Date().toISOString(),
  });

  return true;
}

export async function getCachedSubscription(userId) {
  if (!userId) return null;

  await db.open();

  const key = `subscription:${userId}`;
  const saved = await db.syncMeta.get(key);

  if (!saved || saved.user_id !== userId) {
    return null;
  }

  return saved.subscription || null;
}
