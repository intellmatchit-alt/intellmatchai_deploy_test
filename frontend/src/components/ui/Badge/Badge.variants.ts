/**
 * Badge Variants
 *
 * Style variants for the Badge component.
 * Edit this file to change badge appearance across the app.
 *
 * @module components/ui/Badge/Badge.variants
 */

import { cva } from 'class-variance-authority';

/**
 * Badge variants using class-variance-authority
 */
export const badgeVariants = cva(
  // Base styles applied to all badges
  [
    'inline-flex items-center justify-center',
    'font-medium',
    'transition-colors duration-200',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        // Primary badge
        primary: [
          'bg-[#00d084]/10 text-[#00b870]',
        ],

        // Secondary/neutral badge
        secondary: [
          'bg-white/5 text-white/80',
        ],

        // Success badge
        success: [
          'bg-success-100 text-success-700',
        ],

        // Warning badge
        warning: [
          'bg-warning-100 text-warning-700',
        ],

        // Error/danger badge
        error: [
          'bg-error-100 text-error-700',
        ],

        // Outlined badges
        outlinePrimary: [
          'border border-[#00d084]/40 text-[#00b870] bg-transparent',
        ],

        outlineSecondary: [
          'border border-white/[0.1] text-white/80 bg-transparent',
        ],

        outlineSuccess: [
          'border border-success-500 text-success-700 bg-transparent',
        ],

        outlineWarning: [
          'border border-warning-500 text-warning-700 bg-transparent',
        ],

        outlineError: [
          'border border-error-500 text-error-700 bg-transparent',
        ],

        // Solid badges
        solidPrimary: [
          'bg-[#00d084]/50 text-th-text',
        ],

        solidSuccess: [
          'bg-success-500 text-th-text',
        ],

        solidWarning: [
          'bg-warning-500 text-th-text',
        ],

        solidError: [
          'bg-error-500 text-th-text',
        ],
      },

      /**
       * Size variant
       */
      size: {
        // Small badge
        sm: 'px-2 py-0.5 text-xs rounded',

        // Medium/default badge
        md: 'px-2.5 py-0.5 text-sm rounded-md',

        // Large badge
        lg: 'px-3 py-1 text-base rounded-md',
      },

      /**
       * Pill shape (fully rounded)
       */
      pill: {
        true: 'rounded-full',
        false: '',
      },

      /**
       * Dot indicator
       */
      dot: {
        true: 'pl-1.5',
        false: '',
      },
    },

    // Default variants applied when not specified
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      pill: false,
      dot: false,
    },
  }
);

export type BadgeVariants = typeof badgeVariants;
