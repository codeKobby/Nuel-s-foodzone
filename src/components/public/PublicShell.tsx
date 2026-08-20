"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import logo from "@/app/logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePublicCart } from "@/context/PublicCartContext";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Dinner", href: "/dinner" },
  { label: "Catering", href: "/catering" },
  { label: "Gallery", href: "/gallery" },
  { label: "Journal", href: "/announcements" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { totalItems } = usePublicCart();

  return <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#f7f3ec]/95 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-950/95"><div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12"><Link href="/" className="flex shrink-0 items-center gap-3" onClick={() => setOpen(false)}><Image src={logo} alt="Nuel’s Foodzone" width={44} height={44} className="rounded-[14px]" priority /><span className="leading-none"><span className="block text-[16px] font-extrabold tracking-[-0.04em] text-stone-950 dark:text-white">Nuel’s Foodzone</span><span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.24em] text-primary">Food with feeling</span></span></Link><nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">{navigation.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`relative py-2 text-[12px] font-bold tracking-[-0.01em] transition-colors ${active ? "text-primary" : "text-stone-500 hover:text-stone-950 dark:hover:text-white"}`}>{item.label}{active && <span className="absolute -bottom-1 left-0 h-1 w-1 rounded-full bg-primary" />}</Link>; })}</nav><div className="flex items-center gap-2"><Button asChild className="hidden h-11 rounded-[10px] px-5 text-[12px] font-bold shadow-sm sm:inline-flex"><Link href="/dinner/menu">Order Dinner <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" size="icon" className="relative h-11 w-11 rounded-[10px] border-stone-300 dark:border-stone-700" aria-label="View Dinner cart"><Link href="/dinner/menu#cart"><ShoppingBag className="h-4 w-4" />{totalItems > 0 && <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">{totalItems}</Badge>}</Link></Button><Button variant="ghost" size="icon" className="h-11 w-11 rounded-[10px] lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button></div></div>{open && <div className="border-t border-stone-200 bg-[#f7f3ec] px-5 py-4 dark:border-stone-800 dark:bg-stone-950 lg:hidden"><nav className="grid gap-1">{navigation.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`border-b border-stone-200 py-4 text-sm font-bold dark:border-stone-800 ${active ? "text-primary" : "text-stone-700 dark:text-stone-200"}`}>{item.label}</Link>; })}<Link href="/contact" onClick={() => setOpen(false)} className="mt-4 text-sm font-bold text-primary">Contact the team <ArrowUpRight className="ml-1 inline h-4 w-4" /></Link></nav></div>}</header>;
}

export function PublicFooter() {
  return <footer className="bg-[#151512] text-stone-300"><div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20"><div className="grid gap-12 border-b border-white/15 pb-14 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]"><div><p className="text-3xl font-extrabold tracking-[-0.05em] text-white">Nuel’s<br />Foodzone<span className="text-primary">.</span></p><p className="mt-6 max-w-xs text-sm leading-7 text-stone-500">A Ghanaian food brand for the everyday table, the big table, and the stories that happen around both.</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Navigate</p><div className="mt-5 grid gap-3 text-sm"><Link href="/dinner" className="hover:text-white">Dinner</Link><Link href="/catering" className="hover:text-white">Catering</Link><Link href="/gallery" className="hover:text-white">Gallery</Link><Link href="/announcements" className="hover:text-white">Journal</Link></div></div><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Order</p><div className="mt-5 grid gap-3 text-sm"><Link href="/dinner/menu" className="hover:text-white">Browse the menu</Link><Link href="/dinner/checkout" className="hover:text-white">Checkout</Link><Link href="/contact" className="hover:text-white">Ask the team</Link></div></div><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Stay close</p><p className="mt-5 max-w-xs text-sm leading-7 text-stone-500">For verified location details, opening hours, phone and WhatsApp updates, check the manager-published contact page.</p><Link href="/contact" className="mt-5 inline-flex items-center text-sm font-bold text-orange-200 hover:text-white">Contact & location <ArrowUpRight className="ml-2 h-4 w-4" /></Link></div></div><div className="flex flex-col justify-between gap-4 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600 sm:flex-row"><span>© {new Date().getFullYear()} Nuel’s Foodzone</span><span>Dinner · Catering · Good food</span></div></div></footer>;
}
