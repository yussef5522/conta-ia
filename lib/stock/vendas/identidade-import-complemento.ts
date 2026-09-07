// ⭐ A IDENTIDADE DO IMPORT DE COMPLEMENTOS — módulo próprio (07/09/2026).
//
// ⚠️ Mora separada por uma razão estrutural: desde que o **confirmar do import passou a
// baixar** (decisão do dono, 07/09), `import-complementos.ts` precisa chamar a baixa e
// `baixa-complemento.ts` precisa saber ler o `importId` — importar um do outro fecharia um
// CICLO. As duas pontas leem daqui, e ninguém aponta pro outro.
//
// ⛔⛔ E A REGRA QUE ESTE ARQUIVO CARREGA CONTINUA SENDO A MESMA (02/09): o relatório do
// Suitable **não traz data**, e o dono pode exportar um DIA ou um PERÍODO. Se um período
// entrar como dia, "processar o dia X" baixaria as **7.648 ocorrências do mês inteiro** com
// cara de operação normal. Por isso o período é marcado no `importId`, e a baixa RECUSA.

export type ModoImportComplemento = 'DIA' | 'PERIODO'

export const importIdDe = (companyId: string, data: string, modo: ModoImportComplemento) =>
  modo === 'PERIODO' ? `comp-periodo-${companyId}-${data}` : `comp-${companyId}-${data}`

/** ⛔ a baixa TEM que chamar isto e pular: linha de período não é venda de um dia. */
export const ehLinhaDePeriodo = (importId: string) => importId.startsWith('comp-periodo-')
