'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createBulkInvitations } from '@/actions/invitation'

interface CSVImportProps {
  tournamentId: string
  tournamentName: string
}

interface ParsedRow {
  contactEmail: string
  contactName?: string
  teamName?: string
}

export function CSVImport({ tournamentId }: CSVImportProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  function parseCSV(content: string): ParsedRow[] {
    const lines = content.trim().split('\n')
    if (lines.length === 0) return []

    // Check if first row is header
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('email') || firstLine.includes('name')
    const dataLines = hasHeader ? lines.slice(1) : lines

    const rows: ParsedRow[] = []
    
    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
      
      // Try to detect column order
      // Common formats: email,name,team OR name,email,team
      const emailIndex = parts.findIndex(p => p.includes('@'))
      if (emailIndex === -1) continue

      const email = parts[emailIndex]
      if (!email.includes('@')) continue
      
      const otherParts = parts.filter((_, i) => i !== emailIndex)

      rows.push({
        contactEmail: email,
        contactName: otherParts[0] || undefined,
        teamName: otherParts[1] || undefined,
      })
    }
    
    return rows
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setResult(null)
    setPreview([])

    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const parsed = parseCSV(content)
      
      if (parsed.length === 0) {
        setError('No valid email addresses found in CSV')
        return
      }

      setPreview(parsed)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (preview.length === 0) return

    setLoading(true)
    setError(null)

    const importResult = await createBulkInvitations({
      tournamentId,
      invitations: preview,
    })

    setLoading(false)

    if (importResult.success && importResult.data) {
      setResult(importResult.data)
      setPreview([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      router.refresh()
    } else {
      setError(importResult.error || 'Failed to import invitations')
    }
  }

  function handleClear() {
    setPreview([])
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from CSV</CardTitle>
        <CardDescription>
          Upload a CSV file with columns: email, name (optional), team name (optional)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-50 rounded-lg mb-4">
            <p className="font-medium text-green-800">Import Complete</p>
            <ul className="text-sm text-green-700 mt-1">
              <li>✓ {result.created} invitations sent</li>
              {result.skipped > 0 && <li>⏭ {result.skipped} skipped (already invited)</li>}
              {result.errors.length > 0 && (
                <li className="text-red-600">✗ {result.errors.length} failed</li>
              )}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example format: email@example.com, John Doe, Team Name
            </p>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <span className="text-sm font-medium">
                  Preview ({preview.length} invitations)
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2">Email</th>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Team</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">{row.contactEmail}</td>
                        <td className="px-4 py-2 text-gray-500">{row.contactName || '-'}</td>
                        <td className="px-4 py-2 text-gray-500">{row.teamName || '-'}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-gray-400 text-center">
                          ... and {preview.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={handleImport} loading={loading}>
                Send {preview.length} Invitations
              </Button>
              <Button variant="secondary" onClick={handleClear}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
