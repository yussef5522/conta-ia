// ⭐ GERADOR DA 2ª FIXTURE DO BANRISUL PF — a fatura de SETEMBRO (10/09/2026).
//
// **O dono:** *"esta fatura vira SEGUNDA FIXTURE do Banrisul PF (meses diferentes, layouts
// que variam — **o golden de um mês não congela o banco no tempo**), no servidor, pelo
// extractPdfText, como a regra nova manda."*
//
// ⛔ Ele está certo e o custo já apareceu: o layout de setembro trouxe uma coluna da
// direita com **2 lançamentos** (a de agosto tinha muitos) e um rótulo de encargo novo
// (`IOF sobre operações de crédito`) que agosto não tem. Um golden só teria dito "verde"
// enquanto a fatura do mês era recusada.
//
// ⚠️ TROCAS DO MESMO COMPRIMENTO — a geometria (calha de duas colunas) é o que está sendo
// testado, e uma troca de tamanho diferente MOVE a calha.
// ⭐ E o script se confere: roda o parser antes e depois e aborta se um número mudar.

import { readFileSync, writeFileSync } from 'node:fs'
import { extractPdfText } from '../lib/bank-statement-pdf/extract-pdf-text'
import { parseBanrisulFaturaPF } from '../lib/fatura-banrisul/banrisul-fatura-pf'

async function main() {
  const PDF = process.argv[2]
  const SAIDA = process.argv[3] ?? 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf-setembro.txt'
  if (!PDF) { console.error('uso: tsx scripts/gerar-fixture-banrisul-pf.ts <pdf> [saida]'); process.exit(1) }

  /** [de, para] — mesmo comprimento, sempre */
  const TROCAS: [string, string][] = [
    ['600.258.890-60', '000.000.000-00'],
    ['97650-000 ITAQUI - RS', '00000-000 CIDADE - RS'],
    ['04192.10109 02742.629112 75490.640853 4 00000000000000',
     '00000.00000 00000.000000 00000.000000 0 00000000000000'],
    ['11754906-35', '00000000-00'],
  ]

  // ⭐ o MESMO extrator da rota — nunca `pdftotext` na mão (a lição de 09/09: o golden
  // fechava e a tela não, porque a fixture saía de outro poppler).
  const texto = await extractPdfText(readFileSync(PDF))
  const antes = parseBanrisulFaturaPF(texto)

  let saida = texto
  for (const [de, para] of TROCAS) {
    if (de.length !== para.length) throw new Error(`⛔ troca de tamanho diferente: "${de}" → "${para}"`)
    saida = saida.split(de).join(para)
  }

  const depois = parseBanrisulFaturaPF(saida)
  const igual = (a: unknown, b: unknown, o: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`⛔ a anonimização MUDOU ${o}:\n   antes:  ${JSON.stringify(a)}\n   depois: ${JSON.stringify(b)}`)
    }
  }
  igual(antes.extraction.lines?.length, depois.extraction.lines?.length, 'a quantidade de linhas')
  igual(antes.computed, depois.computed, 'os totais computados')
  igual(antes.declared, depois.declared, 'os declarados do resumo')
  igual(antes.proximas, depois.proximas, 'as próximas faturas')

  writeFileSync(SAIDA, saida)
  console.log(`✓ fixture em ${SAIDA}`)
  console.log(`   ${depois.extraction.lines?.length} linhas · brasil ${depois.computed.sumPositives} × declarado ${depois.declared.brasil}`)
  console.log(`   estornos ${depois.computed.sumEstornos} · saldo declarado ${depois.declared.saldoAtual}`)
  console.log(`   portadores ${JSON.stringify(depois.extraction.cardLastDigitsFound)} · venc ${depois.extraction.dueDate}`)
}

main().catch((e) => { console.error(String(e)); process.exit(1) })
