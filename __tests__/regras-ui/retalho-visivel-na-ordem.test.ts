/**
 * ⭐⭐⭐ O RETALHO APARECE NA PÁGINA DA ORDEM (12/10/2026) — guard dos passos 1 e 2.
 *
 * **O defeito do dono, com os números dele:** ordem de **10 UN** de *metade de bolinha massa de
 * pizza* declarando **10 KG** de retalho de ontem. A página mostrava *"deve sair ~12 UN (pela
 * sua média)"* e **nenhum sinal do retalho**. A pergunta foi *"não era certo mudar a quantidade
 * que eu pedi?"* — a resposta da casa é **NÃO** (o pedido comanda a separação; o retalho não
 * gasta material da câmara), **mas o retalho tinha que APARECER**.
 *
 * ⭐ O passo 0 (perícia, só leitura) achou os **10 KG GRAVADOS** na ordem `cmv5nzj24…` — então o
 * buraco era de **EXIBIÇÃO**, e por isso este guard é de TELA e de ROTA, não de dado.
 *
 * ⚠️ **ESTRUTURAL e assumido como tal** (o projeto roda em `environment: node`, sem jsdom): o
 * que dá pra provar por COMPORTAMENTO mora nas libs — `retalho-visivel.test.ts` EXECUTA a linha
 * e a frase, e `retalho.integration.test.ts` executa a composição contra banco em cada estado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'
const ROTA = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/route.ts'
const ROTA_PEDIDO = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/pedido/route.ts'
const PORTA = 'lib/stock/producao/confirmar-pedido.ts'
const LIB = 'lib/stock/producao/retalho.ts'

const tela = () => semComentarios(ler(ORDEM))
const rota = () => semComentarios(ler(ROTA))

// ───────────────── PASSO 1: o retalho é visível ─────────────────

describe('⛔⛔⛔ PASSO 1 — o retalho não volta a ser invisível', () => {
  /**
   * ⛔⛔ **A CAUSA EXATA DO DEFEITO: a rota só consultava o retalho em `PLANEJADA`.** A versão
   * de 11/10 fazia `const cfgRetalho = planejada ? (await configDeRetalho(...)) : undefined` —
   * *"pra não pagar 2 queries em toda abertura de ordem"*. O efeito foi o retalho invisível em
   * **todos** os outros estados, e a ordem do dono estava CANCELADA.
   *
   * ⚠️ A régua aqui é ESTRUTURAL de propósito: as duas leituras não podem estar atrás do
   * ternário do estado. A leitura CARA (`ultimoRetalhoDaFicha`, que varre as 50 últimas ordens)
   * **pode** — ela é o lembrete do campo de digitar, e campo só existe em PLANEJADA.
   */
  it('⛔⛔ a rota lê config e declarado em TODO estado, não só em PLANEJADA', () => {
    const r = rota()
    const trecho = r.slice(r.indexOf('const planejada ='), r.indexOf('return NextResponse.json'))
    expect(trecho, 'a rota monta o retalho depois de decidir o estado').toBeTruthy()
    for (const f of ['configDeRetalho(', 'retalhoDasOrdens(']) {
      const i = trecho.indexOf(f)
      expect(i, `${f} é chamada`).toBeGreaterThan(0)
      /** ⛔ nada de `planejada ? ... configDeRetalho` / `planejada &&` imediatamente antes */
      const antes = trecho.slice(Math.max(0, i - 120), i)
      expect(antes, `${f} não pode ficar atrás do estado`).not.toMatch(/planejada\s*(\?|&&)/)
    }
    /** ⭐ e a CARA continua gateada — o guard não afrouxa o que era certo */
    const iCara = trecho.indexOf('ultimoRetalhoDaFicha(')
    expect(iCara, 'o lembrete continua existindo').toBeGreaterThan(0)
    expect(trecho.slice(Math.max(0, iCara - 120), iCara), 'e segue atrás de PLANEJADA').toMatch(/planejada\s*&&/)
  })

  /** ⛔ e o `declaradoKg` tem que VIAJAR: dado que a tela não recebe é linha que não existe */
  it('⛔ o payload manda `declaradoKg` quando a receita aceita', () => {
    expect(rota()).toMatch(/declaradoKg:/)
  })

  /**
   * ⛔⛔ **O VERMELHO Nº 1: a linha do retalho DENTRO do bloco do pedido.** Ela é o que o dono
   * procurou e não achou — e ela mora no cabeçalho, junto do *"10 UN pedidas"*, porque é ali
   * que ele lê o tamanho do lote.
   */
  it('⛔⛔ a tela DESENHA a linha do retalho no bloco do pedido', () => {
    const t = tela()
    const iPedido = t.indexOf("pedido.origem === 'DECLARADO' ? 'pedidas' : 'esperadas'")
    expect(iPedido, 'o bloco do PEDIDO existe').toBeGreaterThan(0)
    const iLinha = t.indexOf('{linhaRet && (')
    expect(iLinha, 'a linha é renderizada').toBeGreaterThan(0)
    /** ⚠️ e ela está DEPOIS do número do pedido, no mesmo bloco (não num card perdido abaixo) */
    expect(iLinha - iPedido, 'a linha fica junto do pedido').toBeGreaterThan(0)
    expect(iLinha - iPedido).toBeLessThan(2000)
    expect(t, 'e o texto vem da lib, não escrito à mão').toMatch(/\{linhaRet\.texto\}/)
  })

  /**
   * ⛔⛔⛔ **A TELA NÃO CONVERTE KG EM UNIDADES.** O bônus é o MESMO `unidadesDoRetalho` que o
   * fiscal usa pro `permitido`; uma divisão por 200 no JSX seria a 2ª régua e divergiria do
   * fiscal no dia em que o dono mudar o peso da metade na ficha.
   */
  it('⛔⛔⛔ a conversão kg→unidades vem da lib, nunca do JSX', () => {
    const t = tela()
    expect(usosDe(t, 'linhaDoRetalho'), 'a tela chama o dono da linha').toBeGreaterThan(0)
    expect(t, 'e não divide por peso nenhum').not.toMatch(/\/\s*1000|pesoUnidadeG\s*\)?\s*\*|\*\s*1000/)
    expect(t, 'nem crava o 200 da metade').not.toMatch(/\b200\b\s*[);,]/)
  })

  /**
   * ⛔⛔ **O VERMELHO Nº 2: a frase tem que ser o TOTAL.** *"Deve sair ~12"* numa ordem que vai
   * render 62 é a tela escondendo metade do lote — foi isso que fez o dono desconfiar do pedido.
   *
   * ⛔ E a SOMA mora na lib: somar `massa nova + bônus` no JSX seria a 2ª derivação do total.
   */
  it('⛔⛔ o espelho da separação soma o retalho — pela lib, com o bônus', () => {
    const t = tela()
    const i = t.indexOf('fraseDaSeparacao({')
    expect(i, 'o espelho chama a lib').toBeGreaterThan(0)
    const chamada = t.slice(i, i + 400)
    expect(chamada, 'e passa o bônus do retalho').toMatch(/bonusDoRetalho:/)
    expect(chamada, 'com a régua usada (média × ficha)').toMatch(/porMedia:/)
    /** ⛔ a frase antiga, montada na mão, não pode voltar */
    expect(t, 'o texto do espelho não é escrito no JSX').not.toContain('Com isso deve sair')
    /** ⭐ e o total existe de verdade na lib */
    expect(ler(LIB)).toContain('no total')
  })
})

