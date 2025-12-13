'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClub, updateClub } from '@/actions/club'
import { COLOR_PRESETS } from '@/lib/theme'
import type { ClubWithAdmins } from '@/types'

interface ClubFormProps {
  club?: ClubWithAdmins
}

export function ClubForm({ club }: ClubFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState(club?.primaryColor || '')
  const [secondaryColor, setSecondaryColor] = useState(club?.secondaryColor || '')

  const isEditing = !!club

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const data = {
      name: formData.get('name') as string,
      fullName: formData.get('fullName') as string || null,
      country: formData.get('country') as string || null,
      region: formData.get('region') as string || null,
      logoUrl: formData.get('logoUrl') as string || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
    }

    const result = isEditing 
      ? await updateClub(club.id, data)
      : await createClub(data)

    setLoading(false)

    if (result.success) {
      router.push('/admin/clubs')
      router.refresh()
    } else {
      setError(result.error || 'Failed to save club')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Club' : 'Add New Club'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="name"
              label="Short Name *"
              placeholder="e.g., HB, B68"
              defaultValue={club?.name}
              required
            />

            <Input
              name="fullName"
              label="Full Name"
              placeholder="e.g., Havnar Bóltfelag"
              defaultValue={club?.fullName || ''}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="country"
              label="Country"
              placeholder="e.g., Faroe Islands"
              defaultValue={club?.country || ''}
            />

            <Input
              name="region"
              label="Region"
              placeholder="e.g., Tórshavn"
              defaultValue={club?.region || ''}
            />
          </div>

          <Input
            name="logoUrl"
            label="Logo URL"
            type="url"
            placeholder="https://example.com/logo.png"
            defaultValue={club?.logoUrl || ''}
          />

          {/* Color Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Club Colors</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor || '#3b82f6'}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor || '#ffffff'}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Color Presets */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">Quick presets:</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary)
                      setSecondaryColor(preset.secondary)
                    }}
                    className="px-3 py-1 text-xs rounded-full border hover:border-gray-400 transition-colors"
                    style={{ 
                      backgroundColor: preset.primary,
                      color: preset.secondary,
                      borderColor: preset.primary
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          {(primaryColor || club?.name) && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-500 mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{ 
                    backgroundColor: primaryColor || '#6b7280',
                    color: secondaryColor || '#ffffff'
                  }}
                >
                  {(club?.name || 'AB').charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{club?.name || 'Club Name'}</p>
                  <p className="text-sm text-gray-500">{club?.fullName || 'Full Club Name'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>
              {isEditing ? 'Save Changes' : 'Create Club'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
