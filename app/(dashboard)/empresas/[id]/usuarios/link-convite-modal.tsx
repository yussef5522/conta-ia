'use client'

// Modal Link Convite — Sprint 1.4.
// Premium: header com check verde, copy link com feedback visual, tip box.

import { useState } from 'react'
import { Copy, Check, MessageCircle, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    setTimeout(() => setCopied(false), 2500)
  }

  function whatsappLink() {
    const msg = encodeURIComponent(
      `Olá! Você foi convidado a fazer parte de nossa empresa no CAIXAOS. Aceite com este link (válido por 7 dias):\n\n${url}`,
    )
    return `https://wa.me/?text=${msg}`
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, #5DCAA5 0%, #1D9E75 100%)',
              }}
            >
              <Check className="h-3.5 w-3.5 text-white" />
            </span>
            Convite criado
          </DialogTitle>
          <DialogDescription>
            Link gerado pra <strong>{email}</strong>. Válido por 7 dias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Link copy */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Link do convite
            </p>
            <div className="flex gap-2">
              <Input
                value={url}
                readOnly
                className="font-mono text-xs h-10"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant={copied ? 'default' : 'outline'}
                size="sm"
                onClick={copyLink}
                className="shrink-0 h-10"
                style={copied ? { backgroundColor: '#1D9E75' } : undefined}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Tip box */}
          <div
            className="rounded-md border p-3 text-xs space-y-1.5"
            style={{
              background: 'rgba(24,95,165,0.06)',
              borderColor: 'rgba(24,95,165,0.25)',
            }}
          >
            <p className="font-medium" style={{ color: '#0C447C' }}>
              Como compartilhar
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Envie via WhatsApp, email ou outro canal. Ao clicar, a pessoa
              faz login (ou cria conta) e entra automaticamente.
            </p>
          </div>

          {/* WhatsApp button */}
          <Button
            asChild
            variant="outline"
            className="w-full h-10"
          >
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp com mensagem pronta
              <Send className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full" style={{ backgroundColor: '#185FA5' }}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
