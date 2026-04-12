/**
 * Chip Component
 *
 * A versatile chip component for tags, filters, and selections.
 * Supports selection, removal, and icons.
 *
 * @module components/ui/Chip/Chip
 *
 * @example
 * ```tsx
 * // Basic chip
 * <Chip>Technology</Chip>
 *
 * // Selectable chip
 * <Chip
 *   clickable
 *   selected={isSelected}
 *   onClick={() => setIsSelected(!isSelected)}
 * >
 *   Finance
 * </Chip>
 *
 * // Removable chip
 * <Chip removable onRemove={() => handleRemove()}>
 *   Tag Name
 * </Chip>
 *
 * // With icon
 * <Chip leftIcon={<CheckIcon />}>Verified</Chip>
 * ```
 */

'use client';

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { chipVariants } from './Chip.variants';
import { Dismiss16Regular } from '@fluentui/react-icons';

/**
 * X icon for removable chips
 */
const XIcon = () => <Dismiss16Regular className="w-3.5 h-3.5" />;

/**
 * Chip props interface
 */
export interface ChipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>,
    VariantProps<typeof chipVariants> {
  /**
   * Icon to show on the left side
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to show on the right side (before remove button)
   */
  rightIcon?: React.ReactNode;

  /**
   * Callback when chip is clicked (for selectable chips)
   */
  onClick?: () => void;

  /**
   * Callback when remove button is clicked
   */
  onRemove?: () => void;

  /**
   * Disable chip interactions
   */
  disabled?: boolean;
}

/**
 * Chip component
 *
 * @param props - Chip props
 * @returns Chip element
 */
const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  (
    {
      className,
      variant,
      size,
      selected,
      clickable,
      removable,
      leftIcon,
      rightIcon,
      onClick,
      onRemove,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Handle chip click
    const handleClick = () => {
      if (!disabled && onClick) {
        onClick();
      }
    };

    // Handle remove button click
    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled && onRemove) {
        onRemove();
      }
    };

    // Keyboard support
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onRemove?.();
      }
    };

    return (
      <div
        ref={ref}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable && !disabled ? 0 : undefined}
        aria-pressed={clickable ? (selected ?? undefined) : undefined}
        aria-disabled={disabled}
        onClick={clickable ? handleClick : undefined}
        onKeyDown={clickable ? handleKeyDown : undefined}
        className={cn(
          chipVariants({ variant, size, selected, clickable, removable }),
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {/* Left icon */}
        {leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Content */}
        <span>{children}</span>

        {/* Right icon */}
        {rightIcon && !removable && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}

        {/* Remove button */}
        {removable && onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className={cn(
              'ml-0.5 rounded-full p-0.5',
              'hover:bg-black/10',
              'focus:outline-none focus:ring-1 focus:ring-current',
              'disabled:pointer-events-none'
            )}
            aria-label="Remove"
          >
            <XIcon />
          </button>
        )}
      </div>
    );
  }
);

Chip.displayName = 'Chip';

export { Chip, chipVariants };
export default Chip;
