'use server';
/**
 * @fileOverview An AI flow for a conversational business analysis chat.
 *
 * - businessChat: A function that handles a conversational chat about business data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BusinessChatInputSchema, BusinessChatOutputSchema, GetBusinessDataInputSchema, GetBusinessDataOutputSchema } from '@/ai/schemas';
import { getBusinessDataForRange } from '@/lib/tools';


const getBusinessDataTool = ai.defineTool(
    {
        name: 'getBusinessData',
        description: 'Retrieves business performance data for a given date range. Use this to answer questions about sales, orders, and item performance.',
        inputSchema: GetBusinessDataInputSchema,
        outputSchema: GetBusinessDataOutputSchema,
    },
    async (input) => getBusinessDataForRange(input.startDate, input.endDate)
);


const businessChatPrompt = ai.definePrompt({
    name: 'businessChatPrompt',
    input: { schema: z.object({
        prompt: z.string(),
        historyContext: z.string().optional()
    }) },
    output: { format: 'text' },
    tools: [getBusinessDataTool],
    system: `You are an expert business analyst for a cafe called "Nuel's Food Zone".
Your role is to answer questions from the business owner or manager based on sales data.
You have access to a tool called 'getBusinessData' that can retrieve sales, orders, and item performance for specific date ranges.

- When the user asks a question about performance, sales, or items (e.g., "What were our sales yesterday?", "How many spring rolls did we sell last week?"), you MUST use the 'getBusinessData' tool to find the answer.
- Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Use this to determine the correct date range for terms like "yesterday", "last week", or "last month".
- When you receive data from the tool, analyze it and present the key information to the user in a clear, friendly, and concise way.
- If the tool returns no data (e.g., zero sales), state that clearly to the user. Do not invent data.
- If the user's question is unclear, ask for clarification.
{{#if historyContext}}

Previous conversation context:
{{historyContext}}
{{/if}}
`,
    prompt: `User question: {{prompt}}`
});

const businessChatFlow = ai.defineFlow(
    {
        name: 'businessChatFlow',
        inputSchema: BusinessChatInputSchema,
        outputSchema: BusinessChatOutputSchema,
    },
    async (input) => {
        try {
            // Convert history to a simple string context instead of Message objects
            let historyContext = '';
            if (input.history && input.history.length > 0) {
                historyContext = input.history.map((msg: any) => {
                    const role = msg.role || 'user';
                    let content = '';
                    
                    if (typeof msg.content === 'string') {
                        content = msg.content;
                    } else if (Array.isArray(msg.content)) {
                        content = msg.content.map((c: any) => c.text || '').join(' ');
                    } else if (msg.content && typeof msg.content === 'object') {
                        content = msg.content.text || '';
                    }
                    
                    return `${role}: ${content}`;
                }).join('\n');
            }

            const { output } = await businessChatPrompt({
                prompt: input.prompt,
                historyContext: historyContext || undefined
            });
            
            return output as string;
        } catch (error) {
            console.error('Error in business chat flow:', error);
            // Fallback response
            return "I'm sorry, I encountered an error while processing your request. Please try rephrasing your question about the business performance.";
        }
    }
);

export async function businessChat(input: z.infer<typeof BusinessChatInputSchema>): Promise<z.infer<typeof BusinessChatOutputSchema>> {
    return businessChatFlow(input);
}
