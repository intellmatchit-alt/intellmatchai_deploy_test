/**
 * Tailwind CSS Configuration
 *
 * Extends the default Tailwind config with custom design tokens.
 *
 * @type {import('tailwindcss').Config}
 */

import type { Config } from 'tailwindcss';
import { colors, borderRadius, shadows, typography, spacing } from './src/styles/themes/tokens';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Safelist ensures these classes are always compiled (needed for CVA variants)
  safelist: [
    // Primary color variants (used in Button, Avatar, etc.)
    { pattern: /^bg-primary-(50|100|500|600|700)$/ },
    { pattern: /^text-primary-(500|700)$/ },
    { pattern: /^hover:bg-primary-(50|100|600)$/ },
    { pattern: /^active:bg-primary-(100|700)$/ },
    { pattern: /^border-primary-500$/ },
    { pattern: /^ring-primary-500$/ },
    { pattern: /^focus-visible:ring-primary-500$/ },
    // Emerald accent variants (used across themed components)
    { pattern: /^bg-emerald-(50|100|200|400|500|600|700|800|900|950)$/ },
    { pattern: /^text-emerald-(100|200|300|400|500)$/ },
    { pattern: /^border-emerald-(400|500)$/ },
    { pattern: /^from-emerald-(400|500|600)$/ },
    { pattern: /^to-emerald-(400|500|600)$/ },
    { pattern: /^to-teal-(400|500|600)$/ },
    { pattern: /^from-teal-(400|500)$/ },
    { pattern: /^via-teal-400$/ },
    // Error color variants (used in danger buttons)
    { pattern: /^bg-error-(50|100|500|600|700)$/ },
    { pattern: /^text-error-500$/ },
    { pattern: /^hover:bg-error-(50|600)$/ },
    { pattern: /^active:bg-error-(100|700)$/ },
    { pattern: /^border-error-500$/ },
    // Success color variants
    { pattern: /^bg-success-(500|600|700)$/ },
    { pattern: /^hover:bg-success-600$/ },
    { pattern: /^active:bg-success-700$/ },
    // Warning color variants
    { pattern: /^bg-warning-(500|600|700)$/ },
    { pattern: /^text-warning-(500|600)$/ },
  ],
  // Enable dark mode via class
  darkMode: 'class',
  theme: {
    extend: {
      // Colors from design tokens
      colors: {
        primary: colors.primary,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        neutral: colors.neutral,
        background: colors.background,
        foreground: colors.text,
        border: colors.border.default,
        input: colors.border.default,
        ring: colors.primary[500],

        // Theme-aware semantic colors (CSS variables switch with light/dark)
        'th-bg': 'var(--color-bg-primary)',
        'th-bg-s': 'var(--color-bg-secondary)',
        'th-bg-t': 'var(--color-bg-tertiary)',
        'th-surface': 'var(--color-bg-surface)',
        'th-surface-h': 'var(--color-bg-surface-hover)',
        'th-nav-header': 'var(--color-nav-bg-header)',
        'th-nav-bottom': 'var(--color-nav-bg-bottom)',
        'th-text': 'var(--color-text-primary)',
        'th-text-s': 'var(--color-text-secondary)',
        'th-text-t': 'var(--color-text-tertiary)',
        'th-text-m': 'var(--color-text-muted)',
        'th-border': 'var(--color-border-primary)',
        'th-border-s': 'var(--color-border-secondary)',
      },

      // Typography
      fontFamily: {
        sans: [typography.fontFamily.sans],
        arabic: [typography.fontFamily.arabic],
        mono: [typography.fontFamily.mono],
      },

      // Border radius
      borderRadius: {
        ...borderRadius,
      },

      // Shadows
      boxShadow: {
        ...shadows,
      },

      // Spacing (extending default, excluding non-string values)
      spacing: Object.fromEntries(
        Object.entries(spacing).filter(([, v]) => typeof v === 'string')
      ) as Record<string, string>,

      // Animations
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-out-bottom': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.85)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '70%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-out-right': 'slide-out-right 0.3s ease-out',
        'slide-in-bottom': 'slide-in-bottom 0.3s ease-out',
        'slide-out-bottom': 'slide-out-bottom 0.3s ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up-fade': 'slide-up-fade 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s ease-out both',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [
    // RTL support plugin
    function ({ addUtilities }: any) {
      addUtilities({
        // Logical properties for RTL support
        '.ms-auto': { 'margin-inline-start': 'auto' },
        '.me-auto': { 'margin-inline-end': 'auto' },
        '.ps-0': { 'padding-inline-start': '0' },
        '.pe-0': { 'padding-inline-end': '0' },
        '.ps-4': { 'padding-inline-start': '1rem' },
        '.pe-4': { 'padding-inline-end': '1rem' },
        '.start-0': { 'inset-inline-start': '0' },
        '.end-0': { 'inset-inline-end': '0' },
        '.text-start': { 'text-align': 'start' },
        '.text-end': { 'text-align': 'end' },
        '.border-s': { 'border-inline-start-width': '1px' },
        '.border-e': { 'border-inline-end-width': '1px' },
        '.rounded-s': { 'border-start-start-radius': '0.25rem', 'border-end-start-radius': '0.25rem' },
        '.rounded-e': { 'border-start-end-radius': '0.25rem', 'border-end-end-radius': '0.25rem' },
      });
    },
  ],
};

export default config;
