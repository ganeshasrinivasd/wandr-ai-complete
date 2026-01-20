'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
    Play, Globe, Search, ArrowRight, Menu, MapPin,
    Wind, Cloud, Sun, Compass, Zap, Layers, Terminal
} from 'lucide-react';

// ==========================================
// DATA & ASSETS
// ==========================================
const concepts = [
    { id: 'cinematic', name: 'The Cinematic Portal', icon: <Play className="w-4 h-4" /> },
    { id: 'globe', name: 'The 3D Navigator', icon: <Globe className="w-4 h-4" /> },
    { id: 'bento', name: 'The Bento Board', icon: <Layers className="w-4 h-4" /> },
    { id: 'editorial', name: 'The Storyteller', icon: <Menu className="w-4 h-4" /> },
    { id: 'ai', name: 'The AI Architect', icon: <Zap className="w-4 h-4" /> },
    { id: 'split', name: 'The Split Decision', icon: <Compass className="w-4 h-4" /> },
    { id: 'search', name: 'The Search Engine', icon: <Search className="w-4 h-4" /> },
    { id: 'parallax', name: 'The Horizon', icon: <Wind className="w-4 h-4" /> },
    { id: 'glass', name: 'Glassmorphism', icon: <Cloud className="w-4 h-4" /> },
    { id: 'cyber', name: 'Cyber Terminal', icon: <Terminal className="w-4 h-4" /> },
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
        case 'cinematic': return <CinematicPortal />;
        case 'globe': return <ThreeDNavigator />;
        case 'bento': return <BentoBoard />;
        case 'editorial': return <Storyteller />;
        case 'ai': return <AIArchitect />;
        case 'split': return <SplitDecision />;
        case 'search': return <SearchEngine />;
        case 'parallax': return <ParallaxHorizon />;
        case 'glass': return <Glassmorphism />;
        case 'cyber': return <CyberTerminal />;
        default: return <CinematicPortal />;
    }
}

// 1. CINEMATIC PORTAL
function CinematicPortal() {
    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Video Background Simulation */}
            <div className="absolute inset-0 bg-stone-900">
                <div className="absolute inset-0 opacity-60 bg-[url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center animate-[zoomIn_30s_infinite_alternate]" />
                <div className="absolute inset-0 bg-black/30" />
            </div>

            <div className="relative z-10 text-center text-white px-4">
                <motion.h1
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="text-7xl md:text-9xl font-serif tracking-tighter mb-6 mix-blend-overlay"
                >
                    WANDR
                </motion.h1>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <p className="text-xl md:text-2xl font-light tracking-[0.3em] uppercase mb-12 text-white/80">
                        Cinematic Travel Intelligence
                    </p>
                    <button className="px-10 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-sm text-white uppercase tracking-widest font-bold text-sm transition-all hover:scale-105">
                        Enter the World
                    </button>
                </motion.div>
            </div>

            <style jsx>{`
        @keyframes zoomIn {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
      `}</style>
        </div>
    );
}

// 2. 3D NAVIGATOR
function ThreeDNavigator() {
    return (
        <div className="relative w-full h-full bg-[#050510] flex items-center justify-center overflow-hidden perspective-[1000px]">
            {/* Grid Floor */}
            <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                transform: 'rotateX(60deg) translateY(200px) scale(3)',
                opacity: 0.3
            }}></div>

            {/* Wireframe Globe (CSS representation) */}
            <div className="relative w-96 h-96 rounded-full border border-blue-500/30 shadow-[0_0_100px_rgba(59,130,246,0.2)] animate-[spin_20s_linear_infinite]">
                {/* Lat/Long Lines */}
                {[0, 45, 90, 135].map(deg => (
                    <div key={deg} className="absolute inset-0 rounded-full border border-blue-500/10" style={{ transform: `rotateY(${deg}deg)` }} />
                ))}
                {[20, 40, 60, 80].map(pct => (
                    <div key={pct} className="absolute inset-0 rounded-full border-t border-b border-blue-500/10" style={{ top: `${pct}%`, bottom: `${pct}%` }} />
                ))}

                {/* Pins */}
                <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white] animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan] animate-pulse delay-700" />
            </div>

            <div className="absolute bottom-32 left-10 md:left-32">
                <h2 className="text-5xl font-mono text-white font-bold mb-2">SATELLITE VIEW</h2>
                <div className="h-1 w-24 bg-blue-500 mb-4"></div>
                <p className="text-blue-200/60 max-w-sm font-mono text-xs">
                    Global positioning system active.<br />
                    Select destination coordinates to initiate launch sequence.
                </p>
            </div>
        </div>
    );
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

