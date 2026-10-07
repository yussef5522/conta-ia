/**
 * ⭐⭐⭐ AS 3 PRATELEIRAS E OS INTERRUPTORES (07/10/2026) — a régua PURA.
 *
 * **Ordem do dono:** *"🏠 A CASA · 🏦 O BANCO · 📅 COMPROMISSOS DO MÊS, cada uma com
 * interruptor próprio. Ligar/desligar recalcula NA HORA os cartões; o rótulo do 1º cartão
 * acompanha e uma linha discreta diz o que está fora da conta."*
 *
 * ⛔⛔ **ESTE ARQUIVO É A ÚNICA RÉGUA DE "QUANTO SOMA O QUE ESTÁ LIGADO" — e isso é o que
 * torna o "recalcula ao vivo" possível sem inventar uma segunda conta.** O SERVIDOR usa estas
 * funções pro primeiro paint (com os chips persistidos) e a TELA usa as MESMAS pro toggle. Se
 * a tela tivesse aritmética própria, os 8 estados dos chips seriam 8 chances de ela mostrar um
 * número que o servidor não confirma — e o dono não teria como saber qual dos dois está certo.
 *
 * ⚠️ **O VOCABULÁRIO DAS PRATELEIRAS MORA AQUI, NUNCA NUM CHECK DO BANCO.** A lição de 21/09
 * (`chk_venda_map_alvo`) foi caríssima: CHECK com vocabulário fechado numa tabela de
 * CONFIGURAÇÃO virou parede **em um dia**, quando a palavra nova chegou. O CHECK da coluna
 * `prateleira` valida FORMA (não-vazia, maiúscula); quem valida o VOCABULÁRIO é o TypeScript,
 * onde se acrescenta uma linha.
 */

/** ⭐ as prateleiras de CATEGORIA (compromissos não é categoria — ele é derivado de contrato/fatura) */
export const PRATELEIRAS = ['CASA', 'BANCO'] as const
export type Prateleira = (typeof PRATELEIRAS)[number]

export function ehPrateleira(x: unknown): x is Prateleira {
  return typeof x === 'string' && (PRATELEIRAS as readonly string[]).includes(x)
}

/**
 * ⚠️ O DEFAULT É `CASA`, e isso é a direção SEGURA: categoria marcada antes desta tela existir
 * (as 26 que o dono marcou em 06/10) continua aparecendo onde ele a pôs. Um default `BANCO`
 * teria movido 26 linhas de lugar sem ninguém pedir.
 */
export const PRATELEIRA_PADRAO: Prateleira = 'CASA'

export function prateleiraOuPadrao(x: unknown): Prateleira {
  return ehPrateleira(x) ? x : PRATELEIRA_PADRAO
}

export const ICONE_DA_PRATELEIRA: Record<Prateleira, string> = { CASA: '🏠', BANCO: '🏦' }
export const ROTULO_DA_PRATELEIRA: Record<Prateleira, string> = { CASA: 'A casa', BANCO: 'O banco' }
export const ICONE_COMPROMISSOS = '📅'

/** ⭐ o estado dos 3 interruptores */
export interface Chips {
  casa: boolean
  banco: boolean
  compromissos: boolean
}

/**
 * ⭐⭐ **DEFAULT = TUDO LIGADO — "a realidade de hoje"** (palavras do dono).
 *
 * ⚠️ E ele é o default de AUSÊNCIA DE LINHA, não um valor gravado no cadastro: usuário que
 * nunca tocou nos chips vê a conta completa. A visão *"empresa de verdade no futuro"* (só 🏠)
 * fica a um clique — mas é ESCOLHA dele, nunca o estado inicial, senão a tela esconderia
 * R$ 60 mil de banco e compromisso de quem nunca soube que existia um interruptor.
 */
export const CHIPS_PADRAO: Chips = { casa: true, banco: true, compromissos: true }

/** ⭐ os subtotais que o servidor mede — a entrada da aritmética dos cartões */
export interface SubtotaisDasPrateleiras {
  /** Σ do PLANEJADO das linhas da casa. `null` = nada declarado ainda (≠ zero) */
  casaPlanejado: number | null
  casaRealizado: number
  /** Σ do PLANEJADO das linhas do banco. `null` = nada declarado ainda */
  bancoPlanejado: number | null
  bancoRealizado: number
  /** ⚠️ compromisso não tem "planejado": é caixa que CERTAMENTE sai, medida do contrato/fatura */
  compromissos: number
  /** ⚠️ quantos compromissos ficaram "a apurar" (parcela POS sem previsão, fatura não importada) */
  compromissosAApurar: number
}

