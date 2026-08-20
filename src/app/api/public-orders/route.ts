import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { generateSimpleOrderId } from "@/lib/utils";

interface CustomerOrderItem {
  menuItemId?: string;
  name?: string;
  quantity?: number;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidPhone(phone: string) {
  return /^[+0-9][0-9\s().-]{6,24}$/.test(phone.trim());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      items?: CustomerOrderItem[];
      customerName?: string;
      customerPhone?: string;
      orderType?: "Pickup" | "Delivery";
      notes?: string;
      receiptMethod?: "whatsapp" | "sms" | "download";
    };

    const customerName = body.customerName?.trim() || "";
    const customerPhone = body.customerPhone?.trim() || "";
    const orderType = body.orderType === "Delivery" ? "Delivery" : "Pickup";
    const receiptMethod = body.receiptMethod || "download";
    const items = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2) {
      return NextResponse.json({ error: "Enter the customer’s name." }, { status: 400 });
    }
    if (!isValidPhone(customerPhone)) {
      return NextResponse.json({ error: "Enter a valid phone number for the receipt." }, { status: 400 });
    }
    if (items.length === 0 || items.length > 50) {
      return NextResponse.json({ error: "Add at least one menu item to the order." }, { status: 400 });
    }

    const db = getAdminDb();
    const counterRef = db.collection("counters").doc("orderIdCounter");
    const orderRef = db.collection("orders").doc();
    const publicAccessToken = randomBytes(24).toString("base64url");
    const publicAccessTokenHash = hashToken(publicAccessToken);

    let responseData: { orderNumber: string; total: number } | undefined;

    await db.runTransaction(async (transaction) => {
      const menuRefs = items.map((item) => {
        if (!item.menuItemId) throw new Error("Every order item must reference a menu item.");
        return db.collection("menuItems").doc(item.menuItemId);
      });
      const menuSnapshots: DocumentSnapshot[] = [];
      for (const menuRef of menuRefs) {
        menuSnapshots.push(await transaction.get(menuRef));
      }
      const counterSnapshot = await transaction.get(counterRef);

      const validatedItems = items.map((item, index) => {
        const quantity = Number(item.quantity);
        const menuSnapshot = menuSnapshots[index];
        if (!menuSnapshot.exists) throw new Error("One of the selected menu items is no longer available.");
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) throw new Error("Menu item quantity is invalid.");

        const menuItem = menuSnapshot.data() as { name?: string; price?: number; category?: string; stock?: number };
        const price = Number(menuItem.price);
        const stock = Number(menuItem.stock);
        if (!menuItem.name || !Number.isFinite(price) || price < 0) throw new Error("One of the selected menu items has invalid pricing.");
        if (Number.isFinite(stock) && stock < quantity) throw new Error(`${menuItem.name} does not have enough availability for this order.`);

        return {
          name: menuItem.name,
          price,
          quantity,
          category: menuItem.category || "Menu",
          menuItemId: menuRefs[index].id,
        };
      });

      const total = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const currentCount = Number(counterSnapshot.data()?.count || 0);
      const nextCount = currentCount + 1;
      const simplifiedId = generateSimpleOrderId(nextCount);

      transaction.set(orderRef, {
        simplifiedId,
        tag: `WEB-${simplifiedId}`,
        channel: "public-web",
        orderType,
        items: validatedItems,
        total,
        status: "Pending",
        kitchenStatus: "Queued",
        fulfilledItems: [],
        notes: body.notes?.trim().slice(0, 500) || "",
        cashierId: "public-web",
        cashierName: "Nuel’s Foodzone Dinner website",
        customerName,
        customerPhone,
        receiptMethod,
        receiptStatus: receiptMethod === "download" ? "available" : "pending",
        publicAccessTokenHash,
        paymentMethod: "Unpaid",
        paymentBreakdown: { cash: 0, momo: 0 },
        paymentStatus: "Unpaid",
        amountPaid: 0,
        changeGiven: 0,
        balanceDue: total,
        pardonedAmount: 0,
        timestamp: new Date(),
      });
      transaction.set(counterRef, { count: nextCount }, { merge: true });
      responseData = { orderNumber: simplifiedId, total };
    });

    if (!responseData) throw new Error("The order could not be created.");

    return NextResponse.json({
      ...responseData,
      accessToken: publicAccessToken,
      status: "Pending",
    }, { status: 201 });
  } catch (error) {
    console.error("Public order creation failed:", error);
    const message = error instanceof Error ? error.message : "Unable to create the order.";
    const clientMessage = message.includes("not available") || message.includes("availability") || message.includes("quantity") || message.includes("pricing")
      ? message
      : "The Dinner order could not be submitted. Please try again or contact the team.";
    return NextResponse.json({ error: clientMessage }, { status: 500 });
  }
}
