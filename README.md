# Nuel's Cafe - Point of Sale System

This is a comprehensive, Next.js-based Point of Sale (POS) application designed for Nuel's Food Zone. It provides a robust solution for managing menu items, processing orders with complex payment scenarios, tracking stock, managing customer rewards, and analyzing sales data with powerful, AI-driven insights.

## Core Features

- **Dual-Role Interface**: Separate, tailored views for `Manager` and `Cashier` roles to ensure staff have access to the tools they need.
- **Responsive Design**: Fully responsive UI that works seamlessly on both desktop and mobile devices.

### Cashier-Focused Features

- **Interactive Point of Sale (POS)**: A fast, user-friendly interface for browsing the menu, adding items to an order, and calculating totals in real-time. Supports custom items and price overrides.
- **Advanced Order Management**: 
    - A dedicated view to track `Pending`, `Unpaid`, and `Completed` orders.
    - **Combined Payments**: Select multiple unpaid orders for a single customer and settle them in one transaction.
    - **Flexible Payments**: Handle `Cash`, `Digital (Momo/Card)`, and `Pay Later` scenarios with ease.
    - **Change & Credit Management**: The system intelligently calculates change. If a customer is owed change, it can be recorded and later applied as a credit to pay off another unpaid order.
    - **Order Editing**: Seamlessly edit items in a pending order, with the system automatically recalculating the balance. It intelligently handles edits for already-paid orders, showing change due or remaining balance as needed.
- **Detailed Accounting & Reconciliation**:
    - A dedicated view for end-of-day close-outs.
    - **Unpaid Order Alerts**: Prompts the cashier to resolve unpaid orders from the current day before closing out.
    - **Precise Reconciliation**: A step-by-step process to count physical cash and digital totals against expected amounts. The system accurately calculates expected cash by including only confirmed cash sales and collections, minus cash-based expenses.
    - **Advanced Audit Tool**: A cross-checking tool to verify digital orders against physical kitchen tickets to easily spot discrepancies.
    - **Discrepancy Notes**: Allows cashiers to add notes explaining any cash surplus or deficit.
- **Miscellaneous Expense Tracking**: Log expenses as they occur, specifying whether they were paid from `Cash` or `Momo` to ensure accurate cash drawer reconciliation.
- **Fridge Stock Monitor**:
    - A dedicated view to track the stock levels of drinks.
    - Real-time updates with visual indicators for `Well Stocked`, `Low Stock`, and `Out of Stock` items.
    - **Desktop Notifications**: Opt-in to receive browser notifications when an item's stock becomes low or runs out.
    - Quick-update modal for easy stock counting.
- **Customer Rewards Program**:
    - A system to track returned bags from customers.
    - For every 5 bags returned, the customer earns a `GH₵10` discount.
    - Easily add new customers, record returned bags, and apply available discounts to orders.

### Manager-Focused Features

- **Comprehensive Sales Dashboard**:
    - **Key Performance Indicators**: At-a-glance cards for Total Sales, Net Revenue, Unpaid Balances, and Total Expenses for any selected date range.
    - **Sales Trend Analysis**: A visual chart showing revenue performance over time, breaking down new sales, collections on old debts, and expenses.
    - **Complete Item Sales List**: A detailed, searchable, and sortable list of every item sold, including quantity and total revenue generated.
    - **Discrepancy Auditing**: Review a complete history of all past end-of-day reconciliation reports, including notes and discrepancies.
- **AI-Powered Business Insights**:
    - **AI Business Analyst**: A sophisticated AI assistant that provides detailed performance reports, identifies trends, and offers actionable suggestions in a professional format. Powered by Gemini 2.5 Pro.
    - **Conversational AI Chat**: An interactive chat assistant to answer questions about business performance ("What were our sales yesterday?"), manage the menu ("Add a new drink"), and provide quick insights. Intelligently switches between fast and powerful models based on the request.
- **Menu Management**: A simple interface for managers to add, edit, and delete menu items, with a search function for easy navigation.
- **Security**: Managers can update their account password directly from the admin panel.

## Technical Details

- **Secure & Scalable**: Built on Firebase for secure authentication and a scalable Firestore database for data persistence.
- **Modern Tech Stack**: Built with Next.js, React, TypeScript, and Tailwind CSS for a responsive, accessible, and performant user experience.
- **Real-time Updates**: Uses Firestore's `onSnapshot` listeners to ensure data across the application is always live, reducing database costs and improving user experience.
- **GenAI Integration**: Leverages Google's Gemini models via Genkit for advanced analytics and conversational chat.