// 5. AI ARCHITECT
function AIArchitect() {
    return (
        <div className="relative w-full h-full bg-[#0a0a0a] text-white overflow-hidden">
            {/* Data Particles */}
            {[...Array(50)].map((_, i) => (
                <div key={i} className="absolute rounded-full bg-purple-500/40 blur-sm"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        width: `${Math.random() * 4 + 1}px`,
                        height: `${Math.random() * 4 + 1}px`,
                        animation: `float ${Math.random() * 10 + 5}s infinite`
                    }}
                />
            ))}

            {/* Central UI */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div className="w-24 h-24 mb-8 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-ping" />
                    <div className="absolute inset-0 border-2 border-purple-500 rounded-full animate-[spin_10s_linear_infinite]" />
                    <Zap className="absolute inset-0 m-auto w-8 h-8 text-purple-400" />
                </div>

                <h1 className="text-5xl font-mono font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                    AI ARCHITECT
                </h1>

                <div className="w-[600px] max-w-full bg-white/5 border border-white/10 rounded-xl p-2 flex items-center backdrop-blur-md">
                    <span className="text-purple-400 px-4 font-mono">{'>'}</span>
                    <input type="text" placeholder="Design a 2-week trip to Japan for a foodie..." className="bg-transparent w-full text-white placeholder-white/30 focus:outline-none font-mono py-2" />
                    <button className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-bold text-sm transition-colors">
                        GENERATE
                    </button>
                </div>
            </div>

            <style jsx>{`
         @keyframes float {
           0%, 100% { transform: translateY(0); opacity: 0.2; }
           50% { transform: translateY(-20px); opacity: 0.8; }
         }
       `}</style>
        </div>
    );
}

// 6. SPLIT DECISION
function SplitDecision() {
    return (
        <div className="relative w-full h-full flex font-sans">
            {/* Left: RELAX */}
            <div className="group relative w-1/2 h-full overflow-hidden transition-all duration-700 ease-in-out hover:w-[70%] z-10 hover:z-20 border-r border-white">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?q=80&w=2064&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"></div>
                <div className="absolute inset-0 bg-teal-900/30 group-hover:bg-teal-900/10 transition-colors"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <h2 className="text-6xl font-light tracking-widest uppercase mb-4">Relax</h2>
                    <button className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 bg-white text-teal-900 px-8 py-3 rounded-full font-bold">Unwind Here</button>
                </div>
            </div>

            {/* Right: ADVENTURE */}
            <div className="group relative w-1/2 h-full overflow-hidden transition-all duration-700 ease-in-out hover:w-[70%] z-10 hover:z-20">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519904981063-b0cf448d479e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"></div>
                <div className="absolute inset-0 bg-orange-900/30 group-hover:bg-orange-900/10 transition-colors"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <h2 className="text-6xl font-black italic tracking-tighter uppercase mb-4">Thrill</h2>
                    <button className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 bg-white text-orange-900 px-8 py-3 rounded-full font-bold">Start Exploring</button>
                </div>
            </div>

            {/* Center Divider Text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black font-bold border-4 border-black/10">OR</div>
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

// 8. PARALLAX HORIZON
function ParallaxHorizon() {
    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 500], [0, 200]);

    return (
        <div className="relative w-full h-full bg-gradient-to-b from-[#2a2d4a] to-[#6d5b7a] overflow-hidden flex items-end justify-center">
            {/* Stars */}
            <div className="absolute inset-0 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>

            <div className="absolute top-30 text-center z-10 w-full mt-32">
                <h1 className="text-white text-8xl font-serif tracking-widest opacity-80 mix-blend-overlay">HORIZON</h1>
            </div>

            {/* Layer 3: Back Mountains */}
            <div className="absolute bottom-60 left-0 w-full h-[300px] bg-[#3e3b5e] rounded-[100%] scale-150 translate-y-10 opacity-80" />

            {/* Layer 2: Mid Hills */}
            <div className="absolute bottom-20 left- -20 w-[120%] h-[200px] bg-[#6d5b7a] rounded-[100%] rotate-3 opacity-90" />

            {/* Layer 1: Foreground */}
            <div className="absolute -bottom-20 left-0 w-full h-[250px] bg-[#1a1c2e] rounded-[50%_50%_0_0/20%] z-20" />

            {/* Character/Element */}
            <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30">
                <div className="w-4 h-8 bg-black rounded-t-full relative">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rounded-full" />
                </div>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 text-white/50 text-xs font-mono uppercase tracking-widest animate-bounce">
                Scroll to explore
            </div>
        </div>
    );
}

