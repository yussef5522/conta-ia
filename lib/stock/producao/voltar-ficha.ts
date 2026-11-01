// ⭐⭐ DE ONDE VOCÊ VEIO — o destino depois de salvar a ficha (03/09/2026).
//
// ⛔ O BUG: a página `/estoque/fichas/nova` montava o editor **sem dizer de onde o usuário
// veio**, então o `voltar` caía no default `/estoque/fichas` — a lista MISTA. Salvar um
// sabor pela prateleira jogava o dono no lixão que a gente acabou de separar, e ele ia
// repetir esse gesto ~50 vezes numa tarde. A mesma porta atingia o `+ criar ficha` da tela
// de Vendas.
//
// ⭐ QUEM CHAMA É QUEM SABE: o destino vem EXPLÍCITO na URL (`?voltar=`), não adivinhado
// pelo `tipo`. Heurística aqui erraria no dia em que uma quarta tela abrisse o editor —
// e erraria em silêncio, mandando a pessoa pra uma lista qualquer.
//
// ⚠️ E O DESTINO SÓ PODE SER CAMINHO INTERNO: `?voltar=https://…` é open redirect de
// manual. A mesma trava do `redirect` do convite (30/08).

export interface OrigemDaFicha {
  /** `?voltar=` — o caminho que a tela de origem passou */
  voltar?: string | null
  /** `?complemento=` — veio da prateleira de complementos */
  complemento?: string | null
  /** `?tipo=` */
  tipo?: string | null
}

/** Só caminho interno: começa com `/` e não é `//` (que o browser lê como host). */
export function ehCaminhoInterno(v: string | null | undefined): boolean {
  return !!v && v.startsWith('/') && !v.startsWith('//')
}

/**
 * ⭐⭐ OS NOMES DO PDV QUE A FICHA VAI MAPEAR — a rede que impede a ficha ÓRFÃ.
 *
 * ⛔⛔ O BUG (10/05/2026): a revisão do import mandava `?mapearComplemento=<nome>` e
 * `fichas/nova/page.tsx` + `ficha-editor` leem `?complemento=`. **Nome de param inventado
 * de um lado, lido do outro: NINGUÉM casava** → o POST ia com `mapearComplemento: null`,
 * a ficha nascia SEM VÍNCULO, a revisão seguia dizendo "sem destino" e a venda daquele
 * sabor NÃO baixava estoque. Outubro: 5 sabores com ficha e 0 vínculo · 266 vendas sem baixa.
 *
 * ⭐ A REDE É ESTA FUNÇÃO (REGRA 5 — disciplina vira impossibilidade): ela é o ÚNICO leitor
 * de "quais nomes do PDV esta ficha mapeia", e aceita as DUAS grafias — `complemento` (a
 * convenção que o cardápio e a volta-da-revisão já usavam) e o ALIAS `mapearComplemento`.
 * Com ela, param reinventado não pode mais ser dropado em silêncio: o alias cai no mesmo
 * balde. E link velho em print/e-mail/histórico continua funcionando.
 *
 * ⚠️ `getAll` nos dois: o link do grupo manda um `complemento=` POR GRAFIA, e o salvar
 * mapeia todas na MESMA transação — uma ficha, uma viagem.
 * ⚠️ Trim e dedup porque as duas grafias podem vir juntas no mesmo link (o sender antigo
 * mandava `mapearComplemento` E o novo manda `complemento`) — mapear o mesmo nome duas
 * vezes no mesmo gesto é pedir pro upsert brigar com ele mesmo.
 */
export function nomesDeComplementoDaUrl(qp: URLSearchParams | null | undefined): string[] {
  if (!qp) return []
  const crus = [...qp.getAll('complemento'), ...qp.getAll('mapearComplemento')]
  const vistos = new Set<string>()
  const nomes: string[] = []
  for (const cru of crus) {
    const nome = cru.trim()
    if (!nome || vistos.has(nome)) continue
    vistos.add(nome)
    nomes.push(nome)
  }
  return nomes
}

/**
 * Pra onde voltar ao salvar/cancelar.
 *
 * ⚠️ O fallback continua sendo `/estoque/fichas` **de propósito**: ela deixou de ser lista e
 * virou PLACA de três destinos, então cair lá sem origem conhecida não é mais castigo —
 * é a tela que diz "o que você procura fica aqui".
 */
export function destinoDeVolta(companyId: string, o: OrigemDaFicha): string {
  if (ehCaminhoInterno(o.voltar)) return o.voltar!
  // ⭐ rede pra link antigo/colado à mão: veio com `?complemento=`, volta pra prateleira
  if (o.complemento) return `/empresas/${companyId}/estoque/cardapio?aba=complementos`
  return `/empresas/${companyId}/estoque/fichas`
}

export interface RotulosDaFicha {
  /** o h1 da página */
  titulo: string
  /** o texto do link de voltar */
  voltarTexto: string
}

/**
 * ⚠️ OS RÓTULOS MENTIAM NOS TRÊS MUNDOS: a página dizia sempre "Nova ficha técnica" e
 * "voltar pras fichas", mesmo quando o dono estava criando um SABOR pela prateleira. Rótulo
 * que não acompanha a origem é o mesmo defeito do cabeçalho que falava pelas duas abas.
 */
export function rotulosDaFicha(o: OrigemDaFicha): RotulosDaFicha {
  if (o.complemento || o.tipo === 'SABOR') return { titulo: 'Nova ficha de sabor', voltarTexto: 'voltar pra Complementos' }
  if (o.tipo === 'PRODUTO_FINAL') return { titulo: 'Nova ficha de produto', voltarTexto: 'voltar' }
  return { titulo: 'Nova ficha técnica', voltarTexto: 'voltar pras fichas' }
}

export interface DestinoDaPlaca {
  chave: 'cardapio' | 'receitas' | 'complementos'
  titulo: string
  /** o que mora ali, em uma linha — a placa existe pra responder isso */
  explica: string
  href: string
}

/**
 * ⭐⭐ A PLACA de `/estoque/fichas`.
 *
 * ⛔ A LISTA MORREU (03/09): ela misturava os três mundos numa lista só e o próprio aviso
 * azul dela confessava a mistura. Com ~50 sabores a caminho, viraria lixão.
 *
 * ⚠️ E NÃO VIROU `redirect` SECO por um motivo: ali chegam DOIS PAPÉIS (o dono, que quer o
 * cardápio; a cozinha, que quer as receitas). Redirect escolheria por quem chega e mandaria
 * metade das visitas pro lugar errado. A placa responde "onde fica o quê" em um toque.
 */
export function destinosDaPlaca(companyId: string): DestinoDaPlaca[] {
  const base = `/empresas/${companyId}/estoque`
  return [
    { chave: 'cardapio', titulo: 'Cardápio', explica: 'o que você VENDE — receita, custo e margem por produto', href: `${base}/cardapio` },
    { chave: 'receitas', titulo: 'Receitas de produção', explica: 'o que a cozinha FAZ em lote — gessado, beef, porções', href: `${base}/producao/receitas` },
    { chave: 'complementos', titulo: 'Complementos (sabores)', explica: 'os sabores do PDV — cada um aponta pra porção que ele consome', href: `${base}/cardapio?aba=complementos` },
  ]
}
