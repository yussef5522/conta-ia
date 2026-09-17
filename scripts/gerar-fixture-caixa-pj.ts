// ⭐⭐⭐ GERADOR DO GOLDEN DA CAIXA PJ — a fatura RICA (17/09/2026).
//
// **O dono:** *"congela ESTE PDF como golden do parser da Caixa (fatura real com rotativo,
// multa, mora, cashback e estornos — rica de casos)"*. E ele veio pelo caminho novo: o texto
// é o que o motor leu **em produção**, guardado pela quarentena com desfecho **OK** —
// exatamente a promessa de que *"a que FECHOU é o golden de amanhã"*.
//
// ⚠️ TROCAS DO MESMO COMPRIMENTO — o parser da Caixa lê por **coluna** (corte ~96, sufixo
// D/C no fim do valor), então trocar por texto de outro tamanho move a coluna e a fixture
// passa a testar um documento que não existe.
//
// ⛔⛔ E AS PALAVRAS QUE O PARSER USA PRA DECIDIR NÃO SE ANONIMIZAM — já mordeu duas vezes
// nesta casa (26/08 o anonimizador comeu "PAGAMENTO" e o parser divergiu em 8.736,17; 31/08
// comeu os nomes dos MESES e a seção de próximas faturas sumiu). O script **roda o parser
// antes e depois e aborta se um número mudar**.

import { readFileSync, writeFileSync } from 'node:fs'
import { parseCaixaFatura } from '../lib/credit-card-pj/deterministic/caixa-fatura-parser'
import { validateCaixaFatura } from '../lib/credit-card-pj/deterministic/validate-caixa-fatura'
import { escolherParser } from '../lib/credit-card-pj/extract-invoice-smart'

/** tudo que o parser, o validador ou o registry LEEM pra decidir — intocável */
const PRESERVAR = new Set([
  'caixa', // o registry escolhe o parser por isto
  'total', 'da', 'fatura', 'anterior', 'valor', 'desta', 'obrigado', 'pelo', 'pagamento',
  'demonstrativo', 'compras', 'parceladas', 'anuidade', 'outros', 'data', 'descrição',
  'final', // ⚠️ "Total final (cartão XXXX)" — o gerador pegou esta faltando
  'descricao', 'titular', 'cartão', 'cartao', 'crédito', 'credito', 'débito', 'debito',
  'original', 'cotação', 'cotacao', 'de',
  // rótulos de encargo que a leitura classifica
  'rotativo', 'multa', 'mora', 'juros', 'encargos', 'iof', 'cashback', 'estorno',
  // meses, por precaução (a lição de 31/08)
  'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
])

const BASES = ['HOT', 'CAFECA', 'RESTA', 'PADARIA', 'FARM', 'MERCADOME', 'LOJALOJA', 'POSTOPOSTO']

/** preenchimento do TAMANHO EXATO, estável por palavra */
function encher(p: string): string {
  let h = 0
  for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const base = BASES[h % BASES.length]
  let out = ''
  while (out.length < p.length) out += base
  out = out.slice(0, p.length)
  if (p === p.toLowerCase()) return out.toLowerCase()
  if (p[0] === p[0].toUpperCase() && p.slice(1) === p.slice(1).toLowerCase()) {
    return out[0] + out.slice(1).toLowerCase()
  }
  return out
}

function anonimizar(texto: string): string {
  return texto.replace(/[A-Za-zÀ-ÿ]{3,}/g, (w) => (PRESERVAR.has(w.toLowerCase()) ? w : encher(w)))
}

function main() {
  const ENTRADA = process.argv[2]
  const SAIDA = process.argv[3] ?? 'lib/credit-card-pj/deterministic/__tests__/fixtures/caixa-fatura-rica.txt'
  if (!ENTRADA) {
    console.error('uso: tsx scripts/gerar-fixture-caixa-pj.ts <texto-da-quarentena> [saida]')
    process.exit(1)
  }

  const texto = readFileSync(ENTRADA, 'utf-8')
  const antes = parseCaixaFatura(texto)
  const bancoAntes = escolherParser(texto)?.bank
  const vAntes = validateCaixaFatura(antes as never)

  const saida = anonimizar(texto)

  const depois = parseCaixaFatura(saida)
  const bancoDepois = escolherParser(saida)?.bank
  const vDepois = validateCaixaFatura(depois as never)

  const igual = (a: unknown, b: unknown, o: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`⛔ a anonimização MUDOU ${o}:\n   antes:  ${JSON.stringify(a)}\n   depois: ${JSON.stringify(b)}`)
    }
  }
  igual(bancoAntes, bancoDepois, 'o banco reconhecido pelo registry')
  igual((antes as { declared?: unknown }).declared, (depois as { declared?: unknown }).declared, 'os declarados')
  igual(antes.extraction.lines?.length, depois.extraction.lines?.length, 'a quantidade de linhas')
  igual(antes.extraction.lines?.map((l) => l.amount), depois.extraction.lines?.map((l) => l.amount), 'os valores das linhas')
  igual(antes.extraction.lines?.map((l) => l.suggestedKind), depois.extraction.lines?.map((l) => l.suggestedKind), 'a classificação das linhas')
  igual(vAntes.ok, vDepois.ok, 'o veredito da validação')

  // ⚠️ e o comprimento de CADA linha — a Caixa lê por COLUNA
  igual(texto.split('\n').map((l) => l.length), saida.split('\n').map((l) => l.length),
    'o comprimento das linhas (a geometria das colunas)')

  writeFileSync(SAIDA, saida)
  const d = (depois as { declared?: Record<string, unknown> }).declared ?? {}
  console.log(`✓ fixture em ${SAIDA}`)
  console.log(`   banco ${bancoDepois} · ${depois.extraction.lines?.length} linhas · validação ok=${vDepois.ok}`)
  console.log(`   declarados: ${JSON.stringify(d)}`)
}

main()
