import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./OnboardingTour.css";

const tours = {
  dashboard: [
    { target: ".dashboard-hero", title: "Welcome to your Business Dashboard", text: "Your Dashboard is your business control centre. It brings together your money, sales, customer debts, expenses, inventory and performance. We will explain each section individually." },
    { target: ".dashboard-date-filter", title: "Viewing Date", text: "Choose a date to view business figures for that day. This affects daily sales, collections, expenses, profit, inventory and balance. Free accounts have limited historical access." },
    { target: ".hero-balance-card", title: "Current Business Balance", text: "This is the total calculated money your business has as of the selected date. It combines cash and bank balances. It is not your total sales or profit." },
    { target: ".hero-balance-flow", title: "Cash and Bank Breakdown", text: "Cash is the calculated physical cash balance in your business. Bank is the calculated bank balance. Together, they make up your Current Balance." },
    { target: ".hero-balance-edit", title: "Opening Cash Settings", text: "If opening cash has not been set, this button lets you enter the cash your business started with in this record book. It is a one-time opening balance." },
    { target: ".dashboard-kpi-card:nth-child(1)", title: "Total Sales", text: "This is the net value of sales made on the selected date after recorded sales refunds. It measures sales value, not necessarily money already collected." },
    { target: ".dashboard-kpi-card:nth-child(2)", title: "Collected", text: "This is actual money received on the selected date from customer sale payments and debt repayments. It distinguishes money received from the total value of sales." },
    { target: ".dashboard-kpi-card:nth-child(3)", title: "Customer Debt", text: "This is the outstanding amount customers still owe your business as of the selected date, after recorded debt payments." },
    { target: ".dashboard-kpi-card:nth-child(4)", title: "Expenses", text: "This is the total business expenses recorded for the selected date. Use it to monitor daily business spending." },
    { target: ".dashboard-kpi-card:nth-child(5)", title: "Inventory Value", text: "This is the estimated cost value of available stock, calculated using stock quantity multiplied by product cost price. The smaller figure shows the total units in stock." },
    { target: ".dashboard-kpi-card:nth-child(6)", title: "Profit", text: "This is gross profit for the selected date after accounting for recorded returns. It is not net profit after all business expenses." },
    { target: ".dashboard-customer-finance", title: "Customer Finance", text: "This section helps you monitor customers who have not fully paid. It displays up to five of your largest outstanding customer debts." },
    { target: ".dashboard-debt-table", title: "Understanding the Debt Table", text: "Customer identifies who owes you. Latest Sale identifies the related product or sale. Outstanding is the unpaid amount. Due Date shows when payment is expected. Status shows whether the debt is Pending or Overdue." },
    { target: ".dashboard-view-all-btn", title: "View All Customer Debts", text: "Use View All to open the complete list of outstanding customer debts instead of viewing only the top five." },
    { target: ".recent-sales-panel", title: "Recent Sales", text: "This section displays your five most recent sales, helping you quickly review products sold, quantities, net sales revenue and profit after recorded returns." },
    { target: ".recent-sale-row", title: "Understanding a Sale Record", text: "The product name identifies what was sold. Quantity shows the units sold. The amount on the right is net sales revenue, while the figure below it is profit after returns. Return notices identify partially or fully returned sales." },
    { target: ".recent-transactions-panel", title: "Recent Bank Transactions", text: "This section displays your latest completed bank credits and debits. Credits are money entering the bank account; debits are money leaving it." },
    { target: ".recent-transaction-row", title: "Understanding Bank Activity", text: "The description identifies the transaction. The date shows when it was recorded. Money in is displayed as a credit with a plus sign; money out is displayed as a debit with a minus sign." },
    { target: ".performance-panel", title: "Sales Performance", text: "This section helps you understand how your business performs over time. It includes sales trends and a comparison between sales and expenses. Some performance tools require UpTrend Business." },
    { target: ".real-sales-chart", title: "Sales Performance Chart", text: "The green line represents sales over time. The vertical scale shows monetary values, while the dates along the bottom show when sales occurred. You can scroll horizontally to explore the timeline." },
    { target: ".daily-comparison", title: "Sales vs Expenses", text: "This chart compares daily sales with daily expenses. The two sets of bars help you see how much came in through sales compared with what the business spent." },
    { target: ".performance-summary", title: "Financial Performance Summary", text: "Total Sales shows net sales revenue across recorded sales. Gross Profit shows profit from those sales before deducting all business expenses. These figures help you assess overall performance." }
  ],
  sales: [
    { target: ".sales-page-top", title: "Welcome to Sales", text: "Your Sales page is your sales record centre. It lets you review recorded transactions, monitor sales and gross profit, search for products, inspect receipts, edit records, delete sales and process customer returns." },
    { target: ".sales-overview", title: "Sales Performance Overview", text: "These four summary cards automatically calculate figures from the sales records currently matching your search and date filters. They update whenever you change those filters." },
    { target: ".sales-overview-card:nth-child(1)", title: "Filtered Sales", text: "This is the total net sales value of the matching transactions after recorded refunds. It represents the value of sales, not necessarily the amount of money already collected." },
    { target: ".sales-overview-card:nth-child(2)", title: "Gross Profit", text: "This shows the gross profit from the matching sales after the return adjustments included in the calculation. Gross profit is before business expenses such as rent, transport, salaries and electricity." },
    { target: ".sales-overview-card:nth-child(3)", title: "Units Sold", text: "This totals the remaining quantity across the matching sales. Returned units are excluded, so this helps you see how many units from those sales have not been returned." },
    { target: ".sales-overview-card:nth-child(4)", title: "Transactions", text: "This is the number of sale records matching your current search and date filters. It counts transactions, not individual units sold." },
    { target: ".sales-filter-card", title: "Search and Date Filters", text: "Use this section to narrow the sales records you want to review. You can search by product name, choose a date range and clear your filters to start again." },
    { target: ".sales-search", title: "Search Products", text: "Type a product name to find matching sales. The search checks product names and works together with your selected date filter." },
    { target: ".sales-filter-buttons", title: "Date Filter Options", text: "All displays every sale your account can access. Today displays today's sales. 7 Days and 30 Days show their respective recent periods. Custom lets you choose your own From and To dates. Free accounts have restricted access to older records; UpTrend Business unlocks the full sales history." },
    { target: ".clear-sales-filter", title: "Clear Filters", text: "Use this to remove the product search and custom dates and return the date selection to Today. Your sales list and summary figures will update." },
    { target: ".report-summary-card", title: "Financial Summary", text: "This section gives you a financial breakdown of the sales period selected above. It brings together revenue, product costs, gross profit and expenses to help you understand the financial result." },
    { target: ".report-summary-lines", title: "Understanding Your Financial Summary", text: "Revenue is the sales revenue for the period. Product Cost is the cost of goods sold. Gross Profit is revenue after product costs. Expenses are recorded business expenses. Remaining Expenses shows the remaining expense amount used in the calculation. Net Profit is the result after expenses. Total displays the cash-at-hand figure returned by the financial summary calculation." },
    { target: ".report-remaining-line", title: "Remaining Expenses", text: "This figure shows the remaining expenses amount calculated by UpTrend for the selected period. Its colour helps distinguish a positive remaining amount from a loss. It is part of the financial summary calculation." },
    { target: ".report-total-line", title: "Financial Total", text: "This total displays the cash-at-hand value returned by the financial summary. It is not the same as revenue or gross profit." },
    { target: ".sales-center-card", title: "Sales Ledger", text: "This is your transaction ledger. It lists the sales matching your filters and shows how each transaction contributes to your business records. The result count tells you how many records are displayed." },
    { target: ".sales-center-table", title: "Understanding the Sales Table", text: "Date shows when the sale was recorded. Product identifies the item sold. Qty shows the original quantity, with returned and remaining quantities where applicable. Cost is the total cost of the units. Sales is the original total selling value. Gross Profit shows the recorded profit or loss for that sale." },
    { target: ".sales-product-cell", title: "Product and Return Indicators", text: "The product name identifies the item. A Returned label means all units have been returned. The linked-transfer symbol indicates a connection to a bank transfer. Return details show how many units were returned and how many remain." },
    { target: ".sales-center-actions", title: "View, Edit and Delete", text: "View opens the full sale details and receipt, including payment, profit, debt and return information. Edit opens the sale for correction. Delete asks for confirmation and removes the sale through the system's sale-deletion process, which also handles inventory restoration. Only delete a record when you are sure." },
    { target: ".sales-mobile-list", title: "Mobile Sales Records", text: "On smaller screens, sales are presented as individual cards instead of a wide table. Each card shows the product, date, quantity, sales, cost, profit and the same View, Edit and Delete actions." },
    { target: ".sales-modal", title: "Sale Details and Receipt", text: "When you select View, this window displays the selected sale's receipt and detailed information. Review the product, date, quantity, prices, total sales, payment method, profit and any recorded returns or customer debt." },
    { target: ".sales-detail-grid", title: "Complete Sale Information", text: "This section provides the detailed breakdown. If the sale is linked to customer credit, it also shows the original debt, amount paid, remaining debt and debt status. Return figures show returned units, remaining units and total refunded." },
    { target: ".sales-modal-footer", title: "Receipt and Sale Actions", text: "Close exits the details window. Return / Refund opens the return form when units remain. Print Receipt opens the print function. Edit Sale takes you to the sale editing screen. A fully returned sale cannot be returned again." },
    { target: ".sales-return-panel", title: "Return and Refund Form", text: "Use this form when a customer returns items from a recorded sale. Enter the quantity being returned, choose how the customer was refunded, select the matching completed bank debit for a transfer refund, and optionally enter the reason. Check the estimated refund before confirming. Transfer refunds require an existing completed debit with an exact matching amount." },
    { target: ".sales-return-grid", title: "Return Form Fields", text: "Quantity to return must be a whole number greater than zero and cannot exceed the remaining quantity. Refund method lets you choose Cash or Transfer. Transfer requires selecting an eligible unused completed debit. Reason is optional and records why the item was returned." },
    { target: ".sales-return-summary", title: "Estimated Refund", text: "This amount is calculated from the original selling price per unit multiplied by the quantity being returned. Review it before confirming the return." },
    { target: ".sales-return-actions", title: "Confirm or Cancel a Return", text: "Cancel closes the return form without processing it. Confirm Return submits the return, records the refund and updates the sale's returned and remaining quantities. For transfer refunds, the selected completed debit must match the calculated refund exactly." },
    { target: ".report-products-card", title: "Best-Selling Products", text: "This section ranks your top five products by the number of units sold during the selected period. Use it to identify the products customers are buying most." },
    { target: ".report-product-list", title: "Product Performance Breakdown", text: "Each row shows a product's ranking, name, units sold, sales revenue and gross profit. Products are ranked by units sold, not by revenue or profit. Compare the figures to understand which products sell most and how much they generate." },
    { target: ".historical-access-modal", title: "Unlock Older Sales Records", text: "Free accounts can access sales from today and the previous seven days. UpTrend Business provides access to older sales records. Upgrade to Business opens the plan upgrade process; Maybe later closes this message." }
  ],
  record: [
    { target: ".record-page-top", title: "Welcome to Record Sales", text: "This is where you enter new sales into UpTrend. The guided process captures the sale date, customer, product, quantity, selling price and payment details. UpTrend uses the information to update your sales records and inventory." },
    { target: ".record-workspace", title: "Your Sales Recording Workspace", text: "This workspace is the starting point for recording a sale. It also displays the date of your last recorded sale, helping you keep track of your latest entry." },
    { target: ".record-workspace-footer", title: "Last Sale", text: "This displays the date of the last sale you recorded or updated. When recording another sale, UpTrend can reuse this date as the starting date." },
    { target: ".record-sale-open-button", title: "Start Recording a Sale", text: "Select this button to open the five-step sale recording form. You will enter the date, product, quantity, selling price and payment information before saving." },
    { target: ".record-back-button", title: "Return to Dashboard", text: "Use this button to leave the Record Sales page and return to your Dashboard." },
    { target: ".historical-access-modal", title: "Historical Sales Access", text: "Free accounts can record and edit sales from today and the previous seven days. UpTrend Business unlocks older sales dates. Upgrade to Business opens the upgrade process; Maybe later closes this message." }
  ],
  products: [
    { target: ".products-page-top", title: "Welcome to Products & Stock", text: "This page is your inventory control centre. Monitor products, available stock, inventory value, stock movements, supplier relationships and replenishment needs. Products are added to inventory automatically when you record purchases through Suppliers." },
    { target: ".inventory-alert-danger", title: "Out-of-Stock Alert", text: "This warning appears when one or more products have no available stock. Restock these products through the Suppliers page before recording further sales." },
    { target: ".inventory-alert-warning", title: "Low-Stock Alert", text: "This warning identifies products whose available quantity has reached or fallen below their configured low-stock threshold." },
    { target: ".inventory-overview", title: "Inventory Overview", text: "These four cards summarise your product catalogue, total available units, inventory value at cost price and products that need stock attention." },
    { target: ".inventory-stat:nth-child(1)", title: "Products", text: "Shows the number of products currently registered in your inventory." },
    { target: ".inventory-stat:nth-child(2)", title: "Stock Units", text: "Shows the combined quantity of all units currently available across your products." },
    { target: ".inventory-stat:nth-child(3)", title: "Inventory Value", text: "Shows the value of your current stock using each product's recorded cost price multiplied by its available quantity. This is cost value, not selling value." },
    { target: ".inventory-stat:nth-child(4)", title: "Needs Attention", text: "Counts products that are either low in stock or completely out of stock." },
    { target: ".products-list-card", title: "Current Inventory", text: "The Stock on Hand section displays your product catalogue and the latest available stock information." },
    { target: ".products-table-wrap", title: "Understand the Stock Table", text: "Product shows the product name and its low-stock alert threshold. Cost is its recorded unit cost price. Stock is the current available quantity. Status indicates whether it is in stock, low or out of stock. Supplier identifies its linked supplier. Last Purchase shows the most recent recorded purchase date." },
    { target: ".product-supplier-link", title: "Supplier Connection", text: "Select a linked supplier's name to open that supplier's record. Products without an assigned supplier are marked No supplier." },
    { target: ".products-business-banner", title: "Unlock Business Inventory Intelligence", text: "Business membership provides extended inventory history, stock movement trends, restock intelligence, supplier analysis, valuation and product performance insights." },
    { target: ".products-business-section", title: "Inventory Command Center", text: "This Business-only area analyses inventory health, capital exposure, stock movement, product performance and replenishment pressure." },
    { target: ".inventory-command-hero", title: "Inventory Health", text: "The health score provides a combined view of products below their stock thresholds and products with no available stock. The supporting figures show your product count, low-stock count and out-of-stock count." },
    { target: ".inventory-health-ring", title: "Inventory Health Score", text: "This percentage summarises the proportion of products that are not currently classified as low-stock or out-of-stock. Healthy, Needs attention and At risk are the corresponding status labels." },
    { target: ".inventory-command-value", title: "Capital Position", text: "Shows the capital currently tied up in inventory at recorded cost prices. Average product value is the average inventory value per product. Highest-value product shows the largest individual product stock value. Net movement compares recorded incoming and outgoing units." },
    { target: ".inventory-command-kpis", title: "Stock Movement Indicators", text: "Stock In totals recorded incoming units. Stock Out totals outgoing units. Restock Queue counts products requiring attention. 14-Day Movement totals incoming and outgoing units recorded over the last fourteen days." },
    { target: ".inventory-command-wide", title: "Inventory Analysis", text: "The wider analysis panels provide deeper insights into stock movement, replenishment and historical activity." },
    { target: ".inventory-trend-chart", title: "14-Day Stock Movement", text: "This chart compares daily incoming and outgoing inventory quantities over fourteen days. Green represents Stock In and red represents Stock Out." },
    { target: ".inventory-business-grid", title: "Product and Supplier Intelligence", text: "These panels identify fast-moving products, slow or inactive stock, supplier concentration and the products with the most recorded inventory activity." },
    { target: ".inventory-analysis-card:nth-child(1)", title: "Fast Movers", text: "Lists products with the highest recorded outgoing movement. Use this information to identify products that may require more frequent replenishment." },
    { target: ".inventory-analysis-card:nth-child(2)", title: "Slow and Idle Stock", text: "Identifies products with lower recorded movement or no recorded movement. Review these products to understand whether stock is remaining unused and tying up capital." },
    { target: ".business-restock-list", title: "Replenishment Queue", text: "Lists products at or below their low-stock thresholds. Suggested units provide a replenishment estimate, while estimated cost multiplies the suggested quantity by the recorded unit cost. Urgency identifies critical, urgent or watch items." },
    { target: ".business-restock-row", title: "Restock Recommendation", text: "Each row shows the product, quantity currently on hand, configured threshold, suggested replenishment quantity and estimated purchase cost. Where available, use Supplier to open the linked supplier." },
    { target: ".supplier-exposure-list", title: "Supplier Exposure", text: "Shows how many products, stock units and how much inventory value are associated with each supplier. Unassigned products are grouped separately." },
    { target: ".business-history-table-wrap", title: "Business Inventory History", text: "Business users can review extended inventory movement records, including the date, product, movement direction, quantity and reason." },
    { target: ".inventory-activity-card", title: "Inventory Activity", text: "This activity trail follows stock movements caused by purchases, sales, customer returns and other inventory changes." },
    { target: ".activity-filters", title: "Filter Inventory Activity", text: "All displays incoming and outgoing movements. Stock In shows inventory increases. Stock Out shows inventory decreases. Select a filter to focus on the movement type you want to review." },
    { target: ".activity-list", title: "Read an Activity Record", text: "Each activity entry shows the date and time, product name, quantity moved, activity type and explanation. Where available, additional details identify the supplier, purchase cost or sale/refund value." }
  ],
  expenses: [
    { target: ".expenses-page-top", title: "Welcome to Expenses", text: "The Expenses page helps you record, monitor and understand the money your business spends. You can record individual or multiple expenses, analyse spending patterns and manage regular business costs." },
    { target: ".expense-add-button", title: "Record Expense", text: "Open the expense form to record a new expense. You can enter one expense or prepare several expenses and save them together." },
    { target: ".expense-overview", title: "Expense Overview", text: "These cards summarise your business spending and the number of expense records in your account." },
    { target: ".expense-stat:nth-child(1)", title: "Total Expenses", text: "Displays the combined amount of all recorded expenses." },
    { target: ".expense-stat:nth-child(2)", title: "Transactions", text: "Displays the number of expense records saved in your account." },
    { target: ".expense-stat:nth-child(3)", title: "Business Outflow", text: "Shows the total money leaving your business through recorded expenses." },
    { target: ".expense-business-analysis", title: "Expense Category Analysis", text: "This Business feature helps you understand how your spending is distributed across different expense categories." },
    { target: ".expense-analysis-summary", title: "Spending Summary", text: "Total spending is the combined amount recorded. Average expense is the average per expense record. Top category identifies the category with the highest total spending. Largest expense shows your biggest individual expense." },
    { target: ".expense-category-analysis", title: "Spending by Category", text: "Each category displays its total spending and percentage of overall expenses. The progress bars make it easier to compare categories." },
    { target: ".expense-performance-card", title: "Expense Performance", text: "Compare your spending over the latest seven days with spending during the preceding seven-day period." },
    { target: ".expense-performance-grid", title: "Seven-Day Comparison", text: "This 7 days shows spending in the latest seven days. Previous 7 days shows the preceding period. Change displays the percentage difference and whether spending increased, decreased or remained stable." },
    { target: ".expense-trend", title: "Seven-Day Spending Trend", text: "This chart shows daily expense activity across the latest seven days. Compare the bars to identify days with higher or lower spending." },
    { target: ".recurring-expenses-card", title: "Recurring Expenses", text: "UpTrend Business users can organise regular costs such as rent, salaries, subscriptions and utilities using recurring schedules." },
    { target: ".recurring-expense-form", title: "Add a Recurring Expense", text: "Enter the expense name, category, amount, frequency, start date, recording time, payment method and optional note. The frequency determines whether the schedule repeats daily, weekly, monthly or yearly." },
    { target: ".recurring-expense-list", title: "Manage Recurring Expenses", text: "Saved schedules show the expense name, category, frequency, amount and next due date. Use Active or Paused to control a schedule. Delete removes a recurring expense after confirmation." },
    { target: ".expenses-list-card", title: "Recorded Expense History", text: "Review all saved expense records here. If there are no records yet, use Record Expense to create your first entry." },
    { target: ".expenses-table-wrap", title: "Understand the Expense Table", text: "Date shows when the expense occurred. Expense shows its name. Category classifies the spending. Note contains additional details. Amount shows the money spent. Link status indicates whether a bank transaction is connected. Action contains the available record controls." },
    { target: ".expense-actions", title: "Edit and Delete", text: "Edit opens the expense form with the selected record's details. Delete removes the expense after you confirm. Take care when deleting records." },
    { target: ".historical-access-modal", title: "Historical Expense Access", text: "Free accounts can record and edit expenses from today and the previous seven days. UpTrend Business unlocks access to older expense dates. Upgrade to Business opens the upgrade process; Maybe later closes this message." }
  ],
  suppliers: [
    { target: ".suppliers-header", title: "Welcome to Suppliers", text: "The Suppliers page manages your supplier relationships, incoming goods, purchase records and outstanding debts. You can register suppliers, record multiple products in one delivery, make payments and review each supplier's account history." },
    { target: ".suppliers-header-actions", title: "Supplier Actions", text: "Use + Purchase to record incoming goods from a supplier. Use + Add Supplier to register a new supplier before recording purchases." },
    { target: ".supplier-overview", title: "Supplier Financial Overview", text: "These cards summarise your active supplier relationships, total goods purchased, payments made, outstanding supplier balances and overdue purchase balances." },
    { target: ".supplier-stat-card:nth-child(1)", title: "Active Suppliers", text: "Counts suppliers whose status is currently Active. Inactive suppliers are excluded." },
    { target: ".supplier-stat-card:nth-child(2)", title: "Total Purchases", text: "Shows the combined value of goods purchased from your suppliers." },
    { target: ".supplier-stat-card:nth-child(3)", title: "Total Paid", text: "Shows payments recorded against supplier purchases and general supplier account payments." },
    { target: ".supplier-stat-warning", title: "Outstanding", text: "Shows the amount still owed to suppliers. This combines unpaid purchase balances and outstanding existing supplier debt." },
    { target: ".supplier-stat-danger", title: "Overdue", text: "Shows outstanding purchase balances whose due dates have passed. This figure relates to overdue purchases." },
    { target: ".suppliers-toolbar", title: "Find and Filter Suppliers", text: "Use the search field to find suppliers by name, company name, phone number or email. Use the status filters to show all suppliers, active suppliers or inactive suppliers." },
    { target: ".supplier-search", title: "Search Suppliers", text: "Enter part of a supplier's name, company, phone number or email address. The directory updates to show matching records." },
    { target: ".supplier-filters", title: "Supplier Status Filters", text: "All shows every supplier. Active shows suppliers available for new purchases. Inactive shows suppliers marked inactive." },
    { target: ".suppliers-section", title: "Supplier Directory", text: "This section lists the suppliers matching your search and status filter. It also provides a quick way to start recording a purchase." },
    { target: ".supplier-section-purchase-btn", title: "Record Purchase from Directory", text: "Opens the purchase form. You can select the supplier and record one or several products delivered in the same batch." },
    { target: ".supplier-table-wrap", title: "Understand the Supplier Table", text: "Supplier identifies the supplier. Purchases counts recorded purchase records. Total Purchased shows the value of goods purchased. Paid shows recorded payments. Outstanding shows the remaining amount owed. Status indicates whether the supplier is active or inactive. Actions let you view, edit or delete the supplier." },
    { target: ".supplier-name-button", title: "Open Supplier Profile", text: "Select a supplier's name to open the full supplier profile, financial summaries, account ledger, purchase history and payment history." },
    { target: ".supplier-row-actions", title: "Supplier Management Actions", text: "View opens the supplier profile. Edit changes the supplier's details. Delete removes the supplier. If the supplier has purchase or account records, the confirmation explains that associated records will also be deleted." },
    { target: ".supplier-modal", title: "Supplier Forms and Details", text: "Supplier forms and profile screens open in a focused window. Each form has its own guided explanation when opened." },
    { target: ".supplier-details-modal", title: "Supplier Profile", text: "The profile brings together the supplier's contact information, financial position, existing debt, account payments, purchase balances and transaction history." },
    { target: ".supplier-profile-grid", title: "Supplier Contact Information", text: "Review the supplier's phone number, email, address and current status. Missing contact details are displayed as a dash." },
    { target: ".supplier-detail-stats", title: "Supplier Financial Summary", text: "Purchased is the total purchase value. Paid is the total recorded payment value. Outstanding is the combined remaining amount owed. Overdue shows overdue purchase balances." },
    { target: ".supplier-account-summary", title: "Account Balance Breakdown", text: "Existing Debt shows debt recorded separately from purchases. Account Payments shows payments against that existing debt. Existing Debt Balance is the remaining amount in that account ledger. Purchase Balance is the amount still owed on recorded purchases." },
    { target: ".supplier-detail-actions", title: "Manage This Supplier", text: "Record Purchase adds incoming goods. Record Existing Debt records an amount already owed without creating a purchase or adding stock. Pay Supplier Account reduces the combined outstanding balance. Edit Supplier changes the supplier's details." },
    { target: ".supplier-account-ledger", title: "Supplier Account Ledger", text: "This ledger records opening debt and general supplier account payments. Purchase-linked payments are kept separately in the purchase history." },
    { target: ".supplier-account-ledger-list", title: "Review Account Transactions", text: "Each entry identifies an opening debt or account payment, its transaction date, payment method, reference and notes where supplied. A linked bank debit label identifies a payment connected to a bank transaction." },
    { target: ".supplier-history", title: "Purchase History", text: "Review all recorded purchases from this supplier. Each purchase shows the product, purchase date, quantity, unit cost, total value, amount paid, remaining balance and payment status." },
    { target: ".supplier-purchase-list", title: "Purchase Records", text: "Each purchase card represents a recorded goods-in transaction. STOCK IN identifies the inventory movement. Use Pay to record a payment against an outstanding purchase, History to inspect its payments, or Delete to remove the purchase and its payment history." },
    { target: ".supplier-purchase-money", title: "Purchase Amounts", text: "Total is the full purchase value. Paid is the amount already paid. Balance is the amount still outstanding." },
    { target: ".supplier-purchase-actions", title: "Purchase Status and Actions", text: "The status can be Pending, Partially Paid, Paid, Overdue or Cancelled. Pay is available when a balance remains. History opens payment records. Delete removes the purchase and its payment history." },
    { target: ".supplier-payment-history", title: "Purchase Payment History", text: "When you select History on a purchase, this section displays its recorded payments, dates, methods and references. Where applicable, it also identifies the linked bank debit or batch purchase." },
    { target: ".supplier-payment-list", title: "Individual Payment Records", text: "Each payment entry shows the amount, payment date, payment method and reference. Linked bank debit details help you trace the corresponding bank transaction." }
  ],
  transactions: [
    { target: ".transactions-header", title: "Bank Transactions", text: "Welcome to Bank Transactions. This page helps you track money entering and leaving your business bank account, record cash and bank movements, and trace transactions linked to sales, expenses and supplier activities." },
    { target: ".transaction-stat.balance", title: "Available Bank Balance", text: "This is your current recorded bank balance. It changes as you record money coming in, money going out, deposits and cash withdrawals." },
    { target: ".transaction-balance-content", title: "Balance Breakdown", text: "Review the balance information displayed here to understand the current position of your business bank account." },
    { target: ".transaction-balance-actions", title: "Money Movement Actions", text: "These actions let you record money received, money sent, cash deposited into the bank, and money withdrawn from the bank into cash." },
    { target: ".transactions-button.receive", title: "Add Money", text: "Use Add Money when funds enter your bank account. You will be asked for the amount, transaction category, optional description and optional reference. Choose the category that best explains the source of the money." },
    { target: ".transactions-button.send", title: "Send Money", text: "Use Send Money when funds leave your bank account. Enter the amount, choose a category such as Expenses, Goods Purchase, Supplier Payment, Savings or Transfer, then provide any optional description, destination and reference." },
    { target: ".transaction-balance-actions button:nth-child(3)", title: "Deposit Cash", text: "Use Deposit Cash when physical cash from your business is paid into the bank. UpTrend checks your available cash and asks for the amount to deposit. You can enter ALL to deposit the available cash. This moves value from cash to bank; it is not new income." },
    { target: ".transaction-balance-actions button:nth-child(4)", title: "Withdraw to Cash", text: "Use Withdraw to Cash when you take money out of the bank for your cash balance. UpTrend checks your bank balance and asks for the withdrawal amount. This moves value from bank to cash; it is not a business expense." },
    { target: ".transactions-workspace", title: "Transaction Workspace", text: "The workspace contains your transaction history and the tools for finding and reviewing individual records." },
    { target: ".transactions-list-panel", title: "Transaction History", text: "This section lists recorded bank transactions. Select a row to open its details and inspect its amount, category, status, balance and any related business record." },
    { target: ".transactions-tabs", title: "Money In and Money Out Tabs", text: "All Transactions displays the full list. Money In filters for incoming funds, while Money Out filters for outgoing funds." },
    { target: ".transactions-search", title: "Search Transactions", text: "Search the transaction history to find a record using the information available in its description or other searchable details." },
    { target: ".transactions-filters", title: "Transaction Filters", text: "Narrow the list by transaction type, category and status. Type filters include transfers, linked records and other transactions. Category filters help identify the business reason. Status filters include Completed, Pending, Failed and Reversed." },
    { target: ".transactions-table-wrap", title: "Transaction Ledger", text: "The ledger displays the date, type, description, category, reference, amount, status and resulting balance. Incoming and outgoing amounts are distinguished so you can follow the movement of funds." },
    { target: ".transactions-table tbody tr", title: "Open a Transaction", text: "Select a transaction row to view its full details in the details panel. The additional row action also opens the selected transaction." },
    { target: ".transaction-details-panel", title: "Transaction Details", text: "When a transaction is selected, this panel provides more information about that record. Review the transaction before using any available related-record action." },
    { target: ".transaction-detail-hero", title: "Amount and Transaction Type", text: "This section highlights the selected transaction's amount and whether the money came into or went out of the bank account." },
    { target: ".transaction-detail-list", title: "Transaction Information", text: "Review the recorded date, description, category and reference. These details help identify and verify the transaction." },
    { target: ".transaction-link-card", title: "Linked Business Records", text: "This section indicates whether the bank transaction is connected to another UpTrend record. Where a supported linked record is available, use the action here to open it. For an eligible unlinked transfer, UpTrend can help match it to a corresponding transfer sale." },
    { target: ".transaction-balance-detail", title: "Balance Before and After", text: "Compare the previous balance with the new balance to understand how the selected transaction affected the bank account." },
    { target: ".transactions-empty", title: "No Matching Transactions", text: "If this message appears, there are no records matching your current search and filters. Clear or adjust them to see other transactions." }
  ],
  settings: [
    { target: ".settings-intro", title: "UpTrend Settings", text: "Welcome to Settings. This is where you personalize UpTrend, manage your profile, control notifications, protect your account and access business backups." },
    { target: ".settings-layout", title: "Settings Workspace", text: "Settings is organized into sections. Select a section on the left to open its controls on the right." },
    { target: ".settings-navigation", title: "Settings Sections", text: "Appearance controls your theme. Profile manages your personal information. Account shows your signed-in email and logout option. Notifications controls business alerts. Security lets you change your password. Backups opens your business data protection tools." },
    { target: ".settings-content", title: "Settings Content", text: "The selected section appears here. Each section has its own settings and actions. You can return to another section at any time using the navigation." }
  ],
  reports: [
    { target: ".audit-heading", title: "Audit History", text: "Welcome to Audit History. This page provides a chronological record of activities across your business. Use it to review recorded actions, monitor their status and investigate changes." },
    { target: ".audit-refresh", title: "Refresh History", text: "Click Refresh to request the latest audit records from your account. The button is temporarily disabled while records are loading." },
    { target: ".audit-stats", title: "Activity Summary", text: "These summary cards give you an overview of the audit records currently loaded. They cover up to 500 of the latest records." },
    { target: ".audit-stat:nth-child(1)", title: "Total Activities", text: "Shows the total number of audit records loaded, including successful actions, warnings, failures and other recorded statuses." },
    { target: ".audit-stat:nth-child(2)", title: "Successful Activities", text: "Counts records whose status is marked successful. This helps you review actions that were recorded as completed." },
    { target: ".audit-stat:nth-child(3)", title: "Warnings and Failed", text: "Counts records marked warning or failed. Review these entries to understand actions that may need attention." },
    { target: ".audit-panel", title: "Activity Log", text: "This is the main audit history area. Records are arranged with the newest activity first, and the page loads up to 500 records." },
    { target: ".audit-panel-heading", title: "Log Heading and Record Count", text: "The heading identifies the activity log. The count on the right shows how many records match your current search and filters." },
    { target: ".audit-search", title: "Search Activities", text: "Enter a word or phrase to search loaded records. Search checks activity descriptions, actions, categories, actor email, entity information and available details." },
    { target: ".audit-filters select:nth-of-type(1)", title: "Filter by Category", text: "Choose a category to narrow the history. Available categories depend on the records loaded and may include Sales, Expenses, Products, Inventory, Purchases, Returns, Finance, Invoices, Customers, Suppliers, Backup, Security and System." },
    { target: ".audit-filters select:nth-of-type(2)", title: "Filter by Status", text: "Choose All Statuses, Successful, Warning, Failed or Cancelled to find records with a particular outcome." },
    { target: ".audit-list", title: "Activity Timeline", text: "Matching activities appear here in chronological order, with the latest records first. Each entry contains its own activity and context information." },
    { target: ".audit-entry", title: "Individual Activity Record", text: "Each entry represents a recorded business or system action. Its visual direction indicator distinguishes incoming financial activity, outgoing activity and general record changes." },
    { target: ".audit-entry-title", title: "Activity Description and Category", text: "The title describes the recorded action. The category label identifies the business area associated with it." },
    { target: ".audit-status", title: "Activity Status", text: "The status label shows the recorded outcome, such as success, warning, failed or cancelled. Other status values may appear as neutral records." },
    { target: ".audit-entry-meta", title: "Date, User and Record Reference", text: "This area can show when the action occurred, the actor's email, the affected record type and its identifier, plus a financial amount when one was recorded." },
    { target: ".audit-context", title: "Financial Direction and Context", text: "For financial entries, this section identifies whether the activity is incoming or outgoing. Other actions are labelled Record Change. It also displays the available channel and source or destination information." },
    { target: ".audit-details", title: "View Details", text: "Expand this section to inspect the additional details saved with the audit record. The information is displayed in a structured format and can help you investigate exactly what was recorded." },
    { target: ".audit-empty", title: "Empty Results", text: "If no activities match your current filters, this message explains that there are no matching records. If the log has no records at all, it explains that no activity has been recorded yet." },
    { target: ".audit-error", title: "Loading Errors", text: "If the page cannot load audit history, an error message appears here. Use Try Again to request the records again." }
  ]
};

