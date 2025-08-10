
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
    input: { schema: z.object({ ...BusinessChatInputSchema.shape, currentDate: z.string() }) },
    output: { format: 'text' },
    tools: [getBusinessDataTool],
    prompt: `You are a helpful business analyst for Nuel's Food Zone.
Your role is to answer questions from the business owner or manager based on sales data.
Use the provided tools to fetch the data when asked about specific time periods.
Be concise and clear in your answers.
Today's date is {{currentDate}}.
`,
});

const businessChatFlow = ai.defineFlow(
    {
        name: 'businessChatFlow',
        inputSchema: BusinessChatInputSchema,
        outputSchema: BusinessChatOutputSchema,
    },
    async (input) => {
        const history: Message[] = input.history.map((msg: { role: 'user' | 'model'; content: { text: string }[] }) => {
            // Ensure content is an array of Parts, which is iterable
            const contentAsParts: Part[] = msg.content.map(c => ({ text: c.text }));
            return new Message(msg.role, contentAsParts);
        });

        const promptInput = {
            ...input,
            currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        };

        const { output } = await businessChatPrompt(promptInput, { history });
        return output!;
    }
);

export async function businessChat(input: z.infer<typeof BusinessChatInputSchema>): Promise<z.infer<typeof BusinessChatOutputSchema>> {
    return businessChatFlow(input);
}
