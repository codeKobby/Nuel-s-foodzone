"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
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
    const topicFromUrl = new URLSearchParams(window.location.search).get("topic");
    if (topicFromUrl === "catering") setTopic("Catering enquiry");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/public-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact, topic, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your message.");
      setSent(true);
      setName(""); setContact(""); setMessage("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">Let’s talk</p><h1 className="mt-4 font-display text-5xl font-extrabold tracking-tight">Contact Nuel’s Foodzone.</h1><p className="mt-5 max-w-xl text-base leading-8 text-stone-600 dark:text-stone-300">Ask about Dinner, tell us about your event, or leave a message for the team. Your enquiry is logged for manager follow-up.</p><div className="mt-9 grid gap-4"><div className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"><MessageCircle className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Message the team</p><p className="mt-1 text-sm leading-6 text-stone-500">Use the form and the manager can publish the correct phone and WhatsApp details from the portal.</p></div></div><div className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"><Clock3 className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Opening hours</p><p className="mt-1 text-sm leading-6 text-stone-500">Hours will be maintained as manager-published content in the next CMS phase.</p></div></div><div className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"><MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Location</p><p className="mt-1 text-sm leading-6 text-stone-500">The manager can publish the verified restaurant address and map link before launch.</p></div></div></div></div><form onSubmit={submit} className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">Send an enquiry</h2><p className="mt-1 text-sm text-stone-500">We will route it to the manager follow-up queue.</p></div></div><div className="mt-8 grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="contact-name">Your name</Label><Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} required className="h-12 rounded-xl" /></div><div className="space-y-2"><Label htmlFor="contact-detail">Phone or email</Label><Input id="contact-detail" value={contact} onChange={(event) => setContact(event.target.value)} required className="h-12 rounded-xl" /></div></div><div className="mt-5 space-y-2"><Label htmlFor="contact-topic">What is this about?</Label><select id="contact-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className="flex h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-800 dark:bg-stone-900"><option>General enquiry</option><option>Dinner order question</option><option>Catering enquiry</option><option>Feedback</option></select></div><div className="mt-5 space-y-2"><Label htmlFor="contact-message">Message</Label><Textarea id="contact-message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={1500} className="min-h-40 rounded-xl" placeholder="Tell us what you need help with…" /></div>{sent && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>Thank you. Your enquiry has been sent for manager follow-up.</span></div>}{error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}<Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={submitting}>{submitting ? "Sending…" : "Send enquiry"}</Button><p className="mt-4 text-center text-xs leading-5 text-stone-500">For privacy, the form stores only the contact details and message needed to respond.</p></form></div></main><PublicFooter /></div>;
}
