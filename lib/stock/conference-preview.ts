// ESTOQUE FASE 1 item 2 — dados do PREVIEW da conferência (modo teste, NÃO grava).
// Uma "nota" ilustrativa (baseada na golden OLEO DE SOJA) com 3 itens que cobrem os
// 3 casos que o dono quer simular no celular:
//   1) item JÁ mapeado (qtd pré-preenchida, só confere)   → REFRIGERANTE
//   2) item NÃO mapeado (criar novo, unidade/categoria)   → OLEO DE SOJA (golden)
//   2b) não mapeado com FATOR (unidade da nota ≠ controle) → CERVEJA CX c/12
// (o caso 3, divergência, é editar a qtd recebida de qualquer um → motivo + foto.)

import { sugerirCategoria, sugerirUnidade, sugerirNome, type CategoriaEstoque, type UnidadeControle } from './sugestoes'

export interface PreviewItem {
  nfeItemId: string
  xProd: string
  cProd: string
  ncm: string
  uCom: string
  qCom: number
  vUnCom: number
  vProd: number
  // se já existe mapeamento (caso 1): o item do estoque + fator
  mapeado: { itemId: string; nome: string; unidadeControle: UnidadeControle; fatorConversao: number } | null
  // sugestão pro cadastro (caso 2): o que preencher se criar novo
  sugestao: { nome: string; unidade: UnidadeControle | null; categoria: CategoriaEstoque }
}

export interface PreviewConference {
  modoTeste: true
  fornecedor: { nome: string; cnpj: string; uf: string; jaCadastrado: boolean }
  chave: string
  dataEmissao: string
  valorNota: number
  itens: PreviewItem[]
}

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

function mk(nfeItemId: string, xProd: string, cProd: string, ncm: string, uCom: string, qCom: number, vUnCom: number, mapeado: PreviewItem['mapeado']): PreviewItem {
  const nome = sugerirNome(xProd)
  return {
    nfeItemId, xProd, cProd, ncm, uCom, qCom, vUnCom, vProd: r2(qCom * vUnCom), mapeado,
    sugestao: { nome, unidade: sugerirUnidade(uCom), categoria: sugerirCategoria(xProd, ncm) },
  }
}

export function buildPreviewConference(): PreviewConference {
  const itens: PreviewItem[] = [
    // CASO 2 — não mapeado, unidade UN direta (sem fator)
    mk('prev-1', 'OLEO DE SOJA SOYA PET          UND 900ML', '282', '15079011', 'UN', 120, 7.72, null),
    // CASO 1 — já mapeado (só confere, qtd pré-preenchida)
    mk('prev-2', 'REFRIGERANTE COLA 2L', '551', '22021000', 'UN', 24, 12.2, { itemId: 'item-refri-cola-2l', nome: 'Refrigerante Cola 2L', unidadeControle: 'UN', fatorConversao: 1 }),
    // CASO 2b — não mapeado, unidade da nota (CX) ≠ controle → fator "1 CX = 12 UN"
    mk('prev-3', 'CERVEJA LATA 350ML CX C/12', '773', '22030000', 'CX', 10, 36.0, null),
  ]
  return {
    modoTeste: true,
    fornecedor: { nome: 'FORNECEDOR TESTE LTDA', cnpj: '11222333000181', uf: 'SC', jaCadastrado: false },
    chave: '42260511222333000181550020063812691168173940',
    dataEmissao: '2026-08-20',
    valorNota: r2(itens.reduce((s, i) => s + i.vProd, 0)),
    itens,
  }
}
