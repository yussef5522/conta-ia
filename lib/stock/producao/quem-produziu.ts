/**
 * ⭐⭐ QUEM PRODUZIU — derivado DAS ETAPAS, nunca perguntado de novo (05/10/2026).
 *
 * **Ordem do dono (modal de concluir, v4):** *"Quem produziu: linha discreta «produzido por X
 * e Y (das etapas)» — SEM a explicação do PIN."*
 *
 * ⛔⛔ **POR QUE É LIB E NÃO UMA LINHA DE JSX:** *regra que mora num componente é regra que
 * ninguém prova* — o projeto roda em `environment: node`, sem jsdom, então a frase dentro do
 * `return` seria conferida por grep, e grep não distingue *"refatorei"* de *"quebrei"*. Aqui
 * ela é EXECUTADA.
 *
 * ⚠️ E a pergunta *"quem fez este lote?"* já tem resposta melhor do que um dropdown: o tablet
 * carimbou o PIN **por etapa**, com o tempo de cada mão. Perguntar de novo na conclusão abriria
 * espaço pras duas respostas divergirem (a doença do B1, em forma de nome de pessoa).
 */

export interface EtapaDeQuemProduziu {
  executorNome: string | null
  participantes: { nome: string; iniciou: boolean }[]
}

/**
 * PURA. Os nomes de quem REALMENTE pôs a mão, na ordem das etapas, sem repetir.
 *
 * ⛔⛔ **"QUEM INICIOU", NÃO "QUEM FOI DESIGNADO".** Designar é plano; iniciar é fato. O
 * designado que não apareceu **não produziu nada**, e pô-lo na etiqueta escreveria o trabalho
 * de uma pessoa na conta de outra.
 *
 * ⚠️ Etapa sem ninguém devolve nada — **não inventa pessoa**. Ordem antiga sem PIN carimbado é
 * um FATO (ninguém assinou), e é por isso que o dropdown continua existindo PRA ELA.
 */
export function quemProduziuNasEtapas(etapas: EtapaDeQuemProduziu[]): string[] {
  const vistos = new Set<string>()
  const nomes: string[] = []
  const por = (n: string | null | undefined) => {
    const nome = (n ?? '').trim()
    if (!nome) return
    // ⚠️ dedupe por caixa/espaço: "rodrigo", "Rodrigo" e "rodrigo " são a MESMA pessoa — a
    // cicatriz da conta `'sicredi '` (25/08) é o lembrete de que o espaço no fim existe no
    // dado real desta casa.
    const chave = nome.toLowerCase()
    if (vistos.has(chave)) return
    vistos.add(chave)
    nomes.push(nome)
  }
  for (const e of etapas) {
    const iniciaram = e.participantes.filter((p) => p.iniciou)
    if (iniciaram.length) iniciaram.forEach((p) => por(p.nome))
    else por(e.executorNome)
  }
  return nomes
}

/**
 * PURA. A frase discreta da modal — ou `null` quando ninguém assinou.
 *
 * ⛔ **A EXPLICAÇÃO DO PIN SAIU** (ordem do dono): *"quem produziu vem das etapas (o PIN de
 * cada um)"* ensinava o mecanismo a quem já o usou. **A INFORMAÇÃO fica, a aula sai** — o
 * *"(das etapas)"* é o rastro de ONDE o nome veio, que é o que importa pra quem confere depois.
 *
 * ⚠️ `null` é estado próprio, nunca uma frase vazia: a tela decide o que mostrar na ausência
 * (ali ela oferece o dropdown), e um texto mudo esconderia a diferença.
 */
export function fraseDeQuemProduziu(nomes: string[]): string | null {
  if (!nomes.length) return null
  // ⚠️ "X e Y" / "X, Y e Z": é como se fala, e o olho conta as pessoas sem reler
  const lista =
    nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `produzido por ${lista} (das etapas)`
}
