// ⛔⛔⛔ A DATA DA ORDEM DE PRODUÇÃO (19/09/2026) — o ano 202 que sumiu com um lote.
//
// **O caso real, medido por id:** a ordem `…4et405` («porçao calabresa ralada 50 grama»,
// R$ 42,18 de insumo já separado) foi gravada com `dataProducao` no **ano 202**, e o dono
// passou dois dias procurando por ela: *"criei uma produção de calabresa ralada e ELA
// SUMIU — não aparece em lugar nenhum"*.
//
// ⭐⭐ **A CAUSA, provada até os SEGUNDOS.** A rota validava com `z.string().min(1)` — que
// aceita qualquer texto — e fazia `new Date(\`${data}T12:00:00\`)`. Com a string
// **`"0202-09-18"`** (o que um `<input type="date">` manda quando o ano sai com um zero a
// mais) o resultado é:
//
// ```
// new Date('0202-09-18T12:00:00')  em America/Sao_Paulo  →  0202-09-18T15:06:28.000Z
//                                     o gravado em prod  →  0202-09-18T15:06:28.000Z  ⭐
// ```
//
// ⚠️ **Os `:06:28` são a assinatura**: no ano 202 São Paulo não tinha fuso de hora inteira
// — usava **LMT −03:06:28**. Toda ordem normal grava `15:00:00` cravado; só esta tem
// segundos. *Foi o resíduo do relógio histórico que identificou a string de origem.*
//
// ⛔ **E O ESTRAGO NÃO FOI A DATA — FOI O SUMIÇO.** `listOrdens` ordena por `dataProducao
// desc` com `take: 200`, e a empresa tem **238 ordens**: o ano 202 joga a linha pra
// **posição 238 de 238**, dentro das 38 que o teto corta. **1 ordem aberta no banco, 0
// visíveis em qualquer tela.** É o teto de leitura aplicado ANTES da pergunta que importa
// — a mesma doença do `take: 50` que escondeu o fermento da busca (16/09).
//
// ⭐ A cura é de DUAS pontas, e as duas são necessárias: aqui a data deixa de poder nascer
// torta (REGRA 5 — impossível, não improvável), e em `listOrdens` a ordem ABERTA deixa de
// depender do teto pra existir.

/** ⭐ a forma que o `<input type="date">` promete: ano de 4 dígitos, mês e dia */
const FORMATO = /^\d{4}-\d{2}-\d{2}$/

/**
 * ⚠️ A janela de plausibilidade é LARGA de propósito: ela existe pra barrar **ano 202 e
 * ano 20262**, não pra opinar sobre o calendário do dono. Produção lançada com atraso de
 * meses é caso real; produção no século III não é.
 */
export const ANO_MIN = 2020
export const ANO_MAX = 2100

export class DataDaOrdemError extends Error {}

/**
 * ⭐⭐ Texto do campo → `Date`, ou uma recusa que DIZ o que houve.
 *
 * ⛔ **O `Z` no fim é deliberado.** Sem ele a data depende do fuso do PROCESSO — foi
 * exatamente o que transformou `12:00` em `15:06:28`. Com `Z`, a mesma string dá o mesmo
 * instante em qualquer máquina; o meio-dia UTC mantém a data estável nos dois lados do
 * fuso brasileiro (09:00 em São Paulo), que é o motivo de ele ter sido escolhido.
 */
export function dataDaOrdem(texto: string): Date {
  const t = (texto ?? '').trim()
  if (!FORMATO.test(t)) {
    throw new DataDaOrdemError(
      `A data “${t}” não está no formato dia/mês/ano completo. Escolha a data no calendário — ` +
      'ano com quatro dígitos (2026, não 202).',
    )
  }
  const ano = Number(t.slice(0, 4))
  if (ano < ANO_MIN || ano > ANO_MAX) {
    throw new DataDaOrdemError(
      `O ano ${ano} não faz sentido pra uma produção. Confira a data — ` +
      'ordem com ano errado some das listas e o insumo separado fica preso nela.',
    )
  }
  const d = new Date(`${t}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new DataDaOrdemError(`A data “${t}” não existe no calendário.`)
  return d
}

/**
 * ⭐ A ordem já GRAVADA tem data plausível? — o outro lado da mesma régua.
 *
 * ⚠️ Existe porque o guard novo **não conserta o passado**: a linha do ano 202 continua no
 * banco, e quem precisa saber dela é a tela (pra mostrar em vez de esconder) e o juiz.
 */
export function dataEhPlausivel(d: Date): boolean {
  const a = d.getUTCFullYear()
  return a >= ANO_MIN && a <= ANO_MAX
}

/**
 * ⭐ OS ESTADOS QUE AINDA PEDEM TRABALHO — e a constante mora aqui, num arquivo PURO.
 *
 * ⚠️ Ela nasceu em `painel-producao`, que importa `conclusao`, que importa `ordens`.
 * `ordens` precisa dela pra não deixar ordem aberta fora da lista — e importar de lá
 * fecharia o ciclo. Lugar neutro resolve sem ninguém ter uma segunda cópia: quem tinha a
 * definição passa a reexportar a MESMA (REGRA 4).
 */
export const ESTADOS_ABERTOS = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] as const
