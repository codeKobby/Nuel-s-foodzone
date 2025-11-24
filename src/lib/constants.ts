export const APP_NAME = "Nuel's Foodzone";

export const PAYMENT_METHODS = {
  CASH: "cash",
  MOMO: "momo",
  CARD: "card",
} as const;

export const ORDER_STATUS = {
  PENDING: "Pending",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1];

export const MENU_CATEGORIES = [
  "Breakfast",
  "Main Dishes",
  "Snacks",
  "Drinks",
  "Desserts",
];
