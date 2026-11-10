// SUITAPI — O ESPELHO (10/11/2026). Código PURO: pedido cru da API → as linhas do banco.
//
// ⛔⛔ ALLOWLIST, NUNCA DENYLIST (LGPD / lei V8). A lista E o detalhe da API trazem `customer`
// (nome, telefone), `delivery_address` (rua, lat/long, `formatted`), `motoboy`, `call_name`,
// `comments`, `cancellation_reason` e `discount_reason` (texto livre). Nada disso tem campo aqui:
// cada coluna gravada é copiada NOMINALMENTE abaixo. Campo novo que a API inventar amanhã não
// entra por acidente — esse é o motivo de ser allowlist (medido em 10/11: `formatted` com a rua
// do cliente vinha num campo que uma denylist por nome teria deixado passar).

import { centavos, somarDias, HORA_VIRADA_DIA, STATUS_FORA_DA_REGUA } from './regua-sombra'
import type { PedidoCru, LancamentoCru } from './cliente-leitura'
import { normalizarNome } from '../stock/vendas/grupo-complemento'

/** "2026-11-10T02:54:02.8244" (relógio da API = UTC, sem fuso) → Date UTC */
export function dataDaApi(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) throw new Error(`data da API inválida: ${s}`)
  const semFuso = s.replace(/(Z|[+-]\d{2}:?\d{2})$/, '')
  const d = new Date(`${semFuso.slice(0, 23)}Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`data da API inválida: ${s}`)
  return d
}
const dataOuNull = (s: string | null | undefined) => (s ? dataDaApi(s) : null)

/** o dia operacional da régua: created_at na janela D 06:00 → D+1 06:00 (relógio da API) */
export function diaOperacional(createdAt: string): string {
  const dia = createdAt.slice(0, 10)
  return createdAt.slice(11, 19) >= HORA_VIRADA_DIA ? dia : somarDias(dia, -1)
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new Error(`número inválido: ${String(v)}`)
  return n
}
const centOuNull = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : centavos(v))

/**
 * O que a RÉGUA conta deste pedido, numa string canônica. Muda ⇒ o pedido "mudou" no sentido
 * que importa (status de transição — accepted→ready→delivered — NÃO muda a impressão).
 */
export function impressaoDaRegua(p: Pick<PedidoCru, 'status' | 'items'>): string {
  if (p.status === STATUS_FORA_DA_REGUA) return 'FORA'
  return p.items
    .filter((i) => !i.cancelled_at)
    .map((i) => `${i.id}:${normalizarNome(i.name)}:${num(i.quantity)}:${centavos(i.price)}`)
    .sort()
    .join('|')
}

/** a contribuição (un, centavos) de uma impressão — pra medir o delta de um evento */
export function contribuicao(impressao: string): { un: number; cent: number } {
  if (impressao === 'FORA' || impressao === '') return { un: 0, cent: 0 }
  let un = 0
  let cent = 0
  for (const parte of impressao.split('|')) {
    const campos = parte.split(':')
    cent += Number(campos[campos.length - 1])
    un += Number(campos[campos.length - 2])
  }
  return { un: Math.round(un * 1000) / 1000, cent }
}

export interface LinhasDoPedido {
  pedido: {
    apiId: number; dia: string; status: string; orderType: string | null; source: string | null
    displayNumber: string | null; integrationCode: string | null
    criadoApiEm: Date; entregueApiEm: Date | null; finalizadoApiEm: Date | null; agendadoPara: Date | null; agendado: boolean
    produtosCent: number; entregaCent: number; servicoCent: number; descontoCent: number; adicionalCent: number; totalCent: number
    pago: boolean; impressao: string
  }
  itens: Array<{
    apiItemId: number; nome: string; categoria: string | null; quantidade: number; unitarioCent: number; precoCent: number
    baseCent: number | null; status: string | null; pedidoEm: Date | null; canceladoEm: Date | null
    pesoKg: number | null; porPeso: boolean; promocional: boolean
    opcoes: Array<{ ordem: number; grupo: string | null; nome: string; unitarioCent: number; quantidade: number; precoCent: number }>
  }>
  pagamentos: Array<{ ordem: number; apiMetodoId: number | null; codigo: number | null; tipo: string | null; lancamento: string | null; valorCent: number; liquidado: boolean }>
}

/** ⭐ A ALLOWLIST. Cada campo gravado aparece aqui pelo nome — e só ele. */
export function linhasDoPedido(p: PedidoCru): LinhasDoPedido {
  return {
    pedido: {
      apiId: p.id,
      dia: diaOperacional(p.created_at),
      status: p.status,
      orderType: p.order_type ?? null,
      source: p.source ?? null,
      displayNumber: p.display_number ?? null,
      integrationCode: p.integration_code ?? null,
      criadoApiEm: dataDaApi(p.created_at),
      entregueApiEm: dataOuNull(p.delivered_at),
      finalizadoApiEm: dataOuNull(p.finished_at),
      agendadoPara: dataOuNull(p.scheduled_for),
      agendado: !!p.is_scheduled,
      produtosCent: centavos(p.products_total),
      entregaCent: centavos(p.delivery_fee),
      servicoCent: centavos(p.service_fee),
      descontoCent: centavos(p.discount),
      adicionalCent: centavos(p.additional),
      totalCent: centavos(p.total),
      pago: !!p.paid,
      impressao: impressaoDaRegua(p),
    },
    itens: p.items.map((i) => ({
      apiItemId: i.id,
      nome: i.name,
      categoria: i.category ?? null,
      quantidade: num(i.quantity),
      unitarioCent: centavos(i.unit_price),
      precoCent: centavos(i.price),
      baseCent: centOuNull(i.base_price),
      status: i.status ?? null,
      pedidoEm: dataOuNull(i.requested_at),
      canceladoEm: dataOuNull(i.cancelled_at),
      pesoKg: i.weight_kg ?? null,
      porPeso: !!i.sold_by_weight,
      promocional: !!i.promotional,
      opcoes: (i.options ?? []).map((o, ordem) => ({
        ordem,
        grupo: o.group_name ?? null,
        nome: o.name,
        unitarioCent: centavos(o.unit_price),
        quantidade: num(o.quantity),
        precoCent: centavos(o.price),
      })),
    })),
    pagamentos: (p.payment?.methods ?? []).map((m, ordem) => ({
      ordem,
      apiMetodoId: m.id ?? null,
      codigo: m.code ?? null,
      tipo: m.type ?? null,
      lancamento: m.entry_type ?? null,
      valorCent: centavos(m.value),
      liquidado: !!m.settled,
    })),
  }
}

/** ⭐ ALLOWLIST do lançamento financeiro. ⛔ `description` e `bank_account.name` ficam fora. */
export function linhaDoLancamento(l: LancamentoCru, diaCaixa: string) {
  return {
    apiId: l.id,
    entryId: l.entry_id ?? null,
    diaCaixa,
    dia: diaOperacional(l.created_at),
    tipo: l.type,
    status: l.status,
    receita: !!l.is_earning,
    administrativo: !!l.administrative,
    conciliado: !!l.conciliated,
    valorCent: centavos(l.value),
    taxaCent: centavos(l.fee),
    liquidoCent: centavos(l.net_value),
    metodoTipo: l.payment_method?.type ?? null,
    metodoApiId: l.payment_method?.id ?? null,
    contaApiId: l.bank_account?.id ?? null,
    billId: l.bill_id ?? null,
    caixaId: l.cashier_id ?? null,
    turnoCaixaId: l.cashier_shift_id ?? null,
    criadoApiEm: dataDaApi(l.created_at),
    recebidoEm: l.received_at ?? null,
  }
}
