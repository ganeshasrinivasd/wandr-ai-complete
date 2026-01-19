import React, { useEffect } from 'react';
import { Compass } from 'lucide-react';

interface BackgroundDecorationsProps {
    theme: string;
}

export default function BackgroundDecorations({ theme }: BackgroundDecorationsProps) {
    // normalize theme - adding 'inventor'
    const currentTheme = ['collage', 'botanical', 'blueprint', 'inventor'].includes(theme) ? theme : 'inventor';

    // Interactive Compass Logic for Inventor Theme
    useEffect(() => {
        if (currentTheme !== 'inventor') return;

        const handleMouseMove = (e: MouseEvent) => {
            const compass = document.getElementById('daVinciCompass');
            if (compass) {
                const rect = compass.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                compass.style.transform = `rotate(${angle + 90}deg)`;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [currentTheme]);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">

            {/* =========================================================================
          THEME: ECLECTIC (The original "Mixture")
          ========================================================================= */}
            {currentTheme === 'eclectic' && (
                <>
                    {/* WORLD WONDER: Pyramids Sketch (Top Left) */}
                    <div className="absolute top-24 left-10 opacity-[0.08] -rotate-6 mix-blend-multiply">
                        <svg className="w-48 h-32 text-ink" viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M20 100 L70 20 L120 100 Z" strokeDasharray="2 1" />
                            <path d="M90 100 L120 50 L150 100 Z" strokeDasharray="1 1" />
                            <path d="M10 110 L190 110" strokeWidth="0.5" />
                            <text x="70" y="118" fontSize="6" fontFamily="serif" textAnchor="middle" fill="currentColor" stroke="none">GIZA</text>
                        </svg>
                    </div>

                    {/* NATURE: Botanist's Fern (Top Right) */}
                    <div className="absolute top-10 right-0 opacity-[0.06] rotate-12">
                        <svg className="w-64 h-64 text-green-900" viewBox="0 0 100 100" fill="currentColor">
                            <path d="M50 100 C 50 100, 80 50, 50 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 20 L60 25 L50 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 30 L40 35 L50 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 40 L65 45 L50 50" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 50 L35 55 L50 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 60 L70 65 L50 70" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 70 L30 75 L50 80" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <path d="M50 80 L65 85 L50 90" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <text x="75" y="40" fontSize="4" fontFamily="serif" fontStyle="italic" fill="currentColor" stroke="none">Pteridophyta</text>
                        </svg>
                    </div>

                    {/* URBAN: Subway Map (Mid Left) */}
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-[0.05]">
                        <svg className="w-96 h-64 text-ink" viewBox="0 0 300 200" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M0 100 L50 100 L80 150 L150 150 L180 100 L250 100" strokeDasharray="10 2" />
                            <circle cx="50" cy="100" r="4" fill="currentColor" stroke="none" />
                            <circle cx="80" cy="150" r="4" fill="currentColor" stroke="none" />
                            <circle cx="150" cy="150" r="4" fill="currentColor" stroke="white" strokeWidth="2" />
                            <circle cx="180" cy="100" r="4" fill="currentColor" stroke="none" />
                            <text x="150" y="165" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="bold">CENTRAL STN</text>
                        </svg>
                    </div>

                    {/* WORLD WONDER: Eiffel Tower (Bottom Right) */}
                    <div className="absolute bottom-10 right-10 opacity-[0.07] rotate-[-5deg]">
                        <svg className="w-40 h-64 text-ink" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M30 180 L50 20 L70 180" />
                            <path d="M40 100 L60 100" />
                            <path d="M35 140 L65 140" />
                            <path d="M30 180 Q 50 140 70 180" fill="none" />
                            <text x="80" y="170" fontSize="12" fontFamily="hand" fill="currentColor" stroke="none" className="font-hand">Paris '24</text>
                        </svg>
                    </div>

                    {/* NAUTICAL: Compass (Bottom Left) */}
                    <div className="absolute bottom-20 left-16 opacity-[0.08] rotate-[15deg]">
                        <Compass className="w-32 h-32 text-leather" strokeWidth={1} style={{ filter: 'sepia(1)' }} />
                        <div className="absolute -top-4 -right-4 w-20 h-20 border-2 border-dashed border-ink rounded-full flex items-center justify-center -rotate-12">
                            <span className="text-[10px] font-typewriter font-bold text-ink">PORT OF ENTRY</span>
                        </div>
                    </div>
                </>
            )}

            {/* =========================================================================
          THEME: COLLAGE - HIGH VISIBILITY (Dense, "Messy Desk")
          Opacity Range: 0.20 - 0.35
          ========================================================================= */}
            {currentTheme === 'collage' && (
                <>
                    {/* Warm aged paper texture overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-100/20 via-transparent to-orange-100/15"></div>

                    {/* ===== TOP LEFT: Large vintage letter ===== */}
                    <div className="absolute -top-5 -left-5 w-[420px] h-[300px] bg-[#f5f0e6] border-2 border-[#8B4513]/30 shadow-xl rotate-[8deg] p-8 opacity-[0.30]">
                        <div className="border-b-2 border-[#8B4513]/40 pb-3 mb-4 font-hand text-xl text-[#5C4033]">My Dearest Friend,</div>
                        <div className="space-y-3">
                            <div className="h-2 bg-[#5C4033]/25 w-full rounded"></div>
                            <div className="h-2 bg-[#5C4033]/20 w-[90%] rounded"></div>
                            <div className="h-2 bg-[#5C4033]/20 w-[85%] rounded"></div>
                            <div className="h-2 bg-[#5C4033]/15 w-[70%] rounded"></div>
                            <div className="h-2 bg-[#5C4033]/15 w-[60%] rounded"></div>
                        </div>
                        <div className="absolute bottom-6 right-8 font-hand text-lg text-[#5C4033]/60 italic">Yours truly,</div>
                    </div>

                    {/* ===== TOP RIGHT: Bold Air Mail Stamp ===== */}
                    <div className="absolute top-8 right-8 opacity-[0.40]">
                        <div className="w-36 h-44 border-[6px] border-dashed border-red-700 rounded-md p-3 rotate-[-6deg] bg-[#fff8f0] shadow-lg relative">
                            <span className="absolute top-2 left-2 text-[10px] font-mono text-red-700 font-bold tracking-wider">PAR AVION</span>
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <span className="text-5xl">✈️</span>
                                <span className="text-red-800 font-bold text-sm mt-2 tracking-widest">AIR MAIL</span>
                            </div>
                            <span className="absolute bottom-1 right-2 text-[8px] font-mono text-red-700/80">0.75</span>
                        </div>
                    </div>

                    {/* ===== TOP RIGHT: Circular Postmark ===== */}
                    <div className="absolute top-40 right-48 opacity-[0.35]">
                        <div className="w-28 h-28 rounded-full border-4 border-[#1a365d] flex flex-col items-center justify-center rotate-[-15deg] relative">
                            <div className="absolute inset-2 rounded-full border-2 border-[#1a365d]/50"></div>
                            <span className="text-xs font-typewriter font-bold text-[#1a365d] tracking-wider">LONDON</span>
                            <span className="text-[10px] font-mono text-[#1a365d]/80 mt-1">12 OCT 1962</span>
                            <div className="absolute w-full h-[2px] bg-[#1a365d]/40 top-1/2 -rotate-45"></div>
                        </div>
                    </div>

                    {/* ===== MIDDLE LEFT: Large boarding pass ===== */}
                    <div className="absolute top-1/2 -left-24 -translate-y-1/2 w-[550px] h-44 bg-[#fffdf7] border-2 border-[#4a3728] rotate-[-12deg] shadow-2xl flex opacity-[0.28]">
                        <div className="w-20 h-full bg-[#8B4513]/30 border-r-4 border-dashed border-[#4a3728]/50 flex items-center justify-center">
                            <span className="text-4xl rotate-90 font-bold text-[#4a3728]/60">✂</span>
                        </div>
                        <div className="flex-1 p-5">
                            <div className="text-sm font-mono text-[#4a3728]/70 uppercase tracking-[0.3em] mb-1">White Star Line</div>
                            <div className="text-4xl font-serif text-[#4a3728] font-bold tracking-wide">RMS TITANIC</div>
                            <div className="flex gap-12 mt-5">
                                <div>
                                    <div className="text-[10px] uppercase text-[#4a3728]/50 tracking-wider">From</div>
                                    <div className="font-typewriter text-lg text-[#4a3728]">Southampton</div>
                                </div>
                                <div className="text-2xl text-[#4a3728]/30">→</div>
                                <div>
                                    <div className="text-[10px] uppercase text-[#4a3728]/50 tracking-wider">To</div>
                                    <div className="font-typewriter text-lg text-[#4a3728]">New York</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-[#4a3728]/50 tracking-wider">Class</div>
                                    <div className="font-typewriter text-lg text-[#4a3728]">1st</div>
                                </div>
                            </div>
                        </div>
                        <div className="w-24 h-full border-l-4 border-dashed border-[#4a3728]/30 flex items-center justify-center">
                            <span className="text-[#4a3728]/40 font-mono text-xs rotate-90 tracking-widest">ADMIT ONE</span>
                        </div>
                    </div>

                    {/* ===== BOTTOM RIGHT: Polaroid Photo ===== */}
                    <div className="absolute bottom-12 right-16 rotate-[8deg] opacity-[0.32]">
                        <div className="w-56 h-64 bg-white p-3 pb-10 shadow-2xl">
                            <div className="w-full h-40 bg-gradient-to-br from-amber-200 to-orange-300 grayscale contrast-125 flex items-center justify-center overflow-hidden">
                                <svg className="w-full h-full text-amber-600/50" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
                                    <path d="M0 90 L25 50 L50 70 L75 30 L100 60 L100 100 L0 100 Z" fill="currentColor" />
                                    <circle cx="75" cy="25" r="12" fill="currentColor" opacity="0.7" />
                                </svg>
                            </div>
                            <div className="mt-3 text-center font-hand text-xl text-[#4a3728]">Summer '84</div>
                        </div>
                    </div>

                    {/* ===== BOTTOM LEFT: Second stamp ===== */}
                    <div className="absolute bottom-20 left-32 opacity-[0.35]">
                        <div className="w-24 h-28 border-4 border-[#1e40af] rounded-sm p-2 rotate-[12deg] bg-[#f0f4ff]">
                            <div className="w-full h-full border-2 border-[#1e40af]/30 flex flex-col items-center justify-center">
                                <span className="text-3xl">🗽</span>
                                <span className="text-[8px] font-mono text-[#1e40af] font-bold mt-1">USA 32c</span>
                            </div>
                        </div>
                    </div>

                    {/* ===== Decorative text watermark ===== */}
                    <div className="absolute top-1/3 right-1/4 text-7xl opacity-[0.08] font-serif italic text-[#4a3728] rotate-[-25deg] pointer-events-none select-none tracking-widest">
                        Wanderlust
                    </div>

                    {/* ========== 7 WONDERS OF THE WORLD ========== */}

                    {/* 1. TAJ MAHAL - Top Center */}
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 opacity-[0.12]">
                        <svg className="w-40 h-32 text-[#4a3728]" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Main dome */}
                            <ellipse cx="50" cy="25" rx="18" ry="20" />
                            <path d="M50 5 L50 0" strokeWidth="1" /> {/* Spire */}
                            {/* Main building */}
                            <rect x="30" y="40" width="40" height="30" />
                            <path d="M32 40 L50 25 L68 40" /> {/* Dome connection */}
                            {/* Minarets */}
                            <rect x="10" y="25" width="6" height="45" />
                            <ellipse cx="13" cy="23" rx="4" ry="5" />
                            <rect x="84" y="25" width="6" height="45" />
                            <ellipse cx="87" cy="23" rx="4" ry="5" />
                            {/* Arches */}
                            <path d="M42 70 Q 45 55 50 55 Q 55 55 58 70" />
                            <text x="50" y="78" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">AGRA, INDIA</text>
                        </svg>
                    </div>

                    {/* 2. COLOSSEUM - Right Side Mid */}
                    <div className="absolute top-1/3 right-6 opacity-[0.10] rotate-[5deg]">
                        <svg className="w-36 h-28 text-[#8B4513]" viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Elliptical structure */}
                            <ellipse cx="50" cy="35" rx="45" ry="25" />
                            <ellipse cx="50" cy="35" rx="38" ry="20" />
                            {/* Arches - top tier */}
                            {[15, 27, 39, 51, 63, 75, 85].map((x, i) => (
                                <path key={`arch-${i}`} d={`M${x - 4} 22 Q ${x} 15 ${x + 4} 22`} />
                            ))}
                            {/* Arches - bottom tier */}
                            {[12, 25, 38, 50, 62, 75, 88].map((x, i) => (
                                <path key={`arch2-${i}`} d={`M${x - 5} 45 Q ${x} 36 ${x + 5} 45`} />
                            ))}
                            <text x="50" y="65" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">ROMA</text>
                        </svg>
                    </div>

                    {/* 3. CHRIST THE REDEEMER - Bottom Center-Left */}
                    <div className="absolute bottom-32 left-1/4 opacity-[0.12] rotate-[-3deg]">
                        <svg className="w-24 h-40 text-[#5C4033]" viewBox="0 0 60 100" fill="none" stroke="currentColor" strokeWidth="1">
                            {/* Head */}
                            <circle cx="30" cy="12" r="8" />
                            {/* Arms outstretched */}
                            <path d="M0 35 L30 30 L60 35" strokeWidth="1.5" />
                            {/* Body/Robe */}
                            <path d="M22 20 L30 30 L38 20" />
                            <path d="M20 30 L30 85 L40 30" />
                            <path d="M25 85 L30 90 L35 85" />
                            {/* Mountain base */}
                            <path d="M10 95 Q 30 75 50 95" strokeDasharray="2 1" />
                            <text x="30" y="98" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">RIO</text>
                        </svg>
                    </div>

                    {/* 4. GREAT WALL OF CHINA - Top Left Corner */}
                    <div className="absolute top-40 left-8 opacity-[0.10]">
                        <svg className="w-48 h-24 text-[#6B4423]" viewBox="0 0 120 50" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Winding wall path */}
                            <path d="M0 40 Q 15 30 30 35 Q 45 40 60 25 Q 75 10 90 20 Q 105 30 120 15" strokeWidth="3" />
                            {/* Towers */}
                            <rect x="28" y="28" width="8" height="12" />
                            <path d="M26 28 L32 22 L38 28" />
                            <rect x="58" y="18" width="8" height="12" />
                            <path d="M56 18 L62 12 L68 18" />
                            <rect x="88" y="13" width="8" height="12" />
                            <path d="M86 13 L92 7 L98 13" />
                            <text x="60" y="48" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">万里长城</text>
                        </svg>
                    </div>

                    {/* 5. MACHU PICCHU - Bottom Right Area */}
                    <div className="absolute bottom-48 right-1/3 opacity-[0.10] rotate-[3deg]">
                        <svg className="w-44 h-28 text-[#5D4E37]" viewBox="0 0 110 70" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Mountain backdrop */}
                            <path d="M0 60 L30 20 L50 45 L80 10 L110 50" strokeDasharray="3 1" />
                            {/* Terraces */}
                            <path d="M20 55 L40 55 L40 50 L55 50 L55 45 L70 45" />
                            <path d="M25 60 L45 60 L45 55 L60 55" />
                            {/* Stone structures */}
                            <rect x="42" y="40" width="8" height="10" />
                            <rect x="52" y="38" width="6" height="12" />
                            <rect x="60" y="42" width="7" height="8" />
                            <text x="55" y="68" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">PERÚ</text>
                        </svg>
                    </div>

                    {/* 6. PETRA - Left Side Lower */}
                    <div className="absolute bottom-1/4 left-20 opacity-[0.11] rotate-[-5deg]">
                        <svg className="w-32 h-40 text-[#A0522D]" viewBox="0 0 80 100" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Treasury facade carved in rock */}
                            <path d="M10 95 L10 20 Q 40 5 70 20 L70 95" /> {/* Rock frame */}
                            {/* Columns */}
                            <rect x="20" y="40" width="5" height="45" />
                            <rect x="30" y="40" width="5" height="45" />
                            <rect x="45" y="40" width="5" height="45" />
                            <rect x="55" y="40" width="5" height="45" />
                            {/* Pediment */}
                            <path d="M15 40 L40 20 L65 40" />
                            <circle cx="40" cy="30" r="6" />
                            {/* Door */}
                            <path d="M35 85 L35 60 Q 40 55 45 60 L45 85" />
                            <text x="40" y="95" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">JORDAN</text>
                        </svg>
                    </div>

                    {/* 7. CHICHEN ITZA - Right side upper area */}
                    <div className="absolute top-1/4 right-1/4 opacity-[0.10]">
                        <svg className="w-32 h-36 text-[#8B7355]" viewBox="0 0 80 90" fill="none" stroke="currentColor" strokeWidth="0.8">
                            {/* Pyramid steps */}
                            <path d="M5 80 L15 80 L15 70 L25 70 L25 60 L35 60 L35 50 L45 50 L45 60 L55 60 L55 70 L65 70 L65 80 L75 80" />
                            {/* Temple on top */}
                            <rect x="35" y="35" width="10" height="15" />
                            <path d="M33 35 L40 25 L47 35" />
                            {/* Steps detail */}
                            <line x1="40" y1="50" x2="40" y2="80" strokeDasharray="2 2" />
                            <text x="40" y="88" fontSize="4" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="serif">MÉXICO</text>
                        </svg>
                    </div>
                </>
            )}

            {/* =========================================================================
          THEME: BOTANICAL - HIGH VISIBILITY (Overgrown Garden)
          Opacity Range: 0.18 - 0.30
          ========================================================================= */}
            {currentTheme === 'botanical' && (
                <>
                    {/* Soft green tint overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-100/15 via-transparent to-emerald-100/10"></div>

                    {/* ===== LEFT: Giant Monstera/Fern Cluster ===== */}
                    <div className="absolute bottom-0 -left-20 opacity-[0.25] pointer-events-none">
                        <svg className="w-[700px] h-[900px]" viewBox="0 0 150 200" fill="none">
                            {/* Main stem */}
                            <path d="M75 200 Q 50 150 80 50" stroke="#2d5016" strokeWidth="3" fill="none" />
                            {/* Large fern fronds - left side */}
                            <path d="M75 180 Q 20 170 10 150" stroke="#3d6b1f" strokeWidth="2" fill="none" />
                            <path d="M73 160 Q 15 145 5 120" stroke="#4a7c2a" strokeWidth="2" fill="none" />
                            <path d="M74 140 Q 25 125 15 95" stroke="#3d6b1f" strokeWidth="2" fill="none" />
                            <path d="M76 120 Q 30 100 20 70" stroke="#2d5016" strokeWidth="2" fill="none" />
                            <path d="M78 100 Q 35 80 25 50" stroke="#4a7c2a" strokeWidth="2" fill="none" />
                            <path d="M80 80 Q 45 60 35 35" stroke="#3d6b1f" strokeWidth="2" fill="none" />
                            {/* Large fern fronds - right side */}
                            <path d="M77 175 Q 120 165 135 140" stroke="#4a7c2a" strokeWidth="2" fill="none" />
                            <path d="M76 155 Q 125 140 140 110" stroke="#3d6b1f" strokeWidth="2" fill="none" />
                            <path d="M77 135 Q 130 115 145 85" stroke="#2d5016" strokeWidth="2" fill="none" />
                            <path d="M78 115 Q 125 95 140 65" stroke="#4a7c2a" strokeWidth="2" fill="none" />
                            <path d="M80 95 Q 120 75 130 50" stroke="#3d6b1f" strokeWidth="2" fill="none" />
                            {/* Small leaflets */}
                            {[...Array(12)].map((_, i) => (
                                <ellipse key={`leaf-l-${i}`} cx={20 + i * 3} cy={160 - i * 10} rx="8" ry="4"
                                    fill="#4a7c2a" transform={`rotate(${-30 + i * 5} ${20 + i * 3} ${160 - i * 10})`} opacity="0.6" />
                            ))}
                            {[...Array(12)].map((_, i) => (
                                <ellipse key={`leaf-r-${i}`} cx={130 - i * 3} cy={155 - i * 10} rx="8" ry="4"
                                    fill="#3d6b1f" transform={`rotate(${30 - i * 5} ${130 - i * 3} ${155 - i * 10})`} opacity="0.6" />
                            ))}
                        </svg>
                    </div>

                    {/* ===== TOP RIGHT: Large botanical flower ===== */}
                    <div className="absolute -top-32 -right-32 opacity-[0.22]">
                        <svg className="w-[600px] h-[600px]" viewBox="0 0 100 100" fill="none">
                            {/* Flower center */}
                            <circle cx="50" cy="50" r="12" fill="#854d0e" opacity="0.8" />
                            <circle cx="50" cy="50" r="8" fill="#a16207" opacity="0.9" />
                            {/* Petals */}
                            {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((rot) => (
                                <ellipse key={rot} cx="50" cy="22" rx="12" ry="22"
                                    fill="#dc2626" transform={`rotate(${rot} 50 50)`} opacity="0.5" />
                            ))}
                            {/* Inner petals */}
                            {[20, 60, 100, 140, 180, 220, 260, 300, 340].map((rot) => (
                                <ellipse key={`inner-${rot}`} cx="50" cy="28" rx="8" ry="16"
                                    fill="#f87171" transform={`rotate(${rot} 50 50)`} opacity="0.4" />
                            ))}
                        </svg>
                    </div>

                    {/* ===== Flying Butterflies ===== */}
                    <div className="absolute top-1/4 left-1/3 opacity-[0.30]">
                        <svg className="w-32 h-24" viewBox="0 0 60 40" fill="none">
                            <ellipse cx="15" cy="20" rx="12" ry="15" fill="#7c3aed" opacity="0.7" />
                            <ellipse cx="45" cy="20" rx="12" ry="15" fill="#7c3aed" opacity="0.7" />
                            <ellipse cx="20" cy="28" rx="6" ry="10" fill="#a78bfa" opacity="0.6" />
                            <ellipse cx="40" cy="28" rx="6" ry="10" fill="#a78bfa" opacity="0.6" />
                            <ellipse cx="30" cy="20" rx="3" ry="12" fill="#4c1d95" />
                            <circle cx="30" cy="8" r="3" fill="#4c1d95" />
                            <path d="M28 5 Q 25 0 22 2" stroke="#4c1d95" strokeWidth="1" fill="none" />
                            <path d="M32 5 Q 35 0 38 2" stroke="#4c1d95" strokeWidth="1" fill="none" />
                        </svg>
                    </div>
                    <div className="absolute bottom-1/4 right-1/4 opacity-[0.25] rotate-[20deg]">
                        <svg className="w-24 h-18" viewBox="0 0 60 40" fill="none">
                            <ellipse cx="15" cy="20" rx="10" ry="12" fill="#ea580c" opacity="0.7" />
                            <ellipse cx="45" cy="20" rx="10" ry="12" fill="#ea580c" opacity="0.7" />
                            <ellipse cx="19" cy="26" rx="5" ry="8" fill="#fdba74" opacity="0.6" />
                            <ellipse cx="41" cy="26" rx="5" ry="8" fill="#fdba74" opacity="0.6" />
                            <ellipse cx="30" cy="20" rx="2" ry="10" fill="#7c2d12" />
                            <circle cx="30" cy="10" r="2" fill="#7c2d12" />
                        </svg>
                    </div>

                    {/* ===== BOTTOM RIGHT: Botanical notes ===== */}
                    <div className="absolute bottom-20 right-10 opacity-[0.20] rotate-[-8deg]">
                        <div className="w-64 h-80 bg-[#fefce8] border-2 border-[#4a7c2a]/30 p-4 shadow-lg">
                            <div className="text-[10px] font-mono text-[#4a7c2a]/70 uppercase tracking-widest mb-2">Field Notes</div>
                            <div className="border-b border-[#4a7c2a]/20 pb-2 mb-3">
                                <span className="font-serif italic text-[#2d5016] text-lg">Pteridophyta</span>
                            </div>
                            <svg className="w-48 h-32 mx-auto" viewBox="0 0 80 60" fill="none" stroke="#4a7c2a" strokeWidth="1">
                                <path d="M40 55 Q 35 30 40 5" />
                                <path d="M40 50 L30 45 M40 45 L50 40 M40 40 L25 35 M40 35 L55 30 M40 30 L28 25 M40 25 L52 20 M40 20 L32 15 M40 15 L48 10" />
                            </svg>
                            <div className="mt-4 text-[8px] text-[#4a7c2a]/60">Collected: Amazonia, 1847</div>
                        </div>
                    </div>

                    {/* ===== Scattered leaves overlay ===== */}
                    <div className="absolute top-20 right-1/3 opacity-[0.18] rotate-45">
                        <svg className="w-20 h-40" viewBox="0 0 30 60" fill="#4a7c2a">
                            <path d="M15 0 Q 30 30 15 60 Q 0 30 15 0" />
                            <path d="M15 10 L15 55" stroke="#2d5016" strokeWidth="1" fill="none" />
                        </svg>
                    </div>
                    <div className="absolute bottom-40 left-1/3 opacity-[0.15] -rotate-30">
                        <svg className="w-16 h-32" viewBox="0 0 30 60" fill="#3d6b1f">
                            <path d="M15 0 Q 30 30 15 60 Q 0 30 15 0" />
                        </svg>
                    </div>
                </>
            )}


            {/* =========================================================================
          THEME: BLUEPRINT - HIGH VISIBILITY (Technical Schematic)
          Opacity Range: 0.15 - 0.25
          Color: Technical Blue #3b82f6
          ========================================================================= */}
            {currentTheme === 'blueprint' && (
                <>
                    {/* Blueprint blue tint background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/25 via-blue-50/10 to-slate-100/20"></div>

                    {/* ===== Prominent Grid Pattern ===== */}
                    <div className="absolute inset-0"
                        style={{
                            backgroundImage: `
                                linear-gradient(#3b82f6 1px, transparent 1px),
                                linear-gradient(90deg, #3b82f6 1px, transparent 1px)
                            `,
                            backgroundSize: '40px 40px',
                            opacity: 0.12
                        }}>
                    </div>

                    {/* ===== Center Crosshairs & Circle ===== */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.15] pointer-events-none">
                        <div className="absolute top-[-50vh] bottom-[-50vh] left-1/2 -translate-x-1/2 w-[2px] bg-blue-600"></div>
                        <div className="absolute left-[-50vw] right-[-50vw] top-1/2 -translate-y-1/2 h-[2px] bg-blue-600"></div>
                        <div className="w-[500px] h-[500px] border-2 border-blue-600 rounded-full -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2"></div>
                        <div className="w-[300px] h-[300px] border border-blue-600/50 rounded-full -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2" style={{ borderStyle: 'dashed' }}></div>
                    </div>

                    {/* ===== TOP LEFT: Technical Elevation Drawing ===== */}
                    <div className="absolute top-16 left-12 opacity-[0.22]">
                        <div className="text-sm font-mono tracking-[0.2em] mb-2 text-blue-800 font-bold">ELEVATION A-1</div>
                        <svg className="w-80 h-56 text-blue-700" viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                            {/* Building outline */}
                            <rect x="15" y="25" width="90" height="65" />
                            {/* Roof */}
                            <path d="M15 25 L60 5 L105 25" />
                            {/* Floor lines */}
                            <line x1="15" y1="45" x2="105" y2="45" strokeDasharray="4 2" />
                            <line x1="15" y1="65" x2="105" y2="65" strokeDasharray="4 2" />
                            {/* Windows */}
                            <rect x="25" y="30" width="12" height="10" />
                            <rect x="45" y="30" width="12" height="10" />
                            <rect x="65" y="30" width="12" height="10" />
                            <rect x="85" y="30" width="12" height="10" />
                            <rect x="25" y="50" width="12" height="10" />
                            <rect x="45" y="50" width="12" height="10" />
                            <rect x="65" y="50" width="12" height="10" />
                            <rect x="85" y="50" width="12" height="10" />
                            {/* Door */}
                            <rect x="50" y="70" width="20" height="20" />
                            <circle cx="67" cy="80" r="1.5" fill="currentColor" />
                            {/* Dimension lines */}
                            <line x1="10" y1="25" x2="10" y2="90" strokeWidth="0.5" />
                            <line x1="8" y1="25" x2="12" y2="25" strokeWidth="0.5" />
                            <line x1="8" y1="90" x2="12" y2="90" strokeWidth="0.5" />
                            <text x="5" y="60" fontSize="5" fill="currentColor" stroke="none" transform="rotate(-90 5 60)">12.5m</text>
                            {/* Scale */}
                            <text x="60" y="98" fontSize="5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="bold">SCALE 1:100</text>
                        </svg>
                    </div>

                    {/* ===== BOTTOM RIGHT: Compass Rose / Navigation ===== */}
                    <div className="absolute bottom-16 right-16 opacity-[0.20]">
                        <svg className="w-72 h-72 text-blue-700" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
                            {/* Outer circles */}
                            <circle cx="50" cy="50" r="45" strokeWidth="2" />
                            <circle cx="50" cy="50" r="40" strokeDasharray="6 3" />
                            <circle cx="50" cy="50" r="30" strokeWidth="0.5" />
                            {/* Cardinal directions */}
                            <path d="M50 5 L50 20" strokeWidth="2" />
                            <path d="M50 80 L50 95" strokeWidth="2" />
                            <path d="M5 50 L20 50" strokeWidth="2" />
                            <path d="M80 50 L95 50" strokeWidth="2" />
                            {/* Compass points */}
                            <polygon points="50,10 47,25 50,20 53,25" fill="currentColor" />
                            <polygon points="50,90 47,75 50,80 53,75" fill="currentColor" opacity="0.5" />
                            {/* Direction labels */}
                            <text x="50" y="4" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="bold">N</text>
                            <text x="50" y="100" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">S</text>
                            <text x="2" y="52" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">W</text>
                            <text x="98" y="52" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">E</text>
                            {/* Azimuth lines */}
                            <line x1="50" y1="50" x2="85" y2="25" strokeDasharray="2 2" />
                            <text x="88" y="22" fontSize="4" fill="currentColor" stroke="none" fontFamily="monospace">AZ 42°</text>
                        </svg>
                    </div>

                    {/* ===== LEFT: Measurement ruler ===== */}
                    <div className="absolute left-8 top-1/4 bottom-1/4 opacity-[0.18]">
                        <div className="h-full w-6 border-l-2 border-blue-700 relative">
                            <div className="absolute top-0 left-0 w-4 h-[2px] bg-blue-700"></div>
                            <div className="absolute top-1/4 left-0 w-3 h-[1px] bg-blue-700"></div>
                            <div className="absolute top-1/2 left-0 w-4 h-[2px] bg-blue-700"></div>
                            <div className="absolute top-3/4 left-0 w-3 h-[1px] bg-blue-700"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-[2px] bg-blue-700"></div>
                            <span className="absolute top-1/2 -left-1 -translate-y-1/2 text-xs font-mono text-blue-800 -rotate-90 origin-center whitespace-nowrap tracking-widest">3200 MM</span>
                        </div>
                    </div>

                    {/* ===== RIGHT: Technical notes box ===== */}
                    <div className="absolute top-1/3 right-8 opacity-[0.18]">
                        <div className="w-48 border-2 border-blue-700 p-3 bg-blue-50/50">
                            <div className="text-[8px] font-mono text-blue-800 uppercase tracking-widest border-b border-blue-700/50 pb-1 mb-2">REV. NOTES</div>
                            <div className="space-y-1 text-[7px] font-mono text-blue-700">
                                <div>A - INITIAL LAYOUT</div>
                                <div>B - STRUCTURAL REVIEW</div>
                                <div>C - FINAL APPROVAL</div>
                            </div>
                            <div className="mt-3 pt-2 border-t border-blue-700/50 text-[6px] font-mono text-blue-600">
                                DWG NO: WDR-2024-001
                            </div>
                        </div>
                    </div>

                    {/* ===== Coordinate markers in corners ===== */}
                    <div className="absolute top-4 left-4 opacity-[0.20]">
                        <div className="flex items-center gap-1">
                            <div className="w-4 h-4 border border-blue-700 flex items-center justify-center">
                                <div className="w-1 h-1 bg-blue-700 rounded-full"></div>
                            </div>
                            <span className="text-[8px] font-mono text-blue-800">(0,0)</span>
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-[0.20]">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-mono text-blue-800">(MAX, MAX)</span>
                            <div className="w-4 h-4 border border-blue-700 flex items-center justify-center">
                                <div className="w-1 h-1 bg-blue-700 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* =========================================================================
            THEME: INVENTOR (WANDR: REMASTERED)
            New catchy features: Ornithopter, Living Map, Interactive Compass
            ========================================================================= */}
            {currentTheme === 'inventor' && (
                <>
                    {/* 1. PAPER TEXTURE & GRIDS (Full Background) */}
                    <div className="absolute inset-0 opacity-60 bg-[#e3dcd2] -z-20"></div>
                    <div className="absolute inset-0 opacity-60 mix-blend-multiply -z-10" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/aged-paper.png')` }}></div>
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{
                            backgroundImage: 'linear-gradient(#5a4838 1px, transparent 1px), linear-gradient(90deg, #5a4838 1px, transparent 1px)',
                            backgroundSize: '40px 40px'
                        }}></div>

                    {/* 2. LIVING MAP (Background) */}
                    <div className="absolute inset-0 z-0">
                        <svg className="w-full h-full opacity-30 mix-blend-multiply pointer-events-none">
                            <path d="M-20 150 Q 50 100 120 160 T 280 120 T 400 180" stroke="#5a4838" strokeWidth="2" fill="none" />
                            <path d="M200 300 Q 250 250 350 280" stroke="#5a4838" strokeWidth="2" fill="none" />
                            {/* Animated Path spanning the screen */}
                            <path d="M0 200 Q 400 100 800 250 T 1600 200" stroke="#8B4513" strokeWidth="2" strokeDasharray="10 10" fill="none" className="animate-[dash_60s_linear_infinite]" />
                        </svg>
                    </div>

                    {/* 3. FLAPPING ORNITHOPTER (Flying Machine) - Global Animation */}
                    <div className="absolute w-48 h-32 opacity-80 mix-blend-multiply animate-[flyAcross_20s_linear_infinite]" style={{ top: '15%', zIndex: 0 }}>
                        <svg viewBox="0 0 100 60" className="stroke-[#3e2b22] fill-none stroke-1">
                            <ellipse cx="50" cy="30" rx="15" ry="8" />
                            <path d="M35 30 L10 30 M65 30 L90 30" />
                            <path d="M50 30 Q 20 0 10 20" className="animate-[flapLeft_0.5s_ease-in-out_infinite_alternate]" />
                            <path d="M50 30 Q 80 0 90 20" className="animate-[flapRight_0.5s_ease-in-out_infinite_alternate]" />
                        </svg>
                    </div>

                    {/* 4. INTERACTIVE COMPASS (Positioned Bottom Right) */}
                    <div className="absolute bottom-16 right-16 w-32 h-32 pointer-events-auto z-10">
                        <div className="relative w-full h-full">
                            <div className="absolute inset-0 border-2 border-[#5a4838] rounded-full opacity-60"></div>
                            <div className="absolute inset-2 border border-[#5a4838] rounded-full border-dashed opacity-40"></div>
                            {/* Needle Container - Rotated globally via ID */}
                            <div id="daVinciCompass" className="absolute top-0 left-0 w-full h-full transition-transform duration-100 ease-out">
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-14 bg-[#8B4513]"></div>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-14 bg-[#5a4838]/50"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#5a4838] rounded-full border border-[#e3dcd2]"></div>
                            </div>
                            <span className="absolute top-[-5px] left-1/2 -translate-x-1/2 text-[10px] font-serif font-bold text-[#5a4838]">N</span>
                        </div>
                    </div>

                    {/* 5. HERO TEXT (Branding) */}
                    <div className="absolute bottom-16 left-16 z-0 pointer-events-none opacity-50">
                        <div className="relative">
                            <h2 className="text-6xl text-[#3e2b22] font-serif mb-2 tracking-wide drop-shadow-sm" style={{ fontFamily: 'Times New Roman, serif' }}>
                                WANDR
                            </h2>
                            <div className="text-[#8B4513] font-hand text-xl -rotate-6 bg-[#e3dcd2]/80 px-2 rounded-sm border border-[#5a4838]/20 inline-block shadow-sm">
                                Prototipo Nº 1
                            </div>
                        </div>
                        <p className="text-[#5a4838]/80 text-sm mt-4 font-mono tracking-widest uppercase">The Art of Exploration</p>
                    </div>

                    {/* 6. ROTATING GEARS (Corner Aesthetics) */}
                    <div className="absolute -top-20 -right-20 text-[#5a4838] opacity-10 animate-[spin_30s_linear_infinite]">
                        <svg width="400" height="400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M50 5 L50 15 M50 85 L50 95 M5 50 L15 50 M85 50 L95 50" strokeWidth="4" />
                            <circle cx="50" cy="50" r="40" />
                            {[...Array(8)].map((_, i) => (
                                <rect key={i} x="46" y="10" width="8" height="10" transform={`rotate(${i * 45} 50 50)`} fill="currentColor" />
                            ))}
                        </svg>
                    </div>
                </>
            )}

            {/* Global Animation Styles */}
            <style jsx global>{`
                @keyframes dash {
                    to { stroke-dashoffset: -1000; }
                }
                @keyframes flapLeft {
                    from { d: path("M50 30 Q 20 0 10 20"); }
                    to { d: path("M50 30 Q 20 60 10 40"); }
                }
                @keyframes flapRight {
                    from { d: path("M50 30 Q 80 0 90 20"); }
                    to { d: path("M50 30 Q 80 60 90 40"); }
                }
                @keyframes flyAcross {
                    0% { transform: translateX(-10vw) translateY(0) rotate(5deg) scale(1); }
                    25% { transform: translateX(25vw) translateY(-5vh) rotate(0deg) scale(0.8); }
                    50% { transform: translateX(50vw) translateY(0) rotate(-5deg) scale(0.6); }
                    75% { transform: translateX(75vw) translateY(-5vh) rotate(0deg) scale(0.8); }
                    100% { transform: translateX(110vw) translateY(0) rotate(5deg) scale(1); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

        </div>
    );
}
