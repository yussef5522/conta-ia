/**
 * ⭐⭐⭐ O RADAR DA MESA — o módulo 2 (15/10/2026).
 *
 * **O que ele responde:** *"o que pede a minha mão HOJE"* — contas vencendo hoje, itens
 * negativos, conclusões esperando conferência, sabores sem ficha, e os selos da importação.
 *
 * ⛔⛔ **ELE É TRADUTOR, NÃO JUIZ. MÓDULO PURO, ZERO BANCO.** Ele recebe os FATOS já medidos
 * pelas portas que existem (`statusDaConta` · `saldosDaEmpresa` · `filaDeConferencia` ·
 * `lerMargem` · `lerCentralDeImport`) e traduz em linha + gravidade. ⚠️ Medir aqui seria a
 * **2ª derivação** de cada uma dessas perguntas, e o radar passaria a discordar da tela de
 * cada assunto no primeiro caso de borda — exatamente o que o dono proibiu: *"o radar que
 * diverge dos juízes = vermelho"*.
 *
 * ⭐ **A GRAVIDADE É DO DONO, e ela tem 3 degraus com AÇÃO diferente:** `CORAL` = precisa da
 * mão HOJE (o dia acaba e o estrago fica) · `AMBAR` = atenção (não é hoje, mas não pode
 * dormir) · `VERDE` = em ordem. ⚠️ Linha em ordem **FICA NA TELA** dizendo que está em ordem:
 * o radar some quando o trabalho zera e o dono deixa de saber se foi vigiado ou se a tela
 * quebrou — é a lição da *"fila zerada esconde o trabalho, nunca a ferramenta"* (12/09).
 */

export type Gravidade = 'CORAL' | 'AMBAR' | 'VERDE'

export interface LinhaDoRadar {
  /** chave estável — a tela usa de `key` e o guard a confere */
  id: string
  rotulo: string
  /** o número grande da linha (já formatado — quem formata dinheiro é a lib de money) */
  valor: string
  /** a frase curta que diz o que fazer; `null` quando está em ordem */
  detalhe: string | null
  gravidade: Gravidade
  /** pra onde o clique leva — ⛔ número morto é proibido, tudo clicável leva pra tela da coisa */
  href: string
}

