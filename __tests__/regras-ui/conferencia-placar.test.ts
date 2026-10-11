/**
 * ⭐⭐⭐ CONFERÊNCIA v2 — O CARTÃO É PLACAR (09/10/2026, Parte 2) + A PERGUNTA DO RETALHO.
 *
 * **Ordem do dono:** *"números, curto, funcional"* — cartão de UMA LINHA, suspeitas na frente,
 * modo rajada, corrigir inline, botões de dedo. **REGRA 11 dele:** *"frase longa de volta no
 * cartão = vermelho; botão <42px = vermelho."*
 *
 * ⚠️ **ESTRUTURAL E ASSUMIDO COMO TAL:** este projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar no teste. O que dá pra travar é o que quebrou de fato: a frase longa
 * voltando, o botão encolhendo, a prioridade sumindo e a cola de prova vazando. A régua PURA
 * (`ordenarCartoes`) é executada de verdade.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { semComentarios, usosDe } from './_leitura-de-fonte'
import { ordenarCartoes } from '@/lib/stock/producao/fila-de-conferencia'
import type { CartaoDaConferencia } from '@/lib/stock/producao/fila-de-conferencia'

const ler = (p: string) => semComentarios(readFileSync(p, 'utf8'))

const CARTAO = 'components/estoque/conferencia-do-dia.tsx'
const PAINEL = 'components/estoque/painel-de-conferencia.tsx'
const GESTO = 'components/estoque/gesto-de-conferencia.ts'
const FILA_LIB = 'lib/stock/producao/fila-de-conferencia.ts'
const HOME = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'

// ───────────────── 1. o cartão de uma linha ─────────────────

describe('⭐⭐ O CARTÃO VIRA PLACAR', () => {
  it('⭐ logo de 34px, nome, e a sublinha "quem · há Xh"', () => {
    const s = ler(CARTAO)
    expect(s, 'o logo do mapa único, em 34').toMatch(/LogoDaReceita nome=\{c\.produto\} tamanho=\{34\}/)
    expect(s, 'quem declarou (sem inventar pessoa)').toMatch(/c\.declaradoPor \?\? 'sem PIN'/)
    expect(s, 'o "há Xh"').toMatch(/haQuantoTempo\(c\.minutosEsperando\)/)
  })

  it('⭐⭐ O NÚMERO GRANDE tabular: declarou / pedido', () => {
    const s = ler(CARTAO)
    expect(s, 'o declarado em 22px bold').toMatch(/text-\[22px\] font-bold">\{c\.declaradoTxt\}/)
    expect(s, 'tabular — número de dinheiro/contagem não dança').toMatch(/tabular-nums leading-none/)
    expect(s, 'o denominador ao lado').toMatch(/refTxt/)
  })

  /**
   * ⛔⛔⛔ **A REGRA 11 DO DONO: frase longa de volta no cartão = vermelho.**
   *
   * ⭐ E a trava é mais forte que a tela: **o campo morreu do PAYLOAD** (`fiscalFrase` saiu de
   * `CartaoDaConferencia`). Deixar o texto viajando no JSON seria deixar alguém desenhá-lo de
   * volta no primeiro ajuste de layout — REGRA 5 aplicada a um campo.
   */
  it('⛔⛔ a frase longa do fiscal MORREU do cartão E do payload', () => {
    const tela = ler(CARTAO)
    expect(tela, 'a frase longa voltou pro cartão').not.toMatch(/fiscalFrase/)
    expect(tela, 'o texto cru do fiscal voltou pro cartão').not.toMatch(/material separado|a receita permite/)
    const lib = ler(FILA_LIB)
    expect(lib, 'o campo da frase longa voltou pro payload da fila').not.toMatch(/fiscalFrase/)
    expect(lib, 'a fila voltou a montar a frase longa').not.toMatch(/fraseDoFiscal/)
  })

  it('⭐ o veredito é CURTO e vem do dono único (`resumoDoFiscal`)', () => {
    expect(usosDe(ler(FILA_LIB), 'resumoDoFiscal'), 'a fila parou de usar o resumo').toBeGreaterThan(0)
    const s = ler(CARTAO)
    expect(s, 'o resumo desenhado com o sinal').toMatch(/⚠ \$\{c\.fiscalResumo\}|✓ \$\{c\.fiscalResumo\}/)
    /** ⚠️ "não deu pra medir" NUNCA vira acusação — a régua do próprio fiscal */
    expect(s).toMatch(/c\.fiscalResumo == null \? 'sem material'/)
  })

  /** ⭐ e a conta COMPLETA continua viva na página da ordem — nada se perdeu de casa */
  it('⭐ a conta completa do fiscal CONTINUA na página da ordem', () => {
    expect(usosDe(ler(ORDEM), 'fraseDoFiscal'), 'a página da ordem parou de mostrar a conta').toBeGreaterThan(0)
  })
})

