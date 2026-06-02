// Sprint PF FATIA 1 — Criar perfil PF.

'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Loader2, UserRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function NovoPerfilPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [type, setType] = useState<'OWN' | 'DEPENDENT'>('OWN')
  const [birthDate, setBirthDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch('/api/perfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          cpf: cpf.replace(/\D/g, '') || null,
          type,
          birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao criar perfil')
        return
      }
      const data = await r.json()
      router.push(`/perfis/${data.profile.id}`)
    } catch {
      setError('Sem conexão. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/perfis"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Novo perfil</h1>
          <p className="text-sm text-zinc-600">
            Pode ser seu (titular) ou de um dependente (filho/filha).
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex: "Yussef", "Filho Pedro", "Filha Ana"'
                required
                maxLength={80}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'OWN' | 'DEPENDENT')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWN">Titular (eu mesmo)</SelectItem>
                  <SelectItem value="DEPENDENT">Dependente (filho/filha)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500 mt-1">
                Dependente: você gerencia em nome dele(a). Titular: você é o
                dono do perfil.
              </p>
            </div>

            <div>
              <Label htmlFor="cpf">CPF (opcional)</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                className="mt-1"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Útil pra futura ponte PJ→PF (Fatia 4) reconhecer Pix.
              </p>
            </div>

            <div>
              <Label htmlFor="birthDate">Data de nascimento (opcional)</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar perfil
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/perfis">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
