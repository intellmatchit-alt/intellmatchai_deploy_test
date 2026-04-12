/**
 * UI Components Library
 *
 * Central export file for all UI components.
 * Import components from '@/components/ui'
 *
 * @module components/ui
 *
 * @example
 * ```tsx
 * import {
 *   Button,
 *   Input,
 *   Card,
 *   CardHeader,
 *   CardContent,
 *   Avatar,
 *   Badge,
 *   Dialog,
 *   Toast,
 * } from '@/components/ui';
 * ```
 */

// Button
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

// Input
export { Input, inputVariants } from './Input';
export type { InputProps } from './Input';

// Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
} from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from './Card';

// Avatar
export { Avatar, AvatarGroup, avatarVariants, avatarGroupVariants } from './Avatar';
export type { AvatarProps, AvatarGroupProps } from './Avatar';

// Badge
export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

// Chip
export { Chip, chipVariants } from './Chip';
export type { ChipProps } from './Chip';

// Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonContactCard,
} from './Skeleton';
export type {
  SkeletonProps,
  SkeletonTextProps,
  SkeletonAvatarProps,
  SkeletonCardProps,
} from './Skeleton';

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './Dialog';
export type {
  DialogOverlayProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogFooterProps,
  DialogTitleProps,
  DialogDescriptionProps,
} from './Dialog';

// Toast
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
  useToast,
  toast,
  Toaster,
} from './Toast';
export type { ToastProps, ToastActionElement, ToastData } from './Toast';

// Tabs
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
} from './Tabs';
export type { TabsListProps, TabsTriggerProps, TabsContentProps } from './Tabs';

// EmptyState
export { EmptyState, emptyStateVariants } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// ProgressRing
export { ProgressRing, progressRingVariants } from './ProgressRing';
export type { ProgressRingProps } from './ProgressRing';

// Select (Radix-based, from Select/ subdirectory)
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './Select/Select';
export type { SelectTriggerProps, SelectContentProps, SelectItemProps } from './Select/Select';

// PhoneInput
export {
  PhoneInput,
  countryCodes,
  findCountryByDialCode,
  findCountryByCode,
  getDefaultCountry,
  parsePhoneNumber,
  formatPhoneNumber,
} from './PhoneInput';
export type { PhoneInputProps, CountryCode } from './PhoneInput';

// FormSection
export { FormSection } from './FormSection';

// SearchableChipSelector
export { SearchableChipSelector } from './SearchableChipSelector';

// MultiPillSelector
export { MultiPillSelector } from './MultiPillSelector';

// DocumentUploadSection
export { DocumentUploadSection } from './DocumentUploadSection';

// CollapsibleSection
export { CollapsibleSection } from './CollapsibleSection';

// PillSelector
export { PillSelector } from './PillSelector';
