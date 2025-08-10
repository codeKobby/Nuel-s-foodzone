'use server';
/**
 * @fileOverview An AI flow for a conversational business analysis chat.
 *
 * - businessChat: A function that handles a conversational chat about business data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
    BusinessChatInputSchema, 
    BusinessChatOutputSchema, 
    GetBusinessDataInputSchema, 
    GetBusinessDataOutputSchema,
    GetMenuItemsInputSchema,
    GetMenuItemsOutputSchema,
    AddMenuItemInputSchema,
    UpdateMenuItemInputSchema,
    DeleteMenuItemInputSchema
} from '@/ai/schemas';
import { getBusinessDataForRange } from '@/lib/tools';
import { getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem } from '@/lib/menu-tools';


const getBusinessDataTool = ai.defineTool(
    {
        name: 'getBusinessData',
        description: 'Retrieves business performance data for a given date range. Use this to answer questions about sales, orders, and item performance.',
        inputSchema: GetBusinessDataInputSchema,
        outputSchema: GetBusinessDataOutputSchema,
    },
    async (input) => getBusinessDataForRange(input.startDate, input.endDate)
);

const getMenuItemsTool = ai.defineTool(
    {
        name: 'getMenuItems',
        description: 'Retrieves a list of items from the menu. Can be used to count items or list items in a category.',
        inputSchema: GetMenuItemsInputSchema,
        outputSchema: GetMenuItemsOutputSchema,
    },
    async (input) => getMenuItems(input)
);

const addMenuItemTool = ai.defineTool(
    {
        name: 'addMenuItem',
        description: 'Adds a new item to the menu.',
        inputSchema: AddMenuItemInputSchema,
        outputSchema: z.string(),
    },
    async (input) => addMenuItem(input)
);

const updateMenuItemTool = ai.defineTool(
    {
        name: 'updateMenuItem',
        description: 'Updates an existing item on the menu, such as changing its price or name.',
        inputSchema: UpdateMenuItemInputSchema,
        outputSchema: z.string(),
    },
    async (input) => updateMenuItem(input)
);

const deleteMenuItemTool = ai.defineTool(
    {
        name: 'deleteMenuItem',
        description: 'Removes an item from the menu.',
        inputSchema: DeleteMenuItemInputSchema,
        outputSchema: z.string(),
    },
    async (input) => deleteMenuItem(input)
);


const businessChatPrompt = ai.definePrompt({
    name: 'businessChatPrompt',
    input: { schema: z.object({
        prompt: z.string(),
        historyContext: z.string().optional()
    }) },
    output: { format: 'text' },
    tools: [getBusinessDataTool, getMenuItemsTool, addMenuItemTool, updateMenuItemTool, deleteMenuItemTool],
    system: `You are an expert business analyst and friendly assistant for a cafe called "Nuel's Food Zone".
Your role is to answer questions from the business owner or manager based on sales data, and to help them manage the menu.
You have access to several tools to help you.

- For questions about sales, orders, or financial performance (e.g., "What were our sales yesterday?", "How much MoMo did we receive last week?"), you MUST use the 'getBusinessData' tool.
- For questions about the menu itself (e.g., "How many items are on the menu?", "List all the snacks"), you MUST use the 'getMenuItems' tool.
- When asked about a specific category (e.g., "snacks", "drinks"), first try to use the 'category' parameter in the 'getMenuItems' tool with the user's term. IMPORTANT: You must capitalize the first letter of the category name (e.g., 'snacks' becomes 'Snacks', 'drinks' becomes 'Drinks').
- If that returns no results or if the user asks for a type of item that might not be an exact category (e.g., "juices", "pastries", "sodas"), you should call 'getMenuItems' WITHOUT the category parameter to get all items, and then analyze the results to answer the user's question based on the item names.
- For requests to modify the menu (e.g., "Add a new drink", "Change a price", "Remove an item"), you MUST use the 'addMenuItem', 'updateMenuItem', or 'deleteMenuItem' tools respectively.
- Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Use this to determine the correct date range for terms like "yesterday", "last week", or "last month".
- When you receive data or a confirmation message from a tool, analyze it and present the key information to the user in a clear, friendly, and concise way.
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
