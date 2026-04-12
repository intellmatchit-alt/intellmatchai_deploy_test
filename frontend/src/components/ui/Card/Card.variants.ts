/**
 * Card Variants
 *
 * Style variants for the Card component.
 * Dark navy theme with teal accent borders.
 *
 * @module components/ui/Card/Card.variants
 */

import { cva } from 'class-variance-authority';

/**
 * Card variants using class-variance-authority
 */
export const cardVariants = cva(
  // Base styles applied to all cards
  [
    'rounded-xl',
    'bg-[#0c1222]/70 backdrop-blur-sm',
    'transition-all duration-300',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        // Default card with subtle border
        default: [
          'border border-white/[0.06]',
        ],

        // Elevated card with glow
        elevated: [
          'border border-white/[0.06]',
          'shadow-lg shadow-black/20',
          'hover:shadow-xl hover:shadow-black/30',
        ],

        // Outlined card
        outlined: [
          'border border-white/[0.08]',
        ],

        // Ghost card with minimal styling
        ghost: [
          'bg-transparent',
        ],

        // Interactive card with hover effects
        interactive: [
          'border border-white/[0.06]',
          'hover:border-[#00d084]/20 hover:shadow-lg hover:shadow-black/20',
          'cursor-pointer',
          'active:scale-[0.99]',
        ],

        // Highlighted card (e.g., for featured content)
        highlighted: [
          'border border-[#00d084]/30',
          'shadow-md shadow-[#00d084]/5',
        ],
      },

      /**
       * Padding variant
       */
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
    },

    // Default variants applied when not specified
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

/**
 * Card header variants
 */
export const cardHeaderVariants = cva(
  'flex flex-col gap-1.5',
  {
    variants: {
      padding: {
        none: 'p-0',
        sm: 'px-3 pt-3',
        md: 'px-4 pt-4',
        lg: 'px-6 pt-6',
        xl: 'px-8 pt-8',
      },
    },
    defaultVariants: {
      padding: 'md',
    },
  }
);

/**
 * Card content variants
 */
export const cardContentVariants = cva(
  '',
  {
    variants: {
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
    },
    defaultVariants: {
      padding: 'md',
    },
  }
);

/**
 * Card footer variants
 */
export const cardFooterVariants = cva(
  'flex items-center',
  {
    variants: {
      padding: {
        none: 'p-0',
        sm: 'px-3 pb-3',
        md: 'px-4 pb-4',
        lg: 'px-6 pb-6',
        xl: 'px-8 pb-8',
      },
    },
    defaultVariants: {
      padding: 'md',
    },
  }
);

export type CardVariants = typeof cardVariants;
