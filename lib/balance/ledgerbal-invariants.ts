// ⭐⭐ SÉRIE B — O SALDO DO BANCO CONFERE COM O NOSSO? (28/08/2026)
//
// NASCEU DO EPISÓDIO DOS R$ 2.444,62: o SISTEMA descartou em silêncio uma linha válida do
// extrato (heurística de FITID), e o saldo ficou 2.444,62 diferente do banco.
// ⚠️ Registro anterior dizia "o arquivo do banco veio incompleto" — ERRADO: a linha estava
// no arquivo, e a perícia por horário provou (preview 15:09 descarta · fix 21:05 · confirm
// 21:20 do MESMO arquivo entra). O que importa aqui é o que a divergência revelou:
// **ela só apareceu porque o dono importou de novo.** Com cliente, viveria SEMANAS muda.
//
// ⚠️⚠️ A ARMADILHA QUE QUASE ME FEZ ESCREVER UM INVARIANTE INÚTIL:
// o `balance` da conta é ANCORADO no próprio LEDGERBAL (`recalcularSaldoConta` faz
// `ledgerBal + Σ(tx depois da âncora)`). Então "saldo na data do LEDGERBAL == LEDGERBAL"
// é **CIRCULAR — daria verde sempre**, inclusive hoje, com o buraco aberto. Um invariante
// que não pode falhar é pior que nenhum: dá selo verde de graça.
//
// ⭐ O QUE MORDE DE VERDADE: **dois LEDGERBAL consecutivos têm que ser reconciliados pelas
// transações do intervalo.** O banco declarou X no dia 25 e Y no dia 28 — a diferença
// Y − X TEM que ser explicada pelas linhas de 26 a 28. Isso é independente da âncora e
// pega linha faltando, duplicada ou com sinal trocado.
//
// PROVA no caso real: LEDGERBAL 25/08 = −9.434,99 · 28/08 = −1.267,03 → o intervalo tem
// que somar 8.167,96. Sem a linha de EMPRESTIMO (−2.444,62) somaria 10.612,58 → **B1
// VERMELHO na MESMA noite**, sem depender de ninguém reimportar.

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ±1 centavo: a mesma tolerância que o resto do módulo usa pra dinheiro. */
export const TOLERANCIA_CENTAVO = 0.01

/** Dias sem conferir com o banco antes de avisar (B3). */
export const DIAS_SEM_CONFERIR = 10

export interface CheckSaldo {
  invariante: 'B1' | 'B2' | 'B3'
  nivel: 'erro' | 'aviso'
  companyId: string | null
  bankAccountId: string
  contaNome: string
  detalhe: string
  /** quanto falta explicar, quando aplicável (pro e-mail dizer o número) */
  diferenca?: number
}

/** Uma declaração de saldo do banco (vem de um import de OFX). */
export interface AncoraDeclarada {
  data: Date
  valor: number
}

/** ⭐ O resultado da conferência DIA A DIA contra o PDF — quando existe, é ELA que decide. */
export interface ConferenciaDiariaResumo {
  conferivel: boolean
  diasConferidos: number
  diasQueFecham: number
  /** o primeiro dia que não fecha, se houver */
  primeiroQueNaoFecha: { data: string; diferenca: number } | null
  /** último dia coberto pela régua (YYYY-MM-DD) */
  ate: string | null
}

