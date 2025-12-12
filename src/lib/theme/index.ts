/**
 * Theme Configuration
 * 
 * This file centralizes all theming and branding configuration.
 * - Color presets for event organizers to choose from
 * - Helper functions for generating CSS variables
 * - Default theme values
 * 
 * MAINTAINER NOTE: All color/branding related code should live here.
 */

// ===========================================
// Color Presets
// ===========================================

export interface ColorPreset {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
}

/**
 * Pre-defined color presets that organizers can choose from.
 * Each preset is designed for readability and visual appeal.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'blue',
    name: 'Classic Blue',
    primary: '#0066cc',
    secondary: '#004499',
    accent: '#00aaff',
  },
  {
    id: 'green',
    name: 'Forest Green',
    primary: '#228B22',
    secondary: '#1a6b1a',
    accent: '#32cd32',
  },
  {
    id: 'red',
    name: 'Crimson Red',
    primary: '#dc2626',
    secondary: '#b91c1c',
    accent: '#f87171',
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    primary: '#7c3aed',
    secondary: '#5b21b6',
    accent: '#a78bfa',
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    primary: '#ea580c',
    secondary: '#c2410c',
    accent: '#fb923c',
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    primary: '#0d9488',
    secondary: '#0f766e',
    accent: '#2dd4bf',
  },
  {
    id: 'pink',
    name: 'Hot Pink',
    primary: '#db2777',
    secondary: '#be185d',
    accent: '#f472b6',
  },
  {
    id: 'slate',
    name: 'Professional Slate',
    primary: '#475569',
    secondary: '#334155',
    accent: '#94a3b8',
  },
]

// ===========================================
// Default Theme (Admin pages)
// ===========================================

/**
 * Default theme used for admin/dashboard pages.
 * This should remain consistent for all users.
 */
export const DEFAULT_ADMIN_THEME = {
  primary: '#2563eb',     // Blue 600
  secondary: '#1d4ed8',   // Blue 700
  accent: '#3b82f6',      // Blue 500
  background: '#f9fafb',  // Gray 50
  surface: '#ffffff',
  text: '#111827',        // Gray 900
  textMuted: '#6b7280',   // Gray 500
  border: '#e5e7eb',      // Gray 200
  success: '#22c55e',     // Green 500
  warning: '#f59e0b',     // Amber 500
  error: '#ef4444',       // Red 500
}

// ===========================================
// Event Branding Type
// ===========================================

export interface EventBranding {
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}

// ===========================================
// Theme Helpers
// ===========================================

/**
 * Validates a hex color code
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Get a preset by ID
 */
export function getPresetById(presetId: string): ColorPreset | undefined {
  return COLOR_PRESETS.find(p => p.id === presetId)
}

/**
 * Generate CSS custom properties from branding
 * Returns an object suitable for use as inline styles
 */
export function getBrandingStyles(branding: EventBranding): React.CSSProperties {
  const preset = COLOR_PRESETS[0] // Default to first preset
  
  return {
    '--brand-primary': branding.primaryColor || preset.primary,
    '--brand-secondary': branding.secondaryColor || preset.secondary,
    '--brand-accent': branding.accentColor || preset.accent,
  } as React.CSSProperties
}

/**
 * Generate a CSS string with branding variables
 * Useful for <style> tags or CSS-in-JS
 */
export function getBrandingCSSVariables(branding: EventBranding): string {
  const preset = COLOR_PRESETS[0]
  
  return `
    --brand-primary: ${branding.primaryColor || preset.primary};
    --brand-secondary: ${branding.secondaryColor || preset.secondary};
    --brand-accent: ${branding.accentColor || preset.accent};
  `.trim()
}

/**
 * Calculate contrasting text color (black or white) for a given background
 */
export function getContrastingTextColor(hexColor: string): 'white' | 'black' {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  return luminance > 0.5 ? 'black' : 'white'
}

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hexColor: string, percent: number): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)))
  const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)))
  const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)))
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hexColor: string, percent: number): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  const newR = Math.max(0, Math.round(r * (1 - percent / 100)))
  const newG = Math.max(0, Math.round(g * (1 - percent / 100)))
  const newB = Math.max(0, Math.round(b * (1 - percent / 100)))
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}
