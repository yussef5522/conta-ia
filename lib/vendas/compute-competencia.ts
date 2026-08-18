// VENDAS FASE 1 (17/08/2026) — computeCompetencia: UMA função, usada por TUDO
// (recompute de VendaDiaria, juiz, tela). Segunda cópia = bug (REGRA 4). Dado o
// DIA EM QUE O DINHEIRO ENTROU, devolve o intervalo de competência da VENDA
// {inicio, fim} conforme o perfil da conta/meio vigente na data.
//
// Duas famílias de regra (ver perfil-recebimento.ts):
//   recebeSabDom=false → atraso em dias ÚTEIS; o fim de semana/feriado acumula no
//     1º dia útil → BLOCO (seg D+1 = {sex..dom}; ter após feriado seg = {sex..seg}).
//   recebeSabDom=true  → atraso em dias CORRIDOS; cada dia mapeia 1 dia, SEM bloco
//     (cofre: sáb=sex, dom=sáb, seg=dom; Stone D+0: dia=dia).
//
// N lançamentos do MESMO (conta,meio) no MESMO dia cobrindo um bloco de N dias:
//   atribui em ordem cronológica (1º=dia mais antigo do bloco), cada um ~ESTIMADO.
//   Se o nº de lançamentos ≠ nº de dias do bloco, NÃO divide (devolve o bloco).
//
// ⭐ FOCO AGOSTO: dataEntrada < moduleInicio (12/08) → {fora:true} (não computa).

import { voltarDiasUteis, voltarDiasCorridos, proximoDia, isDiaUtil, diasNoIntervalo } from './dias-uteis'
import { resolveRegraRecebimento, type Meio, type RegraRecebimento } from './perfil-recebimento'

export interface Competencia {
  fora: boolean // true = antes do início do módulo (12/08) → não computa
  inicio: Date | null
  fim: Date | null
  isBloco: boolean // fim > inicio (fim de semana/feriado agrupado)
  isSplit: boolean // atribuído por ordem (N lançamentos no mesmo dia)
  confirmado: boolean // regra confirmada pelo dono (false = default assumido → flag)
  estimado: boolean // extrato-inferido é SEMPRE ~ (vs confirmação por adquirente, fase 2)
  origemHint: string | null
}

export interface ComputeOpts {
  moduleInicio?: Date // início do módulo (Cacula: 12/08). Antes disso → fora.
  ordinal?: number // 0-based: qual lançamento do dia é este (pra split)
  totalNoDia?: number // quantos lançamentos do mesmo (conta,meio) nesse dia
}

const meiaNoite = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

const FORA: Competencia = {
  fora: true, inicio: null, fim: null, isBloco: false, isSplit: false,
  confirmado: false, estimado: false, origemHint: null,
}

export function computeCompetencia(
  dataEntrada: Date,
  bankAccountId: string,
  meio: Meio,
  regras: ReadonlyArray<RegraRecebimento>,
  feriados: Set<string>,
  opts: ComputeOpts = {},
): Competencia {
  const entrada = meiaNoite(dataEntrada)

  // FOCO AGOSTO — antes do início do módulo não computa.
  if (opts.moduleInicio && entrada.getTime() < meiaNoite(opts.moduleInicio).getTime()) {
    return FORA
  }

  const regra = resolveRegraRecebimento(regras, bankAccountId, meio, entrada)

  // Intervalo base
  let inicio: Date
  let fim: Date
  if (regra.recebeSabDom) {
    // Dias CORRIDOS, sem bloco. cofre D+1: sáb→sex. Stone D+0: dia→dia.
    inicio = voltarDiasCorridos(entrada, regra.diasUteisAtraso)
    fim = inicio
  } else if (regra.diasUteisAtraso === 0) {
    // D+0 sem fim de semana (borda incomum) — mesmo dia.
    inicio = entrada
    fim = entrada
  } else {
    // Dias ÚTEIS + BLOCO: volta N dias úteis; estende o fim sobre os dias
    // não-úteis seguintes (até o próximo dia útil, que é a própria entrada).
    inicio = voltarDiasUteis(entrada, regra.diasUteisAtraso, feriados)
    fim = inicio
    while (!isDiaUtil(proximoDia(fim), feriados)) fim = proximoDia(fim)
  }

  let isBloco = fim.getTime() > inicio.getTime()
  let isSplit = false

  // N lançamentos no mesmo dia cobrindo o bloco → atribui por ordem.
  if (opts.totalNoDia && opts.totalNoDia > 1 && opts.ordinal != null) {
    const dias = diasNoIntervalo(inicio, fim)
    if (opts.totalNoDia === dias.length) {
      const dia = dias[opts.ordinal]
      inicio = dia
      fim = dia
      isBloco = false
      isSplit = true
    }
    // nº de lançamentos ≠ nº de dias → não divide (devolve o bloco, ~estimado).
  }

  return {
    fora: false,
    inicio,
    fim,
    isBloco,
    isSplit,
    confirmado: regra.confirmado,
    estimado: true, // extrato-inferido sempre ~
    origemHint: regra.origemHint ?? null,
  }
}