export interface LeituraConta {
  bankAccountId: string
  contaNome: string
  companyId: string | null
  /**
   * ⭐⭐ FONTE ÚNICA DO SELO (01/09/2026). Quando a conta tem âncora de abertura + régua do
   * PDF, o veredito vem DAQUI — a MESMA conferência que o import usa — e as checagens
   * contra LEDGERBAL são puladas.
   *
   * ⛔ POR QUE: o LEDGERBAL do Banrisul é o saldo DISPONÍVEL (desconta o bloqueado de 24h).
   * Com o saldo já derivado do ledger (−3.225,96, o contábil), o **B2 passou a acusar
   * "divergente em R$ 1.700,00" e a mandar "recalcule o saldo"** — alarme falso sobre um
   * saldo CERTO, e o juiz das 3h mandaria isso por e-mail toda noite. O card tinha caminho
   * PRÓPRIO pro mesmo número que já havia saído do gate do import: a mesma decisão em dois
   * lugares, um corrigido e o outro não — a doença que este projeto mais paga.
   */
  conferenciaDiaria?: ConferenciaDiariaResumo | null
  /** o bloqueio DATADO — informação ao lado do saldo, NUNCA divergência */
  bloqueio?: { valor: number; em: Date } | null
  /** LEDGERBALs declarados pelo banco, do mais antigo pro mais novo */
  ancoras: AncoraDeclarada[]
  /** soma com sinal das tx EFFECTED num intervalo (exclusivo→inclusivo) */
  somaNoIntervalo: (depoisDe: Date, ate: Date) => number
  /**
   * ⭐ O TERCEIRO DADO (29/08) — a soma das LINHAS DO PRÓPRIO ARQUIVO do banco no intervalo,
   * lida do blob guardado. `null` quando não há blob que cubra o período.
   *
   * ⚠️ POR QUE ELE EXISTE: sem ele, o B1 só sabia comparar "nós" contra "o LEDGERBAL", e
   * qualquer divergência virava culpa nossa. Com ele dá pra separar as duas causas — e no
   * Banrisul isso é decisivo, porque o **LEDGERBAL dele embute valor BLOQUEADO** (mania
   * documentada desde 15/08: só vem `<LEDGERBAL>`, sem `<AVAILBAL>`) e não fecha nem com
   * as linhas que o próprio banco listou.
   */
  somaDoArquivoNoIntervalo?: (depoisDe: Date, ate: Date) => number | null
  /** saldo gravado hoje na conta + a âncora vigente (pra B2) */
  balanceGravado: number
  ledgerBalVigente: number | null
  ledgerBalDataVigente: Date | null
  /** soma das tx EFFECTED depois da âncora vigente */
  somaPosAncora: number
}

const dia = (d: Date) => d.toISOString().slice(0, 10)
const br = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDia = (d: Date) => dia(d).split('-').reverse().join('/')

/**
 * PURA — a decisão. Lista vazia = conta conferindo com o banco.
 * `hoje` é parâmetro pra o teste ser determinístico (o relógio nunca decide sozinho).
 */
