// ESTOQUE — DIGITAÇÃO DE QUANTIDADE (28/08). Puro, testável, um lugar só.
//
// ⚠️ O BUG QUE PEDIU ISTO: no modal da receita o campo de quantidade era
// `value={numero}` + `onChange={parse}`. Digitar "0,050" é IMPOSSÍVEL assim: no instante em
// que o dono digita a vírgula, o texto "0," vira o número 0 e a vírgula **some da tela**. Só
// dava pra escrever inteiro (1, 5, 10) — e receita de lanche é feita de FRAÇÃO de quilo
// (50 g de acém, 80 g de queijo). O modal ficava inútil pro caso principal.
//
// ⭐ A CURA É ESTRUTURAL: o que o dono DIGITA é TEXTO e fica texto enquanto ele digita. O
// número é DERIVADO. Estados intermediários ("0", "0,", "0,0") são legítimos e precisam
// sobreviver — é isso que um `value` numérico não permite.
//
// REGRAS por unidade:
//   PESO/VOLUME → até 3 casas (grama / mililitro é o menor que a cozinha usa)
//   UN e afins  → INTEIRO. Não existe 0,5 pão. Se um dia existir meio pão, o item vira uma
//                 unidade menor (é o mesmo princípio da reunitização pacote → unidade).
//
// ⛔⛔ 08/09/2026 — "N CAMINHOS, 1 ESQUECIDO", A CLASSE INTEIRA DE NOVO. Este arquivo nasceu
// em 28/08 pro editor de ficha e resolvia exatamente esta dor. **A conferência do
// recebimento nunca o usou**: ela tinha `<input type="number">` cru, e `type="number"` SEM
// `step` assume `step="1"` — o navegador recusa `0,600` **sozinho**, sem erro, sem log, sem
// uma linha nossa pra procurar. Caso real do dono: nota de KG em fração (0,600 · 0,350 ·
// 0,100) que ele não conseguia conferir.
//
// ⭐ E O ARMAZENAMENTO SEMPRE ESTEVE CERTO — medido antes de mexer: `qtdRecebida` é `Float`,
// a rota valida com `z.coerce.number().positive()` (sem `.int()`), e **241 dos 660
// movimentos do ledger já são fracionados** (vieram do `qCom` da nota). Só a DIGITAÇÃO era
// impossível.

/**
 * ⛔⛔⛔ 29/09/2026 — 3 CASAS PROIBIAM A VERDADE, E ISSO DERRETEU O FERMENTO VIRTUAL.
 *
 * **O dono:** *"a dose verdadeira do fermento é **0,0003 KG** (0,3 g por metade; 5 g fazem
 * 17 metades, fermento seco instantâneo). O campo só aceita 3 casas — não dá pra digitar.
 * Pra item em KG/LT com dose em décimos de grama, o campo proíbe a verdade — e a ficha fica
 * gorda 10×."*
 *
 * ⭐ **Ele está certo, e o teto de 3 casas era uma suposição minha sobre a cozinha** — o
 * comentário original dizia *"grama/mililitro é o menor que a cozinha usa"*. Fermento seco,
 * essência e tempero concentrado são dosados em **décimos de grama**, e o campo cortando em
 * 0,000 empurrava a ficha pro valor 10× maior que caberia — que é exatamente o número que
 * fez o mapa de 28/09 achar que a receita pedia 3 g quando pede 0,3 g.
 *
 * ⭐ **6 casas = 1 mg / 1 µl.** É folga honesta (nenhuma cozinha dosa abaixo disso) e o
 * limite tem que existir: sem teto, um dedo escorregando num zero grava 0,00000001 e o
 * custo por unidade vira ruído de ponto flutuante.
 *
 * ⚠️ **A COLUNA AGUENTA E FOI CONFERIDA:** `qtdPlanejada`, `quantidade` do ledger e
 * `qtdSeparada` são `Float` (double precision no Postgres) — 15 dígitos significativos, sem
 * `@db.Decimal(p,s)` em lugar nenhum do módulo. E o zod das duas rotas de ficha é
 * `z.number().positive()`, **sem `.int()` nem `multipleOf`**: o servidor sempre aceitou.
 * O que proibia era a DIGITAÇÃO e o arredondamento cedo dos motores.
 */
