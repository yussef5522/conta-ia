/**
 * ⭐⭐⭐ O RADAR DA COZINHA — a mesa ② (15/10/2026).
 *
 * **O que ele responde:** *"o que pede a minha mão NA COZINHA hoje"* — conclusão esperando
 * conferência, rendimento que destoa, item negativo, o retalho declarado e etapa sem tempo
 * medido.
 *
 * ⛔⛔ **TRADUTOR, NÃO JUIZ — MÓDULO PURO, ZERO BANCO**, exatamente como o irmão do dashboard
 * (`lib/balance/radar-da-mesa.ts`). Ele recebe os fatos JÁ MEDIDOS pelas portas que existem
 * (`filaDeConferencia` · `lotesDoPeriodo` · `saldosDaEmpresa` · `retalhoDasOrdens` ·
 * `foiMedido`) e traduz em linha + gravidade. ⚠️ Medir aqui seria a **2ª derivação** de cada
 * uma dessas perguntas — e o radar passaria a discordar da fila, do painel e do juiz P8 no
 * primeiro caso de borda, que é o vermelho que o dono nomeou: *"radar que diverge dos juízes"*.
 *
 * ⭐⭐ **E O TIPO É O MESMO DA MESA ①** (`LinhaDoRadar`/`Gravidade`/`placarDoRadar`): um tipo,
 * duas mesas, **um componente de radar**. Um tipo próprio aqui obrigaria a tela a desenhar dois
 * radares quase iguais, e eles divergiriam no primeiro degrau novo de gravidade.
 */

import { placarDoRadar, type Gravidade, type LinhaDoRadar } from '@/lib/balance/radar-da-mesa'
import { pctBR } from '@/lib/format/percentual'

export type { Gravidade, LinhaDoRadar }
/**
 * ⭐ O CONTADOR É O DA MESA ① — **derivado das linhas**, nunca uma contagem nova dos fatos.
 * Era assim que o badge dizia um número e a tela outro (10/09); com a derivação, o contador e
 * as linhas não têm COMO divergir.
 */
export { placarDoRadar }

export interface FatosDaCozinha {
  empresaId: string
  /** de `filaDeConferencia` — `atrasados` são os que passaram do degrau de 3h */
  conferencia: { aguardando: number; atrasados: number }
  /**
   * de `lotesDoPeriodo`: lotes cuja FAIXA congelada é `ACIMA`/`ABAIXO` (±15% da ficha).
   *
   * ⛔⛔ A régua é a **congelada na conclusão** (a coluna que o juiz **P8** lê) — nunca um
   * recálculo aqui. Recalcular faria o radar acusar um lote que o selo da linha chama de
   * normal, porque a média da ficha anda sozinha quando um lote novo entra.
   */
  rendimento: { foraDaFaixa: number; pior: { tarefa: string; pct: number } | null }
  /** de `saldosDaEmpresa` — itens com saldo < 0 (a régua da Posição, não uma soma crua) */
  negativos: { quantos: number; pior: { nome: string; texto: string } | null }
  /** de `retalhoDasOrdens` — `null` quando nenhuma ordem do dia declarou retalho */
  retalho: { kg: number; receita: string } | null
  /**
   * etapas do dia com tempo NÃO medido (zero, ausente ou relâmpago) — pela régua única
   * `foiMedido`/`ehRelampago` de `desempenho.ts`.
   */
  semTempoMedido: number
}

/**
 * ⚠️ `n1` formata QUANTIDADE (os KG do retalho), nunca percentual: *"como se escreve
 * percentual aqui?"* é pergunta do PROJETO e tem dono — `pctBR`. ⛔ Esta linha já era a **4ª
 * cópia** de `(pct * 100)` com formatação local, a doença que `lib/format/percentual.ts`
 * nasceu pra matar em 10/10 (`47.7%` de PONTO num ⓘ de dinheiro).
 */
