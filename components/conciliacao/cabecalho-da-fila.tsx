'use client'

// ⭐⭐ O CABEÇALHO DA CONCILIAÇÃO (07/09/2026) — refeito porque contradizia as abas.
//
// ⛔⛔ O QUE ELE DIZIA ANTES, e por que saiu:
//
//  1. *"69 prováveis duplicatas somando R$ 845.646,99"* enquanto a aba de
//     duplicatas dizia **0**. Duas respostas pra mesma pergunta na MESMA tela.
//     A régua de trás era um JOIN por **valor + ±5 dias sem olhar o nome** — a
//     família dos 84 fantasmas. Medida, ela chamava de duplicata coisas como
//     *"BIG GELO R$ 80,00"* × *"Mauricio Ramos Berro - Pix"* e *"chat gpt
//     R$ 100,00"* × *"COOPERATIVA DE PAIS E MESTRES"*. ⚠️ E o dinheiro estava
//     errado **sob a própria régua**: `COUNT(DISTINCT e.id)` com
//     `SUM(e.amount)` sobre as linhas do JOIN → R$ 845.646,99 no lugar de
//     R$ 444.746,99.
//
//  2. *"SALDO DO EXTRATO R$ 33.046,25 × SALDO NO SISTEMA −R$ 128.404,22"*.
//     Nenhum dos dois era saldo: o 1º era Σ(CREDIT−DEBIT) de TUDO que já entrou
//     por OFX (ignora saldo inicial e o que o banco declarou) e o 2º era a régua
//     da DRE realizada — com **325 linhas sem conta bancária** (R$ 61.812,00)
//     dentro dele, que não podem bater com extrato nenhum. A soma dos cards das
//     contas é −R$ 74.190,46, que não é nem um nem outro.
//
// ⭐ A REGRA DO DONO: *"o que dá pra derivar da MESMA fonte das abas, deriva; o
// que não tem definição honesta, sai — número sem régua em tela de dinheiro é
// pior que ausência."*
//
// Sobrou o que se defende: os vínculos (o mesmo `totais` das abas), a dupla
// contagem (a mesma lista, somada UMA vez cada) e a conferência de saldo por
// conta — `balance` (o número do card) contra `ledgerBal` (o que o banco
// declarou), com a data da declaração. Conta sem extrato importado fica de fora,
// nomeada.
//
// ⛔⛔ E O TERCEIRO ESTADO (08/09), pedido do dono depois de ver a tela: *"o ⚠ do
// Banrisul é o BLOQUEIO +24h — a mania nº 1, que a ficha do banco já conhece.
// Alarme âmbar em diferença esperada e explicável vira ruído."* Quando a diferença
// bate AO CENTAVO com o bloqueio declarado, a linha fica **cinza, com a frase**, e
// o ⚠ some. ⚠️ Só quando a diferença **não** é o bloqueio declarado o alarme volta
// — a ficha explica por que a comparação não fecha, não dá passe livre pra
// qualquer divergência. **Pela ficha, nunca por `if (Banrisul)`.**

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Info, Link2, Copy, ArrowRight } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'

