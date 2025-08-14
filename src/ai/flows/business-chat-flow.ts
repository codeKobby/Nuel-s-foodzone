
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
    DeleteMenuItemInputSchema,
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
    },
    async (input) => {
        try {
            const { history, prompt } = input;
            
            // Determine model based on task complexity
            const isComplexTask = prompt.toLowerCase().includes('report') || 
                                 prompt.toLowerCase().includes('analysis') || 
                                 prompt.toLowerCase().includes('comprehensive') ||
                                 prompt.toLowerCase().includes('detailed');
            
            const model = isComplexTask ? 'googleai/gemini-2.5-pro' : 'googleai/gemini-2.0-flash';

            const { text } = await ai.generate({
                model,
                history,
                prompt,
                tools: [getBusinessDataTool, getMenuItemsTool, addMenuItemTool, updateMenuItemTool, deleteMenuItemTool],
                system: `You are an expert business analyst and friendly assistant for a cafe called "Nuel's Foodzone Cafe".
Your role is to answer questions from the business owner or manager based on sales data, and to help them manage the menu.
You have access to several tools to help you.

**Tool Usage Guidelines:**
- For questions about sales, orders, or financial performance (e.g., "What were our sales yesterday?", "How much revenue did we make last week?"), use the 'getBusinessData' tool.
- For questions about the menu itself (e.g., "How many items are on the menu?", "List all the beverages"), use the 'getMenuItems' tool.
- For requests to modify the menu:
  - Use 'addMenuItem' to add new items
  - Use 'updateMenuItem' to change existing items (price, name, category, stock)
  - Use 'deleteMenuItem' to remove items
- When adding a new item, the 'category' is REQUIRED. If the user doesn't specify a category, ask them first before calling the tool.

**Date Calculations:**
Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. 
Use this to calculate date ranges for terms like:
- "yesterday" = previous day
- "last week" = 7 days ago to today  
- "last month" = 30 days ago to today
- "this week" = Monday of current week to today

**Response Style:**
- Present data clearly and concisely
- Use formatting (tables, bullets) when helpful
- If tools return no data, state this clearly
- For complex requests, provide comprehensive analysis
- Always be friendly and helpful

**Error Handling:**
- If a tool fails, explain what went wrong
- If data is missing, don't invent information
- Ask for clarification if requests are unclear`
            });

            return text || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";

        } catch (error) {
            console.error('Error in business chat flow:', error);
            return "I'm sorry, I encountered an error while processing your request. Please try rephrasing your question about the business performance or menu management.";
        }
    }
);

export async function businessChat(input: z.infer<typeof BusinessChatInputSchema>): Promise<z.infer<typeof BusinessChatOutputSchema>> {
    return businessChatFlow(input);
}