// ───────────────── 2. os botões de dedo ─────────────────

describe('⛔⛔ OS BOTÕES SÃO DE DEDO — 42px', () => {
  /** ⛔⛔ **REGRA 11 DO DONO: botão <42px = vermelho.** */
  it('⛔ ✓ e ✏️ têm 42px e nome pra leitor de tela', () => {
    const s = ler(CARTAO)
    const confirmar = s.slice(s.indexOf('aria-label={`conferir'))
    expect(confirmar, 'o ✓ encolheu').toMatch(/h-\[42px\] w-\[42px\]/)
    const corrigir = s.slice(s.indexOf('aria-label={`corrigir'))
    expect(corrigir, 'o ✏️ encolheu').toMatch(/h-\[42px\] w-\[42px\]/)
    expect((s.match(/aria-label=\{`(conferir|corrigir) /g) ?? []).length, 'os dois com aria-label').toBe(2)
  })

  /** ⭐ e o [Salvar] da correção inline também é de dedo */
  it('⭐ o Salvar do compacto tem 42px', () => {
    const s = ler(PAINEL)
    expect(s).toMatch(/compacto \? 'h-\[42px\]' : 'h-9'/)
    expect(s, 'o campo grande da correção inline').toMatch(/h-\[42px\] w-32 text-\[20px\]/)
  })
})

// ───────────────── 3. a ordem da fila ─────────────────

describe('⭐⭐ SUSPEITAS PRIMEIRO, DEPOIS AS MAIS ANTIGAS', () => {
  const c = (id: string, fiscalOk: boolean | null, minutos: number) =>
    ({ conclusaoId: id, fiscalOk, minutosEsperando: minutos } as unknown as CartaoDaConferencia)

  it('⭐ o ⚠ do fiscal sobe, mesmo sendo o mais novo', () => {
    const r = ordenarCartoes([c('velho', true, 500), c('novo-suspeito', false, 5), c('medio', null, 200)])
    expect(r.map((x) => x.conclusaoId)).toEqual(['novo-suspeito', 'velho', 'medio'])
  })

  it('⭐ dentro do grupo, o mais ANTIGO primeiro', () => {
    const r = ordenarCartoes([c('a', false, 10), c('b', false, 300), c('c', true, 60), c('d', true, 400)])
    expect(r.map((x) => x.conclusaoId)).toEqual(['b', 'a', 'd', 'c'])
  })

  /**
   * ⛔⛔ **A ORDEM MORA NO SERVIDOR.** Um `.sort()` na tela seria a segunda resposta pra *"o
   * que eu confiro primeiro?"*, e as duas divergiriam no primeiro degrau novo.
   */
  it('⛔ a tela NÃO reordena a fila', () => {
    const s = ler(CARTAO)
    expect(s, 'a tela voltou a ordenar por conta própria').not.toMatch(/cartoes\s*\.?\s*sort|\.sort\(/)
    expect(usosDe(ler(FILA_LIB), 'ordenarCartoes'), 'a fila parou de ordenar').toBeGreaterThan(0)
  })

  it('⭐ a borda coral de 3px marca a suspeita', () => {
    expect(ler(CARTAO)).toMatch(/suspeita \? '3px solid var\(--fam-coral-mid\)'/)
  })
})

// ───────────────── 4. rajada e assinatura ─────────────────

describe('⭐⭐ MODO RAJADA', () => {
  it('⭐ carimbar remove o cartão LOCALMENTE e o badge desce junto', () => {
    const s = ler(CARTAO)
    const f = s.slice(s.indexOf('function removerDaFila'), s.indexOf('async function carimbar'))
    expect(f, 'o cartão sai da lista local').toMatch(/f\.cartoes\.filter/)
    expect(f, 'o badge "aguardando" desce').toMatch(/aguardando: cartoes\.length/)
    expect(f, 'o contador de atrasados desce junto').toMatch(/f\.atrasados - \(sai\?\.atrasado \? 1 : 0\)/)
    expect(f, 'a outra lista recarrega').toMatch(/onMudou\?\.\(\)/)
    /** ⛔ e NÃO recarrega a fila: a lista se mexendo embaixo do dedo é o que o modo evita */
    expect(f, 'voltou a recarregar a fila no meio da rajada').not.toMatch(/carregar\(\)/)
  })

  it('⭐ a transição curta existe (o próximo sobe)', () => {
    const s = ler(CARTAO)
    expect(s).toMatch(/transition-opacity duration-150/)
    expect(s).toMatch(/opacity: saindo === c\.conclusaoId \? 0 : 1/)
  })

  it('⭐ o ✓ é UM TOQUE, pela porta única', () => {
    const s = ler(CARTAO)
    expect(usosDe(s, 'confirmarNaRota'), 'o ✓ parou de usar a porta única').toBeGreaterThan(0)
    expect(s, 'o cartão voltou a montar o corpo do POST').not.toMatch(/acao: 'CONFIRMAR'/)
  })
})

describe('⭐ A ASSINATURA É UMA LINHA NO CABEÇALHO — nunca por cartão', () => {
  it('⭐ a frase aparece UMA vez, e o compacto não a repete', () => {
    const s = ler(CARTAO)
    expect(s).toMatch(/assina no teu nome · quem fez não confere a própria/)
    expect((s.match(/assina no teu nome/g) ?? []).length, 'uma vez só').toBe(1)
    /** ⚠️ e o cabeçalho é FORA do `.map` dos cartões */
    expect(s.indexOf('assina no teu nome')).toBeLessThan(s.indexOf('fila.cartoes.map'))
    const p = ler(PAINEL)
    expect(p, 'o compacto gateia a frase longa da assinatura').toMatch(/\{!compacto && \(/)
  })
})

// ───────────────── 5. a correção inline: UMA porta ─────────────────

describe('⛔⛔ CORRIGIR INLINE — mesma porta, só a roupa muda', () => {
  it('⭐ o cartão abre o PAINEL em modo compacto, não um form novo', () => {
    const s = ler(CARTAO)
    expect(usosDe(s, 'PainelDeConferencia'), 'o cartão parou de consumir o painel').toBeGreaterThan(0)
    expect(s).toMatch(/compacto\n/)
    expect(s, 'o cartão remontou a lista de motivos').not.toMatch(/CONTOU_ERRADO/)
    expect(s, 'o cartão fez a própria prévia').not.toMatch(/PREVER_CORRECAO/)
  })

  it('⭐ fechar RECOLHE sem salvar', () => {
    const s = ler(CARTAO)
    expect(s).toMatch(/onFechar=\{\(\) => setEditando\(null\)\}/)
  })

  /** ⛔ um módulo só monta o corpo — a rota é `.strict()` e dois montadores são dois 400 */
  it('⛔ o corpo do POST mora num lugar só', () => {
    const g = ler(GESTO)
    expect(g).toMatch(/acao: 'CONFIRMAR'/)
    expect(g).toMatch(/acao: 'CORRIGIR'/)
    for (const outro of [CARTAO, PAINEL]) {
      expect(ler(outro), `${outro} voltou a montar o corpo`).not.toMatch(/acao: '(CONFIRMAR|CORRIGIR)'/)
    }
  })
})

// ───────────────── 6. dois temas, uma composição ─────────────────

describe('⭐ 2 TEMAS e UMA COMPOSIÇÃO', () => {
  it('⛔⛔ zero paleta cravada no cartão', () => {
    const s = ler(CARTAO)
    expect(s.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], 'hex cravado não inverte no tema escuro').toEqual([])
    expect(s, 'nem classe de paleta do Tailwind').not.toMatch(/\b(bg|text|border)-(slate|rose|emerald|amber|indigo|violet|sky)-\d{2,3}\b/)
  })

  /** ⛔ `bg-[var(--x)]/70` sai TRANSPARENTE no Tailwind 3 — a armadilha de 05/10 */
  it('⛔ nenhuma opacidade sobre token', () => {
    expect(ler(CARTAO)).not.toMatch(/var\(--[a-z-]+\)\]\/\d/)
  })

  it('⛔ uma composição só — a linha quebra com flex-wrap', () => {
    const s = ler(CARTAO)
    expect(s, 'a linha do cartão quebra sozinha').toMatch(/flex flex-wrap items-center gap-x-3/)
    expect(s, 'bloco só-celular na fila').not.toMatch(/sm:hidden|hidden sm:/)
  })
})

// ───────────────── 7. PARTE 1 na tela: a pergunta do retalho ─────────────────

describe('⛔⛔⛔ A PERGUNTA DO RETALHO SÓ EXISTE NA RECEITA MARCADA', () => {
  /**
   * ⚠️⚠️ REAPONTADO EM 11/10 — **A PERGUNTA MUDOU DE CASA, A RÉGUA NÃO.**
   *
   * O retalho era perguntado na CRIAÇÃO da ordem. O dono achou o fantasma da quantidade
   * (*"perguntada 2×, e o 1º número assombra a tela"*) e a decisão foi: **a pergunta é UMA, na
   * página da ordem, onde dá pra ver a prateleira** — e o retalho vem junto do número, porque é
   * a mesma pergunta (*"quanto vai sair deste lote?"*).
   *
   * ⛔ Então este bloco passou a ler a **ORDEM**. E ele é de DOIS LADOS: a pergunta existe lá
   * **E** saiu daqui — *guard que só afirma a remoção aprovaria o dia em que ela sumisse de
   * todo lugar*, e guard que só afirma a presença aprovaria a pergunta duplicada.
   *
   * ⭐ A trava continua sendo a FORMA: o bloco é gateado pelo DADO da config (que a rota só
   * devolve pra ficha marcada), nunca pelo nome da receita.
   */
  it('⛔⛔ a pergunta SAIU da criação e MORA na ordem (os dois lados)', () => {
    expect(ler(HOME), 'a pergunta do retalho voltou pra criação — são 2 lugares de novo')
      .not.toMatch(/retalho/i)
    expect(ler(ORDEM), 'a pergunta do retalho sumiu da ordem').toMatch(/Tem retalho de ontem\?/)
  })

  it('⛔⛔ o bloco é gateado pela config, nunca pelo nome da receita', () => {
    const s = ler(ORDEM)
    const i = s.indexOf('Tem retalho de ontem?')
    expect(i, 'a pergunta existe').toBeGreaterThan(0)
    const antes = s.slice(Math.max(0, i - 400), i)
    expect(antes, 'o bloco deixou de ser gateado pela config').toMatch(/\{retalho\?\.aceita && \(/)
    /** ⛔ régua por NOME seria texto livre decidindo — a cicatriz da conta 'sicredi ' */
    expect(s, 'a tela passou a decidir retalho pelo nome da receita')
      .not.toMatch(/metade de bolinha|nomeProduzido.*retalho|retalho.*nomeProduzido/i)
  })

  it('⛔ o campo NASCE VAZIO e sem resposta — nunca pré-preenchido', () => {
    const s = ler(ORDEM)
    expect(s).toMatch(/useState<'NAO' \| 'SIM' \| null>\(null\)/)
    expect(s).toMatch(/const \[retalhoKg, setRetalhoKg\] = useState\(''\)/)
    /**
     * ⚠️ E CONFIRMAR o pedido ZERA a resposta. Na criação quem zerava era a troca de ficha;
     * aqui a ordem tem UMA ficha, então o momento de limpar é o gesto — senão a resposta do
     * lote anterior sobreviveria numa correção.
     */
    expect(s).toMatch(/setTemRetalho\(null\); setRetalhoKg\(''\)/)
  })

  it('⭐ o lembrete é discreto, e é LEMBRETE — não valor do campo', () => {
    const s = ler(ORDEM)
    expect(s).toMatch(/da última vez: \{formatarQtd\(retalho\.ultimoKg/)
    expect(s, 'o último kg virou valor do campo').not.toMatch(/setRetalhoKg\(String\(retalho/)
  })

  it('⭐⭐ a frase curta vem da LIB, não de uma conta na tela', () => {
    const s = ler(ORDEM)
    expect(usosDe(s, 'fraseDoRetalho'), 'a tela parou de usar a lib da frase').toBeGreaterThan(0)
    /** ⛔ conta própria na tela prometeria um total que o fiscal não usa */
    expect(s, 'a tela voltou a dividir por 1000 na mão').not.toMatch(/\* 1000\) \/|\/ 200\b/)
  })

  it('⭐ a tela DIZ que a separação não muda', () => {
    expect(ler(ORDEM)).toMatch(/o material que sai da câmara continua sendo o do pedido/)
  })

  it('⭐ e manda o kg no POST só quando a resposta foi SIM', () => {
    const s = ler(ORDEM)
    expect(s, 'a resposta "não tem" tem que virar `null`, que APAGA o retalho anterior')
      .toMatch(/const kg = temRetalho === 'SIM' \? valorQtd\(retalhoKg\) : null/)
    expect(s).toMatch(/retalhoKg: kg && kg > 0 \? kg : null/)
  })
})

// ───────────────── 8. quem declara segue CEGO ─────────────────

describe('⛔⛔⛔ O ESPERADO COM RETALHO É COLA DE PROVA — só no payload de gerência', () => {
  /**
   * ⛔⛔ A lei de 05/10 não abre exceção porque o número ficou mais justo: quem DECLARA não vê
   * esperado nenhum. A modal da conclusão é a fatia `ConclusaoForm` da página da ordem.
   */
  it('⛔⛔ a modal da conclusão não conhece retalho nem esperado', () => {
    const t = ler(ORDEM)
    const i = t.indexOf('function ConclusaoForm')
    expect(i, 'a modal foi achada').toBeGreaterThan(0)
    const modal = t.slice(i)
    for (const cola of ['retalho', 'Retalho', 'esperadoComRetalho', 'permitido']) {
      expect(modal, `cola de prova vazou pra a modal: ${cola}`).not.toContain(cola)
    }
  })

  /** ⭐ e o selo (que TODO MUNDO vê) também não carrega número esperado */
  it('⭐ o selo da conferência não ganhou o esperado', () => {
    const s = ler('components/estoque/selo-da-conferencia.tsx')
    for (const cola of ['retalho', 'esperado', 'permitido']) {
      expect(s, `cola de prova vazou pro selo: ${cola}`).not.toContain(cola)
    }
  })
})
