'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe, Search, ArrowRight, Menu, Compass, Zap, Layers, Sun
} from 'lucide-react';
import LocationAutocomplete from '@/components/LocationAutocomplete';

// ==========================================
// DATA & ASSETS
// ==========================================
const concepts = [
    { id: 'bento', name: 'The Bento Board', icon: <Layers className="w-4 h-4" /> },
    { id: 'editorial', name: 'The Storyteller', icon: <Menu className="w-4 h-4" /> },
    { id: 'search', name: 'The Search Engine', icon: <Search className="w-4 h-4" /> },
    { id: 'hybrid1', name: 'Editorial Search', icon: <Compass className="w-4 h-4" /> },
    { id: 'hybrid2', name: 'Bento Editorial', icon: <Globe className="w-4 h-4" /> },
    { id: 'hybrid3', name: 'The Curator', icon: <Zap className="w-4 h-4" /> },
];

export default function MainPageConcepts() {
    const [currentConcept, setCurrentConcept] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextConcept = () => {
        setDirection(1);
        setCurrentConcept((prev) => (prev + 1) % concepts.length);
    };

    const prevConcept = () => {
        setDirection(-1);
        setCurrentConcept((prev) => (prev - 1 + concepts.length) % concepts.length);
    };

    const setConcept = (index: number) => {
        setDirection(index > currentConcept ? 1 : -1);
        setCurrentConcept(index);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black font-sans">

            {/* CONCEPT RENDERER */}
            <div className="absolute inset-0">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={currentConcept}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -100 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="w-full h-full"
                    >
                        {renderConcept(concepts[currentConcept].id)}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* NAVIGATION CONTROLS (Overlay) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">

                {/* Concept Name */}
                <div className="bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-white font-mono text-xs tracking-widest uppercase">
                    Concept {currentConcept + 1}/{concepts.length}: <span className="text-cyan-400 font-bold">{concepts[currentConcept].name}</span>
                </div>

                {/* Dots */}
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full border border-white/5">
                    {concepts.map((c, i) => (
                        <button
                            key={c.id}
                            onClick={() => setConcept(i)}
                            className={`group relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${i === currentConcept ? 'bg-white text-black scale-110' : 'bg-white/10 text-white/50 hover:bg-white/20'
                                }`}
                        >
                            <span className="sr-only">{c.name}</span>
                            {c.icon}
                            {/* Tooltip */}
                            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                {c.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Arrow Keys */}
            <button onClick={prevConcept} className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-4 text-white/50 hover:text-white transition-colors">
                <ArrowRight className="w-8 h-8 rotate-180" />
            </button>
            <button onClick={nextConcept} className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-4 text-white/50 hover:text-white transition-colors">
                <ArrowRight className="w-8 h-8" />
            </button>

        </div>
    );
}

// ==========================================
// INDIVIDUAL CONCEPTS
// ==========================================

function renderConcept(id: string) {
    switch (id) {
        case 'bento': return <BentoBoard />;
        case 'editorial': return <Storyteller />;
        case 'search': return <SearchEngine />;
        case 'hybrid1': return <EditorialSearch />;
        case 'hybrid2': return <BentoEditorial />;
        case 'hybrid3': return <TheCurator />;
        default: return <BentoBoard />;
    }
}

// 3. BENTO BOARD
function BentoBoard() {
    return (
        <div className="relative w-full h-full bg-[#F2F1EF] p-8 md:p-20 flex flex-col justify-center">
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 h-[600px]">

                {/* Header Block */}
                <div className="md:col-span-2 md:row-span-1 bg-white rounded-3xl p-8 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow">
                    <h2 className="text-3xl font-bold text-gray-800">Where to next?</h2>
                    <p className="text-gray-500 mt-2">Plan your 2026 adventures.</p>
                    <div className="mt-4 flex gap-2">
                        <input placeholder="Search..." className="bg-gray-100 rounded-full px-4 py-2 text-sm w-full outline-none focus:ring-2 ring-blue-500/20" />
                        <button className="bg-black text-white rounded-full w-10 h-10 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Map Block */}
                <div className="md:col-span-2 md:row-span-2 bg-blue-500 rounded-3xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-md transition-shadow">
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-6 left-6 text-white">
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold inline-block mb-2">TRENDING</div>
                        <h3 className="text-2xl font-bold">Icelandic Highlands</h3>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="md:col-span-1 md:row-span-1 bg-orange-50 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                    <Sun className="w-8 h-8 text-orange-400" />
                    <div>
                        <div className="text-3xl font-bold text-gray-800">72°</div>
                        <div className="text-xs text-gray-500 font-bold uppercase">Barcelona</div>
                    </div>
                </div>

                {/* Flight Ticket */}
                <div className="md:col-span-1 md:row-span-2 bg-white rounded-3xl p-6 relative overflow-hidden border border-dashed border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-8">
                        <span className="text-2xl font-mono text-gray-400">NYC</span>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <span className="text-2xl font-mono text-black">TKY</span>
                    </div>
                    <div className="space-y-4">
                        <div className="h-2 bg-gray-100 rounded-full w-full"></div>
                        <div className="h-2 bg-gray-100 rounded-full w-3/4"></div>
                        <div className="h-2 bg-gray-100 rounded-full w-1/2"></div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full bg-black text-white py-3 text-center text-xs font-bold uppercase">
                        Book Now
                    </div>
                </div>

                {/* Stat / Profile */}
                <div className="md:col-span-2 md:row-span-1 bg-emerald-50 rounded-3xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div>
                        <div className="text-sm text-emerald-600 font-bold uppercase mb-1">Your Travel Score</div>
                        <div className="text-4xl font-black text-emerald-900">94/100</div>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-emerald-200 flex items-center justify-center text-2xl">🌍</div>
                </div>

            </div>
        </div>
    );
}

// 4. THE STORYTELLER
function Storyteller() {
    return (
        <div className="relative w-full h-full bg-[#f8f5f2] flex">
            {/* Left Sticky Content */}
            <div className="w-1/2 h-full flex flex-col justify-center px-20 border-r border-stone-200">
                <span className="text-xs font-serif italic text-stone-500 mb-6 tracking-widest">ISSUE 04 • WINTER 2026</span>
                <h1 className="text-6xl font-serif text-stone-900 leading-tight mb-8">
                    The Art of <br /> <i className="text-stone-400">Slow</i> Travel.
                </h1>
                <p className="text-stone-600 text-lg leading-relaxed max-w-md mb-10 font-serif">
                    Disconnect to reconnect. Our curated guide to the world's most remote and restorative sanctuaries.
                </p>
                <button className="text-left text-sm font-bold uppercase tracking-widest text-stone-900 border-b border-stone-900 pb-2 w-max hover:text-stone-500 hover:border-stone-500 transition-colors">
                    Read the Story
                </button>
            </div>

            {/* Right Scroll Feed */}
            <div className="w-1/2 h-full overflow-y-auto no-scrollbar relative">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/noise.png')] pointer-events-none fixed"></div>
                <div className="space-y-20 py-20 px-10">
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop" className="w-full aspect-[3/4] object-cover shadow-2xl" />
                    <div className="text-center font-serif">
                        <h3 className="text-2xl italic text-stone-800 mb-2">Amalfi Coast, Italy</h3>
                        <p className="text-xs uppercase tracking-widest text-stone-400">Mediterranean Bliss</p>
                    </div>

                    <img src="https://images.unsplash.com/photo-1542259659-4abfa757262b?q=80&w=1935&auto=format&fit=crop" className="w-full aspect-[3/4] object-cover shadow-2xl" />
                    <div className="text-center font-serif">
                        <h3 className="text-2xl italic text-stone-800 mb-2">Kyoto, Japan</h3>
                        <p className="text-xs uppercase tracking-widest text-stone-400">Ancient Tradition</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 7. SEARCH ENGINE
function SearchEngine() {
    return (
        <div className="relative w-full h-full bg-[#ffffff] flex flex-col items-center justify-center font-sans">
            <div className="mb-12">
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-slate-800">
                    wandr<span className="text-blue-600">.</span>
                </h1>
            </div>

            <div className="w-full max-w-2xl px-6 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-purple-200 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-full"></div>
                <div className="relative bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-200 rounded-full flex items-center p-2 transition-all duration-300 group-hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] group-hover:scale-105">
                    <Search className="w-6 h-6 text-slate-400 ml-4 mr-4" />
                    <input type="text" placeholder="Where do you want to go?" className="flex-1 h-14 bg-transparent outline-none text-xl text-slate-800 placeholder-slate-300" />
                    <button className="bg-blue-600 text-white rounded-full px-8 h-12 font-medium hover:bg-blue-700 transition-colors">
                        Search
                    </button>
                </div>
            </div>

            <div className="mt-12 flex gap-4 text-sm text-slate-500">
                <span>Trending:</span>
                <button className="bg-slate-100 px-3 py-1 rounded-md hover:bg-slate-200">Bali</button>
                <button className="bg-slate-100 px-3 py-1 rounded-md hover:bg-slate-200">Tulum</button>
                <button className="bg-slate-100 px-3 py-1 rounded-md hover:bg-slate-200">Swiss Alps</button>
            </div>
        </div>
    );
}

// ==========================================
// HYBRID CONCEPTS
// ==========================================

// HYBRID 1: EDITORIAL SEARCH
// Combines: Search Engine's centered minimal search + Storyteller's editorial typography
function EditorialSearch() {
    return (
        <div className="relative w-full h-full bg-[#faf9f7] flex flex-col items-center justify-center font-serif overflow-hidden">
            {/* Subtle texture */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/paper.png')]"></div>

            {/* Header */}
            <div className="absolute top-8 left-10 right-10 flex justify-between items-center text-xs tracking-widest text-stone-400 uppercase">
                <span>Est. 2024</span>
                <span>Travel Journal</span>
            </div>

            {/* Main Content */}
            <div className="relative z-10 text-center max-w-3xl px-6">
                <span className="text-xs tracking-[0.4em] text-stone-400 uppercase mb-6 block">Where will your story begin?</span>

                <h1 className="text-7xl md:text-8xl font-serif text-stone-800 tracking-tight mb-4">
                    wandr<span className="text-amber-600">.</span>
                </h1>

                <p className="text-stone-500 text-lg italic mb-12 max-w-md mx-auto">
                    Curated journeys for the curious traveler
                </p>

                {/* Search Bar */}
                <div className="w-full max-w-xl mx-auto relative group">
                    <div className="relative bg-white border border-stone-200 rounded-full flex items-center p-2 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:border-stone-300">
                        <Search className="w-5 h-5 text-stone-300 ml-4 mr-4" />
                        <input
                            type="text"
                            placeholder="Search destinations, experiences..."
                            className="flex-1 h-12 bg-transparent outline-none text-lg text-stone-700 placeholder-stone-300 font-sans"
                        />
                        <button className="bg-stone-800 text-white rounded-full px-8 h-10 font-sans text-sm font-medium hover:bg-stone-900 transition-colors">
                            Explore
                        </button>
                    </div>
                </div>

                {/* Trending */}
                <div className="mt-10 flex items-center justify-center gap-3 text-sm">
                    <span className="text-stone-400 italic">Trending:</span>
                    {['Amalfi Coast', 'Kyoto', 'Patagonia', 'Santorini'].map((place) => (
                        <button key={place} className="px-4 py-2 border border-stone-200 rounded-full text-stone-600 hover:bg-stone-100 hover:border-stone-300 transition-all font-sans text-xs tracking-wide">
                            {place}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer Quote */}
            <div className="absolute bottom-10 text-center">
                <p className="text-stone-300 text-xs italic tracking-wide">"Not all who wander are lost"</p>
            </div>
        </div>
    );
}

// HYBRID 2: BENTO EDITORIAL
// Combines: Bento's grid cards + Storyteller's editorial typography and imagery
function BentoEditorial() {
    return (
        <div className="relative w-full h-full bg-[#faf9f7] p-8 md:p-12 overflow-auto">
            {/* Header */}
            <header className="max-w-6xl mx-auto flex justify-between items-baseline mb-12">
                <div>
                    <h1 className="text-4xl font-serif text-stone-800">wandr<span className="text-amber-600">.</span></h1>
                </div>
                <nav className="flex gap-8 text-xs tracking-widest text-stone-400 uppercase font-sans">
                    <a href="#" className="hover:text-stone-800 transition-colors">Destinations</a>
                    <a href="#" className="hover:text-stone-800 transition-colors">Experiences</a>
                    <a href="#" className="hover:text-stone-800 transition-colors">Journal</a>
                </nav>
            </header>

            {/* Bento Grid with Editorial Style */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-5 min-h-[600px]">

                {/* Search Card */}
                <div className="md:col-span-2 md:row-span-1 bg-white rounded-2xl p-8 flex flex-col justify-center border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-xs tracking-widest text-stone-400 uppercase mb-3 font-sans">Begin Your Journey</span>
                    <h2 className="text-2xl font-serif text-stone-800 mb-4">Where to next?</h2>
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center bg-stone-50 rounded-full px-4 border border-stone-100">
                            <Search className="w-4 h-4 text-stone-300 mr-3" />
                            <input placeholder="Search destinations..." className="bg-transparent py-3 text-sm w-full outline-none text-stone-700 placeholder-stone-300" />
                        </div>
                        <button className="bg-stone-800 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-stone-900 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Featured Destination - Large */}
                <div className="md:col-span-2 md:row-span-2 rounded-2xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-lg transition-all">
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-8 left-8 right-8 text-white">
                        <span className="text-xs tracking-widest uppercase opacity-70 font-sans">Featured Destination</span>
                        <h3 className="text-3xl font-serif mt-2">Amalfi Coast</h3>
                        <p className="text-sm opacity-80 mt-2 font-sans">Mediterranean dreams along Italy's stunning coastline</p>
                    </div>
                </div>

                {/* Editorial Quote Card */}
                <div className="md:col-span-1 md:row-span-1 bg-amber-50 rounded-2xl p-6 flex flex-col justify-center border border-amber-100/50">
                    <p className="text-amber-800/80 font-serif italic text-lg leading-relaxed">
                        "Travel is the only thing you buy that makes you richer."
                    </p>
                    <span className="text-xs text-amber-600/60 mt-4 font-sans tracking-wide">— Anonymous</span>
                </div>

                {/* Stats Card */}
                <div className="md:col-span-1 md:row-span-1 bg-stone-800 rounded-2xl p-6 flex flex-col justify-between text-white">
                    <span className="text-xs tracking-widest text-stone-400 uppercase font-sans">Your Journey</span>
                    <div>
                        <div className="text-4xl font-serif">12</div>
                        <div className="text-xs text-stone-400 font-sans">Countries explored</div>
                    </div>
                </div>

                {/* Destination Card 2 */}
                <div className="md:col-span-1 md:row-span-1 rounded-2xl overflow-hidden relative group cursor-pointer">
                    <img src="https://images.unsplash.com/photo-1542259659-4abfa757262b?q=80&w=1935&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="font-serif text-lg">Kyoto</h3>
                        <span className="text-xs opacity-70 font-sans">Japan</span>
                    </div>
                </div>

                {/* Destination Card 3 */}
                <div className="md:col-span-1 md:row-span-1 rounded-2xl overflow-hidden relative group cursor-pointer">
                    <img src="https://images.unsplash.com/photo-1519904981063-b0cf448d479e?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="font-serif text-lg">Swiss Alps</h3>
                        <span className="text-xs opacity-70 font-sans">Switzerland</span>
                    </div>
                </div>

                {/* CTA Card */}
                <div className="md:col-span-2 md:row-span-1 bg-white rounded-2xl p-8 flex items-center justify-between border border-stone-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                    <div>
                        <span className="text-xs tracking-widest text-stone-400 uppercase font-sans">New Issue</span>
                        <h3 className="text-xl font-serif text-stone-800 mt-1">The Art of Slow Travel</h3>
                        <p className="text-sm text-stone-500 mt-1 font-sans">Our Winter 2026 collection</p>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-stone-200 flex items-center justify-center group-hover:bg-stone-800 group-hover:border-stone-800 transition-all">
                        <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-white transition-colors" />
                    </div>
                </div>

            </div>
        </div>
    );
}

// HYBRID 3: THE CURATOR
// The ultimate fusion: Editorial magazine header + Centered search + Curated bento cards below
export function TheCurator() {
    const router = useRouter();
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/planner?destination=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            router.push('/planner');
        }
    };

    const handleDestinationClick = (destination: string) => {
        router.push(`/planner?destination=${encodeURIComponent(destination)}`);
    };

    const handleGetStarted = () => {
        router.push('/planner');
    };

    return (
        <div className="relative w-full h-full bg-[#FAFAF8] overflow-auto">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-stone-100/30 pointer-events-none" />

            {/* Refined Header */}
            <header className="relative z-10 px-6 md:px-12 py-5 flex justify-between items-center border-b border-stone-100">
                <div className="flex items-center gap-8">
                    <button onClick={() => router.push('/')} className="text-2xl font-serif text-stone-800 tracking-tight hover:opacity-70 transition-opacity">
                        wandr<span className="text-amber-500">.</span>
                    </button>
                    <nav className="hidden md:flex gap-6 text-[13px] text-stone-500 font-medium">
                        <button onClick={handleGetStarted} className="hover:text-stone-900 transition-colors">Destinations</button>
                        <button onClick={handleGetStarted} className="hover:text-stone-900 transition-colors">Experiences</button>
                        <button onClick={handleGetStarted} className="hover:text-stone-900 transition-colors">Journal</button>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <button className="text-[13px] text-stone-500 hover:text-stone-900 transition-colors font-medium">
                        Sign In
                    </button>
                    <button
                        onClick={handleGetStarted}
                        className="hidden sm:block bg-stone-900 text-white text-[13px] px-5 py-2.5 rounded-full font-medium hover:bg-stone-800 transition-colors"
                    >
                        Get Started
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 text-center pt-16 md:pt-24 pb-16 md:pb-20 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-amber-600 text-xs tracking-[0.3em] uppercase font-medium mb-4">Curated Travel Intelligence</p>
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-stone-800 tracking-tight mb-4 leading-[1.1]">
                        Where will your<br />
                        <span className="italic text-stone-400">story</span> begin?
                    </h1>
                    <p className="text-stone-500 text-base md:text-lg max-w-md mx-auto mb-10 font-light">
                        Discover handpicked destinations and experiences tailored to curious travelers.
                    </p>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="w-full max-w-2xl mx-auto relative"
                >
                    {/* Glow effect */}
                    <div className={`absolute -inset-2 bg-gradient-to-r from-amber-200/40 via-stone-200/40 to-amber-200/40 rounded-3xl blur-xl transition-opacity duration-500 ${searchFocused ? 'opacity-100' : 'opacity-0'}`} />

                    <div className={`relative bg-white border rounded-2xl flex items-center p-2 shadow-sm transition-all duration-300 ${searchFocused ? 'border-stone-300 shadow-lg' : 'border-stone-200'}`}>
                        <Search className={`w-5 h-5 ml-4 mr-3 transition-colors duration-300 ${searchFocused ? 'text-stone-500' : 'text-stone-300'}`} />
                        <div className="flex-1"
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                        >
                            <LocationAutocomplete
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onSubmit={handleSearch}
                                onSelect={(prediction) => {
                                    setSearchQuery(prediction.description);
                                    handleDestinationClick(prediction.description);
                                }}
                                placeholder="Search destinations, experiences, or travel styles..."
                                variant="hero"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => handleSearch()}
                            className="bg-stone-900 text-white rounded-xl px-6 md:px-8 h-11 text-sm font-medium hover:bg-stone-800 active:scale-[0.98] transition-all"
                        >
                            Explore
                        </button>
                    </div>

                    {/* Quick Tags */}
                    <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-stone-400 text-xs mr-1">Popular:</span>
                        {['Bali', 'Tokyo', 'Paris', 'Santorini'].map((tag, i) => (
                            <motion.button
                                key={tag}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                                onClick={() => handleDestinationClick(tag)}
                                className="px-4 py-2 bg-white border border-stone-200 rounded-full text-stone-600 hover:bg-stone-50 hover:border-stone-300 hover:text-stone-900 transition-all text-xs font-medium"
                            >
                                {tag}
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* Divider */}
            <div className="max-w-6xl mx-auto px-6 md:px-12 mb-8">
                <div className="border-t border-stone-200" />
                <div className="flex justify-between items-center mt-5">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        <span className="text-xs tracking-widest text-stone-500 uppercase font-medium">Curated For You</span>
                    </div>
                    <button className="text-xs text-stone-500 hover:text-stone-900 transition-colors font-medium flex items-center gap-2 group">
                        View All <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Curated Bento Grid */}
            <section className="max-w-6xl mx-auto px-6 md:px-12 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 auto-rows-[200px]">

                    {/* Large Featured Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        onClick={() => handleDestinationClick('New Zealand')}
                        className="md:col-span-8 md:row-span-2 rounded-2xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500"
                    >
                        <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="New Zealand" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute top-5 left-5">
                            <span className="bg-white/95 backdrop-blur-sm text-stone-800 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">Editor's Pick</span>
                        </div>
                        <div className="absolute bottom-6 left-6 right-6 text-white">
                            <span className="text-xs tracking-widest uppercase opacity-70 font-medium">New Zealand</span>
                            <h3 className="text-2xl md:text-3xl font-serif mt-1.5 mb-2">The South Island</h3>
                            <p className="text-sm opacity-80 max-w-md leading-relaxed hidden sm:block">Dramatic fjords, ancient glaciers, and endless adventure await in one of Earth's most pristine landscapes.</p>
                            <div className="mt-4 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                <span className="inline-flex items-center gap-2 text-xs font-medium border border-white/30 rounded-full px-4 py-2 hover:bg-white/10 transition-colors">
                                    Explore Destination <ArrowRight className="w-3 h-3" />
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Small Card 1 - Maldives */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        onClick={() => handleDestinationClick('Maldives')}
                        className="md:col-span-4 rounded-2xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-lg transition-all duration-500"
                    >
                        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Maldives" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/70 transition-colors duration-300" />
                        <div className="absolute bottom-5 left-5 right-5 text-white">
                            <h3 className="font-serif text-xl group-hover:translate-x-1 transition-transform duration-300">Maldives</h3>
                            <span className="text-xs opacity-70 font-medium">Island Paradise</span>
                        </div>
                    </motion.div>

                    {/* Small Card 2 - Kyoto */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        onClick={() => handleDestinationClick('Kyoto, Japan')}
                        className="md:col-span-4 rounded-2xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-lg transition-all duration-500"
                    >
                        <img src="https://images.unsplash.com/photo-1542259659-4abfa757262b?q=80&w=1935&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Kyoto" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/70 transition-colors duration-300" />
                        <div className="absolute bottom-5 left-5 right-5 text-white">
                            <h3 className="font-serif text-xl group-hover:translate-x-1 transition-transform duration-300">Kyoto</h3>
                            <span className="text-xs opacity-70 font-medium">Ancient Traditions</span>
                        </div>
                    </motion.div>

                    {/* Quote Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="md:col-span-4 bg-stone-900 rounded-2xl p-6 flex flex-col justify-center text-white relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors duration-500" />
                        <p className="font-serif italic text-lg leading-relaxed opacity-95 relative z-10">
                            "The world is a book, and those who do not travel read only one page."
                        </p>
                        <span className="text-xs text-stone-400 mt-4 font-medium relative z-10">— Saint Augustine</span>
                    </motion.div>

                    {/* Small Card 3 - Patagonia */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        onClick={() => handleDestinationClick('Patagonia, Argentina')}
                        className="md:col-span-4 rounded-2xl overflow-hidden relative group cursor-pointer shadow-sm hover:shadow-lg transition-all duration-500"
                    >
                        <img src="https://images.unsplash.com/photo-1519904981063-b0cf448d479e?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Patagonia" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/70 transition-colors duration-300" />
                        <div className="absolute bottom-5 left-5 right-5 text-white">
                            <h3 className="font-serif text-xl group-hover:translate-x-1 transition-transform duration-300">Patagonia</h3>
                            <span className="text-xs opacity-70 font-medium">Wild Frontier</span>
                        </div>
                    </motion.div>

                    {/* CTA Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        onClick={handleGetStarted}
                        className="md:col-span-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 flex flex-col justify-center border border-amber-100/80 group cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl" />
                        <span className="text-xs tracking-widest text-amber-700/70 uppercase font-semibold mb-2 relative z-10">This Season</span>
                        <h3 className="font-serif text-xl text-amber-900 mb-2 relative z-10">Winter Escapes</h3>
                        <p className="text-sm text-amber-800/70 mb-4 leading-relaxed relative z-10">Curated warm-weather getaways</p>
                        <span className="text-xs font-semibold text-amber-900 flex items-center gap-2 group-hover:gap-3 transition-all relative z-10">
                            Explore Collection <ArrowRight className="w-3 h-3" />
                        </span>
                    </motion.div>

                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-stone-200 bg-white/50 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-6">
                            <span className="text-xl font-serif text-stone-800">wandr<span className="text-amber-500">.</span></span>
                            <span className="text-xs text-stone-400">Curated Travel Intelligence</span>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-stone-500">
                            <a href="#" className="hover:text-stone-900 transition-colors">About</a>
                            <a href="#" className="hover:text-stone-900 transition-colors">Contact</a>
                            <a href="#" className="hover:text-stone-900 transition-colors">Privacy</a>
                            <span className="text-stone-300">© 2026</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
