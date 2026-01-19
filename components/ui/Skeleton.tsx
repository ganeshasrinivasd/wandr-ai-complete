'use client';

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
  animated = true,
}: SkeletonProps) {
  const baseClasses = 'bg-ink/10 rounded';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const shimmerAnimation = animated ? {
    backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s infinite',
  } : {};

  if (lines > 1 && variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]}`}
            style={{
              width: i === lines - 1 ? '75%' : width || '100%',
              height: height || undefined,
              ...shimmerAnimation,
            }}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{
        width: width || (variant === 'circular' ? '40px' : '100%'),
        height: height || (variant === 'circular' ? '40px' : variant === 'text' ? '16px' : '100px'),
        ...shimmerAnimation,
      }}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Preset skeleton layouts for common use cases
export function DestinationCardSkeleton() {
  return (
    <div className="bg-paper border border-ink/10 rounded-sm p-5 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="rectangular" width={80} height={80} className="flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" lines={2} />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton variant="rectangular" width={80} height={28} className="rounded-full" />
        <Skeleton variant="rectangular" width={100} height={28} className="rounded-full" />
        <Skeleton variant="rectangular" width={70} height={28} className="rounded-full" />
      </div>
    </div>
  );
}

export function InterestSuggestionSkeleton() {
  return (
    <div className="bg-paper border border-ink/10 rounded-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" width={80} height={36} className="rounded-sm" />
        ))}
      </div>
    </div>
  );
}

export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton variant="text" width="30%" height={12} />
      <Skeleton variant="rectangular" height={56} className="rounded-sm" />
    </div>
  );
}
