'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp } from 'lucide-react';
import { InterestSuggestionSkeleton } from './Skeleton';

interface SmartSuggestionsProps {
    destination: string;
    selectedInterests: string[];
    onToggleInterest: (id: string) => void;
    isLoading?: boolean;
}

// Destination-based interest recommendations
const destinationInterests: Record<string, { primary: string[]; secondary: string[] }> = {
    // Japan
    tokyo: { primary: ['food', 'temples', 'shopping'], secondary: ['nightlife', 'art'] },
    kyoto: { primary: ['temples', 'history', 'nature'], secondary: ['food', 'art'] },
    osaka: { primary: ['food', 'nightlife', 'shopping'], secondary: ['history'] },
    japan: { primary: ['food', 'temples', 'nature'], secondary: ['shopping', 'art'] },

    // Europe
    paris: { primary: ['art', 'food', 'history'], secondary: ['shopping', 'nightlife'] },
    rome: { primary: ['history', 'food', 'art'], secondary: ['shopping'] },
    barcelona: { primary: ['art', 'food', 'nightlife'], secondary: ['nature', 'history'] },
    london: { primary: ['history', 'museums', 'shopping'], secondary: ['food', 'nightlife'] },
    amsterdam: { primary: ['art', 'museums', 'nightlife'], secondary: ['nature'] },

    // Asia
    bali: { primary: ['nature', 'temples', 'food'], secondary: ['art', 'shopping'] },
    bangkok: { primary: ['food', 'temples', 'shopping'], secondary: ['nightlife'] },
    singapore: { primary: ['food', 'shopping', 'nature'], secondary: ['art', 'nightlife'] },

    // Americas
    'new york': { primary: ['art', 'food', 'shopping'], secondary: ['nightlife', 'museums'] },
    'los angeles': { primary: ['food', 'shopping', 'nature'], secondary: ['art', 'nightlife'] },
    'mexico city': { primary: ['food', 'history', 'art'], secondary: ['museums', 'nightlife'] },

    // Default fallback
    default: { primary: ['food', 'nature', 'history'], secondary: ['art', 'shopping'] },
};

const interestDetails: Record<string, { icon: string; label: string }> = {
    food: { icon: '🍜', label: 'Culinary' },
    temples: { icon: '⛩️', label: 'Sacred Sites' },
    museums: { icon: '🏛️', label: 'Museums' },
    nature: { icon: '🌳', label: 'Nature' },
    shopping: { icon: '🛍️', label: 'Shopping' },
    nightlife: { icon: '🌃', label: 'Nightlife' },
    art: { icon: '🎨', label: 'Art & Culture' },
    history: { icon: '📚', label: 'History' },
};

export default function SmartSuggestions({
    destination,
    selectedInterests,
    onToggleInterest,
    isLoading = false,
}: SmartSuggestionsProps) {
    // Find matching destination recommendations
    const recommendations = useMemo(() => {
        if (!destination) return null;

        const normalizedDest = destination.toLowerCase();

        // Try to find a matching destination key
        for (const [key, interests] of Object.entries(destinationInterests)) {
            if (key === 'default') continue;
            if (normalizedDest.includes(key)) {
                return { key, ...interests };
            }
        }

        // Return default if no match
        return { key: 'your destination', ...destinationInterests.default };
    }, [destination]);

    if (isLoading) {
        return <InterestSuggestionSkeleton />;
    }

    if (!destination || !recommendations) {
        return null;
    }

    const destinationName = destination.split(',')[0] || recommendations.key;
    const allSuggested = [...recommendations.primary, ...recommendations.secondary];
    const hasUnselected = allSuggested.some(id => !selectedInterests.includes(id));

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
            >
                <div className="bg-paper-card border border-ink/10 rounded-sm p-5 shadow-sm relative overflow-hidden">
                    {/* Decorative tape */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-ink/5 to-transparent pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-paper-dark border border-ink/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-leather" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-ink font-serif tracking-wide uppercase">
                                Recommended for {destinationName}
                            </h3>
                            <p className="text-xs text-ink/50 font-hand font-bold">
                                Popular with travelers like you
                            </p>
                        </div>
                        {recommendations.primary.length > 0 && (
                            <div className="ml-auto flex items-center gap-1 text-xs text-nature font-bold bg-nature/10 px-2 py-1 rounded-sm border border-nature/20">
                                <TrendingUp className="w-3 h-3" />
                                <span>Trending</span>
                            </div>
                        )}
                    </div>

                    {/* Primary Suggestions */}
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-ink/40 mb-2 uppercase tracking-widest font-typewriter">Top picks</p>
                            <div className="flex flex-wrap gap-2">
                                {recommendations.primary.map((id) => {
                                    const interest = interestDetails[id];
                                    if (!interest) return null;

                                    const isSelected = selectedInterests.includes(id);

                                    return (
                                        <motion.button
                                            key={id}
                                            type="button"
                                            onClick={() => onToggleInterest(id)}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            className={`px-4 py-2.5 rounded-sm border flex items-center gap-2 transition-all duration-200 shadow-sm ${isSelected
                                                ? 'bg-leather text-paper border-leather shadow-md'
                                                : 'bg-paper-dark border-transparent text-ink/70 hover:bg-white hover:border-ink/10 hover:text-ink'
                                                }`}
                                        >
                                            <span className="text-lg grayscale">{interest.icon}</span>
                                            <span className="text-sm font-bold font-hand tracking-wide">{interest.label}</span>
                                            {isSelected && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-4 h-4 bg-paper rounded-full flex items-center justify-center ml-1"
                                                >
                                                    <span className="text-[10px] text-leather font-bold">✓</span>
                                                </motion.span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Secondary Suggestions */}
                        {recommendations.secondary.length > 0 && (
                            <div>
                                <p className="text-xs text-ink/40 mb-2 uppercase tracking-widest font-typewriter">Also popular</p>
                                <div className="flex flex-wrap gap-2">
                                    {recommendations.secondary.map((id) => {
                                        const interest = interestDetails[id];
                                        if (!interest) return null;

                                        const isSelected = selectedInterests.includes(id);

                                        return (
                                            <motion.button
                                                key={id}
                                                type="button"
                                                onClick={() => onToggleInterest(id)}
                                                whileHover={{ scale: 1.03 }}
                                                whileTap={{ scale: 0.97 }}
                                                className={`px-3 py-2 rounded-sm border flex items-center gap-1.5 transition-all duration-200 ${isSelected
                                                    ? 'bg-nature/10 border-nature text-nature font-bold'
                                                    : 'bg-paper-dark border-transparent text-ink/60 hover:bg-white hover:border-ink/10'
                                                    }`}
                                            >
                                                <span className="grayscale opacity-70">{interest.icon}</span>
                                                <span className="text-xs font-typewriter">{interest.label}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Select All Button */}
                    {hasUnselected && (
                        <motion.button
                            type="button"
                            onClick={() => {
                                allSuggested.forEach(id => {
                                    if (!selectedInterests.includes(id)) {
                                        onToggleInterest(id);
                                    }
                                });
                            }}
                            className="mt-4 w-full py-2 text-xs text-leather/70 hover:text-leather transition-colors font-serif italic border-t border-ink/5 dashed"
                        >
                            + Add all suggested interests to your journal
                        </motion.button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
