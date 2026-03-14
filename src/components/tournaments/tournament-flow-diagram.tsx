/**
 * TournamentFlowDiagram
 *
 * A visual pipeline showing tournament stages connected by advancement arrows.
 * CSS-only layout — no SVG coordinate math.
 */

import { formatStageType } from '@/lib/constants'

interface StageInfo {
  id: string
  name: string
  type: string
  order: number
  configuration?: Record<string, unknown> | null
  groups: { id: string; name: string; teams: { id: string }[] }[]
  matchCount: number
}

interface TournamentFlowDiagramProps {
  stages: StageInfo[]
}

function getStageColor(type: string): string {
  switch (type) {
    case 'GROUP_STAGE':
      return 'bg-blue-50 border-blue-200 text-blue-800'
    case 'GSL_GROUPS':
      return 'bg-purple-50 border-purple-200 text-purple-800'
    case 'ROUND_ROBIN':
      return 'bg-cyan-50 border-cyan-200 text-cyan-800'
    case 'KNOCKOUT':
      return 'bg-orange-50 border-orange-200 text-orange-800'
    case 'DOUBLE_ELIMINATION':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'FINAL':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800'
  }
}

function getAdvancementLabel(fromStage: StageInfo, toStage: StageInfo): string {
  const config = fromStage.configuration as Record<string, unknown> | null | undefined
  const advancingCount = config?.advancingTeamsPerGroup as number | undefined
  const groupCount = fromStage.groups.length

  if (fromStage.type === 'GROUP_STAGE' || fromStage.type === 'GSL_GROUPS') {
    if (advancingCount && groupCount) {
      const total = advancingCount * groupCount
      return `Top ${advancingCount}/group → ${total} teams`
    }
    if (groupCount > 0) {
      return `Top teams from ${groupCount} groups`
    }
  }

  if (fromStage.type === 'ROUND_ROBIN') {
    return 'Top teams advance'
  }

  if (fromStage.type === 'KNOCKOUT' || fromStage.type === 'DOUBLE_ELIMINATION') {
    return 'Winners advance'
  }

  return '→'
}

function StageCard({ stage }: { stage: StageInfo }) {
  const colorClass = getStageColor(stage.type)
  const hasGroups = stage.groups.length > 0

  return (
    <div className={`rounded-lg border-2 p-3 min-w-[140px] max-w-[180px] ${colorClass}`}>
      <p className="font-semibold text-sm leading-tight">{stage.name}</p>
      <p className="text-xs opacity-70 mt-0.5">{formatStageType(stage.type)}</p>
      {hasGroups && (
        <div className="mt-2 flex flex-wrap gap-1">
          {stage.groups.slice(0, 4).map(g => (
            <span
              key={g.id}
              className="text-xs bg-white/60 px-1.5 py-0.5 rounded border border-current/20"
            >
              {g.name}
            </span>
          ))}
          {stage.groups.length > 4 && (
            <span className="text-xs opacity-60">+{stage.groups.length - 4}</span>
          )}
        </div>
      )}
      {stage.matchCount > 0 && (
        <p className="text-xs opacity-60 mt-1.5">{stage.matchCount} matches</p>
      )}
    </div>
  )
}

export function TournamentFlowDiagram({ stages }: TournamentFlowDiagramProps) {
  if (stages.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
        No stages configured yet. Add stages below to see the tournament flow.
      </div>
    )
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max">
        {sorted.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <StageCard stage={stage} />
            {index < sorted.length - 1 && (
              <div className="flex flex-col items-center px-2 min-w-[80px]">
                {/* Arrow line */}
                <div className="flex items-center w-full">
                  <div className="flex-1 h-0.5 bg-gray-300" />
                  <div
                    className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-gray-400"
                    style={{ borderLeftWidth: 8 }}
                  />
                </div>
                {/* Label */}
                <p className="text-xs text-gray-400 mt-1 text-center leading-tight max-w-[80px]">
                  {getAdvancementLabel(stage, sorted[index + 1])}
                </p>
              </div>
            )}
          </div>
        ))}
        {/* Trophy at the end */}
        {sorted.length > 0 && (
          <div className="pl-2 text-2xl" title="Champion">
            🏆
          </div>
        )}
      </div>
    </div>
  )
}
