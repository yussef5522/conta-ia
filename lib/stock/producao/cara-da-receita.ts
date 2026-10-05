/**
 * ⭐⭐ A CARA DA RECEITA — ícone e família de cor, ESTÁVEIS (04/10/2026).
 *
 * **Pedido do dono:** *"ícone da receita em quadradinho arredondado colorido (mapa ícone/cor
 * estável por tipo: carne/beef, porção, massa, preparo — hash estável, mesma receita sempre
 * igual)"*.
 *
 * ⛔⛔ **ESTÁVEL É O PONTO, não "bonito".** O olho aprende a achar a porção de queijo pelo
 * quadradinho antes de ler o nome; cor sorteada no render destruiria exatamente isso. Por tipo
 * quando o nome diz o tipo; por **hash do nome** quando não diz — nunca aleatório.
 *
 * ⚠️⚠️ **E A LISTA DE PALAVRAS É FECHADA, COM BORDA DE PALAVRA.** Sem a borda, `MASSA` casaria
 * dentro de `MASSAROCA` e `CARNE` dentro de `CARNEIRO` — é a cicatriz do `AGUA` que casava
 * dentro de `GUARDANAPO` no cardápio (08/09). E com lista ABERTA (qualquer palavra virando
 * tipo) a promoção com nome inventado ganharia uma cor própria, quebrando a estabilidade que
 * a coluna existe pra ter.
 */

/**
 * ⛔⛔ **CORAL NÃO ESTÁ AQUI, E É DE PROPÓSITO.** Nesta casa coral significa *"algo está
 * errado"* — é a linguagem da ordem ATRASADA (filete, relógio e selo coral) e do saldo
 * negativo. A 1ª versão desta lib deu coral pra CARNE (beef/coxão/acém), e aí toda linha de
 * beef nasceria com a cara de atrasada: o alarme perderia o contraste justamente na receita
 * mais produzida da casa. Carne virou ROSA. É a mesma razão por que o `AvatarPessoa` tira o
 * coral da paleta de pessoas.
 */
export type FamiliaDeCor = 'indigo' | 'azul' | 'verde' | 'ambar' | 'teal' | 'rosa' | 'cinza'

/**
 * os ícones são NOMES, não componentes: esta lib é pura e não importa React.
 *
 * ⭐ **05/10 (visual v4): o mapa cresceu de 5 pra 13 ícones, e CADA GRUPO NASCEU DO DADO REAL** —
 * as 44 receitas produzidas na Caçula nos últimos 90 dias, medidas em prod antes de uma linha
 * ser escrita. O teste `cara-da-receita-golden` passa as 44 por aqui e exige o grupo esperado:
 * é o que impede o mapa de virar imaginação minha sobre o que uma cozinha produz.
 */
export type IconeDaReceita =
  | 'queijo' | 'carne' | 'bacon' | 'calabresa' | 'frango' | 'frito'
  | 'massa' | 'molho' | 'ovo' | 'legume' | 'preparo' | 'porcao' | 'generico'

export interface CaraDaReceita {
  familia: FamiliaDeCor
  icone: IconeDaReceita
}

/**
 * ⚠️ A ORDEM IMPORTA: o específico ganha do genérico. `beef de xis` casa `BEEF` (carne) antes
 * de casar `XIS`; `porcao coxao` casa `PORCAO` antes de `COXAO`. É a mesma disciplina da régua
 * de seções do cardápio, onde `FRANGO FRITO` tinha que vir antes de `FRITAS`.
 */
