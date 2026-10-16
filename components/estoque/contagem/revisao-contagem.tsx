'use client'

// ⭐⭐ MODO REVISÃO — a tela do DONO, não a de quem conta (31/08/2026).
//
// ⚠️ AQUI SIM a tabela, AQUI SIM o sistema aparece, AQUI SIM a divergência vem colorida.
// Separar os dois momentos é o que permite a contagem ser CEGA: o número do sistema não
// pode existir enquanto ela conta, e tem que existir quando ele revisa.
//
// ⚠️⚠️ "CONFERIDO" NÃO APLICA NADA — e o botão diz isso. O ajuste no ledger já aconteceu na
// hora da contagem (decisão de 23/08: sessão de vários dias não pode segurar os ajustes
// reféns). Chamar de "Aceitar" faria o botão **mentir** sobre o que o clique faz.
//
// ⛔⛔ E A REGRA MAIS IMPORTANTE DESTA TELA, que é sobre GENTE e não sobre software:
// **o rastro diz QUEM CONTOU, não quem é culpado.** Quem descobre a falta não é quem
// causou. Por isso o nome de quem contou **nunca** aparece na mesma linha do número da
// divergência — ele mora DENTRO do histórico, com o rótulo "contado por". Se contar virar
// risco pessoal, ninguém conta direito, e aí o estoque inteiro deixa de valer.

/**
 * ⭐ **O UPGRADE DE TINTA (15/10)** — irmão do `cartao-contar`: a `page.tsx` da contagem foi
 * pra token e a medição do CHUNK em prod acusou o hex do azul legado vindo **daqui** (o anel
 * do cartão-filtro) e de lá. Troca por **PAPEL**, convenção do módulo (cor por `style`
 * inline; classe só onde há variante de estado, porque **inline ganha de classe**).
 *
 * ⛔ **ESTRUTURA E COMPORTAMENTO INTOCADOS** — os 4 filtros, o histórico append-only, os 3
 * gestos e a regra de GENTE (o nome de quem contou mora DENTRO do histórico, nunca na linha
 * da divergência) são exatamente os mesmos.
 *
 * ⚠️ E **nenhuma opacidade sobre token** (`bg-[var(--x)]/60` sai TRANSPARENTE no Tailwind 3):
 * a linha do histórico, que era `bg-slate-50/60`, passa a usar a superfície sólida.
 */
import { useState } from 'react'
import { Check, RotateCcw, Search, ChevronRight, ChevronDown, Eye, HelpCircle, MessageSquare } from 'lucide-react'

