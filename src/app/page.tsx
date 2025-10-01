"use client";

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X, Phone, MapPin, Clock, ChevronRight, Star, Users, Utensils, Package, Check, Plus, Minus, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const NuelsCafeWebsite = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sample menu data
  const menuItems = [
    { id: 1, name: 'Jollof Rice & Chicken', category: 'mains', price: 35, image: '🍛', description: 'Authentic West African jollof with grilled chicken', popular: true },
    { id: 2, name: 'Banku & Tilapia', category: 'mains', price: 45, image: '🐟', description: 'Traditional fermented corn dough with grilled tilapia', popular: true },
    { id: 3, name: 'Waakye Special', category: 'mains', price: 30, image: '🍚', description: 'Rice and beans with spaghetti, gari, and meat', popular: true },
    { id: 4, name: 'Fufu & Light Soup', category: 'mains', price: 40, image: '🥘', description: 'Pounded cassava with aromatic light soup' },
    { id: 5, name: 'Fried Rice', category: 'mains', price: 32, image: '🍛', description: 'Colorful fried rice with vegetables and protein' },
    { id: 6, name: 'Kelewele', category: 'sides', price: 10, image: '🍌', description: 'Spicy fried plantains with groundnuts', popular: true },
    { id: 7, name: 'Meat Pie', category: 'sides', price: 8, image: '🥟', description: 'Flaky pastry filled with seasoned meat' },
    { id: 8, name: 'Chin Chin', category: 'sides', price: 5, image: '🍪', description: 'Crunchy fried dough snack' },
    { id: 9, name: 'Fresh Juice', category: 'drinks', price: 15, image: '🧃', description: 'Choice of pineapple, orange, or mixed fruit' },
    { id: 10, name: 'Sobolo', category: 'drinks', price: 10, image: '🥤', description: 'Refreshing hibiscus drink', popular: true },
    { id: 11, name: 'Soft Drinks', category: 'drinks', price: 8, image: '🥤', description: 'Assorted cold beverages' },
  ];

  const todaysSpecials = [
    { name: 'Chef\'s Special Jollof', price: 38, original: 45, image: '🍛', discount: '15% OFF' },
    { name: 'Grilled Tilapia Combo', price: 50, original: 60, image: '🐟', discount: '17% OFF' },
    { name: 'Family Pack', price: 120, original: 150, image: '🍱', discount: '20% OFF' },
  ];

  const cateringPackages = [
    { 
      name: 'Intimate Gathering', 
      guests: '20-50', 
      price: 'From GH₵1,500',
      features: ['Choice of 2 main dishes', 'Sides & drinks', 'Disposable serving ware', 'Delivery & setup']
    },
    { 
      name: 'Corporate Event', 
      guests: '50-150', 
      price: 'From GH₵4,000',
      features: ['Choice of 3 main dishes', 'Sides & drinks', 'Professional serving staff', 'Complete setup & cleanup'],
      popular: true
    },
    { 
      name: 'Grand Celebration', 
      guests: '150+', 
      price: 'Custom Quote',
      features: ['Unlimited menu options', 'Full catering crew', 'Premium setup & decor', 'VIP service & coordination']
    },
  ];

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c));
    } else {
      setCart([...cart, {...item, qty: 1}]);
    }
  };

  const updateQty = (id: any, delta: any) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQty = c.qty + delta;
        return newQty > 0 ? {...c, qty: newQty} : null;
      }
      return c;
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const filteredMenu = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center text-2xl shadow-lg">
                🍽️
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  Nuel's Cafe
                </h1>
                <p className="text-xs text-gray-600">Authentic Ghanaian Cuisine</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#home" className="text-gray-700 hover:text-orange-600 transition font-medium">Home</a>
              <a href="#menu" className="text-gray-700 hover:text-orange-600 transition font-medium">Menu</a>
              <a href="#specials" className="text-gray-700 hover:text-orange-600 transition font-medium">Today's Specials</a>
              <a href="#catering" className="text-gray-700 hover:text-orange-600 transition font-medium">Catering</a>
              <a href="#contact" className="text-gray-700 hover:text-orange-600 transition font-medium">Contact</a>
               <Button onClick={() => router.push('/backoffice')} variant="outline">Staff Login</Button>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg transition-all flex items-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-700"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-3">
              <a href="#home" className="block text-gray-700 hover:text-orange-600 py-2">Home</a>
              <a href="#menu" className="block text-gray-700 hover:text-orange-600 py-2">Menu</a>
              <a href="#specials" className="block text-gray-700 hover:text-orange-600 py-2">Today's Specials</a>
              <a href="#catering" className="block text-gray-700 hover:text-orange-600 py-2">Catering</a>
              <a href="#contact" className="block text-gray-700 hover:text-orange-600 py-2">Contact</a>
               <Button onClick={() => router.push('/backoffice')} variant="outline" className="w-full">Staff Login</Button>
              <button 
                onClick={() => {setIsCartOpen(true); setIsMenuOpen(false);}}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-3 rounded-full flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>View Cart ({cartCount})</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <div className="inline-block">
                <span className="bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-semibold">
                  ⭐ #1 Authentic Ghanaian Cuisine in Accra
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Experience the
                <span className="block bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  Taste of Home
                </span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                From traditional jollof to fresh tilapia, we bring you authentic Ghanaian flavors made with love. Order online for pickup or delivery!
              </p>
              <div className="flex flex-wrap gap-4">
                <a 
                  href="#menu"
                  className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-8 py-4 rounded-full font-semibold hover:shadow-xl transition-all flex items-center space-x-2 group"
                >
                  <span>Order Now</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="#catering"
                  className="bg-white text-orange-600 px-8 py-4 rounded-full font-semibold hover:shadow-xl transition-all border-2 border-orange-200"
                >
                  Catering Services
                </a>
              </div>
              <div className="flex items-center space-x-8 pt-4">
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full border-2 border-white" />
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">2,500+</div>
                    <div className="text-gray-600">Happy Customers</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-2 font-semibold text-gray-900">4.9/5</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-3xl p-8 shadow-2xl">
                <div className="text-8xl text-center mb-4">🍛</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-4 shadow-lg">
                    <div className="text-4xl mb-2">🐟</div>
                    <div className="font-semibold text-gray-900">Fresh Daily</div>
                    <div className="text-sm text-gray-600">Tilapia & Seafood</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-lg">
                    <div className="text-4xl mb-2">🥘</div>
                    <div className="font-semibold text-gray-900">Traditional</div>
                    <div className="text-sm text-gray-600">Home Recipes</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-full h-full bg-gradient-to-br from-orange-300 to-amber-400 rounded-3xl -z-0" />
            </div>
          </div>
        </div>
      </section>

      {/* Today's Specials */}
      <section id="specials" className="py-20 bg-gradient-to-br from-orange-600 to-amber-600">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              🔥 Today's Specials
            </h2>
            <p className="text-orange-100 text-lg">Limited time offers - Order before they're gone!</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {todaysSpecials.map((special, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 shadow-2xl hover:scale-105 transition-transform">
                <div className="relative">
                  <div className="text-7xl text-center mb-4">{special.image}</div>
                  <span className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {special.discount}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{special.name}</h3>
                <div className="flex items-baseline space-x-2 mb-4">
                  <span className="text-3xl font-bold text-orange-600">GH₵{special.price}</span>
                  <span className="text-lg text-gray-400 line-through">GH₵{special.original}</span>
                </div>
                <button 
                  onClick={() => addToCart({...special, id: `special-${idx}`})}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Our Menu</h2>
            <p className="text-gray-600 text-lg">Authentic dishes prepared fresh daily</p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {['all', 'mains', 'sides', 'drinks'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-3 rounded-full font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-orange-50 border-2 border-orange-200'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Menu Items */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenu.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group">
                <div className="relative bg-gradient-to-br from-orange-100 to-amber-100 p-8">
                  <div className="text-7xl text-center group-hover:scale-110 transition-transform">{item.image}</div>
                  {item.popular && (
                    <span className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-white" />
                      <span>Popular</span>
                    </span>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-orange-600">GH₵{item.price}</span>
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg transition-all flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catering Section */}
      <section id="catering" className="py-20 bg-gradient-to-br from-amber-50 to-orange-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Catering Services</h2>
            <p className="text-gray-600 text-lg">Let us make your event unforgettable</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {cateringPackages.map((pkg, idx) => (
              <div key={idx} className={`bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all ${pkg.popular ? 'ring-4 ring-orange-400 transform scale-105' : ''}`}>
                {pkg.popular && (
                  <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-2 rounded-full text-sm font-bold text-center mb-4">
                    ⭐ Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className="text-5xl mb-4">
                    {idx === 0 ? '👥' : idx === 1 ? '🏢' : '🎉'}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                  <div className="flex items-center justify-center space-x-2 text-gray-600 mb-2">
                    <Users className="w-4 h-4" />
                    <span>{pkg.guests} guests</span>
                  </div>
                  <div className="text-3xl font-bold text-orange-600">{pkg.price}</div>
                </div>
                <ul className="space-y-3 mb-6">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a 
                  href="#contact"
                  className={`block text-center py-3 rounded-full font-semibold transition-all ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:shadow-lg'
                      : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                  }`}
                >
                  Request Quote
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-12 text-white">
              <h2 className="text-4xl font-bold mb-6">Get in Touch</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <MapPin className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Visit Us</div>
                    <div className="text-orange-100">Nuel's Food Zone<br />Accra, Greater Accra Region</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Phone className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Call Us</div>
                    <div className="text-orange-100">+233 XX XXX XXXX</div>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Clock className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Hours</div>
                    <div className="text-orange-100">
                      Mon-Sat: 8:00 AM - 8:00 PM<br />
                      Sunday: 10:00 AM - 6:00 PM
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Send a Message</h3>
              <form className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                />
                <input 
                  type="tel" 
                  placeholder="Phone Number" 
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                />
                <textarea 
                  placeholder="Your Message" 
                  rows="4"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                />
                <button className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="text-2xl font-bold mb-2">Nuel's Cafe</h3>
          <p className="text-gray-400 mb-6">Authentic Ghanaian Cuisine • Made with Love</p>
          <div className="flex justify-center space-x-6 mb-6">
            <a href="#" className="text-gray-400 hover:text-orange-400 transition">Facebook</a>
            <a href="#" className="text-gray-400 hover:text-orange-400 transition">Instagram</a>
            <a href="#" className="text-gray-400 hover:text-orange-400 transition">Twitter</a>
          </div>
          <p className="text-gray-500 text-sm">© 2025 Nuel's Cafe. All rights reserved.</p>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCartOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center space-x-4 bg-gray-50 rounded-xl p-4">
                      <div className="text-4xl">{item.image}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-orange-600 font-bold">GH₵{item.price}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => updateQty(item.id, -1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">{item.qty}</span>
                        <button 
                          onClick={() => updateQty(item.id, 1)}
                          className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t p-6 space-y-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-orange-600">GH₵{cartTotal.toFixed(2)}</span>
                </div>
                <button className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white py-4 rounded-full font-bold text-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2">
                  <span>Proceed to Checkout</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <p className="text-center text-sm text-gray-500">
                  Pickup available in 20-30 minutes
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Utensils className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Fresh Ingredients</h3>
              <p className="text-gray-600 text-sm">Quality ingredients sourced daily</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Fast Service</h3>
              <p className="text-gray-600 text-sm">Ready in 20-30 minutes</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Delivery Available</h3>
              <p className="text-gray-600 text-sm">We deliver to your doorstep</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Catering Events</h3>
              <p className="text-gray-600 text-sm">Perfect for any occasion</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NuelsCafeWebsite;

    