const TIPOS: { palavras: string[]; icone: IconeDaReceita; familia: FamiliaDeCor }[] = [
  /**
   * ⭐ **A FAMÍLIA agrupa PARENTES; o ÍCONE distingue.** Carne, bacon e calabresa são as três
   * ROSA — porque as três são carne, e é isso que o olho precisa saber de 2 metros; o desenho
   * (bife · fatia · embutido) diz qual. São 13 grupos pra 7 famílias de cor, então repetir
   * família é inevitável — e é melhor que inventar uma 8ª paleta fora dos tokens.
   */

  /**
   * ⚠️⚠️ MASSA/PIZZA é a PRIMEIRA, antes de todo recheio — e o dado forçou isso duas vezes:
   * `Pizza congelada de calabresa` é PIZZA (não calabresa) e `PIZZA FRANGO CATUPIRY CONGELADA`
   * é PIZZA (não frango **nem queijo** — o "catupiry" é recheio). ⭐ Vale pro clássico que não
   * está no dado também: *pão de queijo* é massa.
   */
  { palavras: ['MASSA', 'BOLINHA', 'PIZZA', 'PAO', 'PÃO', 'ESFIHA', 'ESFIRRA'], icone: 'massa', familia: 'azul' },

  /** ⚠️ QUEIJO vem antes de FRITO por causa de `porcao queijo empanado 100 grama`: o
   *  INGREDIENTE identifica a receita melhor que o modo de preparo. */
  { palavras: ['QUEIJO', 'CHEDDAR', 'MUSSARELA', 'REQUEIJAO', 'CATUPIRY'], icone: 'queijo', familia: 'ambar' },

  /** ⚠️ FRITO antes de FRANGO — senão `porçao frango frito 200 grama` (20 lotes) viraria
   *  "frango", e fritura é família própria por ordem do dono. */
  { palavras: ['FRITO', 'FRITA', 'FRITAS', 'EMPANADO', 'EMPANADA', 'CROCANTE', 'NUGGET'], icone: 'frito', familia: 'ambar' },

  /** ⚠️ FRANGO antes de CARNE: `Hamburger de frango 150 grama` é FRANGO, e `beef de hamburger`
   *  (que não tem a palavra frango) continua caindo em carne logo abaixo. */
  { palavras: ['FRANGO', 'ISCA', 'ISCAS', 'PEITO'], icone: 'frango', familia: 'teal' },

  { palavras: ['CALABRESA', 'LINGUICA', 'PEPPERONI', 'SALAME'], icone: 'calabresa', familia: 'rosa' },
  { palavras: ['BACON', 'PANCETA'], icone: 'bacon', familia: 'rosa' },
  /**
   * ⚠️⚠️ LEGUME antes de CARNE, de PREPARO e de PORÇÃO — e os TRÊS têm caso real no dado:
   * `Aneis de cebola hamburguer` é CEBOLA (o "hamburguer" ali diz pra que serve, não o que é),
   * `tomate em rodela` é TOMATE (não "rodela") e `Porçao aneis de cebola` é CEBOLA (não
   * "porção"). ⭐ **O que a receita É ganha de pra que ela serve, de como foi cortada e de como
   * foi embalada** — e nenhuma das 44 receitas de carne tem nome de legume dentro, então subir
   * o legume não rouba nada da carne (conferido no golden, um por um).
   */
  { palavras: ['TOMATE', 'CEBOLA', 'BROCOLIS', 'PIMENTAO', 'MILHO', 'ERVILHA', 'ALFACE', 'BATATA', 'CENOURA', 'AZEITONA'], icone: 'legume', familia: 'verde' },

  { palavras: ['BEEF', 'HAMBURGUER', 'HAMBURGER', 'CARNE', 'ACEM', 'COXAO', 'COAX', 'PATINHO', 'GESSADO', 'ALCATRA', 'CHULETA', 'FILE'], icone: 'carne', familia: 'rosa' },

  /** ⚠️ MOLHO antes de PORÇÃO: `POÇAO MAIONESE 30G` é maionese — a palavra "porção" só diz o
   *  formato, nunca o quê. */
  { palavras: ['MAIONESE', 'MOLHO', 'CATCHUP', 'KETCHUP', 'MOSTARDA', 'BARBECUE'], icone: 'molho', familia: 'indigo' },
  { palavras: ['OVO', 'OVOS'], icone: 'ovo', familia: 'ambar' },

  { palavras: ['PICAR', 'ABRIR', 'FATIAR', 'FATIADO', 'RALADO', 'RODELA', 'PICADO', 'MOER', 'COZIDO', 'COZIDOS', 'ENCHER'], icone: 'preparo', familia: 'teal' },

  /** ⭐ o genérico de porção fica por ÚLTIMO: ele é o formato, e só manda quando nada mais diz
   *  o quê (ex.: `PORÇAO DE CHOCOLATE PRETO 50G`). */
  { palavras: ['PORCAO', 'PORCOES', 'PORÇAO', 'PORÇÃO', 'POCAO', 'POÇAO'], icone: 'porcao', familia: 'ambar' },
]

/** as famílias que o hash pode sortear quando o nome não diz o tipo */
const DO_HASH: FamiliaDeCor[] = ['indigo', 'verde', 'rosa', 'teal', 'azul']

/** PURA — sem caixa e sem acento, pra `porçao` e `PORCAO` serem a mesma palavra */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

/** a palavra existe no nome com BORDA DE PALAVRA (não como pedaço de outra) */
function temPalavra(nome: string, palavra: string): boolean {
  const n = normalizar(nome)
  const p = normalizar(palavra)
  const i = n.indexOf(p)
  if (i < 0) return false
  const antes = i === 0 ? ' ' : n[i - 1]
  const depois = i + p.length >= n.length ? ' ' : n[i + p.length]
  return !/[A-Z0-9]/.test(antes) && !/[A-Z0-9]/.test(depois)
}

/** hash estável (djb2) — o MESMO algoritmo do avatar de pessoa, uma régua de hash na casa */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function caraDaReceita(nome: string): CaraDaReceita {
  for (const t of TIPOS) {
    if (t.palavras.some((p) => temPalavra(nome, p))) return { familia: t.familia, icone: t.icone }
  }
  // ⚠️ `trim().toLowerCase()` antes do hash: `"Coca "` e `"coca"` são a MESMA receita (a
  // cicatriz da conta `'sicredi '` e do nome com espaço no fim).
  return { familia: DO_HASH[hash(nome.trim().toLowerCase()) % DO_HASH.length], icone: 'generico' }
}
