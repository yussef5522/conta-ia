'use client'

// ⭐⭐ EDITOR DE MODELO DE ETIQUETA — A ETIQUETA É A TELA (31/08/2026).
//
// ⛔ POR QUE A VERSÃO ANTERIOR FOI REFEITA, e a lição é sobre ENSINO, não sobre lógica: o
// comportamento estava CERTO (rótulo + valor concatenavam direito), mas a tela tinha DOIS
// blocos de inputs visualmente idênticos em lados opostos — configuração de um lado, dados
// de exemplo do outro — e **nada mostrando que "Rótulo" e o valor formam UMA linha da
// etiqueta**. O dono, dono do produto, olhou e concluiu que os dois lados faziam a mesma
// coisa. *Se o dono lê errado, a régua está errada — não o leitor.*
//
// ⭐ O DESENHO NOVO segue as ferramentas de etiqueta de verdade (ZebraDesigner, BarTender,
// Canva): a etiqueta é o elemento principal e a edição acontece NO elemento. Clicar numa
// linha seleciona ela; o inspetor mostra AQUELA linha, montada, com as duas partes
// pintadas — e as caixas de edição repetem as mesmas cores.
//
// TRÊS COLUNAS: camadas (liga/desliga + ordem) · etiqueta (o centro) · inspetor da linha.
// No celular vira uma coluna, com a etiqueta em cima (`order-1`).
//
// ⚠️ O MOTOR NÃO MUDOU. `blocosParaLayout`, `zplDosBlocos` e `previaDosBlocos` são os
// mesmos — isto é UI sobre motor intacto, e os testes de etiqueta seguem valendo de rede.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LayoutTemplate, Loader2, Printer, Check, AlertTriangle, Star, RotateCcw, MousePointerClick } from 'lucide-react'
import { PreviaEtiqueta, type ParteDaLinha } from '@/components/estoque/previa-etiqueta'
import { CamadasEtiqueta } from '@/components/estoque/camadas-etiqueta'
import { InspetorLinha } from '@/components/estoque/inspetor-linha'
import {
  BLOCOS_PADRAO, novoBlocoTexto, avisosDoModelo, moverBloco, blocosParaLayout,
  LADO_DOTS_USAVEL, type Bloco,
} from '@/lib/stock/etiquetas/blocos'
import { exemploDeEtiqueta } from '@/lib/stock/etiquetas/exemplo'
import type { CampoId, DadosEtiqueta } from '@/lib/stock/etiquetas/modelo'

interface Modelo { id: string; nome: string; padrao: boolean; blocos: Bloco[] }