export function avaliarConta(l: LeituraConta, hoje: Date): CheckSaldo[] {
  const out: CheckSaldo[] = []
  const base = { companyId: l.companyId, bankAccountId: l.bankAccountId, contaNome: l.contaNome }

  // ⭐⭐ CONFERÊNCIA DIÁRIA MANDA (01/09/2026). Comparar contra o LEDGERBAL numa conta cujo
  // saldo declarado é o DISPONÍVEL só produz o fantasma do bloqueio. Aqui o veredito é dia
  // a dia contra o contábil do PDF — e um dia que não fecha diz QUAL dia e QUANTO, que é o
  // que leva a uma ação, em vez de um total sem endereço.
  if (l.conferenciaDiaria?.conferivel) {
    const c = l.conferenciaDiaria
    if (c.primeiroQueNaoFecha) {
      out.push({
        ...base, invariante: 'B1', nivel: 'erro', diferenca: c.primeiroQueNaoFecha.diferenca,
        detalhe:
          `o dia ${fmtDia(new Date(c.primeiroQueNaoFecha.data + 'T12:00:00Z'))} não fecha com o extrato do banco ` +
          `(${br(Math.abs(c.primeiroQueNaoFecha.diferenca))} de diferença). ${c.diasQueFecham} de ${c.diasConferidos} dias conferidos batem. ` +
          `Abra a conta pra ver os lançamentos desse dia nos dois lados.`,
      })
    }
    // ⚠️ B3 segue valendo, mas contra a COBERTURA da régua (não contra o LEDGERBAL)
    if (c.ate) {
      const dias = Math.floor((hoje.getTime() - new Date(c.ate + 'T12:00:00Z').getTime()) / 86400000)
      if (dias > DIAS_SEM_CONFERIR) {
        out.push({
          ...base, invariante: 'B3', nivel: 'aviso',
          detalhe: `sem conferência com o banco há ${dias} dias (a régua do extrato vai até ${c.ate}). Suba o extrato novo pra fechar.`,
        })
      }
    }
    return out
  }

  // ── B1 (erro) — dois LEDGERBAL consecutivos reconciliam pelas tx do intervalo?
  const ancoras = [...l.ancoras].sort((a, b) => a.data.getTime() - b.data.getTime())
  for (let i = 1; i < ancoras.length; i++) {
    const de = ancoras[i - 1]
    const ate = ancoras[i]
    if (dia(de.data) === dia(ate.data)) continue // mesmo dia: o banco re-declara, não é intervalo
    const esperado = round2(ate.valor - de.valor)
    const real = round2(l.somaNoIntervalo(de.data, ate.data))
    const dif = round2(real - esperado)
    if (Math.abs(dif) > TOLERANCIA_CENTAVO) {
      // ⭐ TRÊS CASOS, não dois (29/08) — o arquivo do banco desempata a culpa:
      //   sistema == arquivo == LEDGERBAL  → verde
      //   sistema == arquivo ≠  LEDGERBAL  → AVISO: o BANCO se contradiz (não é nosso)
      //   sistema ≠  arquivo               → ERRO: falta/sobra linha AQUI (é nosso)
      const doArquivo = l.somaDoArquivoNoIntervalo?.(de.data, ate.data) ?? null
      const batemosComOArquivo = doArquivo != null && Math.abs(round2(real - doArquivo)) <= TOLERANCIA_CENTAVO
      if (batemosComOArquivo) {
        out.push({
          ...base, invariante: 'B1', nivel: 'aviso', diferenca: dif,
          detalhe:
            `entre ${fmtDia(de.data)} e ${fmtDia(ate.data)} o saldo declarado pelo banco (${br(esperado)}) ` +
            `não fecha com as LINHAS QUE O PRÓPRIO BANCO listou (${br(doArquivo!)}) — e o nosso sistema ` +
            `bate com as linhas ao centavo. **A inconsistência é do banco, não nossa** ` +
            `(no Banrisul o saldo declarado embute valor BLOQUEADO, que ele não manda no arquivo). ` +
            `Nada a corrigir aqui; a verdade das transações é o extrato, não o saldo declarado.`,
        })
        continue
      }
      out.push({
        ...base, invariante: 'B1', nivel: 'erro', diferenca: dif,
        // ⚠️ O SINAL DIZ DE QUE LADO SOBRA, NÃO QUAL É A CAUSA: cada direção tem DUAS
        // explicações possíveis, e afirmar uma só mandaria o dono procurar no lugar errado.
        //   sistema soma MENOS → falta uma ENTRADA  ou  há uma SAÍDA duplicada
        //   sistema soma MAIS  → falta uma SAÍDA    ou  há uma ENTRADA duplicada
        detalhe:
          `entre ${fmtDia(de.data)} e ${fmtDia(ate.data)} o banco variou ${br(esperado)}, ` +
          `mas as transações do período somam ${br(real)} — sobram ${br(Math.abs(dif))} ` +
          `${dif > 0 ? 'no sistema: pode faltar uma SAÍDA do banco, ou ter uma ENTRADA duplicada' : 'no banco: pode faltar uma ENTRADA do banco, ou ter uma SAÍDA duplicada'}. ` +
          `Re-exporte o extrato cobrindo ${fmtDia(de.data)}–${fmtDia(ate.data)} e importe de novo — ` +
          `linha que ainda não tinha liquidado costuma vir no re-export e fechar sozinha.`,
      })
    }
  }

  // ── B2 (erro) — o saldo GRAVADO bate com âncora + movimento posterior?
  // ⚠️ Isto NÃO é circular: compara o CACHE (`balance`) com a reconstrução. Pega cache
  // velho/driftado, que é outra falha — não a de linha faltando (essa é o B1).
  if (l.ledgerBalVigente != null) {
    const reconstruido = round2(l.ledgerBalVigente + l.somaPosAncora)
    const dif = round2(l.balanceGravado - reconstruido)
    if (Math.abs(dif) > TOLERANCIA_CENTAVO) {
      out.push({
        ...base, invariante: 'B2', nivel: 'erro', diferenca: dif,
        detalhe:
          `saldo gravado ${br(l.balanceGravado)} ≠ âncora ${br(l.ledgerBalVigente)} + movimento posterior ` +
          `${br(l.somaPosAncora)} = ${br(reconstruido)} (${br(dif)} de diferença). Recalcule o saldo da conta.`,
      })
    }
  }

  // ── B3 (aviso) — faz quanto tempo que ninguém confere esta conta com o banco?
  // ⚠️ AVISO, não erro: conta parada (ou manual, tipo cofre) não é defeito. O que é ruim
  // é ninguém SABER que ela está sem conferência.
  if (l.ledgerBalDataVigente) {
    const dias = Math.floor((hoje.getTime() - l.ledgerBalDataVigente.getTime()) / 86400000)
    if (dias > DIAS_SEM_CONFERIR) {
      out.push({
        ...base, invariante: 'B3', nivel: 'aviso',
        detalhe: `sem conferência com o banco há ${dias} dias (último saldo declarado em ${fmtDia(l.ledgerBalDataVigente)}). Importe o extrato pra fechar.`,
      })
    }
  } else if (l.ancoras.length === 0) {
    out.push({
      ...base, invariante: 'B3', nivel: 'aviso',
      detalhe: 'nunca foi conferida com o banco (nenhum extrato com saldo declarado). O saldo aqui é o que foi digitado, não o que o banco diz.',
    })
  }

  return out
}