export const MAX_CASAS = 6

export type UnidadeQtd = 'KG' | 'LT' | 'UN' | string

/**
 * Unidade fracionável? **Peso e volume sim; contagem de peça, não.**
 *
 * ⚠️ A lista de INTEIRAS é a fechada, não a de fracionáveis — e a diferença importa: item
 * novo com unidade que ninguém previu (BANDEJA, FARDO…) cai no lado que **aceita** fração.
 * Travar o desconhecido no inteiro seria repetir o bug de origem num item que nem existe
 * ainda; e fração indevida numa peça o dono vê na hora, enquanto o campo bloqueado ele
 * descobre com a nota na mão.
 *
 * ⭐ 08/09: entraram G e ML (o dono pediu "KG, G, L, ML") e as peças que faltavam.
 */
const INTEIRAS = /^(UN|UND|PC|PCT|CX|DZ|PAR|FD|SC)$/i

export function aceitaFracao(unidade: UnidadeQtd): boolean {
  return !INTEIRAS.test((unidade ?? '').trim())
}

/**
 * O `step` do `<input type="number">`, derivado da unidade.
 *
 * ⛔ Existe pra quem **não puder** virar campo de texto. Onde der, prefira
 * `sanitizarQtd` + `valorQtd`: `type="number"` também perde os estados intermediários
 * (`"0,"` vira `0`), que é o bug que este arquivo nasceu pra matar.
 */
export function stepDaUnidade(unidade: UnidadeQtd): string {
  return aceitaFracao(unidade) ? String(1 / 10 ** MAX_CASAS) : '1'
}

/**
 * Limpa a DIGITAÇÃO preservando estados intermediários ("0," continua "0,").
 * Aceita vírgula (padrão BR) e ponto — o dono digita como quiser.
 */
export function sanitizarQtd(texto: string, unidade: UnidadeQtd): string {
  const bruto = (texto ?? '').replace(/[^\d.,]/g, '')
  // ⛔⛔ UNIDADE INTEIRA: o separador só pode ser MILHAR, então ele some e os dígitos ficam.
  //
  // ⚠️ 08/09 — DUAS REGRAS CONVIVIAM E EU SÓ VI MEDINDO. Aqui o separador **cortava** o
  // resto (`6.313 UN` → `6`), enquanto o cartão de contagem tinha parse próprio tratando
  // ponto como milhar (`6.313` → `6313`), com o motivo escrito lá: *"absurdo pra digitar
  // 6.313"*. Duas derivações da mesma pergunta — a lição do B1, agora na digitação.
  // Vence a da contagem: em unidade inteira, `6.313` é seis mil e trezentos e treze, e
  // cortar em `6` **perdia 6.307 unidades em silêncio**.
  if (!aceitaFracao(unidade)) return bruto.replace(/[.,]/g, '')

  // um separador só — o primeiro que aparecer manda; e vira vírgula (padrão BR na tela)
  const i = bruto.search(/[.,]/)
  if (i < 0) return bruto
  const inteiro = bruto.slice(0, i)
  const decimais = bruto.slice(i + 1).replace(/[.,]/g, '').slice(0, MAX_CASAS)
  return `${inteiro},${decimais}`
}

