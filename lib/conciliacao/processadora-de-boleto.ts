// ⭐⭐⭐ INTERMEDIÁRIO DE BOLETO (11/09/2026) — ordem do dono.
//
// **Ele:** *"aluguel escritório 2.222,81 ↔ PJBANK PAGAMENTOS 2.222,88 (7 centavos, 08/09).
// Linha de processadora não nomeia o beneficiário — pra elas, valor+janela SUGERE com aviso
// ('pagamento via processadora de boleto'), EU confirmo, e o vínculo ensina o padrão
// ('PJBANK costuma ser o boleto do aluguel')."*
//
// ⛔⛔ **POR QUE ISTO PRECISA DE UMA EXCEÇÃO NOMEADA:** o guard do falso-amigo exige que
// ALGUÉM diga quem é o beneficiário — e numa linha de processadora **ninguém pode dizer**,
// por construção: o banco vê a PJBANK, não o dono do imóvel. Sem esta porta, o par do
// aluguel ficaria invisível pra sempre; com ela aberta pra qualquer linha, o falso-amigo
// volta. ⭐ A saída é a **lista fechada**: só quem é reconhecidamente intermediário entra,
// e mesmo assim **com aviso na cara** e sem nunca conciliar sozinho.
//
// ⚠️ Lista em CÓDIGO, editável — a mesma disciplina dos 52 sabores do cardápio: régua nova
// se resolve editando a lista, sem migration e sem backfill.

import { normalizeForMatch } from './normalize-for-match'

/**
 * ⚠️ São processadoras/intermediárias de pagamento: o nome delas na linha diz **por onde** o
 * dinheiro passou, nunca **pra quem** foi.
 */
export const PROCESSADORAS = [
  'PJBANK', 'PAGSEGURO', 'PAGBANK', 'MERCADO PAGO', 'MERCADOPAGO', 'ASAAS', 'IUGU',
  'GERENCIANET', 'EFI', 'VINDI', 'ZOOP', 'CIELO', 'GETNET',
]

/**
 * ⚠️ ATENÇÃO AO VAZIO — e a REGRA 11 me corrigiu aqui.
 *
 * `normalizeForMatch('BOLETO')` devolve **string vazia** (o normalizador apaga o termo
 * comercial), e `'qualquer coisa'.includes('')` é **sempre true**. Eu anunciei isso como um
 * bug que derrubaria o guard do falso-amigo — **e repondo o defeito os 19 testes continuaram
 * VERDES**: o `if (!achada) return null` lá embaixo já barra, porque string vazia é *falsy*.
 *
 * ⭐ O filtro FICA mesmo assim, e o motivo é honesto: hoje a proteção é **acidental** (depende
 * de o vazio ser falsy, coisa que um `findIndex` ou um `!= null` quebrariam sem avisar).
 * Aqui ela é **explícita**. Os termos genéricos saem da lista porque não identificam
 * intermediária nenhuma — "boleto" está em metade das descrições do extrato.
 */
const NORMALIZADAS = PROCESSADORAS.map((p) => normalizeForMatch(p)).filter((p) => p.length >= 3)

/** ⭐ a linha é de uma intermediária? devolve QUAL, pra a frase poder nomeá-la */
export function processadoraDaLinha(descricao: string): string | null {
  const d = normalizeForMatch(descricao)
  const achada = NORMALIZADAS.find((p) => d.includes(p))
  if (!achada) return null
  const i = NORMALIZADAS.indexOf(achada)
  return PROCESSADORAS[i]
}

/**
 * ⭐ A CHAVE DO PADRÃO APRENDIDO: `processadora → o nome da conta`.
 *
 * ⚠️ Normalizada dos dois lados, senão "Aluguel Escritório" e "aluguel escritorio " seriam
 * padrões diferentes e o aprendizado nunca acumularia.
 */
export function chaveDoPadrao(processadora: string, descricaoDaConta: string): string {
  return `${normalizeForMatch(processadora)}→${normalizeForMatch(descricaoDaConta)}`
}

/** ⭐ a frase que a tela mostra — ela DIZ que é palpite de valor, não de nome */
export function avisoDaProcessadora(processadora: string, jaVisto: number): string {
  return jaVisto > 0
    ? `${processadora} costuma ser o boleto desta conta (${jaVisto}× confirmado por você)`
    : `pagamento via processadora de boleto (${processadora}) — ela não diz o beneficiário, confere antes`
}
