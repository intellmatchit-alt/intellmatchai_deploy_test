/**
 * Avatar Component
 *
 * A versatile avatar component for displaying user profile images.
 * Falls back to initials when image is not available.
 *
 * @module components/ui/Avatar/Avatar
 *
 * @example
 * ```tsx
 * // With image
 * <Avatar src="/user.jpg" alt="John Doe" />
 *
 * // With fallback initials
 * <Avatar name="John Doe" />
 *
 * // Different sizes
 * <Avatar src="/user.jpg" size="lg" />
 *
 * // Avatar group
 * <AvatarGroup>
 *   <Avatar src="/user1.jpg" />
 *   <Avatar src="/user2.jpg" />
 *   <Avatar name="JD" />
 * </AvatarGroup>
 * ```
 */

'use client';

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn, getInitials } from '@/lib/utils';
import {
  avatarVariants,
  avatarImageVariants,
  avatarFallbackVariants,
  avatarGroupVariants,
} from './Avatar.variants';

/**
 * Avatar props interface
 */
export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  /**
   * Image source URL
   */
  src?: string | null;

  /**
   * Alt text for image
   */
  alt?: string;

  /**
   * Name to generate initials from
   */
  name?: string;

  /**
   * Custom fallback content
   */
  fallback?: React.ReactNode;

  /**
   * Background color for fallback
   */
  fallbackColor?: string;
}

/**
 * Avatar component
 *
 * @param props - Avatar props
 * @returns Avatar element
 */
const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      size,
      shape,
      bordered,
      src,
      alt,
      name,
      fallback,
      fallbackColor,
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(!!src);

    // Reset error state when src changes
    React.useEffect(() => {
      setHasError(false);
      setIsLoading(!!src);
    }, [src]);

    // Determine what to show
    const showImage = src && !hasError;
    const initials = name ? getInitials(name) : fallback;

    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size, shape, bordered }), className)}
        style={fallbackColor ? { backgroundColor: fallbackColor } : undefined}
        {...props}
      >
        {/* Image */}
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className={cn(
              avatarImageVariants(),
              isLoading && 'opacity-0'
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        )}

        {/* Fallback (initials or custom) */}
        {(!showImage || isLoading) && (
          <span className={avatarFallbackVariants()}>
            {initials || '?'}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/**
 * AvatarGroup props interface
 */
export interface AvatarGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarGroupVariants> {
  /**
   * Maximum avatars to show before +N indicator
   */
  max?: number;
}

/**
 * AvatarGroup component
 *
 * @param props - AvatarGroup props
 * @returns AvatarGroup element
 */
const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, size, max, children, ...props }, ref) => {
    const childArray = React.Children.toArray(children);
    const visibleChildren = max ? childArray.slice(0, max) : childArray;
    const remainingCount = max ? childArray.length - max : 0;

    return (
      <div
        ref={ref}
        className={cn(avatarGroupVariants({ size }), className)}
        {...props}
      >
        {visibleChildren.map((child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<AvatarProps>, {
              key: index,
              size,
              bordered: true,
            });
          }
          return child;
        })}

        {/* Remaining count indicator */}
        {remainingCount > 0 && (
          <Avatar
            size={size}
            bordered
            fallback={`+${remainingCount}`}
            fallbackColor="#6B7280"
            className="text-th-text"
          />
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarGroup, avatarVariants, avatarGroupVariants };
