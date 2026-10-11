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

/**
 * ⭐⭐ A MESMA RÉGUA, NA LÍNGUA DO PRISMA — e é por isso que ela mora AQUI (10/10).
 *
 * ⚠️⚠️ ESTE ARQUIVO ESTAVA SEM UM ÚNICO CHAMADOR DE CÓDIGO: a tela antiga morreu no v4
 * e os outros dois leitores (o juiz e o recompute) **reescreveram a sobreposição à mão no
 * `where`**, deixando aqui só comentários apontando pra cá. ***Dono declarado sem
 * consumidor é dono que ninguém obedece*** — e foi exatamente a divergência entre esses
 * leitores que escondeu **R$ 43.106,03** em 25/08 e produziu **111 alarmes falsos** no juiz
 * em 26/08, as duas vezes pela MESMA causa: um leitor corrigido, o outro não.
 *
 * ⛔ A régua não atravessa a query como predicado (`cruzaOMes` roda em memória), então o
 * que dá pra compartilhar é o FRAGMENTO do `where`. Quem precisa filtrar no banco chama
 * isto; quem precisa decidir sobre uma linha na mão chama `cruzaOMes`. **Duas formas, uma
 * decisão** — e um teste exige que as duas concordem linha a linha.
 */
export function whereCruzaOMes(inicioMes: Date, fimMes: Date): {
  dataCompetenciaFim: { gte: Date }
  dataCompetencia: { lt: Date }
} {
  return {
    // ⚠️ `gte` no FIM e `lt` no INÍCIO — é a sobreposição, não o pertencimento. Trocar
    // por `dataCompetencia: { gte: inicioMes }` é o defeito de 25/08 de volta.
    dataCompetenciaFim: { gte: inicioMes },
    dataCompetencia: { lt: fimMes },
  }
}
