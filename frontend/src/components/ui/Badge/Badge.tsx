/**
 * Badge Component
 *
 * A versatile badge component for status indicators, labels, and counts.
 *
 * @module components/ui/Badge/Badge
 *
 * @example
 * ```tsx
 * // Basic badge
 * <Badge>New</Badge>
 *
 * // Status badges
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error">Inactive</Badge>
 *
 * // With dot indicator
 * <Badge variant="success" dot>Online</Badge>
 *
 * // Pill shape
 * <Badge pill>99+</Badge>
 * ```
 */

'use client';

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { badgeVariants } from './Badge.variants';

/**
 * Badge props interface
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Render badge as a link
   */
  asChild?: boolean;
}

/**
 * Dot colors mapping for dot indicator
 */
const dotColorMap: Record<string, string> = {
  primary: 'bg-[#00d084]/50',
  secondary: 'bg-white/[0.03]',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  outlinePrimary: 'bg-[#00d084]/50',
  outlineSecondary: 'bg-white/[0.03]',
  outlineSuccess: 'bg-success-500',
  outlineWarning: 'bg-warning-500',
  outlineError: 'bg-error-500',
  solidPrimary: 'bg-[#00d084]',
  solidSuccess: 'bg-emerald-400',
  solidWarning: 'bg-amber-400',
  solidError: 'bg-red-400',
};

/**
 * Badge component
 *
 * @param props - Badge props
 * @returns Badge element
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'primary', size, pill, dot, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, pill, dot }), className)}
        {...props}
      >
        {/* Dot indicator */}
        {dot && (
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              dotColorMap[variant || 'primary']
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export default Badge;
