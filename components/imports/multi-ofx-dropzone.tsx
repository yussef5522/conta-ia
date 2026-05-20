'use client'

// MultiOfxDropZone — Sprint 2.4 Onda 2.
// Drag-and-drop multi-arquivo OFX/QFX com progress bar individual.

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatFileSize } from '@/lib/ofx/format-imports'

type FileStatus = 'pending' | 'uploading' | 'success' | 'failed' | 'empty'

interface FileSlot {
  id: string
  file: File
  status: FileStatus
  resultado?: {
    novas: number
    duplicadas: number
    autoClassificadas: number
  }
  erro?: string
}

interface Props {
  bankAccountId: string
  onComplete?: (resumo: {
    sucesso: number
    falhados: number
    totalNovas: number
  }) => void
}

export function MultiOfxDropZone({ bankAccountId, onComplete }: Props) {
  const { toast } = useToast()
  const [files, setFiles] = useState<FileSlot[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const addFiles = useCallback((selected: File[]) => {
    const valid = selected.filter((f) =>
      /\.(ofx|qfx|ofc)$/i.test(f.name),
    )
    const rejected = selected.length - valid.length
    if (rejected > 0) {
      toast({
        variant: 'destructive',
        title: 'Arquivos ignorados',
        description: `${rejected} arquivo${rejected === 1 ? '' : 's'} sem extensão .ofx / .qfx / .ofc`,
      })
    }
    if (valid.length === 0) return
    setFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        file: f,
        status: 'pending' as FileStatus,
      })),
    ])
  }, [toast])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      addFiles(Array.from(e.dataTransfer.files))
    },
    [addFiles],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const reset = useCallback(() => {
    setFiles([])
  }, [])

  async function handleUpload() {
    if (files.length === 0 || uploading) return
    setUploading(true)
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading' } : f,
      ),
    )

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f.file))

    try {
      const res = await fetch(
        `/api/contas-bancarias/${bankAccountId}/importar-ofx-multiplos`,
        { method: 'POST', body: formData },
      )
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: json.erro ?? 'Falha ao importar.',
        })
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'failed' as FileStatus,
            erro: json.erro,
          })),
        )
        return
      }

      // Mapeia resultados por fileName (sequencial garante ordem)
      const byName = new Map<string, (typeof json.results)[number]>()
      for (const r of json.results) {
        if (!byName.has(r.fileName)) byName.set(r.fileName, r)
      }

      setFiles((prev) =>
        prev.map((slot) => {
          const r = byName.get(slot.file.name)
          if (!r) return { ...slot, status: 'failed', erro: 'Sem resposta' }
          if (r.status === 'EMPTY') {
            return { ...slot, status: 'empty', erro: r.erro }
          }
          if (r.status === 'FAILED') {
            return { ...slot, status: 'failed', erro: r.erro }
          }
          return {
            ...slot,
            status: 'success',
            resultado: {
              novas: r.novas ?? 0,
              duplicadas: r.duplicadas ?? 0,
              autoClassificadas: r.autoClassificadas ?? 0,
            },
          }
        }),
      )

      const resumo = json.resumo
      toast({
        title: `${resumo.sucesso}/${resumo.totalArquivos} arquivos OK`,
        description: `${resumo.totalNovas} nova${resumo.totalNovas === 1 ? '' : 's'} · ${resumo.totalDuplicadas} duplicada${resumo.totalDuplicadas === 1 ? '' : 's'} · ${resumo.totalAutoClassificadas} auto-classificada${resumo.totalAutoClassificadas === 1 ? '' : 's'}`,
      })

      onComplete?.({
        sucesso: resumo.sucesso,
        falhados: resumo.falhados,
        totalNovas: resumo.totalNovas,
      })
    } finally {
      setUploading(false)
    }
  }

  const pendentes = files.filter((f) => f.status === 'pending').length
  const sucessos = files.filter((f) => f.status === 'success').length
  const falhados = files.filter(
    (f) => f.status === 'failed' || f.status === 'empty',
  ).length

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">
          Arraste arquivos OFX, QFX ou OFC
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ou{' '}
          <label className="text-primary cursor-pointer underline">
            selecione no computador
            <input
              type="file"
              accept=".ofx,.qfx,.ofc"
              multiple
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []))
                e.currentTarget.value = ''
              }}
              className="hidden"
            />
          </label>
        </p>
        <p className="text-[10px] text-muted-foreground mt-2">
          Múltiplos arquivos · até 20 por vez · processados em sequência
        </p>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-3 text-muted-foreground">
                <span>
                  {files.length} arquivo{files.length === 1 ? '' : 's'}
                </span>
                {sucessos > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ {sucessos}
                  </span>
                )}
                {falhados > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    ✗ {falhados}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!uploading && (sucessos > 0 || falhados > 0) && (
                  <Button variant="outline" size="sm" onClick={reset}>
                    Limpar
                  </Button>
                )}
                {pendentes > 0 && (
                  <Button
                    size="sm"
                    onClick={() => void handleUpload()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Importando...
                      </>
                    ) : (
                      `Importar ${pendentes}`
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {files.map((slot) => (
                <FileItem
                  key={slot.id}
                  slot={slot}
                  onRemove={() => removeFile(slot.id)}
                  uploading={uploading}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FileItem({
  slot,
  onRemove,
  uploading,
}: {
  slot: FileSlot
  onRemove: () => void
  uploading: boolean
}) {
  const colorMap: Record<FileStatus, string> = {
    pending: 'border-muted',
    uploading: 'border-blue-500/40 bg-blue-500/5',
    success: 'border-emerald-500/40 bg-emerald-500/5',
    failed: 'border-rose-500/40 bg-rose-500/5',
    empty: 'border-amber-500/40 bg-amber-500/5',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-md border px-3 py-2 flex items-center gap-3 text-sm ${colorMap[slot.status]}`}
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs truncate">{slot.file.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(slot.file.size)}
          {slot.resultado && (
            <span className="ml-2 tabular-nums">
              · {slot.resultado.novas} nova
              {slot.resultado.novas === 1 ? '' : 's'} · {slot.resultado.duplicadas}{' '}
              dup · {slot.resultado.autoClassificadas} auto
            </span>
          )}
          {slot.erro && <span className="ml-2 text-rose-500">· {slot.erro}</span>}
        </p>
      </div>
      <div className="shrink-0">
        {slot.status === 'pending' && !uploading && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors text-xs"
          >
            Remover
          </button>
        )}
        {slot.status === 'uploading' && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        )}
        {slot.status === 'success' && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        {slot.status === 'failed' && <XCircle className="h-4 w-4 text-rose-500" />}
        {slot.status === 'empty' && (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
    </motion.div>
  )
}