export interface ContaDosCartoes {
  /** o número do 1º cartão. `null` = a apurar */
  total: number | null
  /** o rótulo que acompanha os chips ligados */
  rotulo: string
  /** por que é "a apurar", quando é */
  porque: string | null
  /** ⭐ a linha discreta do que ficou FORA da conta — `null` quando nada está fora */
  foraDaConta: string | null
  /** quais prateleiras entraram (pra tela destacar as seções) */
  ligadas: Chips
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐⭐ O RÓTULO DO 1º CARTÃO SEGUE OS CHIPS — ordem explícita do dono.
 *
 * ⛔ Um rótulo fixo *"A CASA CUSTA"* sobre uma soma que inclui banco e compromisso seria o
 * cartão mentindo sobre o que ele está somando. O nome é parte do número.
 */
export function rotuloDoPrimeiroCartao(c: Chips): string {
  const partes: string[] = []
  if (c.casa) partes.push('CASA')
  if (c.banco) partes.push('BANCO')
  if (c.compromissos) partes.push('COMPROMISSOS')
  if (partes.length === 0) return 'NADA NA CONTA'
  if (partes.length === 1 && c.casa) return 'A CASA CUSTA'
  return partes.join(' + ')
}

/**
 * ⭐⭐⭐ A SOMA DO QUE ESTÁ LIGADO — e a cascata do "a apurar" é a parte que importa.
 *
 * ⛔⛔ **PRATELEIRA LIGADA SEM PLANO DECLARADO NÃO VALE ZERO — ela torna o cartão "a apurar".**
 * Somar `0` pela casa sem plano faria o cartão dizer *"a casa + banco custa R$ 12.102"* quando
 * o dono nunca declarou o custo da casa — e ele leria isso como *"minha casa é de graça"*, que
 * é a pior leitura possível desta tela. É a MESMA régua do cartão (a) de 06/10 (*"ele NÃO cai
 * no realizado quando falta plano"*), agora valendo por prateleira.
 *
 * ⚠️ **COMPROMISSOS é a exceção, e por um motivo estrutural: ele não tem "planejado".** O valor
 * dele é MEDIDO (a parcela que o contrato diz, a fatura que o cartão fechou), então zero
 * compromisso é um FATO ("não vence nada neste mês"), não uma ausência de declaração.
 */
export function contaDosCartoes(c: Chips, s: SubtotaisDasPrateleiras): ContaDosCartoes {
  const ligadas = c
  const rotulo = rotuloDoPrimeiroCartao(c)

  // ⭐ o que ficou FORA — dito SEMPRE que algo está fora, com o valor, nunca só "filtrado"
  const fora: string[] = []
  if (!c.casa && (s.casaPlanejado != null || s.casaRealizado > 0))
    fora.push(`casa ${s.casaPlanejado != null ? brl(s.casaPlanejado) : 'a apurar'}`)
  if (!c.banco && (s.bancoPlanejado != null || s.bancoRealizado > 0))
    fora.push(`banco ${s.bancoPlanejado != null ? brl(s.bancoPlanejado) : 'a apurar'}`)
  if (!c.compromissos && s.compromissos > 0) fora.push(`compromissos ${brl(s.compromissos)}`)
  const foraDaConta = fora.length > 0 ? `fora da conta: ${fora.join(' · ')}` : null

  if (!c.casa && !c.banco && !c.compromissos) {
    return {
      total: null,
      rotulo,
      porque: 'nenhuma prateleira ligada — ligue pelo menos uma pra eu somar',
      foraDaConta,
      ligadas,
    }
  }

  const faltando: string[] = []
  let total = 0
  if (c.casa) {
    if (s.casaPlanejado == null) faltando.push('a casa')
    else total += s.casaPlanejado
  }
  if (c.banco) {
    if (s.bancoPlanejado == null) faltando.push('o banco')
    else total += s.bancoPlanejado
  }
  if (c.compromissos) total += s.compromissos

  if (faltando.length > 0) {
    return {
      total: null,
      rotulo,
      porque: `declare o que cada custo fixo de ${faltando.join(' e ')} deve custar pra eu somar`,
      foraDaConta,
      ligadas,
    }
  }

  return { total, rotulo, porque: null, foraDaConta, ligadas }
}

/**
 * ⭐⭐⭐ O 4º CARTÃO — "PRA NÃO AFUNDAR".
 *
 * **Ordem do dono:** *"FIXO (não depende dos chips — é sempre a verdade completa): (casa
 * planejada + banco + compromissos do mês, sem dupla contagem) ÷ dias ÷ margem."*
 *
 * ⛔⛔ **ELE IGNORA OS CHIPS DE PROPÓSITO, e essa é a razão de ele existir.** Os 3 primeiros
 * cartões servem pra o dono ENXAIAR cenário (*"como seria sem o banco?"*); este responde
 * *"quanto preciso vender HOJE pra não afundar"*, e a resposta não muda porque ele desligou um
 * interruptor. Um 4º cartão que obedecesse aos chips seria o mesmo cartão do ponto de
 * equilíbrio com outro nome — e deixaria de ser a âncora.
 */
export interface PraNaoAfundar {
  porDia: number | null
  porque: string | null
  conta: string | null
  /** a soma completa (casa + banco + compromissos), independente dos chips */
  totalDoMes: number | null
}

export function praNaoAfundar(
  s: SubtotaisDasPrateleiras,
  dias: number,
  margemPct: number | null,
  margemPorque: string | null,
): PraNaoAfundar {
  const conta = contaDosCartoes(CHIPS_PADRAO, s)
  if (conta.total == null) {
    return { porDia: null, porque: conta.porque, conta: null, totalDoMes: null }
  }
  if (margemPct == null || margemPct <= 0) {
    return {
      porDia: null,
      porque: margemPorque ?? 'margem indisponível',
      conta: null,
      totalDoMes: conta.total,
    }
  }
  const porDia = conta.total / dias / margemPct
  return {
    porDia,
    porque: null,
    conta: `${brl(conta.total)} do mês ÷ ${dias} dias ÷ margem de ${(margemPct * 100).toFixed(1)}%`,
    totalDoMes: conta.total,
  }
}

// ─────────── ⭐⭐ O PONTO DE EQUILÍBRIO MUDOU DE CASA, e o motivo é de BUNDLE ───────────
//
// ⛔⛔ A fórmula vivia em `margem.ts`, que importa `prisma` no topo — e a TELA precisa dela
// pra recalcular os cartões no toggle dos chips SEM ida ao servidor. Importar `margem.ts` num
// componente `'use client'` arrastaria o Prisma pro bundle do navegador.
//
// ⚠️ **ELA NÃO FOI COPIADA: ela MUDOU de arquivo, e o `margem.ts` passou a REEXPORTAR.** Duas
// fórmulas de ponto de equilíbrio dariam dois números pro mesmo mês — a doença que esta casa
// mais paga. O parâmetro virou ESTRUTURAL (`{pct, porque}`) pra não haver import circular.

export interface PontoDeEquilibrio {
  /** quanto vender por dia aberto. `null` = a apurar */
  porDia: number | null
  porque: string | null
  conta: string | null
}

/**
 * ⭐⭐ O PONTO DE EQUILÍBRIO — e ele herda o "a apurar" das DUAS pontas.
 *
 * ⛔ Sem custo fixo declarado não existe meta (dividir zero por margem daria R$ 0,00/dia, que
 * se lê como *"a casa se paga sozinha"* — a pior mentira possível neste cartão). Sem margem
 * medida, idem. **Nunca número inventado** é ordem do dono, e as duas ausências caem aqui.
 */
export function pontoDeEquilibrio(
  custoFixoDiario: number | null,
  margem: { pct: number | null; porque: string | null },
): PontoDeEquilibrio {
  if (custoFixoDiario == null) {
    return { porDia: null, porque: 'declare o que cada custo fixo deve custar pra eu calcular', conta: null }
  }
  if (margem.pct == null || margem.pct <= 0) {
    return { porDia: null, porque: margem.porque ?? 'margem indisponível', conta: null }
  }
  const porDia = custoFixoDiario / margem.pct
  return {
    porDia,
    porque: null,
    conta: `${brl(custoFixoDiario)} por dia ÷ margem de ${(margem.pct * 100).toFixed(1)}%`,
  }
}

/** ⭐ o "por dia aberto" — o 2º cartão */
export interface PorDiaAberto {
  valor: number | null
  dias: number
  /** ⚠️ o rótulo HONESTO: a empresa não tem calendário de funcionamento cadastrado */
  rotulo: string
}

export function rotuloDosDias(dias: number): string {
  return `${dias} dias no mês — a empresa não tem calendário de funcionamento cadastrado, então conto os dias corridos`
}

/** ⭐ os 4 cartões do topo, de uma vez */
export interface CartoesDoTopo {
  conta: ContaDosCartoes
  porDia: PorDiaAberto
  equilibrio: PontoDeEquilibrio
  afundar: PraNaoAfundar
}

/**
 * ⭐⭐⭐ **A ARITMÉTICA DOS 4 CARTÕES, NUM LUGAR SÓ — é isto que faz os 8 estados dos chips
 * serem 8 leituras da MESMA régua.**
 *
 * O SERVIDOR chama no primeiro paint (com os chips persistidos) e a TELA chama no toggle. Se a
 * tela tivesse a conta própria, cada combinação de interruptor seria uma chance de ela mostrar
 * um número que o servidor não confirma — e o dono não teria como saber qual dos dois está
 * certo. É a lição do B1 (*"quando N leitores precisam da MESMA decisão, a decisão vira lib"*)
 * aplicada a um gesto visual.
 */
export function cartoesDoTopo(
  chips: Chips,
  s: SubtotaisDasPrateleiras,
  dias: number,
  margem: { pct: number | null; porque: string | null },
): CartoesDoTopo {
  const conta = contaDosCartoes(chips, s)
  const porDia: PorDiaAberto = {
    valor: conta.total == null ? null : conta.total / dias,
    dias,
    rotulo: rotuloDosDias(dias),
  }
  return {
    conta,
    porDia,
    equilibrio: pontoDeEquilibrio(porDia.valor, margem),
    afundar: praNaoAfundar(s, dias, margem.pct, margem.porque),
  }
}
