/**
 * ⭐⭐⭐ A LINHA DE CHEGADA DO DIA (07/10/2026).
 *
 * O pedido do dono era *"HOJE AO VIVO · a casa se paga às ~HH:MM"*, com a barra enchendo ao
 * longo do dia e a hora projetada pelo ritmo.
 *
 * ⛔⛔ **A HORA NÃO EXISTE, e isso foi MEDIDO antes de desenhar:**
 *
 * ```
 * stock_venda_linha.data  →  2026-10-06T15:00:00.000Z  (cravado: 15:00 UTC = meio-dia local)
 * criadoEm                →  2026-10-07T03:48:14.335Z  (o relatório do dia entra na MADRUGADA seguinte)
 * linhas de HOJE (07/10)  →  0
 * ```
 *
 * A venda chega **agregada por DIA**, sem instante — e o dia corrente fica **vazio até a
 * madrugada**. Projetar `acumulado ÷ horas decorridas` sobre um total diário seria **fabricar
 * precisão a partir de um número que não tem curva**, a mesma classe do *"tempo zero não é
 * velocidade infinita"* (06/09) e do *"a média da janela não é a média da pessoa"*.
 *
 * ⭐ **O cartão honesto é O ÚLTIMO DIA FECHADO, dizendo QUAL é:** quanto ele sobrou, quanto é
 * a casa DAQUELE dia, e o veredito. A pergunta do dono (*"quando a casa se paga?"*) continua
 * respondida — pelo **PLACAR DO MÊS** (`casa.ts`), que é onde ela cabe com dado diário.
 *
 * ⚠️ Se um dia o PDV exportar com hora, a hora entra aqui — e o comentário fica como o
 * registro de por que ela não existia.
 *
 * ⚠️ Função PURA. `agora` é PARÂMETRO (nunca `new Date()` aqui dentro): o relógio só serve
 * pra dizer se o dia mais recente é hoje ou não, nunca pra decidir número.
 */

export interface DiaComSobra {
  /** YYYY-MM-DD */
  dia: string
  sobra: number
  unidades: number
}

