/**
 * EmptyState Component
 *
 * A component for displaying empty states with optional icon,
 * title, description, and action.
 *
 * @module components/ui/EmptyState/EmptyState
 */

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  MailInbox24Regular,
  Search24Regular,
  ErrorCircle24Regular,
  Document24Regular,
  People24Regular,
} from '@fluentui/react-icons';

/**
 * EmptyState variants
 */
const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center px-4 py-8',
  {
    variants: {
      size: {
        sm: 'py-6',
        md: 'py-8',
        lg: 'py-12',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/**
 * Default icons for different variants
 */
const defaultIcons: Record<string, React.ReactNode> = {
  default: <MailInbox24Regular className="w-12 h-12" />,
  search: <Search24Regular className="w-12 h-12" />,
  error: <ErrorCircle24Regular className="w-12 h-12" />,
  noData: <Document24Regular className="w-12 h-12" />,
  contacts: <People24Regular className="w-12 h-12" />,
};

/**
 * EmptyState props interface
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof emptyStateVariants> {
  /**
   * Variant type (determines default icon)
   */
  variant?: 'default' | 'search' | 'error' | 'noData' | 'contacts';

  /**
   * Custom icon (overrides variant icon)
   */
  icon?: React.ReactNode;

  /**
   * Title text
   */
  title?: React.ReactNode;

  /**
   * Description text
   */
  description?: React.ReactNode;

  /**
   * Action element (usually a button)
   */
  action?: React.ReactNode;

  /**
   * Hide the icon
   */
  hideIcon?: boolean;
}

/**
 * EmptyState component
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      size,
      variant = 'default',
      icon,
      title,
      description,
      action,
      hideIcon = false,
      children,
      ...props
    },
    ref
  ) => {
    // Determine which icon to show
    const iconToShow = icon ?? defaultIcons[variant];

    // Get icon color based on variant
    const iconColor = variant === 'error' ? 'text-error-400' : 'text-th-text-s';

    return (
      <div
        ref={ref}
        className={cn(emptyStateVariants({ size }), className)}
        {...props}
      >
        {/* Icon */}
        {!hideIcon && iconToShow && (
          <div className={cn('mb-4', iconColor)}>{iconToShow}</div>
        )}

        {/* Title */}
        {title && (
          <h3 className="text-lg font-semibold text-white mb-1">
            {title}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-th-text-m max-w-sm mb-4">
            {description}
          </p>
        )}

        {/* Action */}
        {action && <div className="mt-2">{action}</div>}

        {/* Custom children */}
        {children}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState, emptyStateVariants };
