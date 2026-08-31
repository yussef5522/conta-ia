// ⛔⛔ O FALLBACK SILENCIOSO QUE FEZ O DONO CAÇAR A COISA ERRADA (31/08/2026).
//
// CASO REAL: ele criou um cartão Nubank, subiu a fatura do Nubank, e o sistema aplicou os
// **regex do Banrisul** no documento — porque o caminho PF chamava
// `parseBanrisulFaturaPF(texto)` DIRETO, sem perguntar de que banco era o PDF, e depois
// maquiava com `detectedBank ?? 'Banrisul'`. A falha saiu como
// *"o PDF não declarou o total (layout inesperado)"* — ou seja, **"banco não reconhecido"
// vestido de "o Banrisul mudou o layout"**. Ele foi procurar mudança de layout que não
// existia.
//
// ⚠️ NÃO FOI UM `??` MAL COLOCADO: o caminho PF nasceu com UM banco só e nunca ganhou a
// porta que o PJ tem (`extract-invoice-smart.ts` tem registry com `match` por banco desde
// sempre — Sicredi, Banrisul, Caixa, Mercado Pago). O PF tinha 1 de 5 layouts provados e
// nenhuma porta. Este arquivo é a porta.
//
// ⭐ MESMO PADRÃO DO PJ E DOS `bank-profiles`: adicionar banco = adicionar objeto. Banco
// que não casa **não é processado** — devolve null, e quem chamou dá o erro certo.

import { parseBanrisulFaturaPF } from '@/lib/fatura-banrisul/banrisul-fatura-pf'
import { parseNubankFaturaPF } from '@/lib/fatura-nubank/parser'

export interface ParserFaturaPF {
  banco: string
  /** casa no CONTEÚDO do PDF, nunca no nome que o dono deu ao cartão — cartão pode se
   *  chamar "meu cartão", e o nome do cadastro não prova de quem é o documento. */
  match: RegExp
  parse: (texto: string) => unknown
}

export const PARSERS_FATURA_PF: ParserFaturaPF[] = [
  {
    banco: 'Banrisul',
    // ⚠️⚠️ DOIS SINAIS, e o segundo não é preguiça — é o que impede este registry de
    // QUEBRAR o único import que funciona.
    //
    // A marca ("Banrisul") é o sinal natural. Mas o único artefato que eu tenho do PDF
    // real é a fixture ANONIMIZADA, e o anonimizador raspou TODAS as marcas de marca (o
    // cabeçalho virou "PADARIA? CAFECA"). Ou seja: **não dá pra provar daqui que o PDF
    // real traz a palavra**. Casar só por ela seria apostar o import que já roda.
    //
    // O 2º sinal é o rótulo do resumo que o parser JÁ depende pra ler — se ele existe, o
    // parser consegue ler; se não existe, não conseguiria de qualquer jeito. É
    // Banrisul-específico: o Nubank escreve "RESUMO DA FATURA ATUAL" e "Total a pagar",
    // que não casam com "Saldo da fatura atual".
    //
    // ⚠️ É a armadilha da fixture anonimizada de 26/08 mordendo de novo, agora ao
    // contrário: naquela vez o anonimizador comeu palavras que o parser LIA; aqui comeu a
    // palavra que o parser passou a usar pra DECIDIR. **Toda palavra usada pra decidir
    // tem que sobreviver à anonimização — ou a decisão não pode depender só dela.**
    match: /banrisul|saldo da fatura atual/i,
    parse: parseBanrisulFaturaPF,
  },
  {
    banco: 'Nubank',
    // ⚠️ três sinais que o dono contou no documento real: "Nubank" (2×), "Nu Pagamentos"
    // (1×) e "RESUMO DA FATURA ATUAL" (1×). O último é o rótulo estrutural — e ele NÃO
    // casa com o "Saldo da fatura atual" do Banrisul, que é o que mantém os dois separados.
    match: /nubank|nu\s+pagamentos|RESUMO DA FATURA ATUAL/i,
    parse: parseNubankFaturaPF,
  },
]