export interface LinhaRevisao {
  itemId: string
  titulo: string
  especificacao: string
  unidadeControle: string
  saldoSistema: number
  avisoUnidade: string | null
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
  viuSistema: boolean
  observacao: string | null
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number } | null
}
export interface VersaoLinha {
  versao: number; estado: string; qtdContada: number | null; qtdAnterior: number | null
  viuSistema: boolean; observacao: string | null; contadoPorNome: string | null; contadoEm: string
}
export type Decisao = 'CONFERIDO' | 'RECONTAR' | 'INVESTIGAR'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const quando = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function RevisaoContagem({
  linhas, historico, decisoes, podeDecidir, onDecidir, onRecontar,
}: {
  linhas: LinhaRevisao[]
  historico: Record<string, VersaoLinha[]>
  decisoes: Record<string, { decisao: string; motivo: string | null; decididoPorNome: string | null }>
  /** decidir é `stock.manage`; a operadora VÊ (é o resultado do trabalho dela) e não decide */
  podeDecidir: boolean
  onDecidir: (itemId: string, decisao: Decisao) => void
  onRecontar: (itemId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'diverg' | 'apurar' | 'bateu'>('todas')
  const [aberta, setAberta] = useState<Set<string>>(new Set())

  const comDiverg = linhas.filter((l) => l.contado && Math.abs(l.contado.divergencia) > 1e-9)
  const aApurar = linhas.filter((l) => l.estado === 'NAO_SEI')
  const bateram = linhas.filter((l) => l.contado && Math.abs(l.contado.divergencia) <= 1e-9)
  const valorDiverg = comDiverg.reduce((s, l) => s + (l.contado?.valorDivergencia ?? 0), 0)

  const q = busca.trim().toLowerCase()
  const base = filtro === 'diverg' ? comDiverg : filtro === 'apurar' ? aApurar : filtro === 'bateu' ? bateram : linhas
  const visiveis = q ? base.filter((l) => `${l.titulo} ${l.especificacao}`.toLowerCase().includes(q)) : base

  const Card = ({ label, valor, sub, tom, ativo, onClick }: {
    label: string; valor: string; sub?: string; tom: string; ativo: boolean; onClick: () => void
  }) => (
    <button type="button" onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition-colors ${ativo ? 'ring-2 ring-[var(--prod-acao-bg)]' : ''} ${tom}`}>
      <p className="text-[11px] font-medium">{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight">{valor}</p>
      {sub && <p className="text-[10px] opacity-70">{sub}</p>}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card label="Divergência" valor={String(comDiverg.length)} sub={brl(valorDiverg)}
          tom="border-[var(--fam-coral-mid)] bg-[var(--fam-coral-bg)] text-[color:var(--fam-coral-ink)]"
          ativo={filtro === 'diverg'} onClick={() => setFiltro(filtro === 'diverg' ? 'todas' : 'diverg')} />
        <Card label="A apurar" valor={String(aApurar.length)} sub="marcados “não sei”"
          tom="border-[var(--fam-ambar-mid)] bg-[var(--fam-ambar-bg)] text-[color:var(--fam-ambar-ink)]"
          ativo={filtro === 'apurar'} onClick={() => setFiltro(filtro === 'apurar' ? 'todas' : 'apurar')} />
        <Card label="Bateram" valor={String(bateram.length)}
          tom="border-[var(--fam-verde-mid)] bg-[var(--fam-verde-bg)] text-[color:var(--fam-verde-ink)]"
          ativo={filtro === 'bateu'} onClick={() => setFiltro(filtro === 'bateu' ? 'todas' : 'bateu')} />
        <Card label="Todas" valor={String(linhas.length)}
          tom="border-[var(--prod-line)] bg-[var(--prod-surface)] text-[color:var(--prod-primary)]"
          ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} />
      </div>

      <div className="relative max-w-[320px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--prod-muted)' }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item"
          className="h-9 w-full rounded-lg border pl-7 pr-2 text-sm"
          style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
      </div>

      {/* ⚠️ a frase que impede o mal-entendido do botão */}
      {podeDecidir && (
        <p className="text-[11px]" style={{ color: 'var(--prod-secondary)' }}>
          O ajuste no estoque <b>já foi aplicado quando ela contou</b> — “conferido” fecha a
          linha, não aplica nada. “Recontar” devolve o item pra fila.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--prod-line)' }}>
        <table className="density-normal w-full min-w-[720px]">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide"
              style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-muted)' }}>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-right">Sistema</th>
              <th className="px-3 py-2 text-right">Contado</th>
              <th className="px-3 py-2 text-right">Diferença</th>
              <th className="px-3 py-2 text-right">R$</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const d = l.contado
              const div = d?.divergencia ?? 0
              // ⚠️ cor por CLASSE (e não `style`) porque ela é computada e entra em DOIS
              // template literals de `className` abaixo — a família coral/azul mantém o
              // sentido (falta × sobra) e passa a inverter no tema escuro.
              const cor = !d
                ? 'text-[color:var(--prod-muted)]'
                : Math.abs(div) <= 1e-9
                  ? 'text-[color:var(--prod-muted)]'
                  : div < 0
                    ? 'text-[color:var(--fam-coral-ink)]'
                    : 'text-[color:var(--fam-azul-ink)]'
              const versoes = historico[l.itemId] ?? []
              const dec = decisoes[l.itemId]
              const exp = aberta.has(l.itemId)
              return (
                <>
                  <tr key={l.itemId} className={`border-b ${dec?.decisao === 'CONFERIDO' ? 'opacity-50' : ''}`} style={{ borderColor: 'var(--prod-line)' }}>
                    <td className="px-3 py-0 text-[13px]">
                      <button type="button"
                        onClick={() => setAberta((s) => { const n = new Set(s); n.has(l.itemId) ? n.delete(l.itemId) : n.add(l.itemId); return n })}
                        className="flex items-center gap-1 text-left">
                        {exp
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--prod-muted)' }} />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--prod-muted)' }} />}
                        <span className="font-medium" style={{ color: 'var(--prod-primary)' }}>{l.titulo}</span>
                        {l.especificacao && <span className="hidden text-[11px] lg:inline" style={{ color: 'var(--prod-muted)' }}>{l.especificacao}</span>}
                      </button>
                      {l.avisoUnidade && (
                        <span className="ml-5 text-[10px]" style={{ color: 'var(--fam-ambar-ink)' }}>⚠️ unidade suspeita — pode ser do cadastro</span>
                      )}
                    </td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{num(l.saldoSistema)}</td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                      {l.estado === 'NAO_SEI'
                        ? <span style={{ color: 'var(--fam-ambar-ink)' }}>a apurar</span>
                        : l.estado === 'PULADO'
                          ? <span style={{ color: 'var(--prod-muted)' }}>pulado</span>
                          : d ? num(d.qtdContada) : <span style={{ color: 'var(--prod-line-strong)' }}>—</span>}
                      {/* ⭐ marca discreta: contou COM o número à vista */}
                      {l.viuSistema && <Eye className="ml-1 inline h-3 w-3" style={{ color: 'var(--prod-muted)' }} aria-label="contado com o sistema à vista" />}
                      {l.observacao && <MessageSquare className="ml-1 inline h-3 w-3" style={{ color: 'var(--fam-azul-mid)' }} aria-label="tem observação" />}
                    </td>
                    <td className={`px-3 py-0 text-right text-[13px] font-medium tabular-nums ${cor}`}>
                      {d && Math.abs(div) > 1e-9 ? `${div > 0 ? '+' : ''}${num(div)}` : '—'}
                    </td>
                    <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${cor}`}>
                      {d && Math.abs(div) > 1e-9 ? brl(d.valorDivergencia) : '—'}
                    </td>
                    <td className="px-3 py-0 text-right">
                      {podeDecidir ? (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => onDecidir(l.itemId, 'CONFERIDO')} title="conferido — fecha a linha (não aplica nada)"
                            className={`rounded p-1 ${dec?.decisao === 'CONFERIDO' ? 'bg-[var(--fam-verde-bg)] text-[color:var(--fam-verde-ink)]' : 'text-[color:var(--prod-muted)] hover:bg-[var(--fam-verde-bg)] hover:text-[color:var(--fam-verde-ink)]'}`}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => onRecontar(l.itemId)} title="recontar — devolve pra fila"
                            className="rounded p-1 text-[color:var(--prod-muted)] hover:bg-[var(--fam-azul-bg)] hover:text-[color:var(--fam-azul-ink)]">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => onDecidir(l.itemId, 'INVESTIGAR')} title="investigar — fica aberto pra você olhar"
                            className={`rounded p-1 ${dec?.decisao === 'INVESTIGAR' ? 'bg-[var(--fam-ambar-bg)] text-[color:var(--fam-ambar-ink)]' : 'text-[color:var(--prod-muted)] hover:bg-[var(--fam-ambar-bg)] hover:text-[color:var(--fam-ambar-ink)]'}`}>
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>{dec?.decisao?.toLowerCase() ?? ''}</span>
                      )}
                    </td>
                  </tr>
                  {exp && (
                    <tr key={`${l.itemId}-h`} className="border-b" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
                      <td colSpan={6} className="px-3 py-2">
                        {versoes.length === 0 ? (
                          <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>sem histórico — este item não foi tocado nesta contagem</p>
                        ) : (
                          <ul className="space-y-1">
                            {versoes.map((v) => (
                              <li key={v.versao} className="text-[11px]" style={{ color: 'var(--prod-secondary)' }}>
                                <b className="tabular-nums">v{v.versao}</b> · {quando(v.contadoEm)} ·{' '}
                                {v.estado === 'CONTADO' ? <b className="tabular-nums">{num(v.qtdContada ?? 0)} {l.unidadeControle}</b> : v.estado === 'NAO_SEI' ? 'a apurar' : 'pulado'}
                                {v.qtdAnterior != null && <span style={{ color: 'var(--prod-muted)' }}> (era {num(v.qtdAnterior)})</span>}
                                {/* ⛔ o nome mora AQUI, longe do número da divergência —
                                    quem descobre a falta não é quem causou */}
                                <span style={{ color: 'var(--prod-muted)' }}> — contado por {v.contadoPorNome ?? 'não identificado'}</span>
                                {v.viuSistema && <span style={{ color: 'var(--prod-muted)' }}> · sistema estava à vista</span>}
                                {v.observacao && <span className="block pl-6" style={{ color: 'var(--fam-azul-ink)' }}>“{v.observacao}”</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {dec && (
                          <p className="mt-1.5 border-t pt-1.5 text-[11px]" style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-secondary)' }}>
                            decisão: <b>{dec.decisao.toLowerCase()}</b>{dec.decididoPorNome ? ` por ${dec.decididoPorNome}` : ''}
                            {dec.motivo ? ` — “${dec.motivo}”` : ''}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
