'use client'

// ⭐⭐⭐ OS 3 STATS DO TOPO — O MOCK, AO PIXEL (`docs/mocks/conciliacao-mock.html`).
//
// **O dono:** *"os 3 stats do mock entram no lugar dos atuais: PRONTOS PRA CONFIRMAR ·
// PRA TUA MÃO · SEM PAGAMENTO — mesmo estilo (rótulo caps 11px, número 26px/700, descrição
// 12px; o número do 'pra tua mão' em roxo). São as três filas REAIS da tela."*
//
// Medido no arquivo:
//   `.stats` grid 3 colunas · gap 10px · margem-baixo 18px
//   `.stat`  fundo branco · borda 1px --line · raio 14px · padding 12px 14px
//   `.k`     11px · letter-spacing .04em · caps · cor --sub
//   `.v`     26px · 700 · margem-topo 2px
//   `.d`     12px · cor --sub
//   `.acao .v` roxo
//
// ⛔ A DUPLA CONTAGEM SÓ APARECE QUANDO > 0 — ordem do dono: *"anomalia é exceção, não
// móvel fixo da tela"*. Um card vermelho zerado toda vez treina o dono a não olhar, e aí
// no dia em que ele acender ninguém vê (a lição dos 111 alarmes falsos das vendas).

import Link from 'next/link'
import { formatBRL } from '@/lib/format/money'
import { MOCK } from './mock-tokens'
/**
 * ⭐⭐ O MOCK v3 REDESENHOU ESTES CARDS (16/09) — eles viraram **CARDS-FILTRO**: hover
 * levanta, ativo ganha borda roxa e fundo em degradê. ⛔ **Os NÚMEROS não mudaram** —
 * continuam as três filas reais, da MESMA `contarFilas` do badge e do servidor.
 */
import { V3, SOMBRA, SOMBRA_UP, MEDIDA } from './mock-v3-tokens'

export interface FilasDTO {
  prontosPraConfirmar: number
  praTuaMao: number
  semPagamento: number
  duplaContagem: number
  valorEmDuplaContagem: number
}

function Stat({ rotulo, valor, descricao, acao, tom, ativo, onClick, href }: {
  rotulo: string; valor: string; descricao: string
  acao?: boolean; tom?: 'verde' | 'roxo' | 'slate'
  ativo?: boolean; onClick?: () => void
  /**
   * ⭐⭐ O NÚMERO É A PORTA (20/09) — ordem do dono: *"o card 💤 SEM PAGAMENTO continua
   * sendo o caminho natural pros 104; se ele ainda não clica pro Contas a Pagar, passa a
   * clicar."* Com `href` o card vira LINK de verdade (abre em nova aba, o teclado
   * alcança, o leitor de tela anuncia) — nunca um `onClick` que finge ser navegação.
   */
  href?: string
}) {
  const corDoNumero = tom === 'verde' ? V3.verde : tom === 'slate' ? '#475569' : acao || tom === 'roxo' ? V3.roxo : V3.ink
  // ⚠️ o CORPO muda, o DESENHO não: um card com visual próprio pro caso "tem link"
  // divergiria no primeiro ajuste de tom — o que muda é a tag, nunca o estilo.
  const Corpo = (href ? Link : 'button') as React.ElementType
  return (
    /*
      ⚠️ É <button> e não <div> porque ELE FILTRA — o dono clica no número e a lista
      recorta. Elemento clicável que não é botão perde teclado e leitor de tela, e a casa
      já pagou isso no "ação escondida sem afordância não existe" (30/08).
    */
    <Corpo {...(href ? { href } : { type: 'button' as const, onClick })}
      aria-pressed={ativo ? true : undefined}
      className={`block rounded-[${MEDIDA.raioStat}px] border-[1.5px] px-4 py-[13px] text-left transition-all duration-150 hover:-translate-y-px`}
      style={{
        background: ativo ? `linear-gradient(160deg,#fff, ${V3.roxoBg})` : V3.card,
        borderColor: ativo ? V3.roxo : V3.line,
        boxShadow: ativo ? SOMBRA_UP : SOMBRA,
      }}>
      <div className="text-[10.5px] font-extrabold uppercase tracking-[.05em]" style={{ color: V3.sub }}>
        {rotulo}
      </div>
      <div className="mb-[1px] mt-[2px] text-[24px] font-extrabold tabular-nums" style={{ color: corDoNumero }}>
        {valor}
      </div>
      <div className="text-[11px]" style={{ color: V3.sub }}>{descricao}</div>
    </Corpo>
  )
}

export function StatsDoMock({ filas, hrefSemPagamento }: {
  filas: FilasDTO
  /** ⭐ o destino dos "sem pagamento" — o Contas a Pagar, onde eles se resolvem */
  hrefSemPagamento?: string
}) {
  return (
    <div className="mb-[18px] grid grid-cols-3 gap-[10px]">
      <Stat
        tom="verde"
        rotulo="⭐ Prontos pra confirmar"
        valor={String(filas.prontosPraConfirmar)}
        // ⛔ nunca "fecham sozinhos": o sistema NÃO concilia sem o clique do dono, e
        // título que promete o contrário é como a confiança na tela se perde.
        descricao={filas.prontosPraConfirmar > 0 ? 'esperando só o seu clique' : 'nada esperando clique'}
      />
      <Stat
        acao tom="roxo"
        rotulo="🖐 Pra tua mão"
        valor={String(filas.praTuaMao)}
        descricao="pagamentos que não fecham sozinhos"
      />
      <Stat
        tom="slate"
        rotulo="💤 Sem pagamento"
        valor={String(filas.semPagamento)}
        // ⭐ o texto do mock: o card DIZ pra onde leva, senão é um número que não se sabe
        // que é clicável — a lição do *"ação sem afordância não existe"* (30/08).
        descricao={hrefSemPagamento ? 'contas abertas · ver no Contas a Pagar →' : 'pagar, ou registrar saída do cofre'}
        href={hrefSemPagamento}
      />
      {/* ⚠️ a anomalia entra na grade só quando existe — e em DINHEIRO, que é o que
          torna o problema legível (duas linhas com o mesmo dinheiro). */}
      {filas.duplaContagem > 0 && (
        <div className="col-span-3 rounded-[18px] border-[1.5px] px-4 py-[13px]"
          style={{ background: V3.coralBg, borderColor: V3.coral + '44', boxShadow: SOMBRA }}>
          <div className="text-[11px] uppercase tracking-[.04em]" style={{ color: V3.coral }}>
            Em dupla contagem
          </div>
          <div className="mt-[2px] text-[24px] font-extrabold tabular-nums" style={{ color: V3.coral }}>
            {formatBRL(filas.valorEmDuplaContagem)}
          </div>
          <div className="text-[11px]" style={{ color: V3.coral }}>
            {filas.duplaContagem} conta{filas.duplaContagem === 1 ? '' : 's'} paga
            {filas.duplaContagem === 1 ? '' : 's'} sem vínculo — o mesmo dinheiro em duas linhas
          </div>
        </div>
      )}
    </div>
  )
}
