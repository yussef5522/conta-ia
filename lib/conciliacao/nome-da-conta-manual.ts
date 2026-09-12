// ⭐⭐⭐ A CONTA MANUAL TAMBÉM TEM UM NOME (11/09/2026) — ordem do dono.
//
// **Ele:** *"As manuais não têm fornecedor — o matcher passa a casar conta manual pelo NOME
// do favorecido/descrição da conta (canônico, mesma régua)."*
//
// **MEDIDO, os casos que não geravam oferta:**
// ```
// "NC ELETROSUL MONITORAMENTO PATRIMONIAL L"  × conta "eletrosul"   R$ 143,03 × 143,00 → 60 pts
// "CASPER DISTRIBUIDORA DE PRODUTOS ALIMENT"  × conta "casper"      R$ 2.120,81 × 2.113,83 → 60
// ```
// Faltavam **10 pontos** pro corte de 70 — exatamente os 15 do `FORNECEDOR_IGUAL` que uma
// conta sem FK nunca ganha. ⭐ E o nome ESTÁ ali, escrito nos dois lados: o que faltava era
// alguém olhar.
//
// ⛔⛔ **E ISTO NÃO AFROUXA O CORTE — é o oposto.** A mesma função é o que permite o
// **guard do falso-amigo** (`aluguel caçula 5.234,00 × DOCEOLI 5.234,88`): quando dá pra
// perguntar "o nome bate?", dá pra **recusar** quem não bate. Sem ela, a única defesa contra
// o falso-amigo seria o corte numérico — e 70 pontos o par do aluguel já tinha.

import { normalizeForMatch } from './normalize-for-match'

/** ⚠️ palavra curta demais não identifica ninguém: "gas", "luz", "cx" casariam com meio mundo */
const MINIMO_DE_LETRAS = 4

/**
 * ⚠️ palavras que descrevem a NATUREZA do gasto, não QUEM recebeu. Elas aparecem na conta
 * manual ("aluguel caçula", "fgts da rescisao") e nunca na descrição do banco — tentar casar
 * por elas seria casar por assunto, que é palpite.
 */
const GENERICAS = new Set([
  'aluguel', 'salario', 'salarios', 'rescisao', 'fgts', 'inss', 'icms', 'agua', 'luz', 'energia',
  'telefone', 'internet', 'imposto', 'impostos', 'taxa', 'taxas', 'juros', 'multa', 'conta',
  'contas', 'pagamento', 'pagamentos', 'transferencia', 'pix', 'boleto', 'nota', 'parcela',
  'delivery', 'entregador', 'entregadores', 'oficina', 'manutencao', 'material', 'materiais',
])

/** as palavras que IDENTIFICAM alguém, tiradas de um texto livre */
export function palavrasQueIdentificam(texto: string): string[] {
  return normalizeForMatch(texto)
    .split(/\s+/)
    .filter((p: string) => p.length >= MINIMO_DE_LETRAS && !GENERICAS.has(p) && !/^\d+$/.test(p))
}

export interface NomeCompativel {
  /** a palavra que apareceu dos DOIS lados */
  palavra: string
  /** quantas palavras identificadoras a conta tem (contexto pra quem lê a frase) */
  deQuantas: number
}

/**
 * ⭐ O nome da CONTA aparece na descrição da LINHA?
 *
 * ⚠️ É contenção de palavra INTEIRA, não substring solta: `normalizeForMatch` já tira
 * pontuação e caixa, e comparar token a token evita o `CC` dentro de `ACCOUNT` — a mesma
 * lição da borda de palavra que o cardápio pagou em 08/09 (`AGUA` dentro de `GUARDANAPO`).
 *
 * ⛔ Devolve `null` quando a conta **não tem palavra identificadora nenhuma** ("aluguel
 * caçula" é só natureza + apelido da loja): aí ninguém pode afirmar compatibilidade, e
 * afirmar seria exatamente o falso-amigo.
 */
export function nomeDaContaBateComALinha(
  descricaoDaConta: string, descricaoDaLinha: string,
): NomeCompativel | null {
  const daConta = palavrasQueIdentificam(descricaoDaConta)
  if (!daConta.length) return null
  const daLinha = new Set(normalizeForMatch(descricaoDaLinha).split(/\s+/))
  const achada = daConta.find((p) => daLinha.has(p))
  return achada ? { palavra: achada, deQuantas: daConta.length } : null
}
