// ⭐⭐⭐ A ASSINATURA DE TROCA DE ESCALA — "você quis dizer 16,6?" (20/09/2026).
//
// **O caso que pediu isto, medido em prod:** na contagem de 14/09 a `CREME LEITE ITALAC
// 200GR` foi contada como **16.600** onde o sistema dizia **177** — e ficou. Hoje são
// R$ 39.342,36 de estoque fantasma. No mesmo dia o `REQUEIJAO CHEDDAR` levou **28.500** no
// lugar de **28,5** (esse a marcyelle corrigiu à noite).
//
// ⛔⛔ **E O FREIO ESTAVA LIGADO NOS DOIS — ele PERGUNTOU e ela CONFIRMOU.** A pergunta era
// vaga (*"a contagem está 9280% fora do sistema"*), e ***pergunta vaga é pergunta que se
// confirma sem ler***. A ordem do dono: *"pergunta ESPECÍFICA, com o número certo em 1
// toque; confirmar o absurdo continua possível, nunca mais por pergunta vaga."*
//
// ⚠️⚠️ **POR QUE ISTO NÃO É O `plausibilidade.ts` DA PRODUÇÃO (19/09), e NÃO se unifica
// com ele:** lá a régua compara o lote com o **rendimento histórico da própria ficha**
// (*"mil vezes o que essa receita sempre rendeu"*); aqui a régua compara o digitado com o
// **saldo do sistema**. São perguntas diferentes, com fontes diferentes — juntar as duas
// num "detector de grandeza" genérico faria a produção passar a olhar saldo, que não é o
// número dela. ⭐ O que as duas COMPARTILHAM é a leitura do mundo: *unidade mental ≠
// unidade de controle* (a balança mostra grama, o item é KG; a caixa tem 100, o dono
// digita o fardo).

/** ⭐ os fatores que a vida real produz: dezena, centena, milhar */
export const FATORES = [10, 100, 1000] as const

/**
 * ⭐ Quão longe do saldo o palpite pode cair e ainda ser "o número certo".
 *
 * ⚠️ Generoso de propósito (±60%): o estoque ANDA entre uma contagem e outra, então exigir
 * que o palpite bata quase exato descartaria o caso real — a `CREME LEITE` tinha 177 no
 * sistema e o palpite honesto é 166. O que a régua precisa separar é *troca de escala* de
 * *número aleatório*, e pra isso 60% sobra.
 */
const PERTO = 0.6

export interface TrocaDeEscala {
  /** 10, 100 ou 1000 */
  fator: number
  /** ⭐ o que a pessoa provavelmente quis digitar — SUGESTÃO, nunca aplicada sozinha */
  provavel: number
  /** a frase pronta, com o número: é ela que substitui a pergunta vaga */
  pergunta: string
}

const round3 = (n: number) => Math.round(n * 1000) / 1000
const pt = (n: number) => String(round3(n)).replace('.', ',')

/**
 * ⭐⭐ Existe potência de 10 que transforma o digitado em algo VIZINHO do saldo?
 *
 * ⛔ **A régua é o saldo do sistema, não a estética do número.** `16600` sozinho não é
 * suspeito (um estoque de 16.600 tampinhas é normal); o que o denuncia é `16600 / 100 =
 * 166` cair ao lado de `177`. *Sem o saldo como âncora isto viraria palpite sobre
 * qualquer número grande — e alarme sobre número grande é como um alarme morre.*
 *
 * ⚠️ `unidadeInteira` (UN) descarta o fator que produz fração: sugerir "16,6 unidades"
 * seria oferecer um número que o próprio sistema recusa.
 */
export function acharTrocaDeEscala(
  digitado: number,
  saldoSistema: number,
  opcoes?: { unidadeInteira?: boolean; unidade?: string },
): TrocaDeEscala | null {
  if (!(digitado > 0) || !(saldoSistema > 0)) return null
  // ⛔ só olha quando o digitado é MUITO maior — contagem menor que o sistema é o caso
  // comum (consumo não lançado), e não tem nada de troca de escala nisso.
  if (digitado / saldoSistema < FATORES[0]) return null

  let melhor: TrocaDeEscala | null = null
  let melhorDistancia = Infinity
  for (const fator of FATORES) {
    const provavel = round3(digitado / fator)
    if (provavel <= 0) continue
    if (opcoes?.unidadeInteira && !Number.isInteger(provavel)) continue
    const distancia = Math.abs(provavel - saldoSistema) / saldoSistema
    if (distancia > PERTO) continue
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia
      const un = opcoes?.unidade ? ` ${opcoes.unidade.toLowerCase()}` : ''
      melhor = {
        fator,
        provavel,
        pergunta: `Você quis dizer ${pt(provavel)}${un}? `
          + `${pt(digitado)} é ${fator === 1000 ? 'mil' : fator === 100 ? 'cem' : 'dez'} vezes o que o sistema tem `
          + `(${pt(saldoSistema)}${un}).`,
      }
    }
  }
  return melhor
}
