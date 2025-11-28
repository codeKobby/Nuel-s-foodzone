import { NextResponse } from 'next/server';
import { sendDailyReconciliationEmail, generateAndSendAiAnalysis } from '@/actions/report-actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Fire-and-forget email + AI analysis (still await to surface errors here)
    const emailResult = await sendDailyReconciliationEmail(body);

    // Provide some dailyStats for the AI analysis function.
    const dailyStats = {
      totalSales: body.totalSales || 0,
      netRevenue: (body.totalCountedRevenue || 0) - (body.totalDiscrepancy || 0),
      cashDiscrepancy: body.cashDiscrepancy || 0,
      momoDiscrepancy: body.momoDiscrepancy || 0,
    };

    const aiResult = await generateAndSendAiAnalysis(dailyStats);

    return NextResponse.json({ success: true, emailResult, aiResult });
  } catch (error) {
    console.error('Error in send-report route:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
