const DEFAULT_FINANCE = {
  openingBalance: 0,
};

export function calculateRevenue(sales = []) {
  return sales.reduce(
    (total, sale) =>
      total +
      Number(
        sale.totalSelling ??
          sale.totalSales ??
          0
      ),
    0
  );
}

export function calculateProductCost(sales = []) {
  return sales.reduce(
    (total, sale) =>
      total +
      Number(
        sale.totalCost ??
          (
            Number(sale.costPrice || 0) *
            Number(sale.quantity || 0)
          )
      ),
    0
  );
}

export function calculateGrossProfit(sales = []) {
  return (
    calculateRevenue(sales) -
    calculateProductCost(sales)
  );
}

export function calculateExpenses(expenses = []) {
  return expenses.reduce(
    (total, expense) =>
      total +
      Number(expense.amount || 0),
    0
  );
}

/*
 * Net profit is never displayed as a negative
 * business profit in UpTrend.
 *
 * If expenses are greater than gross profit,
 * the uncovered amount is handled separately
 * as Remaining Expenses.
 */
export function calculateNetProfit(
  sales = [],
  expenses = []
) {
  const grossProfit =
    calculateGrossProfit(sales);

  const expenseTotal =
    calculateExpenses(expenses);

  return Math.max(
    grossProfit - expenseTotal,
    0
  );
}

export function calculateRemainingExpenses(
  sales = [],
  expenses = []
) {
  const grossProfit =
    calculateGrossProfit(sales);

  const expenseTotal =
    calculateExpenses(expenses);

  return Math.max(
    expenseTotal - grossProfit,
    0
  );
}

export function calculateCashFlow(
  sales = [],
  expenses = [],
  finance = DEFAULT_FINANCE
) {
  const openingBalance = Number(
    finance?.openingBalance || 0
  );

  const cashIn =
    calculateRevenue(sales);

  const cashOut =
    calculateExpenses(expenses);

  const balance =
    openingBalance +
    cashIn -
    cashOut;

  return {
    openingBalance,
    cashIn,
    cashOut,
    balance,
  };
}

export function calculateFinancialSummary(
  sales = [],
  expenses = [],
  finance = DEFAULT_FINANCE
) {
  const openingBalance = Number(
    finance?.openingBalance || 0
  );

  const revenue =
    calculateRevenue(sales);

  const productCost =
    calculateProductCost(sales);

  const grossProfit =
    revenue - productCost;

  const expenseTotal =
    calculateExpenses(expenses);

  const netProfit = Math.max(
    grossProfit - expenseTotal,
    0
  );

  const remainingExpenses = Math.max(
    expenseTotal - grossProfit,
    0
  );

  const cashIn = revenue;

  const cashOut = expenseTotal;

  const cashAtHand =
    openingBalance +
    cashIn -
    cashOut;

  return {
    openingBalance,

    revenue,

    productCost,

    grossProfit,

    expenses: expenseTotal,

    netProfit,

    remainingExpenses,

    cashIn,

    cashOut,

    cashAtHand,

    closingBalance: cashAtHand,

    nextOpeningBalance: cashAtHand,
  };
}

export function calculatePeriodSummary(
  sales = [],
  expenses = [],
  openingBalance = 0
) {
  const finance = {
    openingBalance:
      Number(openingBalance || 0),
  };

  return calculateFinancialSummary(
    sales,
    expenses,
    finance
  );
}