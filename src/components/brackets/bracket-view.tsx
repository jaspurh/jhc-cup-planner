'use client'

import { ScheduledMatch, StageType } from '@/types'
import { GSLBracket, GSLBracketCompact } from './gsl-bracket'
import { SingleEliminationBracket, SingleEliminationBracketCompact } from './single-elimination-bracket'
import { DoubleEliminationBracket, DoubleEliminationBracketCompact } from './double-elimination-bracket'

interface BracketViewProps {
  matches: ScheduledMatch[]
  stageType: StageType
  stageName?: string
  groupName?: string
  compact?: boolean
}

/**
 * Main bracket visualization component
 * Routes to the appropriate bracket type based on stage type
 */
export function BracketView({ 
  matches, 
  stageType, 
  stageName, 
  groupName,
  compact = false 
}: BracketViewProps) {
  // Determine which bracket component to use
  switch (stageType) {
    case 'GSL_GROUPS':
      return compact 
        ? <GSLBracketCompact matches={matches} groupName={groupName || stageName} />
        : <GSLBracket matches={matches} groupName={groupName || stageName} />
    
    case 'DOUBLE_ELIMINATION':
      return compact
        ? <DoubleEliminationBracketCompact matches={matches} stageName={stageName} />
        : <DoubleEliminationBracket matches={matches} stageName={stageName} />
    
    case 'KNOCKOUT':
    case 'FINAL':
      return compact
        ? <SingleEliminationBracketCompact matches={matches} stageName={stageName} />
        : <SingleEliminationBracket matches={matches} stageName={stageName} />
    
    default:
      // For group stages and round robin, we don't show a bracket
      // (they use the standings table instead)
      return (
        <div className="text-gray-500 text-sm p-4">
          Bracket view not available for {stageType} stages
        </div>
      )
  }
}

/**
 * Check if a stage type supports bracket visualization
 */
export function supportsBracketView(stageType: StageType): boolean {
  return ['GSL_GROUPS', 'KNOCKOUT', 'DOUBLE_ELIMINATION', 'FINAL'].includes(stageType)
}

// Re-export individual bracket components
export { GSLBracket, GSLBracketCompact } from './gsl-bracket'
export { SingleEliminationBracket, SingleEliminationBracketCompact } from './single-elimination-bracket'
export { DoubleEliminationBracket, DoubleEliminationBracketCompact } from './double-elimination-bracket'
export { MatchCard } from './match-card'