// 9. GLASSMORPHISM
function Glassmorphism() {
    return (
        <div className="relative w-full h-full bg-white overflow-hidden flex items-center justify-center">
            {/* Animated Gradient Mesh */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-indigo-200 to-cyan-200 animate-[pulse_10s_ease-in-out_infinite]" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-[float_6s_infinite]" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-yellow-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-[float_8s_infinite_reverse]" />

            {/* Glass Card */}
            <div className="relative z-10 w-[800px] h-[500px] bg-white/30 backdrop-blur-xl border border-white/40 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-12 flex">
                <div className="w-1/2 pr-8 flex flex-col justify-center">
                    <h1 className="text-4xl font-bold text-slate-800 mb-6">Crystal Clear Planning</h1>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        Experience travel planning with absolute clarity. Our transparent pricing and itinerary building lets you see the world like never before.
                    </p>
                    <button className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold self-start hover:bg-black transition-colors shadow-lg">
                        Get Started
                    </button>
                </div>
                <div className="w-1/2 relative">
                    {/* Floating UI Elements */}
                    <div className="absolute top-10 right-10 w-48 h-64 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg rotate-6 animate-[float_5s_infinite_ease-in-out]">
                        <div className="h-32 bg-slate-200/50 rounded-t-2xl mb-4" />
                        <div className="px-4 space-y-2">
                            <div className="h-2 bg-slate-800/20 rounded w-full" />
                            <div className="h-2 bg-slate-800/20 rounded w-2/3" />
                        </div>
                    </div>
                    <div className="absolute bottom-10 left-10 w-56 h-32 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg -rotate-3 flex items-center justify-center">
                        <span className="text-4xl">✈️</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 10. CYBER TERMINAL
function CyberTerminal() {
    return (
        <div className="relative w-full h-full bg-black font-mono text-green-500 overflow-hidden p-10 flex flex-col">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-20 opacity-20"></div>
            <div className="absolute inset-0 bg-green-500/5 z-0 animate-pulse"></div>

            <header className="flex justify-between border-b border-green-500/30 pb-4 mb-10 z-10">
                <div>WANDR_OS v4.2</div>
                <div>EST. CONNECT: 100%</div>
            </header>

            <main className="flex-1 z-10 w-full max-w-4xl mx-auto">
                <div className="mb-4">
                    <span className="text-green-300">root@wandr:~$</span> <span className="animate-[type_3s_steps(20)_forwards]">initiate_protocol --trip="adventure"</span>
                </div>
                <div className="p-6 border border-green-500/30 bg-black/80 rounded-sm">
                    <div className="mb-2 text-green-400">{'>'} SCANNING GLOBAL DATABASE...</div>
                    <div className="mb-2 text-green-400">{'>'} 14,203 LOCATIONS FOUND</div>
                    <div className="mb-6 text-green-400">{'>'} OPTIMIZING ROUTE... <span className="animate-pulse">DONE</span></div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="border border-green-500/50 p-4 hover:bg-green-500/10 cursor-pointer transition-colors">
                            <h3 className="font-bold mb-2">[01] TOKYO_NEO</h3>
                            <div className="h-2 bg-green-900 w-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[90%]"></div>
                            </div>
                        </div>
                        <div className="border border-green-500/50 p-4 hover:bg-green-500/10 cursor-pointer transition-colors">
                            <h3 className="font-bold mb-2">[02] BERLIN_UNDERG</h3>
                            <div className="h-2 bg-green-900 w-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[75%]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="z-10 text-xs text-green-700 mt-10">
                SYSTEM_ID: WDR-992-X // TERMINAL_ACTIVE
            </footer>
        </div>
    );
}
