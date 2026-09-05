// ⭐⭐ O VOCABULÁRIO FECHADO DOS ENCARGOS DA CONTA ÚNICA (04/09/2026).
//
// Pedido do dono: *"São determinísticos e mensais — eu não deveria classificá-los nunca
// mais."* Continuam **sugestão que ele confirma no lote**, como as regras aprendidas; o que
// muda é ele não precisar ensinar de novo todo mês.
//
// ⭐⭐ A CATEGORIA DE CADA UM É A QUE ELE MESMO MAIS USOU — medido em prod, no histórico da
// conta do Banrisul. Isto não é o sistema escolhendo categoria (o que a casa proíbe): é o
// sistema repetindo a decisão dele.
//
//     IOF                          Tarifas Bancárias 6 × Juros e Encargos 2
//     IOF ADICIONAL                Tarifas Bancárias 3 × Juros e Encargos 1
//     PACOTE SERVICOS              Tarifas Bancárias 3 × (nenhuma outra)
//     JUROS                        Juros e Encargos  1 × (nenhuma outra)
//     TRANSF. ENCARGOS CTA UNICA   Tarifas 1 × Juros e Encargos 1  ← EMPATE
//
// ⚠️ O EMPATE FICA MARCADO, não resolvido no escuro: `empateNaHistoria: true` no
// "TRANSF. ENCARGOS CTA UNICA". Escolhi *Juros e Encargos* pelo nome da própria rubrica
// (encargos da Conta Única), e o script de seed IMPRIME o empate — se ele discordar, troca
// no lote e a regra aprende.
//
// ⛔⛔ POR QUE "IOF" SOZINHO É **EXACT** E NÃO CONTAINS — e este é o detalhe que um teste
// pegou antes de ir pra prod: o ramo CONTAINS casa por SUBSTRING CRUA (e tem que continuar
// casando, senão a regra de 851 aplicações do Sicredi para de morder — ver `predict.ts`).
// Com substring crua, um CONTAINS "IOF" acha **"BIOFARMA"**. Três letras não podem ser
// regra de substring. As formas longas são específicas o bastante pra serem CONTAINS.

export interface RegraDeEncargo {
  /** o histórico como o banco escreve */
  padrao: string
  tipoMatch: 'EXACT' | 'CONTAINS'
  /** nome EXATO da categoria na empresa (o script resolve o id e ABORTA se não achar) */
  categoria: string
  /** por que esta categoria, com o número medido */
  motivo: string
  /** ⚠️ a história do dono empatou — ele confirma no lote */
  empateNaHistoria?: boolean
}

export const REGRAS_DE_ENCARGO: readonly RegraDeEncargo[] = [
  // ⚠️ EXACT: "IOF" tem 3 letras e viraria substring de qualquer palavra com "iof" dentro
  { padrao: 'IOF', tipoMatch: 'EXACT', categoria: 'Tarifas Bancárias', motivo: 'o dono usou Tarifas 6× contra Juros e Encargos 2×' },
  { padrao: 'IOF ADICIONAL', tipoMatch: 'CONTAINS', categoria: 'Tarifas Bancárias', motivo: 'Tarifas 3× contra Juros e Encargos 1× (cobre "IOF ADICIONAL PJ-CH. ESPE-Iof.ADic.")' },
  { padrao: 'IOF BASICO', tipoMatch: 'CONTAINS', categoria: 'Tarifas Bancárias', motivo: 'mesma família do IOF ADICIONAL (cobre "IOF BASICO CH PJ-Iof.BAsic")' },
  { padrao: 'PACOTE SERVICOS', tipoMatch: 'CONTAINS', categoria: 'Tarifas Bancárias', motivo: 'Tarifas 3×, nenhuma outra' },
  { padrao: 'TRANSF. ENCARGOS CTA UNICA', tipoMatch: 'CONTAINS', categoria: 'Juros e Encargos', motivo: 'EMPATE 1×1 na história — desempatei pelo nome da rubrica (encargos da Conta Única)', empateNaHistoria: true },
  // ⚠️ EXACT também: o Banrisul escreve exatamente "JUROS" (medido). Como CONTAINS, o
  // padrão pegaria as linhas do SICREDI ("JUROS UTILIZ.CH.ESPECIAL-ENC162", "JUROS CHEQUE
  // INADIMPLENTE-ENC004") — outro banco, outro vocabulário, e categoria de outro banco não
  // é assunto de um seed do Banrisul.
  { padrao: 'JUROS', tipoMatch: 'EXACT', categoria: 'Juros e Encargos', motivo: 'Juros e Encargos 1×, nenhuma outra; o Banrisul escreve exatamente "JUROS"' },
]

/**
 * ⛔ A TRAVA QUE O TESTE COBRA: padrão CURTO não pode ser CONTAINS.
 *
 * Enquanto o ramo CONTAINS casar por substring crua (e ele TEM que casar, por
 * compatibilidade), padrão de poucas letras é uma armadilha — "IOF" dentro de "BIOFARMA".
 */
export const MINIMO_PARA_CONTAINS = 8

export function padroesCurtosComoContains(regras: readonly RegraDeEncargo[] = REGRAS_DE_ENCARGO): RegraDeEncargo[] {
  return regras.filter((r) => r.tipoMatch === 'CONTAINS' && r.padrao.length < MINIMO_PARA_CONTAINS)
}
