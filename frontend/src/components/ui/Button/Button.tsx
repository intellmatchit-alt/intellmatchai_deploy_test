/**
 * Button Component
 *
 * A versatile button component with multiple variants and sizes.
 * Supports loading state, icons, and full accessibility.
 *
 * @module components/ui/Button/Button
 *
 * @example
 * ```tsx
 * // Primary button
 * <Button>Click me</Button>
 *
 * // Secondary button with icon
 * <Button variant="secondary" leftIcon={<PlusIcon />}>
 *   Add Contact
 * </Button>
 *
 * // Loading state
 * <Button loading>Saving...</Button>
 *
 * // Full width
 * <Button fullWidth>Submit</Button>
 * ```
 */

'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { buttonVariants } from './Button.variants';

/**
 * Button props interface
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render as child component (useful for links)
   */
  asChild?: boolean;

  /**
   * Show loading spinner
   */
  loading?: boolean;

  /**
   * Icon to show on the left side
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to show on the right side
   */
  rightIcon?: React.ReactNode;
}

/**
 * Loading spinner component
 */
const LoadingSpinner = () => (
  <svg
    className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Button component
 *
 * @param props - Button props
 * @returns Button element
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      asChild = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, fullWidth, loading }),
          className
        )}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && <LoadingSpinner />}
        {!loading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className={cn(loading && 'invisible')}>{children}</span>
        {!loading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
