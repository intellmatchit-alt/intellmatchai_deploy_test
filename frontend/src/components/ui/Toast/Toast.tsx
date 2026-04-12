/**
 * Toast Component
 *
 * A notification toast system for displaying feedback messages.
 * Built with Radix UI Toast for accessibility.
 *
 * @module components/ui/Toast/Toast
 *
 * @example
 * ```tsx
 * // In your app layout
 * <Toaster />
 *
 * // Using the toast hook
 * const { toast } = useToast();
 *
 * toast({
 *   title: "Success!",
 *   description: "Your changes have been saved.",
 *   variant: "success",
 * });
 *
 * // Error toast
 * toast({
 *   title: "Error",
 *   description: "Something went wrong.",
 *   variant: "error",
 * });
 * ```
 */

'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  Dismiss20Regular,
  CheckmarkCircle20Regular,
  Warning20Regular,
  ErrorCircle20Regular,
  Info20Regular,
} from '@fluentui/react-icons';

/**
 * Toast provider
 */
const ToastProvider = ToastPrimitives.Provider;

/**
 * Toast viewport component
 */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4',
      'sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col',
      'md:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

/**
 * Toast variants
 */
const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-center justify-between space-x-4',
    'overflow-hidden rounded-lg border p-4 shadow-lg',
    'transition-all',
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=move]:transition-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80',
    'data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:slide-in-from-top-full',
    'data-[state=open]:sm:slide-in-from-bottom-full',
  ],
  {
    variants: {
      variant: {
        default: 'border-white/[0.08] bg-[#0c1222] text-white',
        success: 'border-success-200 bg-success-50 text-success-900',
        warning: 'border-warning-200 bg-warning-50 text-warning-900',
        error: 'border-error-200 bg-error-50 text-error-900',
        info: 'border-primary-200 bg-[#00d084]/5 text-primary-900',
        destructive: 'border-error-200 bg-error-50 text-error-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * X icon for close button
 */
const XIcon = () => <Dismiss20Regular className="w-4 h-4" />;

/**
 * Toast icons by variant
 */
const toastIcons: Record<string, React.ReactNode> = {
  success: <CheckmarkCircle20Regular className="w-5 h-5 text-success-500" />,
  warning: <Warning20Regular className="w-5 h-5 text-warning-500" />,
  error: <ErrorCircle20Regular className="w-5 h-5 text-error-500" />,
  info: <Info20Regular className="w-5 h-5 text-[#00d084]" />,
};

/**
 * Toast props interface
 */
export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {
  /**
   * Show icon
   */
  showIcon?: boolean;
}

/**
 * Toast component
 */
const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant = 'default', showIcon = true, children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {showIcon && variant && variant !== 'default' && (
        <div className="shrink-0">{toastIcons[variant]}</div>
      )}
      {children}
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

/**
 * ToastAction props interface
 */
export interface ToastActionProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> {}

/**
 * ToastAction component
 */
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  ToastActionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border',
      'bg-transparent px-3 text-sm font-medium',
      'ring-offset-white transition-colors',
      'hover:bg-white/5',
      'focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'group-[.error]:border-error-300 group-[.error]:hover:bg-error-100',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

/**
 * ToastClose component
 */
const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1',
      'text-th-text-m hover:text-white',
      'opacity-0 transition-opacity',
      'hover:bg-white/5',
      'focus:opacity-100 focus:outline-none focus:ring-2',
      'group-hover:opacity-100',
      className
    )}
    toast-close=""
    {...props}
  >
    <XIcon />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

/**
 * ToastTitle component
 */
const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

/**
 * ToastDescription component
 */
const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

/**
 * Export types
 */
export type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
};
