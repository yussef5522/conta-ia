'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  email: string
  url: string
  onClose: () => void
}

export function LinkConviteModal({ email, url, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>✅ Convite criado!</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">
            Convite gerado pra <strong>{email}</strong>.
          </p>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              🔗 Link do convite (válido por 7 dias):
            </p>
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-3 text-xs">
            📤 Envie este link pelo WhatsApp, email ou outro canal preferido. Ao clicar, o
            convidado faz login (ou cadastro) e ganha acesso à empresa automaticamente.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
