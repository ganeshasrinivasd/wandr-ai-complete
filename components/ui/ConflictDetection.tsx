'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X, ChevronRight } from 'lucide-react';

interface ConflictDetectionProps {
    budget: string;
    constraints: string[];
    interests: string[];
    destination: string;
    onDismiss?: (id: string) => void;
    onAdjustBudget?: () => void;
}

interface Conflict {
    id: string;
    type: 'warning' | 'info';
    title: string;
    description: string;
    suggestion?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

// Budget thresholds per category (USD per day)
const budgetThresholds = {
    premium: 200,
    comfortable: 100,
    budget: 50,
};

// Destination cost levels
const destinationCosts: Record<string, 'high' | 'medium' | 'low'> = {
    tokyo: 'high',
    paris: 'high',
    london: 'high',
    'new york': 'high',
    singapore: 'high',
    switzerland: 'high',
    bangkok: 'low',
    bali: 'low',
    vietnam: 'low',
    mexico: 'low',
    portugal: 'medium',
    spain: 'medium',
    italy: 'medium',
    greece: 'medium',
};

export default function ConflictDetection({
    budget,
    constraints,
    interests,
    destination,
    onDismiss,
    onAdjustBudget,
}: ConflictDetectionProps) {
    const conflicts = useMemo(() => {
        const detected: Conflict[] = [];
        const budgetNum = parseInt(budget) || 100;
        const normalizedDest = destination.toLowerCase();

        // Check for budget conflicts
        let destCost: 'high' | 'medium' | 'low' = 'medium';
        for (const [key, cost] of Object.entries(destinationCosts)) {
            if (normalizedDest.includes(key)) {
                destCost = cost;
                break;
            }
        }

        // Low budget + expensive destination
        if (budgetNum < 80 && destCost === 'high') {
            detected.push({
                id: 'low-budget-expensive-dest',
                type: 'warning',
                title: 'Budget may be tight',
                description: `$${budgetNum}/day is quite low for ${destination.split(',')[0]}. Basic accommodation starts around $60-80/night.`,
                suggestion: 'Consider hostels or staying slightly outside the city center.',
                action: onAdjustBudget ? {
                    label: 'Adjust budget',
                    onClick: onAdjustBudget,
                } : undefined,
            });
        }

        // Premium interests + low budget
        const premiumInterests = ['shopping', 'nightlife', 'food'];
        const hasPremiumInterests = interests.some(i => premiumInterests.includes(i));
        if (hasPremiumInterests && budgetNum < 100) {
            detected.push({
                id: 'premium-interests-low-budget',
                type: 'info',
                title: 'Stretch your budget',
                description: `Your interests (${interests.filter(i => premiumInterests.includes(i)).join(', ')}) typically require higher spending.`,
                suggestion: 'We\'ll find budget-friendly options, but consider adding buffer for splurges.',
            });
        }

        // Accessibility + nature activities
        if (constraints.includes('wheelchair') && interests.includes('nature')) {
            detected.push({
                id: 'accessibility-nature',
                type: 'info',
                title: 'Accessibility note',
                description: 'Some nature trails may have limited wheelchair access.',
                suggestion: 'We\'ll prioritize accessible parks and nature reserves with paved paths.',
            });
        }

        // Multiple dietary restrictions
        const dietaryConstraints = ['vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free'];
        const activeDietary = constraints.filter(c => dietaryConstraints.includes(c));
        if (activeDietary.length >= 2) {
            detected.push({
                id: 'multiple-dietary',
                type: 'info',
                title: 'Multiple dietary needs',
                description: `Finding restaurants that accommodate ${activeDietary.join(' + ')} may limit options.`,
                suggestion: 'We\'ll search for versatile restaurants and include cooking class options.',
            });
        }

        // Nightlife + early morning activities
        if (interests.includes('nightlife') && interests.includes('temples')) {
            detected.push({
                id: 'nightlife-early',
                type: 'info',
                title: 'Schedule heads up',
                description: 'Temple visits are best in early morning, which may conflict with late nights.',
                suggestion: 'We\'ll balance your schedule to avoid back-to-back late nights before temple visits.',
            });
        }

        return detected;
    }, [budget, constraints, interests, destination, onAdjustBudget]);

    if (conflicts.length === 0) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3 mb-6"
            >
                {conflicts.map((conflict) => (
                    <motion.div
                        key={conflict.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`rounded-sm p-4 border shadow-sm ${conflict.type === 'warning'
                            ? 'bg-[#fff5f5] border-stamp/30'
                            : 'bg-[#f0fff4] border-nature/30'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${conflict.type === 'warning' ? 'bg-stamp/10 border-stamp/20' : 'bg-nature/10 border-nature/20'
                                }`}>
                                {conflict.type === 'warning' ? (
                                    <AlertTriangle className="w-4 h-4 text-stamp" />
                                ) : (
                                    <Info className="w-4 h-4 text-nature" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-bold font-serif ${conflict.type === 'warning' ? 'text-stamp' : 'text-nature'
                                    }`}>
                                    {conflict.title}
                                </h4>
                                <p className="text-sm text-ink/70 mt-1 font-hand">
                                    {conflict.description}
                                </p>
                                {conflict.suggestion && (
                                    <p className="text-xs text-ink/50 mt-2 italic font-serif">
                                        💡 {conflict.suggestion}
                                    </p>
                                )}

                                {/* Action Button */}
                                {conflict.action && (
                                    <button
                                        type="button"
                                        onClick={conflict.action.onClick}
                                        className={`mt-3 inline-flex items-center gap-1 text-xs font-bold font-typewriter transition-colors ${conflict.type === 'warning'
                                            ? 'text-stamp hover:text-red-700 underline decoration-stamp/30'
                                            : 'text-nature hover:text-green-700 underline decoration-nature/30'
                                            }`}
                                    >
                                        {conflict.action.label}
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Dismiss Button */}
                            {onDismiss && (
                                <button
                                    type="button"
                                    onClick={() => onDismiss(conflict.id)}
                                    className="p-1 text-ink/30 hover:text-ink/60 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
}
