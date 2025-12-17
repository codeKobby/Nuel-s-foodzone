# Nuel's Cafe - Full-Stack Solution

This repository contains the complete full-stack application for Nuel's Food Zone, a modern cafe. The solution is built with Next.js and Firebase and is divided into two primary components:

1.  **Customer-Facing Web Application**: A professional, multi-page website where customers can browse the menu, learn about the cafe, and place orders online.
2.  **Backoffice POS System**: An internal, feature-rich Point of Sale (POS) application for staff to manage in-store operations, including order processing, accounting, and inventory.

---

## 1. Customer-Facing Web Application

Inspired by leading online ordering platforms, this portion of the app provides a seamless and professional experience for customers.

### Key Features

- **Professional, Multi-Page Design**: A complete website with a modern aesthetic, including:
  - A welcoming **Homepage** (`/`) featuring highlights, popular dishes, and catering information.
  - An interactive **Menu Page** (`/menu`) for browsing and ordering.
  - Placeholder pages for **Catering** (`/catering`) and **Contact** (`/contact`).
- **Dynamic Online Menu & Ordering**:
  - Fetches menu items in real-time from the Firestore database.
  - Allows customers to filter items by category and use a search bar for easy navigation.
  - A persistent **Order Cart** sidebar (on desktop) or a floating mobile button allows users to add items, adjust quantities, and view their total before checking out.
- **Responsive Design**: The customer-facing site is fully responsive, offering an optimal experience on both desktop and mobile devices.

---

## 2. Backoffice POS System (`/backoffice`)

This is the comprehensive, internal tool for cafe staff, accessible via the `/backoffice` route. It provides a robust solution for managing menu items, processing orders with complex payment scenarios, tracking stock, managing customer rewards, and analyzing sales data with powerful, AI-driven insights.

### Core Backoffice Features

- **Dual-Role Interface**: Separate, tailored views for `Manager` and `Cashier` roles to ensure staff have access to the tools they need.

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

## Node.js WebStorage Regression

Node.js `v25.2.0` introduced a regression that throws `SecurityError: Cannot initialize local storage without a '--localstorage-file' path` whenever any dependency touches `localStorage` during server-side rendering (Next.js, Firebase, testing libraries, etc.).

### Recommended fix

- **Upgrade** to `Node.js v25.2.1` (or newer) or **downgrade** to the stable `v24.x` LTS line. Both versions revert the breaking behavior.
- The dev script runs `next dev` directly (no custom `NODE_OPTIONS`).

If you intentionally need Node-side persistence, run Next.js with `node --localstorage-file=./localStorage.json node_modules/.bin/next dev -p 9002`, but this is rarely necessary.
