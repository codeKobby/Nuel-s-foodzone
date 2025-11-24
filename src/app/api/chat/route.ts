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
  GetBusinessDataInputSchema,
  GetMenuItemsInputSchema,
  AddMenuItemInputSchema,
  UpdateMenuItemInputSchema,
  DeleteMenuItemInputSchema,
} from "@/ai/schemas";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-1.5-pro"),
    messages,
    system: `You are an expert business analyst and friendly assistant for a cafe called "Nuel's Foodzone Cafe".
Your role is to answer questions from the business owner or manager based on sales data, and to help them manage the menu.
You have access to several tools to help you.
If the user asks to add, update, or delete menu items, ask for confirmation before proceeding if the details are ambiguous.
Always format currency as GH₵.`,
    tools: {
      getBusinessData: tool({
        description:
          "Retrieves business performance data for a given date range. Use this to answer questions about sales, orders, and item performance.",
        parameters: z.object({
          startDate: z
            .string()
            .describe("The start date for the query in 'YYYY-MM-DD' format."),
          endDate: z
            .string()
            .describe("The end date for the query in 'YYYY-MM-DD' format."),
        }),
        execute: async ({ startDate, endDate }: any) => {
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
        description: "Adds a new item to the menu.",
        parameters: AddMenuItemInputSchema,
        execute: async (input: any) => {
          return await addMenuItem(input);
        },
      } as any),
      updateMenuItem: tool({
        description:
          "Updates an existing item on the menu, such as changing its price or name.",
        parameters: UpdateMenuItemInputSchema,
        execute: async (input: any) => {
          return await updateMenuItem(input);
        },
      } as any),
      deleteMenuItem: tool({
        description: "Removes an item from the menu.",
        parameters: DeleteMenuItemInputSchema,
        execute: async (input: any) => {
          return await deleteMenuItem(input);
        },
      } as any),
    },
  });

  return result.toTextStreamResponse();
}
