// ⭐⭐⭐ O SELETOR DE FORNECEDOR VÊ OS DOIS MUNDOS (04/09/2026).
//
// ⛔ O BUG, medido em prod: o seletor lia **só `stock_supplier`** — a tabela isolada do
// módulo, que só é populada quando uma nota é CONFERIDA. Resultado: **27 fornecedores no
// seletor contra 85 na tela de Fornecedores — 63 invisíveis.** O dono foi cadastrar uma nota
// manual da RM2, não achou (ela nunca tinha passado por conferência), e **criou uma segunda
// RM2**. A duplicata não foi descuido: foi a tela escondendo o que existia.
//
// ⚠️ E A BUSCA ERA O SEGUNDO PROBLEMA, não o primeiro: mesmo com busca perfeita, a original
// não estava na lista. Consertar só a busca teria deixado o bug vivo com cara de resolvido.
//
// ⭐ FRONTEIRA RESPEITADA: aqui se **LÊ** `Supplier` (o financeiro) — leitura de outro módulo
// já é permitida (a ponte lê pra sugerir vínculo). O que este arquivo **nunca** faz é
// ESCREVER lá. Quando o dono escolhe um fornecedor que só existe no financeiro, o que nasce
// é o `stock_supplier` correspondente — no lado de cá.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'

type Db = PrismaClient | Prisma.TransactionClient

export type OrigemFornecedor = 'ESTOQUE' | 'FINANCEIRO' | 'AMBOS'

export interface FornecedorUnificado {
  /** id do `stock_supplier` quando já existe; senão null (nasce ao escolher) */
  stockId: string | null
  /** id do `Supplier` do financeiro quando existe */
  financeiroId: string | null
  razaoSocial: string
  cnpj: string | null
  origem: OrigemFornecedor
}

export const soDigitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

/**
 * ⛔⛔ QUANDO DOIS REGISTROS SÃO A MESMA EMPRESA — e os guards são do dono (04/09):
 *
 *   1. CNPJ igual (os dois têm) → **é o mesmo**, sem discussão.
 *   2. Os DOIS têm CNPJ e são DIFERENTES → **NUNCA unifica**, nem com nome idêntico.
 *      Matriz e filial têm o mesmo nome e CNPJs diferentes; fundir criaria uma dívida
 *      apontando pra empresa errada.
 *   3. Nenhum dos dois tem CNPJ → une **só se o nome normalizado for IGUAL** (sem acento,
 *      sem caixa, sem espaço repetido). Parecido não basta.
 *   4. Um tem CNPJ e o outro não → **não une**: não há como provar, e o dono decide vendo
 *      os dois com a origem marcada.
 *
 * ⚠️ A REGRA DE FUNDO: *fusão errada de fornecedor é pior que duplicata visível* — a
 * duplicata se resolve com uma costura; a fusão errada manda dinheiro pro CNPJ errado e
 * ninguém percebe.
 */
export function ehMesmoFornecedor(
  a: { razaoSocial: string; cnpj: string | null },
  b: { razaoSocial: string; cnpj: string | null },
): boolean {
  const ca = soDigitos(a.cnpj)
  const cb = soDigitos(b.cnpj)
  if (ca && cb) return ca === cb              // (1) e (2)
  if (!ca && !cb) return normalizarBusca(a.razaoSocial) === normalizarBusca(b.razaoSocial) // (3)
  return false                                 // (4)
}

/**
 * A lista que o seletor mostra: estoque ∪ financeiro, unificada pelos guards acima.
 *
 * ⚠️ Ordenada por nome, e a origem vai junto: quando o sistema NÃO pode provar que dois
 * registros são o mesmo, ele mostra **os dois**, cada um com o rótulo de onde veio. Mostrar
 * duas linhas é honesto; fundir por palpite não é.
 */
export async function listarFornecedoresUnificados(
  companyId: string, db: Db = defaultPrisma,
): Promise<FornecedorUnificado[]> {
  const [doEstoque, doFinanceiro] = await Promise.all([
    db.stockSupplier.findMany({ where: { companyId }, select: { id: true, razaoSocial: true, cnpj: true } }),
    db.supplier.findMany({ where: { companyId }, select: { id: true, razaoSocial: true, cnpj: true } }),
  ])

  const out: FornecedorUnificado[] = doEstoque.map((s) => ({
    stockId: s.id, financeiroId: null, razaoSocial: s.razaoSocial, cnpj: s.cnpj ?? null, origem: 'ESTOQUE' as OrigemFornecedor,
  }))

  for (const f of doFinanceiro) {
    // ⛔⛔ SÓ CASA COM LINHA QUE VEIO DO ESTOQUE (`x.stockId`). Sem esse filtro, um registro
    // do financeiro já EMPILHADO virava alvo do próximo — dois cadastros do financeiro se
    // fundiam entre si, um sumia da lista e a linha ainda dizia "AMBOS" (mentindo sobre
    // existir no estoque). Medido em prod: 33 linhas com id de estoque contra 28 que existem.
    // ⚠️ Duplicata DENTRO do financeiro não é problema deste seletor — e some-la seria
    // exatamente a fusão silenciosa que o dono proibiu.
    const par = out.find((x) => x.stockId && ehMesmoFornecedor(x, { razaoSocial: f.razaoSocial, cnpj: f.cnpj ?? null }))
    if (par) {
      par.financeiroId = f.id
      par.origem = 'AMBOS'
      // ⭐ o nome do FINANCEIRO manda quando é mais completo: é o cadastro que o dono
      // mantém à mão ("RM2 COMERCIO DE MATERIAIS…" contra o "rm2" que nasceu de uma nota).
      if (f.razaoSocial.length > par.razaoSocial.length) par.razaoSocial = f.razaoSocial
      if (!par.cnpj && f.cnpj) par.cnpj = f.cnpj
    } else {
      out.push({ stockId: null, financeiroId: f.id, razaoSocial: f.razaoSocial, cnpj: f.cnpj ?? null, origem: 'FINANCEIRO' })
    }
  }

  return out.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'))
}

/**
 * Garante o `stock_supplier` do fornecedor escolhido — **o gesto da escolha cria o de cá**.
 *
 * ⛔ NUNCA escreve no `Supplier` do financeiro: a fronteira do módulo permite LER o outro
 * lado, não editar. Escolher um fornecedor do financeiro traz uma CÓPIA pro estoque; a
 * ponte, no sentido inverso, é que tem a exceção desenhada de criar `Supplier`.
 */
export async function garantirFornecedorDoEstoque(
  companyId: string, escolhido: { stockId: string | null; financeiroId: string | null }, db: Db = defaultPrisma,
): Promise<string> {
  if (escolhido.stockId) return escolhido.stockId
  if (!escolhido.financeiroId) throw new Error('Escolha um fornecedor.')

  const f = await db.supplier.findFirst({
    where: { id: escolhido.financeiroId, companyId }, select: { razaoSocial: true, cnpj: true },
  })
  if (!f) throw new Error('Fornecedor não encontrado nesta empresa.')

  const cnpj = soDigitos(f.cnpj)
  // ⚠️ idempotente: se já existe um do estoque com o mesmo CNPJ, reusa em vez de duplicar
  const ja = cnpj ? await db.stockSupplier.findFirst({ where: { companyId, cnpj }, select: { id: true } }) : null
  if (ja) return ja.id

  const novo = await db.stockSupplier.create({
    data: { companyId, cnpj: cnpj || null, razaoSocial: f.razaoSocial, criadoVia: 'MANUAL' },
    select: { id: true },
  })
  return novo.id
}