/** Estado por conta pra a TELA — "conferido ✓" ou "divergente desde DD/MM". */
export interface EstadoConferencia {
  bankAccountId: string
  conferido: boolean
  /** data do último saldo declarado pelo banco */
  em: Date | null
  diferenca: number | null
  /** frase pronta, em pt-BR, pro dono ler sem interpretar número solto */
  rotulo: string
  /** ⭐ o bloqueio, DATADO — informação ao lado do saldo, nunca divergência */
  bloqueio?: { valor: number; em: Date } | null
  /** ⭐ quantos dias a régua cobre e quantos fecham, pra tela poder detalhar */
  dias?: { conferidos: number; fecham: number } | null
}

export function estadoDaConferencia(l: LeituraConta, hoje: Date): EstadoConferencia {
  const checks = avaliarConta(l, hoje)
  const erro = checks.find((c) => c.nivel === 'erro')
  const bloqueio = l.bloqueio ?? null

  // ⭐⭐ MESMA FONTE DO IMPORT (01/09/2026): com a conferência diária disponível, o selo do
  // card sai DELA. Antes o card tinha caminho próprio e comparava o contábil (−3.225,96)
  // contra o LEDGERBAL (−4.925,96), anunciando "divergente em R$ 1.700,00" — que é o
  // BLOQUEIO, não divergência. O bloqueio passa a aparecer AO LADO, como informação.
  const c = l.conferenciaDiaria
  if (c?.conferivel) {
    const ate = c.ate ? new Date(c.ate + 'T12:00:00Z') : null
    const dias = { conferidos: c.diasConferidos, fecham: c.diasQueFecham }
    if (c.primeiroQueNaoFecha) {
      const d = new Date(c.primeiroQueNaoFecha.data + 'T12:00:00Z')
      return {
        bankAccountId: l.bankAccountId, em: ate, conferido: false, bloqueio, dias,
        diferenca: c.primeiroQueNaoFecha.diferenca,
        rotulo: `${fmtDia(d)} não fecha (${br(Math.abs(c.primeiroQueNaoFecha.diferenca))}) — ${c.diasQueFecham} de ${c.diasConferidos} dias conferidos`,
      }
    }
    return {
      bankAccountId: l.bankAccountId, em: ate, conferido: true, bloqueio, dias, diferenca: 0,
      rotulo: `conferido com o banco em ${ate ? fmtDia(ate) : '—'}`,
    }
  }

  const base = { bankAccountId: l.bankAccountId, em: l.ledgerBalDataVigente, bloqueio, dias: null }
  if (erro) {
    return { ...base, conferido: false, diferenca: erro.diferenca ?? null, rotulo: `divergente em ${br(Math.abs(erro.diferenca ?? 0))}${l.ledgerBalDataVigente ? ` desde ${fmtDia(l.ledgerBalDataVigente)}` : ''}` }
  }
  if (!l.ledgerBalDataVigente) {
    return { ...base, conferido: false, diferenca: null, rotulo: 'nunca conferida com o banco' }
  }
  return { ...base, conferido: true, diferenca: 0, rotulo: `conferido com o banco em ${fmtDia(l.ledgerBalDataVigente)}` }
}

/**
 * ⭐ DIAGNÓSTICO GUIADO (item 3) — quando o gate do import não bate, dizer ONDE começou o
 * descolamento em vez de devolver um enigma. Caminha as âncoras e aponta o PRIMEIRO
 * intervalo que não fecha.
 */