export default function ModeloEtiquetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [modelos, setModelos] = useState<Modelo[] | null | undefined>(undefined)
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [nome, setNome] = useState('Padrão')
  const [blocos, setBlocos] = useState<Bloco[]>(BLOCOS_PADRAO)
  const [padrao, setPadrao] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  // ⚠️ dados da PRÉVIA — não vão no `salvar()` e não persistem nem no navegador
  const [previa, setPrevia] = useState<DadosEtiqueta>(exemploDeEtiqueta)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [realce, setRealce] = useState<{ id: string; parte: ParteDaLinha } | null>(null)

  const avisos = useMemo(() => avisosDoModelo(blocos), [blocos])
  const layout = useMemo(() => blocosParaLayout(blocos, previa), [blocos, previa])
  const indiceSel = blocos.findIndex((b) => b.id === selecionadoId)
  const selecionado = indiceSel >= 0 ? blocos[indiceSel] : null
  /** o conteúdo que a linha selecionada mostra hoje — resolvido pelo MESMO layout */
  const conteudoSel = layout.blocos.find((p) => p.bloco.id === selecionadoId)?.partes.conteudo ?? ''

  const carregar = () =>
    fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`).then((r) => r.json()).then((j) => {
      setModelos(j.modelos ?? [])
      const atual = (j.modelos ?? []).find((m: Modelo) => m.padrao) ?? (j.modelos ?? [])[0]
      if (atual) { setModeloId(atual.id); setNome(atual.nome); setBlocos(atual.blocos); setPadrao(atual.padrao) }
    }).catch(() => setModelos(null))

  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const mexer = (i: number, patch: Partial<Bloco>) =>
    setBlocos((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  // ⭐ arrastar e setas chamam a MESMA função (REGRA 4)
  const mover = (de: number, para: number) => setBlocos((bs) => moverBloco(bs, de, para))

  const selecionarCampo = (campo: CampoId) => {
    const alvo = blocos.find((b) => b.tipo === 'campo' && b.campo === campo)
    if (alvo) setSelecionadoId(alvo.id)
  }

  async function salvar() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modeloId, nome, blocos, padrao }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setMsg({ tom: 'erro', texto: j?.erro ?? 'Não consegui salvar.' }); return }
      setModeloId(j.modeloId)
      setMsg({ tom: 'ok', texto: 'Modelo salvo.' })
      await carregar()
    } finally { setBusy(false) }
  }

  async function testar() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        // ⭐ o teste imprime O QUE ESTÁ NA PRÉVIA — senão testaria outro dado
        body: JSON.stringify({ blocos, dados: {
          produto: previa.produto,
          lote: previa.lote,
          fabricacao: previa.fabricacao.toISOString(),
          validadeAte: previa.validadeAte ? previa.validadeAte.toISOString() : null,
          estado: previa.estado,
          quantidade: previa.quantidade ?? null,
          unidade: previa.unidade ?? '',
          colaborador: previa.colaborador ?? '',
          empresa: previa.empresa ?? '',
        } }),
      })
      const j = await r.json().catch(() => null)
      setMsg(r.ok
        ? { tom: 'ok', texto: 'Teste na fila — o agente imprime em segundos.' }
        : { tom: 'erro', texto: j?.erro ?? 'Não consegui enfileirar o teste.' })
    } finally { setBusy(false) }
  }

  function novoModelo() {
    setModeloId(null); setNome('Novo modelo'); setBlocos(BLOCOS_PADRAO); setPadrao(false)
    setMsg(null); setSelecionadoId(null)
  }

  if (modelos === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>

  const usadoPct = Math.min(100, Math.round((layout.alturaUsada / LADO_DOTS_USAVEL) * 100))

  return (
    <div className="space-y-3 pb-6">
      {/* ── TÍTULO + AÇÕES (anatomia da casa) ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <LayoutTemplate className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900">Modelo de etiqueta</h1>
          <p className="text-xs text-slate-400">clique numa linha da etiqueta pra editar ela</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            value={modeloId ?? 'novo'}
            onChange={(e) => {
              if (e.target.value === 'novo') return novoModelo()
              const m = (modelos ?? []).find((x) => x.id === e.target.value)
              if (m) { setModeloId(m.id); setNome(m.nome); setBlocos(m.blocos); setPadrao(m.padrao); setSelecionadoId(null) }
            }}
            className="h-8 rounded-md border border-slate-300 px-2 text-xs"
          >
            {(modelos ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}{m.padrao ? ' ★' : ''}</option>)}
            <option value="novo">+ novo modelo</option>
          </select>
          <Button size="sm" variant="outline" className="h-8" onClick={testar} disabled={busy}>
            <Printer className="h-3 w-3 mr-1" /> imprimir teste
          </Button>
          <Button size="sm" className="h-8" onClick={salvar} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null} salvar
          </Button>
        </div>
      </div>

      {msg && (
        <p className={`flex items-center gap-1 text-xs ${msg.tom === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.tom === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {msg.texto}
        </p>
      )}

      {/* ⚠️ O MÍNIMO SANITÁRIO — avisa, não trava. Travar empurraria o dono a escrever a
          validade à mão numa fita crepe, que é pior: sai do sistema. */}
      {avisos.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-2.5">
            {avisos.map((a, i) => (
              <p key={i} className="flex items-start gap-1.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
              </p>
            ))}
            <p className="mt-1 text-[11px] text-amber-700">Dá pra salvar assim mesmo — a decisão é sua.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_320px]">
        {/* ── CAMADAS ── */}
        <Card className="order-2 lg:order-1">
          <CardContent className="p-2.5">
            <div className="mb-2.5 space-y-1.5 border-b border-slate-100 pb-2.5">
              <input value={nome} onChange={(e) => setNome(e.target.value)}
                aria-label="nome do modelo"
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-sm font-medium" />
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} className="h-3.5 w-3.5" />
                <Star className="h-3 w-3" /> padrão da empresa
              </label>
            </div>
            <CamadasEtiqueta
              blocos={blocos}
              selecionadoId={selecionadoId}
              onSelecionar={setSelecionadoId}
              onAlternarAtivo={(i, ativo) => mexer(i, { ativo })}
              onMover={mover}
              onRemover={(i) => {
                if (blocos[i].id === selecionadoId) setSelecionadoId(null)
                setBlocos((bs) => bs.filter((_, j) => j !== i))
              }}
              onAdicionarTexto={() => {
                const novo = novoBlocoTexto()
                setBlocos((bs) => [...bs, novo])
                setSelecionadoId(novo.id)
              }}
            />
          </CardContent>
        </Card>

        {/* ── A ETIQUETA: o centro da tela ── */}
        <Card className="order-1 lg:order-2">
          <CardContent className="flex flex-col items-center gap-2.5 py-5">
            <PreviaEtiqueta
              dados={previa}
              blocos={blocos}
              lado={400}
              selecionadoId={selecionadoId}
              onSelecionar={(bid, parte) => { setSelecionadoId(bid); setRealce({ id: bid, parte }) }}
              realce={realce}
            />

            {/* ⭐ O ÚNICO CARD QUE SOBROU (decisão do dono): "linhas ativas" e "avisos"
                repetiam o que já está a dois centímetros — os checkboxes da coluna de
                camadas e o aviso vermelho embaixo da etiqueta — e roubavam espaço dela.
                Este responde o que nada mais responde: cabe mais uma linha? */}
            <div className="flex w-full max-w-[400px] items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
              <span className="shrink-0 text-[11px] text-slate-500">Espaço usado</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${layout.estourou ? 'bg-rose-500' : usadoPct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${usadoPct}%` }} />
              </div>
              <span className="shrink-0 tabular-nums text-[11px] font-medium text-slate-600">
                {Math.round(layout.alturaUsada)}/{LADO_DOTS_USAVEL} dots
              </span>
            </div>

            <button type="button" onClick={() => setPrevia(exemploDeEtiqueta())}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
              <RotateCcw className="h-3 w-3" /> restaurar dados de exemplo
            </button>
          </CardContent>
        </Card>

        {/* ── INSPETOR ── */}
        <Card className="order-3">
          <CardContent className="p-3">
            {selecionado ? (
              <InspetorLinha
                bloco={selecionado}
                indice={indiceSel}
                dados={previa}
                valorNaEtiqueta={conteudoSel}
                onMexer={mexer}
                onMudarDados={(patch) => setPrevia((d) => ({ ...d, ...patch }))}
                onFoco={(parte) => setRealce(parte && selecionadoId ? { id: selecionadoId, parte } : null)}
                onIrParaLinha={selecionarCampo}
              />
            ) : (
              <div className="py-6 text-center">
                <MousePointerClick className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-[13px] font-medium text-slate-600">Clique numa linha da etiqueta</p>
                <p className="mx-auto mt-1 max-w-[240px] text-[11px] leading-snug text-slate-400">
                  Ou escolha na lista à esquerda. Aqui você edita o <b>rótulo</b> daquela
                  linha, o tamanho e o destaque — e o <b>conteúdo de exemplo</b>, que serve
                  só pra visualizar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
