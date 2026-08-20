"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePublicCart } from "@/context/PublicCartContext";
import { formatCurrency } from "@/lib/utils";
import { getMenuImage } from "@/lib/public-content";
import Image from "next/image";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

export default function DinnerCheckoutPage() {
  const router = useRouter();
  const { itemList, subtotal, updateQuantity } = usePublicCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"Pickup" | "Delivery">("Pickup");
  const [receiptMethod, setReceiptMethod] = useState<"whatsapp" | "sms" | "download">("whatsapp");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (itemList.length === 0) {
      setError("Your order is empty. Add something from the Dinner menu first.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/public-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          orderType,
          receiptMethod,
          notes,
          items: itemList.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit the order.");
      router.push(`/dinner/order/${encodeURIComponent(result.orderNumber)}?token=${encodeURIComponent(result.accessToken)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the order.");
      setIsSubmitting(false);
    }
  };

  return <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16"><div className="mb-10"><Link href="/dinner/menu" className="inline-flex items-center text-sm font-semibold text-stone-500 hover:text-primary"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dinner menu</Link><p className="mt-7 text-sm font-bold uppercase tracking-[0.25em] text-primary">Nuel’s Foodzone Dinner</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Confirm your order.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-300">Give the kitchen the details it needs and choose how you would like to receive your digital receipt.</p></div><div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-start"><form onSubmit={submitOrder} className="space-y-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-8"><div><h2 className="text-xl font-bold">Your details</h2><p className="mt-1 text-sm text-stone-500">A phone number is required so we can connect your receipt to the order.</p></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="customer-name">Name</Label><Input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" required minLength={2} className="h-12 rounded-xl" /></div><div className="space-y-2"><Label htmlFor="customer-phone">Phone / WhatsApp number</Label><Input id="customer-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="e.g. +233 24 000 0000" required className="h-12 rounded-xl" /><p className="text-xs text-stone-500">Include the country code where possible.</p></div></div><div><p className="text-sm font-semibold">How should we prepare the handoff?</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["Pickup", "Delivery"] as const).map((type) => <label key={type} className={`cursor-pointer rounded-2xl border p-4 transition ${orderType === type ? "border-primary bg-primary/5" : "border-stone-200 dark:border-stone-800"}`}><input type="radio" name="orderType" value={type} checked={orderType === type} onChange={() => setOrderType(type)} className="sr-only" /><span className="font-bold">{type}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{type === "Pickup" ? "We will prepare it for collection." : "The team will confirm delivery details with you."}</span></label>)}</div></div><div><p className="text-sm font-semibold">Digital receipt preference</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{([{ value: "whatsapp", label: "WhatsApp", icon: MessageCircle }, { value: "sms", label: "SMS link", icon: Info }, { value: "download", label: "Secure link", icon: CheckCircle2 }] as const).map(({ value, label, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition ${receiptMethod === value ? "border-primary bg-primary/5" : "border-stone-200 dark:border-stone-800"}`}><input type="radio" name="receiptMethod" value={value} checked={receiptMethod === value} onChange={() => setReceiptMethod(value)} className="sr-only" /><Icon className="h-4 w-4 text-primary" />{label}</label>)}</div><p className="mt-2 text-xs leading-5 text-stone-500">Your secure order link is always shown after submission. WhatsApp/SMS delivery will be connected to the receipt provider in the next integration phase.</p></div><div className="space-y-2"><Label htmlFor="order-notes">Notes for the kitchen <span className="font-normal text-stone-500">(optional)</span></Label><Textarea id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Allergies, timing, or a helpful note…" className="min-h-28 rounded-xl" /></div>{error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}<Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={isSubmitting || itemList.length === 0}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending to the kitchen…</> : <>Place Dinner order <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></form><aside className="rounded-[2rem] border border-stone-200 bg-stone-950 p-6 text-white shadow-sm dark:border-stone-800 sm:p-8"><div className="flex items-center gap-3"><ShoppingBag className="h-5 w-5 text-orange-200" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">Your basket</p><p className="mt-1 text-sm text-stone-400">{itemList.length} line items</p></div></div>{itemList.length === 0 ? <div className="py-12 text-center"><p className="text-stone-300">Your basket is empty.</p><Button asChild variant="outline" className="mt-5 rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white"><Link href="/dinner/menu">Browse menu</Link></Button></div> : <div className="mt-7 space-y-4">{itemList.map((item) => <div key={item.id} className="flex gap-3 border-b border-white/10 pb-4"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"><Image src={getMenuImage(item)} alt={item.name} fill className="object-cover" sizes="56px" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><div className="mt-1 flex items-center gap-2 text-xs text-stone-400"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-full border border-white/20 px-2 hover:bg-white/10">−</button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-full border border-white/20 px-2 hover:bg-white/10">+</button></div></div><span className="text-sm font-bold">{formatCurrency(item.price * item.quantity)}</span></div>)}<div className="flex items-center justify-between pt-2 text-lg font-bold"><span>Subtotal</span><span className="text-orange-200">{formatCurrency(subtotal)}</span></div><p className="text-xs leading-5 text-stone-400">Payment is confirmed with the team at collection/delivery during this release.</p></div>}</aside></div></main><PublicFooter /></div>;
}
