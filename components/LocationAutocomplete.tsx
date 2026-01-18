'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, Sparkles, TrendingUp, Globe2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (prediction: Prediction) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// Curated destination data for rich previews
const DESTINATION_DATA: Record<string, {
  photo: string;
  tagline: string;
  highlights: string[];
  bestTime: string;
  vibe: string;
}> = {
  'tokyo': {
    photo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=250&fit=crop',
    tagline: 'Where tradition meets tomorrow',
    highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tsukiji Market', 'Akihabara'],
    bestTime: 'Mar-May, Sep-Nov',
    vibe: 'Futuristic',
  },
  'paris': {
    photo: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=250&fit=crop',
    tagline: 'The city of light and love',
    highlights: ['Eiffel Tower', 'Louvre', 'Montmartre', 'Seine River'],
    bestTime: 'Apr-Jun, Sep-Oct',
    vibe: 'Romantic',
  },
  'new york': {
    photo: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&h=250&fit=crop',
    tagline: 'The city that never sleeps',
    highlights: ['Times Square', 'Central Park', 'Statue of Liberty', 'Brooklyn Bridge'],
    bestTime: 'Apr-Jun, Sep-Nov',
    vibe: 'Energetic',
  },
  'london': {
    photo: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop',
    tagline: 'History at every corner',
    highlights: ['Big Ben', 'Tower Bridge', 'British Museum', 'Hyde Park'],
    bestTime: 'May-Sep',
    vibe: 'Classic',
  },
  'dubai': {
    photo: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=250&fit=crop',
    tagline: 'Where dreams touch the sky',
    highlights: ['Burj Khalifa', 'Dubai Mall', 'Palm Jumeirah', 'Desert Safari'],
    bestTime: 'Nov-Mar',
    vibe: 'Luxurious',
  },
  'singapore': {
    photo: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&h=250&fit=crop',
    tagline: 'The garden city of wonders',
    highlights: ['Marina Bay', 'Gardens by the Bay', 'Sentosa', 'Hawker Centers'],
    bestTime: 'Feb-Apr',
    vibe: 'Modern',
  },
  'rome': {
    photo: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=250&fit=crop',
    tagline: 'Eternal city, timeless beauty',
    highlights: ['Colosseum', 'Vatican', 'Trevi Fountain', 'Pantheon'],
    bestTime: 'Apr-Jun, Sep-Oct',
    vibe: 'Historic',
  },
  'bali': {
    photo: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=250&fit=crop',
    tagline: 'Island of the gods',
    highlights: ['Ubud Rice Terraces', 'Tanah Lot', 'Seminyak Beach', 'Uluwatu Temple'],
    bestTime: 'Apr-Oct',
    vibe: 'Spiritual',
  },
  'bangkok': {
    photo: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=250&fit=crop',
    tagline: 'City of angels and flavors',
    highlights: ['Grand Palace', 'Wat Arun', 'Chatuchak Market', 'Khao San Road'],
    bestTime: 'Nov-Feb',
    vibe: 'Vibrant',
  },
  'barcelona': {
    photo: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&h=250&fit=crop',
    tagline: 'Art, architecture, and beaches',
    highlights: ['Sagrada Familia', 'Park Güell', 'La Rambla', 'Gothic Quarter'],
    bestTime: 'May-Jun, Sep-Oct',
    vibe: 'Artistic',
  },
  'hyderabad': {
    photo: 'https://images.unsplash.com/photo-1572638917498-8ecd0ba79bb2?w=400&h=250&fit=crop',
    tagline: 'City of pearls and biryani',
    highlights: ['Charminar', 'Golconda Fort', 'Ramoji Film City', 'Hussain Sagar'],
    bestTime: 'Oct-Mar',
    vibe: 'Historic',
  },
  'mumbai': {
    photo: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&h=250&fit=crop',
    tagline: 'The city of dreams',
    highlights: ['Gateway of India', 'Marine Drive', 'Elephanta Caves', 'Juhu Beach'],
    bestTime: 'Oct-Feb',
    vibe: 'Bustling',
  },
  'delhi': {
    photo: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=250&fit=crop',
    tagline: 'Where history comes alive',
    highlights: ['Red Fort', 'India Gate', 'Qutub Minar', 'Chandni Chowk'],
    bestTime: 'Oct-Mar',
    vibe: 'Historic',
  },
  'jaipur': {
    photo: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=400&h=250&fit=crop',
    tagline: 'The pink city of royalty',
    highlights: ['Amber Fort', 'Hawa Mahal', 'City Palace', 'Jantar Mantar'],
    bestTime: 'Oct-Mar',
    vibe: 'Royal',
  },
  'goa': {
    photo: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=250&fit=crop',
    tagline: 'Sun, sand, and serenity',
    highlights: ['Baga Beach', 'Old Goa Churches', 'Dudhsagar Falls', 'Anjuna Flea Market'],
    bestTime: 'Nov-Feb',
    vibe: 'Relaxed',
  },
  'sydney': {
    photo: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&h=250&fit=crop',
    tagline: 'Harbour city paradise',
    highlights: ['Opera House', 'Harbour Bridge', 'Bondi Beach', 'Darling Harbour'],
    bestTime: 'Sep-Nov, Mar-May',
    vibe: 'Coastal',
  },
  'amsterdam': {
    photo: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=400&h=250&fit=crop',
    tagline: 'Canals, bikes, and culture',
    highlights: ['Anne Frank House', 'Van Gogh Museum', 'Rijksmuseum', 'Jordaan'],
    bestTime: 'Apr-May, Sep-Nov',
    vibe: 'Liberal',
  },
  'istanbul': {
    photo: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&h=250&fit=crop',
    tagline: 'Where East meets West',
    highlights: ['Hagia Sophia', 'Blue Mosque', 'Grand Bazaar', 'Bosphorus'],
    bestTime: 'Apr-May, Sep-Nov',
    vibe: 'Mystical',
  },
  'kyoto': {
    photo: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=250&fit=crop',
    tagline: 'Ancient Japan preserved',
    highlights: ['Fushimi Inari', 'Kinkaku-ji', 'Arashiyama', 'Gion District'],
    bestTime: 'Mar-May, Oct-Nov',
    vibe: 'Serene',
  },
  'cape town': {
    photo: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=400&h=250&fit=crop',
    tagline: 'Where mountains meet the sea',
    highlights: ['Table Mountain', 'Cape Point', 'V&A Waterfront', 'Robben Island'],
    bestTime: 'Nov-Mar',
    vibe: 'Adventurous',
  },
};

