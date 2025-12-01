"use server";

import { sendEmail } from "@/lib/email";
import { google } from "@/lib/ai";
import { generateText } from "ai";
import { getAdminDb } from "@/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { ReconciliationReport, Order } from "@/lib/types";

const RECIPIENT_EMAIL = "nuelgee54@gmail.com";

export async function sendDailyReconciliationEmail(report: any) {
  const subject = `Daily Financial Summary - ${report.period}`;

  const html = `
    <h1>Daily Financial Summary</h1>
    <p><strong>Date:</strong> ${report.period}</p>
    <p><strong>Cashier:</strong> ${report.cashierName || "Unknown"}</p>
    
    <h2>Revenue Overview</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
      <tr>
        <td><strong>Total Sales</strong></td>
        <td>GH₵${report.totalSales.toFixed(2)}</td>
      </tr>
      <tr>
        <td><strong>Expected Revenue</strong></td>
        <td>GH₵${report.totalExpectedRevenue.toFixed(2)}</td>
      </tr>
      <tr>
        <td><strong>Counted Revenue</strong></td>
        <td>GH₵${report.totalCountedRevenue.toFixed(2)}</td>
      </tr>
      <tr>
        <td><strong>Total Discrepancy</strong></td>
        <td style="color: ${report.totalDiscrepancy < 0 ? "red" : "green"}">
          GH₵${report.totalDiscrepancy.toFixed(2)}
        </td>
      </tr>
    </table>

    <h2>Breakdown</h2>
    <ul>
      <li><strong>Cash Sales:</strong> GH₵${report.expectedCash.toFixed(
        2
      )} (Counted: GH₵${report.countedCash.toFixed(2)})</li>
      <li><strong>MoMo Sales:</strong> GH₵${report.expectedMomo.toFixed(
        2
      )} (Counted: GH₵${report.countedMomo.toFixed(2)})</li>
    </ul>

    <h2>Notes</h2>
    <p>${report.notes || "No notes provided."}</p>
  `;

  return await sendEmail({
    to: RECIPIENT_EMAIL,
    subject,
    text: `Daily Financial Summary for ${report.period}. Total Sales: GH₵${report.totalSales}`,
    html,
  });
}

export async function generateAndSendAiAnalysis(dailyStats: any) {
  const today = new Date();
  const isFriday = today.getDay() === 5; // 0 is Sunday, 5 is Friday

  let analysisContext = "";
  let subject = "";

  if (isFriday) {
    subject = `Weekly Financial Analysis (Auditor Report) - ${format(
      today,
      "yyyy-MM-dd"
    )}`;
    // Fetch weekly data
    const weeklyData = await fetchWeeklyData();
    analysisContext = `
      This is a WEEKLY report (Friday).
      
      Weekly Data:
      - Total Sales: GH₵${weeklyData.totalSales.toFixed(2)}
      - Total Orders: ${weeklyData.totalOrders}
      - Top Items: ${weeklyData.topItems
        .map((i: any) => `${i.name} (${i.count})`)
        .join(", ")}
      
      Daily Data (Today):
      - Total Sales: GH₵${dailyStats.totalSales.toFixed(2)}
      - Net Revenue: GH₵${dailyStats.netRevenue.toFixed(2)}
    `;
  } else {
    subject = `Daily Financial Analysis (Auditor Report) - ${format(
      today,
      "yyyy-MM-dd"
    )}`;
    analysisContext = `
      This is a DAILY report.
      
      Daily Data:
      - Total Sales: GH₵${dailyStats.totalSales.toFixed(2)}
      - Net Revenue: GH₵${dailyStats.netRevenue.toFixed(2)}
      - Cash Discrepancy: GH₵${(dailyStats.cashDiscrepancy || 0).toFixed(2)}
      - Momo Discrepancy: GH₵${(dailyStats.momoDiscrepancy || 0).toFixed(2)}
    `;
  }

  const { text } = await generateText({
    model: google("gemini-1.5-pro"),
    system: `You are a professional financial auditor and accountant for "Nuel's Foodzone Cafe". 
    Your job is to analyze the provided sales data and generate a strict, professional performance report.
    You should act as an external auditor, highlighting any discrepancies, praising good performance, and suggesting improvements.
    
    If it is a weekly report, provide a deeper analysis of trends over the week.
    If it is a daily report, focus on today's performance and immediate issues (like cash discrepancies).
    
    Format the output as a professional email body (HTML compatible if possible, but plain text with markdown is fine).`,
    prompt: `Analyze the following business data:\n${analysisContext}`,
  });

  // Convert Markdown to basic HTML for email (optional, but good for readability)
  // For now, we'll just wrap it in <pre> or simple formatting if needed,
  // but sending as text/markdown is often acceptable or we can use a library.
  // We'll send it as plain text body or simple HTML.

  const html = `
    <h2>${subject}</h2>
    <div style="white-space: pre-wrap; font-family: sans-serif;">
      ${text
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}
    </div>
  `;

  return await sendEmail({
    to: RECIPIENT_EMAIL,
    subject,
    text,
    html,
  });
}

async function fetchWeeklyData() {
  const end = new Date();
  const start = subDays(end, 7);

  // Dynamically import Timestamp to avoid build-time initialization
  const { Timestamp } = await import("firebase-admin/firestore");

  // We need to query orders from Firestore Admin
  // Note: This assumes 'timestamp' field exists on orders
  const adminDb = getAdminDb();
  const ordersRef = adminDb.collection("orders");
  const snapshot = await ordersRef
    .where("timestamp", ">=", Timestamp.fromDate(start))
    .where("timestamp", "<=", Timestamp.fromDate(end))
    .get();

  let totalSales = 0;
  let totalOrders = 0;
  const itemCounts: Record<string, number> = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status === "Completed") {
      totalSales += data.total || 0;
      totalOrders += 1;

      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          itemCounts[item.name] =
            (itemCounts[item.name] || 0) + (item.quantity || 0);
        });
      }
    }
  });

  const topItems = Object.entries(itemCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalSales,
    totalOrders,
    topItems,
  };
}
