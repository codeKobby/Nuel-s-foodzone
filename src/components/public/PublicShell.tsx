"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";
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
  { label: "Updates", href: "/announcements" },
  { label: "Contact", href: "/contact" },
];

export function PublicHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { totalItems } = usePublicCart();

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#fffaf4]/90 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          <Image src={logo} alt="Nuel’s Foodzone" width={44} height={44} className="rounded-xl shadow-sm" priority />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-extrabold tracking-tight text-stone-950 dark:text-white">Nuel’s Foodzone</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Dinner · Catering</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-semibold transition-colors ${active ? "text-primary" : "text-stone-600 hover:text-primary dark:text-stone-300"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden rounded-full px-5 shadow-sm sm:inline-flex">
            <Link href="/dinner/menu">
              Order Dinner <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="relative rounded-full" aria-label="View dinner cart">
            <Link href="/dinner/menu#cart">
              <ShoppingBag className="h-4 w-4" />
              {totalItems > 0 && <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">{totalItems}</Badge>}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-stone-200 bg-[#fffaf4] px-4 py-4 dark:border-stone-800 dark:bg-stone-950 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile navigation">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-primary/10 text-primary" : "text-stone-700 dark:text-stone-200"}`}>
                  {item.label}
                </Link>
              );
            })}
            <Link href="/dinner/menu" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground">
              Order Dinner
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-stone-200 bg-stone-950 text-stone-300 dark:border-stone-800">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Image src={logo} alt="Nuel’s Foodzone" width={42} height={42} className="rounded-xl" />
            <div>
              <p className="font-display text-lg font-bold text-white">Nuel’s Foodzone</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Good food. Good people.</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-stone-400">A Ghanaian food brand bringing generous restaurant dinners and warm, dependable catering to everyday tables and important celebrations.</p>
        </div>
        <div>
          <p className="font-semibold text-white">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/dinner" className="hover:text-white">Nuel’s Foodzone Dinner</Link>
            <Link href="/catering" className="hover:text-white">Catering services</Link>
            <Link href="/gallery" className="hover:text-white">Gallery</Link>
            <Link href="/announcements" className="hover:text-white">Latest updates</Link>
          </div>
        </div>
        <div>
          <p className="font-semibold text-white">Visit or order</p>
          <div className="mt-4 grid gap-3 text-sm text-stone-400">
            <span>Open for Dinner orders and collection</span>
            <Link href="/contact" className="hover:text-white">Message the team</Link>
            <Link href="/contact" className="hover:text-white">Contact and location</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-stone-500">© {new Date().getFullYear()} Nuel’s Foodzone. Crafted for the table.</div>
    </footer>
  );
}
