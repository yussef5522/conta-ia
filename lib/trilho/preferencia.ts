/**
 * ⭐⭐ A PREFERÊNCIA DO TRILHO — POR USUÁRIO, NA MESMA CASA DO TEMA (14/10/2026).
 *
 * **Ordem do dono (FRENTE B da fundação):** *"nasce RECOLHIDO (64px, só símbolos); PAROU O MOUSE
 * em cima → cresce e mostra os nomes; tirou → recolhe; o botão «» FIXA aberto. (…) A escolha
 * (fixo aberto ou recolhido) fica SALVA POR USUÁRIO, na MESMA casa da preferência de tema que já
 * existe — porta única de escrita."*
 *
 * ⛔⛔ **SÃO DOIS ESTADOS, NÃO TRÊS — e o "crescido por hover" NÃO é um deles.** O hover é
 * TRANSITÓRIO e mora no CSS (`.trilho.rec:hover`), nunca no banco: ele não é uma escolha, é o
 * mouse passando. Guardar "crescido" como preferência faria o trilho nascer aberto no dia
 * seguinte só porque o dono passou o mouse — a escolha dele é *"fixo aberto"* ou *"recolhido"*,
 * e é isso que persiste.
 *
 * ⚠️⚠️ **O VOCABULÁRIO MORA AQUI, NÃO NO CHECK DO BANCO** — a mesma régua do `tema/preferencia.ts`
 * e a mesma cicatriz de 21/09, em que o `CHECK (lista IN (…))` do radar virou PAREDE **um dia
 * depois** de nascer. A migration valida a FORMA (`trilho <> '' AND trilho = lower(trilho)`);
 * o dia em que entrar um terceiro estado se resolve editando a lista abaixo.
 *
 * ⚠️ PURO e sem `fs`/Prisma: quem desenha o «» é o CLIENTE. Misturar o banco aqui arrastaria o
 * client do Prisma pro bundle do navegador — a mesma razão de `tema/preferencia.ts` ser separado
 * de `tema/servidor.ts`.
 */

export const TRILHOS = ['recolhido', 'aberto'] as const
export type Trilho = (typeof TRILHOS)[number]

/**
 * ⭐ NASCE RECOLHIDO, por ordem do dono — e o default vale pra ausência E pra lixo.
 *
 * ⚠️ É o oposto do que a casa fazia até 13/10 (trilho fixo em 230px) e é deliberado: a tela de
 * trabalho ganha 166px de largura, e o nome volta com o mouse parado em cima.
 */
export const TRILHO_PADRAO: Trilho = 'recolhido'

/**
 * PURA e DEFENSIVA — traduz o que veio do banco/da rede num estado válido.
 *
 * ⚠️ NUNCA lança: isto roda no LAYOUT. Derrubar o app inteiro por causa de uma string estranha
 * na preferência de largura de menu seria trocar "menu na largura errada" por "app fora do ar".
 */
export function normalizarTrilho(bruto: unknown): Trilho {
  if (typeof bruto !== 'string') return TRILHO_PADRAO
  const t = bruto.trim().toLowerCase()
  return (TRILHOS as readonly string[]).includes(t) ? (t as Trilho) : TRILHO_PADRAO
}

/**
 * ⭐ A CLASSE QUE O CSS ESPERA — `'rec'` no recolhido, `''` no aberto.
 *
 * ⚠️ O nome da classe é o da referência (`.trilho.rec`), não uma invenção: é ela que o CSS da
 * fundação usa pros seletores de descendente (`.trilho.rec:not(:hover) .rotulo{display:none}`),
 * que são o que faz o hover crescer SEM uma linha de JavaScript.
 */
export function classeDoTrilho(trilho: Trilho): string {
  return trilho === 'recolhido' ? 'rec' : ''
}

/** o estado OPOSTO — o que o «» vai aplicar quando o dono toca nele */
export function alternarTrilho(trilho: Trilho): Trilho {
  return trilho === 'recolhido' ? 'aberto' : 'recolhido'
}

/**
 * ⭐ O QUE O «» ANUNCIA — pra ONDE o toque leva, nunca o estado atual.
 *
 * É a mesma convenção do botão de tema (a lua no claro significa *"clique pra escurecer"*), e o
 * `title` escreve a frase inteira **porque ícone sozinho ensina pela metade** — a lição de 30/08
 * (*"ação sem afordância não existe, principalmente no celular"*).
 */
export function caraDoRecolher(trilho: Trilho): { gira: boolean; titulo: string } {
  return trilho === 'recolhido'
    ? { gira: true, titulo: 'Menu recolhido — clique pra fixar aberto' }
    : { gira: false, titulo: 'Menu fixo aberto — clique pra recolher' }
}
