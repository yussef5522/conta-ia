// ⭐⭐⭐ A QUARENTENA — toda fatura fica guardada com o texto extraído (16/09/2026).
//
// **A régua do dono:** *"fatura recusada fica guardada com o texto extraído pra eu/você
// diagnosticar sem pedir o PDF de novo"* + *"PASSA A GUARDAR o arquivo de cada import — o
// golden de amanhã"*.
//
// ⛔⛔ **MEDIDO HOJE:** o import de fatura **não guardava nada**. A fatura que a conferência
// recusou **se perdeu**, e diagnosticá-la exigia pedir o PDF de volta ao dono. É o que o
// `rawOfxBlob` resolveu pro extrato em 13/08 — e que nunca chegou aqui.
//
// ⭐ **GUARDA TODA TENTATIVA, não só a recusada.** A que deu certo é o **golden de amanhã**:
// foi por não ter os PDFs antigos que o congelador nasceu com 9 fixtures em vez de com o
// histórico inteiro.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface EntradaDaQuarentena {
  companyId?: string | null
  profileId?: string | null
  cardId: string
  banco: string
  desfecho: 'OK' | 'RECUSADA'
  motivo?: string | null
  declarado?: number | null
  calculado?: number | null
  texto: string
  linhas?: number
  criadoPorId?: string | null
}

/**
 * ⭐⭐⭐ OS NÚMEROS DA QUARENTENA — UM RESOLVEDOR, OS DOIS DESFECHOS (20/10/2026).
 *
 * ⛔⛔ **O BURACO:** o caminho PJ gravava `declarado: null, calculado: null, linhas: 0` na
 * recusa e `calculado: null` no OK — ou seja **`recusadasParaDiagnosticar` devolvia as três
 * colunas vazias**, e medir a reincidência por SQL ficava cego: dava pra ver QUE recusou,
 * nunca POR QUANTO. Era o achado 4 da caça de 20/10.
 *
 * ⭐⭐ **A RÉGUA — O PAR VEM SEMPRE DA MESMA CHECAGEM, e é isso que o torna comparável.**
 * Cada banco nomeia os checks dele à sua maneira (`Σ compras+encargos = Total cartão` no
 * Sicredi, `V1 Σ Brasil` no Banrisul), então **re-derivar os números do TEXTO da mensagem
 * seria adivinhação**. O `FaturaCheck` já carrega o par pronto: `expected` é o que o
 * documento DECLARA, `got` é o que a nossa soma PRODUZIU.
 *
 * ⛔ **E misturar as fontes é o erro que esta função existe pra impedir:** pegar o
 * `declarado` do `totalDeclarado` e o `calculado` do `got` de outra checagem faria uma linha
 * **OK** aparecer com 99 reais de divergência (no Sicredi o `Total cartão` e o `Total desta
 * Fatura` diferem por construção). *Par de números de fontes diferentes não é par — é dois
 * números soltos com cara de conferência.*
 *
 * A escolha da checagem, nesta ordem e cada caso com o seu motivo:
 *   1. **alguma FALHOU** → a de maior |diff|. É o número que o dono está olhando na tela.
 *   2. **nenhuma falhou e há total declarado** → a cuja `expected` mais se aproxima dele,
 *      pra o `declarado` da quarentena concordar com o que o resto da casa chama de
 *      declarado (o congelador, a tela).
 *   3. **nenhuma falhou e não há total** → a de maior |expected| (numa fatura, o maior
 *      número declarado é o total).
 *
 * ⚠️ Sem checagem NENHUMA (leitura por Vision, que não valida) o `declarado` cai no total
 * extraído e o `calculado` fica **`null`** — nunca zero: zero afirmaria que a nossa soma deu
 * nada, e ausência de medição não é medição de ausência.
 */
