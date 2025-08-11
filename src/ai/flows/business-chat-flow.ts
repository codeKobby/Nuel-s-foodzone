
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


const businessChatFlow = ai.defineFlow(
    {
        name: 'businessChatFlow',
        inputSchema: BusinessChatInputSchema,
        outputSchema: BusinessChatOutputSchema,
        cache: {
            // Cache for 10 minutes to allow for fresh data.
            ttl: 600, 
        }
    },
    async (input) => {
        
        // Determine which model to use based on the prompt
        const useProModel = /detailed report|in-depth analysis/i.test(input.prompt);
        const model = useProModel ? 'googleai/gemini-2.5-flash' : 'googleai/gemini-2.0-flash';
        console.log(`Using model: ${model}`);

        const businessChatPrompt = ai.definePrompt({
            name: 'businessChatPrompt',
            input: { schema: BusinessChatInputSchema },
            output: { format: 'text' },
            tools: [getBusinessDataTool, getMenuItemsTool, addMenuItemTool, updateMenuItemTool, deleteMenuItemTool],
            model,
            system: `You are an expert business analyst and friendly assistant for a cafe called "Nuel's Food Zone".
Your role is to answer questions from the business owner or manager based on sales data, and to help them manage the menu.
You have access to several tools to help you.

- For questions about sales, orders, or financial performance (e.g., "What were our sales yesterday?", "How much MoMo did we receive last week?"), you MUST use the 'getBusinessData' tool.
- For questions about the menu itself (e.g., "How many items are on the menu?", "List all the snacks"), you MUST use the 'getMenuItems' tool.
- For requests to modify the menu (e.g., "Add a new drink", "Change a price", "Remove an item"), you MUST use the 'addMenuItem', 'updateMenuItem', or 'deleteMenuItem' tools respectively.
- When adding a new item with the 'addMenuItem' tool, the 'category' is a required field. If the user does not provide a category in their prompt (e.g., "add sausage for 5 cedis"), you MUST ask them for the category before calling the tool. For example: "I can add 'Sausage' for GH₵5.00. What category should I put it in?"
- Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Use this to determine the correct date range for terms like "yesterday", "last week", or "last month".
- When you receive data or a confirmation message from a tool, analyze it and present the key information to the user in a clear, friendly, and concise way.
- If the tool returns no data (e.g., zero sales), state that clearly to the user. Do not invent data.
- If the user's question is unclear, ask for clarification.
{{#if history}}

Previous conversation context:
{{#each history}}
- {{role}}: {{content}}
{{/each}}
{{/if}}
`,
            prompt: `User question: {{prompt}}`
        });


        try {
            let response = await businessChatPrompt(input);

            // Handle tool calls if the model requests them
            while (response.isToolRequest()) {
                const toolResponse = await response.executeTool();
                response = await businessChatPrompt(input, {
                    history: [response.request, toolResponse],
                });
            }

            // Return the final text response
            return response.text;

        } catch (error) {
            console.error('Error in business chat flow:', error);
            // Fallback response in case of any error during the flow
            return "I'm sorry, I encountered an error while processing your request. Please try rephrasing your question about the business performance.";
        }
    }
);

export async function businessChat(input: z.infer<typeof BusinessChatInputSchema>): Promise<z.infer<typeof BusinessChatOutputSchema>> {
    return businessChatFlow(input);
}
