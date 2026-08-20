'use client'

// ESTOQUE FASE 0 item 1 — tela do certificado A1. O dono sobe o .pfx + senha; o
// sistema lê CNPJ + validade, valida (CNPJ == empresa) e guarda cifrado. NUNCA mostra
// a senha de volta. Mensagens acionáveis (CNPJ diferente, vencido, senha errada).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldCheck, Upload, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

interface CertStatus {
  cnpj: string
  razaoSocial: string | null
  validadeDe: string
  validadeAte: string
  diasParaVencer: number
  status: string
  criadoEm: string
  vencido: boolean
  venceEmBreve: boolean
}

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

export default function CertificadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [status, setStatus] = useState<CertStatus | null | undefined>(undefined) // undefined = carregando
  const [file, setFile] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function carregar() {
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/certificado`)
      const j = await r.json()
      setStatus(j.certificado ?? null)
    } catch {
      setStatus(null)
    }
  }
  useEffect(() => {
    carregar()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setOk(null)
    if (!file) {
      setErro('Selecione o arquivo .pfx do certificado.')
      return
    }
    if (!senha) {
      setErro('Informe a senha do certificado.')
      return
    }
    setEnviando(true)
    try {
      const fd = new FormData()
      fd.append('pfx', file)
      fd.append('senha', senha)
      const r = await fetch(`/api/empresas/${id}/estoque/certificado`, { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor.' }))
      if (!r.ok) {
        setErro(j.erro ?? 'Erro ao processar o certificado.')
        return
      }
      setOk(`Certificado de ${j.certificado.razaoSocial ?? fmtCnpj(j.certificado.cnpj)} cadastrado.`)
      setSenha('')
      setFile(null)
      const input = document.getElementById('pfx-input') as HTMLInputElement | null
      if (input) input.value = ''
      await carregar()
    } catch {
      setErro('Falha de rede ao enviar o certificado.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-[#185FA5]" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Certificado digital A1</h1>
          <p className="text-sm text-slate-500">
            O certificado (.pfx) da empresa — o mesmo do contador — deixa o sistema baixar suas notas fiscais
            direto da SEFAZ. Fica guardado cifrado; a senha nunca é mostrada de volta.
          </p>
        </div>
      </div>

      {/* Status do certificado ativo */}
      {status === undefined ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </CardContent>
        </Card>
      ) : status ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Certificado ativo</span>
              {status.vencido ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Vencido
                </span>
              ) : status.venceEmBreve ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> Vence em {status.diasParaVencer} dia(s)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Válido
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-slate-500">Empresa</span>
              <span className="font-medium text-slate-900">{status.razaoSocial ?? '—'}</span>
              <span className="text-slate-500">CNPJ</span>
              <span className="font-medium tabular-nums text-slate-900">{fmtCnpj(status.cnpj)}</span>
              <span className="text-slate-500">Validade</span>
              <span className="font-medium tabular-nums text-slate-900">
                {fmtData(status.validadeDe)} — {fmtData(status.validadeAte)}
              </span>
            </div>
            <p className="pt-2 text-xs text-slate-400">
              Perdeu ou trocou a chave de cifra? O .pfx original é seu — basta subir de novo abaixo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Nenhum certificado cadastrado ainda. Suba o .pfx abaixo pra começar.
          </CardContent>
        </Card>
      )}

      {/* Upload */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            {status ? 'Substituir certificado' : 'Cadastrar certificado'}
          </h2>
          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Arquivo .pfx</label>
              <input
                id="pfx-input"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-[#185FA5] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0F4A8C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha do certificado</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="off"
                placeholder="a senha do .pfx"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#185FA5] focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
              />
            </div>

            {erro && (
              <div className="flex items-start gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
            {ok && (
              <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{ok}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-md bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {enviando ? 'Lendo o certificado…' : status ? 'Substituir' : 'Cadastrar'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
