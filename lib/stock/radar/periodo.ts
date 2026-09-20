// ⭐ O PERÍODO DO RADAR — as pílulas do mock, numa função PURA (20/09/2026).
//
// ⚠️ **A JANELA E O RÓTULO SAEM DO MESMO LUGAR.** Se a rota calculasse as datas e a tela
// escrevesse o texto, os dois divergiriam no primeiro ajuste — e a tela diria "setembro"
// mostrando outra coisa. É a cicatriz literal de 26/08 (*"a tela de Vendas dizia ~595 mil
// e o Fluxo ~425 mil"*) e dos 5 textos "12/08" que estavam literais em tela.

import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

export type ChavePeriodo = 'ONTEM_HOJE' | 'SETE_DIAS' | 'MES' | 'LIVRE'

export interface JanelaDoRadar {
  chave: ChavePeriodo
  de: string
  ate: string
  /** o texto da pílula ACESA — o mesmo que a tela imprime */
  rotulo: string
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const menosDias = (dia: string, n: number) =>
  new Date(+new Date(`${dia}T12:00:00-03:00`) - n * 86_400_000).toISOString().slice(0, 10)

/**
 * ⚠️ `hoje` é PARÂMETRO, nunca `new Date()` lá dentro: o relógio só rotula a tela, jamais
 * decide — e teste com data fixa no futuro é bomba de calendário (REGRA da casa, 01/09).
 */
export function janelaDoPeriodo(
  chave: ChavePeriodo,
  livre?: { de?: string | null; ate?: string | null },
  hoje: string = diaEmSaoPaulo(),
): JanelaDoRadar {
  if (chave === 'LIVRE' && livre?.de && livre?.ate) {
    // ⭐ datas trocadas não viram erro na cara do dono — o sistema entende e segue
    const [de, ate] = livre.de <= livre.ate ? [livre.de, livre.ate] : [livre.ate, livre.de]
    return { chave, de, ate, rotulo: `${br(de)} a ${br(ate)}` }
  }
  if (chave === 'SETE_DIAS') {
    return { chave, de: menosDias(hoje, 6), ate: hoje, rotulo: '7 dias' }
  }
  if (chave === 'MES') {
    const de = `${hoje.slice(0, 7)}-01`
    return { chave, de, ate: hoje, rotulo: MESES[Number(hoje.slice(5, 7)) - 1] }
  }
  return { chave: 'ONTEM_HOJE', de: menosDias(hoje, 1), ate: hoje, rotulo: 'ontem → hoje' }
}

const br = (d: string) => d.split('-').reverse().join('/')
