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

import { formatBRL } from '@/lib/format/money'
import { MOCK } from './mock-tokens'

export interface FilasDTO {
  prontosPraConfirmar: number
  praTuaMao: number
  semPagamento: number
  duplaContagem: number
  valorEmDuplaContagem: number
}

function Stat({ rotulo, valor, descricao, acao }: {
  rotulo: string; valor: string; descricao: string; acao?: boolean
}) {
  return (
    <div className="rounded-[14px] border px-[14px] py-[12px]"
      style={{ background: MOCK.card, borderColor: MOCK.line }}>
      <div className="text-[11px] uppercase tracking-[.04em]" style={{ color: MOCK.sub }}>
        {rotulo}
      </div>
      <div className="mt-[2px] text-[26px] font-bold tabular-nums"
        style={{ color: acao ? MOCK.roxo : MOCK.ink }}>
        {valor}
      </div>
      <div className="text-[12px]" style={{ color: MOCK.sub }}>{descricao}</div>
    </div>
  )
}

export function StatsDoMock({ filas }: { filas: FilasDTO }) {
  return (
    <div className="mb-[18px] grid grid-cols-3 gap-[10px]">
      <Stat
        rotulo="Prontos pra confirmar"
        valor={String(filas.prontosPraConfirmar)}
        // ⛔ nunca "fecham sozinhos": o sistema NÃO concilia sem o clique do dono, e
        // título que promete o contrário é como a confiança na tela se perde.
        descricao={filas.prontosPraConfirmar > 0 ? 'esperando só o seu clique' : 'nada esperando clique'}
      />
      <Stat
        acao
        rotulo="Pra tua mão"
        valor={String(filas.praTuaMao)}
        descricao="pagamentos que não fecham sozinhos"
      />
      <Stat
        rotulo="Sem pagamento"
        valor={String(filas.semPagamento)}
        descricao="pagar, ou registrar saída do cofre"
      />
      {/* ⚠️ a anomalia entra na grade só quando existe — e em DINHEIRO, que é o que
          torna o problema legível (duas linhas com o mesmo dinheiro). */}
      {filas.duplaContagem > 0 && (
        <div className="col-span-3 rounded-[14px] border px-[14px] py-[12px]"
          style={{ background: MOCK.coralFraco, borderColor: MOCK.coral + '33' }}>
          <div className="text-[11px] uppercase tracking-[.04em]" style={{ color: MOCK.coral }}>
            Em dupla contagem
          </div>
          <div className="mt-[2px] text-[26px] font-bold tabular-nums" style={{ color: MOCK.coral }}>
            {formatBRL(filas.valorEmDuplaContagem)}
          </div>
          <div className="text-[12px]" style={{ color: MOCK.coral }}>
            {filas.duplaContagem} conta{filas.duplaContagem === 1 ? '' : 's'} paga
            {filas.duplaContagem === 1 ? '' : 's'} sem vínculo — o mesmo dinheiro em duas linhas
          </div>
        </div>
      )}
    </div>
  )
}
