# Nuel's Cafe - Point of Sale System

This is a comprehensive, Next.js-based Point of Sale (POS) application designed for Nuel's Food Zone. It provides a robust solution for managing menu items, processing orders with complex payment scenarios, and analyzing sales data with powerful, AI-driven insights.

## Core Features

- **Dual-Role Interface**: Separate, tailored views for `Manager` and `Cashier` roles to ensure staff have access to the tools they need.

### Cashier-Focused Features

- **Interactive Point of Sale (POS)**: A fast, user-friendly interface for browsing the menu, adding items to an order, and calculating totals in real-time. Supports custom items and price overrides.
- **Advanced Order Management**: 
    - A dedicated view to track `Pending`, `Unpaid`, and `Completed` orders.
    - **Combined Payments**: Select multiple orders for a single customer and settle them in one transaction.
    - **Flexible Payments**: Handle `Cash`, `Momo/Card`, and `Pay Later` scenarios with ease.
    - **Change & Credit Management**: Tracks change owed to customers and allows it to be converted into a persistent credit balance for the customer.
    - **Order Editing**: Seamlessly edit items in a pending order.
- **Detailed Accounting & Reconciliation**:
    - A dedicated view for end-of-day close-outs.
    - **Unpaid Order Alerts**: Prompts the cashier to resolve unpaid orders before closing the day.
    - **Precise Reconciliation**: Count physical cash and MoMo totals against expected amounts. The system accurately calculates expected cash by subtracting only cash-based expenses.
    - **Discrepancy Notes**: Allows cashiers to add notes explaining any cash surplus or deficit.
- **Miscellaneous Expense Tracking**: Log expenses as they occur, specifying whether they were paid from `Cash` or `Momo` to ensure accurate cash drawer reconciliation.

### Manager-Focused Features

- **Comprehensive Sales Dashboard**:
    - **Key Performance Indicators**: At-a-glance cards for Total Sales (Completed Orders), Net Revenue, Unpaid Balances, and Total Expenses.
    - **Sales Trend Analysis**: A visual chart showing sales performance over any selected date range.
    - **Complete Item Sales List**: A detailed, searchable list of every item sold, including quantity and total revenue generated.
    - **Discrepancy Auditing**: Clickable stat cards to view a detailed breakdown of all historical cash discrepancies, including notes from the cashier.
    - **Unsettled Expense Management**: A dedicated panel to review and "settle" past miscellaneous expenses.
- **AI-Powered Business Insights**:
    - **AI Business Analyst**: A sophisticated AI assistant that provides detailed performance reports, identifies trends, and offers actionable suggestions in a professional format. Powered by Gemini 2.5 Pro.
    - **Conversational AI Chat**: An interactive chat assistant to answer questions about business performance ("What were our sales yesterday?"), manage the menu ("Add a new drink"), and provide quick insights. Intelligently switches between fast and powerful models based on the request.
- **Menu Management**: A simple interface for managers to add, edit, and delete menu items, with a search function for easy navigation.

## Technical Details

- **Secure & Scalable**: Built on Firebase for secure authentication and scalable Firestore database for data persistence.
- **Modern Tech Stack**: Built with Next.js, React, TypeScript, and Tailwind CSS for a responsive, accessible, and performant user experience.
- **GenAI Integration**: Leverages Google's Gemini models via Genkit for advanced analytics and conversational chat.