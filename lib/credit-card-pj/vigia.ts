// ⭐⭐⭐ R51 — O SININHO VIGIA O CARTÃO (docs/cartoes-referencia.html · 24/11/2026).
//
// PORTA ÚNICA: a decisão "este cartão pede olho?" mora AQUI, pura, sobre a MESMA carteira que a
// página desenha. O produtor do sininho grava estes avisos; a página mostra estes MESMOS no topo
// (lei do topo), na âncora onde o sininho pousa. ⛔ Recalcular no produtor seria a 2ª resposta.
//
// Os três alarmes da lei:
//   1. fatura FECHADA sem pagamento casado a ≤ 3 dias do vencimento (ou já vencida — até 30 dias);
//   2. o fechamento PASSOU e a fatura não foi importada (2 dias de folga pro PDF sair);
//   3. limite acima de 80% (pela régua única do disponível).
// ⚠️ Só desde o marco (INICIO_DO_MODULO): cobrar arqueologia é como o sininho morre.

import { diasAte, venceEm, rotuloMesAno, INICIO_DO_MODULO } from './ciclo'
import type { Carteira } from './carteira'
import { ANCORAS } from '@/components/perguntas/ancoras'

export const DIAS_DE_AVISO_DO_VENCIMENTO = 3
export const FOLGA_DO_PDF_DIAS = 2
export const LIMITE_ALTO = 0.8

export type TipoDoAlerta = 'VENCENDO_SEM_PAGAMENTO' | 'FATURA_NAO_IMPORTADA' | 'LIMITE_ALTO'

export interface AlertaDoCartao {
  tipo: TipoDoAlerta
  cartaoId: string
  /** chave de dedupe do sininho */
  alvo: string
  severidade: 'coral' | 'ambar' | 'azul'
  titulo: string
  corpo: string
  oQueFazer: string
  acaoRotulo: string
  /** a tela onde o gesto mora (o cartão) */
  acaoHref: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** o link do sininho: a PÁGINA de cartões, pousando no cartão da lei do topo */
export const hrefDaVigia = (companyId: string) => `/empresas/${companyId}/cartoes#${ANCORAS.CARTAO_VIGIA}`

export function alertasDaCarteira(companyId: string, c: Carteira): AlertaDoCartao[] {
  const out: AlertaDoCartao[] = []
  for (const k of c.cartoes) {
    const banco = k.bankName ?? k.name
    const fat = k.atual
    if (fat && fat.mes >= INICIO_DO_MODULO && fat.estado === 'fechada') {
      const dias = diasAte(c.hoje, fat.vencimento)
      if (dias <= DIAS_DE_AVISO_DO_VENCIMENTO && dias >= -30) {
        out.push({
          tipo: 'VENCENDO_SEM_PAGAMENTO', cartaoId: k.id, alvo: `${k.id}:${fat.mes}:vencendo`,
          severidade: dias < 0 ? 'coral' : 'ambar',
          titulo: `Confira o pagamento da fatura ${banco} — ${venceEm(dias)}`,
          corpo: `A fatura de ${rotuloMesAno(fat.mes)} (${brl(fat.total)}) fechou e ainda não tem pagamento casado.`,
          oQueFazer: 'Abra o cartão e case o pagamento assim que ele aparecer no extrato — ou pague até o vencimento.',
          acaoRotulo: 'abrir a fatura', acaoHref: `/empresas/${companyId}/cartoes/${k.id}?fatura=${fat.mes}`,
        })
      }
    }
    // ⚠️ a fatura que já devia estar no sistema: o ciclo da "aberta" fechou e o PDF não entrou
    if (fat && k.aberta.mes >= INICIO_DO_MODULO && diasAte(k.aberta.fechamento, c.hoje) > FOLGA_DO_PDF_DIAS) {
      out.push({
        tipo: 'FATURA_NAO_IMPORTADA', cartaoId: k.id, alvo: `${k.id}:${k.aberta.mes}:sem-import`,
        severidade: 'azul',
        titulo: `Importe a fatura de ${rotuloMesAno(k.aberta.mes)} do ${banco}`,
        corpo: `O cartão fechou em ${ddmm(k.aberta.fechamento)} e a fatura ainda não entrou no sistema.`,
        oQueFazer: 'Importe o PDF da fatura na tela do cartão.',
        acaoRotulo: 'importar a fatura', acaoHref: `/empresas/${companyId}/cartoes/${k.id}/importar-fatura`,
      })
    }
    if (k.creditLimit > 0 && k.usoPct > LIMITE_ALTO) {
      out.push({
        tipo: 'LIMITE_ALTO', cartaoId: k.id, alvo: `${k.id}:limite`,
        severidade: 'ambar',
        titulo: `Confira o limite do ${banco}: ${Math.round(k.usoPct * 100)}% usado`,
        corpo: `Restam ${brl(Math.max(0, k.disponivel))} de ${brl(k.creditLimit)} — contando a fatura aberta e as fechadas sem pagamento.`,
        oQueFazer: 'Confira as faturas em aberto do cartão e case os pagamentos que já saíram do banco.',
        acaoRotulo: 'abrir o cartão', acaoHref: `/empresas/${companyId}/cartoes/${k.id}`,
      })
    }
  }
  return out
}
