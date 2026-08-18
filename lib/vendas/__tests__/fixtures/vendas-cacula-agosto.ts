// GOLDEN FIXTURE — vendas reais da Cacula 12-17/08/2026 (anonimizado, ANTI-PII:
// só data/valor/conta/meio; SEM descrição, nome, id real ou contraparte). Travado
// pelo dono contra o que a loja vendeu (17/08). Se um refactor mudar 1 centavo, o
// golden grita. Mesma disciplina dos empréstimos.
//
// ⚠️ Ordem = cronológica (date asc) — define o split da Tuna (1º=sex, 2º=sáb, 3º=dom).

import type { VendaTxInput } from '../../compute-vendas-diarias'
import type { RegraRecebimento } from '../../perfil-recebimento'

export const ACC = { banrisul: 'ACC_BANRISUL', sicredi: 'ACC_SICREDI', stone: 'ACC_STONE', cofre: 'ACC_COFRE' } as const

const VIGE = new Date('2026-08-12T00:00:00Z')
export const MODULE_INICIO = VIGE
export const REGRAS_CACULA: RegraRecebimento[] = [
  { bankAccountId: ACC.banrisul, meio: 'CARTAO', diasUteisAtraso: 1, recebeSabDom: false, vigenteDe: VIGE, vigenteAte: null, confirmadoPeloDono: true },
  { bankAccountId: ACC.sicredi, meio: 'PIX', diasUteisAtraso: 1, recebeSabDom: false, vigenteDe: VIGE, vigenteAte: null, confirmadoPeloDono: true },
  { bankAccountId: ACC.stone, meio: 'PIX', diasUteisAtraso: 0, recebeSabDom: true, vigenteDe: VIGE, vigenteAte: null, confirmadoPeloDono: true },
  { bankAccountId: ACC.cofre, meio: 'DINHEIRO', diasUteisAtraso: 1, recebeSabDom: true, vigenteDe: VIGE, vigenteAte: null, confirmadoPeloDono: true },
]

interface Entrada { acc: keyof typeof ACC; meio: 'CARTAO' | 'PIX' | 'DINHEIRO'; date: string; amount: number }

export const ENTRADAS: Entrada[] = [
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-12', amount: 7403.00 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-12', amount: 33.63 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-12', amount: 127.65 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-12', amount: 184.80 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-12', amount: 218.96 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 0.58 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 5028.00 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 393.26 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 197.15 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 56.72 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-13', amount: 29.54 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-14', amount: 3654.88 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-14', amount: 369.84 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-14', amount: 103.54 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-14', amount: 102.41 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-17', amount: 24431.87 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-17', amount: 2173.65 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-17', amount: 1646.29 },
  { acc: 'banrisul', meio: 'CARTAO', date: '2026-08-17', amount: 170.36 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-12', amount: 159.40 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-12', amount: 2676.90 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-12', amount: 35.49 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-13', amount: 4050.41 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-14', amount: 4224.42 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-17', amount: 5780.17 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-17', amount: 7979.80 },
  { acc: 'sicredi', meio: 'PIX', date: '2026-08-17', amount: 8587.17 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-12', amount: 19.90 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-12', amount: 63.48 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-12', amount: 34.82 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-12', amount: 22.79 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-13', amount: 89.55 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-13', amount: 22.79 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-13', amount: 38.80 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-13', amount: 8.96 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-13', amount: 74.61 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 136.29 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 245.75 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 198.99 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 70.63 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 70.65 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 165.13 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-14', amount: 85.57 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 29.19 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 48.75 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 131.32 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 79.59 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 58.69 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 39.80 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 39.80 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-15', amount: 124.38 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-16', amount: 66.67 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-16', amount: 80.60 },
  { acc: 'stone', meio: 'PIX', date: '2026-08-16', amount: 29.82 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-12', amount: 2445.00 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-13', amount: 2023.00 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-14', amount: 1779.00 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-15', amount: 2705.00 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-16', amount: 3816.00 },
  { acc: 'cofre', meio: 'DINHEIRO', date: '2026-08-17', amount: 3099.00 },
]

/** Constrói os VendaTxInput (ids sintéticos txN por ordem) pro motor. */
export function buildInputs(): VendaTxInput[] {
  return ENTRADAS.map((e, i) => ({
    id: `tx${i}`,
    bankAccountId: ACC[e.acc],
    meio: e.meio,
    date: new Date(e.date + 'T12:00:00Z'),
    valorLiquido: e.amount,
    tipo: 'VENDA' as const,
  }))
}
