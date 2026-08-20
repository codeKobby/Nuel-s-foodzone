import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminDb } from "@/lib/firebase-admin";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeTimestamp(value: unknown) {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await context.params;
    const token = request.nextUrl.searchParams.get("token") || "";
    if (!orderNumber || token.length < 20) {
      return NextResponse.json({ error: "A valid order link is required." }, { status: 400 });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("orders").where("simplifiedId", "==", orderNumber).limit(1).get();
    if (snapshot.empty) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const order = snapshot.docs[0].data();
    if (order.publicAccessTokenHash !== hashToken(token)) {
      return NextResponse.json({ error: "This order link is not valid." }, { status: 403 });
    }

    return NextResponse.json({
      orderNumber: order.simplifiedId,
      orderType: order.orderType,
      items: order.items,
      total: order.total,
      status: order.status,
      kitchenStatus: order.kitchenStatus || "Queued",
      receiptStatus: order.receiptStatus || "pending",
      customerName: order.customerName,
      timestamp: serializeTimestamp(order.timestamp),
    });
  } catch (error) {
    console.error("Public order status failed:", error);
    return NextResponse.json({ error: "Unable to load the order status." }, { status: 500 });
  }
}