// Trending destinations to show when input is empty
const TRENDING_DESTINATIONS = [
  { name: 'Tokyo, Japan', key: 'tokyo' },
  { name: 'Paris, France', key: 'paris' },
  { name: 'Bali, Indonesia', key: 'bali' },
  { name: 'Dubai, UAE', key: 'dubai' },
  { name: 'Barcelona, Spain', key: 'barcelona' },
  { name: 'Kyoto, Japan', key: 'kyoto' },
];

/**
 * Get destination data by matching city name
 */
function getDestinationData(text: string): typeof DESTINATION_DATA[string] | null {
  const lowerText = text.toLowerCase();
  for (const [key, data] of Object.entries(DESTINATION_DATA)) {
    if (lowerText.includes(key)) {
      return data;
    }
  }
  return null;
}

/**
 * Location Autocomplete Component with Rich Previews
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search any destination...',
  className = '',
  required = false,
}: LocationAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showTrending, setShowTrending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get preview data for highlighted item
  const highlightedPrediction = highlightedIndex >= 0 ? predictions[highlightedIndex] : null;
  const previewData = highlightedPrediction
    ? getDestinationData(highlightedPrediction.mainText)
    : null;

  // Debounced fetch function
  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setShowTrending(false);
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      );
      const data = await response.json();

      if (data.predictions) {
        setPredictions(data.predictions);
        setIsOpen(data.predictions.length > 0);
        setHighlightedIndex(data.predictions.length > 0 ? 0 : -1);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  // Handle prediction selection
  const handleSelect = (prediction: Prediction) => {
    onChange(prediction.description);
    onSelect?.(prediction);
    setPredictions([]);
    setIsOpen(false);
    setShowTrending(false);
    inputRef.current?.blur();
  };

  // Handle trending destination selection
  const handleTrendingSelect = (name: string) => {
    onChange(name);
    setShowTrending(false);
    setIsOpen(false);
    // Trigger a search to get the proper place data
    fetchPredictions(name);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
          handleSelect(predictions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setShowTrending(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle focus - show trending if empty
  const handleFocus = () => {
    if (value.length < 2 && predictions.length === 0) {
      setShowTrending(true);
    } else if (predictions.length > 0) {
      setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowTrending(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/60" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          className={`w-full pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all ${className}`}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 animate-spin" />
        )}
      </div>

      {/* Trending Destinations (shown when empty/focused) */}
      <AnimatePresence>
        {showTrending && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            ref={dropdownRef}
            className="absolute z-50 w-full mt-3 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white/60 tracking-wider">TRENDING DESTINATIONS</span>
            </div>
            <div className="p-2">
              {TRENDING_DESTINATIONS.map((dest) => {
                const data = DESTINATION_DATA[dest.key];
                return (
                  <button
                    key={dest.key}
                    type="button"
                    onClick={() => handleTrendingSelect(dest.name)}
                    className="w-full p-3 text-left rounded-xl hover:bg-white/5 transition-all group flex items-center gap-4"
                  >
                    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                      {data?.photo && (
                        <img
                          src={data.photo}
                          alt={dest.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{dest.name}</div>
                      <div className="text-white/40 text-sm truncate">{data?.tagline}</div>
                    </div>
                    <div className="text-xs text-purple-400/60 bg-purple-500/10 px-2 py-1 rounded-full">
                      {data?.vibe}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && predictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            ref={dropdownRef}
            className="absolute z-50 w-full mt-3"
          >
            <div className="flex gap-3">
              {/* Predictions List */}
              <div className="flex-1 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-white/40 tracking-wider">DESTINATIONS</span>
                </div>
                {predictions.map((prediction, index) => (
                  <button
                    key={prediction.placeId}
                    type="button"
                    onClick={() => handleSelect(prediction)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-all ${
                      index === highlightedIndex
                        ? 'bg-purple-500/20'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-colors ${
                      index === highlightedIndex ? 'text-purple-400' : 'text-white/30'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">
                        {prediction.mainText}
                      </div>
                      {prediction.secondaryText && (
                        <div className="text-white/40 text-sm truncate">
                          {prediction.secondaryText}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Preview Card (shown when destination data available) */}
              <AnimatePresence mode="wait">
                {previewData && (
                  <motion.div
                    key={highlightedPrediction?.placeId}
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="hidden md:block w-72 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                  >
                    {/* Preview Image */}
                    <div className="relative h-36 overflow-hidden">
                      <img
                        src={previewData.photo}
                        alt={highlightedPrediction?.mainText}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="text-white font-semibold text-lg">
                          {highlightedPrediction?.mainText}
                        </div>
                        <div className="text-white/60 text-sm italic">
                          {previewData.tagline}
                        </div>
                      </div>
                    </div>

                    {/* Preview Details */}
                    <div className="p-4 space-y-3">
                      {/* Vibe & Best Time */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="text-white/60">Vibe:</span>
                          <span className="text-purple-400">{previewData.vibe}</span>
                        </div>
                        <div className="text-white/40 text-xs">
                          Best: {previewData.bestTime}
                        </div>
                      </div>

                      {/* Highlights */}
                      <div>
                        <div className="text-xs text-white/40 mb-2 tracking-wider">HIGHLIGHTS</div>
                        <div className="flex flex-wrap gap-1.5">
                          {previewData.highlights.map((highlight) => (
                            <span
                              key={highlight}
                              className="text-xs px-2 py-1 bg-white/5 text-white/70 rounded-full border border-white/10"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
