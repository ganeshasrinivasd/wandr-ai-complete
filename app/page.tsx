'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MapPin, Compass, Sparkles } from 'lucide-react';

// Destination data with color palettes
const destinations = [
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    tagline: 'Find your blue',
    description: 'Where white cliffs meet endless azure',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=2400&q=80',
    colors: {
      primary: '#1e40af', // Deep blue
      secondary: '#60a5fa', // Light blue
      accent: '#fbbf24', // Golden sun
      text: '#ffffff',
      gradient: 'from-blue-900/80 via-blue-800/50 to-transparent',
    },
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    tagline: 'Find your zen',
    description: 'Ancient temples beneath cherry blossoms',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=2400&q=80',
    colors: {
      primary: '#be123c', // Deep rose
      secondary: '#fda4af', // Soft pink
      accent: '#fef3c7', // Cream
      text: '#ffffff',
      gradient: 'from-rose-900/80 via-rose-800/50 to-transparent',
    },
  },
  {
    id: 'iceland',
    name: 'Iceland',
    country: 'Nordic',
    tagline: 'Chase the lights',
    description: 'Where nature paints the sky',
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=2400&q=80',
    colors: {
      primary: '#5b21b6', // Deep purple
      secondary: '#2dd4bf', // Teal
      accent: '#a78bfa', // Light purple
      text: '#ffffff',
      gradient: 'from-purple-900/80 via-violet-800/50 to-transparent',
    },
  },
  {
    id: 'morocco',
    name: 'Sahara',
    country: 'Morocco',
    tagline: 'Find your horizon',
    description: 'Golden dunes that touch the sky',
    image: 'https://images.unsplash.com/photo-1509023464722-18d996393ca8?auto=format&fit=crop&w=2400&q=80',
    colors: {
      primary: '#c2410c', // Burnt orange
      secondary: '#fdba74', // Peach
      accent: '#fef3c7', // Sand
      text: '#ffffff',
      gradient: 'from-orange-900/80 via-amber-800/50 to-transparent',
    },
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    tagline: 'Find your spirit',
    description: 'Emerald terraces and sacred temples',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=2400&q=80',
    colors: {
      primary: '#166534', // Deep green
      secondary: '#86efac', // Light green
      accent: '#fbbf24', // Gold
      text: '#ffffff',
      gradient: 'from-emerald-900/80 via-green-800/50 to-transparent',
    },
  },
];

export default function HomePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentDestination = destinations[currentIndex];

  // Auto-rotate destinations
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % destinations.length);
        setIsTransitioning(false);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // Manual navigation
  const goToDestination = (index: number) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* Background Images with Crossfade */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentDestination.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${currentDestination.image})` }}
          />
          {/* Dynamic gradient overlay that matches destination colors */}
          <div className={`absolute inset-0 bg-gradient-to-r ${currentDestination.colors.gradient}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: typeof window !== 'undefined' ? window.innerHeight + 10 : 1000,
            }}
            animate={{
              y: -10,
              x: `+=${Math.random() * 100 - 50}`,
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-2"
          >
            <Compass 
              className="w-8 h-8 transition-colors duration-1000" 
              style={{ color: currentDestination.colors.secondary }}
            />
            <span className="text-2xl font-light tracking-[0.3em] text-white">
              WANDR
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="hidden md:flex items-center gap-8"
          >
            <span className="text-white/60 text-sm tracking-wider hover:text-white transition-colors cursor-pointer">
              DESTINATIONS
            </span>
            <span className="text-white/60 text-sm tracking-wider hover:text-white transition-colors cursor-pointer">
              HOW IT WORKS
            </span>
            <span className="text-white/60 text-sm tracking-wider hover:text-white transition-colors cursor-pointer">
              STORIES
            </span>
          </motion.div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-8 md:px-16 lg:px-24">
          <div className="max-w-4xl">
            {/* Location Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex items-center gap-2 mb-6"
            >
              <MapPin 
                className="w-4 h-4 transition-colors duration-1000"
                style={{ color: currentDestination.colors.secondary }}
              />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentDestination.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm tracking-[0.2em] text-white/80"
                >
                  {currentDestination.name.toUpperCase()}, {currentDestination.country.toUpperCase()}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            {/* Main Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mb-4"
            >
              <AnimatePresence mode="wait">
                <motion.h1
                  key={currentDestination.tagline}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.6 }}
                  className="text-6xl md:text-8xl lg:text-9xl font-extralight text-white leading-none"
                >
                  {currentDestination.tagline.split(' ').map((word, i) => (
                    <span key={i}>
                      {i === currentDestination.tagline.split(' ').length - 1 ? (
                        <span
                          className="transition-colors duration-1000 font-light"
                          style={{ color: currentDestination.colors.secondary }}
                        >
                          {word}
                        </span>
                      ) : (
                        <span>{word} </span>
                      )}
                    </span>
                  ))}
                </motion.h1>
              </AnimatePresence>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mb-12"
            >
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentDestination.description}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-xl md:text-2xl text-white/70 font-light tracking-wide"
                >
                  {currentDestination.description}
                </motion.p>
              </AnimatePresence>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <Link href="/planner">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden px-8 py-4 rounded-full transition-all duration-1000"
                  style={{ 
                    backgroundColor: currentDestination.colors.primary,
                    boxShadow: `0 20px 40px ${currentDestination.colors.primary}40`
                  }}
                >
                  <span className="relative z-10 flex items-center gap-3 text-white font-medium tracking-wider">
                    START YOUR JOURNEY
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ 
                      background: `linear-gradient(45deg, ${currentDestination.colors.primary}, ${currentDestination.colors.secondary})`
                    }}
                  />
                </motion.button>
              </Link>
            </motion.div>

            {/* Features - Glassmorphism Cards */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {[
                { icon: '✓', title: 'Every constraint met', desc: 'Accessibility, dietary, budget' },
                { icon: '◈', title: 'AI-optimized routes', desc: 'Neighborhood clusters' },
                { icon: '♦', title: 'Local insights', desc: 'Reddit-verified picks' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                  className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-5 hover:bg-white/15 transition-all duration-300"
                >
                  <span 
                    className="text-2xl transition-colors duration-1000"
                    style={{ color: currentDestination.colors.secondary }}
                  >
                    {feature.icon}
                  </span>
                  <h3 className="text-white font-medium mt-2 mb-1">{feature.title}</h3>
                  <p className="text-white/50 text-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Destination Navigation Dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {destinations.map((dest, index) => (
            <button
              key={dest.id}
              onClick={() => goToDestination(index)}
              className="group relative"
            >
              <motion.div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  index === currentIndex 
                    ? 'w-8' 
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                style={{
                  backgroundColor: index === currentIndex ? currentDestination.colors.secondary : undefined,
                }}
              />
              {/* Tooltip */}
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {dest.name}
              </span>
            </button>
          ))}
        </div>

        {/* Vertical Text - Right Side */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
            <span 
              className="text-xs tracking-[0.3em] text-white/40 transform -rotate-90 origin-center whitespace-nowrap"
              style={{ writingMode: 'vertical-rl' }}
            >
              SCROLL TO EXPLORE
            </span>
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          </motion.div>
        </div>
      </div>

      {/* Preload images */}
      <div className="hidden">
        {destinations.map((dest) => (
          <img key={dest.id} src={dest.image} alt="" />
        ))}
      </div>
    </div>
  );
}
