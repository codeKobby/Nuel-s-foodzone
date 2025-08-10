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
import { Message, Part } from 'genkit';


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
    input: { schema: z.string() },
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
`,
});

const businessChatFlow = ai.defineFlow(
    {
        name: 'businessChatFlow',
        inputSchema: BusinessChatInputSchema,
        outputSchema: BusinessChatOutputSchema,
    },
    async (input) => {
        const history: Message[] = (input.history || []).map((msg: any) => {
            const contentAsParts: Part[] = [];
            
            if (msg.role && msg.content) {
                if (Array.isArray(msg.content)) {
                    // Handle array format
                    msg.content.forEach((c: any) => {
                        if (c.text) {
                            contentAsParts.push({ text: c.text });
                        }
                    });
                } else if (typeof msg.content === 'object' && msg.content.text) {
                    // Handle object format with text property
                    contentAsParts.push({ text: msg.content.text });
                } else if (typeof msg.content === 'string') {
                    // Handle simple string format
                    contentAsParts.push({ text: msg.content });
                }
            }
            
            return new Message(msg.role || 'user', contentAsParts);
        });

        // Add the current user prompt to the history for the call
        history.push(new Message('user', [{text: input.prompt}]));
        
        const { output } = await businessChatPrompt(input.prompt, { history });
        return output as string;
    }
);

export async function businessChat(input: z.infer<typeof BusinessChatInputSchema>): Promise<z.infer<typeof BusinessChatOutputSchema>> {
    return businessChatFlow(input);
}
