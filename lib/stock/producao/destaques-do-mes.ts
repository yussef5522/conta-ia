// ⭐⭐ OS DESTAQUES DO MÊS — TRÊS FACETAS, NUNCA UM PRÊMIO ÚNICO (06/09/2026).
//
// **A régua do dono:** *"Um prêmio único misturaria réguas diferentes; três facetas contam a
// história — quem leva as três ganhou de verdade."* E é o que os líderes fazem: o 7shifts
// mostra **os 3 mais engajados**, não "o melhor"; o Toast recorta produtividade por função,
// não num número só.
//
// ⛔⛔ E ESTA LIB É SÓ RÉGUA — pura, sem banco. Ela recebe as linhas que o relatório já
// calculou e decide QUEM aparece. Porque o risco aqui não é técnico, é humano: um destaque
// injusto é lido como acusação, e quem foi injustiçado uma vez não confia mais na tela.
//
// ⚠️ AS TRÊS PROTEÇÕES CONTRA INJUSTIÇA, todas explícitas:
//   1. **VOLUME MÍNIMO pra velocidade** — quem fez 1 tarefa pode ter o melhor min/un do mundo
//      por acaso. Abaixo do mínimo a pessoa NÃO entra nos destaques (mas continua na lista,
//      marcada "ainda apurando" — sumir seria pior que não premiar).
//   2. **"A APURAR" onde não há régua** — nunca 0%, nunca nota inventada.
//   3. **EMPATE NÃO ELEGE** — dois com o mesmo número não viram "o melhor" por desempate
//      arbitrário (ordem alfabética, quem gravou primeiro). Empate mostra os dois.

/** ⚠️ menos que isto não é desempenho, é amostra — a régua do dono (06/09) */
export const MINIMO_DE_TAREFAS_PRA_RANKEAR = 3

export type FacetaDoDestaque = 'MAIS_PRODUZIU' | 'MAIS_RAPIDO' | 'MELHOR_RENDIMENTO'

export interface CandidatoADestaque {
  colaboradorId: string
  nome: string
  tarefas: number
  /** unidades produzidas no período */
  produziu: number
  /** minutos por unidade — `null` quando não dá pra normalizar */
  minPorUnidade: number | null
  /** desvio % contra a média medida da ficha — `null` = sem régua ainda */
  rendimentoVsEsperado: number | null
}

export interface Destaque {
  faceta: FacetaDoDestaque
  titulo: string
  /** ⚠️ LISTA: empate mostra os dois, nunca desempata no escuro */
  quem: { colaboradorId: string; nome: string }[]
  /** o número que o card mostra, já formatado pelo caller */
  valor: number
  unidadeDoValor: string
  /** por que ninguém foi eleito, quando `quem` está vazio */
  semDestaque: string | null
}

const TITULO: Record<FacetaDoDestaque, string> = {
  MAIS_PRODUZIU: 'Mais produziu',
  MAIS_RAPIDO: 'Mais rápido',
  MELHOR_RENDIMENTO: 'Melhor rendimento',
}

/**
 * ⭐ Quem está APTO a concorrer numa faceta.
 *
 * ⚠️ "Mais produziu" NÃO exige volume mínimo — produzir muito **é** o mérito, e exigir 3
 * tarefas pra reconhecer quem fez 2 lotes gigantes seria a régua errada. O mínimo protege as
 * facetas de TAXA (velocidade, rendimento), onde poucas amostras mentem.
 */
export function aptoNaFaceta(c: CandidatoADestaque, faceta: FacetaDoDestaque): boolean {
  if (faceta === 'MAIS_PRODUZIU') return c.produziu > 0
  if (c.tarefas < MINIMO_DE_TAREFAS_PRA_RANKEAR) return false
  if (faceta === 'MAIS_RAPIDO') return c.minPorUnidade != null && c.minPorUnidade > 0
  return c.rendimentoVsEsperado != null
}

/** a frase que o card mostra quando ninguém foi eleito — sempre diz o PORQUÊ */
function porQueNinguem(faceta: FacetaDoDestaque, candidatos: CandidatoADestaque[]): string {
  if (!candidatos.length) return 'Ninguém produziu neste período.'
  if (faceta === 'MAIS_PRODUZIU') return 'Nenhum lote foi fechado neste período.'
  const quaseLa = candidatos.filter((c) => c.tarefas > 0 && c.tarefas < MINIMO_DE_TAREFAS_PRA_RANKEAR).length
  if (quaseLa) {
    return `Ainda apurando: é preciso pelo menos ${MINIMO_DE_TAREFAS_PRA_RANKEAR} tarefas no período pra comparar `
      + `${faceta === 'MAIS_RAPIDO' ? 'velocidade' : 'rendimento'} sem injustiça.`
  }
  return faceta === 'MAIS_RAPIDO'
    ? 'Sem quantidade medida — não dá pra comparar velocidade.'
    : 'Sem média de rendimento ainda — nenhuma ficha tem lotes suficientes.'
}

