'use client'

/**
 * ⭐⭐⭐ 🏭 EQUIPAMENTOS (IMOBILIZADO) — A LISTA E O TOTAL INVESTIDO (20/10/2026).
 *
 * **A ordem do dono:** *"registra no CADASTRO DE EQUIPAMENTOS (tabela própria CREATE-only,
 * porta única) … e uma tela simples de lista com o total investido (cara nova, tokens da
 * mesa)."*
 *
 * ⛔⛔ **MÁQUINA NÃO É ESTOQUE, E É POR ISSO QUE ESTA TELA EXISTE.** O equipamento NÃO tem
 * saldo, NÃO tem custo médio e NÃO aparece em tela de estoque nenhuma — ele não gera posição
 * por construção (a lista de ESTOQUE e a de EQUIPAMENTO são separadas no topo da transação
 * que confirma a nota, e o laço que cria item/movimento só vê a de estoque). Pôr equipamento
 * na Posição poluiria o custo médio e o Real vs Teórico com uma boleadora.
 *
 * ⛔ **A TELA NÃO CALCULA.** `totalInvestido` e `quantos` vêm de `listarEquipamentos` — somar
 * aqui seria a 2ª resposta pra *"quanto eu investi em máquina?"*, e ela divergiria da leitura
 * no primeiro equipamento que entrasse por outro caminho (a cicatriz do badge × tela).
 *
 * ⛔ **TELA NOVA NASCE COM O GUARD** (a lição da lixeira, 20/09): `fetchComTimeout` + estados
 * EXPLÍCITOS (`CARREGANDO | FALHOU | OK`) + *"tentar de novo"*. *Enquanto "ausência de dado"
 * servir de estado, o caso não previsto vira spinner eterno.*
 *
 * ⚠️ **A empresa vem da porta única** (`use(params)`), nunca de `document.cookie` — o
 * `current_empresa_id` é `httpOnly` e o cliente não o enxerga (20/09).
 *
 * ⚠️ **ZERO HEX** — a paleta é o mapa de `lib/compras/tokens.ts`, que inverte nos dois temas
 * de graça (a fundação de 14/10). Cor cravada aqui daria a esta tela um tom só dela.
 */

import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Factory, Loader2, ArrowLeft, FileText } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { CC, MED } from '@/lib/compras/tokens'
import { CATEGORIA_FINANCEIRA_EQUIPAMENTO } from '@/lib/stock/destino-da-linha'
import type { ListaDeEquipamentos } from '@/lib/stock/equipamento'

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** ⚠️ formata do TEXTO `YYYY-MM-DD`, nunca de `new Date(texto)` — em fuso negativo o
 *  `new Date('2026-10-20')` volta um dia na exibição (a cicatriz do item 4 de 20/08). */
