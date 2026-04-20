'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n/pt-BR'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaNome: string
  onConfirm: () => void
  loading?: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  empresaNome,
  onConfirm,
  loading,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t.empresa.delete.title}</DialogTitle>
          <DialogDescription>
            {t.empresa.delete.description}{' '}
            <strong className="text-foreground">{empresaNome}</strong>
            {t.empresa.delete.descriptionSuffix}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t.empresa.delete.cancelButton}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? t.common.loading : t.empresa.delete.confirmButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
