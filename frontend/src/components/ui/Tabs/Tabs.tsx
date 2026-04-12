/**
 * Tabs Component
 *
 * A tab navigation component built on Radix UI Tabs.
 * Fully accessible with keyboard navigation.
 *
 * @module components/ui/Tabs/Tabs
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="contacts">
 *   <TabsList>
 *     <TabsTrigger value="contacts">Contacts</TabsTrigger>
 *     <TabsTrigger value="matches">Matches</TabsTrigger>
 *     <TabsTrigger value="settings">Settings</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="contacts">
 *     <ContactsList />
 *   </TabsContent>
 *   <TabsContent value="matches">
 *     <MatchesList />
 *   </TabsContent>
 *   <TabsContent value="settings">
 *     <SettingsPanel />
 *   </TabsContent>
 * </Tabs>
 * ```
 */

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Tabs root component
 */
const Tabs = TabsPrimitive.Root;

/**
 * TabsList variants
 */
const tabsListVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        // Default underlined tabs
        default: [
          'w-full gap-1',
          'border-b border-white/[0.08]',
        ],

        // Pill/segmented tabs
        pills: [
          'rounded-lg bg-white/5 p-1',
        ],

        // Contained tabs with background
        contained: [
          'rounded-lg bg-white/5 p-1',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * TabsList props interface
 */
export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

/**
 * TabsList component
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * TabsTrigger variants
 */
const tabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap',
    'text-sm font-medium',
    'ring-offset-white transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        // Default underlined tabs
        default: [
          'px-4 py-2.5',
          'border-b-2 border-transparent -mb-px',
          'text-th-text-m',
          'hover:text-white/80',
          'data-[state=active]:border-[#00d084]/40 data-[state=active]:text-[#00d084]',
        ],

        // Pill/segmented tabs
        pills: [
          'px-4 py-2 rounded-md',
          'text-white/70',
          'hover:bg-white/[0.06]',
          'data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none',
        ],

        // Contained tabs
        contained: [
          'px-4 py-2 rounded-md',
          'text-white/70',
          'hover:text-white',
          'data-[state=active]:bg-white/10 data-[state=active]:text-[#00d084] data-[state=active]:shadow-none',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * TabsTrigger props interface
 */
export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {
  /**
   * Icon to show before text
   */
  icon?: React.ReactNode;

  /**
   * Badge/count to show after text
   */
  badge?: React.ReactNode;
}

/**
 * TabsTrigger component
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, icon, badge, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  >
    {icon && <span className="mr-2 shrink-0">{icon}</span>}
    {children}
    {badge && <span className="ml-2 shrink-0">{badge}</span>}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * TabsContent props interface
 */
export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {}

/**
 * TabsContent component
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4',
      'ring-offset-white',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
