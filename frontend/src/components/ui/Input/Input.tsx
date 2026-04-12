/**
 * Input Component
 *
 * A versatile text input component with multiple variants and sizes.
 * Supports icons, error states, and helper text.
 *
 * @module components/ui/Input/Input
 *
 * @example
 * ```tsx
 * // Basic input
 * <Input placeholder="Enter your email" />
 *
 * // With label and error
 * <Input
 *   label="Email"
 *   error="Invalid email address"
 *   type="email"
 * />
 *
 * // With icons
 * <Input
 *   leftIcon={<SearchIcon />}
 *   placeholder="Search contacts..."
 * />
 * ```
 */

'use client';

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { inputVariants } from './Input.variants';

/**
 * Input props interface
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /**
   * Label text displayed above input
   */
  label?: string;

  /**
   * Helper text displayed below input
   */
  helperText?: string;

  /**
   * Error message (sets error variant automatically)
   */
  error?: string;

  /**
   * Icon to show on the left side
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to show on the right side
   */
  rightIcon?: React.ReactNode;

  /**
   * Container className
   */
  containerClassName?: string;
}

/**
 * Input component
 *
 * @param props - Input props
 * @returns Input element with optional label, icons, and helper text
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      type = 'text',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const inputId = id || React.useId();

    // Determine variant based on error prop
    const effectiveVariant = error ? 'error' : variant;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-white/80',
              disabled && 'opacity-50'
            )}
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <span
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 text-th-text-t',
                error && 'text-error-500'
              )}
              aria-hidden="true"
            >
              {leftIcon}
            </span>
          )}

          {/* Input element */}
          <input
            type={type}
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            className={cn(
              inputVariants({ variant: effectiveVariant, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <span
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-th-text-t',
                error && 'text-error-500'
              )}
              aria-hidden="true"
            >
              {rightIcon}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-error-500"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper text (only shown if no error) */}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-th-text-m"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
export default Input;
