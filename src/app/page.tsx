import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChefHat, MapPin, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const highlights = [
  {
    eyebrow: "Dinner favourite",
    title: "Jollof, grilled chicken & plantain",
    description: "A generous plate with the smoky, savoury comfort that keeps the table coming back.",
    image: "/food/jollof-chicken.jpg",
  },
  {
    eyebrow: "Made for sharing",
    title: "Catering that feels like home",
    description: "From office lunches to celebrations, we help you serve food people remember.",
    image: "/food/catering-buffet.jpg",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100">
      <PublicHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-stone-950 text-white">
          <div className="absolute inset-0">
            <Image src="/food/nuels-dinner-hero.jpg" alt="A spread of Ghanaian dishes from Nuel’s Foodzone" fill priority className="object-cover object-center opacity-75" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/75 to-stone-950/20" />
          </div>
          <div className="relative mx-auto flex min-h-[min(760px,calc(100vh-5rem))] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-100 backdrop-blur">Nuel’s Foodzone · Ghanaian kitchen</p>
              <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">Good food should feel like a gathering.</h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-stone-200 sm:text-lg">Welcome to Nuel’s Foodzone — a warm home for bold Ghanaian flavours, easy Dinner ordering, and catering that makes every occasion feel cared for.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-6 text-base"><Link href="/dinner/menu">Order from Dinner <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/30 bg-white/10 px-6 text-base text-white hover:bg-white/20 hover:text-white"><Link href="/catering">Plan your catering</Link></Button>
              </div>
              <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6 text-sm text-stone-300">
                <div><p className="font-bold text-white">Dinner</p><p className="mt-1">Comfort food, made fresh</p></div>
                <div><p className="font-bold text-white">Catering</p><p className="mt-1">For teams and celebrations</p></div>
                <div><p className="font-bold text-white">Easy ordering</p><p className="mt-1">Get a digital receipt</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">Two ways to enjoy us</p>
              <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">One food family. Two experiences.</h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-stone-600 dark:text-stone-300">Whether you are ordering tonight’s meal or planning a room full of guests, the Nuel’s Foodzone promise is the same: generous portions, honest flavour, and a team that pays attention.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Link href="/dinner" className="group relative min-h-[410px] overflow-hidden rounded-[2rem] bg-stone-900 text-white shadow-xl">
              <Image src="/food/waakye-special.jpg" alt="Waakye special plate" fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-200">Nuel’s Foodzone Dinner</p><h3 className="mt-3 font-display text-3xl font-extrabold">Your table is waiting.</h3><p className="mt-3 max-w-md text-sm leading-6 text-stone-200">Browse the live menu, build your order, and get a clear order number with your digital receipt.</p><span className="mt-6 inline-flex items-center font-semibold text-orange-100">Explore Dinner <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" /></span></div>
            </Link>
            <Link href="/catering" className="group relative min-h-[410px] overflow-hidden rounded-[2rem] bg-stone-900 text-white shadow-xl">
              <Image src="/food/catering-buffet.jpg" alt="Ghanaian buffet prepared for catering" fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-200">Nuel’s Foodzone Catering</p><h3 className="mt-3 font-display text-3xl font-extrabold">Let us feed the room.</h3><p className="mt-3 max-w-md text-sm leading-6 text-stone-200">Tell us about your event and we will help you shape a menu, service style, and guest experience that fits.</p><span className="mt-6 inline-flex items-center font-semibold text-orange-100">Talk to Catering <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" /></span></div>
            </Link>
          </div>
        </section>

        <section className="bg-stone-100/80 py-20 dark:bg-stone-900/60 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">From our kitchen</p><h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">The flavours people talk about.</h2></div><Button asChild variant="outline" className="w-fit rounded-full"><Link href="/dinner/menu">See the Dinner menu <UtensilsCrossed className="ml-2 h-4 w-4" /></Link></Button></div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {highlights.map((highlight) => <article key={highlight.title} className="grid overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-stone-950 sm:grid-cols-2"><div className="relative min-h-60"><Image src={highlight.image} alt={highlight.title} fill className="object-cover" sizes="(min-width: 640px) 25vw, 100vw" /></div><div className="flex flex-col justify-center p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{highlight.eyebrow}</p><h3 className="mt-3 font-display text-2xl font-bold leading-tight">{highlight.title}</h3><p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">{highlight.description}</p></div></article>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24"><div className="grid gap-6 md:grid-cols-3"><div className="rounded-3xl border border-stone-200 bg-white p-7 dark:border-stone-800 dark:bg-stone-950"><ChefHat className="h-7 w-7 text-primary" /><h3 className="mt-5 text-xl font-bold">Cooked with intention</h3><p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">The Dinner menu is built around familiar Ghanaian favourites, fresh sides, and food that arrives ready to enjoy.</p></div><div className="rounded-3xl border border-stone-200 bg-white p-7 dark:border-stone-800 dark:bg-stone-950"><CalendarDays className="h-7 w-7 text-primary" /><h3 className="mt-5 text-xl font-bold">Built for your moments</h3><p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">Catering support for corporate gatherings, private parties, weddings, and the days you simply want a full table.</p></div><div className="rounded-3xl border border-stone-200 bg-white p-7 dark:border-stone-800 dark:bg-stone-950"><MapPin className="h-7 w-7 text-primary" /><h3 className="mt-5 text-xl font-bold">Come as you are</h3><p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">Find us, message us, or order ahead. We are making it easier to know what is happening with your food from start to finish.</p></div></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}
