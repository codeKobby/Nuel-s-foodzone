import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, ReceiptText, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";
import { dinnerIntro } from "@/lib/public-content";

export default function DinnerPage() {
  return (
    <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100">
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">{dinnerIntro.eyebrow}</p><h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{dinnerIntro.title}</h1><p className="mt-6 text-base leading-8 text-stone-600 dark:text-stone-300">{dinnerIntro.description}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="rounded-full"><Link href="/dinner/menu">Browse the menu <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="rounded-full"><Link href="/contact">Ask a question</Link></Button></div><div className="mt-9 flex flex-wrap gap-5 text-sm text-stone-600 dark:text-stone-300"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /> Freshly prepared</span><span className="inline-flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary" /> Digital receipt</span><span className="inline-flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-primary" /> Ghanaian favourites</span></div></div>
          <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] bg-stone-900 shadow-2xl sm:min-h-[560px]"><Image src="/food/nuels-dinner-hero.jpg" alt="Nuel’s Foodzone Dinner spread" fill className="object-cover" sizes="(min-width: 1024px) 55vw, 100vw" /><div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 to-transparent" /><div className="absolute bottom-0 left-0 right-0 p-7 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-200">Tonight’s table</p><p className="mt-2 text-2xl font-bold">Order, relax, and follow the journey.</p></div></div>
        </section>

        <section className="bg-stone-950 py-16 text-white lg:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-6 md:grid-cols-3"><div><span className="text-4xl font-extrabold text-orange-200">01</span><h2 className="mt-3 text-xl font-bold">Pick your favourites</h2><p className="mt-2 text-sm leading-7 text-stone-400">Browse the live Dinner menu, search by category, and build a basket in a few taps.</p></div><div><span className="text-4xl font-extrabold text-orange-200">02</span><h2 className="mt-3 text-xl font-bold">Tell us how to reach you</h2><p className="mt-2 text-sm leading-7 text-stone-400">Choose collection or delivery details and provide a number for your digital receipt.</p></div><div><span className="text-4xl font-extrabold text-orange-200">03</span><h2 className="mt-3 text-xl font-bold">Keep your order number</h2><p className="mt-2 text-sm leading-7 text-stone-400">Your order is sent to the kitchen queue and you can return to your secure status page.</p></div></div></div></section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-2 lg:items-center"><div className="relative min-h-[340px] overflow-hidden rounded-[2rem]"><Image src="/food/banku-tilapia.jpg" alt="Banku with grilled tilapia" fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" /></div><div className="max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">The menu is live</p><h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Comfort food with a little theatre.</h2><p className="mt-5 text-base leading-8 text-stone-600 dark:text-stone-300">Our Dinner experience is designed around the food itself. See what is available, choose what sounds good, and let the team take care of the rest. For menu availability, preparation timing, or special requests, contact the team before ordering.</p><Button asChild className="mt-7 rounded-full"><Link href="/dinner/menu">Start an order <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}