/**
 * ⭐⭐ OS TRÊS DESTAQUES. PURA.
 *
 * ⚠️ Cada faceta tem o seu SENTIDO: mais produziu e melhor rendimento são MAIOR-melhor;
 * mais rápido é MENOR-melhor (min/un). Tratar as três com a mesma comparação premiaria a
 * pessoa mais lenta da cozinha.
 */
export function destaquesDoMes(candidatos: CandidatoADestaque[]): Destaque[] {
  const facetas: FacetaDoDestaque[] = ['MAIS_PRODUZIU', 'MAIS_RAPIDO', 'MELHOR_RENDIMENTO']
  return facetas.map((faceta) => {
    const aptos = candidatos.filter((c) => aptoNaFaceta(c, faceta))
    if (!aptos.length) {
      return { faceta, titulo: TITULO[faceta], quem: [], valor: 0, unidadeDoValor: '', semDestaque: porQueNinguem(faceta, candidatos) }
    }
    const valorDe = (c: CandidatoADestaque) =>
      faceta === 'MAIS_PRODUZIU' ? c.produziu
        : faceta === 'MAIS_RAPIDO' ? c.minPorUnidade!
        : c.rendimentoVsEsperado!
    const melhor = faceta === 'MAIS_RAPIDO'
      ? Math.min(...aptos.map(valorDe))
      : Math.max(...aptos.map(valorDe))
    // ⚠️ tolerância de 1 casa: 4,20 e 4,2000001 são o mesmo número pra quem lê a tela, e
    // desempatar por ruído de ponto flutuante seria eleger por acaso.
    const quem = aptos.filter((c) => Math.abs(valorDe(c) - melhor) < 0.05)
    return {
      faceta,
      titulo: TITULO[faceta],
      quem: quem.map((c) => ({ colaboradorId: c.colaboradorId, nome: c.nome })),
      valor: Math.round(melhor * 100) / 100,
      unidadeDoValor: faceta === 'MAIS_PRODUZIU' ? 'un' : faceta === 'MAIS_RAPIDO' ? 'min/un' : '%',
      semDestaque: null,
    }
  })
}

/**
 * ⭐ Quem levou as TRÊS — *"quem leva as três ganhou de verdade"* (dono).
 *
 * ⚠️ Devolve lista: se duas pessoas levarem as três (empate em tudo), as duas ganharam. E
 * exige que as três facetas TENHAM vencedor — num mês sem régua de rendimento, ninguém
 * "ganhou tudo", porque não houve tudo pra ganhar.
 */
export function levouAsTres(destaques: Destaque[]): { colaboradorId: string; nome: string }[] {
  if (destaques.length !== 3 || destaques.some((d) => !d.quem.length)) return []
  const [a, b, c] = destaques
  return a.quem.filter((p) => b.quem.some((x) => x.colaboradorId === p.colaboradorId)
    && c.quem.some((x) => x.colaboradorId === p.colaboradorId))
}

/**
 * ⭐ A BARRA "min/un vs a média da equipe" — e o RISCO dela, escrito.
 *
 * ⚠️ Média de equipe com pouca gente é frágil: com 2 pessoas, uma está sempre "abaixo da
 * média" por construção, e isso lido como nota é injusto. Por isso a função devolve
 * `confiavel: false` abaixo de 3 pessoas — a tela mostra a barra apagada e diz que a
 * comparação ainda não vale.
 */
export function mediaDaEquipe(candidatos: CandidatoADestaque[]): { media: number | null; confiavel: boolean; pessoas: number } {
  const comTaxa = candidatos.filter((c) => c.minPorUnidade != null && c.tarefas >= MINIMO_DE_TAREFAS_PRA_RANKEAR)
  if (!comTaxa.length) return { media: null, confiavel: false, pessoas: 0 }
  const media = comTaxa.reduce((s, c) => s + c.minPorUnidade!, 0) / comTaxa.length
  return { media: Math.round(media * 100) / 100, confiavel: comTaxa.length >= 3, pessoas: comTaxa.length }
}
