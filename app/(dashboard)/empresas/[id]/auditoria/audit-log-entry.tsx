'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  formatActionLabel,
  formatEntityLabel,
  formatFieldLabel,
  formatValue,
} from '@/lib/audit-formatters'

interface AuditLog {
  id: string
  timestamp: string
  userId: string | null
  userName: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  fieldsChanged: Record<string, { before: unknown; after: unknown }> | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
}

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
}

export function AuditLogEntry({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)

  const action = formatActionLabel(log.action)
  const entityName = formatEntityLabel(log.entityType)
  const date = new Date(log.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })

  const fieldEntries = log.fieldsChanged ? Object.entries(log.fieldsChanged) : []
  const visibleFields = expanded ? fieldEntries : fieldEntries.slice(0, 3)
  const hasMoreFields = fieldEntries.length > 3

  return (
    <Card className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${COLOR_CLASSES[action.color]}`}
        >
          {action.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium">{log.userName}</span>
            <Badge variant="outline" className="text-xs">
              {action.verb}
            </Badge>
            <span className="text-sm">{entityName}</span>
            {log.metadata && typeof log.metadata.name === 'string' && (
              <span className="text-sm text-muted-foreground">
                &quot;{log.metadata.name}&quot;
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{date}</span>
            <span>·</span>
            <span>{log.userEmail}</span>
            {log.ipAddress && (
              <>
                <span>·</span>
                <span className="font-mono text-[10px]">IP: {log.ipAddress}</span>
              </>
            )}
          </div>

          {fieldEntries.length > 0 && (
            <div className="mt-3 space-y-1 text-sm">
              {visibleFields.map(([field, change]) => (
                <div key={field} className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-medium text-xs">{formatFieldLabel(field)}:</span>
                  <span className="text-muted-foreground line-through text-xs">
                    {formatValue(change.before)}
                  </span>
                  <span className="text-xs">→</span>
                  <span className="text-xs">{formatValue(change.after)}</span>
                </div>
              ))}

              {hasMoreFields && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Ver mais {fieldEntries.length - 3} campos
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
