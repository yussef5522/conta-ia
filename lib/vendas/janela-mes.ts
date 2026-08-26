// VENDAS — a janela do MÊS na tela (25/08).
//
// ⚠️ O BURACO QUE ISTO FECHA: a tela filtrava a VendaDiaria por `dataCompetencia`
// dentro do mês. Um BLOCO de fim de semana começa na SEXTA — quando a sexta cai no
// mês anterior (31/07 → 01-02/08), a competência de início fica FORA da janela e o
// bloco inteiro SOME da tela. Na extensão de 01/08 isso escondia R$ 43.106,03
// (cartão + PIX Sicredi do fim de semana 31/07–02/08).
//
// A regra certa é SOBREPOSIÇÃO, não pertencimento: a linha entra no mês se o
// intervalo [competência, competênciaFim] cruza o mês. E quando ela COMEÇA antes,
// a tela tem que DIZER — o bloco não é separável (o cartão de sexta e o de sábado
// caem no mesmo depósito de segunda; o banco não diz qual real é de qual dia).

export interface LinhaCompetencia {
  dataCompetencia: Date
  dataCompetenciaFim: Date
}

/** A linha cruza o mês [inicioMes, fimMes)? */
export function cruzaOMes(v: LinhaCompetencia, inicioMes: Date, fimMes: Date): boolean {
  return v.dataCompetenciaFim.getTime() >= inicioMes.getTime()
    && v.dataCompetencia.getTime() < fimMes.getTime()
}

/** A linha começa ANTES do mês exibido — o total dela inclui venda do mês passado. */
export function incluiMesAnterior(v: LinhaCompetencia, inicioMes: Date): boolean {
  return v.dataCompetencia.getTime() < inicioMes.getTime()
}
