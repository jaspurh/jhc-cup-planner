'use client'

import { ScheduledMatch } from '@/types'
import { MatchCard } from './match-card'

interface GSLBracketProps {
  matches: ScheduledMatch[]
  groupName?: string
  compact?: boolean
}

/**
 * GSL Group bracket visualization
 */
export function GSLBracket({ matches, groupName, compact = false }: GSLBracketProps) {
  const m1 = matches.find(m => m.bracketPosition === 'M1')
  const m2 = matches.find(m => m.bracketPosition === 'M2')
  const m3 = matches.find(m => m.bracketPosition === 'M3')
  const m4 = matches.find(m => m.bracketPosition === 'M4')
  const m5 = matches.find(m => m.bracketPosition === 'M5')

  if (!m1 || !m2 || !m3 || !m4 || !m5) {
    return (
      <div className="text-gray-500 text-sm p-4">
        Incomplete GSL bracket data
      </div>
    )
  }

  // Layout dimensions
  const cardW = compact ? 150 : 180
  const cardH = compact ? 100 : 125  // Card height including penalty row
  const labelH = 24 // Height for match labels (M1, M2, etc.)
  const gapX = compact ? 40 : 56  // Horizontal gap between columns
  const gapY = compact ? 12 : 20  // Vertical gap between matches

  // Calculate positions
  // Column 1: M1, M2 stacked
  const col1X = 0
  const m1Y = 0
  const m2Y = cardH + labelH + gapY

  // Column 2: M3 centered between M1/M2, M4 below
  const col2X = cardW + gapX
  const m3Y = (m1Y + m2Y) / 2  // Centered between M1 and M2
  const m4Y = m2Y + cardH + labelH + gapY

  // Column 3: M5 centered between M3 and M4
  const col3X = (cardW + gapX) * 2
  const m5Y = (m3Y + m4Y) / 2  // Centered between M3 and M4

  // Total dimensions
  const totalW = cardW * 3 + gapX * 2
  const totalH = m4Y + cardH + labelH + 10

  // Helper to get center Y of a card
  const centerY = (topY: number) => topY + cardH / 2

  return (
    <div className="p-4">
      {groupName && (
        <h4 className="font-semibold text-gray-900 mb-3">{groupName}</h4>
      )}

      {/* Column Headers */}
      <div className="flex mb-2 text-xs text-gray-500 font-medium">
        <div style={{ width: cardW }} className="text-center">Opening</div>
        <div style={{ width: gapX }} />
        <div style={{ width: cardW }} className="text-center">Winners / Losers</div>
        <div style={{ width: gapX }} />
        <div style={{ width: cardW }} className="text-center">Decider</div>
      </div>

      {/* SVG Container with absolute positioned match cards */}
      <div className="relative" style={{ width: totalW, height: totalH }}>
        
        {/* SVG for all connecting lines */}
        <svg 
          className="absolute top-0 left-0 pointer-events-none"
          width={totalW} 
          height={totalH}
        >
          {/* M1 Winner → M3 (solid line) */}
          <path 
            d={`
              M ${col1X + cardW} ${centerY(m1Y)}
              L ${col1X + cardW + gapX * 0.6} ${centerY(m1Y)}
              L ${col1X + cardW + gapX * 0.6} ${centerY(m3Y)}
              L ${col2X} ${centerY(m3Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2"
          />
          
          {/* M2 Winner → M3 (solid line) */}
          <path 
            d={`
              M ${col1X + cardW} ${centerY(m2Y)}
              L ${col1X + cardW + gapX * 0.6} ${centerY(m2Y)}
              L ${col1X + cardW + gapX * 0.6} ${centerY(m3Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2"
          />
          
          {/* M1 Loser → M4 (dashed line) */}
          <path 
            d={`
              M ${col1X + cardW} ${centerY(m1Y)}
              L ${col1X + cardW + gapX * 0.3} ${centerY(m1Y)}
              L ${col1X + cardW + gapX * 0.3} ${centerY(m4Y)}
              L ${col2X} ${centerY(m4Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3"
          />
          
          {/* M2 Loser → M4 (dashed line, connects to vertical) */}
          <path 
            d={`
              M ${col1X + cardW} ${centerY(m2Y)}
              L ${col1X + cardW + gapX * 0.3} ${centerY(m2Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3"
          />
          
          {/* M3 Loser → M5 (dashed line) */}
          <path 
            d={`
              M ${col2X + cardW} ${centerY(m3Y)}
              L ${col2X + cardW + gapX * 0.4} ${centerY(m3Y)}
              L ${col2X + cardW + gapX * 0.4} ${centerY(m5Y)}
              L ${col3X} ${centerY(m5Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3"
          />
          
          {/* M4 Winner → M5 (solid line) */}
          <path 
            d={`
              M ${col2X + cardW} ${centerY(m4Y)}
              L ${col2X + cardW + gapX * 0.7} ${centerY(m4Y)}
              L ${col2X + cardW + gapX * 0.7} ${centerY(m5Y)}
              L ${col3X} ${centerY(m5Y)}
            `}
            fill="none" stroke="#9ca3af" strokeWidth="2"
          />
        </svg>

        {/* M1 - Opening Match 1 */}
        <div className="absolute" style={{ left: col1X, top: m1Y, width: cardW }}>
          <MatchCard match={m1} compact={compact} />
          <div className="text-xs text-gray-400 text-center mt-1">M1</div>
        </div>

        {/* M2 - Opening Match 2 */}
        <div className="absolute" style={{ left: col1X, top: m2Y, width: cardW }}>
          <MatchCard match={m2} compact={compact} />
          <div className="text-xs text-gray-400 text-center mt-1">M2</div>
        </div>

        {/* M3 - Winners Match */}
        <div className="absolute" style={{ left: col2X, top: m3Y, width: cardW }}>
          <MatchCard match={m3} compact={compact} />
          <div className="text-xs text-gray-400 text-center mt-1">M3 - Winners</div>
        </div>

        {/* M4 - Losers/Elimination Match */}
        <div className="absolute" style={{ left: col2X, top: m4Y, width: cardW }}>
          <MatchCard match={m4} compact={compact} />
          <div className="text-xs text-gray-400 text-center mt-1">M4 - Elimination</div>
        </div>

        {/* M5 - Decider Match */}
        <div className="absolute" style={{ left: col3X, top: m5Y, width: cardW }}>
          <MatchCard match={m5} compact={compact} />
          <div className="text-xs text-gray-400 text-center mt-1">M5 - Decider</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t-2 border-gray-400" />
          <span>Winner</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t-2 border-dashed border-gray-400" />
          <span>Loser</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact GSL bracket for quick standings
 */
export function GSLBracketCompact({ matches, groupName }: GSLBracketProps) {
  return <GSLBracket matches={matches} groupName={groupName} compact={true} />
}
