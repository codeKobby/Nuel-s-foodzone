

/**
 * @fileOverview This file contains the Zod schemas and TypeScript types for the AI flows.
 * It is separated from the flow definitions to avoid exporting non-async objects
 * from a 'use server' file.
 */

import { z } from 'zod';

// Schemas for the original business analysis flow
export const AnalyzeBusinessInputSchema = z.object({
  period: z.string().describe('The date range for the analysis period.'),
  totalSales: z.number().describe('Revenue from all completed orders.'),
  netRevenue: z.number().describe('The net revenue (Paid Sales - Misc. Expenses).'),
  totalOrders: z.number().describe('The total number of orders created.'),
  avgOrderValue: z.number().describe('The average value of each order (Total Sales / Total Orders).'),
  itemPerformance: z.array(z.object({
    name: z.string().describe('The name of the menu item.'),
    count: z.number().describe('The quantity of this item sold.'),
  })).describe('A list of menu items and their sales counts.'),
  cashDiscrepancy: z.number().describe('The total cash discrepancy (surplus or deficit) from reconciliations.'),
  miscExpenses: z.number().describe('Total cash paid out for miscellaneous items.'),
});
export type AnalyzeBusinessInput = z.infer<typeof AnalyzeBusinessInputSchema>;

export const AnalyzeBusinessOutputSchema = z.object({
  analysis: z.string().describe("A detailed analysis of the business's performance for the period, formatted in Markdown. Include an executive summary, a KPI table, item performance analysis, and actionable suggestions. Use bolding for key figures."),
  suggestions: z.string().describe("A summary of the actionable suggestions provided in the main analysis. This can be a simple bulleted list in plain text."),
});
export type AnalyzeBusinessOutput = z.infer<typeof AnalyzeBusinessOutputSchema>;


// Schemas for the new Business Chat flow
export const BusinessChatInputSchema = z.object({
  history: z.array(z.any()).describe("The chat history between the user and the AI."),
  prompt: z.string().describe("The user's latest message or question."),
});
export type BusinessChatInput = z.infer<typeof BusinessChatInputSchema>;

export const BusinessChatOutputSchema = z.string().describe("The AI's response to the user's prompt.");
export type BusinessChatOutput = z.infer<typeof BusinessChatOutputSchema>;


// Schemas for the tools used by the Business Chat flow

// Get Business Data Tool
export const GetBusinessDataInputSchema = z.object({
  startDate: z.string().describe("The start date for the query in 'YYYY-MM-DD' format."),
  endDate: z.string().describe("The end date for the query in 'YYYY-MM-DD' format."),
});
export type GetBusinessDataInput = z.infer<typeof GetBusinessDataInputSchema>;

export const GetBusinessDataOutputSchema = z.object({
  totalSales: z.number().describe('The total sales revenue for the period from all completed orders.'),
  netSales: z.number(),
  totalOrders: z.number(),
  itemPerformance: z.array(z.object({
    name: z.string(),
    count: z.number(),
  })),
  cashDiscrepancy: z.number(),
  cashSales: z.number().describe("Total sales paid with cash."),
  momoSales: z.number().describe("Total sales paid with MoMo/Card."),
  miscExpenses: z.number().describe("Total amount of all miscellaneous expenses."),
  changeOwed: z.number().describe("Total outstanding change owed to customers from cash transactions."),
});
export type GetBusinessDataOutput = z.infer<typeof GetBusinessDataOutputSchema>;

// Get Menu Items Tool
export const GetMenuItemsInputSchema = z.object({
    category: z.string().optional().describe("Optional category to filter the menu items."),
});
export type GetMenuItemsInput = z.infer<typeof GetMenuItemsInputSchema>;

export const GetMenuItemsOutputSchema = z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    category: z.string(),
    stock: z.number().optional(),
}));
export type GetMenuItemsOutput = z.infer<typeof GetMenuItemsOutputSchema>;

// Add Menu Item Tool
export const AddMenuItemInputSchema = z.object({
    name: z.string().describe("The name of the new menu item."),
    price: z.number().describe("The price of the new menu item."),
    category: z.string().describe("The category for the new menu item."),
    stock: z.number().optional().describe("The initial stock quantity."),
});
export type AddMenuItemInput = z.infer<typeof AddMenuItemInputSchema>;

// Update Menu Item Tool
export const UpdateMenuItemInputSchema = z.object({
    name: z.string().describe("The current name of the item to update."),
    newName: z.string().optional().describe("The new name for the item."),
    newPrice: z.number().optional().describe("The new price for the item."),
    newCategory: z.string().optional().describe("The new category for the item."),
    newStock: z.number().optional().describe("The new stock quantity for the item."),
});
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInputSchema>;

// Delete Menu Item Tool
export const DeleteMenuItemInputSchema = z.object({
    name: z.string().describe("The name of the menu item to delete."),
});
export type DeleteMenuItemInput = z.infer<typeof DeleteMenuItemInputSchema>;
