// ⭐ O NOME QUE VAI NA BUSCA DO PAINEL (17/09/2026).
//
// Quando o dono toca *"casar com conta a pagar"*, o painel abre **já buscando** o nome que
// a linha do banco traz — é a lição do lote (13/09): *perder no caminho a informação que o
// sistema acabou de mostrar é obrigar o dono a procurar de novo numa lista de 100*.
//
// ⚠️⚠️ **ISTO NÃO É UMA SEGUNDA RÉGUA DE IDENTIDADE.** Quem responde *"é o mesmo
// fornecedor?"* continua sendo `chaveDeIdentidadeDoFornecedor` (REGRA 4). Aqui a pergunta é
// outra e bem menor: *"que texto eu jogo no campo de busca?"* — e a resposta precisa ficar
// **legível pro humano**, com acento e maiúscula, porque ela aparece dentro do campo.
//
// ⛔ Por isso NÃO se usa a chave normalizada: ela devolve `bamberg comercio e repres`, e o
// `contains` do Postgres é **case-sensitive** (a cicatriz de 28/08) — o nome minúsculo
// acharia menos que o nome cru.

/** o que os bancos penduram no fim e não faz parte do nome de ninguém */
const CAUDA_DO_BANCO = /\s*[-|·]\s*(pagamento|pagto|transfer[êe]ncia|pix|ted|doc|compra|cr[ée]dito|d[ée]bito)\b.*$/i

/**
 * ⭐ O nome legível pra semear a busca.
 *
 * ⚠️ Linha SEM nome (`DEB.CTA.FATURA-030129693`, `PIX ENVIADO`) devolve **string vazia** —
 * o painel abre com a busca livre. *Semear com lixo é pior que não semear*: o dono veria
 * "nenhuma conta encontrada" e concluiria que não há candidata.
 */
export function nomeDaBusca(descricao: string | null | undefined): string {
  const bruto = (descricao ?? '').trim()
  if (!bruto) return ''
  const semCauda = bruto.replace(CAUDA_DO_BANCO, '').trim()
  /**
   * ⛔ CÓDIGO DE BANCO NÃO É NOME — e "tem palavra de 3+ letras" **não** distingue:
   * `DEB.CTA.FATURA-030129693` tem "FATURA" e passaria (o teste me pegou nisso).
   *
   * ⭐ O que separa de verdade é a FORMA: rubrica de banco vem **grudada, sem espaço e com
   * dígitos** (`DEB.CTA.FATURA-030129693`, `PIX_CRED43098655000157`); nome de gente vem
   * separado por espaço (`BAMBERG COMERCIO E REPRES`) — e o de uma palavra só que sobra
   * (`CASPER`) não tem dígito nenhum.
   */
  const ehCodigoDoBanco = !/\s/.test(semCauda) && /\d/.test(semCauda)
  if (ehCodigoDoBanco) return ''
  if (!/[a-zA-ZÀ-ú]{3,}/.test(semCauda)) return ''
  return semCauda
}