export interface FatosDoRadar {
  empresaId: string
  /** contas a pagar que vencem HOJE (do `whereDoStatus('VENCE_HOJE')`) */
  venceHoje: { quantas: number; total: number }
  /** itens de estoque com saldo ≤ 0 (de `saldosDaEmpresa`) */
  itensNegativos: number
  /** conclusões de produção aguardando conferência (de `filaDeConferencia`) */
  aguardandoConferencia: number
  /**
   * cobertura do cardápio: quantos nomes vendem sem ficha, e a fração das unidades
   * vendidas que têm custo conhecido (de `lerMargem`). ⚠️ `cobertura: null` = a apurar.
   */
  cardapio: { semFicha: number; cobertura: number | null }
  /**
   * os dias da janela da importação de vendas que **pedem ação** (de `lerCentralDeImport`,
   * pelo MESMO `vereditoDoDia` que pinta o selo da tela — nunca uma régua nova).
   */
  importacao: { diasQuePedemAcao: number; diaMaisAntigo: string | null }
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const pct = (f: number) => `${Math.round(f * 100)}%`

export function montarRadar(f: FatosDoRadar): LinhaDoRadar[] {
  const base = `/empresas/${f.empresaId}`

  return [
    /**
     * ⭐ CONTAS VENCENDO HOJE é CORAL por natureza: o banco fecha e o dia não volta.
     * ⚠️ E o número vem do `whereDoStatus('VENCE_HOJE')` — a partição de 26/09 —, nunca de
     * um `dueDate < now` próprio, que às 23h de São Paulo pintaria de vermelho o que ainda
     * tem o dia inteiro (a cicatriz do fuso, 13/09).
     */
    {
      id: 'vence-hoje',
      rotulo: 'Vencem hoje',
      valor: f.venceHoje.quantas > 0 ? brl(f.venceHoje.total) : 'nada',
      detalhe:
        f.venceHoje.quantas > 0
          ? `${f.venceHoje.quantas} conta(s) — pagar antes do banco fechar`
          : null,
      gravidade: f.venceHoje.quantas > 0 ? 'CORAL' : 'VERDE',
      href: `${base}/contas-a-pagar?escopo=VENCE_HOJE`,
    },

    /**
     * ⚠️ ITEM NEGATIVO é ÂMBAR, não coral — e o motivo é medido: negativo **acontece** na
     * vida real (vendeu sem produção lançada, nota que não chegou) e a casa já trata isso
     * como estado honesto desde 23/09. Coral aqui gritaria todo dia e o dono aprenderia a
     * ignorar o coral — que é o alarme que precisa funcionar.
     */
    {
      id: 'itens-negativos',
      rotulo: 'Itens negativos',
      valor: f.itensNegativos > 0 ? String(f.itensNegativos) : 'nenhum',
      detalhe:
        f.itensNegativos > 0
          ? 'saiu mais do que entrou — falta a compra ou a produção'
          : null,
      gravidade: f.itensNegativos > 0 ? 'AMBAR' : 'VERDE',
      href: `${base}/estoque/posicao`,
    },

    /**
     * ⭐ CONFERÊNCIA é CORAL porque o estoque e a etiqueta **já saíram com o número
     * declarado** (a régua de 09/10): esperar é conviver com um número que ninguém conferiu.
     */
    {
      id: 'aguardando-conferencia',
      rotulo: 'Esperando conferência',
      valor: f.aguardandoConferencia > 0 ? String(f.aguardandoConferencia) : 'nenhuma',
      detalhe:
        f.aguardandoConferencia > 0
          ? 'o estoque já baixou com o número declarado'
          : null,
      gravidade: f.aguardandoConferencia > 0 ? 'CORAL' : 'VERDE',
      href: `${base}/estoque/producao/hoje`,
    },

    /**
     * ⭐ A COBERTURA É O NÚMERO QUE IMPORTA, não a contagem de nomes. ⚠️ Um nome sem ficha
     * que vendeu 1× pesa menos que um que vendeu 500 — contar nome faria a barra andar
     * devagar justo quando o dono mapeia o que mais importa (a lição de 02/09).
     * ⛔ `cobertura: null` → **"a apurar"**, nunca 0%.
     */
    {
      id: 'cardapio',
      rotulo: 'Cardápio sem ficha',
      valor: f.cardapio.semFicha > 0 ? String(f.cardapio.semFicha) : 'nenhum',
      detalhe:
        f.cardapio.semFicha > 0
          ? f.cardapio.cobertura == null
            ? 'cobertura a apurar — sem venda medida ainda'
            : `${pct(f.cardapio.cobertura)} das unidades vendidas têm custo`
          : null,
      gravidade: f.cardapio.semFicha > 0 ? 'AMBAR' : 'VERDE',
      href: `${base}/estoque/cardapio`,
    },

    /**
     * ⭐ IMPORTAÇÃO: o selo vem do MESMO `vereditoDoDia` que pinta a central (08/10) — o
     * radar traduz, nunca decide. ⚠️ E o dia de HOJE nunca entra: a cozinha importa de
     * noite, e cobrar às 10h um arquivo que chega às 23h é ruído diário.
     */
    {
      id: 'importacao',
      rotulo: 'Dias de venda sem arquivo',
      valor:
        f.importacao.diasQuePedemAcao > 0 ? String(f.importacao.diasQuePedemAcao) : 'nenhum',
      detalhe:
        f.importacao.diasQuePedemAcao > 0
          ? f.importacao.diaMaisAntigo
            ? `o mais antigo é ${ddmm(f.importacao.diaMaisAntigo)} — a venda daquele dia não baixou estoque`
            : 'a venda desses dias não baixou estoque'
          : null,
      gravidade: f.importacao.diasQuePedemAcao > 0 ? 'CORAL' : 'VERDE',
      href: `${base}/estoque/vendas`,
    },
  ]
}

/** ⚠️ formata do TEXTO, nunca de `new Date(dia)` — em fuso negativo isso volta um dia */
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

/**
 * ⭐ O PLACAR DO RADAR — quantas linhas pedem a mão hoje.
 *
 * ⚠️ A tela usa isso pro anel/contador do topo; **derivar das linhas** (em vez de contar os
 * fatos de novo) é o que garante que o contador e as linhas não têm como divergir — a lição
 * do badge que dizia um número e a tela outro (10/09).
 */
export function placarDoRadar(linhas: LinhaDoRadar[]): {
  coral: number
  ambar: number
  emOrdem: number
} {
  return {
    coral: linhas.filter((l) => l.gravidade === 'CORAL').length,
    ambar: linhas.filter((l) => l.gravidade === 'AMBAR').length,
    emOrdem: linhas.filter((l) => l.gravidade === 'VERDE').length,
  }
}
