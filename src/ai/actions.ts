"use server";

import { google } from "@/lib/ai";
import { generateText } from "ai";
import { AnalyzeBusinessInput } from "@/ai/schemas";

export async function analyzeBusiness(input: AnalyzeBusinessInput) {
  try {
    const { text } = await generateText({
      model: google("gemini-1.5-pro"),
      system: `You are a professional business consultant for a cafe called "Nuel's Foodzone Cafe".
Your task is to analyze the provided sales data and generate a detailed, professional performance report with actionable suggestions.
The output should be formatted in clear Markdown. Use tables for data and bolding for key figures.
Currency should be formatted as GH₵.`,
      prompt: `
Data for the period: **${input.period}**

## Executive Summary
Write a concise, high-level overview of the business's performance for the period. Comment on the key financial figures and sales trends.

## Key Performance Indicators (KPIs)
| Metric                  | Value                  | Notes                                        |
|-------------------------|------------------------|----------------------------------------------|
| **Total Sales**         | **GH₵${input.totalSales.toFixed(2)}**  | Revenue from all completed orders.           |
| **Net Revenue**         | **GH₵${input.netRevenue.toFixed(2)}**  | Total Sales minus Miscellaneous Expenses.     |
| **Total Orders**        | **${input.totalOrders}**    | Number of all orders created.                |
| **Avg. Order Value**    | **GH₵${input.avgOrderValue.toFixed(2)}** | Total Sales divided by Total Orders.                  |
| **Misc. Expenses**      | **GH₵${input.miscExpenses.toFixed(2)}**| Total cash paid out for misc. items.         |
| **Cash Discrepancy**    | **GH₵${input.cashDiscrepancy.toFixed(2)}** | A value of 0 is ideal. A negative value is a deficit. |

## Item Performance
Top-selling items for this period:

| Item Name | Quantity Sold |
|-----------|---------------|
${input.itemPerformance.slice(0, 10).map((item) => `| ${item.name} | ${item.count} |`).join("\n")}

Provide a brief analysis of the item performance. Highlight the star performers and mention any items that may be underperforming.

## Actionable Suggestions
Based on the data above, provide 3-5 specific, actionable suggestions for the business owner to improve revenue, reduce costs, or optimize operations.
`,
    });

    return { analysis: text };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { 
      analysis: `## Analysis Failed\n\nWe encountered an error while generating your business analysis:\n\n**Error:** ${errorMessage}\n\nPlease try again later or contact support if the issue persists.` 
    };
  }
}
