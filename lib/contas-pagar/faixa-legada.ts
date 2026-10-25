/**
 * ⚠️⚠️ **O VOCABULÁRIO LEGADO DE `?faixa=` (21/10 → 23/10) — UM DONO SÓ, E ELE É PURO.**
 *
 * Os chips de faixa viveram dois dias e o cartão «A VENCER» voltou. O parâmetro sobrevive
 * **só pra link velho não virar 404 silencioso** (print, e-mail, histórico do navegador):
 * a rota traduz pra `escopo` em `FAIXA_LEGADA_PARA_ESCOPO`, e o filtro conta como ATIVO na
 * tela, então o dono sempre tem o "limpar" como caminho de volta. **Nada novo escreve aqui.**
 *
 * ⛔⛔ **POR QUE ESTE ARQUIVO EXISTE EM VEZ DE A LISTA MORAR NO `list-filters.ts`:** quem lê
 * `?faixa=` é a **PÁGINA** (client), e o `list-filters` importa `zod` e o montador de `where`
 * do Prisma. Pôr a lista lá obrigaria o bundle do cliente a arrastar o montador de query
 * inteiro — ou a página a reenumerar os seis valores à mão, que é **exatamente** a segunda
 * régua que deixou dois gestos mortos por dias em 25/09. Aqui é puro: **zero import**, e o
 * `list-filters` CONSOME (o `z.enum` deriva desta lista, nunca a repete).
 */

export const FAIXAS_LEGADAS = [
  'VENCIDAS',
  'VENCE_HOJE',
  'SETE_DIAS',
  'RESTO_DO_MES',
  'DEPOIS_DO_MES',
  'SEM_VENCIMENTO',
] as const

export type FaixaLegada = (typeof FAIXAS_LEGADAS)[number]

/**
 * ⛔ Valor desconhecido devolve `false` → a página cai em `undefined` = **a lista inteira**.
 *
 * ⚠️ Castar (`as FaixaLegada`) faria `?faixa=xpto` virar 400 do servidor ou, pior, uma lista
 * vazia com cara de *"não tem conta nenhuma"* — o "erro disfarçado de vazio" que esta casa
 * já pagou várias vezes.
 */
export function ehFaixaLegada(v: string | null | undefined): v is FaixaLegada {
  return !!v && (FAIXAS_LEGADAS as readonly string[]).includes(v)
}
