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
  netSales: z.number().describe('The net sales after deducting expenses.'),
  totalOrders: z.number().describe('The total number of orders.'),
  itemPerformance: z.array(z.object({
    name: z.string().describe('The name of the menu item.'),
    count: z.number().describe('The quantity of this item sold.'),
  })).describe('A list of menu items and their sales counts.'),
  cashDiscrepancy: z.number().describe('The total cash discrepancy (surplus or deficit) from reconciliations.'),
});
export type AnalyzeBusinessInput = z.infer<typeof AnalyzeBusinessInputSchema>;

export const AnalyzeBusinessOutputSchema = z.object({
  analysis: z.string().describe("A concise analysis of the business's performance for the period. Analyze the key metrics. Keep it to 2-3 short paragraphs."),
  suggestions: z.string().describe("Actionable suggestions to boost sales or improve operations. Provide 3-5 bullet points. Each suggestion should be specific and based on the data provided."),
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
  cashSales: z.number().describe("Total sales paid with cash."),
  momoSales: z.number().describe("Total sales paid with MoMo/Card."),
  miscExpenses: z.number().describe("Total amount of settled miscellaneous expenses."),
  changeOwed: z.number().describe("Total outstanding change owed to customers from cash transactions."),
});
export type GetBusinessDataOutput = z.infer<typeof GetBusinessDataOutputSchema>;
