"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [topic, setTopic] = useState("General enquiry");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("topic") === "catering") setTopic("Catering enquiry");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/public-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact, topic, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your message.");
      setSent(true); setName(""); setContact(""); setMessage("");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to send your message."); } finally { setSubmitting(false); }
  };

  return <div className="min-h-screen bg-[#f7f3ec] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 lg:py-24"><div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"><div><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Nuel’s Foodzone / Contact</p><h1 className="mt-5 max-w-2xl font-display text-6xl font-extrabold leading-[0.84] tracking-[-0.08em] sm:text-8xl">Let’s talk<br /><span className="text-primary">food.</span></h1><p className="mt-9 max-w-md text-base leading-8 text-stone-600 dark:text-stone-300">Ask about Dinner, tell us about your event, or leave a note for the team. Your enquiry is logged for manager follow-up.</p><div className="mt-12 grid max-w-lg divide-y divide-stone-300 border-y border-stone-300 dark:divide-stone-800 dark:border-stone-800"><div className="flex gap-4 py-5"><Clock3 className="mt-1 h-5 w-5 text-primary" /><div><p className="font-bold">Opening hours</p><p className="mt-1 text-sm leading-6 text-stone-500">Published by the manager when the restaurant schedule is confirmed.</p></div></div><div className="flex gap-4 py-5"><MapPin className="mt-1 h-5 w-5 text-primary" /><div><p className="font-bold">Location</p><p className="mt-1 text-sm leading-6 text-stone-500">The verified address and map link will be published from the manager portal.</p></div></div><div className="flex gap-4 py-5"><Mail className="mt-1 h-5 w-5 text-primary" /><div><p className="font-bold">A direct enquiry</p><p className="mt-1 text-sm leading-6 text-stone-500">Send the details here and the team can follow up from one place.</p></div></div></div></div><form onSubmit={submit} className="border-t-2 border-stone-950 pt-5 dark:border-white"><div className="flex items-end justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Send an enquiry</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.04em]">What are you planning?</h2></div><span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 sm:inline">We reply from the manager queue</span></div><div className="mt-10 grid gap-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="contact-name" className="text-[11px] font-bold uppercase tracking-[0.16em]">Your name</Label><Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} required className="h-12 rounded-none border-0 border-b border-stone-300 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary dark:border-stone-700" /></div><div className="space-y-2"><Label htmlFor="contact-detail" className="text-[11px] font-bold uppercase tracking-[0.16em]">Phone or email</Label><Input id="contact-detail" value={contact} onChange={(event) => setContact(event.target.value)} required className="h-12 rounded-none border-0 border-b border-stone-300 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary dark:border-stone-700" /></div></div><div className="mt-8 space-y-2"><Label htmlFor="contact-topic" className="text-[11px] font-bold uppercase tracking-[0.16em]">Topic</Label><select id="contact-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className="h-12 w-full border-0 border-b border-stone-300 bg-transparent px-0 text-sm outline-none focus:border-primary dark:border-stone-700 dark:bg-stone-950"><option>General enquiry</option><option>Dinner order question</option><option>Catering enquiry</option><option>Feedback</option></select></div><div className="mt-8 space-y-2"><Label htmlFor="contact-message" className="text-[11px] font-bold uppercase tracking-[0.16em]">Message</Label><Textarea id="contact-message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={1500} className="min-h-36 rounded-none border-0 border-b border-stone-300 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary dark:border-stone-700" placeholder="Tell us what you need help with…" /></div>{sent && <div className="mt-6 flex items-start gap-3 border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Thank you. Your enquiry has been sent for manager follow-up.</div>}{error && <div className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}<Button type="submit" className="mt-8 h-11 rounded-none px-5 text-[11px] font-bold uppercase tracking-[0.12em]" disabled={submitting}>{submitting ? "Sending…" : "Send enquiry"} <ArrowUpRight className="ml-2 h-4 w-4" /></Button></form></div></main><PublicFooter /></div>;
}
