'use client'

// ⭐ IMPRESSÃO DE ETIQUETAS (30/08/2026) — impressora, fila e teste.
//
// ⚠️ A TELA EXPLICA O DESENHO porque ele não é óbvio: o servidor está num datacenter e
// não alcança a impressora da cozinha. Quem alcança é o AGENTE, que roda numa máquina da
// LAN e PUXA os trabalhos. Sem essa frase, "por que preciso de um programinha rodando?"
// vira dúvida recorrente.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, Loader2, Check, AlertTriangle, RefreshCw, Copy, Wifi, Usb } from 'lucide-react'

interface Fila {
  impressoras: Array<{ id: string; nome: string; tipo: string; host: string | null; porta: number; ativa: boolean; ultimoPing: string | null; online: boolean }>
  jobs: Array<{ id: string; descricao: string; status: string; copias: number; tentativas: number; ultimoErro: string | null; criadoEm: string }>
  pendentes: number
  comErro: number
}

const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const TOM: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  IMPRIMINDO: 'bg-sky-100 text-sky-700',
  IMPRESSA: 'bg-emerald-100 text-emerald-700',
  ERRO: 'bg-rose-100 text-rose-700',
  CANCELADA: 'bg-slate-100 text-slate-400',
}

export default function ImpressaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fila, setFila] = useState<Fila | null | undefined>(undefined)
  const [novo, setNovo] = useState<{ nome: string; tipo: 'REDE' | 'USB'; host: string; porta: string } | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const carregar = () =>
    fetch(`/api/empresas/${id}/estoque/impressao`).then((r) => r.json()).then((j) => setFila(j.fila ?? null)).catch(() => setFila(null))

  useEffect(() => {
    carregar()
    // ⚠️ a fila anda sozinha (o agente puxa a cada 3s) — a tela acompanha sem F5
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cadastrar() {
    if (!novo) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/impressao`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novo.nome, tipo: novo.tipo,
          host: novo.tipo === 'REDE' ? novo.host : null,
          porta: Number(novo.porta) || 9100,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui cadastrar.'); return }
      setToken(j.token) // ⚠️ aparece UMA vez
      setNovo(null)
      await carregar()
    } finally { setBusy(false) }
  }

  async function imprimirTeste() {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/impressao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: 'etiqueta de teste', zpl: ZPL_TESTE }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) setErro(j?.erro ?? 'Não consegui enfileirar o teste.')
      await carregar()
    } finally { setBusy(false) }
  }

  async function tentarDeNovo(jobId: string) {
    await fetch(`/api/empresas/${id}/estoque/impressao/${jobId}`, { method: 'POST' })
    await carregar()
  }

  if (fila === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Printer className="h-5 w-5 text-[#185FA5]" />
        <h1 className="text-base font-semibold">Impressão de etiquetas</h1>
        <p className="hidden lg:block text-xs text-slate-400">a etiqueta entra na fila e o agente imprime — nada se perde se a impressora estiver ocupada</p>
        <Button variant="outline" size="sm" className="ml-auto h-8" onClick={carregar}><RefreshCw className="h-3 w-3 mr-1" /> atualizar</Button>
      </div>

      {/* ⭐ o desenho, em uma frase — a pergunta "por que preciso de um agente?" */}
      <Card className="border-sky-200 bg-sky-50/60">
        <CardContent className="py-3 text-xs text-sky-900">
          <b>Como funciona:</b> você manda imprimir do computador <b>ou do celular</b> → a etiqueta entra na fila aqui →
          o <b>agente</b> (um programinha rodando numa máquina da sua rede) puxa e manda pra Zebra.
          <span className="block mt-1 text-sky-700">
            O servidor do Conta IA fica na internet e não enxerga a sua rede — por isso quem fala com a impressora é o agente,
            de dentro da cozinha. Ele só faz conexão de saída: não precisa abrir porta no seu roteador.
          </span>
        </CardContent>
      </Card>

      {token && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3">
            <p className="text-xs font-semibold text-amber-900">Token do agente — copie agora, ele não aparece de novo</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-[11px]">{token}</code>
              <Button size="sm" variant="outline" className="h-7" onClick={() => navigator.clipboard?.writeText(token)}>
                <Copy className="h-3 w-3 mr-1" /> copiar
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-amber-800">Na máquina da cozinha, rode:</p>
            <code className="mt-1 block overflow-x-auto rounded bg-white px-2 py-1 text-[11px]">
              CONTA_IA_URL=http://198.211.103.10 AGENTE_TOKEN={token} node scripts/zebra-agente.mjs
            </code>
          </CardContent>
        </Card>
      )}

      {erro && <p className="text-xs text-rose-600">{erro}</p>}

      {/* IMPRESSORAS */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold">Impressoras</h2>
            <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => setNovo({ nome: '', tipo: 'REDE', host: '', porta: '9100' })}>
              + cadastrar
            </Button>
          </div>
          {fila?.impressoras.length === 0 && !novo && (
            <p className="text-xs text-slate-500">Nenhuma impressora ainda. Cadastre pra gerar o token do agente.</p>
          )}
          <div className="divide-y divide-slate-100">
            {fila?.impressoras.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                {i.tipo === 'REDE' ? <Wifi className="h-4 w-4 text-slate-400" /> : <Usb className="h-4 w-4 text-slate-400" />}
                <span className="font-medium">{i.nome}</span>
                <span className="text-slate-500">{i.tipo === 'REDE' ? `${i.host}:${i.porta}` : 'USB (via agente)'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${i.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {i.online ? 'agente online' : i.ultimoPing ? `visto ${hora(i.ultimoPing)}` : 'agente nunca conectou'}
                </span>
              </div>
            ))}
          </div>

          {novo && (
            <div className="mt-3 space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap gap-2">
                <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="nome (ex: Zebra da cozinha)"
                  className="h-9 flex-1 min-w-[180px] rounded-md border px-2 text-sm" />
                <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as 'REDE' | 'USB' })}
                  className="h-9 rounded-md border px-2 text-sm">
                  <option value="REDE">De rede (Ethernet/WiFi)</option>
                  <option value="USB">USB (presa no computador)</option>
                </select>
              </div>
              {novo.tipo === 'REDE' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={novo.host} onChange={(e) => setNovo({ ...novo, host: e.target.value })} placeholder="IP na sua rede (ex: 192.168.0.50)"
                    className="h-9 flex-1 min-w-[200px] rounded-md border px-2 text-sm tabular-nums" />
                  <input value={novo.porta} onChange={(e) => setNovo({ ...novo, porta: e.target.value })} className="h-9 w-24 rounded-md border px-2 text-sm tabular-nums" />
                  <span className="text-[11px] text-slate-400">o IP sai no menu da impressora ou na etiqueta de configuração dela</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={cadastrar} disabled={busy || !novo.nome.trim()}>{busy ? 'Salvando…' : 'Cadastrar'}</Button>
                <Button size="sm" variant="outline" onClick={() => setNovo(null)}>cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FILA */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold">Fila</h2>
            <span className="text-xs text-slate-500">{fila?.pendentes ?? 0} esperando{(fila?.comErro ?? 0) > 0 ? ` · ${fila!.comErro} com erro` : ''}</span>
            <Button size="sm" variant="outline" className="ml-auto h-8" onClick={imprimirTeste} disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Printer className="h-3 w-3 mr-1" />} imprimir teste
            </Button>
          </div>
          {fila?.jobs.length === 0 && <p className="text-xs text-slate-500">Nada impresso ainda.</p>}
          <div className="divide-y divide-slate-100">
            {fila?.jobs.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[13px]">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM[j.status] ?? ''}`}>{j.status.toLowerCase()}</span>
                <span className="flex-1 min-w-[140px]">{j.descricao}{j.copias > 1 ? ` (${j.copias}×)` : ''}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">{hora(j.criadoEm)}</span>
                {j.status === 'ERRO' && (
                  <>
                    <span className="text-[11px] text-rose-600">{j.ultimoErro}</span>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => tentarDeNovo(j.id)}>tentar de novo</Button>
                  </>
                )}
                {j.status === 'PENDENTE' && j.tentativas > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" /> {j.tentativas}ª tentativa</span>
                )}
                {j.status === 'IMPRESSA' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** etiqueta de teste — o mesmo ZPL que o agente usa em `--teste`, pra os dois caminhos
 *  provarem a MESMA coisa (REGRA 4: uma etiqueta de teste, não duas). */
const ZPL_TESTE = `^XA
^CI28
^PW480
^LL480
^FO30,40^A0N,34,34^FDConta IA^FS
^FO30,90^A0N,28,28^FDTeste de impressao^FS
^FO30,180^GB420,3,3^FS
^FO30,210^A0N,22,22^FDSe voce esta lendo isto,^FS
^FO30,240^A0N,22,22^FDa fila chegou na impressora.^FS
^FO30,300^BQN,2,5^FDLA,conta-ia-teste^FS
^XZ`