export interface ConferenciaContaDTO {
  id: string; nome: string; sistema: number; declarado: number
  declaradoEm: string | null; diferenca: number
  estado: 'BATE' | 'EXPLICADO' | 'DIVERGE'
  explicacao: string | null
  bloqueio: number | null; bloqueioEm: string | null
}
export interface SaldosDTO {
  contas: ConferenciaContaDTO[]
  semExtrato: { id: string; nome: string; sistema: number }[]
  batem: number
  explicadas: number
  naoBatem: number
}
export interface SemParDTO {
  total: number
  naoVenceram: number
  aguardandoExtrato: number
  comExtratoImportado: number
  ultimoExtrato: string | null
}
export interface TotaisDTO {
  contas: number; comSugestao: number; transferencias: number; duplicatas: number
  duplaContagem: number; valorEmDuplaContagem: number
}

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export function CabecalhoDaFila({ empresaId, totais, saldos, semPar }: {
  empresaId: string; totais: TotaisDTO; saldos: SaldosDTO; semPar: SemParDTO
}) {
  return (
    <div className="space-y-2">
      {/* ⛔ MOLDE OFICIAL DA CASA (`StatCard`), o mesmo da Contas a Pagar e da
          Produção. Antes eram blocos escritos à mão aqui — dois cards de resumo
          no sistema divergem com o tempo, e a REGRA 4 existe pra isso. */}
      <StatCardGrid>
        <StatCard
          tone={totais.comSugestao > 0 ? 'violet' : 'slate'}
          icon={Link2}
          label="esperando decisão"
          value={String(totais.comSugestao)}
          sub={totais.comSugestao === 1 ? 'vínculo sugerido' : 'vínculos sugeridos'}
        />
        <StatCard
          tone={totais.duplaContagem > 0 ? 'rose' : 'slate'}
          icon={Copy}
          label="em dupla contagem"
          value={formatBRL(totais.valorEmDuplaContagem)}
          sub={`${totais.duplaContagem} conta${totais.duplaContagem === 1 ? '' : 's'} paga${totais.duplaContagem === 1 ? '' : 's'} sem vínculo`}
        />
        <StatCard
          tone={saldos.naoBatem > 0 ? 'amber' : 'emerald'}
          icon={CheckCircle2}
          label="contas de extrato"
          value={`${saldos.batem + saldos.explicadas}/${saldos.contas.length}`}
          sub={saldos.naoBatem > 0
            ? `${saldos.naoBatem} com diferença aberta`
            : saldos.explicadas > 0 ? 'conferidas · 1 diferença explicada' : 'conferidas com o banco'}
        />
      </StatCardGrid>

      {/* ⛔ a conferência é POR CONTA — foi o agregado que produzia o número
          indefensável. Cada linha traz o SELO do seu estado, no padrão da casa. */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100
                      dark:border-slate-800 dark:bg-slate-950 dark:divide-slate-800">
        {saldos.contas.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2">
            <Selo estado={c.estado} />
            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{c.nome}</span>
            {c.estado === 'BATE' ? (
              <span className="text-[12px] text-slate-400 tabular-nums">
                bate com o banco em {dia(c.declaradoEm)}
              </span>
            ) : c.estado === 'EXPLICADO' ? (
              // ⛔ a frase vem do servidor (a MESMA régua que classificou) — montar
              // outra aqui seria a segunda derivação, no lugar mais fácil de errar.
              <span className="text-[12px] text-slate-500 dark:text-slate-400">{c.explicacao}</span>
            ) : (
              <span className="text-[12px] text-slate-500 tabular-nums dark:text-slate-400">
                sistema {formatBRL(c.sistema)} × banco {formatBRL(c.declarado)} em {dia(c.declaradoEm)}
                {' · '}
                <b className="font-semibold text-amber-700 dark:text-amber-400">
                  {formatBRL(Math.abs(c.diferenca))} de diferença
                </b>
                {c.explicacao && <span className="text-slate-400"> · {c.explicacao}</span>}
              </span>
            )}
          </div>
        ))}
        {saldos.semExtrato.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2">
            <span className="w-[74px] shrink-0" />
            <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{c.nome}</span>
            {/* ⚠️ nomeada de propósito: sem declaração do banco não há conferência,
                e dizer "bate" aqui seria inventar o outro lado. */}
            <span className="text-[12px] text-slate-400">sem extrato importado — fora da conferência</span>
          </div>
        ))}
      </div>

      {/* ⛔⛔ A LISTA DAS CONTAS SEM PAR SAIU DA TELA (08/09, decisão do dono):
          *"conta em aberto sem par no extrato é o estado NORMAL de uma conta que
          ainda não foi paga — não é pendência de conciliação"*, e o Contas a Pagar
          já tem tela própria. Fica UMA linha: número, sem lista, com link.

          ⚠️ E o número vem QUEBRADO de propósito. "109" sozinho é o badge que todo
          mundo aprende a ignorar; quebrado, ele se explica: a maioria nem venceu, e
          boa parte só espera o ARQUIVO do extrato — não uma decisão. */}
      {semPar.total > 0 && (
        <p className="px-1 text-[11.5px] leading-relaxed text-slate-400 tabular-nums">
          <b className="font-medium text-slate-600 dark:text-slate-300">{semPar.total}</b> contas em aberto sem par no extrato —{' '}
          {semPar.naoVenceram > 0 && <>{semPar.naoVenceram} ainda não venceram</>}
          {semPar.aguardandoExtrato > 0 && (
            <>
              {semPar.naoVenceram > 0 && ', '}
              {semPar.aguardandoExtrato} venceram depois do último extrato
              {semPar.ultimoExtrato && <> ({dia(semPar.ultimoExtrato)})</>}
            </>
          )}
          {semPar.comExtratoImportado > 0 && (
            <>
              , <b className="font-medium text-slate-600 dark:text-slate-300">{semPar.comExtratoImportado}</b>{' '}
              com o extrato do período já importado — <b>pagar, ou registrar saída do cofre</b>
            </>
          )}
          .{' '}
          {/* ⭐⭐ O GESTO DO COFRE A 1 CLIQUE (10/09/2026). ⚠️ Conta em aberto com o extrato
              do período JÁ importado e sem linha nenhuma quase sempre significa uma de duas
              coisas: não foi paga, ou saiu do COFRE — e o cofre não tem extrato por
              natureza (nunca teve OFX). Sem este caminho, essas contas ficam pendendo pra
              sempre esperando um arquivo que não existe. */}
          {semPar.comExtratoImportado > 0 && (
            <Link
              href={`/transacoes/nova?empresaId=${empresaId}&tipo=DEBIT&conta=cofre`}
              className="inline-flex items-center gap-0.5 font-medium text-[#534AB7] hover:underline dark:text-indigo-400"
            >
              registrar saída do cofre
            </Link>
          )}
          {semPar.comExtratoImportado > 0 && <> · </>}
          <Link
            href={`/contas-a-pagar?empresaId=${empresaId}`}
            className="inline-flex items-center gap-0.5 font-medium text-[#534AB7] hover:underline dark:text-indigo-400"
          >
            Ver no Contas a Pagar <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      )}
    </div>
  )
}

/**
 * ⭐ O SELO DO ESTADO — os três tons da casa, e nada além disso.
 *
 * ⛔ `EXPLICADO` é SLATE de propósito: âmbar num fato conhecido e conferido é o
 * ruído que o dono mandou tirar. Verde afirma que fecha; slate diz "sei o que é".
 */
function Selo({ estado }: { estado: ConferenciaContaDTO['estado'] }) {
  const cfg = {
    BATE: { txt: 'bate', Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
    EXPLICADO: { txt: 'explicado', Icon: Info, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    DIVERGE: { txt: 'diferença', Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  }[estado]
  return (
    <span className={`inline-flex w-[74px] shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cfg.cls}`}>
      <cfg.Icon className="h-3 w-3 shrink-0" />
      {cfg.txt}
    </span>
  )
}
