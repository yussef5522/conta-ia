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

/** os ícones são NOMES, não componentes: esta lib é pura e não importa React */
export type IconeDaReceita = 'carne' | 'porcao' | 'massa' | 'preparo' | 'generico'

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
  { palavras: ['BEEF', 'HAMBURGUER', 'HAMBURGER', 'CARNE', 'ACEM', 'COXAO', 'PATINHO', 'GESSADO'], icone: 'carne', familia: 'rosa' },
  { palavras: ['PORCAO', 'PORCOES', 'PORÇAO', 'PORÇÃO'], icone: 'porcao', familia: 'ambar' },
  { palavras: ['MASSA', 'BOLINHA', 'PIZZA', 'PAO', 'PÃO'], icone: 'massa', familia: 'azul' },
  { palavras: ['PICAR', 'ABRIR', 'FATIAR', 'FATIADO', 'RALADO', 'RODELA', 'PICADO', 'MOER'], icone: 'preparo', familia: 'teal' },
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
