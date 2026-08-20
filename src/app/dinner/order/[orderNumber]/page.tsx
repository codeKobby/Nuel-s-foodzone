"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, CookingPot, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

type PublicOrder = {
  orderNumber: string;
  orderType: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  total: number;
  status: string;
  kitchenStatus: string;
  receiptStatus: string;
  customerName: string;
  timestamp: string | null;
};

const stages = [
  { key: "Queued", label: "Received", icon: FileText },
  { key: "Acknowledged", label: "Seen by kitchen", icon: CheckCircle2 },
  { key: "Preparing", label: "Being prepared", icon: CookingPot },
  { key: "Ready", label: "Ready for handoff", icon: Clock3 },
];

export default function PublicOrderStatusPage() {
  const params = useParams<{ orderNumber: string }>();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    const token = accessToken;
    if (!token) {
      setError("This order page needs the secure link from your confirmation.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/public-orders/${encodeURIComponent(params.orderNumber)}?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load this order.");
      setOrder(result as PublicOrder);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this order.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.orderNumber]);

  useEffect(() => {
    setAccessToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void loadOrder();
    const interval = window.setInterval(() => void loadOrder(), 15000);
    return () => window.clearInterval(interval);
  }, [accessToken, loadOrder]);

  const currentStageIndex = order ? Math.max(0, stages.findIndex((stage) => stage.key === order.kitchenStatus)) : -1;

  return <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">{loading ? <div className="flex min-h-96 items-center justify-center text-sm text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your order…</div> : error ? <div className="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center text-red-900"><h1 className="text-2xl font-bold">We could not open this order.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6">{error}</p><div className="mt-6 flex justify-center gap-3"><Button variant="outline" onClick={() => void loadOrder()} className="rounded-full"><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button><Button asChild className="rounded-full"><Link href="/dinner/menu">Back to Dinner</Link></Button></div></div> : order ? <><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-8 w-8" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-primary">Order received</p><h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight">{order.orderNumber}</h1><p className="mt-4 text-sm text-stone-600 dark:text-stone-300">Thanks, {order.customerName}. Your order has entered the Dinner queue.</p></div><section className="mt-12 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Kitchen progress</p><h2 className="mt-2 text-2xl font-bold">{order.kitchenStatus === "Ready" ? "Ready for handoff" : order.kitchenStatus === "Preparing" ? "Your food is being prepared" : "Your order is in the queue"}</h2></div><Button variant="outline" size="icon" onClick={() => void loadOrder()} className="rounded-full" aria-label="Refresh order status"><RefreshCw className="h-4 w-4" /></Button></div><div className="mt-8 grid gap-3 sm:grid-cols-4">{stages.map((stage, index) => { const Icon = stage.icon; const active = index <= currentStageIndex; return <div key={stage.key} className={`rounded-2xl border p-4 ${active ? "border-primary/30 bg-primary/5 text-primary" : "border-stone-200 text-stone-400 dark:border-stone-800"}`}><Icon className="h-5 w-5" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em]">{stage.label}</p></div>; })}</div><div className="mt-8 flex items-start gap-3 rounded-2xl bg-stone-100 p-4 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>This secure page is linked to your order. Keep the order number handy when contacting the team.</p></div></section><section className="mt-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Order summary</h2><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700 dark:bg-stone-900 dark:text-stone-300">{order.orderType}</span></div><div className="mt-6 space-y-4">{order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-4 border-b border-stone-100 pb-4 text-sm dark:border-stone-800"><span><span className="font-bold">{item.quantity}×</span> {item.name}</span><span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span></div>)}</div><div className="mt-6 flex items-center justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatCurrency(order.total)}</span></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button asChild className="rounded-full"><Link href="/dinner/menu">Order something else <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button variant="outline" className="rounded-full" onClick={() => window.print()}><FileText className="mr-2 h-4 w-4" /> Save / print receipt</Button></div></section></> : null}</main><PublicFooter /></div>;
}
