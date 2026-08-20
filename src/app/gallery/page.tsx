import Image from "next/image";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const gallery = [
  { src: "/food/nuels-dinner-hero.jpg", alt: "A spread of Ghanaian dishes at Nuel’s Foodzone", label: "The Dinner table", span: "md:col-span-2 md:row-span-2" },
  { src: "/food/jollof-chicken.jpg", alt: "Jollof rice with grilled chicken and plantain", label: "Jollof & grilled chicken", span: "" },
  { src: "/food/banku-tilapia.jpg", alt: "Banku with grilled tilapia and pepper sauce", label: "Banku & tilapia", span: "" },
  { src: "/food/waakye-special.jpg", alt: "Waakye with plantain, egg, salad and gari", label: "Waakye special", span: "" },
  { src: "/food/fufu-light-soup.jpg", alt: "Fufu with light soup and chicken", label: "Fufu & light soup", span: "md:col-span-2" },
  { src: "/food/catering-buffet.jpg", alt: "A catered buffet with Ghanaian dishes", label: "Catering setup", span: "md:col-span-2" },
];

export default function GalleryPage() {
  return <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">A taste of the table</p><h1 className="mt-4 font-display text-5xl font-extrabold tracking-tight">Gallery</h1><p className="mt-5 text-base leading-8 text-stone-600 dark:text-stone-300">A glimpse of the food, colour, and generous spirit behind Nuel’s Foodzone. Manager-published restaurant and event photos can grow this gallery over time.</p></div><div className="mt-12 grid auto-rows-[220px] gap-5 md:grid-cols-4">{gallery.map((item) => <figure key={item.src} className={`group relative overflow-hidden rounded-3xl bg-stone-900 ${item.span}`}><Image src={item.src} alt={item.alt} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 768px) 25vw, 100vw" /><div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-transparent to-transparent" /><figcaption className="absolute bottom-0 left-0 p-5 text-sm font-bold text-white">{item.label}</figcaption></figure>)}</div></main><PublicFooter /></div>;
}
