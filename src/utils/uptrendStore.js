const PRODUCTS_KEY = "uptrend_products";
const SALES_KEY = "uptrend_sales";
const EXPENSES_KEY = "uptrend_expenses";

const RESET_KEY = "uptrend_initial_reset_v1";

function runInitialReset() {
  try {
    const alreadyReset =
      localStorage.getItem(RESET_KEY);

    if (alreadyReset === "done") {
      return;
    }

    localStorage.removeItem(PRODUCTS_KEY);
    localStorage.removeItem(SALES_KEY);
    localStorage.removeItem(EXPENSES_KEY);
    localStorage.removeItem("uptrend_finance");

    localStorage.setItem(
      PRODUCTS_KEY,
      JSON.stringify([])
    );

    localStorage.setItem(
      SALES_KEY,
      JSON.stringify([])
    );

    localStorage.setItem(
      EXPENSES_KEY,
      JSON.stringify([])
    );

    localStorage.setItem(
      "uptrend_finance",
      JSON.stringify({
        openingBalance: 0,
      })
    );

    localStorage.setItem(
      RESET_KEY,
      "done"
    );
  } catch (error) {
    console.error(
      "UpTrend initial reset failed:",
      error
    );
  }
}

runInitialReset();

export function getProducts() {
  try {
    const saved =
      localStorage.getItem(PRODUCTS_KEY);

    return saved
      ? JSON.parse(saved)
      : [];
  } catch {
    return [];
  }
}

export function saveProducts(products) {
  localStorage.setItem(
    PRODUCTS_KEY,
    JSON.stringify(products)
  );
}

export function getSales() {
  try {
    const saved =
      localStorage.getItem(SALES_KEY);

    return saved
      ? JSON.parse(saved)
      : [];
  } catch {
    return [];
  }
}

export function saveSales(sales) {
  localStorage.setItem(
    SALES_KEY,
    JSON.stringify(sales)
  );
}

export function getExpenses() {
  try {
    const saved =
      localStorage.getItem(EXPENSES_KEY);

    return saved
      ? JSON.parse(saved)
      : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses) {
  localStorage.setItem(
    EXPENSES_KEY,
    JSON.stringify(expenses)
  );
}

export function generateId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getBusinessData() {
  return {
    products: getProducts(),
    sales: getSales(),
    expenses: getExpenses(),
  };
}
