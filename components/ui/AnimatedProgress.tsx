'use client';

import { motion } from 'framer-motion';
import { Check, MapPin, Sparkles, Plane } from 'lucide-react';

interface AnimatedProgressProps {
    currentStep: number;
    totalSteps?: number;
    stepTitles?: string[];
    onStepClick?: (step: number) => void;
}

export default function AnimatedProgress({
    currentStep,
    totalSteps = 3,
    stepTitles = ['Destination', 'Preferences', 'Review'],
    onStepClick,
}: AnimatedProgressProps) {
    const stepIcons = [
        { icon: MapPin, color: 'purple' },
        { icon: Sparkles, color: 'blue' },
        { icon: Check, color: 'green' },
    ];

    const getStepProgress = () => {
        return ((currentStep - 1) / (totalSteps - 1)) * 100;
    };

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
            {/* Progress Track */}
            <div className="relative w-full">
                {/* Background Track */}
                <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 mx-8">
                    <div className="w-full h-full bg-ink/10 rounded-full overflow-hidden">
                        {/* Animated Progress Fill */}
                        <motion.div
                            className="h-full bg-gradient-to-r from-leather via-stamp to-nature rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: `${getStepProgress()}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                {/* Animated Airplane */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 z-20"
                    initial={{ left: '0%' }}
                    animate={{
                        left: `calc(${getStepProgress()}% - 12px)`,
                    }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ marginLeft: '2rem' }}
                >
                    <motion.div
                        animate={{
                            y: [0, -3, 0],
                            rotate: [0, 5, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                        className="relative"
                    >
                        <div className="w-8 h-8 bg-paper border border-ink/10 rounded-full flex items-center justify-center shadow-lg">
                            <Plane className="w-4 h-4 text-leather transform rotate-45" />
                        </div>
                        {/* Contrail - pencil sketch style */}
                        <motion.div
                            className="absolute right-full top-1/2 -translate-y-1/2 h-0.5 bg-ink/20"
                            animate={{ width: [0, 20, 30, 20], opacity: [0.5, 0.2, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                    </motion.div>
                </motion.div>

                {/* Step Nodes */}
                <div className="flex justify-between relative z-10">
                    {Array.from({ length: totalSteps }).map((_, index) => {
                        const stepNum = index + 1;
                        const isCompleted = stepNum < currentStep;
                        const isCurrent = stepNum === currentStep;
                        const Icon = stepIcons[index]?.icon || Check;

                        return (
                            <button
                                key={stepNum}
                                onClick={() => stepNum <= currentStep && onStepClick?.(stepNum)}
                                disabled={stepNum > currentStep}
                                className={`relative group ${stepNum <= currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                {/* Glow Effect (Ink Blot) */}
                                {isCurrent && (
                                    <motion.div
                                        className="absolute inset-0 bg-leather/20 rounded-full blur-md"
                                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}

                                {/* Node Circle */}
                                <motion.div
                                    className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${isCompleted
                                        ? 'bg-paper text-nature border-2 border-nature'
                                        : isCurrent
                                            ? 'bg-paper text-leather border-2 border-leather'
                                            : 'bg-paper text-ink/20 border-2 border-ink/10'
                                        }`}
                                    whileHover={stepNum <= currentStep ? { scale: 1.05 } : {}}
                                    whileTap={stepNum <= currentStep ? { scale: 0.95 } : {}}
                                >
                                    {isCompleted ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 500 }}
                                        >
                                            <Check className="w-6 h-6 text-nature" />
                                        </motion.div>
                                    ) : (
                                        <Icon className={`w-6 h-6`} />
                                    )}
                                </motion.div>

                                {/* Step Label */}
                                <motion.span
                                    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs tracking-wider whitespace-nowrap transition-colors font-typewriter font-bold ${isCurrent ? 'text-ink' : isCompleted ? 'text-nature' : 'text-ink/30'
                                        }`}
                                    animate={isCurrent ? { opacity: [0.7, 1, 0.7] } : {}}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    {stepTitles[index]}
                                </motion.span>

                                {/* Tooltip on Hover */}
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="px-3 py-1.5 bg-paper-dark rounded-sm text-xs text-ink/70 border border-ink/10 whitespace-nowrap shadow-sm font-hand font-bold">
                                        {isCompleted ? '✓ Completed' : isCurrent ? 'Current step' : 'Upcoming'}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Journey Message */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <p className="text-lg text-ink/60 font-hand">
                    {currentStep === 1 && '🌍 Start your story...'}
                    {currentStep === 2 && '✨ Sketching out the details...'}
                    {currentStep === 3 && '🎒 Packing the bags!'}
                </p>
            </motion.div>
        </div>
    );
}
