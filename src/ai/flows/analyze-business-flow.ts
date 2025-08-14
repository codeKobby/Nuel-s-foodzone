
'use server';
/**
 * @fileOverview An AI flow for analyzing business performance data.
 *
 * - analyzeBusiness: A function that generates insights and suggestions based on sales data.
 */

import { ai } from '@/ai/genkit';
import { AnalyzeBusinessInputSchema, AnalyzeBusinessOutputSchema, type AnalyzeBusinessInput, type AnalyzeBusinessOutput } from '@/ai/schemas';

const analyzeBusinessFlow = ai.defineFlow(
  {
    name: 'analyzeBusinessFlow',
    inputSchema: AnalyzeBusinessInputSchema,
    outputSchema: AnalyzeBusinessOutputSchema,
  },
  async (input) => {
    try {
      const { text } = await ai.generate({
        model: 'googleai/gemini-2.5-pro',
        prompt: `
You are a professional business consultant for a cafe called "Nuel's Foodzone Cafe".
Your task is to analyze the provided sales data and generate a detailed, professional performance report with actionable suggestions.
The output should be formatted in clear Markdown. Use tables for data and bolding for key figures.

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
${input.itemPerformance.map(item => `| ${item.name} | ${item.count} |`).join('\n')}

Provide a brief analysis of the item performance. Highlight the star performers and mention any items that may be underperforming.

## Financial Analysis
Analyze the financial health:
- Comment on the total sales figure and whether it's strong for the period
- Evaluate the net revenue after expenses
- Assess the average order value and what it indicates about customer spending
- Address any cash discrepancy concerns

## Operational Insights
Based on the order volume and item performance:
- Comment on operational efficiency
- Identify popular items that could drive menu optimization
- Note any patterns in customer preferences

## Actionable Recommendations
Provide 5-7 specific, actionable suggestions based on the data:
- Base suggestions on the KPIs and item performance
- If avg. order value is low, suggest upselling strategies
- If some items are very popular, suggest creating combos or special offers
- If there is a cash discrepancy, strongly recommend reviewing checkout procedures, till management, and staff training
- Include marketing suggestions based on popular items
- Suggest operational improvements based on order patterns
- Recommend inventory management strategies based on item performance

Make the recommendations creative and aimed at boosting sales, increasing profitability, or improving operational efficiency.
        `,
      });

      return {
        analysis: text || "Analysis could not be generated. Please try again with different data."
      };
    } catch (error) {
      console.error('Error in analyze business flow:', error);
      return {
        analysis: `
## Analysis Failed
The AI model encountered an error while generating the business analysis for the selected period. 
Error details: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again or contact support if the issue persists.
        `
      };
    }
  }
);

export async function analyzeBusiness(input: AnalyzeBusinessInput): Promise<AnalyzeBusinessOutput> {
    return analyzeBusinessFlow(input);
}
