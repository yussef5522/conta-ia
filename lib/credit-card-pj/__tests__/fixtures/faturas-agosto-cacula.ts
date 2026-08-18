// GOLDEN FIXTURE — faturas de cartão de agosto/2026 da Cacula (anonimizado, ANTI-PII:
// só type + amount, SEM descrição/estabelecimento/nome). Travado ao centavo. Se um
// refactor mudar 1 centavo em faturaNetTotal ou no status pago, o golden grita.
// 'D' = DEBIT (compra/encargo), 'C' = CREDIT (estorno).

import type { FaturaItem } from '../../fatura-net-total'

type L = ['D' | 'C', number]

export interface FaturaGolden {
  banco: string
  linhas: L[]
  netEsperado: number // faturaNetTotal(linhas).net
  comprasEsperado: number
  estornosEsperado: number
  pagamento: number | null // valor do pagamento casado (null = OPEN)
}

const SICREDI: L[] = [['D',922.72],['D',549.99],['D',406.00],['D',401.72],['D',299.00],['D',281.95],['D',258.45],['D',199.99],['D',199.99],['D',199.97],['D',180.80],['D',143.98],['D',131.70],['D',130.90],['D',126.17],['D',120.99],['D',118.07],['D',117.68],['D',117.30],['D',114.97],['D',113.52],['D',112.75],['D',112.45],['D',107.29],['D',106.75],['D',105.64],['D',104.45],['D',99.94],['D',99.51],['C',99.23],['D',95.70],['D',91.06],['D',86.51],['D',84.64],['D',80.30],['D',79.90],['D',77.93],['D',77.70],['D',72.60],['D',71.42],['D',69.80],['D',65.00],['D',60.80],['D',55.80],['D',54.93],['D',49.98],['D',49.62],['D',47.95],['D',47.94],['D',46.40],['D',46.11],['D',46.00],['D',44.90],['D',41.90],['D',41.44],['D',40.00],['D',40.00],['D',39.90],['D',38.91],['D',35.00],['D',30.00],['D',24.98],['D',24.03],['D',18.00],['D',17.99],['D',16.00],['D',15.00],['D',15.00],['D',13.03],['D',10.90],['D',10.00],['D',8.90],['D',7.00],['D',6.00],['D',5.00],['D',5.00],['D',3.94]]

const BANRISUL: L[] = [['D',10000.00],['D',1052.42],['D',467.56],['D',231.86],['D',231.74],['D',224.98],['D',186.46],['D',165.83],['D',98.29],['D',94.99],['D',94.90],['D',86.24],['D',85.70],['D',85.70],['D',81.22],['D',79.08],['D',79.08],['D',73.57],['D',64.90],['D',55.33],['D',52.06],['D',51.44],['D',43.16],['D',36.83],['D',29.90],['D',16.36],['D',9.69],['D',0.44]]

const CAIXA: L[] = [['D',1616.09],['D',570.08],['D',569.74],['D',569.73],['D',569.69],['D',569.47],['D',569.34],['D',569.33],['D',569.30],['D',569.24],['D',364.29],['D',166.62],['D',12.50],['D',6.84],['D',0.71]]

export const FATURAS_AGOSTO: FaturaGolden[] = [
  { banco: 'Sicredi', linhas: SICREDI, netEsperado: 7896.32, comprasEsperado: 7995.55, estornosEsperado: 99.23, pagamento: 7896.32 },
  { banco: 'Banrisul', linhas: BANRISUL, netEsperado: 13779.73, comprasEsperado: 13779.73, estornosEsperado: 0, pagamento: 13779.73 },
  { banco: 'Caixa', linhas: CAIXA, netEsperado: 7292.97, comprasEsperado: 7292.97, estornosEsperado: 0, pagamento: null },
]

/** Converte as tuplas anonimizadas em FaturaItem[] pro faturaNetTotal. */
export function itens(linhas: L[]): FaturaItem[] {
  return linhas.map(([t, a]) => ({ type: t === 'C' ? 'CREDIT' : 'DEBIT', amount: a, isCardPayment: false }))
}