/** os bancos que o PF sabe ler HOJE — a mensagem de erro cita esta lista, não uma fixa */
export const BANCOS_SUPORTADOS_PF = PARSERS_FATURA_PF.map((p) => p.banco)

/**
 * De que banco é este PDF?
 *
 * ⚠️ Devolve **null** quando não reconhece — e null é uma resposta, não um erro a ser
 * engolido. Chutar um parser sobre documento desconhecido é o que produziu o caso do
 * Nubank: o parser roda, não acha nada, e a falha mente sobre a causa.
 */
export function reconhecerBancoPF(texto: string): ParserFaturaPF | null {
  return PARSERS_FATURA_PF.find((p) => p.match.test(texto)) ?? null
}

// ---------------------------------------------------------------------------
// ⭐⭐ AS TRÊS FALHAS, COM NOME PRÓPRIO
// ---------------------------------------------------------------------------
//
// ⚠️ "Alarme falso repetido mata o alarme" vale também pra MENSAGEM: se toda falha diz a
// mesma coisa, o dono para de ler o texto e passa a chutar a causa. Aqui cada estado tem
// a sua frase, e cada frase diz **o que fazer**.

export type CausaFalhaImport =
  | 'BANCO_NAO_RECONHECIDO'
  | 'SEM_TOTAIS_DECLARADOS'
  | 'LINHAS_NAO_LIDAS'
  | 'NAO_FECHA'

export interface DiagnosticoImport {
  causa: CausaFalhaImport
  mensagem: string
}

export interface EstadoDaLeitura {
  banco: string | null
  /** quantas linhas de lançamento o parser conseguiu ler */
  linhas: number
  /** o total declarado — do PDF ou digitado pelo dono (ver `origem-total`) */
  temTotalDeclarado: boolean
  /** os números batem dentro da tolerância? */
  fecha: boolean
  /** detalhe numérico pra anexar quando NÃO fecha (lido × declarado, ao centavo) */
  detalhe?: string
}

/**
 * PURA. Estado → causa + frase. Uma decisão, um lugar (REGRA 4): a rota, o preview e o
 * confirm dizem a MESMA coisa sobre a MESMA falha.
 */
export function diagnosticarFalha(e: EstadoDaLeitura): DiagnosticoImport | null {
  // 1. não sei de que banco é o documento — a causa do caso Nubank
  if (!e.banco) {
    return {
      causa: 'BANCO_NAO_RECONHECIDO',
      mensagem:
        'Não reconheci este PDF como fatura de nenhum banco que eu saiba ler. ' +
        `Hoje eu leio: ${BANCOS_SUPORTADOS_PF.join(', ')}. ` +
        'Confira se o arquivo é a fatura do cartão (e não o extrato da conta) — ' +
        'e me avise de qual banco é, que eu passo a ler.',
    }
  }

  // 2. é do banco certo, mas o documento não traz os totais do resumo
  if (!e.temTotalDeclarado) {
    return {
      causa: 'SEM_TOTAIS_DECLARADOS',
      mensagem:
        `Reconheci como fatura ${e.banco}, mas não achei os totais do resumo neste PDF ` +
        '(pode ser um layout novo, ou um recorte da fatura). ' +
        'Você pode digitar o total olhando a fatura — a conferência roda igual, ' +
        'e fica registrado que o número veio de você.',
    }
  }

  // 3. os totais estão lá, mas nenhuma linha foi lida — é o parser, não o documento
  if (e.linhas === 0) {
    return {
      causa: 'LINHAS_NAO_LIDAS',
      mensagem:
        `Achei os totais da fatura ${e.banco}, mas não consegui ler nenhum lançamento. ` +
        'Isso é limitação da minha leitura deste layout, não erro do arquivo — ' +
        'me manda o PDF que eu ajusto.',
    }
  }

  // 4. leu tudo e os números não batem — NUNCA importa (o selo é o que segura o módulo)
  if (!e.fecha) {
    return {
      causa: 'NAO_FECHA',
      mensagem:
        'A fatura NÃO fecha com o total declarado — nada será importado.\n' +
        (e.detalhe ?? '') +
        '\nFalta ou sobra lançamento na minha leitura. Não importo com diferença.',
    }
  }

  return null
}
