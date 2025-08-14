
/**
 * @fileOverview This file contains the Zod schemas and TypeScript types for the AI flows.
 * It is separated from the flow definitions to avoid exporting non-async objects
 * from a 'use server' file.
 */

import { z } from 'zod';

// Schemas for the original business analysis flow
export const AnalyzeBusinessInputSchema = z.object({
  period: z.string().describe('The date range for the analysis period.'),
  totalSales: z.number().describe('The total sales revenue for the period.'),
  netRevenue: z.number().describe('The net revenue after deducting expenses.'),
  totalOrders: z.number().describe('The total number of orders.'),
  avgOrderValue: z.number().describe('The average order value.'),
  miscExpenses: z.number().describe('Total miscellaneous expenses.'),
  itemPerformance: z.array(z.object({
    name: z.string().describe('The name of the menu item.'),
    count: z.number().describe('The quantity of this item sold.'),
  })).describe('A list of menu items and their sales counts.'),
  cashDiscrepancy: z.number().describe('The total cash discrepancy (surplus or deficit) from reconciliations.'),
});
export type AnalyzeBusinessInput = z.infer<typeof AnalyzeBusinessInputSchema>;

export const AnalyzeBusinessOutputSchema = z.object({
  analysis: z.string().describe("A comprehensive markdown-formatted business analysis report including executive summary, KPIs, item performance, and actionable suggestions."),
});
export type AnalyzeBusinessOutput = z.infer<typeof AnalyzeBusinessOutputSchema>;

// Schemas for the Business Chat flow
export const BusinessChatInputSchema = z.object({
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.array(z.object({
      text: z.string()
    }))
  })).describe("The chat history between the user and the AI."),
  prompt: z.string().describe("The user's latest message or question."),
});
export type BusinessChatInput = z.infer<typeof BusinessChatInputSchema>;

export const BusinessChatOutputSchema = z.string().describe("The AI's response to the user's prompt.");
export type BusinessChatOutput = z.infer<typeof BusinessChatOutputSchema>;

// Schemas for the tools used by the Business Chat flow
export const GetBusinessDataInputSchema = z.object({
  startDate: z.string().describe("The start date for the query in 'YYYY-MM-DD' format."),
  endDate: z.string().describe("The end date for the query in 'YYYY-MM-DD' format."),
});
export type GetBusinessDataInput = z.infer<typeof GetBusinessDataInputSchema>;

export const GetBusinessDataOutputSchema = z.object({
    totalSales: z.number(),
    netSales: z.number(),
    totalOrders: z.number(),
    itemPerformance: z.array(z.object({
        name: z.string(),
        count: z.number(),
    })),
    cashDiscrepancy: z.number(),
    cashSales: z.number(),
    momoSales: z.number(),
    miscExpenses: z.number(),
    changeOwed: z.number(),
});
export type GetBusinessDataOutput = z.infer<typeof GetBusinessDataOutputSchema>;

// Menu management schemas
export const GetMenuItemsInputSchema = z.object({
  category: z.string().optional().describe("Filter by category. If not provided, returns all items."),
});
export type GetMenuItemsInput = z.infer<typeof GetMenuItemsInputSchema>;

export const GetMenuItemsOutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    category: z.string(),
    stock: z.number(),
    requiresChoice: z.boolean(),
  })),
  totalCount: z.number(),
});
export type GetMenuItemsOutput = z.infer<typeof GetMenuItemsOutputSchema>;

export const AddMenuItemInputSchema = z.object({
  name: z.string().describe("The name of the new menu item."),
  price: z.number().describe("The price of the item."),
  category: z.string().describe("The category for the item (e.g., 'Beverages', 'Snacks', 'Main Course')."),
  stock: z.number().default(0).describe("Initial stock quantity."),
});
export type AddMenuItemInput = z.infer<typeof AddMenuItemInputSchema>;

export const UpdateMenuItemInputSchema = z.object({
  id: z.string().describe("The ID of the menu item to update."),
  name: z.string().optional().describe("New name for the item."),
  price: z.number().optional().describe("New price for the item."),
  category: z.string().optional().describe("New category for the item."),
  stock: z.number().optional().describe("New stock quantity."),
});
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInputSchema>;

export const DeleteMenuItemInputSchema = z.object({
  id: z.string().describe("The ID of the menu item to delete."),
});
export type DeleteMenuItemInput = z.infer<typeof DeleteMenuItemInputSchema>;

// Auth Tools
export const VerifyPasswordInputSchema = z.object({
    role: z.enum(['manager', 'cashier']),
    password: z.string(),
});
export type VerifyPasswordInput = z.infer<typeof VerifyPasswordInputSchema>;

export const UpdatePasswordInputSchema = z.object({
    role: z.enum(['manager', 'cashier']),
    currentPassword: z.string(),
    newPassword: z.string(),
});
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordInputSchema>;