export function ondeDescolou(l: LeituraConta): { de: Date; ate: Date; diferenca: number; instrucao: string } | null {
  const ancoras = [...l.ancoras].sort((a, b) => a.data.getTime() - b.data.getTime())
  for (let i = 1; i < ancoras.length; i++) {
    const de = ancoras[i - 1]
    const ate = ancoras[i]
    if (dia(de.data) === dia(ate.data)) continue
    const dif = round2(round2(l.somaNoIntervalo(de.data, ate.data)) - round2(ate.valor - de.valor))
    if (Math.abs(dif) > TOLERANCIA_CENTAVO) {
      return {
        de: de.data, ate: ate.data, diferenca: dif,
        instrucao:
          `O descolamento começou entre ${fmtDia(de.data)} e ${fmtDia(ate.data)} (${br(Math.abs(dif))}). ` +
          `Provavelmente falta transação nesse período — re-exporte o extrato do banco cobrindo essas datas e importe de novo.`,
      }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ O DIAGNÓSTICO PAROU DE MANDAR CAÇAR AGOSTO POR DRIFT DE ANTEONTEM (30/09/2026)
//
// **A queixa do dono:** o import da Stone acusou *"saldo previsto 2.199,53 × extrato 87,53
// · causa não identificada"* **e** *"o descolamento começou entre 13/08 e 17/08 (122,37)"*.
// Ele foi caçar agosto. **O problema tinha nascido dois dias antes**, e não no extrato: o
// `balance` gravado estava 2.112,00 acima da régua por causa de uma venda em dinheiro
// lançada à mão com data retroativa.
//
// ⛔ O `ondeDescolou` responde UMA pergunta — *"qual o primeiro intervalo de âncoras que
// não fecha?"* — e a resposta dele é, por construção, o achado MAIS ANTIGO que existir.
// Num histórico de seis semanas ele vai sempre apontar pro passado, mesmo quando o
// problema é de hoje. **Não é um bug de cálculo: é a pergunta errada em cima da tela
// errada.**
//
// ⭐ AS TRÊS COISAS SÃO DIFERENTES, e agora saem separadas:
//
//   1. **DRIFT DO CACHE** (o alarme NOVO, acionável hoje): `balance` ≠ âncora + posteriores.
//      É o B2, que o juiz noturno já sabia checar — e que o import nunca olhou.
//   2. **FRONTEIRA DE DATA** (explicado, não é alarme): dois intervalos vizinhos com
//      diferenças que **se cancelam**. O banco lançou num dia e o extrato seguinte datou
//      no outro; o dinheiro está lá. Na Stone são SEIS pares assim — e cada um deles
//      apareceria como "descolamento" numa leitura ingênua.
//   3. **INTERVALO ANTIGO QUE NÃO CANCELA** (aviso, não urgência): esse é real, mas é
//      HISTÓRICO. O 122,37 de 13-17/08 está registrado desde 29/08 como aviso explicado.
//      Ele entra na mensagem **dizendo que é anterior e que NÃO explica a diferença de
//      hoje** — senão o dono some atrás dele de novo.
//
// ⚠️ *Alarme que aponta pro lugar errado é pior que alarme nenhum*: ele consome o dia de
// quem foi atrás e ensina a desconfiar do próximo aviso.
// ═══════════════════════════════════════════════════════════════════════════════

export interface DiagnosticoDoDescolamento {
  /** ⭐ o alarme NOVO: o cache driftou da régua. É o que se resolve HOJE. */
  driftDoCache: { gravado: number; pelaRegua: number; diferenca: number; instrucao: string } | null
  /** aviso HISTÓRICO: 1º intervalo que não fecha E não se cancela com o vizinho */
  intervaloAntigo: { de: Date; ate: Date; diferenca: number; instrucao: string } | null
  /** quantos pares vizinhos se cancelaram (fronteira de data — explicado, não alarme) */
  fronteirasDeData: number
  /** a frase pra tela, já na ordem de quem age: o de hoje primeiro */
  instrucao: string
}

/** Duas diferenças "se cancelam" quando somam ~zero — assinatura de fronteira de data. */
function seCancelam(a: number, b: number): boolean {
  return Math.abs(round2(a + b)) <= TOLERANCIA_CENTAVO
}

export function diagnosticarDescolamento(l: LeituraConta): DiagnosticoDoDescolamento {
  // ── 1. O CACHE (o alarme de hoje). Mesma conta do B2 — não uma segunda régua.
  let driftDoCache: DiagnosticoDoDescolamento['driftDoCache'] = null
  if (l.ledgerBalVigente != null) {
    const pelaRegua = round2(l.ledgerBalVigente + l.somaPosAncora)
    const dif = round2(l.balanceGravado - pelaRegua)
    if (Math.abs(dif) > TOLERANCIA_CENTAVO) {
      driftDoCache = {
        gravado: l.balanceGravado,
        pelaRegua,
        diferenca: dif,
        instrucao:
          `O saldo GRAVADO da conta (${br(l.balanceGravado)}) está ${br(Math.abs(dif))} ` +
          `${dif > 0 ? 'ACIMA' : 'ABAIXO'} do que a régua dá (${br(pelaRegua)} = o saldo que o banco ` +
          `declarou${l.ledgerBalDataVigente ? ` em ${fmtDia(l.ledgerBalDataVigente)}` : ''} mais os lançamentos ` +
          `posteriores). ⚠️ Isto NÃO é falta de transação no extrato — é o saldo em cache. ` +
          `A causa típica é lançamento manual com data ANTERIOR ao último extrato: o dinheiro já ` +
          `estava dentro do saldo declarado e foi somado de novo. Recalcular o saldo da conta resolve.`,
      }
    }
  }

  // ── 2/3. OS INTERVALOS: separa fronteira de data (cancela) do que é real.
  const ancoras = [...l.ancoras].sort((a, b) => a.data.getTime() - b.data.getTime())
  const difs: Array<{ de: Date; ate: Date; dif: number }> = []
  for (let i = 1; i < ancoras.length; i++) {
    const de = ancoras[i - 1]
    const ate = ancoras[i]
    if (dia(de.data) === dia(ate.data)) continue
    const dif = round2(round2(l.somaNoIntervalo(de.data, ate.data)) - round2(ate.valor - de.valor))
    if (Math.abs(dif) > TOLERANCIA_CENTAVO) difs.push({ de: de.data, ate: ate.data, dif })
  }

  /**
   * ⚠️ O cancelamento é olhado nos VIZINHOS IMEDIATOS da lista de diferenças, não em
   * qualquer par do histórico: duas diferenças iguais e opostas a três semanas de distância
   * não são a mesma linha mudando de dia — são duas coisas distintas que coincidiram.
   * Emparelhar à distância transformaria achado real em "explicado" por acaso, que é o
   * modo de falha mais caro que um diagnóstico pode ter.
   */
  const explicado = new Set<number>()
  let fronteirasDeData = 0
  for (let i = 0; i + 1 < difs.length; i++) {
    if (explicado.has(i)) continue
    if (seCancelam(difs[i]!.dif, difs[i + 1]!.dif)) {
      explicado.add(i)
      explicado.add(i + 1)
      fronteirasDeData++
    }
  }

  const real = difs.find((_, i) => !explicado.has(i)) ?? null
  const intervaloAntigo = real
    ? {
        de: real.de,
        ate: real.ate,
        diferenca: real.dif,
        instrucao:
          `Há também uma diferença ANTIGA entre ${fmtDia(real.de)} e ${fmtDia(real.ate)} ` +
          `(${br(Math.abs(real.dif))}), que não se cancela com os dias vizinhos. ` +
          `⚠️ Ela é anterior e **não explica a diferença de hoje** — se você já a conhece, ` +
          `ignore; se não, o caminho é re-exportar o extrato cobrindo ${fmtDia(real.de)}–${fmtDia(real.ate)}.`,
      }
    : null

  // ⭐ A ORDEM DA FRASE É A ORDEM DE QUEM AGE: o de hoje primeiro, o histórico como nota.
  const partes: string[] = []
  if (driftDoCache) partes.push(driftDoCache.instrucao)
  if (fronteirasDeData > 0) {
    partes.push(
      `${fronteirasDeData} diferença(s) entre extratos se CANCELAM com o dia vizinho — ` +
        `é o banco lançando num dia e datando no outro. O dinheiro está no sistema; nada a corrigir.`,
    )
  }
  if (intervaloAntigo) partes.push(intervaloAntigo.instrucao)
  if (partes.length === 0) {
    partes.push(
      'O saldo gravado bate com a régua e todos os intervalos entre extratos fecham — ' +
        'a diferença não vem do histórico desta conta.',
    )
  }

  return { driftDoCache, intervaloAntigo, fronteirasDeData, instrucao: partes.join(' ') }
}
