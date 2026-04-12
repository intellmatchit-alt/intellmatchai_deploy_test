/**
 * ProgressRing Component
 *
 * A circular progress indicator for displaying scores and percentages.
 * Perfect for match scores and completion indicators.
 *
 * @module components/ui/ProgressRing/ProgressRing
 *
 * @example
 * ```tsx
 * // Basic progress ring
 * <ProgressRing value={75} />
 *
 * // With label
 * <ProgressRing value={85} label="Match" />
 *
 * // Different sizes
 * <ProgressRing value={60} size="lg" />
 *
 * // Custom colors
 * <ProgressRing value={90} color="success" />
 *
 * // Score display (shows value inside)
 * <ProgressRing value={92} showValue />
 * ```
 */

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * ProgressRing variants
 */
const progressRingVariants = cva(
  'relative inline-flex items-center justify-center',
  {
    variants: {
      size: {
        xs: 'h-8 w-8',
        sm: 'h-10 w-10',
        md: 'h-14 w-14',
        lg: 'h-20 w-20',
        xl: 'h-28 w-28',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/**
 * Color configurations
 */
const colorConfigs = {
  primary: {
    stroke: '#7C3AED', // primary-500
    background: '#EDE9FE', // primary-100
    text: 'text-[#00d084]',
  },
  success: {
    stroke: '#10B981', // success-500
    background: '#D1FAE5', // success-100
    text: 'text-success-600',
  },
  warning: {
    stroke: '#F59E0B', // warning-500
    background: '#FEF3C7', // warning-100
    text: 'text-warning-600',
  },
  error: {
    stroke: '#EF4444', // error-500
    background: '#FEE2E2', // error-100
    text: 'text-error-600',
  },
  neutral: {
    stroke: '#6B7280', // neutral-500
    background: '#F3F4F6', // neutral-100
    text: 'text-white/70',
  },
};

/**
 * Size configurations for SVG
 */
const sizeConfigs = {
  xs: { svgSize: 32, strokeWidth: 3, fontSize: 'text-xs', radius: 12 },
  sm: { svgSize: 40, strokeWidth: 3, fontSize: 'text-xs', radius: 16 },
  md: { svgSize: 56, strokeWidth: 4, fontSize: 'text-sm', radius: 22 },
  lg: { svgSize: 80, strokeWidth: 5, fontSize: 'text-lg', radius: 32 },
  xl: { svgSize: 112, strokeWidth: 6, fontSize: 'text-2xl', radius: 46 },
};

/**
 * ProgressRing props interface
 */
export interface ProgressRingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof progressRingVariants> {
  /**
   * Progress value (0-100)
   */
  value: number;

  /**
   * Maximum value (default: 100)
   */
  max?: number;

  /**
   * Color variant
   */
  color?: keyof typeof colorConfigs;

  /**
   * Show value inside ring
   */
  showValue?: boolean;

  /**
   * Label to show below value
   */
  label?: string;

  /**
   * Custom format for value display
   */
  formatValue?: (value: number) => string;

  /**
   * Animation duration in ms (0 to disable)
   */
  animationDuration?: number;
}

/**
 * ProgressRing component
 */
const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className,
      size = 'md',
      value,
      max = 100,
      color = 'primary',
      showValue = true,
      label,
      formatValue,
      animationDuration = 500,
      ...props
    },
    ref
  ) => {
    const [animatedValue, setAnimatedValue] = React.useState(0);

    // Get configurations
    const sizeConfig = sizeConfigs[size || 'md'];
    const colorConfig = colorConfigs[color];

    // Calculate values
    const normalizedValue = Math.min(Math.max(value, 0), max);
    const percentage = (normalizedValue / max) * 100;
    const circumference = 2 * Math.PI * sizeConfig.radius;
    const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

    // Animate on mount and value change
    React.useEffect(() => {
      if (animationDuration === 0) {
        setAnimatedValue(percentage);
        return;
      }

      const startTime = Date.now();
      const startValue = animatedValue;
      const endValue = percentage;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (endValue - startValue) * eased;

        setAnimatedValue(current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, [percentage, animationDuration]);

    // Format displayed value
    const displayValue = formatValue
      ? formatValue(normalizedValue)
      : Math.round(normalizedValue).toString();

    return (
      <div
        ref={ref}
        className={cn(progressRingVariants({ size }), className)}
        role="progressbar"
        aria-valuenow={normalizedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        {...props}
      >
        <svg
          width={sizeConfig.svgSize}
          height={sizeConfig.svgSize}
          viewBox={`0 0 ${sizeConfig.svgSize} ${sizeConfig.svgSize}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={sizeConfig.svgSize / 2}
            cy={sizeConfig.svgSize / 2}
            r={sizeConfig.radius}
            fill="none"
            stroke={colorConfig.background}
            strokeWidth={sizeConfig.strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={sizeConfig.svgSize / 2}
            cy={sizeConfig.svgSize / 2}
            r={sizeConfig.radius}
            fill="none"
            stroke={colorConfig.stroke}
            strokeWidth={sizeConfig.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>

        {/* Center content */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-bold', sizeConfig.fontSize, colorConfig.text)}>
              {displayValue}
            </span>
            {label && size !== 'xs' && size !== 'sm' && (
              <span className="text-xs text-th-text-m">{label}</span>
            )}
          </div>
        )}
      </div>
    );
  }
);

ProgressRing.displayName = 'ProgressRing';

export { ProgressRing, progressRingVariants };
