/**
 * Avatar Variants
 *
 * Style variants for the Avatar component.
 * Edit this file to change avatar appearance across the app.
 *
 * @module components/ui/Avatar/Avatar.variants
 */

import { cva } from 'class-variance-authority';

/**
 * Avatar variants using class-variance-authority
 */
export const avatarVariants = cva(
  // Base styles applied to all avatars
  [
    'relative inline-flex items-center justify-center',
    'overflow-hidden rounded-full',
    'bg-[#00d084]/20 text-white',
    'font-medium uppercase',
    'select-none',
  ],
  {
    variants: {
      /**
       * Size variant
       */
      size: {
        // Extra small (profile lists)
        xs: 'h-6 w-6 text-xs',

        // Small (compact lists)
        sm: 'h-8 w-8 text-sm',

        // Medium/default
        md: 'h-10 w-10 text-base',

        // Large (profile cards)
        lg: 'h-12 w-12 text-lg',

        // Extra large (profile pages)
        xl: 'h-16 w-16 text-xl',

        // 2XL (main profile)
        '2xl': 'h-24 w-24 text-2xl',
      },

      /**
       * Shape variant
       */
      shape: {
        circle: 'rounded-full',
        square: 'rounded-lg',
      },

      /**
       * Border variant
       */
      bordered: {
        true: 'ring-2 ring-white',
        false: '',
      },
    },

    // Default variants applied when not specified
    defaultVariants: {
      size: 'md',
      shape: 'circle',
      bordered: false,
    },
  }
);

/**
 * Avatar image variants
 */
export const avatarImageVariants = cva(
  'aspect-square h-full w-full object-cover'
);

/**
 * Avatar fallback variants
 */
export const avatarFallbackVariants = cva(
  'flex h-full w-full items-center justify-center'
);

/**
 * Avatar group variants
 */
export const avatarGroupVariants = cva(
  'flex -space-x-3 rtl:space-x-reverse',
  {
    variants: {
      size: {
        xs: '-space-x-1.5 rtl:space-x-reverse',
        sm: '-space-x-2 rtl:space-x-reverse',
        md: '-space-x-3 rtl:space-x-reverse',
        lg: '-space-x-4 rtl:space-x-reverse',
        xl: '-space-x-5 rtl:space-x-reverse',
        '2xl': '-space-x-6 rtl:space-x-reverse',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export type AvatarVariants = typeof avatarVariants;
