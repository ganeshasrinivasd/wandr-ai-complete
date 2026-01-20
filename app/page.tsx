'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MapPin, Compass, Sparkles } from 'lucide-react';
import MainPageConcepts from './MainPageConcepts';

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
  // TEMPORARY PROTOTYPE RENDERER
  return <MainPageConcepts />;

  // Original code below is effectively disabled:
  /*
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentDestination = destinations[currentIndex];

  // ... (rest of the original logic would go here, but for now we just return the concept)
  */
}
