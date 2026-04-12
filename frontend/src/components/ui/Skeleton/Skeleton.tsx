/**
 * Skeleton Component
 *
 * Loading placeholder components for content that is being fetched.
 * Provides visual feedback while data loads.
 *
 * @module components/ui/Skeleton/Skeleton
 *
 * @example
 * ```tsx
 * // Basic skeleton
 * <Skeleton className="h-4 w-[200px]" />
 *
 * // Circle skeleton (avatar)
 * <Skeleton variant="circle" className="h-10 w-10" />
 *
 * // Card skeleton
 * <div className="space-y-3">
 *   <Skeleton className="h-[200px] w-full" />
 *   <Skeleton className="h-4 w-3/4" />
 *   <Skeleton className="h-4 w-1/2" />
 * </div>
 *
 * // Using preset components
 * <SkeletonText lines={3} />
 * <SkeletonAvatar />
 * <SkeletonCard />
 * ```
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton props interface
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Shape variant
   */
  variant?: 'rectangle' | 'circle' | 'text';

  /**
   * Animation type
   */
  animation?: 'pulse' | 'shimmer' | 'none';
}

/**
 * Skeleton component
 *
 * @param props - Skeleton props
 * @returns Skeleton element
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    { className, variant = 'rectangle', animation = 'pulse', ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white/[0.06]',
          // Shape variants
          variant === 'circle' && 'rounded-full',
          variant === 'rectangle' && 'rounded-md',
          variant === 'text' && 'rounded h-4',
          // Animation variants
          animation === 'pulse' && 'animate-pulse',
          animation === 'shimmer' && [
            'relative overflow-hidden',
            'before:absolute before:inset-0',
            'before:-translate-x-full',
            'before:animate-[shimmer_2s_infinite]',
            'before:bg-gradient-to-r',
            'before:from-transparent before:via-white/60 before:to-transparent',
          ],
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

/**
 * SkeletonText props interface
 */
export interface SkeletonTextProps {
  /**
   * Number of lines
   */
  lines?: number;

  /**
   * Gap between lines
   */
  gap?: 'sm' | 'md' | 'lg';

  /**
   * Container className
   */
  className?: string;
}

/**
 * SkeletonText component - Multiple text lines
 */
const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  gap = 'sm',
  className,
}) => {
  const gapClass = {
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4',
  };

  // Create varying widths for natural look
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-3/4', 'w-2/3'];

  return (
    <div className={cn(gapClass[gap], className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={widths[i % widths.length]}
        />
      ))}
    </div>
  );
};

SkeletonText.displayName = 'SkeletonText';

/**
 * SkeletonAvatar props interface
 */
export interface SkeletonAvatarProps {
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /**
   * className
   */
  className?: string;
}

/**
 * SkeletonAvatar component - Avatar placeholder
 */
const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClass = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton
      variant="circle"
      className={cn(sizeClass[size], className)}
    />
  );
};

SkeletonAvatar.displayName = 'SkeletonAvatar';

/**
 * SkeletonCard props interface
 */
export interface SkeletonCardProps {
  /**
   * Show header section
   */
  hasHeader?: boolean;

  /**
   * Show footer section
   */
  hasFooter?: boolean;

  /**
   * Number of content lines
   */
  lines?: number;

  /**
   * className
   */
  className?: string;
}

/**
 * SkeletonCard component - Card placeholder
 */
const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasHeader = true,
  hasFooter = false,
  lines = 3,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-[#0c1222] p-4',
        className
      )}
    >
      {/* Header */}
      {hasHeader && (
        <div className="mb-4 flex items-center gap-3">
          <SkeletonAvatar size="md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      )}

      {/* Content */}
      <SkeletonText lines={lines} />

      {/* Footer */}
      {hasFooter && (
        <div className="mt-4 flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      )}
    </div>
  );
};

SkeletonCard.displayName = 'SkeletonCard';

/**
 * SkeletonContactCard component - Contact card placeholder
 */
const SkeletonContactCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-[#0c1222] p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <SkeletonAvatar size="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
};

SkeletonContactCard.displayName = 'SkeletonContactCard';

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonContactCard,
};
