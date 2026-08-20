"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { ArrowRight, Minus, Plus, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePublicCart } from "@/context/PublicCartContext";
import { db, firebaseConfigured } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";
import { initialMenuData } from "@/data/initial-data";
import { getMenuImage } from "@/lib/public-content";
import { PublicFooter, PublicHeader } from "@/components/public/PublicShell";

const fallbackMenu: MenuItem[] = initialMenuData.map((item, index) => ({ ...item, id: `fallback-${index}` }));

function describeItem(item: MenuItem) {
  const name = item.name.toLowerCase();
  if (name.includes("jollof")) return "Smoky spiced rice with a generous Ghanaian finish.";
  if (name.includes("salad")) return "Fresh, crisp and dressed to order.";
  if (name.includes("drink") || item.category.toLowerCase().includes("drink")) return "A cool companion for your table.";
  if (name.includes("pie") || name.includes("sandwich")) return "A quick bite with a proper Foodzone welcome.";
  return "Comforting flavour, made for the table.";
}

export default function DinnerMenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>(fallbackMenu);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const { itemList, totalItems, subtotal, addItem, updateQuantity, removeItem } = usePublicCart();

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const menuQuery = query(collection(db, "menuItems"), orderBy("category"), orderBy("name"));
    return onSnapshot(menuQuery, (snapshot) => {
      const liveMenu = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenu(liveMenu.length > 0 ? liveMenu : fallbackMenu);
      setLoading(false);
    }, () => {
      setMenuError("The live menu could not be reached, so we are showing the latest preview menu.");
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map((item) => item.category))).sort()], [menu]);
  const filteredMenu = useMemo(() => menu.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [menu, category, search]);

  return <div className="min-h-screen bg-[#fffaf4] text-stone-950 dark:bg-stone-950 dark:text-stone-100"><PublicHeader /><main>
    <section className="border-b border-stone-200 bg-stone-950 text-white dark:border-stone-800"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-end lg:px-8"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-200">Nuel’s Foodzone Dinner</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Choose your comfort.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-stone-300">Browse the live menu, add what you love, and send your order to the Dinner kitchen with a clear order number.</p></div><Button variant="outline" className="w-fit rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setCartOpen(true)}><ShoppingBag className="mr-2 h-4 w-4" /> Your order {totalItems > 0 && <Badge className="ml-2 bg-orange-200 text-stone-950">{totalItems}</Badge>}</Button></div></section>
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="sticky top-20 z-30 rounded-2xl border border-stone-200 bg-[#fffaf4]/95 p-3 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/95"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jollof, salad, drinks…" className="h-11 rounded-xl border-stone-200 bg-white pl-10 dark:border-stone-700 dark:bg-stone-900" /></div><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{categories.map((itemCategory) => <Button key={itemCategory} variant={category === itemCategory ? "default" : "outline"} onClick={() => setCategory(itemCategory)} className="shrink-0 rounded-full">{itemCategory}</Button>)}</div></div></div>
      {menuError && <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">{menuError}</div>}
      {loading ? <div className="flex min-h-80 items-center justify-center text-sm text-stone-500"><Sparkles className="mr-2 h-4 w-4 animate-pulse" /> Loading the Dinner menu…</div> : filteredMenu.length === 0 ? <div className="py-20 text-center"><h2 className="text-2xl font-bold">Nothing matched that search.</h2><p className="mt-2 text-sm text-stone-500">Try another dish or browse all categories.</p></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filteredMenu.map((item) => { const soldOut = item.stock <= 0; return <article key={item.id} className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-stone-800 dark:bg-stone-950"><div className="relative aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-900"><Image src={getMenuImage(item)} alt={item.name} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw" /><div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-800">{item.category}</div>{soldOut && <div className="absolute inset-0 flex items-center justify-center bg-stone-950/55 text-sm font-bold text-white">Currently unavailable</div>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold leading-tight">{item.name}</h2><span className="shrink-0 font-bold text-primary">{formatCurrency(item.price)}</span></div><p className="mt-2 min-h-10 text-sm leading-6 text-stone-500 dark:text-stone-400">{describeItem(item)}</p><Button className="mt-5 h-11 w-full rounded-xl" disabled={soldOut} onClick={() => { addItem(item); setCartOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add to order</Button></div></article>; })}</div>}
    </section>
  </main><PublicFooter />

  {cartOpen && <div className="fixed inset-0 z-[60] bg-stone-950/50" onClick={() => setCartOpen(false)}><aside id="cart" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#fffaf4] shadow-2xl dark:bg-stone-950" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-stone-200 p-5 dark:border-stone-800"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your Dinner order</p><h2 className="mt-1 text-xl font-bold">{totalItems} {totalItems === 1 ? "item" : "items"}</h2></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCartOpen(false)}><X className="h-5 w-5" /></Button></div><div className="flex-1 overflow-y-auto p-5">{itemList.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><ShoppingBag className="h-12 w-12 text-stone-300" /><h3 className="mt-5 font-bold">Your basket is waiting.</h3><p className="mt-2 text-sm text-stone-500">Add a plate or a drink to get started.</p></div> : <div className="space-y-4">{itemList.map((item) => <div key={item.id} className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"><Image src={getMenuImage(item)} alt={item.name} fill className="object-cover" sizes="64px" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="mt-1 text-sm text-stone-500">{formatCurrency(item.price)} each</p><div className="mt-2 flex items-center gap-2"><Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button><span className="w-5 text-center text-sm font-bold">{item.quantity}</span><Button size="icon" variant="outline" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button><button className="ml-auto text-xs font-semibold text-stone-400 hover:text-destructive" onClick={() => removeItem(item.id)}>Remove</button></div></div><span className="text-sm font-bold">{formatCurrency(item.price * item.quantity)}</span></div>)}</div>}</div><div className="border-t border-stone-200 p-5 dark:border-stone-800"><div className="flex items-center justify-between text-lg font-bold"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div><p className="mt-2 text-xs leading-5 text-stone-500">Final order details and receipt delivery are confirmed at checkout.</p><Button asChild className="mt-5 h-12 w-full rounded-xl" disabled={itemList.length === 0}><Link href="/dinner/checkout">Continue to checkout <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></aside></div>}
  </div>;
}