export interface LinhaDeChegada {
  /** o dia que o cartão está mostrando. `null` = nenhum dia com venda no período */
  dia: string | null
  /** ⭐ `true` quando o dia mostrado É o dia de hoje (raro: o relatório entra de madrugada) */
  ehHoje: boolean
  sobra: number | null
  unidades: number
  /** o custo fixo de UM dia aberto */
  casaDoDia: number | null
  /** sobra ÷ casa do dia, limitado a 1 pro desenho */
  pct: number | null
  /** passou da linha de chegada? */
  bateu: boolean
  /** quanto passou (só quando bateu) */
  sobrouDepois: number | null
  /** quanto faltou (só quando não bateu) */
  faltou: number | null
  /** a frase do cartão — nunca um número mudo. É `manchete.prefixo + manchete.destaque`. */
  frase: string
  /**
   * ⭐ A MANCHETE PARTIDA, pra a tela pintar o valor em VERDE sem recortar string.
   *
   * ⛔ A referência visual escreve *"06/10 pagou a casa do dia e ainda sobrou **R$ 1.323,51**"*
   * com o valor destacado. Partir a frase na TELA (um `split(' sobrou ')`) seria uma 2ª régua
   * da própria frase, e ela quebraria no 1º texto novo. Quem parte é quem escreve.
   */
  manchete: { prefixo: string; destaque: string | null }
  /**
   * ⭐ O RODAPÉ DA DIREITA: *"daqui pra frente cada venda é lucro"*.
   *
   * ⚠️ Ele saiu do fim da `frase` porque a referência o põe em OUTRO lugar do cartão (o pé,
   * ao lado da sobra do dia) e com OUTRO peso. É a mesma informação, no lugar que o dono
   * aprovou.
   */
  lucroDaquiPraFrente: boolean
  /** ⚠️ a ressalva quando o dia mostrado não é hoje: senão o dono lê um dia velho como atual */
  ressalva: string | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** o dia do BRASIL — às 21h de São Paulo o servidor em UTC já diz amanhã (cicatriz de 09/09) */
export function diaDoBrasil(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

export function linhaDeChegada(
  dias: readonly DiaComSobra[],
  casaDoDia: number | null,
  agora: Date,
): LinhaDeChegada {
  const ordenado = [...dias].sort((a, b) => b.dia.localeCompare(a.dia))
  const ultimo = ordenado[0] ?? null
  const hoje = diaDoBrasil(agora)

  if (!ultimo) {
    return {
      dia: null, ehHoje: false, sobra: null, unidades: 0, casaDoDia, pct: null,
      bateu: false, sobrouDepois: null, faltou: null,
      frase: 'nenhum dia com venda no período',
      manchete: { prefixo: 'nenhum dia com venda no período', destaque: null },
      lucroDaquiPraFrente: false,
      ressalva: null,
    }
  }

  const ehHoje = ultimo.dia === hoje
  const sobra = round2(ultimo.sobra)

  // ⛔ sem custo fixo declarado não existe linha de chegada — e a frase DIZ o que falta,
  // nunca mostra 0% nem inventa uma meta
  if (casaDoDia == null || casaDoDia <= 0) {
    const semPlano = `${ddmm(ultimo.dia)} sobrou ${brl(sobra)} — declare o plano dos custos fixos pra eu saber o tamanho da casa do dia`
    return {
      dia: ultimo.dia, ehHoje, sobra, unidades: ultimo.unidades, casaDoDia: null, pct: null,
      bateu: false, sobrouDepois: null, faltou: null,
      frase: semPlano,
      manchete: { prefixo: semPlano, destaque: null },
      lucroDaquiPraFrente: false,
      ressalva: ehHoje ? null : ressalvaDoDia(ultimo.dia, hoje),
    }
  }

  const bateu = sobra >= casaDoDia
  // ⭐ a manchete é a FONTE da `frase`: uma escrita só, duas formas (partida e corrida)
  const manchete = bateu
    ? {
        prefixo: `${ddmm(ultimo.dia)} pagou a casa do dia e ainda sobrou `,
        destaque: brl(sobra - casaDoDia),
      }
    : {
        prefixo: `${ddmm(ultimo.dia)} sobrou ${brl(sobra)} · ${((sobra / casaDoDia) * 100).toFixed(0)}% da casa do dia · faltou ${brl(casaDoDia - sobra)}`,
        destaque: null,
      }
  return {
    dia: ultimo.dia,
    ehHoje,
    sobra,
    unidades: ultimo.unidades,
    casaDoDia: round2(casaDoDia),
    pct: Math.min(1, sobra / casaDoDia),
    bateu,
    sobrouDepois: bateu ? round2(sobra - casaDoDia) : null,
    faltou: bateu ? null : round2(casaDoDia - sobra),
    frase: `${manchete.prefixo}${manchete.destaque ?? ''}`,
    manchete,
    lucroDaquiPraFrente: bateu,
    ressalva: ehHoje ? null : ressalvaDoDia(ultimo.dia, hoje),
  }
}

/**
 * ⚠️ A RESSALVA É OBRIGATÓRIA quando o dia mostrado não é hoje — e ela não é preciosismo:
 * medido em prod, o relatório do dia 06/10 entrou às **03:48 do dia 07/10**. Sem a frase, o
 * dono abre a tela à tarde e lê o dia de ontem como se fosse o de hoje.
 */
function ressalvaDoDia(dia: string, hoje: string): string {
  const d = Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 86400_000)
  if (d === 1) return 'é o último dia fechado — o relatório de hoje entra na madrugada'
  return `é o último dia com venda importada (há ${d} dias) — importe o relatório pra ver os dias seguintes`
}
