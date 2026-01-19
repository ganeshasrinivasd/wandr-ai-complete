'use client';

import { useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    origin?: { x: number; y: number };
    colors?: string[];
    startVelocity?: number;
    gravity?: number;
    scalar?: number;
    drift?: number;
}

export function useConfetti() {
    const fireConfetti = useCallback((options: ConfettiOptions = {}) => {
        const defaults: ConfettiOptions = {
            particleCount: 100,
            spread: 70,
            origin: { x: 0.5, y: 0.6 },
            colors: ['#8B4513', '#A0522D', '#CD853F', '#556B2F', '#D2691E'],
            startVelocity: 30,
            gravity: 1,
            scalar: 1,
            drift: 0,
        };

        confetti({
            ...defaults,
            ...options,
        });
    }, []);

    const fireSuccessConfetti = useCallback(() => {
        // First burst
        fireConfetti({
            particleCount: 50,
            spread: 60,
            origin: { x: 0.3, y: 0.6 },
        });

        // Second burst (delayed)
        setTimeout(() => {
            fireConfetti({
                particleCount: 50,
                spread: 60,
                origin: { x: 0.7, y: 0.6 },
            });
        }, 150);

        // Third burst (center)
        setTimeout(() => {
            fireConfetti({
                particleCount: 80,
                spread: 100,
                origin: { x: 0.5, y: 0.5 },
                startVelocity: 45,
            });
        }, 300);
    }, [fireConfetti]);

    const fireTravelConfetti = useCallback(() => {
        // Travel-themed confetti with airplane shapes
        const end = Date.now() + 1000;
        const colors = ['#8B4513', '#556B2F', '#CD853F'];

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.6 },
                colors: colors,
            });

            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.6 },
                colors: colors,
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };

        frame();
    }, []);

    const fireStarsConfetti = useCallback(() => {
        confetti({
            particleCount: 50,
            spread: 360,
            ticks: 60,
            origin: { x: 0.5, y: 0.5 },
            colors: ['#DAA520', '#8B4513', '#D2691E'],
            shapes: ['star'],
            scalar: 1.5,
        });
    }, []);

    return {
        fireConfetti,
        fireSuccessConfetti,
        fireTravelConfetti,
        fireStarsConfetti,
    };
}

// Pre-configured confetti bursts
export const confettiBursts = {
    // Classic celebration
    celebration: () => {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            colors: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
        };

        function fire(particleRatio: number, opts: confetti.Options) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio),
            });
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    },

    // Quick subtle burst
    subtle: () => {
        confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
            startVelocity: 20,
        });
    },

    // Side cannons
    sideCannons: () => {
        const end = Date.now() + 500;
        const colors = ['#8b5cf6', '#3b82f6', '#10b981'];

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors,
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors,
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    },
};
