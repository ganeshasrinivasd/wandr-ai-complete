'use client';

import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { GripVertical, Star } from 'lucide-react';

interface DraggablePrioritiesProps {
    interests: string[];
    onReorder: (newOrder: string[]) => void;
}

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

export default function DraggablePriorities({
    interests,
    onReorder,
}: DraggablePrioritiesProps) {
    const [isDragging, setIsDragging] = useState(false);

    if (interests.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
        >
            <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-ink/50 tracking-wider uppercase font-typewriter font-bold">
                    Priority Order
                </label>
                <span className="text-[10px] text-ink/30 font-hand font-bold">
                    Drag to reorder
                </span>
            </div>

            <div className="bg-paper border border-ink/10 rounded-sm p-3 relative">
                {/* Paper tear illusion maybe? Just simple for now */}

                {/* Priority Labels */}
                <div className="flex justify-between text-[10px] text-ink/40 mb-2 px-2 font-serif italic">
                    <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-leather" fill="currentColor" />
                        Most important
                    </span>
                    <span>Least important</span>
                </div>

                {/* Draggable List */}
                <Reorder.Group
                    axis="y"
                    values={interests}
                    onReorder={onReorder}
                    className="space-y-2"
                >
                    {interests.map((id, index) => {
                        const interest = interestDetails[id];
                        if (!interest) return null;

                        const isTop = index === 0;
                        const isBottom = index === interests.length - 1;

                        return (
                            <Reorder.Item
                                key={id}
                                value={id}
                                onDragStart={() => setIsDragging(true)}
                                onDragEnd={() => setIsDragging(false)}
                                className="cursor-grab active:cursor-grabbing"
                            >
                                <motion.div
                                    layout
                                    className={`flex items-center gap-3 px-4 py-3 rounded-sm border transition-all ${isTop
                                        ? 'bg-leather/5 border-leather/30 shadow-sm'
                                        : 'bg-paper-dark border-transparent hover:border-ink/5'
                                        } ${isDragging ? 'shadow-lg shadow-leather/10 scale-[1.02] z-10 relative' : ''}`}
                                    whileHover={{ scale: 1.005 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    {/* Priority Number */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-typewriter ${isTop
                                        ? 'bg-leather text-paper'
                                        : 'bg-paper border border-ink/10 text-ink/40'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    {/* Interest Icon & Label */}
                                    <span className="text-xl grayscale opacity-80">{interest.icon}</span>
                                    <span className={`text-sm flex-1 font-hand font-bold tracking-wide ${isTop ? 'text-leather' : 'text-ink/70'}`}>
                                        {interest.label}
                                    </span>

                                    {/* Top badge */}
                                    {isTop && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="text-[10px] bg-leather text-paper px-2 py-0.5 rounded-sm font-typewriter uppercase tracking-widest"
                                        >
                                            Top Priority
                                        </motion.span>
                                    )}

                                    {/* Drag Handle */}
                                    <GripVertical className="w-4 h-4 text-ink/20" />
                                </motion.div>
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>

                {/* Helper Text */}
                <p className="text-[10px] text-ink/40 text-center mt-3 font-serif italic">
                    Your top interest will be the star of your itinerary
                </p>
            </div>
        </motion.div>
    );
}