// ───────────────── PASSO 2: corrigir sem apagar ─────────────────

describe('⛔⛔⛔ PASSO 2 — corrigir o retalho pela MESMA porta', () => {
  /**
   * ⭐⭐ **NENHUMA PORTA NOVA.** O retalho se corrige pelo `confirmarPedido` — o writer único do
   * pedido. Uma rota própria faria duas portas escrevendo a mesma decisão (*"quanto vou produzir
   * contando o que sobrou de ontem"*), e elas divergiriam no 1º ajuste de trava.
   */
  it('⭐⭐ só o writer único grava `stockOrdemRetalho`', () => {
    const porta = semComentarios(ler(PORTA))
    expect(porta, 'a porta grava o retalho').toMatch(/stockOrdemRetalho\.(create|deleteMany)/)
    /** ⛔ e nenhuma OUTRA rota/lib de produção escreve nessa tabela */
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const saida = execSync(
      'grep -rln "stockOrdemRetalho\\.\\(create\\|update\\|upsert\\|deleteMany\\)" lib app || true',
      { cwd: RAIZ, encoding: 'utf8' },
    ).trim()
    const arquivos = saida ? saida.split('\n').filter((f) => !f.includes('__tests__')) : []
    expect(arquivos, 'um writer só').toEqual([PORTA])
  })

  /**
   * ⛔⛔⛔ **"NÃO RESPONDI" ≠ "NÃO TEM" — o defeito que a construção do passo 1 expôs.**
   *
   * O campo do retalho **nasce vazio** na correção (ordem do dono: *"nunca pré-preenchido"*).
   * Até 12/10 a tela mandava `retalhoKg: null` sempre que a resposta não era "Sim", e o servidor
   * tratava `null` e ausente igual → **corrigir só o número APAGAVA os 10 KG, em silêncio**.
   * ***Campo que nasce vazio não pode significar "apague o que você já me disse".***
   */
  it('⛔⛔⛔ a tela só manda `retalhoKg` quando o dono RESPONDEU', () => {
    const t = tela()
    const i = t.indexOf("/pedido`")
    expect(i, 'o gesto do pedido existe').toBeGreaterThan(0)
    const corpo = t.slice(i, i + 700)
    expect(corpo, 'o campo é condicional à resposta').toMatch(/respondeu\s*\?\s*\{\s*retalhoKg/)
    expect(t, 'e "respondeu" é a ausência de resposta, não o kg').toMatch(/temRetalho !== null/)
  })

  /** ⛔ a rota não pode colapsar ausente em `null` — era o `?? null` que apagava */
  it('⛔ a rota repassa o campo como veio (sem `?? null`)', () => {
    const r = semComentarios(ler(ROTA_PEDIDO))
    expect(r, 'o zod distingue os dois').toMatch(/\.nullable\(\)\.optional\(\)/)
    expect(r, 'e o repasse não colapsa').not.toMatch(/retalhoKg\s*\?\?\s*null/)
  })

  /** ⛔ e a porta só mexe na tabela quando houve resposta */
  it('⛔ a porta não toca no retalho quando o campo não veio', () => {
    const p = semComentarios(ler(PORTA))
    expect(p, 'existe a pergunta "respondeu?"').toMatch(/respondeuRetalho\s*=\s*input\.retalhoKg !== undefined/)
    const i = p.indexOf('stockOrdemRetalho.deleteMany')
    expect(i).toBeGreaterThan(0)
    expect(p.slice(Math.max(0, i - 200), i), 'o delete fica atrás da resposta').toMatch(/if \(respondeuRetalho\)/)
  })

  /**
   * ⭐⭐ **E A TRAVA DE "DEPOIS DE SEPARADA" NÃO AFROUXOU** — é a mesma do pedido, porque é a
   * mesma porta. (O comportamento está provado contra banco em `retalho.integration`.)
   */
  it('⭐⭐ a porta continua recusando depois de SEPARADA', () => {
    const p = semComentarios(ler(PORTA))
    expect(p).toMatch(/estado !== 'PLANEJADA'/)
    expect(p, 'e a recusa ENSINA a saída').toMatch(/cancele a ordem/)
  })

  /** ⭐ a correção mostra o que está declarado — senão o dono não sabe que ele continua */
  it('⭐ o bloco diz o kg declarado quando ele não respondeu', () => {
    const t = tela()
    expect(t).toMatch(/retalho\.declaradoKg != null && temRetalho === null/)
    expect(t).toMatch(/se você\s*\n?\s*não responder, ele continua|não responder, ele continua/)
  })
})

// ───────────────── as leis intocáveis ─────────────────

describe('⛔⛔ AS LEIS DO RETALHO (09/10) seguem de pé', () => {
  /**
   * ⛔⛔⛔ A SEPARAÇÃO É `ficha × pedido`, SEMPRE. O retalho **não** entra nela — o material que
   * sai da câmara é o do pedido, e o retalho já estava na cozinha. (Provado por comportamento em
   * `retalho.integration`: *"a separação com e sem retalho é IDÊNTICA"*.)
   */
  it('⛔⛔⛔ a lib do retalho não conhece a porta da separação', () => {
    const l = semComentarios(ler(LIB))
    for (const proibido of ['insumoDoPedido', 'escalaDoPedido', 'explodirSeparacao', 'criarMovimento']) {
      expect(l, `${proibido} não entra no retalho`).not.toContain(proibido)
    }
  })

  /** ⛔ e o retalho continua FORA do ledger (Fase 1, ordem do dono) */
  it('⛔ a porta do pedido não cria movimento por causa de retalho', () => {
    const p = semComentarios(ler(PORTA))
    expect(p).not.toContain('stockMovement')
  })
})
