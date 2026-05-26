/**
 * ICMS-ST POR ESTADO - MAPA BRASIL
 * Base: Convênio CONFAZ 142/2018 + convênios estaduais.
 *
 * Versão: 2026
 */

export const ICMS_ST_POR_ESTADO_KB = {
  bebidas: {
    descricao: 'Convênio ICMS 142/2018 - bebidas em ST em TODOS os estados',
    produtos: [
      { ncm: '2203.00.00', produto: 'Cerveja', mvaMedio: '70-100%' },
      { ncm: '2202.10.00', produto: 'Refrigerante', mvaMedio: '40-70%' },
      { ncm: '2202.99.00', produto: 'Energético/Isotônico', mvaMedio: '50-80%' },
      { ncm: '2201.10.00', produto: 'Água mineral', mvaMedio: '40-60%' },
      { ncm: '2009.xx', produto: 'Suco industrializado', mvaMedio: '40-60%' },
      { ncm: '2204', produto: 'Vinho', mvaMedio: 'Varia' },
      { ncm: '2208', produto: 'Destilados', mvaMedio: 'Varia muito' },
    ],
  },

  vestuario: {
    SP: { status: 'NÃO TEM ST geral', observacao: 'Excluído Decreto 61.741/2015' },
    RJ: { status: 'TEM ST', baseLegal: 'Decreto 27.815/2001', mva: '40-80%' },
    MG: { status: 'TEM ST', baseLegal: 'RICMS-MG Art. 12', mva: '50-95%' },
    RS: { status: 'PARCIAL', produtos: 'Confecção, malharia' },
    PR: { status: 'TEM ST', produtos: 'Confecção, vestuário' },
    SC: { status: 'PARCIAL', observacao: 'Grande produtor têxtil - regras especiais' },
    BA: { status: 'TEM ST', produtos: 'Vestuário e calçados' },
    PE: { status: 'TEM ST', mva: '40-60%' },
    CE: { status: 'TEM ST', mva: '40-60%' },
    GO: { status: 'PARCIAL' },
    DF: { status: 'TEM ST limitada' },
  },

  calcados: {
    descricao: 'NCM 6401-6405',
    estados_com_st_principais: ['MG', 'RJ', 'BA', 'PE', 'RS'],
    mva: '40-80% conforme produto',
  },

  combustiveis: {
    todos_estados: 'TEM ST em TODOS - Convênio 110/2007',
    produtos: ['Gasolina', 'Diesel', 'Etanol', 'Querosene', 'GLP'],
    observacao: 'Posto revende com ICMS ZERO (já recolhido na refinaria)',
  },

  medicamentos: {
    todos_estados: 'TEM ST - Convênio 76/1994',
    observacao: 'Farmácia/drogaria revende sem novo ICMS',
  },

  cigarros_fumo: {
    todos_estados: 'TEM ST + Imposto Seletivo (futuro)',
  },

  estrategia_geral: `PARA QUALQUER LOJA/RESTAURANTE:
1. Levantar produtos vendidos com NCM
2. Consultar legislação estadual atualizada
3. Identificar quais TEM ST no estado
4. Segregar no PGDAS (Simples) ou apuração separada (Presumido/Real)
5. Pode pedir restituição últimos 5 anos se descobriu agora`,

  como_consultar_atualizado: `Cada estado tem RICMS (Regulamento ICMS) com lista de produtos em ST.
Sites oficiais:
- SP: portal.fazenda.sp.gov.br
- RJ: fazenda.rj.gov.br
- MG: fazenda.mg.gov.br
- RS: fazenda.rs.gov.br
Receita Federal: portal de Atos Internacionais (Convênios CONFAZ).`,
} as const
