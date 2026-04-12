/**
 * Input Variants
 *
 * Style variants for the Input component.
 * Edit this file to change input appearance across the app.
 *
 * @module components/ui/Input/Input.variants
 */

import { cva } from 'class-variance-authority';

/**
 * Input variants using class-variance-authority
 */
export const inputVariants = cva(
  // Base styles applied to all inputs
  [
    'flex w-full rounded-md border border-white/[0.08] bg-[#0c1222] px-3 py-2',
    'text-base text-white placeholder:text-th-text-t',
    'transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-white/5 disabled:opacity-50',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        // Default bordered input
        default: [
          'border-white/[0.1]',
          'hover:border-white/20',
          'focus:border-[#00d084]/50',
        ],

        // Filled background input
        filled: [
          'border-transparent bg-white/5',
          'hover:bg-white/[0.06]',
          'focus:bg-[#0c1222] focus:border-[#00d084]/50',
        ],

        // Error state
        error: [
          'border-error-500',
          'focus:ring-error-500 focus:border-error-500',
          'text-error-900 placeholder:text-error-400',
        ],

        // Success state
        success: [
          'border-success-500',
          'focus:ring-success-500 focus:border-success-500',
        ],
      },

      /**
       * Size variant
       */
      size: {
        // Small input
        sm: 'h-9 text-sm px-2.5',

        // Medium/default input (44px for touch)
        md: 'h-11 text-base px-3',

        // Large input
        lg: 'h-12 text-lg px-4',
      },
    },

    // Default variants applied when not specified
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export type InputVariants = typeof inputVariants;
