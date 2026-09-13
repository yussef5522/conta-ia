'use client'

// ⭐⭐⭐ O PLACAR DA EQUIPE NO HOJE (13/09/2026) — mock `hoje-placar-mock.html`.
//
// **O dono:** *"uma linha por pessoa que trabalhou HOJE — tarefas + unidades, barra, selo
// '+14% vs média' / 'na média' / '−31% · 2h18 (média 1h35)'."*
//
// ⛔⛔ **NUNCA NO TABLET DA COZINHA.** A rota que alimenta esta tela exige `stock.manage`, e
// a do tablet (`minhas-tarefas`) não devolve o placar — há guard disso. *"O âmbar é convite
// pra olhar, não veredito"*, e um convite desses na tela de quem está com a mão na massa
// vira outra coisa.
//
// ⚠️ **FIXO NO DIA, sem chips de período** (ordem escrita do dono). O mock traz uma legenda
// de chips no rodapé — **divergência registrada e resolvida a favor do pedido**: período
// livre mora nos Relatórios, e ter as duas janelas aqui faria a mesma pergunta ter duas
// respostas na mesma tela.
//
// ⭐ A conta NÃO mora aqui: vem inteira de `desempenho.ts` — a MESMA função que os
// Relatórios chamam com outra janela. A tela só pinta.

import Link from 'next/link'
// ⭐ o TIPO vem do dono único da conta (`desempenho.ts`) — declarar uma cópia aqui seria a
// segunda régua do placar, e ela divergiria no primeiro selo novo.
import type { DesempenhoDaPessoa } from '@/lib/stock/producao/desempenho'

/** ⭐ os tokens do mock, literais (a régua é o arquivo, como na Conciliação) */
const MOCK = {
  linha: '#f1efe9', sub: '#6b7280', ink: '#1f2430',
  roxo: '#534AB7', roxoFraco: '#eeecfa',
  verde: '#177245', verdeFraco: '#e6f4ec',
  ambar: '#b45309', ambarFraco: '#fdf3e3',
  slate: '#475569', slateFraco: '#eef2f6',
} as const

export type LinhaDoPlacar = DesempenhoDaPessoa

/** ⚠️ a cor da barra acompanha o SELO — quem não tem média fica sem barra, não com barra cinza cheia */
function corDaBarra(selo: LinhaDoPlacar['selo'], i: number): string {
  if (selo === 'ACIMA') return i === 0 ? MOCK.verde : '#7bc79a'
  if (selo === 'ABAIXO') return MOCK.ambar
  return '#a9a4d9'
}

export function PlacarDaEquipe({ empresaId, linhas, dia }: {
  empresaId: string; linhas: LinhaDoPlacar[]; dia: string
}) {
  // ⛔ dia sem ninguém não vira painel vazio: some, e o "o dia de cada uma" já conta a história
  if (!linhas.length) return null

  return (
    <div className="mb-3 rounded-[16px] border bg-white px-4 py-3.5" style={{ borderColor: '#e8e6e0' }}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-extrabold uppercase tracking-[.04em]" style={{ color: MOCK.sub }}>
          Placar da equipe · hoje
        </h3>
        {/* ⚠️ SEM chips de período: a janela livre é dos Relatórios (ordem do dono) */}
        <Link href={`/empresas/${empresaId}/estoque/producao/relatorios?de=${dia}&ate=${dia}`}
          className="text-[11.5px] font-semibold" style={{ color: MOCK.roxo }}>
          ver nos Relatórios →
        </Link>
      </div>

      {linhas.map((l, i) => (
        <Link
          key={l.colaboradorId}
          href={`/empresas/${empresaId}/estoque/producao/relatorios?pessoa=${l.colaboradorId}`}
          className="flex items-center gap-2.5 py-2 first:border-t-0"
          style={{ borderTop: `1px solid ${MOCK.linha}` }}
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
            style={{ background: MOCK.roxoFraco, color: MOCK.roxo }}>
            {l.nome.slice(0, 1).toUpperCase()}
          </span>
          <span className="w-[86px] shrink-0 text-[14px] font-bold" style={{ color: MOCK.ink }}>
            {l.nome}
            <small className="block text-[11px] font-normal" style={{ color: MOCK.sub }}>
              {l.tarefas} tarefa{l.tarefas > 1 ? 's' : ''}
              {l.unidades > 0 && ` · ${l.unidades.toLocaleString('pt-BR')} un`}
              {/* ⚠️ o tempo a apurar é DITO, nunca somido */}
              {l.tarefasSemTempo > 0 && ` · ${l.tarefasSemTempo} sem tempo`}
            </small>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block h-[14px] overflow-hidden rounded-full" style={{ background: MOCK.slateFraco }}>
              <i className="block h-full rounded-full"
                style={{ width: `${Math.round(l.proporcao * 100)}%`, background: corDaBarra(l.selo, i) }} />
            </span>
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold"
            style={
              l.selo === 'ACIMA' ? { background: MOCK.verdeFraco, color: MOCK.verde }
              : l.selo === 'ABAIXO' ? { background: MOCK.ambarFraco, color: MOCK.ambar }
              : l.selo === 'NA_MEDIA' ? { background: MOCK.slateFraco, color: MOCK.slate }
              : { background: 'none', color: MOCK.sub, fontWeight: 600, fontStyle: 'italic' }
            }>
            {l.frase}
          </span>
        </Link>
      ))}

      {/* ⭐ as REGRAS no rodapé, como no mock — quem lê o âmbar precisa saber o que ele mede */}
      <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: MOCK.sub }}>
        velocidade comparada com a <b>média histórica de cada tarefa</b> (só tarefas com 3+ lotes
        medidos entram na conta) · tempo finalizado pelo gerente fica fora · o âmbar é convite
        pra olhar, não veredito — toca na pessoa pra abrir o detalhe dela nos Relatórios
      </p>
    </div>
  )
}
