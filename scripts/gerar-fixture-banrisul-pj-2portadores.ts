// ⭐⭐⭐ GERADOR DO GOLDEN DO BANRISUL **PJ COM DOIS PORTADORES** (17/09/2026).
//
// **A fatura que recusou três vezes**, e a primeira que entra na suíte pelo caminho novo:
// **quarentena → teste**. O texto não veio de um `pdftotext` meu — veio do registro
// `cmu4xpfv00064z0ci36uz0q8n`, que é **exatamente o que o motor leu em produção** quando
// recusou. É a régua do dono: *"correção de parser só é aceita com o texto real do caso na
// suíte; reconstrução nunca mais vira prova"*.
//
// ⚠️ TROCAS DO MESMO COMPRIMENTO, SEMPRE — a geometria (calha de duas colunas, aresta do
// dinheiro) é justamente o que está sendo testado, e uma troca de tamanho diferente **move
// a coluna** e passa a testar um documento que não existe.
//
// ⛔⛔ E AS PALAVRAS QUE O PARSER USA PRA DECIDIR NÃO SE ANONIMIZAM. Já mordeu duas vezes
// nesta casa: em 26/08 o anonimizador comeu `"PAGAMENTO"` e o parser divergiu em 8.736,17;
// em 31/08 comeu os nomes dos MESES e a seção "Próximas Faturas" sumiu. Por isso a
// `PRESERVAR` abaixo — e por isso o script **roda o parser antes e depois e aborta se um
// número mudar**.

import { readFileSync, writeFileSync } from 'node:fs'
import { parseBanrisulFatura } from '../lib/credit-card-pj/deterministic/banrisul-fatura-parser'
import { escolherParser } from '../lib/credit-card-pj/extract-invoice-smart'

/** tudo que o parser, o validador ou o registry LEEM pra decidir — intocável */
const PRESERVAR = new Set([
  // identidade do banco (o registry escolhe o parser por isto)
  'banrisul', 'banricompras', 'banriclube',
  // rótulos do resumo que viram os declarados
  'total', 'fatura', 'anterior', 'atual', 'saldo', 'despesas', 'débitos', 'debitos',
  'brasil', 'pagamentos', 'créditos', 'creditos', 'gastos', 'convertido', 'reais',
  'encargos', 'rotativo', 'saque', 'pagamento', 'contas', 'operações', 'operacoes',
  'crédito', 'credito', 'iof', 'sobre', 'transações', 'transacoes', 'exterior',
  'vencimento', 'período', 'periodo',
  // marcadores de estrutura
  'histórico', 'historico', 'titular',
  // dialeto da linha
  'anuidadeint', 'anuid', 'desc', 'difer', 'deb', 'dólar', 'dolar',
  // meses (a seção de próximas faturas casa por nome de mês)
  'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
])

/** vocabulário genérico — o mesmo estilo das outras fixtures da casa */
const BASES = ['HOT', 'CAFECA', 'RESTA', 'PADARIA', 'FARM', 'MERCADOME', 'LOJALOJA', 'POSTOPOSTO']

/** um preenchimento do TAMANHO EXATO, estável por palavra (o mesmo nome vira sempre o mesmo) */
function encher(palavra: string): string {
  let h = 0
  for (const ch of palavra) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const base = BASES[h % BASES.length]
  let out = ''
  while (out.length < palavra.length) out += base
  out = out.slice(0, palavra.length)
  // preserva a CARA da palavra (minúscula/Capitalizada) pra o documento seguir legível
  if (palavra === palavra.toLowerCase()) return out.toLowerCase()
  if (palavra[0] === palavra[0].toUpperCase() && palavra.slice(1) === palavra.slice(1).toLowerCase()) {
    return out[0] + out.slice(1).toLowerCase()
  }
  return out
}

function anonimizar(texto: string): string {
  return texto.replace(/[A-Za-zÀ-ÿ]{3,}/g, (w) => (PRESERVAR.has(w.toLowerCase()) ? w : encher(w)))
}

function main() {
  const ENTRADA = process.argv[2]
  const SAIDA = process.argv[3] ?? 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-2-portadores.txt'
  if (!ENTRADA) {
    console.error('uso: tsx scripts/gerar-fixture-banrisul-pj-2portadores.ts <texto-da-quarentena> [saida]')
    process.exit(1)
  }

  const texto = readFileSync(ENTRADA, 'utf-8')
  const antes = parseBanrisulFatura(texto)
  const bancoAntes = escolherParser(texto)?.bank

  const saida = anonimizar(texto)

  // ⛔ o script se confere: se a anonimização mexeu em QUALQUER número, ela está errada
  const depois = parseBanrisulFatura(saida)
  const bancoDepois = escolherParser(saida)?.bank
  const igual = (a: unknown, b: unknown, o: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`⛔ a anonimização MUDOU ${o}:\n   antes:  ${JSON.stringify(a)}\n   depois: ${JSON.stringify(b)}`)
    }
  }
  igual(bancoAntes, bancoDepois, 'o banco reconhecido pelo registry')
  igual(antes.computed, depois.computed, 'os totais computados')
  igual(antes.declared, depois.declared, 'os declarados do resumo')
  igual(antes.extraction.lines?.length, depois.extraction.lines?.length, 'a quantidade de linhas')
  igual(antes.extraction.cardLastDigitsFound, depois.extraction.cardLastDigitsFound, 'os portadores')
  igual(antes.extraction.dueDate, depois.extraction.dueDate, 'o vencimento')

  // ⚠️ e o comprimento de CADA linha tem que sobreviver — é a geometria que está sob teste
  const la = texto.split('\n').map((l) => l.length)
  const lb = saida.split('\n').map((l) => l.length)
  igual(la, lb, 'o comprimento das linhas (a geometria das colunas)')

  writeFileSync(SAIDA, saida)
  console.log(`✓ fixture em ${SAIDA}`)
  console.log(`   banco ${bancoDepois} · ${depois.extraction.lines?.length} linhas · portadores ${JSON.stringify(depois.extraction.cardLastDigitsFound)}`)
  console.log(`   brasil lido ${depois.computed.sumBrasil} × declarado ${depois.declared.brasil}`)
  console.log(`   TOTAL DE GASTOS ${depois.declared.totalGastos} · saldo atual ${depois.declared.saldoAtual}`)
}

main()
