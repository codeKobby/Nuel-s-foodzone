import type { MenuItem } from "@/lib/types";

export const MENU_IMAGE_BY_NAME: Record<string, string> = {
  "jollof rice & chicken": "/food/jollof-chicken.jpg",
  "jollof rice": "/food/jollof-chicken.jpg",
  "banku & tilapia": "/food/banku-tilapia.jpg",
  "banku and tilapia": "/food/banku-tilapia.jpg",
  "waakye special": "/food/waakye-special.jpg",
  waakye: "/food/waakye-special.jpg",
  "fufu & light soup": "/food/fufu-light-soup.jpg",
  "fufu and light soup": "/food/fufu-light-soup.jpg",
};

export function getMenuImage(item: Pick<MenuItem, "name" | "category">): string {
  const key = item.name.trim().toLowerCase();
  if (MENU_IMAGE_BY_NAME[key]) return MENU_IMAGE_BY_NAME[key];

  const category = item.category.toLowerCase();
  if (category.includes("salad")) return "/food/ghanaian-salad.jpg";
  if (category.includes("drink")) return "/food/sobolo-juice.jpg";
  if (category.includes("snack")) return "/food/pies-snacks.jpg";
  if (category.includes("breakfast")) return "/food/jollof-chicken.jpg";
  if (category.includes("side") || category.includes("extra")) return "/food/banku-tilapia.jpg";
  if (category.includes("pasta")) return "/food/jollof-chicken.jpg";
  return "/food/fufu-light-soup.jpg";
}

export const dinnerIntro = {
  eyebrow: "Nuel’s Foodzone Dinner",
  title: "A Ghanaian table, ready when you are.",
  description:
    "Choose a favourite, make it a meal, and let the kitchen take it from there. Every order gets a clear order number and a digital receipt option.",
};

export const cateringPackages = [
  {
    name: "Office table",
    description: "Reliable buffet-style meals for meetings, team lunches, and work celebrations.",
    detail: "From 10 guests",
  },
  {
    name: "Private celebration",
    description: "A generous menu with the service details that help birthdays and family gatherings flow.",
    detail: "From 20 guests",
  },
  {
    name: "Wedding & milestone",
    description: "Thoughtful menu planning and a room-ready spread for the moments people remember.",
    detail: "Custom proposal",
  },
];
