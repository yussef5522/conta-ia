'use client'

// IMPORT DE FATURA PDF NO PF (26/08) — mesma disciplina da PJ: CONFERE ANTES DE GRAVAR.
//
// A tela mostra o que o PDF DECLARA ao lado do que o sistema LEU. Se não fechar, o
// botão de confirmar nem aparece — fatura de cartão que não bate vira mentira no fluxo
// de caixa três telas adiante.

import { useState, use } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, FileText } from 'lucide-react'

interface Linha {
  data: string; descricao: string; valor: number; credito: boolean
  parcelaNumero: number | null; parcelaTotal: number | null
  portador: string | null; internacional: boolean; jaExiste: boolean
}
interface Preview {
  ok: boolean; erro: string | null; banco: string
  vencimento: string | null; referencia: string | null; totalDeclarado: number | null
  conferencia: {
    despesasCalculado: number; despesasDeclarado: number | null
    saldoCalculado: number; saldoDeclarado: number | null
    fecha: boolean; encargosDeclarados: number
  }
  portadores: string[]; linhas: Linha[]; novas: number; jaExistem: number
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => iso.split('-').reverse().join('/')

export default function ImportarFaturaPFPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = use(params)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ criadas: number; puladas: number; totalFatura: number; referencia: string } | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  async function enviar(confirmar: boolean) {
    if (!file) { setErro('Escolha o PDF da fatura'); return }
    setCarregando(true); setErro(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (confirmar) fd.append('confirmar', 'true')
      const r = await fetch(`/api/perfis/${id}/cartoes/${cardId}/importar-fatura`, { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) { setErro(j.erro ?? 'Falha ao ler a fatura'); return }
      if (confirmar) setResultado(j.resultado)
      else setPreview(j.preview)
    } catch {
      setErro('Não consegui falar com o servidor')
    } finally {
      setCarregando(false)
    }
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <h1 className="mt-2 text-lg font-semibold">Fatura importada</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {resultado.criadas} lançamentos gravados
              {resultado.puladas > 0 && ` · ${resultado.puladas} já existiam (não duplicou)`}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{brl(resultado.totalFatura)}</p>
            <p className="text-xs text-muted-foreground">fatura {resultado.referencia}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline"><Link href={`/perfis/${id}/cartoes/${cardId}`}>Ver o cartão</Link></Button>
              <Button asChild><Link href={`/perfis/${id}/cartoes/${cardId}/faturas`}>Ver a fatura</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const c = preview?.conferencia
  const linhasMostradas = preview ? (verTodas ? preview.linhas : preview.linhas.slice(0, 40)) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/perfis/${id}/cartoes/${cardId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">Importar fatura (PDF)</h1>
        <span className="hidden text-xs text-slate-400 lg:inline">
          o sistema confere contra os totais do PDF antes de gravar
        </span>
      </div>

      <Card>
        <CardContent className="py-4">
          <input type="file" accept="application/pdf"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setErro(null) }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Fatura de cartão vem em PDF. Se você tem um <b>OFX</b>, ele é do <b>extrato da conta</b> — importe em Movimentações.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => enviar(false)} disabled={!file || carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Conferir fatura
            </Button>
          </div>
          {erro && (
            <p className="mt-3 flex items-start gap-1.5 whitespace-pre-line rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{erro}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && c && (
        <>
          <Card className={c.fecha ? 'border-emerald-200' : 'border-rose-300'}>
            <CardContent className="py-4">
              <h2 className="mb-2 text-sm font-medium">
                Conferência {c.fecha ? '✅ a fatura fecha' : '❌ a fatura NÃO fecha'}
              </h2>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr className="border-b">
                    <td className="py-1 text-muted-foreground">Despesas do período</td>
                    <td className="py-1 text-right tabular-nums">{brl(c.despesasCalculado)}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {c.despesasDeclarado != null ? brl(c.despesasDeclarado) : '—'}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 text-muted-foreground">Saldo da fatura</td>
                    <td className="py-1 text-right font-medium tabular-nums">{brl(c.saldoCalculado)}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {c.saldoDeclarado != null ? brl(c.saldoDeclarado) : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="pt-1 text-[11px] text-muted-foreground">lido pelo sistema · declarado no PDF</td>
                    <td /><td />
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>banco: {preview.banco}</span>
                {preview.vencimento && <span>vencimento: {dia(preview.vencimento)}</span>}
                {preview.portadores.length > 0 && <span>portadores: {preview.portadores.map((p) => `****${p}`).join(' · ')}</span>}
                {c.encargosDeclarados > 0 && <span>encargos do resumo: {brl(c.encargosDeclarados)}</span>}
              </div>
              {!c.fecha && preview.erro && (
                <p className="mt-3 whitespace-pre-line rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {preview.erro}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  {preview.linhas.length} lançamentos · {preview.novas} novos
                  {preview.jaExistem > 0 && ` · ${preview.jaExistem} já existem`}
                </h2>
                {c.fecha && (
                  <Button onClick={() => enviar(true)} disabled={carregando || preview.novas === 0}>
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirmar e gravar {preview.novas}
                  </Button>
                )}
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="density-normal w-full">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">Descrição</th>
                      <th className="px-2 py-2">Cartão</th>
                      <th className="px-2 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasMostradas.map((l, i) => (
                      <tr key={i} className={`border-b ${l.jaExiste ? 'opacity-40' : ''}`}>
                        <td className="px-2 py-0 text-[13px] tabular-nums whitespace-nowrap">{dia(l.data)}</td>
                        <td className="px-2 py-0 text-[13px]">
                          {l.descricao}
                          {l.parcelaTotal && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {l.parcelaNumero}/{l.parcelaTotal}
                            </span>
                          )}
                          {l.internacional && <span className="ml-1 text-[10px] text-sky-600">internacional</span>}
                          {l.jaExiste && <span className="ml-1 text-[10px] text-muted-foreground">já importado</span>}
                        </td>
                        <td className="px-2 py-0 text-[11px] text-muted-foreground">{l.portador ? `****${l.portador}` : '—'}</td>
                        <td className={`px-2 py-0 text-right text-[13px] font-medium tabular-nums ${l.credito ? 'text-emerald-600' : ''}`}>
                          {l.credito ? '−' : ''}{brl(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!verTodas && preview.linhas.length > 40 && (
                <button onClick={() => setVerTodas(true)} className="mt-2 text-xs text-primary hover:underline">
                  ver todos os {preview.linhas.length}
                </button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
