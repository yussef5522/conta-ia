// ⚠️ EXPORT DE MESMO DIA NÃO FECHA O PRÓPRIO DIA (29/08/2026) — mania nº 6 do catálogo.
//
// O extrato baixado HOJE termina hoje, e o dia ainda está correndo: lançamentos que vão
// liquidar mais tarde não estão lá, e o LEDGERBAL declarado não os inclui. Isso já custou
// caro duas vezes:
//   · 28/08 15:09 — o dono baixou o arquivo com o dia pela metade e o gate travou;
//   · na série B, eu escolhia o arquivo de referência com `ate >= fim`, pegando justamente
//     o export do último dia do intervalo — a soma vinha curta e o invariante culpava a
//     gente por um dia que o banco ainda não tinha fechado.
//
// ⭐ O QUE ESTA FUNÇÃO É, E O QUE NÃO É: ela produz **AVISO DE TELA**, nunca decisão. Não
// descarta linha, não classifica, não move saldo. Por isso — e SÓ por isso — ela pode
// olhar o relógio: o princípio do módulo é *"o relógio serve pra exibir 'hoje' na TELA,
// nunca pra decidir"*. Se um dia isto virar critério de descarte, tem que sair daqui.

const dia = (d: Date) => d.toISOString().slice(0, 10)
const fmt = (d: Date) => {
  const [a, m, g] = dia(d).split('-')
  return `${g}/${m}/${a}`
}

export interface AvisoExportMesmoDia {
  /** true quando o extrato termina no dia em que está sendo importado */
  mesmoDia: boolean
  /** quantas linhas do arquivo caem no dia ainda aberto */
  linhasDoDiaAberto: number
  /** frase pronta pro banner (vazia quando não se aplica) */
  aviso: string
}

/**
 * @param ancora  fim do extrato = max(DTASOF, DTEND) — o que o BANCO declarou
 * @param datasDasLinhas  datas das linhas do arquivo (pra contar as do dia aberto)
 * @param agora  só pra saber que dia é hoje na TELA
 */
export function avisoExportMesmoDia(
  ancora: Date | null | undefined,
  datasDasLinhas: Date[],
  agora: Date,
): AvisoExportMesmoDia {
  const vazio = { mesmoDia: false, linhasDoDiaAberto: 0, aviso: '' }
  if (!ancora) return vazio
  if (dia(ancora) !== dia(agora)) return vazio

  const linhasDoDiaAberto = datasDasLinhas.filter((d) => dia(d) === dia(ancora)).length
  return {
    mesmoDia: true,
    linhasDoDiaAberto,
    aviso:
      `Este extrato foi emitido HOJE (${fmt(ancora)}) e o dia ainda não fechou. ` +
      (linhasDoDiaAberto > 0
        ? `${linhasDoDiaAberto} lançamento${linhasDoDiaAberto > 1 ? 's são' : ' é'} de hoje. `
        : '') +
      `Pode faltar movimento que o banco ainda vai lançar, e o saldo declarado no arquivo ` +
      `pode não incluir tudo — se o saldo não fechar, provavelmente é isso. ` +
      `Dá pra importar assim mesmo (nada se perde: o que faltar entra no próximo extrato, ` +
      `sem duplicar), mas baixar de novo amanhã fecha o dia.`,
  }
}
