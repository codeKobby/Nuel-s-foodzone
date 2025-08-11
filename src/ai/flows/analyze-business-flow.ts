
'use server';
/**
 * @fileOverview An AI flow for analyzing business performance data.
 *
 * - analyzeBusiness: A function that generates insights and suggestions based on sales data.
 */

import { ai } from '@/ai/genkit';
import { AnalyzeBusinessInputSchema, AnalyzeBusinessOutputSchema, type AnalyzeBusinessInput, type AnalyzeBusinessOutput } from '@/ai/schemas';


const analysisPrompt = ai.definePrompt({
    name: 'businessAnalysisPrompt',
    input: { schema: AnalyzeBusinessInputSchema },
    output: { schema: AnalyzeBusinessOutputSchema },
    model: 'googleai/gemini-2.5-pro',
    prompt: `
        You are a professional business consultant for a cafe called "Nuel's Food Zone".
        Your task is to analyze the provided sales data and generate a detailed, professional performance report with actionable suggestions.
        The output should be formatted in clear Markdown. Use tables for data and bolding for key figures.

        Data for the period: **{{period}}**

        ## Executive Summary
        Write a concise, high-level overview of the business's performance for the period. Comment on the key financial figures and sales trends.

        ## Key Performance Indicators (KPIs)
        | Metric                  | Value                  | Notes                                        |
        |-------------------------|------------------------|----------------------------------------------|
        | **Total Sales**         | **GH₵{{totalSales}}**  | Revenue from all completed orders.           |
        | **Net Revenue**         | **GH₵{{netRevenue}}**  | Paid Sales minus Miscellaneous Expenses.     |
        | **Total Orders**        | **{{totalOrders}}**    | Number of all orders created.                |
        | **Avg. Order Value**    | **GH₵{{avgOrderValue}}** | Total Sales / Total Orders.                  |
        | **Misc. Expenses**      | **GH₵{{miscExpenses}}**| Total cash paid out for misc. items.         |
        | **Cash Discrepancy**    | **GH₵{{cashDiscrepancy}}** | A value of 0 is ideal. A negative value is a deficit. |

        ## Item Performance
        Provide a table of the top-selling items.
        | Item Name | Quantity Sold |
        |-----------|---------------|
        {{#each itemPerformance}}
          | {{name}} | {{count}} |
        {{/each}}
        
        Follow the table with a brief analysis of the item performance. Highlight the star performers and mention any items that may be underperforming.

        ## Suggestions
        Provide a bulleted list of 3-5 specific, actionable suggestions based on the data.
        - Base suggestions on the KPIs and item performance. For example, if avg. order value is low, suggest upselling strategies.
        - If some items are very popular, suggest creating combos or special offers with them.
        - If there is a cash discrepancy, strongly recommend reviewing checkout procedures, till management, and staff training.
        - The suggestions should be creative and aimed at boosting sales, increasing profitability, or improving operational efficiency.
    `,
});

const analyzeBusinessFlow = ai.defineFlow(
  {
    name: 'analyzeBusinessFlow',
    inputSchema: AnalyzeBusinessInputSchema,
    outputSchema: AnalyzeBusinessOutputSchema,
  },
  async (input) => {
    const { output } = await analysisPrompt(input);
    return output!;
  }
);

export async function analyzeBusiness(input: AnalyzeBusinessInput): Promise<AnalyzeBusinessOutput> {
    return analyzeBusinessFlow(input);
}
