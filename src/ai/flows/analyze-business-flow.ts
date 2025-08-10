
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
    prompt: `
        You are a professional business analyst for a cafe called "Nuel's Food Zone".
        Your task is to analyze the provided sales data and generate a performance report and actionable suggestions.

        Data for the period: {{period}}
        - Net Sales: GH₵{{netSales}} (Total Sales: GH₵{{totalSales}})
        - Total Orders: {{totalOrders}}
        - Top Selling Items:
        {{#each itemPerformance}}
          - {{name}}: {{count}} sold
        {{/each}}
        - Cash Discrepancy: GH₵{{cashDiscrepancy}}

        Analysis:
        - Write a concise analysis of the business's performance. Comment on the sales figures and order volume.
        - If there's a cash discrepancy, mention it as a point of concern that needs investigation.
        - Mention the top-performing items as a positive highlight.

        Suggestions:
        - Provide a bulleted list of 3-5 specific, actionable suggestions.
        - Base your suggestions directly on the data. For example, if some items are very popular, suggest creating combos or special offers with them.
        - If sales are low, suggest marketing strategies.
        - If there is a cash discrepancy, suggest reviewing checkout procedures or staff training.
        - The suggestions should be creative and aimed at boosting sales or improving operational efficiency.
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

// Dummy component to satisfy Next.js compiler for including a server-side flow
// This will not be rendered.
export default async function AiFlow() {
  return null;
}
