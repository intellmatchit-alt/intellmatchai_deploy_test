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
  // Base styles applied to all avatars — shared fallback gradient and typography
  // give every surface the same identity language.
  [
    'relative inline-flex items-center justify-center shrink-0',
    'overflow-hidden rounded-full',
    'bg-gradient-to-br from-[#00d084]/35 to-[#00b870]/25 text-white',
    'font-semibold uppercase tracking-tight',
    'select-none',
  ],
  {
    variants: {
      /**
       * Size variant — px sizes intentional so designers can reason in pixels.
       */
      size: {
        xs: 'h-6 w-6 text-[10px]',          // 24px — dense lists / inline mentions
        sm: 'h-8 w-8 text-xs',              // 32px — compact rows
        md: 'h-10 w-10 text-sm',            // 40px — default
        header: 'h-9 w-9 text-sm',          // 36px — top nav avatar
        lg: 'h-12 w-12 text-base',          // 48px — cards
        xl: 'h-16 w-16 text-lg',            // 64px — list headers
        '2xl': 'h-24 w-24 text-2xl',        // 96px — profile hero
      },

      /**
       * Shape variant
       */
      shape: {
        circle: 'rounded-full',
        square: 'rounded-lg',
      },

      /**
       * Intent — visual emphasis. `hero` carries the full glow treatment;
       * lighter intents share the same identity language at reduced intensity.
       */
      intent: {
        none: '',
        hero:
          'ring-2 ring-[#00d084]/45 shadow-[0_8px_28px_-4px_rgba(0,208,132,0.35)]',
        header:
          'ring-1 ring-white/15 hover:ring-[#00d084]/40 transition-all duration-200',
        menu:
          'ring-1 ring-white/10',
        soft:
          'ring-1 ring-[#00d084]/20',
      },

      /**
       * Legacy bordered prop — keep for backwards compatibility.
       */
      bordered: {
        true: 'ring-2 ring-white/80',
        false: '',
      },
    },

    // Default variants applied when not specified
    defaultVariants: {
      size: 'md',
      shape: 'circle',
      intent: 'none',
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