/** Texto → número. "0,050" → 0.05 · "" e lixo → null (NUNCA 0: vazio não é zero). */
export function valorQtd(texto: string): number | null {
  const t = (texto ?? '').trim().replace(',', '.')
  if (t === '' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Número → texto do campo, em pt-BR. 0.05 → "0,05". */
export function textoQtd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/**
 * ⭐⭐⭐ O DONO ÚNICO DA EXIBIÇÃO DE QUANTIDADE (29/09/2026).
 *
 * **A ordem do dono:** *"a TELA MOSTRA na unidade natural: dose < 1 g exibe «0,3 g», não
 * «0,0003 KG» — o padeiro lê grama, não fração de quilo."*
 *
 * ⛔⛔ **E o defeito de exibição era GÊMEO do da digitação, com outra cara:** as telas
 * formatavam com `maximumFractionDigits: 3`, então a dose de 0,0003 KG aparecia como **"0"**
 * — o campo proibia digitar a verdade *e* a tela não saberia mostrá-la.
 *
 * ⚠️ **A GRAVAÇÃO SEGUE EM KG/LT.** Isto é só leitura: `unidadeControle` continua sendo a
 * régua do item, o ledger continua em KG, e nada aqui volta pro banco. Guardar grama seria
 * criar uma segunda unidade pro mesmo item — o oposto da reunitização.
 *
 * ⭐ E ela é UMA função porque a mesma dose aparece no editor, na ficha, na separação e no
 * histórico: quatro formatações divergiriam na primeira casa decimal, e o dono veria a
 * receita dizer 0,3 g num lugar e 0 noutro.
 */
export function formatarQtd(valor: number | null | undefined, unidade: UnidadeQtd): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const menor = unidadeMenor(unidade)
  if (menor && Math.abs(valor) > 0 && Math.abs(valor) < 1) {
    // ⭐ a unidade menor é 1.000× — então as casas caem 3, e a PRECISÃO TOTAL é a mesma
    // (6 casas em KG == 3 casas em g == 1 µg, mais fino que o 1 mg que o campo aceita).
    return `${numeroBR(valor * 1000, MAX_CASAS - 3)} ${menor}`
  }
  return `${numeroBR(valor, MAX_CASAS)} ${(unidade ?? '').trim()}`.trim()
}

/** a unidade natural mil vezes menor, quando ela existe (KG→g, LT→ml) */
function unidadeMenor(unidade: UnidadeQtd): string | null {
  const u = (unidade ?? '').trim().toUpperCase()
  if (u === 'KG') return 'g'
  if (u === 'LT' || u === 'L') return 'ml'
  return null
}

/**
 * ⚠️ Sem zero à direita e SEM CORTAR casa significativa: `maximumFractionDigits` do
 * `Intl` arredonda, e era ele que transformava 0,0003 em "0". O teto é o mesmo
 * `MAX_CASAS` da digitação — a tela nunca mostra menos precisão do que o campo aceita.
 */
function numeroBR(n: number, casas: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

/**
 * ⭐ CONFIRMAÇÃO VISUAL — "0,050 KG = 50 g". Existe pra o dono não errar UM ZERO: 0,05 e
 * 0,005 são visualmente parecidos e 10× diferentes no custo. Só faz sentido abaixo de 1
 * (acima disso "1,5 KG" já se lê sozinho).
 *
 * ⚠️ Delega a conversão pro `formatarQtd` — uma conversão KG→g no projeto, não duas
 * (a régua do B1 aplicada a 1.000).
 */
export function descreverQtd(valor: number | null, unidade: UnidadeQtd): string | null {
  if (valor == null || valor <= 0 || valor >= 1) return null
  if (!unidadeMenor(unidade)) return null
  return formatarQtd(valor, unidade)
}

/** Validação na hora de salvar: devolve o erro em pt-BR, ou null se está bom. */
export function validarQtd(texto: string, unidade: UnidadeQtd, nomeItem: string): string | null {
  const v = valorQtd(texto)
  if (v == null || v <= 0) return `Informe a quantidade de "${nomeItem}" (maior que zero).`
  if (!aceitaFracao(unidade) && !Number.isInteger(v)) {
    return `"${nomeItem}" é contado em ${unidade} — não dá pra usar fração. Se você usa meia unidade, o item precisa ser cadastrado numa unidade menor.`
  }
  return null
}