const n1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function montarRadarDaCozinha(f: FatosDaCozinha): LinhaDoRadar[] {
  const base = `/empresas/${f.empresaId}`

  return [
    /**
     * ⭐ CONFERÊNCIA é CORAL porque **o estoque e a etiqueta já saíram com o número
     * declarado** (a régua de 09/10): esperar não é neutro — é conviver com um número que
     * ninguém conferiu. ⚠️ E o `atrasados` entra no DETALHE, nunca num 4º degrau de
     * gravidade: a ação é a mesma (conferir), só a pressa muda.
     */
    {
      id: 'coz-conferencia',
      rotulo: 'Esperando conferência',
      valor: f.conferencia.aguardando > 0 ? String(f.conferencia.aguardando) : 'nenhuma',
      detalhe:
        f.conferencia.aguardando > 0
          ? f.conferencia.atrasados > 0
            ? `${f.conferencia.atrasados} passaram de 3h — o estoque já baixou`
            : 'o estoque já baixou com o número declarado'
          : null,
      gravidade: f.conferencia.aguardando > 0 ? 'CORAL' : 'VERDE',
      href: `${base}/estoque/producao/hoje`,
    },

    /**
     * ⚠️ RENDIMENTO FORA DA FAIXA é ÂMBAR: *"é convite pra olhar, não veredito"* (a régua de
     * 13/09). Lote que rende 185% pode ser ficha com dose errada, pode ser retalho não
     * declarado, pode ser a cozinha indo bem — o radar aponta e **não acusa ninguém**.
     * ⛔ E a faixa vale pros DOIS lados: produzir demais é custo parado (04/10).
     */
    {
      id: 'coz-rendimento',
      rotulo: 'Rendimento fora da faixa',
      valor: f.rendimento.foraDaFaixa > 0 ? String(f.rendimento.foraDaFaixa) : 'nenhum',
      detalhe:
        f.rendimento.foraDaFaixa > 0 && f.rendimento.pior
          ? `${pctBR(f.rendimento.pior.pct)} em ${f.rendimento.pior.tarefa} — conferir`
          : f.rendimento.foraDaFaixa > 0
            ? 'conferir contra a ficha'
            : null,
      gravidade: f.rendimento.foraDaFaixa > 0 ? 'AMBAR' : 'VERDE',
      href: `${base}/estoque/producao/relatorios`,
    },

    /**
     * ⚠️ NEGATIVO é ÂMBAR, e o motivo é medido: negativo **acontece** na vida real (vendeu sem
     * produção lançada, nota que não chegou) e a casa trata isso como estado honesto desde
     * 23/09. Coral aqui gritaria todo dia e o dono aprenderia a ignorar o coral — que é o
     * alarme que precisa funcionar.
     */
    {
      id: 'coz-negativos',
      rotulo: 'Itens negativos',
      valor: f.negativos.quantos > 0 ? String(f.negativos.quantos) : 'nenhum',
      detalhe:
        f.negativos.quantos > 0 && f.negativos.pior
          ? `${f.negativos.pior.nome} (${f.negativos.pior.texto}) — contar`
          : f.negativos.quantos > 0
            ? 'saiu mais do que entrou — contar'
            : null,
      gravidade: f.negativos.quantos > 0 ? 'AMBAR' : 'VERDE',
      href: `${base}/estoque/posicao`,
    },

    /**
     * ⭐ O RETALHO É INFORMATIVO (VERDE nos dois estados) — ele não pede ação: ele EXPLICA um
     * rendimento alto que a linha de cima poderia acusar. ⚠️ *"bônus silencioso é bônus que
     * ninguém confere"* (09/10): sem esta linha, o dono veria 139% sem saber que 10 KG de
     * massa de ontem entraram no lote.
     */
    {
      id: 'coz-retalho',
      rotulo: 'Retalho de ontem',
      valor: f.retalho ? `${n1(f.retalho.kg)} KG` : 'nenhum',
      detalhe: f.retalho ? `declarado em ${f.retalho.receita}` : null,
      gravidade: 'VERDE',
      href: `${base}/estoque/producao`,
    },

    /**
     * ⚠️ ETAPA SEM TEMPO MEDIDO é ÂMBAR porque **ela envenena a média** (a lição do lote
     * relâmpago, 13/09: 3 registros retroativos puxaram a média da porção de queijo de 88
     * pra 44 min e fizeram uma pessoa aparecer 49% abaixo). ⛔ O trabalho continua contado;
     * o que não dá pra medir é a velocidade.
     */
    {
      id: 'coz-sem-tempo',
      rotulo: 'Etapas sem tempo medido',
      valor: f.semTempoMedido > 0 ? String(f.semTempoMedido) : 'nenhuma',
      detalhe:
        f.semTempoMedido > 0
          ? 'registro retroativo — fora do ritmo medido, o volume conta'
          : null,
      gravidade: f.semTempoMedido > 0 ? 'AMBAR' : 'VERDE',
      href: `${base}/estoque/producao/relatorios`,
    },
  ]
}
