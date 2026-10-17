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
  /**
   * ⭐⭐ COMPRAS (lei C14, 16/10) — os dois fatos que a tela CONSUMO & COMPRAS já calcula, pelo
   * MESMO `contaDoPedido`/`farolDaCobertura` que a mesa de pedido desenha.
   *
   * ⛔ O radar **traduz**, nunca decide: se ele perguntasse "este item precisa de pedido?" por
   * conta própria, o alarme e a mesa divergiriam no primeiro ajuste da folga — e o dono veria
   * um item coral aqui que a mesa mostra em ordem.
   *
   * ⚠️ `compras: null` = a tela ainda não tem listas (ou a leitura falhou) → as duas linhas
   * saem como **A APURAR**, nunca como "nenhum". *Ausência de medição não é ausência de fato.*
   */
  compras: {
    /** itens com `pedirEm <= 0` e `pedir > 0` — o pedido que já devia ter saído */
    pedidoDeHojeNaoFeito: { quantos: number; primeiro: string | null }
    /** itens cuja cobertura acaba ANTES da próxima chegada possível (farol CORAL) */
    coberturaCoral: { quantos: number; primeiro: string | null }
  } | null
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

    /**
     * ⭐⭐ PEDIDO DE HOJE NÃO FEITO é CORAL — e aqui o coral é o certo, ao contrário do item
     * negativo: o dia do pedido **não volta**. Se o pedido sai amanhã, a mercadoria chega um
     * ciclo depois, e o furo no balcão já aconteceu.
     *
     * ⚠️ ANTI-SPAM pela própria conta: só entra item com `pedir > 0`. Item configurado que não
     * precisa de nada hoje **não acende** — e é isso que mantém a linha legível no dia em que
     * o dono configurar trinta itens.
     */
    {
      id: 'pedido-de-hoje',
      rotulo: 'Pedido pra hoje',
      valor:
        f.compras == null
          ? 'a apurar'
          : f.compras.pedidoDeHojeNaoFeito.quantos > 0
            ? String(f.compras.pedidoDeHojeNaoFeito.quantos)
            : 'nenhum',
      detalhe:
        f.compras == null
          ? 'as listas de compra ainda não foram montadas'
          : f.compras.pedidoDeHojeNaoFeito.quantos > 0
            ? f.compras.pedidoDeHojeNaoFeito.primeiro
              ? `${f.compras.pedidoDeHojeNaoFeito.primeiro} e outros — o dia do pedido não volta`
              : 'o dia do pedido não volta'
            : null,
      gravidade:
        f.compras == null
          ? 'AMBAR'
          : f.compras.pedidoDeHojeNaoFeito.quantos > 0
            ? 'CORAL'
            : 'VERDE',
      href: `${base}/estoque/consumo-e-compras`,
    },

    /**
     * ⭐ COBERTURA CORAL = o item **acaba antes da próxima chegada possível**, pelo
     * `farolDaCobertura` (lei C13). ⚠️ O degrau é relativo à CHEGADA, nunca um número fixo de
     * dias: 2 dias de cobertura é tranquilo pra quem recebe todo dia e é incêndio pra quem
     * recebe só na segunda — e um limiar fixo calaria justo no segundo caso.
     *
     * ⚠️ ÂMBAR, não coral: ela é a **consequência** do pedido não feito, e as duas linhas
     * acenderiam juntas no mesmo item. Dois corais pro mesmo fato é o que faz o dono parar de
     * ler o radar (*uma causa, um alarme*).
     */
    {
      id: 'cobertura-coral',
      rotulo: 'Acaba antes de chegar',
      valor:
        f.compras == null
          ? 'a apurar'
          : f.compras.coberturaCoral.quantos > 0
            ? String(f.compras.coberturaCoral.quantos)
            : 'nenhum',
      detalhe:
        f.compras == null
          ? 'as listas de compra ainda não foram montadas'
          : f.compras.coberturaCoral.quantos > 0
            ? f.compras.coberturaCoral.primeiro
              ? `${f.compras.coberturaCoral.primeiro} — a cobertura não alcança a próxima chegada`
              : 'a cobertura não alcança a próxima chegada'
            : null,
      gravidade:
        f.compras == null
          ? 'AMBAR'
          : f.compras.coberturaCoral.quantos > 0
            ? 'AMBAR'
            : 'VERDE',
      href: `${base}/estoque/consumo-e-compras`,
    },
  ]
}

/**
 * ⭐⭐ OS FATOS DE COMPRA, DERIVADOS DA LEITURA DA TELA — tradutor, zero conta nova.
 *
 * ⛔ Ele recebe o que `lerConsumoECompras` já devolveu (a agenda e o farol de cada linha) e
 * **só conta**. É o que garante que o radar e a mesa nunca discordem: o alarme nasce do MESMO
 * `contaDoPedido` que desenhou o card.
 */
export function fatosDeCompra(input: {
  agenda: readonly { nome: string; pedirEm: number; pedir: number }[]
  caros: readonly { nome: string; farol: string }[]
}): NonNullable<FatosDoRadar['compras']> {
  // ⚠️ `pedirEm <= 0` e não `=== 0`: antecedência maior que a distância até a chegada significa
  //    que o pedido JÁ DEVIA TER SAÍDO — a mesma régua do `diaPedir` (lei C6).
  const atrasados = input.agenda.filter((a) => a.pedirEm <= 0 && a.pedir > 0)
  const corais = input.caros.filter((c) => c.farol === 'CORAL')
  return {
    pedidoDeHojeNaoFeito: { quantos: atrasados.length, primeiro: atrasados[0]?.nome ?? null },
    coberturaCoral: { quantos: corais.length, primeiro: corais[0]?.nome ?? null },
  }
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
