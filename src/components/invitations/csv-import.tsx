'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createBulkInvitations } from '@/actions/invitation'
import { addTeamsBulk } from '@/actions/team'

interface CSVImportProps {
  tournamentId: string
  tournamentName: string
}

interface ParsedRow {
  contactEmail?: string
  contactName?: string
  teamName?: string
}

type ImportMode = 'invite' | 'direct'

export function CSVImport({ tournamentId }: CSVImportProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<ImportMode>('invite')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  function parseCSV(content: string): ParsedRow[] {
    const lines = content.trim().split('\n')
    if (lines.length === 0) return []

    // Check if first row is header
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('email') || firstLine.includes('name') || firstLine.includes('team')
    const dataLines = hasHeader ? lines.slice(1) : lines

    const rows: ParsedRow[] = []
    
    for (const line of dataLines) {
      if (!line.trim()) continue
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
      
      // Try to detect column order
      const emailIndex = parts.findIndex(p => p.includes('@'))
      
      if (mode === 'invite') {
        // For invitations, email is required
        if (emailIndex === -1) continue
        const email = parts[emailIndex]
        if (!email.includes('@')) continue
        
        const otherParts = parts.filter((_, i) => i !== emailIndex)
        rows.push({
          contactEmail: email,
          contactName: otherParts[0] || undefined,
          teamName: otherParts[1] || undefined,
        })
      } else {
        // For direct add, team name is required
        // Format: team name, contact name, email (optional), phone (optional)
        if (parts.length === 0 || !parts[0].trim()) continue
        
        const teamName = parts[0]
        const contactName = parts[1] || undefined
        const email = emailIndex !== -1 ? parts[emailIndex] : undefined
        
        rows.push({
          teamName,
          contactName,
          contactEmail: email,
        })
      }
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
        if (mode === 'invite') {
          setError('No valid email addresses found in CSV')
        } else {
          setError('No valid team names found in CSV')
        }
        return
      }

      setPreview(parsed)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (preview.length === 0) return

    setError(null)

    if (mode === 'invite') {
      // Filter to only rows with email
      const validRows = preview.filter(r => r.contactEmail)
      
      const importResult = await createBulkInvitations({
        tournamentId,
        invitations: validRows.map(r => ({
          contactEmail: r.contactEmail!,
          contactName: r.contactName,
          teamName: r.teamName,
        })),
      })

      if (importResult.success && importResult.data) {
        setResult(importResult.data)
        setPreview([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        startTransition(() => router.refresh())
      } else {
        setError(importResult.error || 'Failed to import invitations')
      }
    } else {
      // Filter to only rows with team name
      const validRows = preview.filter(r => r.teamName)
      
      const importResult = await addTeamsBulk({
        tournamentId,
        teams: validRows.map(r => ({
          teamName: r.teamName!,
          contactName: r.contactName,
          contactEmail: r.contactEmail,
        })),
      })

      if (importResult.success && importResult.data) {
        setResult(importResult.data)
        setPreview([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        startTransition(() => router.refresh())
      } else {
        setError(importResult.error || 'Failed to add teams')
      }
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

  function handleModeChange(newMode: ImportMode) {
    setMode(newMode)
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
        <CardTitle>Bulk Import from CSV</CardTitle>
        <CardDescription>
          {mode === 'invite' 
            ? 'Upload a CSV to send multiple invitations at once'
            : 'Upload a CSV to add multiple teams directly'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => handleModeChange('invite')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'invite'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📧 Send Invitations
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('direct')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'direct'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ➕ Add Directly
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-50 rounded-lg mb-4">
            <p className="font-medium text-green-800">Import Complete</p>
            <ul className="text-sm text-green-700 mt-1">
              <li>✓ {result.created} {mode === 'invite' ? 'invitations sent' : 'teams added'}</li>
              {result.skipped > 0 && (
                <li>⏭ {result.skipped} skipped ({mode === 'invite' ? 'already invited' : 'duplicate names'})</li>
              )}
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
              {mode === 'invite' 
                ? 'Format: email, name (optional), team name (optional)'
                : 'Format: team name, contact name, email (optional)'}
            </p>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <span className="text-sm font-medium">
                  Preview ({preview.length} {mode === 'invite' ? 'invitations' : 'teams'})
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {mode === 'direct' && <th className="text-left px-4 py-2">Team</th>}
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Email</th>
                      {mode === 'invite' && <th className="text-left px-4 py-2">Team</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {mode === 'direct' && (
                          <td className="px-4 py-2 font-medium text-gray-900">{row.teamName || '-'}</td>
                        )}
                        <td className="px-4 py-2 text-gray-700">{row.contactName || '-'}</td>
                        <td className="px-4 py-2 text-gray-500">{row.contactEmail || '-'}</td>
                        {mode === 'invite' && (
                          <td className="px-4 py-2 text-gray-500">{row.teamName || '-'}</td>
                        )}
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
              <Button onClick={handleImport} loading={isPending}>
                {mode === 'invite' 
                  ? `📧 Send ${preview.length} Invitations`
                  : `➕ Add ${preview.length} Teams`}
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
