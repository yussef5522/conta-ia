// ⭐⭐ O VÍNCULO NA LINHA DIGITADA DO DANFE — e QUEM DECIDE O FATOR (31/08/2026).
//
// ⛔ O PROBLEMA: digitar os itens do papel e depois mapear tudo de novo eram DOIS
// trabalhos onde deveria ser um ("0/0 mapeados" depois de salvar). Escolher no catálogo
// enquanto digita resolve — mas cria a pergunta do fator.
//
// ⚠️⚠️ A DISTINÇÃO QUE NÃO PODE MORRER (regra do dono): o campo é **"descrição DO
// DANFE"**, não "meu produto". A nota diz `TOMATE LONGA VIDA CX 20KG`; no catálogo é
// `Tomate`. **Escolher no catálogo CRIA O VÍNCULO, não substitui a descrição** — o texto
// do papel continua sendo gravado como veio, e o vínculo vira linha no mapa aprendido.
//
// ⚠️⚠️ E O FATOR NUNCA É ADIVINHADO. A ordem de resolução já existe no módulo (22-23/08) e
// esta função não inventa outra — só perde o degrau que o papel não tem:
//
//     1. mapa aprendido do fornecedor (por CÓDIGO ou por NOME)
//     2. qTrib/uTrib da nota            ← ❌ não existe no DANFE digitado
//     3. sugestão pelo NOME do produto  ("CX/12", "2,27 KG CX/08 PC"), com a CONTA à vista
//     4. PERGUNTA — e a linha não fecha sem resposta
//
// ⛔ Foi o bug da Skol (22/08): fator 1 assumido em silêncio, e a caixa de 20 garrafas
// entrou como 1 unidade. **Unidade diferente + fator desconhecido = campo VAZIO e linha
// bloqueada**, nunca 1 por omissão.

export interface LinhaManual {
  /** o texto do papel — SEMPRE preservado, mesmo com vínculo */
  xProd: string
  qCom: string
  uCom: string
  vUnCom: string
  /** ⭐ o vínculo com o catálogo (null = texto livre, como era antes) */
  itemId: string | null
  itemNome: string | null
  unidadeControle: string | null
  /** texto, porque é o que se digita (a lição do campo de quantidade, 28/08) */
  fatorTexto: string
}

export const linhaVazia = (): LinhaManual => ({
  xProd: '', qCom: '', uCom: '', vUnCom: '',
  itemId: null, itemNome: null, unidadeControle: null, fatorTexto: '',
})

export type EstadoFator =
  /** unidades iguais — fator 1 NÃO é suposição, é identidade. Não pergunta nada. */
  | { tipo: 'IDENTIDADE'; fator: 1 }
  /** o mapa do fornecedor já sabe — vem preenchido, e continua editável */
  | { tipo: 'APRENDIDO'; fator: number }
  /** o nome do produto sugere ("CX/12") — SUGESTÃO, com a conta à vista */
  | { tipo: 'SUGERIDO'; fator: number; explicacao: string }
  /** não sei — a linha NÃO fecha até o dono responder */
  | { tipo: 'PERGUNTA'; pergunta: string }
  /** sem vínculo: não há unidade de controle pra converter */
  | { tipo: 'SEM_VINCULO' }

const norm = (u: string | null | undefined) => (u ?? '').trim().toUpperCase()

/**
 * PURA. Em que estado está o fator desta linha?
 *
 * @param aprendido fator que o mapa do fornecedor já conhece (null = não conhece)
 * @param sugerido  o que o NOME do produto sugere (null = não deu pra sugerir)
 */
export function estadoDoFator(
  l: Pick<LinhaManual, 'uCom' | 'unidadeControle'>,
  aprendido: number | null,
  sugerido: { fator: number; explicacao: string } | null,
): EstadoFator {
  if (!l.unidadeControle) return { tipo: 'SEM_VINCULO' }

  // ⭐ unidades iguais: converter seria multiplicar por 1. Perguntar aqui viraria ruído
  // que ensina a clicar sem ler — e alarme que se aprende a ignorar não protege nada.
  if (norm(l.uCom) === norm(l.unidadeControle) || !norm(l.uCom)) {
    return { tipo: 'IDENTIDADE', fator: 1 }
  }
  if (aprendido != null && aprendido > 0) return { tipo: 'APRENDIDO', fator: aprendido }
  if (sugerido && sugerido.fator > 0) return { tipo: 'SUGERIDO', ...sugerido }

  return {
    tipo: 'PERGUNTA',
    pergunta: `quantas ${norm(l.unidadeControle)} tem 1 ${norm(l.uCom)}?`,
  }
}

const num = (t: string) => Number(String(t).replace(/\./g, '').replace(',', '.'))

/** o fator que vale pra gravar — `null` quando ainda não dá pra saber */
export function fatorEfetivo(l: LinhaManual, estado: EstadoFator): number | null {
  const digitado = num(l.fatorTexto)
  if (l.fatorTexto.trim() !== '' && Number.isFinite(digitado) && digitado > 0) return digitado
  if (estado.tipo === 'IDENTIDADE') return 1
  if (estado.tipo === 'APRENDIDO' || estado.tipo === 'SUGERIDO') return estado.fator
  return null
}

/**
 * ⛔ A linha pode ser salva?
 *
 * ⚠️ Vínculo com unidade diferente e SEM fator resolvido **bloqueia**. É a trava que
 * faltava na Skol: sem ela, "1" entra por omissão e a caixa de 20 vira 1 unidade no ledger.
 */
export function linhaBloqueada(l: LinhaManual, estado: EstadoFator): string | null {
  if (!l.xProd.trim()) return null // linha em branco simplesmente não conta
  if (estado.tipo === 'PERGUNTA' && fatorEfetivo(l, estado) == null) {
    return `"${l.xProd}": a nota está em ${norm(l.uCom)} e o item é controlado em ${norm(l.unidadeControle)} — ${estado.pergunta}`
  }
  return null
}

/**
 * ⭐ Escolher no catálogo NÃO apaga o que foi digitado.
 *
 * ⚠️ A descrição do DANFE fica intacta — o vínculo entra ao lado dela. E a unidade de
 * CONTROLE vem do cadastro do item (é dele), enquanto `uCom` continua sendo a unidade que
 * a NOTA usa. São duas unidades diferentes de propósito; colapsar as duas foi o que fez a
 * Fruki entrar como 3 garrafas em vez de 36.
 */
export function aplicarItemEscolhido(
  linhas: LinhaManual[], i: number,
  item: { id: string; nome: string; unidadeControle: string },
): LinhaManual[] {
  return linhas.map((l, j) => (j === i
    ? { ...l, itemId: item.id, itemNome: item.nome, unidadeControle: item.unidadeControle }
    : l))
}

/** desfazer o vínculo — volta a ser texto livre, sem perder nada do que foi digitado */
export function limparVinculo(linhas: LinhaManual[], i: number): LinhaManual[] {
  return linhas.map((l, j) => (j === i
    ? { ...l, itemId: null, itemNome: null, unidadeControle: null, fatorTexto: '' }
    : l))
}