const dia = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`

export default function EquipamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [lista, setLista] = useState<ListaDeEquipamentos | null>(null)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<{ lista: ListaDeEquipamentos }>(
      `/api/empresas/${id}/estoque/equipamentos`,
    )
    // ⛔ falha é ESTADO, nunca silêncio nem lista vazia: "nenhum equipamento" é resposta
    // plausível, e o dono concluiria que o cadastro está vazio (o "erro disfarçado de vazio").
    // ⚠️ `!r.data` entra no mesmo ramo: 200 com corpo vazio é tão inconclusivo quanto 500.
    if (!r.ok || !r.data) {
      if (r.erro) setErro(r.erro)
      setEstado('FALHOU')
      return
    }
    setLista(r.data.lista)
    setEstado('OK')
  }, [id])

  useEffect(() => { void carregar() }, [carregar])

  return (
    <div style={{ background: CC.bg, color: CC.tinta }}>
      <div className="mx-auto space-y-3" style={{ maxWidth: MED.teto }}>
        <Link
          href={`/empresas/${id}/estoque/posicao`}
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: CC.tinta3 }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <Factory className="h-5 w-5 shrink-0" style={{ color: CC.acao }} />
          <h1 className="text-base font-semibold">Equipamentos (investimento)</h1>
          <p className="hidden flex-1 truncate text-xs lg:block" style={{ color: CC.tinta3 }}>
            Máquina é INVESTIMENTO, não estoque: não tem saldo, não entra em custo médio e não
            aparece em tela de estoque nenhuma.
          </p>
        </div>

        {estado === 'CARREGANDO' && (
          <div className="flex items-center gap-2 p-6 text-sm" style={{ color: CC.tinta3 }}>
            <Loader2 className="h-4 w-4 animate-spin" /> lendo o cadastro…
          </div>
        )}

        {estado === 'FALHOU' && (
          <div
            className="space-y-2 p-4 text-sm"
            style={{ background: CC.coralFundo, color: CC.coral, borderRadius: CC.raio }}
          >
            <p>{erro ?? 'Não consegui carregar o cadastro de equipamentos.'}</p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="rounded px-2.5 py-1 text-xs font-semibold"
              style={{ background: CC.coral, color: CC.sobreForte }}
            >
              tentar de novo
            </button>
          </div>
        )}

        {estado === 'OK' && lista && (
          <>
            {/* ⭐ O NÚMERO QUE O BRIEF PEDE — e ele vem do servidor, não de um reduce aqui */}
            <div
              className="p-4"
              style={{ background: CC.mod, border: `1px solid ${CC.linhaForte}`, borderRadius: CC.raio }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: CC.tinta3 }}>
                total investido em equipamento
              </p>
              <p className="mt-1 font-bold tabular-nums" style={{ fontSize: MED.giga, color: CC.acao }}>
                {brl(lista.totalInvestido)}
              </p>
              <p className="text-xs" style={{ color: CC.tinta2 }}>
                {lista.quantos} {lista.quantos === 1 ? 'equipamento' : 'equipamentos'} no cadastro
                {' · '}no financeiro eles entram como <strong>{CATEGORIA_FINANCEIRA_EQUIPAMENTO}</strong>,
                fora do DRE (no Lucro Real imobilizado não é despesa do mês)
              </p>
            </div>

            {lista.quantos === 0 ? (
              /* ⚠️ o vazio DIZ como um equipamento entra — vazio mudo faz o dono procurar
                 um botão de cadastrar que não existe (e não deve existir: a porta é a nota). */
              <div
                className="p-4 text-sm"
                style={{ background: CC.mod, border: `1px solid ${CC.linha}`, borderRadius: CC.raio, color: CC.tinta2 }}
              >
                Nenhum equipamento registrado ainda. Máquina entra pela <strong>nota</strong>: na
                conferência, escolha <strong>“🏭 Equipamento (investimento)”</strong> no funil do
                item — ela não vira item de estoque e aparece aqui.
                <div className="mt-2">
                  <Link
                    href={`/empresas/${id}/estoque/recebimentos`}
                    className="text-xs font-semibold underline"
                    style={{ color: CC.acao }}
                  >
                    ir pra conferência de notas →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                className="overflow-x-auto"
                style={{ background: CC.mod, border: `1px solid ${CC.linhaForte}`, borderRadius: CC.raio }}
              >
                <table className="density-normal w-full">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${CC.linhaForte}` }}>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>equipamento</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>fornecedor</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>nota</th>
                      <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>qtd</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>data</th>
                      <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: CC.tinta3 }}>valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.linhas.map((e, i) => (
                      <tr
                        key={e.id}
                        style={{
                          borderTop: i === 0 ? undefined : `1px solid ${CC.linha}`,
                          background: i % 2 ? CC.mod2 : undefined,
                        }}
                      >
                        <td className="px-3 py-0 text-[13px] font-medium">{e.nome}</td>
                        <td className="px-3 py-0 text-[13px]" style={{ color: CC.tinta2 }}>{e.fornecedor}</td>
                        <td className="px-3 py-0 text-[13px]">
                          {/* ⭐ o rastro até a nota: é o que responde "de onde saiu essa máquina?" */}
                          {e.conferenceId ? (
                            <Link
                              href={`/empresas/${id}/estoque/recibos/${e.conferenceId}`}
                              className="inline-flex items-center gap-1 underline"
                              style={{ color: CC.acao }}
                            >
                              <FileText className="h-3 w-3" />
                              {e.nNF ? `NF ${e.nNF}` : 'recibo'}
                            </Link>
                          ) : (
                            /* ⚠️ sem conferência não há recibo pra apontar — e dizer "NF —" é
                               mais honesto que um link que não abre nada. */
                            <span style={{ color: CC.tinta3 }}>{e.nNF ? `NF ${e.nNF}` : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums">
                          {e.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {e.unidade}
                        </td>
                        <td className="px-3 py-0 text-[13px] tabular-nums" style={{ color: CC.tinta2 }}>{dia(e.data)}</td>
                        <td className="px-3 py-0 text-right text-[13px] font-semibold tabular-nums">{brl(e.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ⚠️ A DEPRECIAÇÃO É FASE 2, e a tela DIZ isso em vez de calar: ver o total
               investido sem uma palavra sobre depreciação faria o dono achar que o sistema
               já trata o lançamento contábil — ele não trata. */}
            <p className="px-1 text-[11px]" style={{ color: CC.tinta3 }}>
              ⚠️ A <strong>depreciação</strong> ainda não é calculada aqui — é lançamento
              separado, feito com o contador.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
