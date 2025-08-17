import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// CSS variable utilities for theme colors
export const themeColors = {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  accent: 'hsl(var(--accent))',
  accentForeground: 'hsl(var(--accent-foreground))',
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  popover: 'hsl(var(--popover))',
  popoverForeground: 'hsl(var(--popover-foreground))',
}