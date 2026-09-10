// ⭐ GERADOR DA FIXTURE DA FATURA ITAÚ/LUIZACRED (09/09/2026).
//
// ⛔⛔ **AS SUBSTITUIÇÕES SÃO DO MESMO COMPRIMENTO, SEMPRE.** Nesta fatura a GEOMETRIA é o
// que está sendo testado (duas colunas detectadas por calha): trocar um nome por outro de
// tamanho diferente **move a calha** e a fixture passa a testar um documento que não
// existe. É a armadilha do anonimizador de 26/08 e 31/08 numa terceira roupa.
//
// ⚠️ O que sai: o nome da SEGUNDA portadora (terceiro — dado pessoal sob LGPD), CPF,
// endereço, CEP, os números de documento/código de barras e o BIN do cartão. O que FICA:
// o nome do próprio dono (mesmo critério da fixture do Nubank), os finais dos cartões (o
// parser decide por eles), os estabelecimentos (com as parcelas coladas, que são o caso
// de teste) e todos os rótulos.
//
// ⭐ E O SCRIPT SE CONFERE: ele roda o parser ANTES e DEPOIS e **aborta** se qualquer
// número mudar. Palavra que decide não se anonimiza — e aqui isso é medido, não prometido.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { parseItauFaturaPF, conferirItau } from '../lib/fatura-itau/parser'

const PDF = process.argv[2]
const SAIDA = process.argv[3] ?? 'lib/fatura-itau/__tests__/fixtures/itau-luizacred-pf.txt'
if (!PDF) { console.error('uso: tsx scripts/gerar-fixture-itau.ts <pdf> [saida]'); process.exit(1) }

/** [de, para] — o `para` TEM que ter o mesmo comprimento do `de` */
const TROCAS: [string, string][] = [
  ['DANIELA LEITE O', 'MARIA DA SILVA '],
  // ⚠️ nome de PESSOA FÍSICA como estabelecimento (um Pix a alguém) — contraparte é dado
  // pessoal de terceiro, e este arquivo vai pro repositório.
  ['FLAVIA SOUZA DOS S', 'VENDEDOR PESSOA AB'],
  ['600.258.890-60', '000.000.000-00'],
  ['D PEDRO II 1300', 'RUA DAS FLORES'.padEnd(15)],
  ['97650-000 ITAQUI - RS', '00000-000 CIDADE - RS'],
  ['5485.XXXX.XXXX.2971', '0000.XXXX.XXXX.2971'],
  ['00523160166/0122869', '00000000000/0000000'],
  ['175/23160166-9', '000/00000000-0'],
  ['34191.75231 16016.692044 00168.710002 1 00000000000000',
   '00000.00000 00000.000000 00000.000000 0 00000000000000'],
  ['2040/01687-1', '0000/00000-0'],
]

const texto = execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf-8', maxBuffer: 1 << 24 })
const antes = parseItauFaturaPF(texto)

let saida = texto
for (const [de, para] of TROCAS) {
  if (de.length !== para.length) throw new Error(`⛔ troca de tamanho diferente: "${de}" (${de.length}) → "${para}" (${para.length}) — isso MOVE a calha`)
  saida = saida.split(de).join(para)
}

const depois = parseItauFaturaPF(saida)
const igual = (a: unknown, b: unknown, o: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`⛔ a anonimização MUDOU ${o}:\n   antes:  ${JSON.stringify(a)}\n   depois: ${JSON.stringify(b)}`)
  }
}
igual(antes.linhas.length, depois.linhas.length, 'a quantidade de lançamentos')
igual(antes.computed, depois.computed, 'a soma dos lançamentos')
igual(antes.declared, depois.declared, 'os declarados do resumo')
igual(antes.cartoes.map((c) => [c.final, c.declarado, c.somado]),
      depois.cartoes.map((c) => [c.final, c.declarado, c.somado]), 'os subtotais por cartão')
igual(antes.proximas, depois.proximas, 'as próximas faturas')

writeFileSync(SAIDA, saida)
const c = conferirItau(depois)
console.log(`✓ fixture em ${SAIDA}`)
console.log(`   ${depois.linhas.length} lançamentos · Σ ${c.lancamentos} · declarado ${c.declarado} · fecha ${c.fecha}`)
console.log(`   cartões: ${depois.cartoes.map((x) => `${x.final} ${x.somado}/${x.declarado} ${x.fecha ? '✓' : '✗'}`).join(' · ')}`)
console.log(`   total recomposto ${c.totalRecomposto} × declarado ${c.totalDeclarado} · fecha ${c.totalFecha}`)
