'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { updateEvent } from '@/actions/event'
import { COLOR_PRESETS, type ColorPreset } from '@/lib/theme'

interface BrandingSettingsProps {
  eventId: string
  initialBranding: {
    logoUrl: string | null
    primaryColor: string | null
    secondaryColor: string | null
    accentColor: string | null
  }
}

export function BrandingSettings({ eventId, initialBranding }: BrandingSettingsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl || '')
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primaryColor || COLOR_PRESETS[0].primary)
  const [secondaryColor, setSecondaryColor] = useState(initialBranding.secondaryColor || COLOR_PRESETS[0].secondary)
  const [accentColor, setAccentColor] = useState(initialBranding.accentColor || COLOR_PRESETS[0].accent)

  function applyPreset(preset: ColorPreset) {
    setPrimaryColor(preset.primary)
    setSecondaryColor(preset.secondary)
    setAccentColor(preset.accent)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const result = await updateEvent(eventId, {
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      accentColor: accentColor || null,
    })

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      router.refresh()
    } else {
      setError(result.error || 'Failed to update branding')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Branding</CardTitle>
        <CardDescription>
          Customize the look of your public event pages. These colors will be used on the 
          tournament wiki and results pages visible to spectators.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
              Branding updated successfully!
            </div>
          )}

          {/* Logo URL */}
          <div>
            <Input
              label="Logo URL"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended: 200x60px PNG or SVG with transparent background
            </p>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="group relative p-2 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors"
                  title={preset.name}
                >
                  <div className="flex gap-1">
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1 block truncate">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Custom Colors
            </label>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Primary</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#0066cc"
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Secondary</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#004499"
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Accent</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#00aaff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` 
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-bold">Sample Event Name</div>
                <button 
                  type="button"
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{ 
                    backgroundColor: accentColor,
                    color: 'white'
                  }}
                >
                  View Results
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" loading={loading}>
            Save Branding
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
