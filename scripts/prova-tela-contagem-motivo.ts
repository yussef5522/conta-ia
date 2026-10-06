/**
 * ⭐⭐ REGRA 12 — a pergunta do motivo na TELA, nos DOIS viewports (05/10/2026).
 *
 * ⛔ A trava é do SERVIDOR (409 `MOTIVO_DO_NEGATIVO`), mas a PERGUNTA tem que chegar no dedo
 * de quem conta — senão a lei vira um 409 mudo. Então a prova é o que o BUNDLE que prod serve
 * carrega: o tratamento do 409, os botões vindos do servidor (`motivo.motivos`) e o escape.
 *
 * ⚠️ Mede no BUNDLE, não no meu código-fonte: a tela é `'use client'` e as frases vivem no
 * chunk JS. ⚠️ E o minificador escapa não-ASCII (`produ\xe7\xe3o`), então procuro as DUAS formas.
 *
 * ⛔ READ-ONLY: só GET. Contar é gesto do dono.
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { signToken } from '../lib/auth'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

/** ⚠️ as duas formas: UTF-8 cru e o escape que o minificador produz */
function presente(js: string, frase: string): boolean {
  if (js.includes(frase)) return true
  const esc = [...frase]
    .map((c) => (c.charCodeAt(0) > 127 ? `\\x${c.charCodeAt(0).toString(16)}` : c))
    .join('')
  return js.includes(esc)
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`
  const url = `${BASE}/empresas/${CO}/estoque/contagem`

  const exigidas: [string, string][] = [
    ['o 409 da pergunta', 'MOTIVO_DO_NEGATIVO'],
    ['os botões vêm do SERVIDOR', 'motivos'],
    ['o escape explícito', 'deixar pra depois'],
    /**
     * ⭐ a tela DESENHA a frase do servidor (`j.erro`) e os botões dele.
     * ⚠️⚠️ ANCORADO NA PROPRIEDADE, não na variável: o minificador RENOMEIA `motivo` (a
     * cicatriz de 27/09, quando procurei `t.selo` num bundle minificado). Nome de propriedade
     * sobrevive; nome de variável local, não.
     */
    ['a frase do servidor é desenhada', '.msg'],
    ['os botões do servidor são desenhados', '.motivos.map('],
  ]

  /**
   * ⚠️⚠️ ERRO DA MINHA 1ª SONDA, REGISTRADO: eu procurei **"vai entrar"** no bundle e deu
   * vermelho. A frase está CERTA e **não mora na tela** — ela é montada no SERVIDOR
   * (`fraseDoMotivo`) e desce no corpo do 409. Procurá-la aqui é medir no lugar errado, a mesma
   * armadilha de 05/10 na modal de conclusão. ⭐ O que a tela NÃO pode ter é uma CÓPIA dela:
   * duas redações da mesma pergunta divergiriam na 1ª ajustada.
   */
  const proibidas: [string, string][] = [
    ['nenhuma cópia da frase do servidor', 'vai entrar e virar o saldo'],
  ]

  for (const [nome, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(url, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0])
    const js = (await Promise.all([...new Set(chunks)].map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')
    console.log(`\n── ${nome.toUpperCase()} · PAGE ${r.status} em ${Date.now() - t0}ms · ${chunks.length} chunks · ${(js.length / 1024).toFixed(0)} KB`)
    for (const [rotulo, frase] of exigidas) {
      console.log(`   ${presente(js, frase) ? '✓' : '⛔'} ${rotulo} ("${frase}")`)
    }
    for (const [rotulo, frase] of proibidas) {
      console.log(`   ${presente(js, frase) ? '⛔' : '✓'} ${rotulo} ("${frase}")`)
    }
  }
}

main()
  .catch((e) => {
    console.error('⛔', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
