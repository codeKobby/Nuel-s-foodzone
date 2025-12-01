import { google } from "@/lib/ai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getBusinessDataForRange } from "@/lib/tools";
import {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "@/lib/menu-tools";
import {
  GetMenuItemsInputSchema,
  AddMenuItemInputSchema,
  UpdateMenuItemInputSchema,
  DeleteMenuItemInputSchema,
} from "@/ai/schemas";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

    const result = streamText({
      model: google("gemini-1.5-pro"),
      messages,
      system: `You are an expert business analyst and friendly assistant for a cafe called "Nuel's Foodzone Cafe".
Your role is to answer questions from the business owner or manager based on sales data, and to help them manage the menu.

**Current Date Context:**
- Today is ${dayOfWeek}, ${todayStr}
- When the user asks about "today", use today's date: ${todayStr}
- When the user asks about "yesterday", calculate the date accordingly
- When the user asks about "this week", use the start of the current week (Monday) to today
- When the user asks about "last week", use the previous Monday to Sunday
- When the user asks about "this month", use the first day of the current month to today

**Guidelines:**
- You have access to several tools to help you retrieve data and manage menu items.
- Always use the getBusinessData tool to fetch real data before answering questions about sales, orders, or performance.
- If the user asks to add, update, or delete menu items, confirm the details before proceeding.
- Always format currency as GH₵ (Ghana Cedis).
- Be concise but informative in your responses.
- If you encounter an error fetching data, explain the issue clearly.`,
      tools: {
        getBusinessData: tool({
          description:
            "Retrieves business performance data for a given date range. Use this to answer questions about sales, orders, and item performance. Always call this tool before answering questions about business metrics.",
          parameters: z.object({
            startDate: z
              .string()
              .describe("The start date for the query in 'YYYY-MM-DD' format."),
            endDate: z
              .string()
              .describe("The end date for the query in 'YYYY-MM-DD' format."),
          }),
          execute: async ({
            startDate,
            endDate,
          }: {
            startDate: string;
            endDate: string;
          }) => {
            return await getBusinessDataForRange(startDate, endDate);
          },
        } as any),
        getMenuItems: tool({
          description:
            "Retrieves a list of items from the menu. Can be used to count items or list items in a category.",
          parameters: GetMenuItemsInputSchema,
          execute: async (input: any) => {
            return await getMenuItems(input);
          },
        } as any),
        addMenuItem: tool({
          description:
            "Adds a new item to the menu. Requires name, price, and category.",
          parameters: AddMenuItemInputSchema,
          execute: async (input: any) => {
            return await addMenuItem(input);
          },
        } as any),
        updateMenuItem: tool({
          description:
            "Updates an existing item on the menu, such as changing its price, name, or stock.",
          parameters: UpdateMenuItemInputSchema,
          execute: async (input: any) => {
            return await updateMenuItem(input);
          },
        } as any),
        deleteMenuItem: tool({
          description:
            "Removes an item from the menu. Requires the menu item ID.",
          parameters: DeleteMenuItemInputSchema,
          execute: async (input: any) => {
            return await deleteMenuItem(input);
          },
        } as any),
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
