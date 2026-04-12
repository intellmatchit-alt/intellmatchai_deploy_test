/**
 * Chip Variants
 *
 * Style variants for the Chip component.
 * Edit this file to change chip appearance across the app.
 *
 * @module components/ui/Chip/Chip.variants
 */

import { cva } from 'class-variance-authority';

/**
 * Chip variants using class-variance-authority
 */
export const chipVariants = cva(
  // Base styles applied to all chips
  [
    'inline-flex items-center gap-1.5',
    'font-medium rounded-full',
    'transition-all duration-200',
    'select-none',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        // Default chip
        default: [
          'bg-white/5 text-white/80',
          'hover:bg-white/[0.06]',
        ],

        // Primary chip
        primary: [
          'bg-[#00d084]/10 text-[#00b870]',
          'hover:bg-primary-200',
        ],

        // Outlined chip
        outline: [
          'border border-white/[0.1] text-white/80 bg-transparent',
          'hover:bg-white/[0.03]',
        ],

        // Outlined primary chip
        outlinePrimary: [
          'border border-[#00d084]/40 text-[#00b870] bg-transparent',
          'hover:bg-[#00d084]/5',
        ],
      },

      /**
       * Size variant
       */
      size: {
        // Small chip
        sm: 'px-2 py-0.5 text-xs h-6',

        // Medium/default chip
        md: 'px-3 py-1 text-sm h-8',

        // Large chip
        lg: 'px-4 py-1.5 text-base h-10',
      },

      /**
       * Selected state (for multi-select chips)
       */
      selected: {
        true: '',
        false: '',
      },

      /**
       * Clickable/interactive state
       */
      clickable: {
        true: 'cursor-pointer active:scale-95',
        false: '',
      },

      /**
       * Removable state (shows X button)
       */
      removable: {
        true: 'pr-1',
        false: '',
      },
    },

    // Compound variants for selected state
    compoundVariants: [
      {
        variant: 'default',
        selected: true,
        className: 'bg-[#00d084]/50 text-th-text hover:bg-[#00b870]',
      },
      {
        variant: 'primary',
        selected: true,
        className: 'bg-[#00d084]/50 text-th-text hover:bg-[#00b870]',
      },
      {
        variant: 'outline',
        selected: true,
        className: 'border-[#00d084]/40 bg-[#00d084]/50 text-th-text hover:bg-[#00b870]',
      },
      {
        variant: 'outlinePrimary',
        selected: true,
        className: 'bg-[#00d084]/50 text-th-text hover:bg-[#00b870]',
      },
    ],

    // Default variants applied when not specified
    defaultVariants: {
      variant: 'default',
      size: 'md',
      selected: false,
      clickable: false,
      removable: false,
    },
  }
);

export type ChipVariants = typeof chipVariants;
