import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

function validContact(value: string) {
  return value.trim().length >= 5 && value.trim().length <= 120;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      contact?: string;
      topic?: string;
      message?: string;
    };
    const name = body.name?.trim() || "";
    const contact = body.contact?.trim() || "";
    const topic = body.topic?.trim() || "General enquiry";
    const message = body.message?.trim() || "";

    if (!validContact(name) || !validContact(contact) || message.length < 10 || message.length > 1500) {
      return NextResponse.json({ error: "Please complete your name, contact details, and message." }, { status: 400 });
    }

    await getAdminDb().collection("publicEnquiries").add({
      name,
      contact,
      topic: topic.slice(0, 80),
      message,
      status: "new",
      source: "public-website",
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Public enquiry submission failed:", error);
    return NextResponse.json({ error: "We could not send the enquiry. Please try again." }, { status: 500 });
  }
}