export default function OnboardingTour({ activePage, userId, enabled = true }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(null);
  const [replay, setReplay] = useState(0);
  const [contextSteps, setContextSteps] = useState(null);
  const [contextName, setContextName] = useState("");
  const [helpPosition, setHelpPosition] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("uptrend_help_position")) || { left: 18, top: 110 };
    } catch {
      return null;
    }
  });
  const dragRef = useRef(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    try {
      if (helpPosition) {
        localStorage.setItem(
          "uptrend_help_position",
          JSON.stringify(helpPosition)
        );
      }
    } catch {}
  }, [helpPosition]);


  const steps = useMemo(() => contextSteps || tours[activePage] || [{
    target: ".command-content",
    title: "Explore this page",
    text: "This page contains tools and information for this part of your business."
  }], [activePage, contextSteps]);

  const storageKey = `uptrend_tutorial_completed_${userId || "guest"}_${activePage}${contextName ? "_" + contextName : ""}`;
  const current = steps[step] || steps[0];

  useEffect(() => {
    if (!enabled || !activePage) {
      setOpen(false);
      return;
    }
    let completed = false;
    try {
      completed = localStorage.getItem(storageKey) === "true";
    } catch {}
    setStep(0);
    setOpen(!completed);
  }, [enabled, storageKey, activePage, replay]);

  useEffect(() => {
    const openContextTour = (event) => {
      const detail = event.detail || {};
      if (detail.page !== activePage || !Array.isArray(detail.steps) || !detail.steps.length) return;

      const name = String(detail.context || "form").replace(/[^a-z0-9_-]/gi, "");
      if (!name) return;

      setContextName(name);
      setContextSteps(detail.steps);
      setStep(0);
      setOpen(true);
    };

    window.addEventListener("uptrend:open-context-tour", openContextTour);
    return () => window.removeEventListener("uptrend:open-context-tour", openContextTour);
  }, [activePage]);

  useEffect(() => {
    const replayTour = () => {
      try { localStorage.removeItem(storageKey); } catch {}
      setStep(0);
      setReplay(value => value + 1);
    };
    window.addEventListener("uptrend:replay-tutorial", replayTour);
    return () => window.removeEventListener("uptrend:replay-tutorial", replayTour);
  }, [storageKey]);

  const updateSpotlight = useCallback(() => {
    if (!open || !current) return;
    const target = document.querySelector(current.target);
    if (!target) {
      setSpotlight(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setSpotlight({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
  }, [open, current]);

  useEffect(() => {
    if (!open || !current) return;
    const target = document.querySelector(current.target);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    updateSpotlight();

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    const observer = new MutationObserver(updateSpotlight);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
      observer.disconnect();
    };
  }, [open, current, updateSpotlight]);

  const finish = useCallback(() => {
    try { localStorage.setItem(storageKey, "true"); } catch {}
    setOpen(false);
    if (contextName) {
      setContextSteps(null);
      setContextName("");
    }
  }, [storageKey, contextName]);

  const next = () => {
    if (step >= steps.length - 1) finish();
    else setStep(value => value + 1);
  };

  if (!enabled) return null;

  const handleHelpPointerDown = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHelpPointerMove = (event) => {
    if (!dragRef.current) return;

    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;

    if (!dragRef.current.moved && Math.hypot(dx, dy) < 8) return;

    dragRef.current.moved = true;
    draggedRef.current = true;

    const left = Math.max(0, Math.min(
      event.clientX - dragRef.current.offsetX,
      window.innerWidth - 60
    ));
    const top = Math.max(0, Math.min(
      event.clientY - dragRef.current.offsetY,
      window.innerHeight - 60
    ));

    setHelpPosition({ left, top });
  };

  const handleHelpPointerUp = () => {
    dragRef.current = null;
  };

  const handleHelpClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    try {
      localStorage.removeItem(storageKey);
    } catch {}

    setContextSteps(null);
    setContextName("");
    setStep(0);
    setSpotlight(null);
    setOpen(true);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="uptrend-floating-help"
          style={helpPosition ? {
            left: helpPosition.left,
            top: helpPosition.top,
            right: "auto",
            bottom: "auto"
          } : undefined}
          title="Help & Support — drag to move"
          aria-label="Open help and tutorial for this page"
          onPointerDown={handleHelpPointerDown}
          onPointerMove={handleHelpPointerMove}
          onPointerUp={handleHelpPointerUp}
          onPointerCancel={handleHelpPointerUp}
          onClick={handleHelpClick}
        >
          <span>?</span>
          <span className="uptrend-floating-help-label">Help & Support</span>
        </button>
      )}

      {open && current && (
    <div className="uptrend-tour-layer" role="dialog" aria-modal="true" aria-label="UpTrend guided tutorial">
      {spotlight ? (
        <div
          className="uptrend-tour-spotlight"
          style={{
            top: spotlight.top - 7,
            left: spotlight.left - 7,
            width: spotlight.width + 14,
            height: spotlight.height + 14
          }}
        />
      ) : <div className="uptrend-tour-dim" />}

      <section className={`uptrend-tour-card ${spotlight ? "" : "centered"}`}>
        <div className="uptrend-tour-brand">
          <span className="uptrend-tour-brand-mark">U</span>
          <span>UPTREND GUIDE</span>
          <button className="uptrend-tour-close" onClick={finish} aria-label="Close tutorial">×</button>
        </div>

        <div className="uptrend-tour-progress">
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <p className="uptrend-tour-count">STEP {step + 1} OF {steps.length}</p>
        <h2>{current.title}</h2>
        <p className="uptrend-tour-description">{current.text}</p>

        <div className="uptrend-tour-actions">
          <button className="uptrend-tour-skip" onClick={finish}>Cancel</button>
          <div className="uptrend-tour-navigation">
            {step > 0 && (
              <button className="uptrend-tour-back" onClick={() => setStep(value => value - 1)}>Back</button>
            )}
            <button className="uptrend-tour-next" onClick={next}>
              {step === steps.length - 1 ? "Finish" : "Next"} →
            </button>
          </div>
        </div>
      </section>
    </div>
      )}
    </>
  );
}