export function numerosDaQuarentena(e: {
  /** `FaturaCheck[]`, mas chega como `unknown` (vem do `details` do erro) */
  checks?: unknown
  linhas?: number | null
  totalDeclarado?: number | null
}): { declarado: number | null; calculado: number | null; linhas: number } {
  const checks = lerChecks(e.checks)
  const falhos = checks.filter((c) => !c.pass)

  let escolhido: ChecagemLida | null = null
  if (falhos.length > 0) {
    escolhido = maiorPor(falhos, (c) => Math.abs(c.diff))
  } else if (checks.length > 0) {
    escolhido = e.totalDeclarado != null
      ? maiorPor(checks, (c) => -Math.abs(c.expected - e.totalDeclarado!))
      : maiorPor(checks, (c) => Math.abs(c.expected))
  }

  return {
    declarado: escolhido ? escolhido.expected : (e.totalDeclarado ?? null),
    calculado: escolhido ? escolhido.got : null,
    linhas: e.linhas ?? 0,
  }
}

interface ChecagemLida { expected: number; got: number; diff: number; pass: boolean }

/**
 * ⚠️ Lê com desconfiança: o `details` do erro é `unknown` e um dia pode chegar outra coisa.
 * Forma inesperada → lista vazia (a quarentena grava sem os números), **nunca throw**: este
 * caminho roda dentro de uma gravação fail-soft de diagnóstico.
 */
function lerChecks(cru: unknown): ChecagemLida[] {
  if (!Array.isArray(cru)) return []
  const out: ChecagemLida[] = []
  for (const c of cru) {
    if (c == null || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    if (typeof o.expected !== 'number' || typeof o.got !== 'number') continue
    if (!Number.isFinite(o.expected) || !Number.isFinite(o.got)) continue
    const diff = typeof o.diff === 'number' && Number.isFinite(o.diff) ? o.diff : o.got - o.expected
    out.push({ expected: o.expected, got: o.got, diff, pass: o.pass === true })
  }
  return out
}

function maiorPor<T>(xs: T[], peso: (x: T) => number): T {
  return xs.reduce((a, b) => (peso(b) > peso(a) ? b : a))
}

/**
 * ⚠️ **FAIL-SOFT POR CONSTRUÇÃO.** Guardar é diagnóstico, não o trabalho: se a gravação
 * falhar, o import **segue**. Derrubar um import legítimo porque a quarentena não gravou
 * seria trocar um problema de diagnóstico por um de operação.
 */
export async function guardarNaQuarentena(
  e: EntradaDaQuarentena, db: PrismaClient = defaultPrisma,
): Promise<string | null> {
  try {
    const r = await db.faturaQuarentena.create({
      data: {
        companyId: e.companyId ?? null, profileId: e.profileId ?? null,
        cardId: e.cardId, banco: e.banco, desfecho: e.desfecho,
        motivo: e.motivo ?? null, declarado: e.declarado ?? null, calculado: e.calculado ?? null,
        texto: e.texto, linhas: e.linhas ?? 0, criadoPorId: e.criadoPorId ?? null,
      },
      select: { id: true },
    })
    return r.id
  } catch {
    return null
  }
}

/**
 * ⭐ AS RECUSADAS ESPERANDO DIAGNÓSTICO — é o que eu (ou o dono) abre pra investigar sem
 * pedir o PDF de novo.
 */
export async function recusadasParaDiagnosticar(
  o: { companyId?: string; profileId?: string }, db: PrismaClient = defaultPrisma,
) {
  return db.faturaQuarentena.findMany({
    where: {
      desfecho: 'RECUSADA', textoPurgadoEm: null,
      ...(o.companyId ? { companyId: o.companyId } : {}),
      ...(o.profileId ? { profileId: o.profileId } : {}),
    },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, banco: true, motivo: true, declarado: true, calculado: true, linhas: true, criadoEm: true },
    take: 50,
  })
}

/**
 * ⚠️ O EXPURGO (LGPD) — o texto tem nome de estabelecimento e 4 dígitos de cartão. **Mesma
 * régua do `rawOfxBlob`: 12 meses**, e a metadata FICA (auditoria sem PII).
 */
export async function expurgarTextosAntigos(
  agora: Date, db: PrismaClient = defaultPrisma,
): Promise<number> {
  const limite = new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000)
  const r = await db.faturaQuarentena.updateMany({
    where: { criadoEm: { lt: limite }, textoPurgadoEm: null },
    data: { texto: '', textoPurgadoEm: agora },
  })
  return r.count
}
