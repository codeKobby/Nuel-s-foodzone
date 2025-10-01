
"use client";

import React from 'react';
import { ArrowRight, Utensils, Users, Phone } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const menuHighlights = [
  { name: 'Jollof Rice & Chicken', image: 'https://picsum.photos/seed/jollof/600/400', hint: 'jollof rice' },
  { name: 'Banku & Tilapia', image: 'https://picsum.photos/seed/banku/600/400', hint: 'grilled tilapia' },
  { name: 'Waakye Special', image: 'https://picsum.photos/seed/waakye/600/400', hint: 'waakye' },
  { name: 'Fufu & Light Soup', image: 'https://picsum.photos/seed/fufu/600/400', hint: 'fufu soup' },
];

const cateringHighlights = [
    { title: "Corporate Events", description: "Impress your clients and colleagues with our professional catering.", icon: Users, hint: 'corporate catering' },
    { title: "Private Parties", description: "Birthdays, anniversaries, or family gatherings - we make them special.", icon: Users, hint: 'party food' },
    { title: "Weddings", description: "Exquisite menus to make your big day unforgettable.", icon: Users, hint: 'wedding catering' }
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-20 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.png" alt="Nuel's Cafe Logo" width={40} height={40} className="rounded-lg"/>
                <h1 className="text-xl font-bold">Nuel's Cafe</h1>
            </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
            <Link href="/menu" className="text-sm font-medium hover:text-primary transition-colors">Menu</Link>
            <Link href="/catering" className="text-sm font-medium hover:text-primary transition-colors">Catering</Link>
            <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push('/menu')} className="hidden sm:inline-flex">Order Now</Button>
            <Button onClick={() => router.push('/backoffice')} variant="outline">Staff Login</Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center text-center text-white">
            <div className="absolute inset-0 bg-black/60 z-10"/>
            <Image 
                src="https://picsum.photos/seed/hero-bg/1800/1200" 
                alt="A spread of delicious Ghanaian food"
                data-ai-hint="ghanaian food"
                fill
                className="object-cover"
                priority
            />
            <div className="relative z-20 container mx-auto px-4 animate-fade-in">
                <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">Authentic Ghanaian Cuisine</h2>
                <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto text-gray-200">
                    Experience the rich and vibrant flavors of Ghana, prepared with love and the freshest ingredients.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button size="lg" asChild className="text-lg h-12">
                        <Link href="/menu">
                            Explore Menu <ArrowRight className="ml-2"/>
                        </Link>
                    </Button>
                    <Button size="lg" variant="secondary" asChild className="text-lg h-12">
                        <Link href="/catering">Catering Services</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Menu Highlights Section */}
        <section className="py-16 sm:py-24 bg-secondary/50">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-3xl font-bold mb-2">Taste Our Popular Dishes</h3>
            <p className="text-muted-foreground mb-12 max-w-xl mx-auto">From savory Jollof to hearty Fufu, discover the meals our customers love the most.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {menuHighlights.map((item) => (
                <div key={item.name} className="group relative overflow-hidden rounded-lg shadow-lg">
                    <Image src={item.image} alt={item.name} data-ai-hint={item.hint} width={600} height={400} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
                    <div className="absolute bottom-0 left-0 p-4">
                        <h4 className="text-white text-lg font-semibold">{item.name}</h4>
                    </div>
                </div>
              ))}
            </div>
            <div className="mt-12">
                <Button variant="outline" size="lg" asChild>
                    <Link href="/menu">
                        View Full Menu <Utensils className="ml-2" />
                    </Link>
                </Button>
            </div>
          </div>
        </section>
        
        {/* Catering Section */}
        <section className="py-16 sm:py-24">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h3 className="text-3xl font-bold mb-4">Unforgettable Catering Services</h3>
                        <p className="text-muted-foreground mb-8 text-lg">
                            Let us bring the taste of Nuel's Cafe to your special events. From corporate gatherings to intimate celebrations, we provide a culinary experience that will delight your guests.
                        </p>
                        <div className="space-y-6">
                           {cateringHighlights.map((service, index) => (
                               <div key={index} className="flex items-start gap-4">
                                   <div className="flex-shrink-0 bg-primary/10 text-primary p-3 rounded-full">
                                       <service.icon/>
                                   </div>
                                   <div>
                                       <h4 className="font-semibold text-lg">{service.title}</h4>
                                       <p className="text-muted-foreground">{service.description}</p>
                                   </div>
                               </div>
                           ))}
                        </div>
                        <Button size="lg" asChild className="mt-10">
                            <Link href="/catering">
                                Learn More About Catering
                            </Link>
                        </Button>
                    </div>
                    <div className="relative h-80 lg:h-full min-h-[400px] rounded-xl overflow-hidden shadow-2xl">
                         <Image 
                            src="https://picsum.photos/seed/catering/800/1000"
                            alt="A beautiful catering setup"
                            data-ai-hint="event catering"
                            fill
                            className="object-cover"
                         />
                    </div>
                </div>
            </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t py-12">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <div className="flex justify-center mb-4">
                <Image src="/logo.png" alt="Nuel's Cafe Logo" width={50} height={50} className="rounded-lg"/>
            </div>
            <p className="font-semibold text-foreground mb-2">Nuel's Cafe</p>
            <p className="text-sm">Authentic Ghanaian Cuisine</p>
            <div className="mt-6 flex justify-center gap-6">
                <Link href="/menu" className="text-sm font-medium hover:text-primary transition-colors">Menu</Link>
                <Link href="/catering" className="text-sm font-medium hover:text-primary transition-colors">Catering</Link>
                <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
            </div>
            <p className="mt-8 text-xs">&copy; {new Date().getFullYear()} Nuel's Cafe. All Rights Reserved.</p>
          </div>
      </footer>
    </div>
  );
}
