import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d084]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b18]',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[#00d084] text-[#060b18]',
          'hover:bg-[#00e896] hover:shadow-lg hover:shadow-[#00d084]/20',
          'active:bg-[#00b870]',
        ],
        secondary: [
          'bg-transparent text-[#00d084]',
          'border border-[#00d084]/40',
          'hover:bg-[#00d084]/10',
          'active:bg-[#00d084]/20',
        ],
        ghost: [
          'text-white/80',
          'hover:bg-white/5 hover:text-white',
          'active:bg-white/10',
        ],
        danger: [
          'bg-red-500 text-white',
          'hover:bg-red-600',
          'active:bg-red-700',
        ],
        dangerOutline: [
          'bg-transparent text-red-400',
          'border border-red-500/40',
          'hover:bg-red-500/10',
          'active:bg-red-500/20',
        ],
        success: [
          'bg-emerald-500 text-white',
          'hover:bg-emerald-600',
          'active:bg-emerald-700',
        ],
        link: [
          'text-[#00d084] underline-offset-4',
          'hover:underline hover:text-[#00e896]',
          'p-0 h-auto',
        ],
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-lg',
        md: 'h-11 px-4 text-base rounded-xl',
        lg: 'h-12 px-6 text-lg rounded-xl',
        xl: 'h-14 px-8 text-xl rounded-xl',
        icon: 'h-10 w-10 rounded-xl',
        iconSm: 'h-8 w-8 rounded-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
      loading: {
        true: 'relative text-transparent',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
      loading: false,
    },
  }
);

export type ButtonVariants = typeof buttonVariants;
